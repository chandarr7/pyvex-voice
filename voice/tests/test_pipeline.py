"""Pipeline assembly, and the isolation two concurrent callers depend on."""

from __future__ import annotations

from pipecat.pipeline.worker import PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.services.elevenlabs.stt import ElevenLabsRealtimeSTTService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.services.google.llm import GoogleLLMService

from pyvex_voice.personas import get_persona
from pyvex_voice.pipeline import build_session
from pyvex_voice.voices import load_voice_profiles, resolve_voice


def _inner_processors(session):
    """The processors of the pipeline as written.

    PipelineWorker wraps it with a source, an RTVI processor and a sink, so the
    services under test sit one level in.
    """
    from pipecat.pipeline.pipeline import Pipeline

    inner = next(
        p for p in session.worker.pipeline.processors if isinstance(p, Pipeline)
    )
    return inner.processors


def _voice_of(tts) -> str:
    """The voice a synthesis service is bound to.

    Pipecat exposes no public accessor for resolved settings, so this reads the
    private field. It is version-coupled, which the exact pin in pyproject.toml
    already makes explicit, and it is the only way to prove two sessions do not
    share a voice.
    """
    return tts._settings.voice


def _session(transport, config, *, persona_id: str, voice_id: str):
    return build_session(
        transport=transport,
        config=config,
        persona=get_persona(persona_id),
        voice=resolve_voice(
            voice_id,
            default_profile_id=config.default_voice_profile,
            profiles=load_voice_profiles({}),
        ),
    )


def test_builds_a_worker_with_the_expected_frame_path(transport, config) -> None:
    session = _session(
        transport, config, persona_id="customer_support", voice_id="warm_professional"
    )

    assert isinstance(session.worker, PipelineWorker)
    assert isinstance(session.context, LLMContext)

    kinds = [type(p) for p in _inner_processors(session)]
    assert ElevenLabsRealtimeSTTService in kinds
    assert GoogleLLMService in kinds
    assert ElevenLabsTTSService in kinds
    # Speech recognition precedes the model, which precedes synthesis.
    assert (
        kinds.index(ElevenLabsRealtimeSTTService)
        < kinds.index(GoogleLLMService)
        < kinds.index(ElevenLabsTTSService)
    )


def test_the_session_speaks_with_the_voice_it_resolved(transport, config) -> None:
    session = _session(
        transport, config, persona_id="customer_support", voice_id="calm_welcoming"
    )
    expected = load_voice_profiles({})["calm_welcoming"].provider_voice_id
    assert session.voice.provider_voice_id == expected
    assert _voice_of(session.tts) == expected


def test_the_persona_prompt_reaches_the_model(transport, config) -> None:
    persona = get_persona("clinical_intake")
    session = _session(
        transport, config, persona_id="clinical_intake", voice_id="warm_professional"
    )
    llm = next(p for p in _inner_processors(session) if isinstance(p, GoogleLLMService))
    assert llm._settings.system_instruction == persona.system_prompt
    assert "no access to any account" in llm._settings.system_instruction


def test_two_concurrent_sessions_do_not_share_a_voice(config) -> None:
    """The invariant this module exists to hold.

    A shared synthesis service would carry one voice for the whole process, so
    two callers on one worker could hear each other's voice.
    """
    from tests.conftest import FakeTransport

    a = _session(
        FakeTransport(), config, persona_id="real_estate", voice_id="confident_energetic"
    )
    b = _session(
        FakeTransport(), config, persona_id="clinical_intake", voice_id="steady_reassuring"
    )

    profiles = load_voice_profiles({})
    assert a.tts is not b.tts
    assert _voice_of(a.tts) == profiles["confident_energetic"].provider_voice_id
    assert _voice_of(b.tts) == profiles["steady_reassuring"].provider_voice_id
    assert _voice_of(a.tts) != _voice_of(b.tts)

    # Changing one session's voice must not reach the other.
    a.tts._settings.voice = "mutated-by-session-a"
    assert _voice_of(b.tts) == profiles["steady_reassuring"].provider_voice_id


def test_two_concurrent_sessions_do_not_share_a_transcript(config) -> None:
    from tests.conftest import FakeTransport

    a = _session(
        FakeTransport(), config, persona_id="real_estate", voice_id="warm_professional"
    )
    b = _session(
        FakeTransport(), config, persona_id="clinical_intake", voice_id="calm_welcoming"
    )

    assert a.context is not b.context
    a.context.add_message({"role": "user", "content": "SESSION_A_ONLY"})

    assert "SESSION_A_ONLY" not in str(b.context.get_messages())
    assert a.persona.id != b.persona.id


def test_each_session_gets_its_own_worker_and_services(config) -> None:
    from tests.conftest import FakeTransport

    a = _session(
        FakeTransport(), config, persona_id="customer_support", voice_id="warm_professional"
    )
    b = _session(
        FakeTransport(), config, persona_id="customer_support", voice_id="warm_professional"
    )

    # Same persona and voice, still nothing shared.
    assert a.worker is not b.worker
    assert a.tts is not b.tts
    assert a.context is not b.context
