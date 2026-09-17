/**
 * Process entrypoint: builds the API, attaches the frontend, and serves.
 *
 * Vite runs as middleware in development; in production the prebuilt client is
 * served from `dist/`.
 */
import path from 'node:path';

import express from 'express';

import { createApp } from './server/app.js';
import { createFirebaseVerifier } from './server/auth.js';
import { SessionStore } from './server/sessions.js';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';

async function startServer() {
  const verifier = await createFirebaseVerifier();
  if (!verifier) {
    // Fail closed: authenticated routes will reject with AUTH_NOT_CONFIGURED
    // rather than serving anyone. Said once, at boot, so it is not a surprise.
    console.warn(
      JSON.stringify({
        event: 'auth.not_configured',
        message:
          'No Firebase credentials found. Authenticated API routes will reject all requests. Set FIREBASE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS.',
      })
    );
  }

  const sessions = new SessionStore();
  sessions.startSweeper();

  const app = createApp({ verifier, sessions });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(
      JSON.stringify({ event: 'server.listening', port: PORT, host: HOST, env: process.env.NODE_ENV ?? 'development' })
    );
  });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      console.log(JSON.stringify({ event: 'server.shutdown', signal }));
      sessions.stopSweeper();
      sessions.clear();
      server.close(() => process.exit(0));
    });
  }
}

startServer().catch((err) => {
  console.error(JSON.stringify({ event: 'server.start_failed' }));
  console.error(err);
  process.exit(1);
});
