// Pure ElevenLabs voice audio engine with dynamic synthesis & CDN fallback.
// All robotic browser voices (Web Speech API) are strictly removed.

let activeAudio: HTMLAudioElement | null = null;
let audioContext: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;
let dataArray: Uint8Array | null = null;
let isPlayingCallback: ((playing: boolean) => void) | null = null;

// Built-in studio ElevenLabs audio samples by Voice ID from official ElevenLabs CDN
export const ELEVENLABS_VOICE_SAMPLE_MAP: Record<string, string> = {
  // Sarah (Mature & Reassuring, Female)
  'EXAVITQu4vr4xnSDxMaL': 'https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee7-8543-ff2216a32186.mp3',
  // Adam (Dominant & Firm, Male)
  'pNInz6obpgDQGcFmaJgB': 'https://storage.googleapis.com/eleven-public-prod/premade/voices/pNInz6obpgDQGcFmaJgB/d6905d7a-dd26-4187-bfff-1bd3a5ea7cac.mp3',
  // Matilda (Professional & Empathetic, Female)
  'XrExE9yKIg1WjnnlVkGX': 'https://storage.googleapis.com/eleven-public-prod/premade/voices/XrExE9yKIg1WjnnlVkGX/b930e18d-6b4d-466e-bab2-0ae97c6d8535.mp3',
  // Brian (Deep & Comforting, Male)
  'nPczCjzI2devNBz1zQrb': 'https://api.us.elevenlabs.io/v1/voices/nPczCjzI2devNBz1zQrb/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJwcmVtYWRlIiwiZmlsZW5hbWUiOiIyZGQzZTcyYy00ZmQzLTQyZjEtOTNlYS1hYmM1ZDRlNWFhMWQubXAzIiwidGltZXN0YW1wIjoxNzg5ODg3NjAwMDAwMDAwfQ%3D%3D',
  // Bella (Professional & Warm, Female)
  'hpp4J3VqNfWAUOO0d1Us': 'https://storage.googleapis.com/eleven-public-prod/premade/voices/hpp4J3VqNfWAUOO0d1Us/dab0f5ba-3aa4-48a8-9fad-f138fea1126d.mp3',
  // Eric (Smooth & Trustworthy, Male)
  'cjVigY5qzO86Huf0OWal': 'https://storage.googleapis.com/eleven-public-prod/premade/voices/cjVigY5qzO86Huf0OWal/d098fda0-6456-4030-b3d8-63aa048c9070.mp3',
  // Lily (Velvety & Elegant, Female)
  'pFZP5JQG7iQjIQuC4Bku': 'https://storage.googleapis.com/eleven-public-prod/premade/voices/pFZP5JQG7iQjIQuC4Bku/89b68b35-b3dd-4348-a84a-a3c13a3c2b30.mp3',
  // Roger (Laid-Back & Resonant, Male)
  'CwhRBWXzGAHq8TQ4Fs17': 'https://storage.googleapis.com/eleven-public-prod/premade/voices/CwhRBWXzGAHq8TQ4Fs17/58ee3ff5-f6f2-4628-93b8-e38eb31806b0.mp3',
  // Alice (Clear & Engaging, Female)
  'Xb7hH8MSUJpSbSDYk0k2': 'https://storage.googleapis.com/eleven-public-prod/premade/voices/Xb7hH8MSUJpSbSDYk0k2/d10f7534-11f6-41fe-a012-2de1e482d336.mp3',
  // Bill (Wise & Balanced, Male)
  'pqHfZKP75CvOlQylNhV4': 'https://storage.googleapis.com/eleven-public-prod/premade/voices/pqHfZKP75CvOlQylNhV4/d782b3ff-84ba-4029-848c-acf01285524d.mp3',
  // Jessica (Playful & Bright, Female)
  'cgSgspJ2msm6clMCkdW9': 'https://storage.googleapis.com/eleven-public-prod/premade/voices/cgSgspJ2msm6clMCkdW9/56a97bf8-b69b-448f-846c-c3a11683d45a.mp3',
  // Chris (Charming & Natural, Male)
  'iP95p4xoKVk53GoZ742B': 'https://storage.googleapis.com/eleven-public-prod/premade/voices/iP95p4xoKVk53GoZ742B/3f4bde72-cc48-40dd-829f-57fbf906f4d7.mp3',
  // Callum (Husky, Male)
  'N2lVS1w4EtoT3dr4eOWO': 'https://storage.googleapis.com/eleven-public-prod/premade/voices/N2lVS1w4EtoT3dr4eOWO/ac833bd8-ffda-4938-9ebc-b0f99ca25481.mp3',
  // Will (Relaxed, Male)
  'bIHbv24MWmeRgasZH58o': 'https://storage.googleapis.com/eleven-public-prod/premade/voices/bIHbv24MWmeRgasZH58o/8caf8f3d-ad29-4980-af41-53f20c72d7a4.mp3',
};

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
    return audioContext.state === 'running';
  } catch (err) {
    console.warn('Unable to unlock AudioContext:', err);
    return false;
  }
};

export const stopVoiceAudio = () => {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  if (isPlayingCallback) {
    isPlayingCallback(false);
  }
};

/**
 * Acoustic chime indicator for user feedback
 */
export const playAcousticToneFallback = async (durationMs = 400): Promise<void> => {
  try {
    await ensureAudioUnlocked();
    if (!audioContext) return;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = 'sine';
    const now = audioContext.currentTime;
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.12);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (durationMs / 1000));

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start(now);
    osc.stop(now + (durationMs / 1000));
  } catch (err) {
    console.warn('Audio tone notification error:', err);
  }
};

/**
 * Play authentic ElevenLabs voice audio exclusively.
 * Strictly uses ElevenLabs streaming API or studio-recorded ElevenLabs voice previews.
 * Robotic browser speech synthesis is completely excluded.
 */
export const playVoiceAudio = async ({
  text,
  elevenLabsVoiceId,
  previewUrl,
  apiKey,
  onStateChange,
  onAutoplayBlocked,
}: {
  text: string;
  elevenLabsVoiceId: string;
  previewUrl?: string;
  apiKey?: string;
  gender?: 'male' | 'female';
  pitch?: number;
  rate?: number;
  onStateChange?: (isPlaying: boolean) => void;
  onAutoplayBlocked?: () => void;
}) => {
  stopVoiceAudio();
  isPlayingCallback = onStateChange || null;

  await ensureAudioUnlocked();

  if (onStateChange) onStateChange(true);

  let audioSourceUrl: string | null = null;
  const trimmedKey = apiKey?.trim();

  // 1. Try server-side or client ElevenLabs streaming synthesis
  try {
    const ttsEndpoint = '/api/tts/elevenlabs';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (trimmedKey) {
      headers['xi-api-key'] = trimmedKey;
    }

    const res = await fetch(ttsEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text,
        voiceId: elevenLabsVoiceId,
        apiKey: trimmedKey,
      }),
    });

    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('audio')) {
        const audioBlob = await res.blob();
        audioSourceUrl = URL.createObjectURL(audioBlob);
      }
    }
  } catch (fetchErr) {
    console.warn('ElevenLabs server synthesis endpoint unavailable, resolving ElevenLabs voice CDN asset:', fetchErr);
  }

  // 2. If dynamic synthesis didn't return audio, immediately use the official studio-recorded ElevenLabs voice asset
  if (!audioSourceUrl) {
    audioSourceUrl =
      previewUrl ||
      ELEVENLABS_VOICE_SAMPLE_MAP[elevenLabsVoiceId] ||
      ELEVENLABS_VOICE_SAMPLE_MAP['EXAVITQu4vr4xnSDxMaL'];
  }

  // 3. Play the ElevenLabs audio stream through HTMLAudioElement & connect to Analyser
  try {
    const audio = new Audio(audioSourceUrl);
    activeAudio = audio;
    audio.crossOrigin = 'anonymous';

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
      console.warn('Web Audio node connection bypassed for ElevenLabs stream:', ctxErr);
    }

    audio.onended = () => {
      if (onStateChange) onStateChange(false);
      activeAudio = null;
    };

    audio.onerror = (e) => {
      console.warn('ElevenLabs audio playback event notice:', e);
      if (onStateChange) onStateChange(false);
      activeAudio = null;
    };

    await audio.play();
  } catch (playErr: any) {
    if (playErr.name === 'NotAllowedError') {
      console.warn('Browser Autoplay blocked audio playback until user clicks.');
      if (onAutoplayBlocked) onAutoplayBlocked();
    }
    if (onStateChange) onStateChange(false);
  }
};

