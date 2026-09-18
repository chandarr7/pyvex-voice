"""Worker entrypoint: one process serves one caller's conversation.

Run it directly for development::

    python -m pyvex_voice.bot --transport webrtc --port 7860

The persona and voice for a session come from the runner's request body, so a
deployment chooses them per call rather than per build.
"""

from __future__ import annotations

import sys
from typing import Any

from dotenv import load_dotenv
from loguru import logger
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import LLMRunFrame
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.workers.runner import WorkerRunner

from .config import ConfigError, load_config
from .personas import PersonaNotFoundError, get_persona
from .pipeline import build_session
from .voices import VoiceNotFoundError, load_voice_profiles, resolve_voice

load_dotenv(override=True)

__all__ = ["bot", "run_bot"]

# Lambdas so the parameters are built only for the transport actually selected.
transport_params = {
    "webrtc": lambda: TransportParams(
        audio_in_enabled=True,
        audio_out_enabled=True,
        vad_analyzer=SileroVADAnalyzer(),
    ),
}


def _requested(body: Any, key: str) -> str | None:
    """Read one string field from the runner's request body."""
    if isinstance(body, dict):
        value = body.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


async def run_bot(transport: BaseTransport, runner_args: RunnerArguments) -> None:
    """Run one conversation to completion.

    Args:
        transport: The connected transport for this caller.
        runner_args: Runner arguments, whose ``body`` may name ``persona`` and
            ``voice_profile``.

    Raises:
        ConfigError: If a required credential is absent.
        PersonaNotFoundError: If the requested persona does not exist.
        VoiceNotFoundError: If the requested voice profile is not configured.
    """
    # Resolved before anything connects: a session that cannot be configured
    # should fail here rather than after the caller is already on the line.
    config = load_config()
    persona = get_persona(_requested(runner_args.body, "persona") or "customer_support")
    voice = resolve_voice(
        _requested(runner_args.body, "voice_profile"),
        default_profile_id=config.default_voice_profile,
        profiles=load_voice_profiles(),
    )

    logger.info(
        "Starting session | persona={} voice={} ({})",
        persona.id,
        voice.id,
        voice.display_name,
    )

    session = build_session(
        transport=transport,
        config=config,
        persona=persona,
        voice=voice,
        idle_timeout_secs=runner_args.pipeline_idle_timeout_secs,
    )

    runner = WorkerRunner(handle_sigint=runner_args.handle_sigint)
    await runner.add_workers(session.worker)

    @transport.event_handler("on_client_connected")
    async def on_client_connected(_transport, _client):
        logger.info("Caller connected")
        # The greeting is the persona's own opening line, spoken through the
        # model so it arrives on the same path as every later turn.
        session.context.add_message(
            {
                "role": "system",
                "content": f"Greet the caller with exactly: {persona.greeting}",
            }
        )
        await session.worker.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(_transport, _client):
        logger.info("Caller disconnected")
        await runner.cancel()

    await runner.run()


async def bot(runner_args: RunnerArguments) -> None:
    """Entry point the Pipecat runner calls for each session."""
    try:
        transport = await create_transport(runner_args, transport_params)
        await run_bot(transport, runner_args)
    except (ConfigError, PersonaNotFoundError, VoiceNotFoundError) as exc:
        # Refuse clearly. A session that cannot be configured has nothing
        # truthful to say, so it does not start.
        logger.error("Refusing to start session: {}", exc)
        raise


if __name__ == "__main__":
    try:
        load_config()
    except ConfigError as exc:
        logger.error(str(exc))
        sys.exit(1)

    from pipecat.runner.run import main

    main()
