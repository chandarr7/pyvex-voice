"""Preflight reports what it observed, and never echoes a credential."""

from __future__ import annotations

import httpx
import pytest

from pyvex_voice.config import WorkerConfig
from pyvex_voice.preflight import CheckStatus, run_preflight

SECRET = "sk-super-secret-value-do-not-print"

CONFIG = WorkerConfig(
    elevenlabs_api_key=SECRET,
    gemini_api_key=SECRET,
    llm_model="gemini-2.5-flash",
    stt_model="scribe_v1",
    tts_model="eleven_turbo_v2_5",
    default_voice_profile="warm_professional",
)


def _statuses(results) -> dict[str, CheckStatus]:
    return {r.name: r.status for r in results}


async def test_reports_not_configured_when_credentials_are_absent(monkeypatch) -> None:
    for name in ("ELEVENLABS_API_KEY", "GEMINI_API_KEY"):
        monkeypatch.delenv(name, raising=False)

    results = await run_preflight()

    # Nothing is probed, because there is nothing to probe with.
    assert [r.name for r in results] == ["configuration"]
    assert results[0].status is CheckStatus.NOT_CONFIGURED


async def test_a_provider_failure_is_reported_not_hidden(monkeypatch) -> None:
    def failing_client(*_args, **_kwargs):
        raise httpx.ConnectError("no route")

    monkeypatch.setattr("google.genai.Client", failing_client)
    monkeypatch.setattr(
        "httpx.AsyncClient.get",
        lambda *a, **k: (_ for _ in ()).throw(httpx.ConnectError("no route")),
    )

    results = await run_preflight(CONFIG)
    statuses = _statuses(results)
    assert statuses["gemini.auth"] is CheckStatus.FAIL
    assert statuses["elevenlabs.auth"] is CheckStatus.FAIL


async def test_no_result_ever_contains_the_credential(monkeypatch) -> None:
    # A provider that quotes the key back must not have it relayed onward.
    def leaky(*_args, **_kwargs):
        raise RuntimeError(f"invalid key {SECRET}")

    monkeypatch.setattr("google.genai.Client", leaky)
    monkeypatch.setattr("httpx.AsyncClient.get", lambda *a, **k: leaky())

    results = await run_preflight(CONFIG)
    for result in results:
        assert SECRET not in result.detail
        assert SECRET not in result.name


async def test_flags_a_model_the_key_cannot_use(monkeypatch) -> None:
    class Model:
        def __init__(self, name: str) -> None:
            self.name = name

    class Models:
        def list(self):
            return [Model("models/gemini-1.0-other")]

    class Client:
        def __init__(self, **_kwargs) -> None:
            self.models = Models()

    monkeypatch.setattr("google.genai.Client", Client)
    monkeypatch.setattr(
        "httpx.AsyncClient.get",
        lambda *a, **k: (_ for _ in ()).throw(httpx.ConnectError("skip")),
    )

    results = await run_preflight(CONFIG)
    statuses = _statuses(results)
    assert statuses["gemini.auth"] is CheckStatus.PASS
    # The configured model is absent from the account, which must not pass.
    assert statuses["gemini.model"] is CheckStatus.FAIL
