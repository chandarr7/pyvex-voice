"""Voice profiles: the named voices a session may speak with.

A profile separates the voice a caller hears from the persona the model plays,
so the same persona can run in any voice and a voice change never touches
conversation logic.

Provider voice ids are only ever configured, never derived or guessed. Asking
for a profile that does not exist raises rather than quietly substituting
another voice, because a caller hearing an unexpected voice is a defect that is
very hard to notice from the inside.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass

__all__ = ["VoiceProfile", "VoiceNotFoundError", "load_voice_profiles", "resolve_voice"]


class VoiceNotFoundError(KeyError):
    """Raised when a session asks for a profile that is not configured."""


@dataclass(frozen=True)
class VoiceProfile:
    """A named voice, bound to one provider voice.

    Attributes:
        id: Stable identifier a session refers to.
        provider_voice_id: The provider's own id for the voice.
        display_name: Human-readable name for a picker.
        description: How the voice sounds, for someone choosing between them.
    """

    id: str
    provider_voice_id: str
    display_name: str
    description: str


# ElevenLabs' own premade voices, whose ids are public and stable. A deployment
# with its own cloned voices overrides this through PYVEX_VOICE_PROFILES.
_BUILT_IN_PROFILES: tuple[VoiceProfile, ...] = (
    VoiceProfile(
        id="warm_professional",
        provider_voice_id="21m00Tcm4TlvDq8ikWAM",
        display_name="Rachel",
        description="Warm and professional. Suits intake and support.",
    ),
    VoiceProfile(
        id="confident_energetic",
        provider_voice_id="ErXwobaYiN019PkySvjV",
        display_name="Antoni",
        description="Confident and energetic. Suits outbound conversation.",
    ),
    VoiceProfile(
        id="calm_welcoming",
        provider_voice_id="EXAVITQu4vr4xnSDxMaL",
        display_name="Bella",
        description="Calm and welcoming. Suits reception and first contact.",
    ),
    VoiceProfile(
        id="steady_reassuring",
        provider_voice_id="pNInz6obpgDQGcFmaJgB",
        display_name="Adam",
        description="Steady and reassuring. Suits sensitive conversations.",
    ),
)


def load_voice_profiles(env: dict[str, str] | None = None) -> dict[str, VoiceProfile]:
    """Return the profiles this deployment offers, keyed by id.

    ``PYVEX_VOICE_PROFILES`` may hold a JSON array replacing the built-in set,
    each entry carrying ``id``, ``provider_voice_id``, ``display_name`` and
    ``description``.

    Args:
        env: Mapping to read instead of ``os.environ``. Used by tests.

    Returns:
        Profiles by id.

    Raises:
        ValueError: If the override is present but not a usable profile list.
            A malformed override is an error rather than a silent fallback:
            falling back would run every session on a voice nobody chose.
    """
    source = os.environ if env is None else env
    raw = source.get("PYVEX_VOICE_PROFILES", "").strip()
    if not raw:
        return {profile.id: profile for profile in _BUILT_IN_PROFILES}

    try:
        entries = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"PYVEX_VOICE_PROFILES is not valid JSON: {exc}") from exc

    if not isinstance(entries, list) or not entries:
        raise ValueError("PYVEX_VOICE_PROFILES must be a non-empty JSON array.")

    profiles: dict[str, VoiceProfile] = {}
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            raise ValueError(f"PYVEX_VOICE_PROFILES[{index}] is not an object.")
        try:
            profile = VoiceProfile(
                id=str(entry["id"]),
                provider_voice_id=str(entry["provider_voice_id"]),
                display_name=str(entry.get("display_name", entry["id"])),
                description=str(entry.get("description", "")),
            )
        except KeyError as exc:
            raise ValueError(
                f"PYVEX_VOICE_PROFILES[{index}] is missing {exc.args[0]!r}."
            ) from exc
        if not profile.id or not profile.provider_voice_id:
            raise ValueError(
                f"PYVEX_VOICE_PROFILES[{index}] needs a non-empty id and provider_voice_id."
            )
        profiles[profile.id] = profile

    return profiles


def resolve_voice(
    profile_id: str | None,
    *,
    default_profile_id: str,
    profiles: dict[str, VoiceProfile],
) -> VoiceProfile:
    """Resolve the voice a session will speak with.

    Args:
        profile_id: The profile the session asked for, or None for the default.
        default_profile_id: Profile to use when the session named none.
        profiles: The configured profiles, from :func:`load_voice_profiles`.

    Returns:
        The resolved profile.

    Raises:
        VoiceNotFoundError: If the requested profile, or the configured
            default, is not among ``profiles``.
    """
    wanted = (profile_id or default_profile_id).strip()
    try:
        return profiles[wanted]
    except KeyError:
        available = ", ".join(sorted(profiles)) or "none"
        raise VoiceNotFoundError(
            f"Voice profile {wanted!r} is not configured. Available: {available}."
        ) from None
