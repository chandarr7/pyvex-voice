/**
 * The panel must never present a connection it does not have.
 *
 * Live Studio now runs over a real peer connection, so "Connected" may only
 * appear once RTCPeerConnection reports it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../src/lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: false,
  toAppUser: vi.fn(),
  handleDatabaseError: vi.fn(),
}));

const mockAuth = vi.hoisted(() => ({
  user: { id: 'alice', email: 'alice@example.test' } as { id: string } | null,
}));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => mockAuth }));

// Hoisted: vi.mock factories run before module-level initialisers.
const apiMock = vi.hoisted(() => ({
  listFlows: vi.fn(),
  voiceReadiness: vi.fn(),
  startVoiceSession: vi.fn(),
  sendVoiceOffer: vi.fn(),
  sendIceCandidates: vi.fn(),
  voiceEvents: vi.fn(),
  stopVoiceSession: vi.fn(),
}));
vi.mock('../../src/lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../src/lib/api')>('../../src/lib/api');
  return { ...actual, api: apiMock };
});

import { LiveStudioModal } from '../../src/components/LiveStudioModal';

const FLOW = {
  id: 'customer_support',
  name: 'Customer Support Intake',
  description: 'Takes down a support issue.',
  greeting: 'Hi there.',
  suggestedPrompts: [],
};

/** A peer connection that never reaches `connected`. */
function installPeerConnection(options: { finalState?: RTCPeerConnectionState } = {}) {
  const instances: any[] = [];
  const stoppedTracks: string[] = [];

  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn(async () => ({
        getAudioTracks: () => [{ id: 'mic', stop: () => stoppedTracks.push('mic') }],
        getTracks: () => [{ id: 'mic', stop: () => stoppedTracks.push('mic') }],
      })),
    },
  });

  vi.stubGlobal(
    'RTCPeerConnection',
    class {
      connectionState: RTCPeerConnectionState = 'new';
      localDescription = { sdp: 'v=0\r\nlocal', type: 'offer' };
      onconnectionstatechange: (() => void) | null = null;
      ontrack: unknown = null;
      onicecandidate: unknown = null;
      constructor() {
        instances.push(this);
      }
      addTrack() {}
      addTransceiver() {}
      async createOffer() {
        return { sdp: 'v=0\r\nlocal', type: 'offer' };
      }
      async setLocalDescription() {}
      async setRemoteDescription() {
        // Drive to the state under test once negotiation completes.
        queueMicrotask(() => {
          this.connectionState = options.finalState ?? 'failed';
          this.onconnectionstatechange?.();
        });
      }
      getSenders() {
        return [];
      }
      close() {
        this.connectionState = 'closed';
      }
    }
  );
  vi.stubGlobal('MediaStream', class {});
  return { instances, stoppedTracks };
}

beforeEach(() => {
  mockAuth.user = { id: 'alice', email: 'alice@example.test' };
  apiMock.listFlows.mockResolvedValue([FLOW]);
  apiMock.voiceReadiness.mockResolvedValue({
    status: 'ready',
    providers: { gemini: 'configured' },
    voiceProfiles: ['warm_professional'],
  });
  apiMock.startVoiceSession.mockResolvedValue({
    session: { id: 'sess-1', personaId: 'customer_support', status: 'created' },
    persona: { id: 'customer_support', name: 'Customer Support Intake', greeting: 'Hi there.' },
  });
  apiMock.sendVoiceOffer.mockResolvedValue({
    answer: { sdp: 'v=0\r\nanswer', type: 'answer', pc_id: 'pc-1' },
    sessionId: 'sess-1',
  });
  apiMock.voiceEvents.mockResolvedValue({ sessionId: 'sess-1', events: [] });
  apiMock.stopVoiceSession.mockResolvedValue({ stopped: true });
  apiMock.sendIceCandidates.mockResolvedValue({ accepted: 0 });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('initial state', () => {
  it('starts disconnected', async () => {
    installPeerConnection();
    render(<LiveStudioModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('session-state')).toHaveTextContent('Not connected'));
  });

  it('will not offer to start when the voice service is unavailable', async () => {
    installPeerConnection();
    apiMock.voiceReadiness.mockResolvedValue({
      status: 'unreachable',
      reason: 'No voice worker is configured.',
    });
    render(<LiveStudioModal isOpen onClose={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('voice-unavailable-notice')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /start conversation/i })).toBeDisabled();
  });

  it('reports unmeasured timings as N/A rather than inventing them', async () => {
    installPeerConnection();
    render(<LiveStudioModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('turn-metrics')).toBeInTheDocument());
    expect(screen.getByTestId('turn-metrics').textContent).toContain('N/A');
  });
});

describe('a connection that never establishes', () => {
  it('never shows Connected, and says what failed', async () => {
    installPeerConnection({ finalState: 'failed' });
    render(<LiveStudioModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /start conversation/i })).toBeEnabled());

    await userEvent.click(screen.getByRole('button', { name: /start conversation/i }));

    await waitFor(() => expect(screen.getByTestId('session-state')).toHaveTextContent('Error'));
    expect(screen.getByTestId('session-state')).not.toHaveTextContent('Connected');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('releases the microphone and tells the server the session is over', async () => {
    const { stoppedTracks } = installPeerConnection({ finalState: 'failed' });
    render(<LiveStudioModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /start conversation/i })).toBeEnabled());

    await userEvent.click(screen.getByRole('button', { name: /start conversation/i }));

    await waitFor(() => expect(stoppedTracks).toContain('mic'));
    await waitFor(() => expect(apiMock.stopVoiceSession).toHaveBeenCalledWith('sess-1'));
  });

  it('does not poll for events after a failed connection', async () => {
    installPeerConnection({ finalState: 'failed' });
    render(<LiveStudioModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /start conversation/i })).toBeEnabled());

    await userEvent.click(screen.getByRole('button', { name: /start conversation/i }));
    await waitFor(() => expect(screen.getByTestId('session-state')).toHaveTextContent('Error'));

    expect(apiMock.voiceEvents).not.toHaveBeenCalled();
  });
});

describe('a connection that establishes', () => {
  it('shows Connected only once the peer connection reports it', async () => {
    installPeerConnection({ finalState: 'connected' });
    render(<LiveStudioModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /start conversation/i })).toBeEnabled());

    await userEvent.click(screen.getByRole('button', { name: /start conversation/i }));

    await waitFor(() => expect(screen.getByTestId('session-state')).toHaveTextContent('Connected'));
    // A real offer was sent and answered, not a fabricated one.
    expect(apiMock.sendVoiceOffer).toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({ type: 'offer' }),
      expect.anything()
    );
  });

  it('attaches an audio element for the worker to play through', async () => {
    installPeerConnection({ finalState: 'connected' });
    render(<LiveStudioModal isOpen onClose={() => {}} />);
    expect(screen.getByTestId('remote-audio')).toBeInTheDocument();
  });
});

describe('session creation failure', () => {
  it('surfaces the error rather than proceeding to negotiate', async () => {
    installPeerConnection({ finalState: 'connected' });
    apiMock.startVoiceSession.mockRejectedValue(new Error('nope'));
    render(<LiveStudioModal isOpen onClose={() => {}} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /start conversation/i })).toBeEnabled());

    await userEvent.click(screen.getByRole('button', { name: /start conversation/i }));

    await waitFor(() => expect(screen.getByTestId('session-state')).toHaveTextContent('Error'));
    expect(apiMock.sendVoiceOffer).not.toHaveBeenCalled();
  });
});
