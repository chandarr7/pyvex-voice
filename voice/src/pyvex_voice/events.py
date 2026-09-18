"""Structured session events.

Every event is something that happened, timestamped when it happened. Nothing
here is derived from a target or a placeholder: a metric with no measurement
behind it is absent rather than estimated.

Payloads carry identifiers and durations only. Transcripts, audio and
credentials never reach a log line.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any

from loguru import logger

__all__ = ["SessionEvent", "SessionEventLog"]

# The vocabulary the browser and the worker agree on. Anything outside it is a
# bug rather than a new event, so the UI never has to guess at a name.
KNOWN_EVENTS = frozenset(
    {
        "session.created",
        "transport.connecting",
        "transport.connected",
        "transport.disconnected",
        "transport.failed",
        "user.speech.started",
        "user.speech.stopped",
        "stt.final",
        "llm.started",
        "llm.completed",
        "tts.started",
        "tts.first_audio",
        "tts.completed",
        "interruption.started",
        "session.completed",
        "session.failed",
    }
)


@dataclass(frozen=True)
class SessionEvent:
    """One thing that happened during a conversation.

    Attributes:
        name: An entry from :data:`KNOWN_EVENTS`.
        session_id: The conversation this belongs to.
        at_ms: Wall-clock time in milliseconds.
        data: Identifiers and durations. Never transcripts or credentials.
    """

    name: str
    session_id: str
    at_ms: int
    data: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "event": self.name,
            "sessionId": self.session_id,
            "atMs": self.at_ms,
            **self.data,
        }


class SessionEventLog:
    """Events for one conversation, in order.

    Bounded so a long call cannot grow without limit; the oldest entries are
    dropped, because recent events are what a reader is diagnosing from.
    """

    def __init__(self, session_id: str, *, limit: int = 500) -> None:
        self._session_id = session_id
        self._limit = limit
        self._events: list[SessionEvent] = []

    def emit(self, name: str, **data: Any) -> SessionEvent:
        """Record an event and log it.

        Args:
            name: An entry from :data:`KNOWN_EVENTS`.
            **data: Identifiers and durations to attach.

        Returns:
            The recorded event.
        """
        if name not in KNOWN_EVENTS:
            # Loud, because a typo would otherwise become a metric that never
            # fires and a UI state that never arrives.
            raise ValueError(f"Unknown session event {name!r}")

        event = SessionEvent(
            name=name,
            session_id=self._session_id,
            at_ms=int(time.time() * 1000),
            data=data,
        )
        self._events.append(event)
        if len(self._events) > self._limit:
            del self._events[: len(self._events) - self._limit]

        logger.info("session_event {}", json.dumps(event.as_dict()))
        return event

    def since(self, after_ms: int = 0) -> list[dict[str, Any]]:
        """Events recorded after a point in time, oldest first."""
        return [e.as_dict() for e in self._events if e.at_ms > after_ms]

    @property
    def all(self) -> list[dict[str, Any]]:
        return [e.as_dict() for e in self._events]
