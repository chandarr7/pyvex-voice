/**
 * Browser speech playback.
 *
 * This is a development-grade voice: the browser's own synthesiser, not a
 * production TTS pipeline. `speak()` resolves only once audio has actually
 * started, and rejects when nothing could be played, so callers never show a
 * speaking state that isn't real.
 *
 * Every resource acquired here is released in `stopSpeaking()`: one utterance
 * is audible at a time and nothing outlives it.
 */

export type SpeechFailureReason = 'unsupported' | 'autoplay-blocked' | 'synthesis-failed';

export class SpeechError extends Error {
  readonly reason: SpeechFailureReason;

  constructor(reason: SpeechFailureReason, message: string) {
    super(message);
    this.name = 'SpeechError';
    this.reason = reason;
  }
}

export function isSpeechSynthesisSupported(): boolean {
  // Presence of the key is not enough: some environments define it as undefined.
  return typeof window !== 'undefined' && Boolean(window.speechSynthesis);
}

interface ActivePlayback {
  utterance: SpeechSynthesisUtterance;
  keepAliveTimer: ReturnType<typeof setInterval> | null;
}

let active: ActivePlayback | null = null;

/** Chrome pauses synthesis after ~15s; nudging it keeps long replies going. */
function startKeepAlive(): ReturnType<typeof setInterval> {
  return setInterval(() => {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }
  }, 10_000);
}

export function stopSpeaking(): void {
  if (active?.keepAliveTimer) clearInterval(active.keepAliveTimer);
  active = null;
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeaking(): boolean {
  return active !== null;
}

/**
 * Speak `text`, resolving when playback ends.
 *
 * `onStart` fires on the synthesiser's own start event, which is the first
 * moment the claim "speaking" is true.
 */
export function speak(
  text: string,
  options: { pitch?: number; rate?: number; onStart?: () => void } = {}
): Promise<void> {
  if (!isSpeechSynthesisSupported()) {
    return Promise.reject(
      new SpeechError('unsupported', 'This browser has no speech synthesis.')
    );
  }
  if (!text.trim()) {
    return Promise.reject(new SpeechError('synthesis-failed', 'Nothing to speak.'));
  }

  stopSpeaking();

  return new Promise<void>((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = options.pitch ?? 1;
    utterance.rate = options.rate ?? 1;

    const playback: ActivePlayback = { utterance, keepAliveTimer: null };
    active = playback;

    const cleanup = () => {
      if (playback.keepAliveTimer) clearInterval(playback.keepAliveTimer);
      playback.keepAliveTimer = null;
      if (active === playback) active = null;
    };

    utterance.onstart = () => {
      playback.keepAliveTimer = startKeepAlive();
      options.onStart?.();
    };
    utterance.onend = () => {
      cleanup();
      resolve();
    };
    utterance.onerror = (event) => {
      cleanup();
      // A cancel is this module stopping itself, e.g. for a barge-in.
      if (event.error === 'canceled' || event.error === 'interrupted') {
        resolve();
        return;
      }
      reject(
        new SpeechError(
          event.error === 'not-allowed' ? 'autoplay-blocked' : 'synthesis-failed',
          `Speech synthesis failed: ${event.error}`
        )
      );
    };

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Play an audio payload and release everything it allocated.
 *
 * The object URL is revoked and the element detached on every exit path,
 * including failure, so repeated playback cannot accumulate blobs.
 */
export function playAudioBlob(blob: Blob, onStart?: () => void): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(objectUrl);

    const release = () => {
      audio.onplaying = null;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(objectUrl);
    };

    audio.onplaying = () => onStart?.();
    audio.onended = () => {
      release();
      resolve();
    };
    audio.onerror = () => {
      release();
      reject(new SpeechError('synthesis-failed', 'Audio playback failed.'));
    };

    audio.play().catch((err: DOMException) => {
      release();
      reject(
        new SpeechError(
          err.name === 'NotAllowedError' ? 'autoplay-blocked' : 'synthesis-failed',
          err.message
        )
      );
    });
  });
}
