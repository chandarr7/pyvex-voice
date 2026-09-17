/**
 * Browser speech recognition, wrapped so its capability and its state are never
 * assumed.
 *
 * This is a development-grade transcriber. The Web Speech API is Chromium-only
 * and routes audio to the vendor's cloud recogniser; it is not the production
 * speech path.
 *
 * Two properties this wrapper guarantees:
 *
 * - A turn is committed exactly once. The recogniser's own `isFinal` result is
 *   the only trigger, so an energy-based silence timer cannot double-submit the
 *   same utterance.
 * - Nothing is ever invented. When the recogniser produces no transcript, the
 *   turn simply does not happen.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

function getConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as SpeechRecognitionWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getConstructor() !== null;
}

export interface UseSpeechRecognitionOptions {
  lang?: string;
  /** Called once per final transcript. Never called with empty text. */
  onFinalTranscript: (transcript: string) => void;
  onError?: (error: string) => void;
}

export interface SpeechRecognitionController {
  supported: boolean;
  listening: boolean;
  interimTranscript: string;
  start: () => void;
  stop: () => void;
}

export function useSpeechRecognition({
  lang = 'en-US',
  onFinalTranscript,
  onError,
}: UseSpeechRecognitionOptions): SpeechRecognitionController {
  const supported = isSpeechRecognitionSupported();
  const [listening, setListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  // Read inside event handlers, which close over their first render otherwise.
  const shouldListenRef = useRef(false);
  const onFinalRef = useRef(onFinalTranscript);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onFinalRef.current = onFinalTranscript;
    onErrorRef.current = onError;
  }, [onFinalTranscript, onError]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      try {
        recognition.abort();
      } catch {
        // Already stopped; nothing further to release.
      }
    }
    setListening(false);
    setInterimTranscript('');
  }, []);

  const start = useCallback(() => {
    const Constructor = getConstructor();
    if (!Constructor || recognitionRef.current) return;

    const recognition = new Constructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    shouldListenRef.current = true;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          const finalText = transcript.trim();
          // The sole commit point for a user turn.
          if (finalText) {
            setInterimTranscript('');
            onFinalRef.current(finalText);
          }
        } else {
          interim += transcript;
        }
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      // Silence between utterances is expected, not a failure.
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        onErrorRef.current?.(event.error);
      }
    };

    recognition.onend = () => {
      setListening(false);
      // Chromium ends recognition after a silent stretch; restart while the
      // caller still wants to listen. The ref keeps this current.
      if (shouldListenRef.current && recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          shouldListenRef.current = false;
          onErrorRef.current?.('restart-failed');
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      recognitionRef.current = null;
      shouldListenRef.current = false;
      onErrorRef.current?.((err as Error).message);
    }
  }, [lang]);

  useEffect(() => stop, [stop]);

  return { supported, listening, interimTranscript, start, stop };
}
