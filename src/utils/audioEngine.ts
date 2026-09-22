// Audio engine handling voice playback, Web Audio Analyser, and client speech fallback
// Guarantees clean resource lifecycle (Object URLs revoked, AudioContext managed, nodes disconnected)

let activeAudio: HTMLAudioElement | null = null;
let activeAudioUrl: string | null = null;
let activeMediaSourceNode: MediaElementAudioSourceNode | null = null;
let activeBufferSourceNode: AudioBufferSourceNode | null = null;
let audioContext: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;
let dataArray: Uint8Array | null = null;
let isPlayingCallback: ((playing: boolean) => void) | null = null;
let speechKeepAliveTimer: NodeJS.Timeout | null = null;

export const getAudioAnalyser = () => {
  return { analyserNode, dataArray };
};

/**
 * Returns or initializes a shared AudioContext.
 */
export const getOrCreateAudioContext = (): AudioContext => {
  if (!audioContext || audioContext.state === 'closed') {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    audioContext = new AudioCtx();
  }
  return audioContext;
};

/**
 * Ensures browser AudioContext is un-suspended.
 * Must be called in response to or following a user gesture (click/touch/keypress).
 */
export const ensureAudioUnlocked = async (): Promise<boolean> => {
  try {
    const ctx = getOrCreateAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.resume();
    }
    return ctx.state === 'running';
  } catch (err) {
    console.warn('Unable to unlock AudioContext:', err);
    return false;
  }
};

/**
 * Stops any playing audio, revokes Blob URLs, cleans up keep-alive timers, and cancels speech synthesis.
 */
export const stopVoiceAudio = () => {
  if (speechKeepAliveTimer) {
    clearInterval(speechKeepAliveTimer);
    speechKeepAliveTimer = null;
  }

  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio.src = '';
      activeAudio.load();
    } catch {
      // Ignore pause errors
    }
    activeAudio = null;
  }

  if (activeMediaSourceNode) {
    try {
      activeMediaSourceNode.disconnect();
    } catch {
      // Ignore disconnect errors
    }
    activeMediaSourceNode = null;
  }

  if (activeBufferSourceNode) {
    try {
      activeBufferSourceNode.stop();
      activeBufferSourceNode.disconnect();
    } catch {
      // Ignore disconnect errors
    }
    activeBufferSourceNode = null;
  }

  if (activeAudioUrl) {
    URL.revokeObjectURL(activeAudioUrl);
    activeAudioUrl = null;
  }

  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
    } catch {
      // Ignore
    }
  }

  if (isPlayingCallback) {
    isPlayingCallback(false);
  }
};

/**
 * Generates an acoustic synthesizer tone sequence through the Web Audio API.
 * Cleanly disconnects nodes after playback completes.
 */
export const playAcousticToneFallback = async (durationMs = 1200): Promise<void> => {
  try {
    await ensureAudioUnlocked();
    const ctx = getOrCreateAudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.35);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationMs / 1000);

    // Disconnect audio nodes after tone finishes to prevent node leak
    setTimeout(() => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // Ignore
      }
    }, durationMs + 100);
  } catch (err) {
    console.warn('Acoustic tone generation error:', err);
  }
};

/**
 * Sanitizes dialogue before sending to ElevenLabs voice synthesis.
 * Strips out:
 * - Turn count indicators: e.g. "(1 turns)", "(2 turns)", "1 turns", "Turn 1:", "[1 turns]"
 * - System prompts, system instructions, meta tags: e.g. "System:", "[System Prompt]", "<system>...</system>"
 * - Stage directions and action tags: e.g. [pause], (chuckles), *nods*, [smiles], *speaks warmly*
 * - Markdown asterisks, headers, bullet points, numbering
 * Ensures the ElevenLabs voice engine speaks fluidly, naturally, and solely the conversational dialogue.
 */
export function sanitizeSpokenText(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';

  let text = rawText;

  // 1. Remove turn counts, e.g. "(1 turns)", "(2 turns)", "1 turns", "turn 1:", "[1 turns]"
  text = text.replace(/\(?\s*\d+\s+turns?\s*\)?/gi, '');
  text = text.replace(/\[\s*\d+\s+turns?\s*\]/gi, '');
  text = text.replace(/\bturns?\s*#?\d+:?/gi, '');
  text = text.replace(/\(\s*turn\s*#?\d+\s*\)/gi, '');

  // 2. Remove meta-tags and system prompt echoes
  text = text.replace(/<[^>]+>/g, ' '); // remove any HTML / XML tags
  text = text.replace(/\[(?:system|instruction|meta|prompt|role|thought|note)[^\]]*\]/gi, '');
  text = text.replace(/\((?:system|instruction|meta|prompt|role|thought|note)[^)]*\)/gi, '');
  text = text.replace(/^(?:system|instruction|assistant|bot|ai|agent|model):\s*/i, '');
  text = text.replace(/\bvoice & interaction rules:[^.\n]*[.\n]?/gi, '');

  // 3. Remove stage directions or descriptive actions in brackets, parentheses, or asterisks
  // e.g. *chuckles*, [pause], (sighs), *smiling*, [speaks softly], (laughs)
  text = text.replace(/\*[^*]+\*/g, ' ');
  text = text.replace(/\[(?:pause|sigh|laughs|chuckles|smiles|whispers|coughs|giggles|speaking|action|stage|audio)[^\]]*\]/gi, '');
  text = text.replace(/\((?:pause|sigh|laughs|chuckles|smiles|whispers|coughs|giggles|speaking|action|stage|audio)[^)]*\)/gi, '');

  // 4. Remove Markdown syntax that could be pronounced awkwardly
  text = text.replace(/^#+\s+/gm, ''); // headers
  text = text.replace(/[*_~`#]/g, ''); // formatting symbols
  text = text.replace(/^[-*+]\s+/gm, ''); // bullets
  text = text.replace(/^\d+\.\s+/gm, ''); // numbered lists

  // 5. Clean up redundant whitespace and punctuation
  text = text.replace(/\s+/g, ' ').trim();
  text = text.replace(/^[,;:\s]+/, '');

  return text;
}

/**
 * Plays voice audio via server-side ElevenLabs preview endpoint if configured,
 * or cleanly falls back to client speech synthesis.
 */
export const playVoiceAudio = async ({
  text,
  voiceId,
  gender = 'female',
  pitch = 0,
  rate = 1,
  volume = 1,
  voiceModel,
  authToken,
  stability,
  onStateChange,
  onAutoplayBlocked,
}: {
  text: string;
  voiceId?: string;
  gender?: 'male' | 'female';
  pitch?: number;
  rate?: number;
  volume?: number;
  voiceModel?: string;
  authToken?: string;
  stability?: number;
  onStateChange?: (isPlaying: boolean) => void;
  onAutoplayBlocked?: () => void;
}) => {
  stopVoiceAudio();
  isPlayingCallback = onStateChange || null;

  // Sanitize dialogue so no meta-tags, turn indicators (e.g. (1 turns)), or stage directions are ever spoken
  const cleanDialogue = sanitizeSpokenText(text);
  if (!cleanDialogue.trim()) {
    if (onStateChange) onStateChange(false);
    return;
  }

  await ensureAudioUnlocked();

  if (onStateChange) onStateChange(true);

  // Enforce ElevenLabs voice ID (defaulting to Freya if unspecified or generic)
  const resolvedVoiceId =
    voiceId && voiceId !== 'browser_system_voice' ? voiceId : 'jsCqWAovK2LkecY7zXl4';

  const effectiveRate = Math.max(0.5, Math.min(2.0, rate || 1.0));
  const effectiveVolume = Math.max(0.0, Math.min(1.0, typeof volume === 'number' ? volume : 1.0));

  // Determine detune cents from pitch.
  // If pitch is in [-10, 10] scale (where 0 is neutral): 1 unit = 100 cents (1 semitone)
  // If pitch is ratio around 1.0 (e.g. 0.8 or 1.2): 1200 * log2(pitch)
  let detuneCents = 0;
  let webSpeechPitch = 1.0;

  if (typeof pitch === 'number') {
    if (pitch >= -10 && pitch <= 10 && pitch !== 1.0) {
      detuneCents = Math.round(pitch * 100);
      webSpeechPitch = Math.max(0.1, Math.min(2.0, 1.0 + (pitch / 10) * 0.8));
    } else if (pitch > 0) {
      detuneCents = Math.round(1200 * Math.log2(pitch));
      webSpeechPitch = Math.max(0.1, Math.min(2.0, pitch));
    }
  }
  detuneCents = Math.max(-1200, Math.min(1200, detuneCents));

  // 1. Attempt Server-Side ElevenLabs Voice Generation
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`/api/voices/${resolvedVoiceId}/preview`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: cleanDialogue,
        pitch,
        rate: effectiveRate,
        volume: effectiveVolume,
        voiceModel: voiceModel || 'eleven_turbo_v2_5',
        stability: typeof stability === 'number' ? stability : undefined,
      }),
    });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        activeAudioUrl = audioUrl;

        // Primary: Web Audio buffer playback for native pitch shift (detune), speed scaling, and volume gain
        try {
          const ctx = getOrCreateAudioContext();
          if (ctx.state === 'suspended') {
            await ctx.resume().catch(() => {});
          }

          const arrayBuffer = await audioBlob.arrayBuffer();
          const decodedBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));

          const source = ctx.createBufferSource();
          source.buffer = decodedBuffer;
          source.playbackRate.value = effectiveRate;
          source.detune.value = detuneCents;

          const gainNode = ctx.createGain();
          gainNode.gain.value = effectiveVolume;

          analyserNode = ctx.createAnalyser();
          analyserNode.fftSize = 64;
          dataArray = new Uint8Array(analyserNode.frequencyBinCount);

          source.connect(gainNode);
          gainNode.connect(analyserNode);
          analyserNode.connect(ctx.destination);
          activeBufferSourceNode = source;

          const cleanup = () => {
            if (activeAudioUrl === audioUrl) {
              URL.revokeObjectURL(audioUrl);
              activeAudioUrl = null;
            }
            if (activeBufferSourceNode === source) {
              try {
                source.disconnect();
                gainNode.disconnect();
              } catch {}
              activeBufferSourceNode = null;
            }
            if (onStateChange) onStateChange(false);
          };

          source.onended = cleanup;
          source.start(0);
          return;
        } catch (bufferErr) {
          console.warn('Web Audio buffer playback failed, using HTMLAudioElement fallback:', bufferErr);
        }

        // Secondary fallback: HTML5 Audio with playbackRate & volume
        const audio = new Audio(audioUrl);
        audio.volume = effectiveVolume;
        audio.playbackRate = effectiveRate;
        activeAudio = audio;

        // Hook up analyser cleanly
        try {
          const ctx = getOrCreateAudioContext();
          if (ctx.state === 'suspended') {
            await ctx.resume().catch(() => {});
          }
          const source = ctx.createMediaElementSource(audio);
          activeMediaSourceNode = source;

          analyserNode = ctx.createAnalyser();
          analyserNode.fftSize = 64;
          dataArray = new Uint8Array(analyserNode.frequencyBinCount);

          source.connect(analyserNode);
          analyserNode.connect(ctx.destination);
        } catch (ctxErr) {
          console.warn('AudioContext analyser hook failed, playing directly:', ctxErr);
        }

        const cleanup = () => {
          if (activeAudioUrl === audioUrl) {
            URL.revokeObjectURL(audioUrl);
            activeAudioUrl = null;
          }
          if (activeMediaSourceNode) {
            try {
              activeMediaSourceNode.disconnect();
            } catch {}
            activeMediaSourceNode = null;
          }
          activeAudio = null;
          if (onStateChange) onStateChange(false);
        };

        audio.onended = cleanup;
        audio.onerror = cleanup;

        try {
          await audio.play();
          return;
        } catch (playErr: any) {
          cleanup();
          if (playErr.name === 'NotAllowedError') {
            console.warn('Audio play() blocked by browser Autoplay policy. Awaiting user interaction.');
            if (onAutoplayBlocked) onAutoplayBlocked();
          }
        }
      }
    } catch (serverErr) {
      console.warn('Server voice audio request failed, falling back to Web Speech:', serverErr);
    }

  // 2. Client Web Speech API fallback
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      const isSweetVoice =
        voiceId === 'pFZP5JQG7iQjIQuC4Bku' ||
        voiceId === 'jsCqWAovK2LkecY7zXl4' ||
        voiceId === 'LcfcDJNigUd50AZSDxio' ||
        voiceId === 'XB0fDUnXU5powFXDhCwa' ||
        voiceId === 'piTKgcLEGmPE4e6mEKli';

      // Acoustic sweet voice tuning
      let tunedPitch = webSpeechPitch;
      let tunedRate = effectiveRate;
      if (isSweetVoice) {
        if (voiceId === 'pFZP5JQG7iQjIQuC4Bku') {
          // Lily: Sweet velvet & warm
          tunedPitch = Math.max(1.05, webSpeechPitch * 1.06);
          tunedRate = Math.min(1.0, effectiveRate * 0.97);
        } else if (voiceId === 'jsCqWAovK2LkecY7zXl4') {
          // Freya: Sweet radiant & bright
          tunedPitch = Math.max(1.12, webSpeechPitch * 1.12);
          tunedRate = effectiveRate;
        } else if (voiceId === 'LcfcDJNigUd50AZSDxio') {
          // Emily: Sweet gentle & tender
          tunedPitch = Math.max(1.06, webSpeechPitch * 1.05);
          tunedRate = Math.min(1.0, effectiveRate * 0.98);
        } else if (voiceId === 'XB0fDUnXU5powFXDhCwa') {
          // Charlotte: Sweet melodic & delicate
          tunedPitch = Math.max(1.10, webSpeechPitch * 1.09);
          tunedRate = Math.min(0.98, effectiveRate * 0.96);
        } else if (voiceId === 'piTKgcLEGmPE4e6mEKli') {
          // Nicole: Sweet whisper-soft & peaceful
          tunedPitch = Math.max(1.04, webSpeechPitch * 1.03);
          tunedRate = Math.min(0.98, effectiveRate * 0.97);
        }
      }

      const utterance = new SpeechSynthesisUtterance(cleanDialogue);
      utterance.pitch = Math.min(2.0, Math.max(0.5, tunedPitch));
      utterance.rate = Math.min(2.0, Math.max(0.5, tunedRate));
      utterance.volume = effectiveVolume;

      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const isFemale = gender === 'female' || isSweetVoice;
        const preferred = voices.find((v) => {
          const name = v.name.toLowerCase();
          if (isFemale) {
            return (
              name.includes('sweet') ||
              name.includes('samantha') ||
              name.includes('victoria') ||
              name.includes('karen') ||
              name.includes('natural') ||
              name.includes('aria') ||
              name.includes('jenny') ||
              name.includes('female') ||
              name.includes('zira')
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

      utterance.onerror = () => {
        if (speechKeepAliveTimer) {
          clearInterval(speechKeepAliveTimer);
          speechKeepAliveTimer = null;
        }
        playAcousticToneFallback(1000);
        if (onStateChange) onStateChange(false);
      };

      // Workaround for Chromium pause bug on long utterances
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

  // 3. Guaranteed Acoustic Waveform fallback if speech API is unavailable or headless
  playAcousticToneFallback(1200);
  const simulatedDurationMs = Math.min(3000, Math.max(1200, text.length * 35));
  setTimeout(() => {
    if (onStateChange) onStateChange(false);
  }, simulatedDurationMs);
};
