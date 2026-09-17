/**
 * Microphone capture and input-level metering.
 *
 * One AudioContext is created per capture and closed when capture stops.
 * Browsers cap concurrent contexts at a handful per document, so leaking one
 * per start/stop cycle silently breaks the microphone after a few toggles.
 *
 * The level this reports drives meters and barge-in. It is not voice activity
 * detection: it cannot tell speech from noise.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type MicrophoneError = 'denied' | 'unsupported' | 'unavailable';

export interface MicrophoneController {
  active: boolean;
  /** Smoothed input level, 0..1. Zero whenever capture is stopped. */
  level: number;
  error: MicrophoneError | null;
  start: () => Promise<boolean>;
  stop: () => void;
}

export function isMicrophoneSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

export interface UseMicrophoneOptions {
  /** Fired when input rises above `speechLevelThreshold` while capturing. */
  onInputDetected?: () => void;
  speechLevelThreshold?: number;
}

export function useMicrophone({
  onInputDetected,
  speechLevelThreshold = 0.035,
}: UseMicrophoneOptions = {}): MicrophoneController {
  const [active, setActive] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<MicrophoneError | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const onInputDetectedRef = useRef(onInputDetected);

  useEffect(() => {
    onInputDetectedRef.current = onInputDetected;
  }, [onInputDetected]);

  const stop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    const context = contextRef.current;
    contextRef.current = null;
    if (context && context.state !== 'closed') {
      void context.close().catch(() => {
        // Closing twice is harmless; the context is unreferenced either way.
      });
    }

    setActive(false);
    setLevel(0);
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (streamRef.current) return true;
    if (!isMicrophoneSupported()) {
      setError('unsupported');
      return false;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      setError((err as DOMException)?.name === 'NotAllowedError' ? 'denied' : 'unavailable');
      return false;
    }

    let context: AudioContext;
    try {
      context = new AudioContext();
      if (context.state === 'suspended') await context.resume();
    } catch {
      // Release the stream rather than hold a mic we cannot meter.
      stream.getTracks().forEach((track) => track.stop());
      setError('unavailable');
      return false;
    }

    streamRef.current = stream;
    contextRef.current = context;

    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    const sample = () => {
      if (contextRef.current !== context) return;
      analyser.getByteFrequencyData(buffer);

      let sumSquares = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const normalized = buffer[i] / 255;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / buffer.length);
      setLevel(rms);
      if (rms > speechLevelThreshold) onInputDetectedRef.current?.();

      frameRef.current = requestAnimationFrame(sample);
    };
    frameRef.current = requestAnimationFrame(sample);

    setError(null);
    setActive(true);
    return true;
  }, [speechLevelThreshold]);

  useEffect(() => stop, [stop]);

  return { active, level, error, start, stop };
}
