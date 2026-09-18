"""Configuration refuses to start rather than degrading."""

from __future__ import annotations

import pytest

from pyvex_voice.config import ConfigError, load_config

COMPLETE = {"ELEVENLABS_API_KEY": "k1", "GEMINI_API_KEY": "k2"}


def test_loads_a_complete_environment() -> None:
    config = load_config(COMPLETE)
    assert config.elevenlabs_api_key == "k1"
    assert config.gemini_api_key == "k2"
    assert config.llm_model and config.stt_model and config.tts_model


@pytest.mark.parametrize("missing", sorted(COMPLETE))
def test_refuses_when_a_credential_is_absent(missing: str) -> None:
    env = {k: v for k, v in COMPLETE.items() if k != missing}
    with pytest.raises(ConfigError, match=missing):
        load_config(env)


def test_names_every_missing_credential_at_once() -> None:
    with pytest.raises(ConfigError) as exc:
        load_config({})
    message = str(exc.value)
    assert "ELEVENLABS_API_KEY" in message and "GEMINI_API_KEY" in message


def test_treats_blank_as_absent() -> None:
    with pytest.raises(ConfigError, match="GEMINI_API_KEY"):
        load_config({**COMPLETE, "GEMINI_API_KEY": "   "})


def test_overrides_are_honoured() -> None:
    config = load_config({**COMPLETE, "PYVEX_LLM_MODEL": "gemini-2.5-pro"})
    assert config.llm_model == "gemini-2.5-pro"


def test_redacted_form_carries_no_secret() -> None:
    redacted = load_config(COMPLETE).redacted
    assert "k1" not in str(redacted) and "k2" not in str(redacted)
    assert redacted["elevenlabs_api_key"] == "set"
