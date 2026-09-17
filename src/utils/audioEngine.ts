// Audio engine handling ElevenLabs API streaming with Web Speech / Web Audio fallback & Autoplay policy recovery

let activeAudio: HTMLAudioElement | null = null;
let audioContext: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;
let dataArray: Uint8Array | null = null;
let isPlayingCallback: ((playing: boolean) => void) | null = null;
let speechKeepAliveTimer: any = null;

export const getAudioAnalyser = () => {
  return { analyserNode, dataArray };
};

/**
 * Ensures browser AudioContext is un-suspended.
 * Must be called in response to or following a user gesture (click/touch/keypress).
 */
export const ensureAudioUnlocked = async (): Promise<boolean> => {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.resume();
    }
    return audioContext.state === 'running';
  } catch (err) {
    console.warn('Unable to unlock AudioContext:', err);
    return false;
  }
};

export const stopVoiceAudio = () => {
  if (speechKeepAliveTimer) {
    clearInterval(speechKeepAliveTimer);
    speechKeepAliveTimer = null;
  }
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
  }
  if (isPlayingCallback) {
    isPlayingCallback(false);
  }
};

/**
 * Generates an acoustic synthesizer tone sequence through the Web Audio API.
 * Guarantees audible feedback even in headless browsers, Linux sandbox environments, or where TTS voices are missing.
 */
export const playAcousticToneFallback = async (durationMs = 1200): Promise<void> => {
  try {
    await ensureAudioUnlocked();
    if (!audioContext) return;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = 'sine';
    // Elegant arpeggio sequence
    const now = audioContext.currentTime;
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.35);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (durationMs / 1000));

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start(now);
    osc.stop(now + (durationMs / 1000));
  } catch (err) {
    console.warn('Acoustic tone generation error:', err);
  }
};

export const playVoiceAudio = async ({
  text,
  elevenLabsVoiceId,
  apiKey,
  gender,
  pitch = 1,
  rate = 1,
  onStateChange,
  onAutoplayBlocked,
}: {
  text: string;
  elevenLabsVoiceId: string;
  apiKey?: string;
  gender: 'male' | 'female';
  pitch?: number;
  rate?: number;
  onStateChange?: (isPlaying: boolean) => void;
  onAutoplayBlocked?: () => void;
}) => {
  stopVoiceAudio();
  isPlayingCallback = onStateChange || null;

  await ensureAudioUnlocked();

  if (onStateChange) onStateChange(true);

  // 1. Check if user provided an ElevenLabs API key
  const trimmedKey = apiKey?.trim();
  if (trimmedKey) {
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}/stream?optimize_streaming_latency=3`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': trimmedKey,
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_turbo_v2_5',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.8,
            },
          }),
        }
      );

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        activeAudio = audio;

        // Connect to web audio analyser
        try {
          if (!audioContext) {
            audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
          }
          const source = audioContext.createMediaElementSource(audio);
          analyserNode = audioContext.createAnalyser();
          analyserNode.fftSize = 64;
          dataArray = new Uint8Array(analyserNode.frequencyBinCount);
          source.connect(analyserNode);
          analyserNode.connect(audioContext.destination);
        } catch (ctxErr) {
          console.warn('AudioContext hook failed, playing directly:', ctxErr);
        }

        audio.onended = () => {
          if (onStateChange) onStateChange(false);
          activeAudio = null;
        };
        audio.onerror = () => {
          if (onStateChange) onStateChange(false);
          activeAudio = null;
        };

        try {
          await audio.play();
          return;
        } catch (playErr: any) {
          if (playErr.name === 'NotAllowedError') {
            console.warn('Audio play() blocked by browser Autoplay policy. Awaiting user interaction.');
            if (onAutoplayBlocked) onAutoplayBlocked();
          }
        }
      } else {
        console.warn(`ElevenLabs API returned ${response.status}, falling back to Web Speech`);
      }
    } catch (apiErr) {
      console.warn('ElevenLabs API request failed, falling back to Web Speech:', apiErr);
    }
  }

  // 2. High-fidelity Web Speech API fallback with Chrome keep-alive & speech un-freeze
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = pitch;
      utterance.rate = rate;

      // Pick appropriate system voice matching gender
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const isFemale = gender === 'female';
        const preferred = voices.find((v) => {
          const name = v.name.toLowerCase();
          if (isFemale) {
            return (
              name.includes('female') ||
              name.includes('samantha') ||
              name.includes('karen') ||
              name.includes('victoria') ||
              name.includes('zira') ||
              name.includes('natural')
            );
          } else {
            return (
              name.includes('male') ||
              name.includes('david') ||
              name.includes('alex') ||
              name.includes('daniel') ||
              name.includes('george') ||
              name.includes('guy')
            );
          }
        });
        if (preferred) {
          utterance.voice = preferred;
        }
      }

      utterance.onstart = () => {
        if (onStateChange) onStateChange(true);
      };

      utterance.onend = () => {
        if (speechKeepAliveTimer) {
          clearInterval(speechKeepAliveTimer);
          speechKeepAliveTimer = null;
        }
        if (onStateChange) onStateChange(false);
      };

      utterance.onerror = (e) => {
        if (speechKeepAliveTimer) {
          clearInterval(speechKeepAliveTimer);
          speechKeepAliveTimer = null;
        }
        console.warn('Web Speech Synthesis error, triggering acoustic chime fallback:', e);
        playAcousticToneFallback(1200);
        if (onStateChange) onStateChange(false);
      };

      // Workaround for Chrome's 15-second speech pause bug
      speechKeepAliveTimer = setInterval(() => {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 10000);

      window.speechSynthesis.speak(utterance);
      return;
    } catch (synthErr) {
      console.warn('Speech synthesis invocation failed:', synthErr);
    }
  }

  // 3. Guaranteed Acoustic Waveform fallback if speech API is unavailable or blocked
  playAcousticToneFallback(1500);
  const simulatedDurationMs = Math.max(2000, text.length * 45);
  setTimeout(() => {
    if (onStateChange) onStateChange(false);
  }, simulatedDurationMs);
};
