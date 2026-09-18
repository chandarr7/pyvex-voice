"""Running one conversation over an established WebRTC connection.

The signalling server hands this module a connection that a browser has already
negotiated; everything from there — resolving the persona and voice, building
the pipeline, reporting what happened — lives here.

Nothing is resolved lazily. A session whose persona, voice or credentials
cannot be resolved fails before the caller is on the line, because a connected
call with no working pipeline has nothing honest to say.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

from loguru import logger
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import (
    BotStoppedSpeakingFrame,
    InterruptionFrame,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMRunFrame,
    TranscriptionFrame,
    TTSStartedFrame,
    UserStartedSpeakingFrame,
    UserStoppedSpeakingFrame,
)
from pipecat.observers.base_observer import BaseObserver, FramePushed
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.workers.runner import WorkerRunner

from .config import WorkerConfig
from .events import SessionEventLog
from .personas import get_persona
from .pipeline import build_session
from .voices import load_voice_profiles, resolve_voice

__all__ = ["SessionSpec", "SessionObserver", "run_session"]


@dataclass(frozen=True)
class SessionSpec:
    """What the API resolved for this conversation before it started.

    Attributes:
        session_id: Identifier shared with the API and the browser.
        persona_id: Which persona to play.
        voice_profile_id: Which voice to speak with, or None for the default.
    """

    session_id: str
    persona_id: str
    voice_profile_id: str | None = None


class SessionObserver(BaseObserver):
    """Turns pipeline frames into session events.

    An observer rather than a processor: this only watches, so it cannot add
    latency to the audio path or change what reaches the caller.

    Timings come from when frames actually pass. The one derived value,
    ``bargeInLatencyMs``, is the gap between speech being detected and the
    assistant's audio stopping, and it is omitted when either end is missing.
    """

    def __init__(self, events: SessionEventLog) -> None:
        super().__init__()
        self._events = events
        self._llm_started_ms: float | None = None
        self._tts_started_ms: float | None = None
        self._interrupted_at_ms: float | None = None

    async def on_push_frame(self, data: FramePushed) -> None:
        frame = data.frame
        now = time.monotonic() * 1000

        if isinstance(frame, UserStartedSpeakingFrame):
            self._events.emit("user.speech.started")
        elif isinstance(frame, UserStoppedSpeakingFrame):
            self._events.emit("user.speech.stopped")
        elif isinstance(frame, TranscriptionFrame):
            # The transcript itself is never logged; only that one arrived and
            # how long it was, which is enough to diagnose a silent recogniser.
            self._events.emit("stt.final", characters=len(frame.text or ""))
        elif isinstance(frame, LLMFullResponseStartFrame):
            self._llm_started_ms = now
            self._events.emit("llm.started")
        elif isinstance(frame, LLMFullResponseEndFrame):
            duration = None if self._llm_started_ms is None else round(now - self._llm_started_ms)
            self._llm_started_ms = None
            self._events.emit("llm.completed", **({"durationMs": duration} if duration else {}))
        elif isinstance(frame, TTSStartedFrame):
            self._tts_started_ms = now
            self._events.emit("tts.started")
        elif isinstance(frame, BotStoppedSpeakingFrame):
            duration = None if self._tts_started_ms is None else round(now - self._tts_started_ms)
            self._tts_started_ms = None
            if self._interrupted_at_ms is not None:
                # Measured, not targeted: how long the assistant kept talking
                # after speech was detected.
                self._events.emit(
                    "tts.completed",
                    bargeInLatencyMs=round(now - self._interrupted_at_ms),
                    **({"durationMs": duration} if duration else {}),
                )
                self._interrupted_at_ms = None
            else:
                self._events.emit("tts.completed", **({"durationMs": duration} if duration else {}))
        elif isinstance(frame, InterruptionFrame):
            self._interrupted_at_ms = now
            self._events.emit("interruption.started")


async def run_session(
    *,
    connection: SmallWebRTCConnection,
    spec: SessionSpec,
    config: WorkerConfig,
    events: SessionEventLog,
    on_finished: "callable[[], None] | None" = None,
) -> None:
    """Run one conversation until the caller leaves or the worker is cancelled.

    Args:
        connection: The negotiated WebRTC connection for this caller.
        spec: What the API resolved for this session.
        config: Worker configuration, already validated.
        events: Where this session's events are recorded.
        on_finished: Called once the session is over, however it ended.

    Raises:
        PersonaNotFoundError: If the persona does not exist.
        VoiceNotFoundError: If the voice profile is not configured.
    """
    persona = get_persona(spec.persona_id)
    voice = resolve_voice(
        spec.voice_profile_id,
        default_profile_id=config.default_voice_profile,
        profiles=load_voice_profiles(),
    )

    transport = SmallWebRTCTransport(
        webrtc_connection=connection,
        params=TransportParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            vad_analyzer=SileroVADAnalyzer(),
        ),
    )

    session = build_session(
        transport=transport,
        config=config,
        persona=persona,
        voice=voice,
        observers=[SessionObserver(events)],
    )

    events.emit(
        "session.created",
        personaId=persona.id,
        voiceProfileId=voice.id,
        providerVoiceId=voice.provider_voice_id,
        llmModel=config.llm_model,
    )

    runner = WorkerRunner(handle_sigint=False)
    await runner.add_workers(session.worker)

    @transport.event_handler("on_client_connected")
    async def _on_connected(_transport, _client):
        events.emit("transport.connected")
        # The greeting goes through the model so it arrives on the same path,
        # in the same voice, as every later turn.
        session.context.add_message(
            {"role": "system", "content": f"Greet the caller with exactly: {persona.greeting}"}
        )
        await session.worker.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def _on_disconnected(_transport, _client):
        events.emit("transport.disconnected")
        await runner.cancel()

    try:
        await runner.run()
        events.emit("session.completed")
    except Exception as exc:
        # The reason is recorded, but the caller is never told a session
        # succeeded when it did not.
        events.emit("session.failed", reason=type(exc).__name__)
        logger.exception("Session {} failed", spec.session_id)
        raise
    finally:
        if on_finished is not None:
            on_finished()
