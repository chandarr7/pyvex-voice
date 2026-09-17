/**
 * Microphone lifecycle: one AudioContext per capture, always closed, and the
 * stream released even when setup fails partway.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useMicrophone } from '../../src/utils/microphone';

interface Harness {
  contexts: Array<{ close: ReturnType<typeof vi.fn>; state: string }>;
  stoppedTracks: number;
}

function installAudioStack(options: { contextThrows?: boolean; getUserMediaError?: string } = {}): Harness {
  const harness: Harness = { contexts: [], stoppedTracks: 0 };

  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn(async () => {
        if (options.getUserMediaError) {
          throw Object.assign(new Error('denied'), { name: options.getUserMediaError });
        }
        return {
          getTracks: () => [{ stop: () => { harness.stoppedTracks += 1; }, label: 'Test Mic' }],
          getAudioTracks: () => [{ label: 'Test Mic' }],
        };
      }),
    },
  });

  vi.stubGlobal(
    'AudioContext',
    function AudioContext(this: Record<string, unknown>) {
      if (options.contextThrows) throw new Error('no audio context');
      const context = {
        state: 'running',
        close: vi.fn(async () => { context.state = 'closed'; }),
        resume: vi.fn(async () => {}),
        createMediaStreamSource: () => ({ connect: vi.fn() }),
        createAnalyser: () => ({
          fftSize: 256,
          smoothingTimeConstant: 0.4,
          frequencyBinCount: 128,
          getByteFrequencyData: (arr: Uint8Array) => arr.fill(0),
          connect: vi.fn(),
        }),
      };
      harness.contexts.push(context as never);
      return context as never;
    }
  );

  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  return harness;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useMicrophone', () => {
  it('closes the AudioContext on stop instead of leaking one per toggle', async () => {
    const harness = installAudioStack();
    const { result } = renderHook(() => useMicrophone());

    for (let i = 0; i < 4; i += 1) {
      await act(async () => { await result.current.start(); });
      act(() => { result.current.stop(); });
    }

    expect(harness.contexts).toHaveLength(4);
    for (const context of harness.contexts) {
      expect(context.close).toHaveBeenCalled();
    }
  });

  it('stops every capture track on stop', async () => {
    const harness = installAudioStack();
    const { result } = renderHook(() => useMicrophone());

    await act(async () => { await result.current.start(); });
    act(() => { result.current.stop(); });

    expect(harness.stoppedTracks).toBe(1);
    expect(result.current.active).toBe(false);
    expect(result.current.level).toBe(0);
  });

  it('releases the stream when the audio context cannot be created', async () => {
    const harness = installAudioStack({ contextThrows: true });
    const { result } = renderHook(() => useMicrophone());

    let granted = true;
    await act(async () => { granted = await result.current.start(); });

    expect(granted).toBe(false);
    // The microphone is not left open behind a failed setup.
    expect(harness.stoppedTracks).toBe(1);
    expect(result.current.error).toBe('unavailable');
  });

  it('reports a denied permission rather than appearing active', async () => {
    installAudioStack({ getUserMediaError: 'NotAllowedError' });
    const { result } = renderHook(() => useMicrophone());

    let granted = true;
    await act(async () => { granted = await result.current.start(); });

    expect(granted).toBe(false);
    expect(result.current.error).toBe('denied');
    expect(result.current.active).toBe(false);
  });

  it('releases resources when the component unmounts', async () => {
    const harness = installAudioStack();
    const { result, unmount } = renderHook(() => useMicrophone());
    await act(async () => { await result.current.start(); });

    unmount();

    expect(harness.contexts[0].close).toHaveBeenCalled();
    expect(harness.stoppedTracks).toBe(1);
  });
});
