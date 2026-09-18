"""Builds the Pipecat pipeline for a single conversation.

The frame path is:

    transport.input() -> STT -> user aggregator -> LLM -> TTS
        -> transport.output() -> assistant aggregator

Every service here is constructed per session. That is the property the whole
module exists to hold: a shared text-to-speech service would carry one voice
setting for the whole process, so two callers on one worker could hear each
other's voice, and a mid-call voice change in one session would land in every
other. Building fresh services per session makes voice isolation structural
rather than an invariant a later refactor can quietly break.

Written against Pipecat 1.10.0, which `pyproject.toml` pins. The service
constructors differ across minor versions, so treat that pin as load-bearing.
"""

from __future__ import annotations

from dataclasses import dataclass

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.observers.base_observer import BaseObserver
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.services.elevenlabs.stt import ElevenLabsRealtimeSTTService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.services.google.llm import GoogleLLMService
from pipecat.transports.base_transport import BaseTransport

from .config import WorkerConfig
from .personas import Persona
from .voices import VoiceProfile

__all__ = ["VoiceSession", "build_session"]


@dataclass
class VoiceSession:
    """One conversation's services, pipeline and worker.

    Held together so a caller can reach the context to seed a greeting, and the
    voice to confirm which one this session resolved to.

    Attributes:
        worker: The runnable unit for this conversation.
        context: Conversation history for this session alone.
        voice: The voice profile this session speaks with.
        persona: The persona this session plays.
        tts: This session's own speech synthesis service.
    """

    worker: PipelineWorker
    context: LLMContext
    voice: VoiceProfile
    persona: Persona
    tts: ElevenLabsTTSService


def build_session(
    *,
    transport: BaseTransport,
    config: WorkerConfig,
    persona: Persona,
    voice: VoiceProfile,
    idle_timeout_secs: float | None = None,
    observers: list[BaseObserver] | None = None,
) -> VoiceSession:
    """Assemble the pipeline for one conversation.

    Args:
        transport: The already-connected transport for this caller.
        config: Resolved worker configuration.
        persona: The persona this conversation plays.
        voice: The voice this conversation speaks with.
        idle_timeout_secs: Idle cutoff for the worker, or None for the default.
        observers: Watchers for this session's frames. They only observe, so
            they cannot add latency to the audio path.

    Returns:
        The session's worker, context and resolved voice.
    """
    # Each service takes its configuration through `settings=`; the equivalent
    # constructor keywords are deprecated in this release.
    stt = ElevenLabsRealtimeSTTService(
        api_key=config.elevenlabs_api_key,
        settings=ElevenLabsRealtimeSTTService.Settings(model=config.stt_model),
    )

    llm = GoogleLLMService(
        api_key=config.gemini_api_key,
        settings=GoogleLLMService.Settings(
            model=config.llm_model,
            system_instruction=persona.system_prompt,
        ),
    )

    # The voice is bound at construction. Nothing later reassigns it, so this
    # session cannot be made to speak as another.
    tts = ElevenLabsTTSService(
        api_key=config.elevenlabs_api_key,
        settings=ElevenLabsTTSService.Settings(
            model=config.tts_model,
            voice=voice.provider_voice_id,
        ),
    )

    # Context and aggregators are per session too, so no transcript is ever
    # visible to another conversation.
    context = LLMContext()
    aggregators = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            # Turn boundaries come from Pipecat's own voice activity detection,
            # which also drives interruption: speech detected while the agent
            # is talking cancels the queued audio downstream.
            vad_analyzer=SileroVADAnalyzer(
                params=VADParams(confidence=0.7, start_secs=0.2, stop_secs=0.8)
            ),
        ),
    )
    user_aggregator, assistant_aggregator = aggregators

    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            user_aggregator,
            llm,
            tts,
            transport.output(),
            assistant_aggregator,
        ]
    )

    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(enable_metrics=True, enable_usage_metrics=True),
        idle_timeout_secs=idle_timeout_secs,
        observers=observers,
    )

    return VoiceSession(
        worker=worker,
        context=context,
        voice=voice,
        persona=persona,
        tts=tts,
    )
