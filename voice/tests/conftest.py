"""Shared fixtures.

Credentials here are placeholders. Pipecat's service constructors do not open a
connection, so a pipeline can be assembled and inspected without a provider
account; only running a conversation needs real keys.
"""

from __future__ import annotations

import pytest

from pyvex_voice.config import WorkerConfig


@pytest.fixture
def config() -> WorkerConfig:
    return WorkerConfig(
        elevenlabs_api_key="test-elevenlabs-key",
        gemini_api_key="test-gemini-key",
        llm_model="gemini-2.5-flash",
        stt_model="scribe_v1",
        tts_model="eleven_turbo_v2_5",
        default_voice_profile="warm_professional",
    )


class FakeTransport:
    """Stands in for a connected transport.

    `build_session` only places the transport's input and output processors in
    the pipeline, so a pair of real pass-through processors is enough to build
    and inspect one.
    """

    def __init__(self) -> None:
        from pipecat.processors.frame_processor import FrameProcessor

        self._input = FrameProcessor(name="fake-input")
        self._output = FrameProcessor(name="fake-output")

    def input(self):
        return self._input

    def output(self):
        return self._output


@pytest.fixture
def transport() -> FakeTransport:
    return FakeTransport()
