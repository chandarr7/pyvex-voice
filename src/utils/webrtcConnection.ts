/**
 * The browser half of the WebRTC connection to the voice worker.
 *
 * A real peer connection: the microphone track is sent, the worker's audio
 * track is received and played, and the reported state is the one
 * `RTCPeerConnection` is actually in. "Connected" is never inferred from having
 * sent an offer or received an answer — only from the connection reaching
 * `connected`.
 *
 * Signalling goes through the API rather than straight to the worker, so the
 * browser holds no worker credential and every request carries the user's own
 * Supabase token.
 */
import { api } from '../lib/api';

export type PeerState =
  | 'idle'
  | 'acquiring-microphone'
  | 'negotiating'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';

export interface WebRtcCallbacks {
  onStateChange: (state: PeerState, detail?: string) => void;
  /** The worker's audio, ready to play. */
  onRemoteStream: (stream: MediaStream) => void;
  onError: (message: string) => void;
}

export class MicrophoneDeniedError extends Error {
  constructor() {
    super('Microphone access was denied.');
    this.name = 'MicrophoneDeniedError';
  }
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

export class VoiceConnection {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly abort = new AbortController();
  private closed = false;

  constructor(
    private readonly sessionId: string,
    private readonly callbacks: WebRtcCallbacks
  ) {}

  /**
   * Acquire the microphone, negotiate, and resolve once the peer connection
   * reports `connected`.
   *
   * Rejects if negotiation fails or the connection never establishes, so a
   * caller cannot mistake a half-open attempt for a live call.
   */
  async connect(timeoutMs = 20_000): Promise<void> {
    this.callbacks.onStateChange('acquiring-microphone');

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      const denied = (err as DOMException)?.name === 'NotAllowedError';
      this.callbacks.onStateChange('failed', denied ? 'microphone-denied' : 'microphone-unavailable');
      throw denied ? new MicrophoneDeniedError() : new Error('No microphone is available.');
    }

    const pc = new RTCPeerConnection({ iceServers: DEFAULT_ICE_SERVERS });
    this.pc = pc;

    for (const track of this.localStream.getAudioTracks()) {
      pc.addTrack(track, this.localStream);
    }
    // The worker sends audio back on this transceiver.
    pc.addTransceiver('audio', { direction: 'sendrecv' });

    pc.ontrack = (event) => {
      this.remoteStream = event.streams[0] ?? new MediaStream([event.track]);
      this.callbacks.onRemoteStream(this.remoteStream);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) this.queueCandidate(event.candidate);
    };

    const connected = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('The voice connection timed out.'));
      }, timeoutMs);

      pc.onconnectionstatechange = () => {
        switch (pc.connectionState) {
          case 'connected':
            clearTimeout(timer);
            this.callbacks.onStateChange('connected');
            resolve();
            break;
          case 'failed':
            clearTimeout(timer);
            this.callbacks.onStateChange('failed', 'ice-failed');
            reject(new Error('The voice connection failed to establish.'));
            break;
          case 'disconnected':
            // Recoverable on its own; reported without tearing the call down.
            this.callbacks.onStateChange('disconnected');
            break;
          case 'closed':
            clearTimeout(timer);
            this.callbacks.onStateChange('closed');
            break;
          default:
            break;
        }
      };
    });

    this.callbacks.onStateChange('negotiating');

    const offer = await pc.createOffer({ offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);

    let answer;
    try {
      const result = await api.sendVoiceOffer(
        this.sessionId,
        { sdp: pc.localDescription?.sdp ?? offer.sdp ?? '', type: 'offer' },
        this.abort.signal
      );
      answer = result.answer;
    } catch (err) {
      this.callbacks.onStateChange('failed', 'negotiation-rejected');
      await this.close();
      throw err;
    }

    await pc.setRemoteDescription({ type: 'answer', sdp: answer.sdp });
    await this.flushCandidates();

    try {
      await connected;
    } catch (err) {
      await this.close();
      throw err;
    }
  }

  /**
   * Batch trickled candidates.
   *
   * Candidates arrive in bursts; one request per candidate would be a request
   * storm against a rate-limited endpoint.
   */
  private queueCandidate(candidate: RTCIceCandidate): void {
    this.pendingCandidates.push(candidate.toJSON());
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flushCandidates();
    }, 250);
  }

  private async flushCandidates(): Promise<void> {
    if (this.closed || this.pendingCandidates.length === 0) return;
    const batch = this.pendingCandidates.splice(0, this.pendingCandidates.length);

    try {
      await api.sendIceCandidates(
        this.sessionId,
        batch.map((c) => ({
          candidate: c.candidate ?? '',
          sdpMid: c.sdpMid ?? '0',
          sdpMLineIndex: c.sdpMLineIndex ?? 0,
        }))
      );
    } catch {
      // A dropped candidate batch degrades connectivity rather than breaking
      // it; the connection state is what decides success.
    }
  }

  /** Release every resource this connection acquired. */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.abort.abort();
    this.pendingCandidates = [];

    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    this.remoteStream?.getTracks().forEach((track) => track.stop());
    this.remoteStream = null;

    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      this.pc.getSenders().forEach((sender) => sender.track?.stop());
      this.pc.close();
      this.pc = null;
    }

    this.callbacks.onStateChange('closed');
  }

  get connectionState(): RTCPeerConnectionState | 'closed' {
    return this.pc?.connectionState ?? 'closed';
  }
}
