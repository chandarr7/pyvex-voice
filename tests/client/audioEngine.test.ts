/**
 * Playback resource release, and the guarantee that a speaking state is only
 * claimed when synthesis actually started.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { playAudioBlob, speak, stopSpeaking, SpeechError } from '../../src/utils/audioEngine';

class FakeUtterance {
  text: string;
  pitch = 1;
  rate = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

function installSynthesis(behaviour: 'ok' | 'error' | 'cancel') {
  const cancel = vi.fn();
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  vi.stubGlobal('speechSynthesis', {
    cancel,
    resume: vi.fn(),
    pause: vi.fn(),
    speaking: false,
    paused: false,
    speak: (u: FakeUtterance) => {
      setTimeout(() => {
        if (behaviour === 'ok') {
          u.onstart?.();
          u.onend?.();
        } else if (behaviour === 'cancel') {
          u.onerror?.({ error: 'canceled' });
        } else {
          u.onerror?.({ error: 'synthesis-failed' });
        }
      }, 0);
    },
  });
  return { cancel };
}

afterEach(() => {
  stopSpeaking();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('speak', () => {
  it('signals start only when synthesis actually starts', async () => {
    installSynthesis('ok');
    const onStart = vi.fn();
    await speak('hello', { onStart });
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('rejects when the browser has no speech synthesis', async () => {
    vi.stubGlobal('speechSynthesis', undefined);
    await expect(speak('hello')).rejects.toBeInstanceOf(SpeechError);
  });

  it('rejects rather than resolving silently when synthesis fails', async () => {
    installSynthesis('error');
    await expect(speak('hello')).rejects.toMatchObject({ reason: 'synthesis-failed' });
  });

  it('treats a deliberate cancel as a clean stop', async () => {
    installSynthesis('cancel');
    await expect(speak('hello')).resolves.toBeUndefined();
  });

  it('clears the keep-alive timer so no interval outlives playback', async () => {
    installSynthesis('ok');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    await speak('hello');
    stopSpeaking();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});

describe('playAudioBlob', () => {
  it('revokes the object URL and detaches the element on success', async () => {
    const revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: revoke });

    const element = {
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      load: vi.fn(),
      removeAttribute: vi.fn(),
      onplaying: null as (() => void) | null,
      onended: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };
    vi.stubGlobal('Audio', function Audio() {
      setTimeout(() => element.onended?.(), 0);
      return element;
    });

    await playAudioBlob(new Blob(['x']));

    expect(revoke).toHaveBeenCalledWith('blob:test');
    expect(element.removeAttribute).toHaveBeenCalledWith('src');
    expect(element.load).toHaveBeenCalled();
  });

  it('revokes the object URL when playback is rejected', async () => {
    const revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: revoke });

    const element = {
      play: vi.fn().mockRejectedValue(Object.assign(new Error('blocked'), { name: 'NotAllowedError' })),
      pause: vi.fn(),
      load: vi.fn(),
      removeAttribute: vi.fn(),
      onplaying: null,
      onended: null,
      onerror: null,
    };
    vi.stubGlobal('Audio', function Audio() {
      return element;
    });

    await expect(playAudioBlob(new Blob(['x']))).rejects.toMatchObject({ reason: 'autoplay-blocked' });
    expect(revoke).toHaveBeenCalledWith('blob:test');
  });
});
