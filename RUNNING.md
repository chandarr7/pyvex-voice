# Running pyvex-voice locally

Three processes and one managed backend:

| Piece | What it does |
| --- | --- |
| Vite + Express (`npm run dev`) | Serves the app and the API; verifies Supabase tokens |
| Voice worker (`voice/`) | WebRTC signalling and the Pipecat pipeline |
| Supabase | Auth and Postgres |

The browser talks only to the Express API. The API talks to the worker over a
private boundary, so no provider or worker credential ever reaches the browser.

## 1. Supabase

Create a project, then apply `supabase/migrations/20260917120000_init.sql`
(dashboard SQL editor, or `supabase db push`). Enable the Google provider under
Authentication → Providers and add `http://localhost:3000` as a redirect URL.

From Settings → API take the project URL and the anon key.

## 2. Environment

Copy `env.example` to `.env` and fill it in. Generate the shared worker token:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put the same value in `VOICE_WORKER_TOKEN` (read by the API) and
`PYVEX_WORKER_TOKEN` (read by the worker).

## 3. Install

```bash
npm ci
cd voice && uv venv .venv && uv pip install --python .venv/bin/python -e ".[dev]"
```

## 4. Check the providers before trusting anything

```bash
cd voice && .venv/bin/python -m pyvex_voice.preflight
```

Each provider reports PASS, FAIL or NOT_CONFIGURED. It authenticates and
confirms the configured model and voices exist; it synthesises no speech, so it
is cheap to re-run. Nothing proceeds usefully until this passes.

## 5. Run

```bash
cd voice && .venv/bin/python -m pyvex_voice.server   # worker on :7860
npm run dev                                          # app and API on :3000
```

Confirm the worker is reachable and ready:

```bash
curl -s localhost:7860/health
curl -s localhost:7860/ready
```

`/health` means the process is alive. `/ready` means a conversation could
actually succeed — a worker missing its credentials stays alive and reports
itself unready.

## 6. Hold a conversation

Open `http://localhost:3000`, sign in, open Live Studio, pick a scenario and
press Start. The browser asks for the microphone, negotiates a real peer
connection through the API, and the pipeline takes over. Speak over the agent
to interrupt it.

"Connected" appears only once `RTCPeerConnection` reports `connected`. If
negotiation fails you get the reason, not a connected badge.

## Tests

```bash
npm test                                          # app, 153 tests
cd voice && .venv/bin/python -m pytest             # worker, no credentials
cd voice && .venv/bin/python -m pytest -m integration   # real WebRTC, no credentials
```

`integration` opens real sockets but spends nothing. `provider_live` is
reserved for tests that call a paid provider and is never part of a default run.

## Known limitations

- A TURN server is needed for callers behind restrictive NATs; STUN alone
  handles the common cases only.
- Voice sessions live in the API process, so a restart ends live calls.
  Conversation history belongs in Supabase and survives independently.
- Conversation turns are not yet persisted to Supabase.
- No live end-to-end conversation has been verified in this repository yet; the
  transport is proven by an integration test against a real peer, and the
  pipeline is proven by unit tests, but the two have not been exercised
  together with real provider credentials.
