"""Check that the configured providers will actually work.

Run before trusting a deployment::

    python -m pyvex_voice.preflight

Each provider reports PASS, FAIL or NOT_CONFIGURED. The checks are deliberately
cheap: they authenticate and confirm the configured model and voice exist. No
speech is synthesised and no conversation is held, so running this repeatedly
costs nothing meaningful.

Credentials are never printed, and a provider's own error text is summarised
rather than echoed, since it can quote the key back.
"""

from __future__ import annotations

import asyncio
import sys
from dataclasses import dataclass
from enum import Enum

import httpx

from .config import ConfigError, WorkerConfig, load_config
from .voices import load_voice_profiles

__all__ = ["CheckStatus", "CheckResult", "run_preflight", "main"]

ELEVENLABS_API = "https://api.elevenlabs.io/v1"
REQUEST_TIMEOUT_SECS = 15.0


class CheckStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    NOT_CONFIGURED = "NOT_CONFIGURED"


@dataclass(frozen=True)
class CheckResult:
    """One provider's verdict.

    Attributes:
        name: What was checked.
        status: The verdict.
        detail: A short explanation, free of credentials.
    """

    name: str
    status: CheckStatus
    detail: str


def _summarise(exc: Exception) -> str:
    """Describe a failure without repeating anything a provider echoed back."""
    if isinstance(exc, httpx.TimeoutException):
        return "the provider did not respond in time"
    if isinstance(exc, httpx.HTTPStatusError):
        return f"the provider returned HTTP {exc.response.status_code}"
    if isinstance(exc, httpx.HTTPError):
        return "the provider could not be reached"
    return f"unexpected {type(exc).__name__}"


async def _check_gemini(config: WorkerConfig) -> list[CheckResult]:
    """Authenticate against Gemini and confirm the configured model exists."""
    from google import genai

    def list_models() -> list[str]:
        client = genai.Client(api_key=config.gemini_api_key)
        # Model names come back fully qualified, e.g. "models/gemini-2.5-flash".
        return [m.name.split("/")[-1] for m in client.models.list() if m.name]

    try:
        names = await asyncio.to_thread(list_models)
    except Exception as exc:  # noqa: BLE001 - every failure mode is reportable
        return [
            CheckResult("gemini.auth", CheckStatus.FAIL, _summarise(exc)),
            CheckResult("gemini.model", CheckStatus.FAIL, "not checked"),
        ]

    results = [
        CheckResult("gemini.auth", CheckStatus.PASS, f"{len(names)} models visible")
    ]
    if config.llm_model in names:
        results.append(
            CheckResult("gemini.model", CheckStatus.PASS, f"{config.llm_model} available")
        )
    else:
        results.append(
            CheckResult(
                "gemini.model",
                CheckStatus.FAIL,
                f"{config.llm_model} is not available to this key",
            )
        )
    return results


async def _check_elevenlabs(config: WorkerConfig) -> list[CheckResult]:
    """Authenticate against ElevenLabs and confirm every configured voice exists."""
    headers = {"xi-api-key": config.elevenlabs_api_key}

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECS) as client:
            response = await client.get(f"{ELEVENLABS_API}/voices", headers=headers)
            response.raise_for_status()
            payload = response.json()
    except Exception as exc:  # noqa: BLE001 - every failure mode is reportable
        return [
            CheckResult("elevenlabs.auth", CheckStatus.FAIL, _summarise(exc)),
            CheckResult("elevenlabs.voices", CheckStatus.FAIL, "not checked"),
        ]

    available = {v.get("voice_id") for v in payload.get("voices", [])}
    results = [
        CheckResult("elevenlabs.auth", CheckStatus.PASS, f"{len(available)} voices visible")
    ]

    profiles = load_voice_profiles()
    missing = sorted(
        profile.id
        for profile in profiles.values()
        if profile.provider_voice_id not in available
    )
    if missing:
        # A profile pointing at a voice this account cannot use would fail only
        # once a caller was already on the line.
        results.append(
            CheckResult(
                "elevenlabs.voices",
                CheckStatus.FAIL,
                f"voice profiles unavailable to this key: {', '.join(missing)}",
            )
        )
    else:
        results.append(
            CheckResult(
                "elevenlabs.voices",
                CheckStatus.PASS,
                f"all {len(profiles)} voice profiles available",
            )
        )
    return results


def _check_services(config: WorkerConfig) -> list[CheckResult]:
    """Confirm the pipeline's services construct with this configuration."""
    from pipecat.services.elevenlabs.stt import ElevenLabsRealtimeSTTService
    from pipecat.services.elevenlabs.tts import ElevenLabsTTSService

    results: list[CheckResult] = []
    try:
        ElevenLabsRealtimeSTTService(
            api_key=config.elevenlabs_api_key,
            settings=ElevenLabsRealtimeSTTService.Settings(model=config.stt_model),
        )
        results.append(CheckResult("stt.init", CheckStatus.PASS, config.stt_model))
    except Exception as exc:  # noqa: BLE001
        results.append(CheckResult("stt.init", CheckStatus.FAIL, _summarise(exc)))

    try:
        ElevenLabsTTSService(
            api_key=config.elevenlabs_api_key,
            settings=ElevenLabsTTSService.Settings(model=config.tts_model),
        )
        results.append(CheckResult("tts.init", CheckStatus.PASS, config.tts_model))
    except Exception as exc:  # noqa: BLE001
        results.append(CheckResult("tts.init", CheckStatus.FAIL, _summarise(exc)))

    return results


async def run_preflight(config: WorkerConfig | None = None) -> list[CheckResult]:
    """Check every provider this worker depends on.

    Args:
        config: Pre-resolved configuration, or None to read the environment.

    Returns:
        One result per check, in reporting order.
    """
    if config is None:
        try:
            config = load_config()
        except ConfigError as exc:
            return [CheckResult("configuration", CheckStatus.NOT_CONFIGURED, str(exc))]

    gemini, elevenlabs = await asyncio.gather(
        _check_gemini(config), _check_elevenlabs(config)
    )
    return [*gemini, *elevenlabs, *_check_services(config)]


def main() -> None:
    """Run the checks and exit non-zero unless every one passed."""
    results = asyncio.run(run_preflight())

    width = max(len(r.name) for r in results)
    for result in results:
        print(f"{result.name.ljust(width)}  {result.status.value:<15} {result.detail}")

    failed = [r for r in results if r.status is not CheckStatus.PASS]
    print()
    if failed:
        print(f"{len(failed)} of {len(results)} checks did not pass.")
        sys.exit(1)
    print(f"All {len(results)} checks passed.")


if __name__ == "__main__":
    main()
