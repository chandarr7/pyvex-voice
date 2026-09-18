"""End-to-end WebRTC negotiation against the real worker.

A genuine aiortc peer plays the browser: it offers, receives the worker's
answer, exchanges ICE over real UDP on the loopback interface, and the test
asserts the connection actually reaches ``connected``.

No provider credentials are needed. Negotiation completes before the pipeline
reaches ElevenLabs or Gemini, so this proves the transport without proving the
conversation — the pipeline behind it then fails on provider auth, which is the
honest credential boundary.
"""

from __future__ import annotations

import asyncio

import pytest
from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.mediastreams import AudioStreamTrack
from httpx import ASGITransport, AsyncClient

from pyvex_voice.config import WorkerConfig
from pyvex_voice.server import create_app

pytestmark = pytest.mark.integration

TOKEN = "integration-worker-token"

CONFIG = WorkerConfig(
    elevenlabs_api_key="not-a-real-key",
    gemini_api_key="not-a-real-key",
    llm_model="gemini-2.5-flash",
    stt_model="scribe_v1",
    tts_model="eleven_turbo_v2_5",
    default_voice_profile="warm_professional",
)


async def _wait_for(predicate, timeout: float, interval: float = 0.1) -> bool:
    """Poll until predicate holds or the timeout expires."""
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout
    while loop.time() < deadline:
        if predicate():
            return True
        await asyncio.sleep(interval)
    return predicate()


@pytest.fixture
def app(monkeypatch):
    monkeypatch.setenv("PYVEX_WORKER_TOKEN", TOKEN)
    return create_app(CONFIG)


@pytest.mark.asyncio
async def test_a_real_peer_reaches_connected(app) -> None:
    """The browser half of the handshake completes against the worker."""
    # The app's lifespan builds the signalling handler.
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://worker"
    ) as client:
        async with app.router.lifespan_context(app):
            pc = RTCPeerConnection()
            states: list[str] = []

            @pc.on("connectionstatechange")
            async def _on_state_change() -> None:
                states.append(pc.connectionState)

            # A browser sends a microphone track and expects one back.
            pc.addTrack(AudioStreamTrack())
            pc.addTransceiver("audio", direction="sendrecv")

            offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            # Wait for ICE gathering so the offer carries host candidates.
            await _wait_for(lambda: pc.iceGatheringState == "complete", timeout=5.0)

            response = await client.post(
                "/offer",
                json={
                    "sdp": pc.localDescription.sdp,
                    "type": pc.localDescription.type,
                    "session_id": "integration-session",
                    "persona_id": "customer_support",
                },
                headers={"X-Pyvex-Worker-Token": TOKEN},
                timeout=30.0,
            )

            assert response.status_code == 200, response.text
            answer = response.json()
            assert answer["type"] == "answer"
            assert "m=audio" in answer["sdp"]

            await pc.setRemoteDescription(
                RTCSessionDescription(sdp=answer["sdp"], type=answer["type"])
            )

            connected = await _wait_for(
                lambda: pc.connectionState == "connected", timeout=25.0
            )
            assert connected, f"never connected; states seen: {states}"

            # The worker recorded the transport reaching the browser, rather
            # than the API being told so.
            events = await client.get(
                "/sessions/integration-session/events",
                headers={"X-Pyvex-Worker-Token": TOKEN},
                timeout=10.0,
            )
            names = [e["event"] for e in events.json()["events"]]
            assert "transport.connecting" in names

            await pc.close()


@pytest.mark.asyncio
async def test_a_malformed_offer_is_refused_not_answered(app) -> None:
    """Nothing that is not a real offer produces an answer."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://worker"
    ) as client:
        async with app.router.lifespan_context(app):
            response = await client.post(
                "/offer",
                json={
                    "sdp": "this is not an sdp",
                    "type": "offer",
                    "session_id": "bad-session",
                    "persona_id": "customer_support",
                },
                headers={"X-Pyvex-Worker-Token": TOKEN},
                timeout=30.0,
            )

    # An unusable offer is refused, not answered with a media-less SDP the
    # browser would negotiate against until it timed out.
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "NO_AUDIO_NEGOTIATED"
