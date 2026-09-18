"""Voice resolution never guesses."""

from __future__ import annotations

import json

import pytest

from pyvex_voice.voices import (
    VoiceNotFoundError,
    load_voice_profiles,
    resolve_voice,
)


def test_built_in_profiles_are_complete() -> None:
    profiles = load_voice_profiles({})
    assert profiles
    for profile_id, profile in profiles.items():
        assert profile.id == profile_id
        assert profile.provider_voice_id
        assert profile.display_name


def test_resolves_a_named_profile() -> None:
    profiles = load_voice_profiles({})
    resolved = resolve_voice(
        "calm_welcoming", default_profile_id="warm_professional", profiles=profiles
    )
    assert resolved.id == "calm_welcoming"


def test_falls_back_to_the_configured_default_only_when_none_was_asked_for() -> None:
    profiles = load_voice_profiles({})
    resolved = resolve_voice(
        None, default_profile_id="steady_reassuring", profiles=profiles
    )
    assert resolved.id == "steady_reassuring"


def test_an_unknown_profile_raises_rather_than_substituting_a_voice() -> None:
    # Substituting would give the caller a voice nobody chose, which is nearly
    # impossible to notice from inside the conversation.
    profiles = load_voice_profiles({})
    with pytest.raises(VoiceNotFoundError, match="nonexistent"):
        resolve_voice(
            "nonexistent", default_profile_id="warm_professional", profiles=profiles
        )


def test_a_missing_default_raises_too() -> None:
    profiles = load_voice_profiles({})
    with pytest.raises(VoiceNotFoundError):
        resolve_voice(None, default_profile_id="not_configured", profiles=profiles)


def test_deployment_override_replaces_the_built_in_set() -> None:
    override = json.dumps(
        [{"id": "house", "provider_voice_id": "abc123", "display_name": "House"}]
    )
    profiles = load_voice_profiles({"PYVEX_VOICE_PROFILES": override})
    assert set(profiles) == {"house"}
    assert profiles["house"].provider_voice_id == "abc123"


@pytest.mark.parametrize(
    "bad",
    [
        "not json",
        "{}",
        "[]",
        '["a string"]',
        '[{"id": "x"}]',
        '[{"provider_voice_id": "y"}]',
        '[{"id": "", "provider_voice_id": "y"}]',
    ],
)
def test_a_malformed_override_raises_rather_than_falling_back(bad: str) -> None:
    # Falling back would silently run every session on a voice nobody chose.
    with pytest.raises(ValueError):
        load_voice_profiles({"PYVEX_VOICE_PROFILES": bad})
