"""Runtime configuration, read from the environment.

Configuration is resolved once at startup and a missing credential is a refusal
to start, never a degraded mode: a worker that cannot reach its speech or
language provider has nothing honest to say to a caller.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

__all__ = ["ConfigError", "WorkerConfig", "load_config"]


class ConfigError(RuntimeError):
    """Raised when the environment cannot support a conversation."""


@dataclass(frozen=True)
class WorkerConfig:
    """Everything the worker needs to run a conversation.

    Attributes:
        elevenlabs_api_key: Key for both speech recognition and synthesis.
        gemini_api_key: Key for the language model.
        llm_model: Gemini model id used for conversation turns.
        stt_model: ElevenLabs speech-to-text model id.
        tts_model: ElevenLabs text-to-speech model id.
        default_voice_profile: Voice profile used when a session names none.
    """

    elevenlabs_api_key: str
    gemini_api_key: str
    llm_model: str
    stt_model: str
    tts_model: str
    default_voice_profile: str

    @property
    def redacted(self) -> dict[str, str]:
        """A form safe to log: which credentials are present, never their values."""
        return {
            "elevenlabs_api_key": "set" if self.elevenlabs_api_key else "missing",
            "gemini_api_key": "set" if self.gemini_api_key else "missing",
            "llm_model": self.llm_model,
            "stt_model": self.stt_model,
            "tts_model": self.tts_model,
            "default_voice_profile": self.default_voice_profile,
        }


# Chosen so speech in and speech out need one provider account rather than two.
_DEFAULT_LLM_MODEL = "gemini-2.5-flash"
_DEFAULT_STT_MODEL = "scribe_v1"
_DEFAULT_TTS_MODEL = "eleven_turbo_v2_5"
_DEFAULT_VOICE_PROFILE = "warm_professional"


def load_config(env: dict[str, str] | None = None) -> WorkerConfig:
    """Build a config from the environment.

    Args:
        env: Mapping to read instead of ``os.environ``. Used by tests.

    Returns:
        The resolved configuration.

    Raises:
        ConfigError: If any required credential is absent. The message names
            every missing variable at once, so a misconfigured deployment is
            fixed in one pass rather than one restart per variable.
    """
    source = os.environ if env is None else env

    required = {
        "ELEVENLABS_API_KEY": source.get("ELEVENLABS_API_KEY", "").strip(),
        "GEMINI_API_KEY": source.get("GEMINI_API_KEY", "").strip(),
    }
    missing = sorted(name for name, value in required.items() if not value)
    if missing:
        raise ConfigError(
            "Cannot start a voice session without: " + ", ".join(missing)
        )

    return WorkerConfig(
        elevenlabs_api_key=required["ELEVENLABS_API_KEY"],
        gemini_api_key=required["GEMINI_API_KEY"],
        llm_model=source.get("PYVEX_LLM_MODEL", "").strip() or _DEFAULT_LLM_MODEL,
        stt_model=source.get("PYVEX_STT_MODEL", "").strip() or _DEFAULT_STT_MODEL,
        tts_model=source.get("PYVEX_TTS_MODEL", "").strip() or _DEFAULT_TTS_MODEL,
        default_voice_profile=(
            source.get("PYVEX_DEFAULT_VOICE_PROFILE", "").strip() or _DEFAULT_VOICE_PROFILE
        ),
    )
