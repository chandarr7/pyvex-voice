"""WebRTC signalling for the voice worker.

Only the Node API reaches this service, and only with the shared worker token.
The browser never calls it directly: identity is established once, by the API
against Supabase, and this boundary trusts that decision rather than re-deriving
it from a request it cannot authenticate.

Run it with::

    python -m pyvex_voice.server
"""

from __future__ import annotations

import asyncio
import hmac
import os
from contextlib import asynccontextmanager
from typing import Annotated, Any

import uvicorn
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from loguru import logger
from pipecat.transports.smallwebrtc.connection import IceServer, SmallWebRTCConnection
from pipecat.transports.smallwebrtc.request_handler import (
    SmallWebRTCPatchRequest,
    SmallWebRTCRequest,
    SmallWebRTCRequestHandler,
)
from pydantic import BaseModel, Field

from .config import ConfigError, WorkerConfig, load_config
from .events import SessionEventLog
from .personas import PersonaNotFoundError
from .session import SessionSpec, run_session
from .voices import VoiceNotFoundError, load_voice_profiles

__all__ = ["create_app", "main"]


class OfferRequest(BaseModel):
    """A browser's SDP offer, forwarded by the API with the resolved session."""

    sdp: str
    type: str
    session_id: str = Field(min_length=1, max_length=128)
    persona_id: str = Field(min_length=1, max_length=64)
    voice_profile_id: str | None = Field(default=None, max_length=64)
    pc_id: str | None = None
    restart_pc: bool | None = None


class IceCandidatePayload(BaseModel):
    """One trickled ICE candidate."""

    candidate: str
    sdp_mid: str
    sdp_mline_index: int


class IcePatchRequest(BaseModel):
    """Candidates gathered after the offer was sent."""

    pc_id: str
    candidates: list[IceCandidatePayload]


class _State:
    """Process-wide handles the routes share."""

    def __init__(self) -> None:
        self.handler: SmallWebRTCRequestHandler | None = None
        self.config: WorkerConfig | None = None
        self.config_error: str | None = None
        # One event log per live session, so the API can read back what
        # actually happened rather than being told what should have.
        self.sessions: dict[str, SessionEventLog] = {}
        # Strong references to running conversations. Without them the event
        # loop is free to garbage-collect a task mid-call.
        self.tasks: set[asyncio.Task[None]] = set()


def _ice_servers() -> list[IceServer]:
    """STUN servers the worker's peer connection gathers candidates from.

    Without one it only ever offers host candidates, which fail as soon as the
    browser and the worker are not on the same network.
    """
    raw = os.environ.get("PYVEX_ICE_SERVERS", "stun:stun.l.google.com:19302").strip()
    return [IceServer(urls=url.strip()) for url in raw.split(",") if url.strip()]


def create_app(config: WorkerConfig | None = None) -> FastAPI:
    """Build the signalling application.

    Args:
        config: Pre-resolved configuration. When omitted it is read from the
            environment, and a failure is remembered rather than raised so the
            process still starts and can report itself unready.

    Returns:
        The FastAPI application.
    """
    state = _State()

    if config is not None:
        state.config = config
    else:
        try:
            state.config = load_config()
        except ConfigError as exc:
            # Starting unready beats not starting: an orchestrator can then read
            # /ready and say precisely what is missing.
            state.config_error = str(exc)
            logger.error("Voice worker is not ready: {}", exc)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        state.handler = SmallWebRTCRequestHandler(ice_servers=_ice_servers())
        logger.info("Voice worker signalling ready")
        yield
        for task in list(state.tasks):
            task.cancel()
        if state.tasks:
            await asyncio.gather(*state.tasks, return_exceptions=True)
        if state.handler is not None:
            await state.handler.close()
        state.sessions.clear()

    app = FastAPI(title="pyvex-voice worker", lifespan=lifespan)

    def require_worker_token(
        x_pyvex_worker_token: Annotated[str | None, Header()] = None,
    ) -> None:
        """Authenticate the calling API.

        Fails closed: with no token configured the worker refuses everything
        rather than accepting anonymous session creation.
        """
        expected = os.environ.get("PYVEX_WORKER_TOKEN", "")
        if not expected:
            raise HTTPException(
                status_code=503,
                detail={"code": "WORKER_TOKEN_NOT_CONFIGURED"},
            )
        if not x_pyvex_worker_token or not hmac.compare_digest(
            x_pyvex_worker_token, expected
        ):
            raise HTTPException(status_code=401, detail={"code": "WORKER_TOKEN_INVALID"})

    Authed = Depends(require_worker_token)

    @app.get("/health")
    async def health() -> dict[str, Any]:
        """Liveness only. Says nothing about whether a call could succeed."""
        return {"status": "ok", "service": "pyvex-voice-worker"}

    @app.get("/ready")
    async def ready(response: Request) -> Any:
        """Readiness: whether this worker could actually run a conversation."""
        from fastapi.responses import JSONResponse

        if state.config is None:
            return JSONResponse(
                status_code=503,
                content={
                    "status": "not_ready",
                    "reason": state.config_error or "configuration unavailable",
                    "providers": {"gemini": "not_configured", "elevenlabs": "not_configured"},
                },
            )
        return {
            "status": "ready",
            "providers": {"gemini": "configured", "elevenlabs": "configured"},
            "voiceProfiles": sorted(load_voice_profiles()),
            "activeSessions": len(state.sessions),
        }

    @app.post("/offer", dependencies=[Authed])
    async def offer(request: OfferRequest) -> dict[str, Any]:
        """Answer a browser's SDP offer and start the conversation.

        The bot begins as soon as the connection is established; the answer
        returned here is what the browser needs to complete negotiation.
        """
        if state.config is None:
            raise HTTPException(
                status_code=503,
                detail={"code": "WORKER_NOT_CONFIGURED", "message": state.config_error},
            )
        assert state.handler is not None

        events = state.sessions.setdefault(
            request.session_id, SessionEventLog(request.session_id)
        )
        spec = SessionSpec(
            session_id=request.session_id,
            persona_id=request.persona_id,
            voice_profile_id=request.voice_profile_id,
        )

        # Captured so a rejected negotiation can close the peer connection the
        # handler already built, rather than leaving it holding sockets.
        negotiated: dict[str, SmallWebRTCConnection] = {}

        async def on_connection(connection: SmallWebRTCConnection) -> None:
            negotiated["connection"] = connection
            events.emit("transport.connecting", pcId=connection.pc_id)

            async def run() -> None:
                try:
                    await run_session(
                        connection=connection,
                        spec=spec,
                        config=state.config,
                        events=events,
                        on_finished=lambda: state.sessions.pop(request.session_id, None),
                    )
                except Exception:
                    # run_session has already recorded session.failed; the
                    # session is dropped so a retry starts clean.
                    state.sessions.pop(request.session_id, None)

            # Detached, because negotiation must return the answer now rather
            # than when the conversation ends. The connection's own task
            # manager is not set up at this point, so this is scheduled on the
            # loop and held in `state.tasks` to keep it from being collected.
            task = asyncio.create_task(run(), name=f"session-{request.session_id}")
            state.tasks.add(task)
            task.add_done_callback(state.tasks.discard)

        try:
            answer = await state.handler.handle_web_request(
                request=SmallWebRTCRequest(
                    sdp=request.sdp,
                    type=request.type,
                    pc_id=request.pc_id,
                    restart_pc=request.restart_pc,
                ),
                webrtc_connection_callback=on_connection,
            )
        except (PersonaNotFoundError, VoiceNotFoundError) as exc:
            state.sessions.pop(request.session_id, None)
            connection = negotiated.pop("connection", None)
            if connection is not None:
                await connection.disconnect()
            raise HTTPException(
                status_code=400, detail={"code": "SESSION_UNRESOLVABLE", "message": str(exc)}
            ) from exc

        async def reject(status: int, detail: dict[str, str]) -> HTTPException:
            state.sessions.pop(request.session_id, None)
            connection = negotiated.pop("connection", None)
            if connection is not None:
                await connection.disconnect()
            return HTTPException(status_code=status, detail=detail)

        if not answer:
            raise await reject(502, {"code": "NEGOTIATION_FAILED"})

        # An unusable offer still yields a syntactically valid answer with no
        # media section. Returning it would have the browser negotiate against
        # nothing and only discover the failure on a timeout, so it is refused
        # here instead.
        if "m=audio" not in answer.get("sdp", ""):
            raise await reject(
                400,
                {
                    "code": "NO_AUDIO_NEGOTIATED",
                    "message": "The offer did not negotiate an audio track.",
                },
            )

        return answer

    @app.patch("/offer", dependencies=[Authed])
    async def ice_candidates(request: IcePatchRequest) -> dict[str, str]:
        """Accept ICE candidates trickled after the offer."""
        assert state.handler is not None
        from pipecat.transports.smallwebrtc.request_handler import IceCandidate

        await state.handler.handle_patch_request(
            SmallWebRTCPatchRequest(
                pc_id=request.pc_id,
                candidates=[
                    IceCandidate(
                        candidate=c.candidate,
                        sdp_mid=c.sdp_mid,
                        sdp_mline_index=c.sdp_mline_index,
                    )
                    for c in request.candidates
                ],
            )
        )
        return {"status": "ok"}

    @app.get("/sessions/{session_id}/events", dependencies=[Authed])
    async def session_events(session_id: str, after_ms: int = 0) -> dict[str, Any]:
        """Events recorded for a session, for the API to relay to the browser."""
        log = state.sessions.get(session_id)
        if log is None:
            raise HTTPException(status_code=404, detail={"code": "SESSION_NOT_FOUND"})
        return {"sessionId": session_id, "events": log.since(after_ms)}

    return app


def main() -> None:
    """Serve the signalling application."""
    host = os.environ.get("PYVEX_WORKER_HOST", "127.0.0.1")
    port = int(os.environ.get("PYVEX_WORKER_PORT", "7860"))
    uvicorn.run(create_app(), host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
