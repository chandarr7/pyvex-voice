import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Waves,
  Sparkles,
  Zap,
  RotateCcw,
  Volume2,
  Mic,
  Activity,
  Layers,
} from 'lucide-react';
import { getAudioAnalyser } from '../utils/audioEngine';

export type PlasmaWaveStyle = 'waves' | 'plasma-mesh' | 'vortex-waves';

interface Plasma3DWaveVisualizerProps {
  simState: 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING';
  latencyMs?: number;
  onInterrupt?: () => void;
  className?: string;
}

export const Plasma3DWaveVisualizer: React.FC<Plasma3DWaveVisualizerProps> = ({
  simState,
  latencyMs = 210,
  onInterrupt,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Interactive 3D Orbit Angles
  const [rotX, setRotX] = useState<number>(0.45); // Pitch
  const [rotY, setRotY] = useState<number>(-0.35); // Yaw
  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Visualizer style mode
  const [waveStyle, setWaveStyle] = useState<PlasmaWaveStyle>('waves');
  const [showWireframe, setShowWireframe] = useState<boolean>(true);

  // Audio energy tracking
  const audioEnergyRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  // Color schemes based on simState
  const getColorScheme = useCallback(() => {
    switch (simState) {
      case 'SPEAKING':
        return {
          primary: '#A855F7',
          secondary: '#7047FF',
          accent: '#24D8ED',
          glow: 'rgba(168, 85, 247, 0.45)',
          core: [168, 85, 247],
          rgbPrimary: [168, 85, 247],
          rgbSecondary: [112, 71, 255],
          rgbAccent: [36, 216, 237],
        };
      case 'LISTENING':
        return {
          primary: '#20E99A',
          secondary: '#10B981',
          accent: '#06B6D4',
          glow: 'rgba(32, 233, 154, 0.45)',
          core: [32, 233, 154],
          rgbPrimary: [32, 233, 154],
          rgbSecondary: [16, 185, 129],
          rgbAccent: [6, 182, 212],
        };
      case 'THINKING':
        return {
          primary: '#C084FC',
          secondary: '#E879F9',
          accent: '#818CF8',
          glow: 'rgba(192, 132, 252, 0.45)',
          core: [192, 132, 252],
          rgbPrimary: [192, 132, 252],
          rgbSecondary: [232, 121, 249],
          rgbAccent: [129, 140, 248],
        };
      case 'IDLE':
      default:
        return {
          primary: '#7047FF',
          secondary: '#6366F1',
          accent: '#20E99A',
          glow: 'rgba(112, 71, 255, 0.25)',
          core: [112, 71, 255],
          rgbPrimary: [112, 71, 255],
          rgbSecondary: [99, 102, 241],
          rgbAccent: [32, 233, 154],
        };
    }
  }, [simState]);

  // Handle Drag Orbit Rotation
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    setRotY((prev) => prev + dx * 0.008);
    setRotX((prev) => Math.max(-1.1, Math.min(1.1, prev + dy * 0.008)));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleResetView = () => {
    setRotX(0.45);
    setRotY(-0.35);
  };

  // Main 3D Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;

    const handleResize = () => {
      const parent = containerRef.current;
      if (!parent || !canvas) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.floor(rect.width);
      height = Math.max(180, Math.floor(rect.height));

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    const ro = new ResizeObserver(() => handleResize());
    if (containerRef.current) ro.observe(containerRef.current);

    // 3D Plasma Wave Grid Parameters
    const GRID_X = 28;
    const GRID_Z = 24;
    const SPACING_X = 14;
    const SPACING_Z = 14;

    // Floating Plasma Dust Sparks
    const particles = Array.from({ length: 32 }, () => ({
      x: (Math.random() - 0.5) * 320,
      y: (Math.random() - 0.5) * 80,
      z: (Math.random() - 0.5) * 280,
      size: Math.random() * 2 + 1,
      speed: Math.random() * 0.02 + 0.01,
      angle: Math.random() * Math.PI * 2,
    }));

    let localRotY = rotY;
    let localRotX = rotX;

    const render = () => {
      timeRef.current += simState === 'SPEAKING' ? 0.045 : simState === 'THINKING' ? 0.06 : simState === 'LISTENING' ? 0.035 : 0.02;
      const t = timeRef.current;

      // Smooth camera interpolation towards target rot
      localRotY += (rotY - localRotY) * 0.1;
      localRotX += (rotX - localRotX) * 0.1;

      // Extract real audio frequency if analyser is active
      let instantaneousEnergy = 0;
      try {
        const { analyserNode, dataArray } = getAudioAnalyser();
        if (analyserNode && dataArray) {
          (analyserNode as any).getByteFrequencyData?.(dataArray);
          let sum = 0;
          for (let i = 0; i < Math.min(dataArray.length, 64); i++) {
            sum += dataArray[i];
          }
          instantaneousEnergy = (sum / 64) / 255;
        }
      } catch {}

      // Fallback synthetic energy when speaking/listening
      if (simState === 'SPEAKING') {
        const synth = 0.4 + 0.5 * Math.abs(Math.sin(t * 3.5) * Math.cos(t * 2.2));
        audioEnergyRef.current += (Math.max(instantaneousEnergy, synth) - audioEnergyRef.current) * 0.25;
      } else if (simState === 'LISTENING') {
        const synth = 0.25 + 0.3 * Math.abs(Math.sin(t * 2.8));
        audioEnergyRef.current += (Math.max(instantaneousEnergy, synth) - audioEnergyRef.current) * 0.2;
      } else if (simState === 'THINKING') {
        audioEnergyRef.current += (0.35 - audioEnergyRef.current) * 0.15;
      } else {
        audioEnergyRef.current += (0.1 - audioEnergyRef.current) * 0.1;
      }

      const energy = audioEnergyRef.current;
      const theme = getColorScheme();

      // Clear Canvas with subtle atmospheric gradient
      ctx.clearRect(0, 0, width, height);

      // Deep dark backdrop with radial plasma glow
      const radialGlow = ctx.createRadialGradient(
        width / 2,
        height / 2 + 10,
        10,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.65
      );
      radialGlow.addColorStop(0, `rgba(${theme.core[0]}, ${theme.core[1]}, ${theme.core[2]}, ${0.12 + energy * 0.15})`);
      radialGlow.addColorStop(0.5, 'rgba(8, 9, 11, 0.4)');
      radialGlow.addColorStop(1, 'rgba(8, 9, 11, 0.95)');
      ctx.fillStyle = radialGlow;
      ctx.fillRect(0, 0, width, height);

      // 3D Projection Helpers
      const cosY = Math.cos(localRotY);
      const sinY = Math.sin(localRotY);
      const cosX = Math.cos(localRotX);
      const sinX = Math.sin(localRotX);

      const fov = 380;
      const cameraZ = 460;
      const centerX = width / 2;
      const centerY = height / 2 + 8;

      const project = (x3: number, y3: number, z3: number) => {
        // Rotate Y (Yaw)
        const xRotY = x3 * cosY + z3 * sinY;
        const zRotY = -x3 * sinY + z3 * cosY;

        // Rotate X (Pitch)
        const yRotX = y3 * cosX - zRotY * sinX;
        const zRotX = y3 * sinX + zRotY * cosX;

        const depth = zRotX + cameraZ;
        if (depth <= 10) return null;

        const scale = fov / depth;
        return {
          x: centerX + xRotY * scale,
          y: centerY + yRotX * scale,
          scale,
          depth,
          rawY: y3,
        };
      };

      // 1. Calculate 3D Plasma Height Field
      const grid3D: Array<Array<{ x: number; y: number; z: number }>> = [];
      const halfW = ((GRID_X - 1) * SPACING_X) / 2;
      const halfD = ((GRID_Z - 1) * SPACING_Z) / 2;

      for (let ix = 0; ix < GRID_X; ix++) {
        const row: Array<{ x: number; y: number; z: number }> = [];
        const xPos = ix * SPACING_X - halfW;

        for (let iz = 0; iz < GRID_Z; iz++) {
          const zPos = iz * SPACING_Z - halfD;

          // Multi-frequency 3D Plasma wave formula
          const distFromCenter = Math.sqrt(xPos * xPos + zPos * zPos);
          const normDist = distFromCenter / Math.max(halfW, halfD);

          const w1 = Math.sin(xPos * 0.035 + t * 2.2);
          const w2 = Math.cos(zPos * 0.032 - t * 1.8);
          const w3 = Math.sin((xPos + zPos) * 0.025 + t * 1.4);
          const ripple = Math.sin(distFromCenter * 0.055 - t * 3.5);

          // Vortex modulation if in vortex-waves mode or thinking
          let vortexMod = 0;
          if (waveStyle === 'vortex-waves' || simState === 'THINKING') {
            const angle = Math.atan2(zPos, xPos);
            vortexMod = Math.sin(angle * 3 + t * 3) * 16 * (1 - Math.min(normDist, 1));
          }

          const amp = (18 + energy * 42);
          const yPos = (w1 * 0.4 + w2 * 0.35 + w3 * 0.25 + ripple * 0.45) * amp + vortexMod;

          row.push({ x: xPos, y: yPos, z: zPos });
        }
        grid3D.push(row);
      }

      // 2. Render 3D Plasma Waves
      if (waveStyle === 'waves' || waveStyle === 'vortex-waves') {
        // Continuous multi-harmonic 3D wave ribbons
        const ribbonCount = 7;
        for (let r = 0; r < ribbonCount; r++) {
          const zIndex = Math.floor((r / (ribbonCount - 1)) * (GRID_Z - 1));
          ctx.beginPath();
          let started = false;

          for (let ix = 0; ix < GRID_X; ix++) {
            const pt = grid3D[ix][zIndex];
            const p = project(pt.x, pt.y, pt.z);
            if (!p) continue;

            if (!started) {
              ctx.moveTo(p.x, p.y);
              started = true;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          }

          // Shimmering chromatic gradient for ribbons
          const grad = ctx.createLinearGradient(centerX - 120, 0, centerX + 120, 0);
          const depthAlpha = Math.max(0.2, Math.min(0.95, 1 - (zIndex / GRID_Z) * 0.6));
          grad.addColorStop(0, `rgba(${theme.rgbPrimary.join(',')}, ${depthAlpha * (0.4 + energy * 0.5)})`);
          grad.addColorStop(0.5, `rgba(${theme.rgbAccent.join(',')}, ${depthAlpha * (0.8 + energy * 0.2)})`);
          grad.addColorStop(1, `rgba(${theme.rgbSecondary.join(',')}, ${depthAlpha * (0.5 + energy * 0.4)})`);

          ctx.strokeStyle = grad;
          ctx.lineWidth = r === Math.floor(ribbonCount / 2) ? 2.5 : 1.5;
          ctx.stroke();

          // Render cross-ribbon wave glow
          if (r === Math.floor(ribbonCount / 2)) {
            ctx.shadowColor = theme.primary;
            ctx.shadowBlur = 12 * (energy + 0.3);
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
        }

        // Longitudinal wave strands for 3D depth volume
        for (let ix = 0; ix < GRID_X; ix += 3) {
          ctx.beginPath();
          let started = false;
          for (let iz = 0; iz < GRID_Z; iz++) {
            const pt = grid3D[ix][iz];
            const p = project(pt.x, pt.y, pt.z);
            if (!p) continue;
            if (!started) {
              ctx.moveTo(p.x, p.y);
              started = true;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          }
          ctx.strokeStyle = `rgba(${theme.rgbPrimary.join(',')}, ${0.12 + energy * 0.2})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // 3. Render 3D Plasma Mesh Grid Wireframe
      if (waveStyle === 'plasma-mesh' || showWireframe) {
        ctx.strokeStyle = `rgba(${theme.rgbPrimary.join(',')}, ${waveStyle === 'plasma-mesh' ? 0.45 : 0.18})`;
        ctx.lineWidth = 1;

        // Draw longitudinal and lateral mesh
        for (let ix = 0; ix < GRID_X; ix += (waveStyle === 'plasma-mesh' ? 1 : 2)) {
          ctx.beginPath();
          let started = false;
          for (let iz = 0; iz < GRID_Z; iz++) {
            const pt = grid3D[ix][iz];
            const p = project(pt.x, pt.y, pt.z);
            if (!p) continue;
            if (!started) {
              ctx.moveTo(p.x, p.y);
              started = true;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          }
          ctx.stroke();
        }

        for (let iz = 0; iz < GRID_Z; iz += (waveStyle === 'plasma-mesh' ? 1 : 2)) {
          ctx.beginPath();
          let started = false;
          for (let ix = 0; ix < GRID_X; ix++) {
            const pt = grid3D[ix][iz];
            const p = project(pt.x, pt.y, pt.z);
            if (!p) continue;
            if (!started) {
              ctx.moveTo(p.x, p.y);
              started = true;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          }
          ctx.stroke();
        }
      }

      // 4. Glowing Crest Nodes on Peak Plasma Waves
      for (let ix = 2; ix < GRID_X - 2; ix += 3) {
        for (let iz = 2; iz < GRID_Z - 2; iz += 3) {
          const pt = grid3D[ix][iz];
          if (pt.y > 6 + energy * 10) {
            const p = project(pt.x, pt.y, pt.z);
            if (!p) continue;
            const nodeRadius = Math.max(1, (1.8 + energy * 2.2) * p.scale);

            ctx.beginPath();
            ctx.arc(p.x, p.y, nodeRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${0.6 + energy * 0.4})`;
            ctx.shadowColor = theme.accent;
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      }

      // 5. Orbiting Quantum Plasma Sparks
      particles.forEach((sp, idx) => {
        sp.angle += sp.speed * (1 + energy * 2);
        const radius = 90 + Math.sin(t + idx) * 35;
        const curX = Math.cos(sp.angle) * radius;
        const curZ = Math.sin(sp.angle) * radius;
        const curY = sp.y + Math.sin(t * 3 + idx) * 14 * (energy + 0.5);

        const p = project(curX, curY, curZ);
        if (!p) return;

        const pAlpha = Math.max(0.15, Math.min(0.95, 0.4 + energy * 0.6));
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, sp.size * p.scale * (1 + energy)), 0, Math.PI * 2);
        ctx.fillStyle = idx % 2 === 0 ? `rgba(${theme.rgbAccent.join(',')}, ${pAlpha})` : `rgba(${theme.rgbPrimary.join(',')}, ${pAlpha})`;
        ctx.shadowColor = theme.accent;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // 6. Central Resonant Core Pulse
      const coreP = project(0, 0, 0);
      if (coreP) {
        const coreRadius = Math.max(8, (14 + energy * 26) * coreP.scale);
        const coreGrad = ctx.createRadialGradient(coreP.x, coreP.y, 2, coreP.x, coreP.y, coreRadius);
        coreGrad.addColorStop(0, `rgba(255, 255, 255, ${0.7 + energy * 0.3})`);
        coreGrad.addColorStop(0.35, `rgba(${theme.rgbAccent.join(',')}, ${0.5 + energy * 0.4})`);
        coreGrad.addColorStop(0.8, `rgba(${theme.rgbPrimary.join(',')}, ${0.15})`);
        coreGrad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(coreP.x, coreP.y, coreRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      ro.disconnect();
    };
  }, [rotX, rotY, waveStyle, showWireframe, simState, getColorScheme]);

  return (
    <div
      ref={containerRef}
      id="plasma-3d-waves-card"
      className={`p-4 rounded-2xl flex flex-col justify-between gap-3 relative overflow-hidden select-none ${className}`}
      style={{
        background: '#08090B',
        border: '1px solid #292B3A',
        minHeight: '260px',
      }}
    >
      {/* Top Header: Agent Status + Interactive 3D Indicator */}
      <div className="flex items-center justify-between w-full text-[11px] font-mono z-10">
        <div className="flex items-center gap-2">
          <span className="text-[#666879] uppercase tracking-wider font-semibold">3D Plasma Waves</span>
          <span className="text-[10px] text-[#A4A3B2]/60 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 hidden sm:inline">
            Drag to Rotate
          </span>
        </div>

        {/* Dynamic Status Badge */}
        <span
          className="px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
          style={{
            backgroundColor:
              simState === 'SPEAKING'
                ? 'rgba(168, 85, 247, 0.2)'
                : simState === 'THINKING'
                ? 'rgba(192, 132, 252, 0.2)'
                : simState === 'LISTENING'
                ? 'rgba(32, 233, 154, 0.2)'
                : 'rgba(102, 104, 121, 0.2)',
            color:
              simState === 'SPEAKING'
                ? '#A855F7'
                : simState === 'THINKING'
                ? '#C084FC'
                : simState === 'LISTENING'
                ? '#20E99A'
                : '#A4A3B2',
          }}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              simState === 'IDLE' ? 'bg-[#666879]' : 'animate-ping'
            }`}
            style={{
              backgroundColor:
                simState === 'SPEAKING'
                  ? '#A855F7'
                  : simState === 'THINKING'
                  ? '#C084FC'
                  : simState === 'LISTENING'
                  ? '#20E99A'
                  : '#666879',
            }}
          />
          <span>{simState}</span>
        </span>
      </div>

      {/* Main 3D Canvas Layer */}
      <div className="relative w-full flex-1 flex items-center justify-center min-h-[160px] cursor-grab active:cursor-grabbing">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-full block rounded-xl touch-none"
          title="Click and drag to rotate the 3D Plasma Field"
        />

        {/* Center state icon subtle overlay */}
        <div className="absolute pointer-events-none flex flex-col items-center justify-center opacity-80">
          {simState === 'SPEAKING' && (
            <div className="p-2 rounded-full bg-purple-900/30 border border-purple-400/30 backdrop-blur-xs animate-pulse">
              <Volume2 className="w-5 h-5 text-purple-200" />
            </div>
          )}
          {simState === 'LISTENING' && (
            <div className="p-2 rounded-full bg-emerald-900/30 border border-emerald-400/30 backdrop-blur-xs animate-pulse">
              <Mic className="w-5 h-5 text-emerald-200" />
            </div>
          )}
          {simState === 'THINKING' && (
            <div className="p-2 rounded-full bg-fuchsia-900/30 border border-fuchsia-400/30 backdrop-blur-xs animate-spin">
              <Sparkles className="w-5 h-5 text-fuchsia-200" />
            </div>
          )}
        </div>

        {/* Floating Reset View Button */}
        <button
          type="button"
          onClick={handleResetView}
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-[#0F1117]/80 hover:bg-[#1A1D27] text-[#666879] hover:text-[#F4F2F8] border border-[#292B3A] transition-colors"
          title="Reset 3D Camera Orbit"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Wave Style Switcher & Mesh Toggle */}
      <div className="flex items-center justify-between gap-1 w-full z-10 pt-1">
        <div className="flex items-center gap-1 bg-[#12141A] p-0.5 rounded-lg border border-[#222433]">
          <button
            type="button"
            onClick={() => setWaveStyle('waves')}
            className={`px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1 transition-colors ${
              waveStyle === 'waves'
                ? 'bg-[#7047FF] text-white font-semibold'
                : 'text-[#8E90A6] hover:text-[#F4F2F8]'
            }`}
          >
            <Waves className="w-3 h-3" />
            <span>Waves</span>
          </button>
          <button
            type="button"
            onClick={() => setWaveStyle('plasma-mesh')}
            className={`px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1 transition-colors ${
              waveStyle === 'plasma-mesh'
                ? 'bg-[#7047FF] text-white font-semibold'
                : 'text-[#8E90A6] hover:text-[#F4F2F8]'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Plasma Mesh</span>
          </button>
          <button
            type="button"
            onClick={() => setWaveStyle('vortex-waves')}
            className={`px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1 transition-colors ${
              waveStyle === 'vortex-waves'
                ? 'bg-[#7047FF] text-white font-semibold'
                : 'text-[#8E90A6] hover:text-[#F4F2F8]'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>Vortex</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowWireframe((prev) => !prev)}
          className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors ${
            showWireframe
              ? 'bg-[#20E99A]/10 border-[#20E99A]/30 text-[#20E99A]'
              : 'bg-white/5 border-white/10 text-[#666879] hover:text-[#A4A3B2]'
          }`}
          title="Toggle 3D wireframe lattice"
        >
          Grid {showWireframe ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Status metrics footer */}
      <div className="flex items-center justify-between w-full pt-2 border-t border-[#1C1D25] text-[10px] font-mono text-[#666879] z-10">
        <span className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-[#20E99A]" />
          <span>TTS Latency: {latencyMs}ms</span>
        </span>

        {simState === 'SPEAKING' && onInterrupt && (
          <button
            type="button"
            onClick={onInterrupt}
            className="flex items-center gap-1 text-[#F43F5E] hover:text-[#FB7185] transition-colors"
          >
            <Activity className="w-3 h-3 fill-current animate-pulse" />
            <span>Interrupt Agent</span>
          </button>
        )}
      </div>
    </div>
  );
};
