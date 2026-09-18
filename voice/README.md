# Voice worker

The real-time voice pipeline. One process serves one caller's conversation:

```
transport.input() → STT → user aggregator → LLM → TTS
    → transport.output() → assistant aggregator
```

| Stage | Implementation |
| --- | --- |
| Transport | SmallWebRTC (browser, no third-party account) |
| Turn detection | Silero VAD, local |
| Speech to text | ElevenLabs realtime |
| Language model | Google Gemini |
| Text to speech | ElevenLabs streaming |

Speech in and speech out share one provider account, so a deployment needs two
credentials rather than three.

## Pinned Pipecat

`pyproject.toml` pins `pipecat-ai==1.10.0` exactly. The service constructors
change across minor versions — in this release each service takes its
configuration through `settings=` and the equivalent constructor keywords are
deprecated — so the pin is load-bearing. Re-verify the signatures in
`pipeline.py` against any version you move to.

## Running it

```bash
uv venv .venv && uv pip install --python .venv/bin/python -e ".[dev]"
.venv/bin/python -m pytest                       # no credentials needed
.venv/bin/python -m pyvex_voice.bot --transport webrtc --port 7860
```

Required environment (see the repository's `env.example`):

```
ELEVENLABS_API_KEY    speech recognition and synthesis
GEMINI_API_KEY        the language model
```

A missing credential is a refusal to start, not a degraded mode: a worker that
cannot reach its providers has nothing honest to say to a caller.

## Per-session isolation

Every service is constructed per conversation. A shared synthesis service would
carry one voice setting for the whole process, so two callers on one worker
could hear each other's voice, and a mid-call change in one session would land
in every other. Building fresh services per session makes that isolation
structural rather than an invariant a later refactor can quietly break.
`tests/test_pipeline.py` holds the property directly.

## Personas

Persona prompts live in `../shared/personas.json` and are read by both this
worker and the Node API. Two hand-maintained copies would drift, and drift here
means one runtime claiming a capability the other refuses.

## What is not covered by tests

The suite builds and inspects pipelines without a provider account, because
Pipecat's constructors open no connection. It therefore proves assembly,
configuration and isolation — not that a live conversation works. Running one
end to end needs real credentials and a browser, and is a required step before
production use.
