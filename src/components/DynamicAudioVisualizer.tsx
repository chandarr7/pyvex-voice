import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Activity, AlertCircle, Volume2, Radio } from 'lucide-react';

interface DynamicAudioVisualizerProps {
  isActive: boolean;
  onAudioLevelChange?: (level: number) => void;
  className?: string;
  showControls?: boolean;
}

export const DynamicAudioVisualizer: React.FC<DynamicAudioVisualizerProps> = ({
  isActive,
  onAudioLevelChange,
  className = '',
  showControls = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');
  const [micMuted, setMicMuted] = useState(false);
  const [currentDb, setCurrentDb] = useState<number>(-60);
  const [currentLevel, setCurrentLevel] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audio nodes and animation ref
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const freqDataRef = useRef<Uint8Array | null>(null);
  const timeDataRef = useRef<Uint8Array | null>(null);

  // Start microphone capture and analyzer
  const startMic = useCallback(async () => {
    try {
      setErrorMessage(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMicPermission('unsupported');
        setErrorMessage('Microphone not supported in this browser environment');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;
      setMicPermission('granted');

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      freqDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      timeDataRef.current = new Uint8Array(analyser.fftSize);

      // Note: Do NOT connect analyser to destination to avoid speaker acoustic feedback
      source.connect(analyser);
    } catch (err: unknown) {
      console.warn('Microphone ingress request:', err);
      setMicPermission('denied');
      setErrorMessage('Microphone access blocked. Click to grant permission.');
    }
  }, []);

  // Stop microphone capture and clean resources
  const stopMic = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setCurrentDb(-60);
    setCurrentLevel(0);
    if (onAudioLevelChange) onAudioLevelChange(0);
  }, [onAudioLevelChange]);

  // Handle active status changes
  useEffect(() => {
    if (isActive && !micMuted) {
      startMic();
    } else {
      stopMic();
    }

    return () => {
      stopMic();
    };
  }, [isActive, micMuted, startMic, stopMic]);

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const analyser = analyserRef.current;
      const isMeasuring = isActive && analyser && !micMuted;

      let freqData: Uint8Array;
      let timeData: Uint8Array;

      if (isMeasuring) {
        if (!freqDataRef.current || freqDataRef.current.length !== analyser.frequencyBinCount) {
          freqDataRef.current = new Uint8Array(analyser.frequencyBinCount);
        }
        if (!timeDataRef.current || timeDataRef.current.length !== analyser.fftSize) {
          timeDataRef.current = new Uint8Array(analyser.fftSize);
        }

        freqData = freqDataRef.current;
        timeData = timeDataRef.current;

        // Cast to any to bypass strict ArrayBuffer vs SharedArrayBuffer type incompatibility
        (analyser as any).getByteFrequencyData(freqData);
        (analyser as any).getByteTimeDomainData(timeData);

        // Compute RMS and dB
        let sum = 0;
        for (let i = 0; i < timeData.length; i++) {
          const val = (timeData[i] - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / timeData.length);
        const level = Math.min(1, rms * 3.5); // normalized level
        const db = Math.max(-60, Math.round(20 * Math.log10(rms + 0.0001)));

        setCurrentDb(db);
        setCurrentLevel(level);
        if (onAudioLevelChange) onAudioLevelChange(level);
      } else {
        // Subtle resting baseline
        phase += 0.03;
        if (!freqDataRef.current || freqDataRef.current.length < 64) {
          freqDataRef.current = new Uint8Array(64);
        }
        if (!timeDataRef.current || timeDataRef.current.length < 128) {
          timeDataRef.current = new Uint8Array(128);
        }
        freqData = freqDataRef.current;
        timeData = timeDataRef.current;

        for (let i = 0; i < 64; i++) {
          freqData[i] = Math.max(4, Math.sin(phase + i * 0.15) * 12 + 10);
        }
        for (let i = 0; i < 128; i++) {
          timeData[i] = 128 + Math.sin(phase + i * 0.08) * 6;
        }
      }

      // Draw subtle background grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      const midY = height / 2;

      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(width, midY);
      ctx.stroke();

      // Dynamic Radial Glow in Center (proportional to audio level)
      const glowEnergy = isMeasuring ? currentLevel : 0.05;
      const gradient = ctx.createRadialGradient(
        width / 2,
        midY,
        4,
        width / 2,
        midY,
        Math.max(20, width * (0.2 + glowEnergy * 0.35))
      );
      gradient.addColorStop(0, `rgba(132, 92, 255, ${0.18 + glowEnergy * 0.4})`);
      gradient.addColorStop(0.5, `rgba(112, 71, 255, ${0.08 + glowEnergy * 0.2})`);
      gradient.addColorStop(0.8, `rgba(36, 216, 237, ${0.03 + glowEnergy * 0.1})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Draw Bilateral Symmetrical Spectrum Bars (36 bars)
      const barCount = 36;
      const barSpacing = width / barCount;
      const barWidth = Math.max(2.5, barSpacing * 0.55);

      for (let i = 0; i < barCount; i++) {
        // Fold spectrum towards center for a symmetrical studio aesthetic
        const distanceFromCenter = Math.abs(i - barCount / 2) / (barCount / 2);
        const dataIdx = Math.floor((1 - distanceFromCenter) * (freqData.length * 0.7));
        const rawValue = freqData[dataIdx] || 0;
        const normalized = isMeasuring ? rawValue / 255 : (rawValue / 255) * 0.3;

        const maxBarHeight = (height * 0.42);
        const barHeight = Math.max(3, normalized * maxBarHeight);

        const x = i * barSpacing + (barSpacing - barWidth) / 2;
        const topY = midY - barHeight;
        const bottomY = midY + barHeight;

        // Gradient for bars in electric purple, bright purple, and cyan
        const barGrad = ctx.createLinearGradient(0, topY, 0, bottomY);
        if (isMeasuring && normalized > 0.4) {
          barGrad.addColorStop(0, '#24D8ED'); // cyan
          barGrad.addColorStop(0.5, '#9655FF'); // electric purple
          barGrad.addColorStop(1, '#7047FF'); // primary purple
        } else if (isMeasuring) {
          barGrad.addColorStop(0, '#845CFF');
          barGrad.addColorStop(0.5, '#7047FF');
          barGrad.addColorStop(1, '#35246E');
        } else {
          barGrad.addColorStop(0, 'rgba(132, 92, 255, 0.25)');
          barGrad.addColorStop(0.5, 'rgba(112, 71, 255, 0.12)');
          barGrad.addColorStop(1, 'rgba(53, 36, 110, 0.05)');
        }

        ctx.fillStyle = barGrad;

        // Draw top bar
        ctx.beginPath();
        ctx.roundRect(x, topY, barWidth, barHeight, [2, 2, 0, 0]);
        ctx.fill();

        // Draw mirrored bottom bar
        ctx.beginPath();
        ctx.roundRect(x, midY, barWidth, barHeight, [0, 0, 2, 2]);
        ctx.fill();
      }

      // Draw Smooth Oscilloscope Wave Ribbon Overlay
      ctx.beginPath();
      ctx.lineWidth = isMeasuring ? 2 : 1;
      ctx.strokeStyle = isMeasuring
        ? 'rgba(36, 216, 237, 0.9)'
        : 'rgba(255, 255, 255, 0.15)';

      const sliceWidth = width / (timeData.length - 1);
      let xPos = 0;

      for (let i = 0; i < timeData.length; i++) {
        const v = timeData[i] / 128.0;
        const y = v * (height / 2);

        if (i === 0) {
          ctx.moveTo(xPos, y);
        } else {
          ctx.lineTo(xPos, y);
        }
        xPos += sliceWidth;
      }
      ctx.stroke();

      // Soft glow stroke on top of waveform
      if (isMeasuring && currentLevel > 0.05) {
        ctx.save();
        ctx.shadowColor = 'rgba(150, 85, 255, 0.85)';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#24D8ED';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, micMuted, currentLevel, onAudioLevelChange]);

  // Handle Retina devicePixelRatio & Container Resizing
  useEffect(() => {
    let rafId: number | null = null;

    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const targetWidth = Math.max(1, Math.floor(rect.width * dpr));
      const targetHeight = Math.max(1, Math.floor(rect.height * dpr));

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
        }
      }
    };

    const scheduledResize = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(handleResize);
    };

    handleResize();

    const resizeObserver = new ResizeObserver(() => {
      scheduledResize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', scheduledResize);
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      resizeObserver.disconnect();
      window.removeEventListener('resize', scheduledResize);
    };
  }, []);

  return (
    <div
      id="hero-mic-audio-visualizer-container"
      ref={containerRef}
      className={`relative w-full rounded-xl overflow-hidden bg-[#08090B] border border-[#292B3A] ${className}`}
    >
      {/* Visualizer Status Bar Header */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#0D0F13] border-b border-[#292B3A] text-[10px] font-mono">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {isActive && !micMuted && micPermission === 'granted' ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#20E99A] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#20E99A]" />
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#20E99A]/80 shadow-[0_0_6px_#20E99A]" />
            )}
          </span>

          <span className="text-[#F4F2F8] uppercase tracking-widest font-semibold flex items-center gap-1.5">
            <Radio className={`w-3 h-3 ${isActive && !micMuted ? 'text-[#20E99A]' : 'text-[#845CFF]'}`} />
            {isActive && !micMuted && micPermission === 'granted'
              ? 'Mic Ingress Live'
              : isActive
              ? 'Acoustic Pipeline Ready'
              : 'Visualizer Standby'}
          </span>

          {isActive && !micMuted && micPermission === 'granted' && (
            <span className="px-1.5 py-0.5 rounded bg-[#20E99A]/10 text-[#20E99A] border border-[#20E99A]/30 text-[9px] font-semibold">
              {currentDb > -58 ? `${currentDb} dB` : '-INF dB'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Real-time Level Progress Indicator */}
          {isActive && !micMuted && (
            <div className="hidden sm:flex items-center gap-1.5 text-[#A4A3B2]">
              <span>RMS:</span>
              <div className="w-16 h-1.5 bg-[#171820] border border-[#292B3A] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#7047FF] to-[#24D8ED] transition-all duration-75"
                  style={{ width: `${Math.min(100, Math.round(currentLevel * 100))}%` }}
                />
              </div>
              <span className="text-[#24D8ED] font-mono w-7 text-right">
                {Math.round(currentLevel * 100)}%
              </span>
            </div>
          )}

          {/* Quick Mic Mute / Unmute Button */}
          {showControls && (
            <button
              type="button"
              id="toggle-mic-mute-button"
              onClick={() => {
                if (micPermission === 'denied') {
                  startMic();
                } else {
                  setMicMuted(!micMuted);
                }
              }}
              title={micMuted ? 'Unmute microphone' : 'Mute microphone'}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors border ${
                micMuted
                  ? 'bg-[#FF6269]/10 border-[#FF6269]/40 text-[#FF6269] hover:bg-[#FF6269]/20'
                  : micPermission === 'granted'
                  ? 'bg-[#7047FF]/20 border-[#7047FF]/40 text-[#F4F2F8] hover:bg-[#7047FF]/30'
                  : 'bg-[#12141A] border-[#292B3A] text-[#A4A3B2] hover:text-[#F4F2F8]'
              }`}
            >
              {micMuted ? (
                <>
                  <MicOff className="w-2.5 h-2.5 text-[#FF6269]" />
                  <span>Muted</span>
                </>
              ) : (
                <>
                  <Mic className="w-2.5 h-2.5 text-[#845CFF]" />
                  <span>Mic Live</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main HTML5 Canvas */}
      <div className="relative w-full h-24 sm:h-28 bg-[#08090B]">
        <canvas
          id="hero-mic-audio-visualizer-canvas"
          ref={canvasRef}
          className="w-full h-full block"
        />

        {/* Ambient State Overlay when inactive or permission issue */}
        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#12141A]/90 border border-[#34365C] text-[10px] font-mono text-[#A4A3B2] backdrop-blur-sm shadow-md">
              <Activity className="w-3 h-3 text-[#845CFF]" />
              <span>Click &quot;▶ TEST PYVEX VOICE&quot; to activate real-time audio pipeline</span>
            </div>
          </div>
        )}

        {isActive && micPermission === 'denied' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs">
            <button
              type="button"
              onClick={startMic}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#7047FF]/20 hover:bg-[#7047FF]/30 border border-[#845CFF]/50 text-xs font-mono text-[#F4F2F8] transition-all shadow-lg"
            >
              <AlertCircle className="w-3.5 h-3.5 text-[#24D8ED]" />
              <span>Allow Microphone Access to Mirror Voice Ingress</span>
            </button>
          </div>
        )}

        {isActive && micPermission === 'granted' && currentLevel === 0 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none">
            <span className="text-[9px] font-mono text-[#A4A3B2] tracking-wider bg-[#08090B]/90 px-2 py-0.5 rounded border border-[#292B3A] backdrop-blur-xs">
              Speak into microphone — visualizer mirrors acoustic waves in real time
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
