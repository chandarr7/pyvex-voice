"""Personas stay bounded, and stay identical to the Node runtime's."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from pyvex_voice.personas import PersonaNotFoundError, get_persona, load_personas

SHARED = Path(__file__).resolve().parents[2] / "shared" / "personas.json"

# Instructions that would have the model report a completed action it has no
# tool to perform.
FORBIDDEN = (
    "schedule appointments",
    "book the appointment",
    "authorize the payment",
    "freeze the card",
    "dispatch the shipment",
    "confirm security actions",
    "triage urgency",
)


def test_personas_load() -> None:
    personas = load_personas()
    assert personas
    for persona_id, persona in personas.items():
        assert persona.id == persona_id
        assert persona.greeting and persona.system_prompt


@pytest.mark.parametrize("persona_id", sorted(load_personas()))
def test_no_persona_claims_a_capability_it_lacks(persona_id: str) -> None:
    prompt = get_persona(persona_id).system_prompt.lower()
    for forbidden in FORBIDDEN:
        assert forbidden not in prompt


@pytest.mark.parametrize("persona_id", sorted(load_personas()))
def test_every_persona_carries_the_guardrails(persona_id: str) -> None:
    prompt = get_persona(persona_id).system_prompt
    assert "no access to any account" in prompt
    assert "Never invent names, reference numbers" in prompt
    assert "Never state or imply that you have looked something up" in prompt


@pytest.mark.parametrize("persona_id", sorted(load_personas()))
def test_no_greeting_asserts_a_retrieved_fact(persona_id: str) -> None:
    greeting = get_persona(persona_id).greeting
    assert "$" not in greeting
    for claim in ("I detected", "I have reserved", "is closed near"):
        assert claim not in greeting


def test_an_unknown_persona_raises_rather_than_defaulting() -> None:
    # Running a caller through the wrong script is worse than not starting.
    with pytest.raises(PersonaNotFoundError, match="nonexistent"):
        get_persona("nonexistent")
    with pytest.raises(PersonaNotFoundError):
        get_persona(None)


def test_this_worker_reads_the_same_file_the_node_api_does() -> None:
    # Guards the single source of truth: were these to diverge, one runtime
    # could claim a capability the other refuses.
    raw = json.loads(SHARED.read_text(encoding="utf-8"))
    guardrails = " ".join(raw["guardrails"])
    personas = load_personas()

    assert set(personas) == {flow["id"] for flow in raw["flows"]}
    for flow in raw["flows"]:
        expected = f"{flow['persona']} {guardrails}"
        assert personas[flow["id"]].system_prompt == expected
