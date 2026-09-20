import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Sparkles,
  Maximize2,
  Minimize2,
  Volume2,
  Radio,
  Sliders,
  RotateCcw,
  Zap,
  Activity,
  Layers,
  Palette,
  Mic,
  MicOff,
  Eye,
  Info,
  X,
  Waves,
  Boxes,
} from 'lucide-react';
import { FluidMeshStyle } from '../types';

export type { FluidMeshStyle };
export type VisualizerMode = 'fluid-mesh' | 'plasma-orb' | 'cyber-rings';
export type VisualizerTheme = 'pyvex' | 'cyber' | 'solar' | 'cosmic';

interface ThemePalette {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
  wireframe: string;
  bgRgb: [number, number, number];
  primaryRgb: [number, number, number];
  secondaryRgb: [number, number, number];
  accentRgb: [number, number, number];
}

export const THEME_PALETTES: Record<VisualizerTheme, ThemePalette> = {
  pyvex: {
    name: 'Pyvex Electric',
    primary: '#7047FF',
    secondary: '#20E99A',
    accent: '#22D3EE',
    glow: 'rgba(112, 71, 255, 0.45)',
    wireframe: 'rgba(148, 105, 255, 0.55)',
    bgRgb: [11, 12, 16],
    primaryRgb: [112, 71, 255],
    secondaryRgb: [32, 233, 154],
    accentRgb: [34, 211, 238],
  },
  cyber: {
    name: 'Cyber Matrix',
    primary: '#10B981',
    secondary: '#06B6D4',
    accent: '#34D399',
    glow: 'rgba(16, 185, 129, 0.45)',
    wireframe: 'rgba(52, 211, 153, 0.55)',
    bgRgb: [6, 15, 12],
    primaryRgb: [16, 185, 129],
    secondaryRgb: [6, 182, 212],
    accentRgb: [52, 211, 153],
  },
  solar: {
    name: 'Solar Flare',
    primary: '#F59E0B',
    secondary: '#EF4444',
    accent: '#FBBF24',
    glow: 'rgba(245, 158, 11, 0.45)',
    wireframe: 'rgba(251, 191, 36, 0.6)',
    bgRgb: [18, 10, 6],
    primaryRgb: [245, 158, 11],
    secondaryRgb: [239, 68, 68],
    accentRgb: [251, 191, 36],
  },
  cosmic: {
    name: 'Deep Nebula',
    primary: '#8B5CF6',
    secondary: '#EC4899',
    accent: '#38BDF8',
    glow: 'rgba(139, 92, 246, 0.45)',
    wireframe: 'rgba(192, 132, 252, 0.55)',
    bgRgb: [12, 8, 20],
    primaryRgb: [139, 92, 246],
    secondaryRgb: [236, 72, 153],
    accentRgb: [56, 189, 248],
  },
};

interface FluidOrbMeshVisualizerProps {
  analyserNode?: AnalyserNode | null;
  micEnergy: number; // 0 - 100
  isVadSpeaking?: boolean;
  pipelineState: string; // 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' etc.
  interimTranscript?: string;
  isOverlay?: boolean;
  onCloseOverlay?: () => void;
  onToggleMic?: () => void;
  isMicActive?: boolean;
  className?: string;
  meshStyle?: FluidMeshStyle;
  onMeshStyleChange?: (style: FluidMeshStyle) => void;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  baseAlpha: number;
  colorIdx: number;
}

export const FluidOrbMeshVisualizer: React.FC<FluidOrbMeshVisualizerProps> = ({
  analyserNode,
  micEnergy,
  isVadSpeaking = false,
  pipelineState,
  interimTranscript = '',
  isOverlay = false,
  onCloseOverlay,
  onToggleMic,
  isMicActive = true,
  className = '',
  meshStyle,
  onMeshStyleChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Visualizer settings
  const [mode, setMode] = useState<VisualizerMode>('fluid-mesh');
  const [internalMeshStyle, setInternalMeshStyle] = useState<FluidMeshStyle>(meshStyle || 'flow');
  const activeMeshStyle = meshStyle ?? internalMeshStyle;

  const handleSelectStyle = (style: FluidMeshStyle) => {
    setInternalMeshStyle(style);
    onMeshStyleChange?.(style);
    if (mode !== 'fluid-mesh') {
      setMode('fluid-mesh');
    }
  };

  const [theme, setTheme] = useState<VisualizerTheme>('pyvex');
  const [sensitivity, setSensitivity] = useState<number>(1.4);
  const [meshDensity, setMeshDensity] = useState<'normal' | 'dense'>('normal');
  const [showHud, setShowHud] = useState<boolean>(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Metrics tracking
  const [dominantHz, setDominantHz] = useState<number>(0);
  const [estimatedDb, setEstimatedDb] = useState<number>(-60);

  // Rotation & Drag state
  const rotationRef = useRef({
    rx: 0.2,
    ry: 0.3,
    vx: 0.002,
    vy: 0.005,
    isDragging: false,
    lastX: 0,
    lastY: 0,
    touchDist: 0,
  });

  // Shockwave impulse on loud voice transient
  const shockwaveRef = useRef<{ radius: number; alpha: number; maxRadius: number } | null>(null);
  const prevEnergyRef = useRef<number>(0);

  // Particles cloud
  const particlesRef = useRef<Particle[]>([]);

  // Initialize particle cloud
  useEffect(() => {
    const pts: Particle[] = [];
    const count = 75;
    for (let i = 0; i < count; i++) {
      const radius = 120 + Math.random() * 100;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      pts.push({
        x: radius * Math.sin(phi) * Math.cos(theta),
        y: radius * Math.sin(phi) * Math.sin(theta),
        z: radius * Math.cos(phi),
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        vz: (Math.random() - 0.5) * 0.4,
        size: 1 + Math.random() * 2.2,
        baseAlpha: 0.2 + Math.random() * 0.6,
        colorIdx: Math.floor(Math.random() * 3),
      });
    }
    particlesRef.current = pts;
  }, []);

  // Main high-performance render loop
  useEffect(() => {
    let animId: number;
    let time = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Allocate buffer arrays for audio frequency & time-domain
    const freqData = new Uint8Array(128);
    const timeData = new Uint8Array(128);

    const render = () => {
      time += 0.016; // Approx 60fps delta
      const width = canvas.width;
      const height = canvas.height;
      if (width === 0 || height === 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // 1. Acquire audio data from analyser or fallback energy
      let avgBass = 0;
      let avgMids = 0;
      let avgTreble = 0;
      let maxPeak = 0;
      let maxPeakIdx = 0;

      if (analyserNode) {
        analyserNode.getByteFrequencyData(freqData);
        analyserNode.getByteTimeDomainData(timeData);

        // Lows (0 - 15), Mids (16 - 60), Treble (61 - 120)
        let bassSum = 0;
        let midSum = 0;
        let trebSum = 0;

        for (let i = 0; i < 15; i++) {
          bassSum += freqData[i];
          if (freqData[i] > maxPeak) {
            maxPeak = freqData[i];
            maxPeakIdx = i;
          }
        }
        for (let i = 15; i < 60; i++) {
          midSum += freqData[i];
          if (freqData[i] > maxPeak) {
            maxPeak = freqData[i];
            maxPeakIdx = i;
          }
        }
        for (let i = 60; i < 120; i++) {
          trebSum += freqData[i];
          if (freqData[i] > maxPeak) {
            maxPeak = freqData[i];
            maxPeakIdx = i;
          }
        }

        avgBass = (bassSum / 15 / 255) * sensitivity;
        avgMids = (midSum / 45 / 255) * sensitivity;
        avgTreble = (trebSum / 60 / 255) * sensitivity;
      } else {
        // Synthesize values from micEnergy
        const norm = (micEnergy / 100) * sensitivity;
        avgBass = norm * 0.9;
        avgMids = norm * 1.1;
        avgTreble = norm * 0.7;
      }

      // Estimate pitch and dB
      if (time % 0.1 < 0.02) {
        if (analyserNode && maxPeak > 20) {
          const nyquist = (analyserNode.context?.sampleRate || 16000) / 2;
          const estHz = Math.round((maxPeakIdx / 128) * (nyquist / 2));
          setDominantHz(estHz > 0 ? estHz : 140);
        } else {
          setDominantHz(isVadSpeaking ? 165 : 0);
        }
        const dbVal = -60 + Math.min(60, Math.round((avgMids + avgBass) * 45));
        setEstimatedDb(dbVal);
      }

      // Check audio transient for shockwave
      const currentEnergy = avgBass + avgMids;
      if (currentEnergy - prevEnergyRef.current > 0.35 && !shockwaveRef.current) {
        shockwaveRef.current = {
          radius: 60,
          alpha: 0.8,
          maxRadius: Math.min(width, height) * 0.45,
        };
      }
      prevEnergyRef.current = currentEnergy;

      // Update rotation with drag and inertia
      const rot = rotationRef.current;
      if (!rot.isDragging) {
        const speedMultiplier = pipelineState === 'THINKING' ? 3.0 : 1.0;
        rot.rx += rot.vx * speedMultiplier;
        rot.ry += rot.vy * speedMultiplier;
      }

      const activePal = THEME_PALETTES[theme];
      const cx = width / 2;
      const cy = height / 2;
      const baseRadius = Math.min(width, height) * 0.22;
      const dynamicRadius = baseRadius * (1 + (avgBass * 0.35 + (isVadSpeaking ? 0.12 : 0)));

      // 2. Render Ambient Background Aura Glow
      const auraGradient = ctx.createRadialGradient(
        cx,
        cy,
        baseRadius * 0.2,
        cx,
        cy,
        dynamicRadius * 2.2
      );
      const [pr, pg, pb] = activePal.primaryRgb;
      const [sr, sg, sb] = activePal.secondaryRgb;
      const [ar, ag, ab] = activePal.accentRgb;

      const auraIntensity = 0.15 + (avgMids + avgBass) * 0.45 + (pipelineState === 'SPEAKING' ? 0.3 : 0);
      auraGradient.addColorStop(0, `rgba(${pr}, ${pg}, ${pb}, ${Math.min(0.65, auraIntensity * 0.85)})`);
      auraGradient.addColorStop(0.5, `rgba(${sr}, ${sg}, ${sb}, ${Math.min(0.35, auraIntensity * 0.45)})`);
      auraGradient.addColorStop(1, `rgba(${activePal.bgRgb.join(',')}, 0)`);

      ctx.fillStyle = auraGradient;
      ctx.beginPath();
      ctx.arc(cx, cy, dynamicRadius * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // 3. Render Shockwave Ripple if triggered
      if (shockwaveRef.current) {
        const sw = shockwaveRef.current;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${sw.alpha})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();

        sw.radius += 4.5;
        sw.alpha -= 0.022;
        if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
          shockwaveRef.current = null;
        }
      }

      // 4. Render Mode Specific Geometry
      if (mode === 'fluid-mesh') {
        renderFluidMesh(
          ctx,
          cx,
          cy,
          dynamicRadius,
          time,
          rot.rx,
          rot.ry,
          avgBass,
          avgMids,
          avgTreble,
          activePal,
          meshDensity,
          isVadSpeaking,
          activeMeshStyle
        );
      } else if (mode === 'plasma-orb') {
        renderPlasmaOrb(
          ctx,
          cx,
          cy,
          dynamicRadius,
          time,
          avgBass,
          avgMids,
          avgTreble,
          activePal,
          isVadSpeaking,
          pipelineState
        );
      } else {
        renderCyberRings(
          ctx,
          cx,
          cy,
          dynamicRadius,
          time,
          rot.rx,
          rot.ry,
          avgBass,
          avgMids,
          avgTreble,
          activePal,
          freqData
        );
      }

      // 5. Render Particle Stardust Cloud
      renderParticles(ctx, cx, cy, dynamicRadius, time, activePal, avgMids, isVadSpeaking);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [mode, theme, sensitivity, meshDensity, analyserNode, micEnergy, isVadSpeaking, pipelineState, activeMeshStyle]);

  // Handle Canvas resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [isOverlay]);

  // Pointer & Touch interactions for 3D rotation
  const handlePointerDown = (e: React.PointerEvent) => {
    const rot = rotationRef.current;
    rot.isDragging = true;
    rot.lastX = e.clientX;
    rot.lastY = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const rot = rotationRef.current;
    if (!rot.isDragging) return;
    const dx = e.clientX - rot.lastX;
    const dy = e.clientY - rot.lastY;
    rot.ry += dx * 0.008;
    rot.rx -= dy * 0.008;
    rot.lastX = e.clientX;
    rot.lastY = e.clientY;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const rot = rotationRef.current;
    rot.isDragging = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  // Helper renderer: 3D Fluid Mesh Wireframe Geosphere
  const renderFluidMesh = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    time: number,
    rx: number,
    ry: number,
    bass: number,
    mids: number,
    treble: number,
    pal: ThemePalette,
    density: 'normal' | 'dense',
    speaking: boolean,
    style: FluidMeshStyle = 'flow'
  ) => {
    const latSteps = density === 'dense' ? 14 : 10;
    const lonSteps = density === 'dense' ? 24 : 18;
    const fov = 350;

    // 3D rotation matrix values
    const cosX = Math.cos(rx);
    const sinX = Math.sin(rx);
    const cosY = Math.cos(ry);
    const sinY = Math.sin(ry);

    const projectedGrid: Array<Array<{ x: number; y: number; z: number; r: number }>> = [];

    // Calculate displaced 3D spherical vertices based on selected visualization style
    for (let i = 0; i <= latSteps; i++) {
      const lat = (i / latSteps) * Math.PI - Math.PI / 2;
      const cosLat = Math.cos(lat);
      const sinLat = Math.sin(lat);
      const row: Array<{ x: number; y: number; z: number; r: number }> = [];

      for (let j = 0; j <= lonSteps; j++) {
        const lon = (j / lonSteps) * Math.PI * 2;
        const cosLon = Math.cos(lon);
        const sinLon = Math.sin(lon);

        let harmonic = 0;

        if (style === 'pulse') {
          // Pulse style: rhythmic acoustic shockwaves, radial beat bursts & high-contrast amplitude dilation
          const pulseBeat = Math.sin(time * 6.0) * 0.5 + 0.5;
          const radialBurst = Math.sin(lat * 8 + time * 3.8) * Math.cos(lon * 6 - time * 2.6);
          harmonic =
            radialBurst * (radius * 0.16 * (1 + bass * 2.4)) +
            pulseBeat * (radius * 0.1 * (0.4 + bass * 1.8)) +
            (speaking ? Math.sin(lon * 12 + time * 9.0) * (radius * 0.11) : 0);
        } else if (style === 'geometric') {
          // Geometric style: quantized polygonal stepping, faceted crystalline geodesic lattices
          const stepLat = Math.round(lat * 8) / 8;
          const stepLon = Math.round(lon * 8) / 8;
          const facetWave = Math.sin(stepLat * 5 + time * 1.6) * Math.cos(stepLon * 5);
          harmonic =
            facetWave * (radius * 0.14 * (1 + mids * 1.9)) +
            ((i + j) % 2 === 0 ? radius * 0.05 * (1 + treble * 0.8) : -radius * 0.04) +
            (speaking ? ((i * 2 + j) % 3 === 0 ? radius * 0.08 : 0) : 0);
        } else {
          // Flow style: organic fluid harmonics, continuous undulating ribbons
          harmonic =
            Math.sin(lat * 3 + time * 2.2) * Math.cos(lon * 4 - time * 1.8) * (radius * 0.12 * (1 + bass * 1.5)) +
            Math.sin(lat * 6 - lon * 5 + time * 3.5) * (radius * 0.06 * (1 + mids * 2.0)) +
            (speaking ? Math.sin(lon * 10 + time * 6.0) * (radius * 0.08) : 0);
        }

        const currentR = radius + harmonic;

        // Base 3D coordinates
        const x0 = currentR * cosLat * cosLon;
        const y0 = currentR * sinLat;
        const z0 = currentR * cosLat * sinLon;

        // Y-axis rotation
        const x1 = x0 * cosY + z0 * sinY;
        const y1 = y0;
        const z1 = -x0 * sinY + z0 * cosY;

        // X-axis rotation
        const x2 = x1;
        const y2 = y1 * cosX - z1 * sinX;
        const z2 = y1 * sinX + z1 * cosX;

        // Perspective projection
        const scale = fov / (fov + z2);
        const px = cx + x2 * scale;
        const py = cy + y2 * scale;

        row.push({ x: px, y: py, z: z2, r: currentR });
      }
      projectedGrid.push(row);
    }

    const [pr, pg, pb] = pal.primaryRgb;
    const [sr, sg, sb] = pal.secondaryRgb;
    const [ar, ag, ab] = pal.accentRgb;

    // In Pulse style: render expanding concentric acoustic shockwave rings
    if (style === 'pulse') {
      for (let rIdx = 0; rIdx < 3; rIdx++) {
        const ringProgress = (time * 0.85 + rIdx * 0.33) % 1;
        const ringRadius = radius * (0.8 + ringProgress * 1.25);
        const ringAlpha = Math.max(0, (1 - ringProgress) * (0.35 + bass * 0.5));
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${ringAlpha})`;
        ctx.lineWidth = 1.6 + (1 - ringProgress) * 2;
        ctx.stroke();
        ctx.restore();
      }
    }

    // Draw solid inner translucent sphere core
    const coreGrad = ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius * 0.95);
    coreGrad.addColorStop(0, `rgba(${sr}, ${sg}, ${sb}, ${style === 'pulse' ? 0.85 : 0.7})`);
    coreGrad.addColorStop(0.5, `rgba(${pr}, ${pg}, ${pb}, ${style === 'geometric' ? 0.45 : 0.35})`);
    coreGrad.addColorStop(1, `rgba(${pr}, ${pg}, ${pb}, 0.02)`);

    ctx.save();
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * (style === 'pulse' ? 0.92 : 0.88), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // In Geometric style: render diagonal cross-wires & geodesic triangular facet shading
    if (style === 'geometric') {
      for (let i = 0; i < latSteps; i++) {
        for (let j = 0; j < lonSteps; j++) {
          const pt1 = projectedGrid[i][j];
          const pt2 = projectedGrid[i + 1][j + 1];
          if (pt1.z > -40 && pt2.z > -40) {
            ctx.beginPath();
            ctx.moveTo(pt1.x, pt1.y);
            ctx.lineTo(pt2.x, pt2.y);
            ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${0.18 + treble * 0.35})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();

            // Subtle crystalline holographic facet fill for front-facing facets
            if (pt1.z > 15 && (i + j) % 2 === 0) {
              const pt3 = projectedGrid[i + 1][j];
              ctx.beginPath();
              ctx.moveTo(pt1.x, pt1.y);
              ctx.lineTo(pt2.x, pt2.y);
              ctx.lineTo(pt3.x, pt3.y);
              ctx.closePath();
              ctx.fillStyle = `rgba(${pr}, ${pg}, ${pb}, ${0.06 + mids * 0.12})`;
              ctx.fill();
            }
          }
        }
      }
    }

    // Render Latitude lines
    for (let i = 0; i <= latSteps; i++) {
      ctx.beginPath();
      for (let j = 0; j <= lonSteps; j++) {
        const pt = projectedGrid[i][j];
        if (j === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      const latRatio = i / latSteps;
      const alpha = 0.2 + 0.5 * Math.sin(latRatio * Math.PI) * (1 + mids * 0.5);
      ctx.strokeStyle = `rgba(${pr}, ${pg}, ${pb}, ${Math.min(0.9, alpha * (style === 'pulse' ? 1.25 : 1))})`;
      ctx.lineWidth = style === 'geometric' ? 1.2 : 1.1;
      ctx.stroke();
    }

    // Render Longitude lines & glowing vertex dots
    for (let j = 0; j <= lonSteps; j += 2) {
      ctx.beginPath();
      for (let i = 0; i <= latSteps; i++) {
        const pt = projectedGrid[i][j];
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = `rgba(${sr}, ${sg}, ${sb}, ${0.25 + bass * 0.4})`;
      ctx.lineWidth = style === 'pulse' ? 1.2 : 0.9;
      ctx.stroke();
    }

    // Draw glowing nodes on nearest hemisphere (z > -20)
    for (let i = 0; i <= latSteps; i += 2) {
      for (let j = 0; j <= lonSteps; j += 3) {
        const pt = projectedGrid[i][j];
        if (pt.z > -30) {
          const depthAlpha = Math.max(0.1, (pt.z + 100) / 200);

          if (style === 'geometric') {
            // Diamond nodes for geometric crystalline look
            const dSize = 2.0 + mids * 2.2;
            ctx.beginPath();
            ctx.moveTo(pt.x, pt.y - dSize);
            ctx.lineTo(pt.x + dSize, pt.y);
            ctx.lineTo(pt.x, pt.y + dSize);
            ctx.lineTo(pt.x - dSize, pt.y);
            ctx.closePath();
            ctx.fillStyle = `rgba(255, 255, 255, ${depthAlpha * (0.7 + treble * 0.3)})`;
            ctx.shadowColor = pal.accent;
            ctx.shadowBlur = 6 + treble * 10;
            ctx.fill();
            ctx.shadowBlur = 0;
          } else {
            // Circular nodes for flow & pulse
            ctx.beginPath();
            const nodeRadius = style === 'pulse' ? 2.0 + bass * 2.8 : 1.6 + mids * 2.2;
            ctx.arc(pt.x, pt.y, nodeRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${depthAlpha * (0.6 + treble * 0.4)})`;
            ctx.shadowColor = style === 'pulse' ? pal.accent : pal.primary;
            ctx.shadowBlur = (style === 'pulse' ? 10 : 6) + mids * 12;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      }
    }
  };

  // Helper renderer: Liquid Plasma Blob / Metaball Orb
  const renderPlasmaOrb = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    time: number,
    bass: number,
    mids: number,
    treble: number,
    pal: ThemePalette,
    speaking: boolean,
    state: string
  ) => {
    const pointsCount = 16;
    const coords: Array<{ x: number; y: number }> = [];

    for (let i = 0; i < pointsCount; i++) {
      const angle = (i / pointsCount) * Math.PI * 2;
      const noise =
        Math.sin(angle * 3 + time * 3) * (radius * 0.14 * (1 + bass * 1.8)) +
        Math.cos(angle * 5 - time * 2.5) * (radius * 0.08 * (1 + mids * 2.2)) +
        (speaking ? Math.sin(angle * 8 + time * 5) * (radius * 0.1) : 0);

      const r = radius + noise;
      coords.push({
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      });
    }

    // Draw Smooth Organic Bezier Blob
    ctx.save();
    ctx.beginPath();
    ctx.moveTo((coords[0].x + coords[pointsCount - 1].x) / 2, (coords[0].y + coords[pointsCount - 1].y) / 2);

    for (let i = 0; i < pointsCount; i++) {
      const nextIdx = (i + 1) % pointsCount;
      const midX = (coords[i].x + coords[nextIdx].x) / 2;
      const midY = (coords[i].y + coords[nextIdx].y) / 2;
      ctx.quadraticCurveTo(coords[i].x, coords[i].y, midX, midY);
    }
    ctx.closePath();

    // Shaded dynamic radial gradient
    const grad = ctx.createRadialGradient(
      cx - radius * 0.25,
      cy - radius * 0.25,
      radius * 0.1,
      cx,
      cy,
      radius * 1.15
    );
    const [pr, pg, pb] = pal.primaryRgb;
    const [sr, sg, sb] = pal.secondaryRgb;
    const [ar, ag, ab] = pal.accentRgb;

    grad.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, 0.9)`);
    grad.addColorStop(0.35, `rgba(${sr}, ${sg}, ${sb}, 0.75)`);
    grad.addColorStop(0.75, `rgba(${pr}, ${pg}, ${pb}, 0.6)`);
    grad.addColorStop(1, `rgba(${pr}, ${pg}, ${pb}, 0.15)`);

    ctx.fillStyle = grad;
    ctx.shadowColor = pal.accent;
    ctx.shadowBlur = 24 + bass * 35;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Glowing outline
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 + treble * 0.5})`;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Inner chromatic rings
    ctx.beginPath();
    ctx.arc(cx - radius * 0.15, cy - radius * 0.15, radius * 0.45 * (1 + mids * 0.2), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + treble * 0.35})`;
    ctx.fill();

    ctx.restore();
  };

  // Helper renderer: Gyroscopic Concentric Cyber Rings
  const renderCyberRings = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    time: number,
    rx: number,
    ry: number,
    bass: number,
    mids: number,
    treble: number,
    pal: ThemePalette,
    freqData: Uint8Array
  ) => {
    const ringCount = 5;
    const [pr, pg, pb] = pal.primaryRgb;
    const [sr, sg, sb] = pal.secondaryRgb;

    ctx.save();
    for (let r = 0; r < ringCount; r++) {
      const ringR = radius * (0.4 + r * 0.22);
      const angleOffset = time * (0.8 + r * 0.3) * (r % 2 === 0 ? 1 : -1);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angleOffset + ry);
      ctx.scale(1, 0.45 + r * 0.12);

      // Draw dashed frequency modulated ring
      ctx.beginPath();
      const segments = 48;
      for (let s = 0; s <= segments; s++) {
        const theta = (s / segments) * Math.PI * 2;
        const freqIdx = Math.floor((s / segments) * 64);
        const freqVal = freqData[freqIdx] || 0;
        const bump = (freqVal / 255) * (radius * 0.25);
        const rad = ringR + bump;

        const x = rad * Math.cos(theta);
        const y = rad * Math.sin(theta);
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      ctx.strokeStyle =
        r % 2 === 0
          ? `rgba(${pr}, ${pg}, ${pb}, ${0.4 + bass * 0.5})`
          : `rgba(${sr}, ${sg}, ${sb}, ${0.45 + mids * 0.5})`;
      ctx.lineWidth = 1.5 + (r === 2 ? mids * 2 : 0);
      ctx.stroke();

      ctx.restore();
    }

    // Central pulsing nucleus
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.28 * (1 + bass * 0.4), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${sr}, ${sg}, ${sb}, 0.8)`;
    ctx.shadowColor = pal.secondary;
    ctx.shadowBlur = 18 + mids * 20;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
  };

  // Helper renderer: 3D Particulate Stardust Cloud
  const renderParticles = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    time: number,
    pal: ThemePalette,
    mids: number,
    speaking: boolean
  ) => {
    const pts = particlesRef.current;
    const fov = 350;
    const colorMap = [pal.primaryRgb, pal.secondaryRgb, pal.accentRgb];

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];

      // Swirl velocity
      p.x += p.vx + (speaking ? (Math.random() - 0.5) * 1.5 : 0);
      p.y += p.vy;
      p.z += p.vz;

      // Wrap-around boundary
      const dist = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
      if (dist > radius * 1.9 || dist < radius * 0.4) {
        p.vx *= -1;
        p.vy *= -1;
        p.vz *= -1;
      }

      const scale = fov / (fov + p.z);
      const px = cx + p.x * scale;
      const py = cy + p.y * scale;

      const rgb = colorMap[p.colorIdx];
      const alpha = Math.max(0.05, p.baseAlpha * (0.6 + mids * 1.2) * (scale * 0.8));

      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.6, p.size * scale * (1 + mids * 0.6)), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${Math.min(0.9, alpha)})`;
      ctx.fill();
    }
  };

  // State color helper
  const getStateBadge = () => {
    switch (pipelineState) {
      case 'LISTENING':
        return {
          label: isVadSpeaking ? 'VOICE INGRESS ACTIVE' : 'LISTENING FOR SPEECH',
          color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          dot: 'bg-emerald-400 animate-ping',
        };
      case 'THINKING':
        return {
          label: 'LLM REASONING & INFERENCE',
          color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          dot: 'bg-amber-400 animate-pulse',
        };
      case 'SPEAKING':
        return {
          label: 'SYNTHESIS PLAYBACK ACTIVE',
          color: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
          dot: 'bg-purple-400 animate-pulse',
        };
      default:
        return {
          label: 'STANDBY / IDLE RESONANCE',
          color: 'bg-white/10 text-white/60 border-white/15',
          dot: 'bg-white/40',
        };
    }
  };

  const badge = getStateBadge();

  return (
    <div
      ref={containerRef}
      className={`relative select-none overflow-hidden transition-all duration-300 ${
        isOverlay
          ? 'fixed inset-0 z-50 flex flex-col bg-[#08090B]/90 backdrop-blur-2xl'
          : `rounded-2xl border border-white/[0.08] bg-black/40 backdrop-blur-md ${className}`
      }`}
    >
      {/* Visualizer Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none block"
      />

      {/* Top HUD: Status Badge & Floating Controls */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div
            className={`px-3 py-1 rounded-full text-[11px] font-mono tracking-wider uppercase border flex items-center gap-2 backdrop-blur-md shadow-lg ${badge.color}`}
          >
            <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
            <span>{badge.label}</span>
          </div>

          {/* VAD Energy Level Bar */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 border border-white/10 text-[10px] font-mono text-white/70 backdrop-blur-md">
            <Volume2 className="w-3 h-3 text-[#20E99A]" />
            <span className="w-12 h-1.5 rounded-full bg-white/10 overflow-hidden inline-block">
              <span
                className="h-full bg-gradient-to-r from-[#20E99A] via-[#7047FF] to-[#EC4899] block transition-all duration-75"
                style={{ width: `${Math.min(100, micEnergy)}%` }}
              />
            </span>
            <span>{micEnergy}%</span>
          </div>
        </div>

        {/* Quick Tools & Mode Selectors */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Fluid Mesh Overlay Style Toggles */}
          <div className="flex items-center p-0.5 rounded-xl bg-black/60 border border-white/10 backdrop-blur-md shadow-sm">
            <span className="hidden xl:inline px-2 text-[9px] font-mono text-white/40 uppercase tracking-wider">
              Style:
            </span>
            <button
              id="fluid-mesh-toggle-pulse"
              type="button"
              onClick={() => handleSelectStyle('pulse')}
              className={`px-2 py-1 rounded-lg text-[10px] font-mono flex items-center gap-1 transition-all cursor-pointer ${
                activeMeshStyle === 'pulse' && mode === 'fluid-mesh'
                  ? 'bg-[#7047FF] text-white font-semibold shadow-sm'
                  : 'text-white/50 hover:text-white'
              }`}
              title="Pulse Style: Acoustic shockwave pulse rings & rhythmic dilation"
            >
              <Radio className="w-3 h-3 text-[#20E99A]" />
              <span>Pulse</span>
            </button>
            <button
              id="fluid-mesh-toggle-flow"
              type="button"
              onClick={() => handleSelectStyle('flow')}
              className={`px-2 py-1 rounded-lg text-[10px] font-mono flex items-center gap-1 transition-all cursor-pointer ${
                activeMeshStyle === 'flow' && mode === 'fluid-mesh'
                  ? 'bg-[#7047FF] text-white font-semibold shadow-sm'
                  : 'text-white/50 hover:text-white'
              }`}
              title="Flow Style: Organic liquid fluid waves & continuous harmonic ripples"
            >
              <Waves className="w-3 h-3 text-[#22D3EE]" />
              <span>Flow</span>
            </button>
            <button
              id="fluid-mesh-toggle-geometric"
              type="button"
              onClick={() => handleSelectStyle('geometric')}
              className={`px-2 py-1 rounded-lg text-[10px] font-mono flex items-center gap-1 transition-all cursor-pointer ${
                activeMeshStyle === 'geometric' && mode === 'fluid-mesh'
                  ? 'bg-[#7047FF] text-white font-semibold shadow-sm'
                  : 'text-white/50 hover:text-white'
              }`}
              title="Geometric Style: Geodesic triangulated polyhedron & faceted lattice"
            >
              <Boxes className="w-3 h-3 text-[#FBBF24]" />
              <span>Geometric</span>
            </button>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex items-center p-0.5 rounded-xl bg-black/60 border border-white/10 backdrop-blur-md">
            <button
              onClick={() => setMode('fluid-mesh')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all ${
                mode === 'fluid-mesh'
                  ? 'bg-[#7047FF] text-white font-semibold shadow-sm'
                  : 'text-white/50 hover:text-white'
              }`}
              title="3D Fluid Mesh Wireframe"
            >
              3D Mesh
            </button>
            <button
              onClick={() => setMode('plasma-orb')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all ${
                mode === 'plasma-orb'
                  ? 'bg-[#7047FF] text-white font-semibold shadow-sm'
                  : 'text-white/50 hover:text-white'
              }`}
              title="Organic Liquid Plasma Orb"
            >
              Plasma
            </button>
            <button
              onClick={() => setMode('cyber-rings')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all ${
                mode === 'cyber-rings'
                  ? 'bg-[#7047FF] text-white font-semibold shadow-sm'
                  : 'text-white/50 hover:text-white'
              }`}
              title="Gyroscopic Harmonic Rings"
            >
              Rings
            </button>
          </div>

          {/* Toggle Calibration Settings Menu */}
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`p-2 rounded-xl border backdrop-blur-md transition-all ${
              isSettingsOpen
                ? 'bg-[#7047FF]/30 border-[#7047FF] text-white'
                : 'bg-black/60 border-white/10 text-white/70 hover:text-white hover:border-white/20'
            }`}
            title="Visualizer Calibration Settings"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>

          {/* Close Overlay button if in overlay mode */}
          {isOverlay && onCloseOverlay && (
            <button
              onClick={onCloseOverlay}
              className="p-2 rounded-xl bg-black/60 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors backdrop-blur-md"
              title="Close Visualizer Overlay"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Floating Settings Drawer */}
      {isSettingsOpen && (
        <div className="absolute top-16 right-4 z-30 w-72 p-4 rounded-2xl bg-[#0F1015]/95 border border-white/15 shadow-2xl backdrop-blur-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-mono font-medium text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#20E99A]" />
              Orb Calibration
            </span>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="text-white/40 hover:text-white text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mesh Visualization Style */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-white/50 flex items-center gap-1">
              <Activity className="w-3 h-3 text-[#7047FF]" />
              Mesh Visualization Style
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['pulse', 'flow', 'geometric'] as FluidMeshStyle[]).map((st) => (
                <button
                  key={st}
                  id={`drawer-style-${st}`}
                  onClick={() => handleSelectStyle(st)}
                  className={`px-2 py-1.5 rounded-lg text-center text-[10px] font-mono capitalize transition-all border cursor-pointer ${
                    activeMeshStyle === st && mode === 'fluid-mesh'
                      ? 'border-[#7047FF] bg-[#7047FF]/25 text-white font-semibold'
                      : 'border-white/5 bg-white/[0.02] text-white/50 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Visual Theme */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-white/50 flex items-center gap-1">
              <Palette className="w-3 h-3 text-[#7047FF]" />
              Color Palette
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(THEME_PALETTES) as VisualizerTheme[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`px-2.5 py-1.5 rounded-lg text-left text-[11px] font-mono transition-all border ${
                    theme === t
                      ? 'border-[#7047FF] bg-[#7047FF]/20 text-white font-medium'
                      : 'border-white/5 bg-white/[0.02] text-white/50 hover:text-white'
                  }`}
                >
                  {THEME_PALETTES[t].name}
                </button>
              ))}
            </div>
          </div>

          {/* Reactivity Sensitivity Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono text-white/50">
              <span>Acoustic Sensitivity</span>
              <span className="text-[#20E99A] font-semibold">{sensitivity.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.6"
              max="2.5"
              step="0.1"
              value={sensitivity}
              onChange={(e) => setSensitivity(parseFloat(e.target.value))}
              className="w-full accent-[#7047FF] h-1 bg-white/10 rounded-lg cursor-pointer"
            />
          </div>

          {/* Mesh Density */}
          {mode === 'fluid-mesh' && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-white/50 flex items-center gap-1">
                <Layers className="w-3 h-3 text-[#22D3EE]" />
                Polygon Geometry Density
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setMeshDensity('normal')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all ${
                    meshDensity === 'normal'
                      ? 'border-[#22D3EE] bg-[#22D3EE]/20 text-white'
                      : 'border-white/5 text-white/50 hover:text-white'
                  }`}
                >
                  Balanced (10x18)
                </button>
                <button
                  onClick={() => setMeshDensity('dense')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all ${
                    meshDensity === 'dense'
                      ? 'border-[#22D3EE] bg-[#22D3EE]/20 text-white'
                      : 'border-white/5 text-white/50 hover:text-white'
                  }`}
                >
                  Dense (14x24)
                </button>
              </div>
            </div>
          )}

          {/* Reset Orbit Button */}
          <button
            onClick={() => {
              rotationRef.current.rx = 0.2;
              rotationRef.current.ry = 0.3;
            }}
            className="w-full py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[10px] font-mono text-white/60 hover:text-white flex items-center justify-center gap-1.5 transition-colors border border-white/5"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset 3D Orbit Angles</span>
          </button>
        </div>
      )}

      {/* Floating Live Speech Transcript Caption Bar */}
      {interimTranscript && (
        <div className="absolute bottom-20 left-6 right-6 z-20 flex justify-center pointer-events-none">
          <div className="max-w-2xl px-5 py-2.5 rounded-2xl bg-black/75 border border-[#20E99A]/40 text-emerald-300 text-sm font-sans tracking-wide backdrop-blur-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
            <Radio className="w-4 h-4 text-[#20E99A] animate-pulse shrink-0" />
            <span className="italic font-medium">"{interimTranscript}"</span>
          </div>
        </div>
      )}

      {/* Bottom Telemetry HUD & Interaction Footer */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Interactive Gestures Tip */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 border border-white/10 text-[10px] font-mono text-white/50 backdrop-blur-md">
            <Info className="w-3 h-3 text-[#7047FF]" />
            <span>Click & Drag to Rotate 3D Orb in Space</span>
          </div>

          {/* Audio Telemetry Pill */}
          <div className="flex items-center gap-3 px-3 py-1 rounded-full bg-black/60 border border-white/10 text-[10px] font-mono text-white/70 backdrop-blur-md">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-[#20E99A]" />
              {dominantHz > 0 ? `${dominantHz} Hz` : '0 Hz'}
            </span>
            <span className="text-white/20">•</span>
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-[#22D3EE]" />
              {estimatedDb} dB
            </span>
          </div>
        </div>

        {/* Action Controls for Overlay Mode */}
        {isOverlay && onToggleMic && (
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={onToggleMic}
              className={`px-4 py-2 rounded-full text-xs font-mono font-semibold flex items-center gap-2 transition-all shadow-lg ${
                isMicActive
                  ? 'bg-rose-500/90 hover:bg-rose-600 text-white'
                  : 'bg-[#20E99A] hover:bg-[#1cd38a] text-black'
              }`}
            >
              {isMicActive ? (
                <>
                  <MicOff className="w-3.5 h-3.5" />
                  <span>Mute Microphone</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  <span>Start Voice Ingress</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
export default FluidOrbMeshVisualizer;
