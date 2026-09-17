/**
 * Turn commitment: exactly once per final transcript, never on silence, and
 * never invented.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { isSpeechRecognitionSupported, useSpeechRecognition } from '../../src/utils/speechRecognition';

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = '';
  started = 0;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onresult: ((e: unknown) => void) | null = null;

  constructor() {
    FakeRecognition.instances.push(this);
  }
  start() {
    this.started += 1;
    this.onstart?.();
  }
  stop() {
    this.onend?.();
  }
  abort() {}

  emit(entries: Array<{ transcript: string; isFinal: boolean }>) {
    const results = entries.map((e) => ({ 0: { transcript: e.transcript }, isFinal: e.isFinal, length: 1 }));
    this.onresult?.({ resultIndex: 0, results: Object.assign(results, { length: results.length }) });
  }
}

function install() {
  FakeRecognition.instances = [];
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
  vi.stubGlobal('SpeechRecognition', undefined);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('capability detection', () => {
  it('reports unsupported when no constructor exists', () => {
    vi.stubGlobal('webkitSpeechRecognition', undefined);
    vi.stubGlobal('SpeechRecognition', undefined);
    expect(isSpeechRecognitionSupported()).toBe(false);
  });

  it('reports supported when a constructor exists', () => {
    install();
    expect(isSpeechRecognitionSupported()).toBe(true);
  });
});

describe('useSpeechRecognition', () => {
  it('commits a final transcript exactly once', () => {
    install();
    const onFinalTranscript = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ onFinalTranscript }));

    act(() => result.current.start());
    act(() => {
      FakeRecognition.instances[0].emit([{ transcript: 'book a viewing', isFinal: true }]);
    });

    expect(onFinalTranscript).toHaveBeenCalledTimes(1);
    expect(onFinalTranscript).toHaveBeenCalledWith('book a viewing');
  });

  it('never commits an interim result', () => {
    install();
    const onFinalTranscript = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ onFinalTranscript }));

    act(() => result.current.start());
    act(() => {
      FakeRecognition.instances[0].emit([{ transcript: 'partial pho', isFinal: false }]);
    });

    expect(onFinalTranscript).not.toHaveBeenCalled();
    expect(result.current.interimTranscript).toBe('partial pho');
  });

  it('commits nothing when the recogniser produced only whitespace', () => {
    install();
    const onFinalTranscript = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ onFinalTranscript }));

    act(() => result.current.start());
    act(() => {
      FakeRecognition.instances[0].emit([{ transcript: '   ', isFinal: true }]);
    });

    // Silence produces no turn. Nothing is substituted for what was not said.
    expect(onFinalTranscript).not.toHaveBeenCalled();
  });

  it('restarts after the recogniser ends while listening is still wanted', () => {
    install();
    const { result } = renderHook(() => useSpeechRecognition({ onFinalTranscript: vi.fn() }));

    act(() => result.current.start());
    const instance = FakeRecognition.instances[0];
    expect(instance.started).toBe(1);

    // Chromium ends recognition after silence; the ref-held intent survives it,
    // where a captured `listening` value would have been stale.
    act(() => instance.onend?.());
    expect(instance.started).toBe(2);
  });

  it('does not restart after an explicit stop', () => {
    install();
    const { result } = renderHook(() => useSpeechRecognition({ onFinalTranscript: vi.fn() }));

    act(() => result.current.start());
    const instance = FakeRecognition.instances[0];
    act(() => result.current.stop());
    act(() => instance.onend?.());

    expect(instance.started).toBe(1);
    expect(result.current.listening).toBe(false);
  });

  it('ignores routine no-speech errors but reports real ones', () => {
    install();
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({ onFinalTranscript: vi.fn(), onError })
    );

    act(() => result.current.start());
    const instance = FakeRecognition.instances[0];
    act(() => instance.onerror?.({ error: 'no-speech' }));
    expect(onError).not.toHaveBeenCalled();

    act(() => instance.onerror?.({ error: 'not-allowed' }));
    expect(onError).toHaveBeenCalledWith('not-allowed');
  });
});
