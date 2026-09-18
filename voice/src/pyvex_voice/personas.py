"""Conversation personas, loaded from ``shared/personas.json``.

The Node API reads the same file. Two hand-maintained copies of these prompts
would drift, and drift here means one runtime claiming a capability the other
refuses, which is the failure the guardrails exist to prevent.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

__all__ = ["Persona", "PersonaNotFoundError", "load_personas", "get_persona"]

# voice/src/pyvex_voice/personas.py -> repository root
_SHARED_PERSONAS = Path(__file__).resolve().parents[3] / "shared" / "personas.json"


class PersonaNotFoundError(KeyError):
    """Raised when a session asks for a persona that does not exist."""


@dataclass(frozen=True)
class Persona:
    """A conversation persona and the prompt that bounds it.

    Attributes:
        id: Stable identifier a session refers to.
        name: Human-readable name.
        description: What this persona is for.
        greeting: The first thing the agent says.
        system_prompt: The persona instruction with the shared guardrails
            appended.
        suggested_prompts: Example openers for a caller.
    """

    id: str
    name: str
    description: str
    greeting: str
    system_prompt: str
    suggested_prompts: tuple[str, ...]


@lru_cache(maxsize=1)
def load_personas() -> dict[str, Persona]:
    """Return every persona, keyed by id.

    Returns:
        Personas by id, each with the guardrails already appended.

    Raises:
        FileNotFoundError: If the shared persona file is missing, which means
            the worker is running outside the repository layout it expects.
    """
    if not _SHARED_PERSONAS.is_file():
        raise FileNotFoundError(f"Shared persona file not found at {_SHARED_PERSONAS}")

    data = json.loads(_SHARED_PERSONAS.read_text(encoding="utf-8"))
    guardrails = " ".join(data["guardrails"])

    return {
        flow["id"]: Persona(
            id=flow["id"],
            name=flow["name"],
            description=flow["description"],
            greeting=flow["greeting"],
            system_prompt=f"{flow['persona']} {guardrails}",
            suggested_prompts=tuple(flow["suggestedPrompts"]),
        )
        for flow in data["flows"]
    }


def get_persona(persona_id: str | None) -> Persona:
    """Resolve a persona by id.

    Args:
        persona_id: The persona the session asked for.

    Returns:
        The matching persona.

    Raises:
        PersonaNotFoundError: If no persona has that id. An unknown persona is
            refused rather than defaulted, because silently running a caller
            through the wrong script is worse than not starting.
    """
    personas = load_personas()
    wanted = (persona_id or "").strip()
    try:
        return personas[wanted]
    except KeyError:
        raise PersonaNotFoundError(
            f"Persona {wanted!r} is not defined. Available: {', '.join(sorted(personas))}."
        ) from None
