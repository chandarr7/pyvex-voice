"""The signalling boundary: who may reach it, and what it admits to."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from pyvex_voice.config import WorkerConfig
from pyvex_voice.server import create_app

TOKEN = "test-worker-token"

CONFIG = WorkerConfig(
    elevenlabs_api_key="k1",
    gemini_api_key="k2",
    llm_model="gemini-2.5-flash",
    stt_model="scribe_v1",
    tts_model="eleven_turbo_v2_5",
    default_voice_profile="warm_professional",
)

PROTECTED = [
    ("post", "/offer", {"sdp": "x", "type": "offer", "session_id": "s", "persona_id": "p"}),
    ("patch", "/offer", {"pc_id": "p", "candidates": []}),
    ("get", "/sessions/s/events", None),
]


@pytest.fixture
def client(monkeypatch) -> TestClient:
    monkeypatch.setenv("PYVEX_WORKER_TOKEN", TOKEN)
    with TestClient(create_app(CONFIG)) as c:
        yield c


@pytest.fixture
def unconfigured_client(monkeypatch) -> TestClient:
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("PYVEX_WORKER_TOKEN", TOKEN)
    with TestClient(create_app()) as c:
        yield c


class TestInternalAuth:
    @staticmethod
    def _call(client, method, path, body, headers=None):
        kwargs = {} if body is None else {"json": body}
        if headers:
            kwargs["headers"] = headers
        return getattr(client, method)(path, **kwargs)

    @pytest.mark.parametrize("method,path,body", PROTECTED)
    def test_rejects_a_caller_with_no_token(self, client, method, path, body) -> None:
        response = self._call(client, method, path, body)
        assert response.status_code == 401
        assert response.json()["detail"]["code"] == "WORKER_TOKEN_INVALID"

    @pytest.mark.parametrize("method,path,body", PROTECTED)
    def test_rejects_a_caller_with_the_wrong_token(self, client, method, path, body) -> None:
        response = self._call(
            client, method, path, body, {"X-Pyvex-Worker-Token": "wrong"}
        )
        assert response.status_code == 401

    def test_fails_closed_when_no_token_is_configured(self, monkeypatch) -> None:
        # Absent configuration must refuse everything, not admit everyone.
        monkeypatch.delenv("PYVEX_WORKER_TOKEN", raising=False)
        with TestClient(create_app(CONFIG)) as c:
            response = c.post(
                "/offer",
                json={"sdp": "x", "type": "offer", "session_id": "s", "persona_id": "p"},
                headers={"X-Pyvex-Worker-Token": "anything"},
            )
        assert response.status_code == 503
        assert response.json()["detail"]["code"] == "WORKER_TOKEN_NOT_CONFIGURED"


class TestHealthAndReadiness:
    def test_health_needs_no_token_and_reports_liveness(self, client) -> None:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    def test_ready_reports_ready_when_providers_are_configured(self, client) -> None:
        body = client.get("/ready").json()
        assert body["status"] == "ready"
        assert body["providers"] == {"gemini": "configured", "elevenlabs": "configured"}
        assert body["voiceProfiles"]

    def test_ready_refuses_when_credentials_are_missing(self, unconfigured_client) -> None:
        # A worker that cannot reach its providers must not be sent traffic.
        response = unconfigured_client.get("/ready")
        assert response.status_code == 503
        assert response.json()["status"] == "not_ready"

    def test_health_still_answers_while_unready(self, unconfigured_client) -> None:
        # Liveness and readiness are separate questions.
        assert unconfigured_client.get("/health").status_code == 200


class TestOffer:
    def test_refuses_an_offer_while_unconfigured(self, unconfigured_client) -> None:
        response = unconfigured_client.post(
            "/offer",
            json={"sdp": "x", "type": "offer", "session_id": "s", "persona_id": "customer_support"},
            headers={"X-Pyvex-Worker-Token": TOKEN},
        )
        assert response.status_code == 503
        assert response.json()["detail"]["code"] == "WORKER_NOT_CONFIGURED"

    @pytest.mark.parametrize(
        "body",
        [
            {"type": "offer", "session_id": "s", "persona_id": "p"},
            {"sdp": "x", "session_id": "s", "persona_id": "p"},
            {"sdp": "x", "type": "offer", "persona_id": "p"},
            {"sdp": "x", "type": "offer", "session_id": "s"},
            {"sdp": "x", "type": "offer", "session_id": "", "persona_id": "p"},
        ],
    )
    def test_rejects_a_malformed_offer(self, client, body) -> None:
        response = client.post("/offer", json=body, headers={"X-Pyvex-Worker-Token": TOKEN})
        assert response.status_code == 422

    def test_unknown_session_events_are_not_invented(self, client) -> None:
        response = client.get(
            "/sessions/never-existed/events", headers={"X-Pyvex-Worker-Token": TOKEN}
        )
        assert response.status_code == 404
        assert response.json()["detail"]["code"] == "SESSION_NOT_FOUND"


class TestSecrets:
    def test_no_response_carries_a_credential(self, client) -> None:
        for path in ("/health", "/ready"):
            assert "k1" not in client.get(path).text
            assert "k2" not in client.get(path).text
