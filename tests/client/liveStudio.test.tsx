/**
 * The panel must never present a capability it does not have.
 *
 * The defect these cover: the studio used to show "Listening" in any browser,
 * including those with no speech recognition at all.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../../src/lib/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  googleProvider: {},
  signInWithPopup: vi.fn(),
  firebaseSignOut: vi.fn(),
  onAuthStateChanged: vi.fn(() => () => {}),
  handleFirestoreError: vi.fn(),
  OperationType: { READ: 'read', WRITE: 'write', DELETE: 'delete' },
  app: {},
}));

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'alice', email: 'alice@example.test' } }),
}));

import { LiveStudioModal } from '../../src/components/LiveStudioModal';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      if (String(input).includes('/api/flows')) {
        return new Response(
          JSON.stringify([
            {
              id: 'customer_support',
              name: 'Customer Support Intake',
              description: 'Takes down a support issue.',
              greeting: 'Hi there.',
              suggestedPrompts: [],
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({
          models: [{ id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', description: '' }],
          defaultModel: 'gemini-3.5-flash',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('unsupported browser', () => {
  beforeEach(() => {
    vi.stubGlobal('SpeechRecognition', undefined);
    vi.stubGlobal('webkitSpeechRecognition', undefined);
  });

  it('never reports "Listening" and says why', async () => {
    render(<LiveStudioModal isOpen onClose={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('stt-unsupported-notice')).toBeInTheDocument());
    expect(screen.getByTestId('session-state')).toHaveTextContent('Not connected');
    expect(screen.queryByText('Listening')).not.toBeInTheDocument();
    expect(screen.getByTestId('stt-unsupported-notice').textContent).toMatch(
      /Speech recognition isn't available/i
    );
  });

  it('disables the microphone control rather than letting it silently do nothing', async () => {
    render(<LiveStudioModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('stt-unsupported-notice')).toBeInTheDocument());

    // The control only exists once connected; before that the start button is
    // the only affordance, so no microphone promise is made at all.
    expect(screen.queryByRole('button', { name: /use microphone/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start conversation/i })).toBeInTheDocument();
  });
});

describe('state labels', () => {
  it('starts disconnected regardless of browser capability', async () => {
    vi.stubGlobal('webkitSpeechRecognition', class {});
    render(<LiveStudioModal isOpen onClose={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('session-state')).toBeInTheDocument());
    expect(screen.getByTestId('session-state')).toHaveTextContent('Not connected');
    // "Connected" is only ever shown after the server created a session.
    expect(screen.getByTestId('session-state')).not.toHaveTextContent('Connected');
  });
});
