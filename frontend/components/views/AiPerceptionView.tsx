import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  Cell 
} from 'recharts';
import { 
  Eye, 
  Layers, 
  Sliders, 
  Scan, 
  AlertTriangle, 
  Car, 
  User, 
  CircleDot, 
  Sun, 
  Moon, 
  Zap,
  CheckCircle,
  Video,
  ShieldAlert,
  Compass
} from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import { RoadVehicleDetector } from '../ai-perception/RoadVehicleDetector';
import type { VisionTabItem, VisionTabType } from '../ai-perception/types';

const VISION_TABS: VisionTabItem[] = [
  { id: 'road_vision', label: 'Road, Vehicle & Hazard Vision', hint: 'Green lines · YOLO · Live' },
  { id: 'adas_safety', label: 'Blind Spots & Forward Collision', hint: 'FCW · BSD · Corner' },
  { id: 'road_conditions', label: 'Unstructured Road & Potholes', hint: 'Terrain & Surface' },
  { id: 'stability_analytics', label: 'Model Stability (D3.js)', hint: '30-frame window' }
];

export const AiPerceptionView: React.FC = () => {
  const { 
    detectedObjects, 
    inferenceLatency, 
    cameraFps, 
    speed, 
    steerAngle, 
    fogLevel, 
    rainLevel, 
    fogDensityPct, 
    nightMode, 
    agsActive,
    daylightMode,
    toggleNightMode 
  } = useTelemetry();

  // Overlay toggles
  const [showPedestrians, setShowPedestrians] = useState<boolean>(true);
  const [showVehicles, setShowVehicles] = useState<boolean>(true);
  const [showPotholes, setShowPotholes] = useState<boolean>(true);
  const [showLaneProjections, setShowLaneProjections] = useState<boolean>(true);
  const [showDistanceTags, setShowDistanceTags] = useState<boolean>(true);
  const [cameraFilter, setCameraFilter] = useState<'STANDARD' | 'NIGHT_IR' | 'ANTI_GLARE' | 'EDGE_DEPTH'>('STANDARD');
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(75);
  const [visionTab, setVisionTab] = useState<VisionTabType>('road_vision');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const animStateRef = useRef({
    detectedObjects, 
    speed, 
    steerAngle, 
    fogLevel, 
    rainLevel, 
    fogDensityPct, 
    nightMode, 
    daylightMode,
    cameraFilter, 
    agsActive,
    showPedestrians, 
    showVehicles, 
    showPotholes, 
    showLaneProjections, 
    showDistanceTags,
    confidenceThreshold
  });

  useEffect(() => {
    animStateRef.current = {
      detectedObjects, 
      speed, 
      steerAngle, 
      fogLevel, 
      rainLevel, 
      fogDensityPct, 
      nightMode, 
      daylightMode,
      cameraFilter, 
      agsActive,
      showPedestrians, 
      showVehicles, 
      showPotholes, 
      showLaneProjections, 
      showDistanceTags,
      confidenceThreshold
    };
  });

  // Animated perspective road canvas rendering loop running at continuous 60 FPS
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let offset = 0;

    const render = () => {
      const {
        detectedObjects, 
        speed, 
        steerAngle, 
        fogLevel, 
        rainLevel, 
        fogDensityPct, 
        nightMode, 
        daylightMode,
        cameraFilter, 
        agsActive,
        showPedestrians, 
        showVehicles, 
        showPotholes, 
        showLaneProjections, 
        showDistanceTags,
        confidenceThreshold
      } = animStateRef.current;

      const w = canvas.width;
      const h = canvas.height;

      // 1. Sky & Ground Canvas Background
      const isNight = nightMode || cameraFilter === 'NIGHT_IR';
      
      // Sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
      if (cameraFilter === 'NIGHT_IR') {
        skyGrad.addColorStop(0, '#040d12');
        skyGrad.addColorStop(1, '#051820');
      } else if (isNight) {
        skyGrad.addColorStop(0, '#020409');
        skyGrad.addColorStop(1, '#080d1a');
      } else if (daylightMode) {
        skyGrad.addColorStop(0, '#bae6fd');
        skyGrad.addColorStop(1, '#e0f2fe');
      } else {
        skyGrad.addColorStop(0, '#0f172a');
        skyGrad.addColorStop(1, '#1e293b');
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h * 0.5);

      // Distant horizon skyline
      ctx.fillStyle = isNight ? '#0b1120' : daylightMode ? '#94a3b8' : '#1e293b';
      for (let i = 0; i < 14; i++) {
        const bh = 15 + ((i * 19) % 35);
        ctx.fillRect(i * (w / 14), h * 0.5 - bh, (w / 14) - 2, bh);
      }

      // Ground (Road terrain)
      const roadGrad = ctx.createLinearGradient(0, h * 0.5, 0, h);
      if (daylightMode) {
        roadGrad.addColorStop(0, '#475569');
        roadGrad.addColorStop(1, '#1e293b');
      } else {
        roadGrad.addColorStop(0, '#090e17');
        roadGrad.addColorStop(1, '#05070c');
      }
      ctx.fillStyle = roadGrad;
      ctx.fillRect(0, h * 0.5, w, h * 0.5);

      // Horizon line
      ctx.strokeStyle = daylightMode ? 'rgba(2, 132, 199, 0.5)' : 'rgba(6, 182, 212, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.5);
      ctx.lineTo(w, h * 0.5);
      ctx.stroke();

      // 2. Road Surface & Lane Projections
      const horizonY = h * 0.5;
      const roadTopW = w * 0.22;
      const roadBottomW = w * 0.88;
      const roadCenterX = w * 0.5 + (steerAngle * -1.5);

      // Road Polygon
      ctx.fillStyle = daylightMode ? '#334155' : '#0e1626';
      ctx.beginPath();
      ctx.moveTo(roadCenterX - roadTopW / 2, horizonY);
      ctx.lineTo(roadCenterX + roadTopW / 2, horizonY);
      ctx.lineTo(w * 0.5 + roadBottomW / 2, h);
      ctx.lineTo(w * 0.5 - roadBottomW / 2, h);
      ctx.closePath();
      ctx.fill();

      // Drivable Lane Projections (Glowing cyan vectors)
      if (showLaneProjections) {
        const laneColor = daylightMode ? '#0284C7' : '#00F0FF';
        ctx.shadowColor = laneColor;
        ctx.shadowBlur = daylightMode ? 4 : 10;
        ctx.strokeStyle = laneColor;
        ctx.lineWidth = 3;

        // Left Boundary
        ctx.beginPath();
        ctx.moveTo(roadCenterX - roadTopW / 2, horizonY);
        ctx.lineTo(w * 0.5 - roadBottomW / 2, h);
        ctx.stroke();

        // Right Boundary
        ctx.beginPath();
        ctx.moveTo(roadCenterX + roadTopW / 2, horizonY);
        ctx.lineTo(w * 0.5 + roadBottomW / 2, h);
        ctx.stroke();

        // Center Animated Dashed Line
        offset = (offset + (speed * 0.08) + 1) % 40;
        ctx.shadowBlur = 4;
        ctx.strokeStyle = daylightMode ? '#0369A1' : '#38bdf8';
        ctx.lineWidth = 2;
        ctx.setLineDash([15, 25]);
        ctx.lineDashOffset = -offset;
        ctx.beginPath();
        ctx.moveTo(roadCenterX, horizonY);
        ctx.lineTo(w * 0.5, h);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
      }

      // 3. Pothole / Surface Anomaly Highlight Polygon
      if (showPotholes) {
        const potholeObj = detectedObjects.find(o => o.type === 'POTHOLE');
        if (potholeObj && potholeObj.confidence >= confidenceThreshold) {
          const phX = w * 0.44;
          const phY = h * 0.72;
          ctx.strokeStyle = '#FF0055';
          ctx.fillStyle = 'rgba(255, 0, 85, 0.25)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(phX, phY, 48, 18, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Pothole Label Tag
          ctx.fillStyle = 'rgba(255, 0, 85, 0.9)';
          ctx.fillRect(phX - 60, phY - 32, 120, 16);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`POTHOLE // ${potholeObj.confidence}%`, phX, phY - 21);
          if (showDistanceTags) {
            ctx.fillText(`${potholeObj.distance}m`, phX, phY - 9);
          }
        }
      }

      // 4. Vehicle Bounding Box & Target Model
      if (showVehicles) {
        const vehicleObj = detectedObjects.find(o => o.type === 'VEHICLE');
        if (vehicleObj && vehicleObj.confidence >= confidenceThreshold) {
          const vx = w * 0.52;
          const vy = h * 0.52;
          const vw = 110;
          const vh = 80;

          // Cyan Target Bounding Box with Corner Reticles
          ctx.strokeStyle = '#00F0FF';
          ctx.lineWidth = 2;
          ctx.strokeRect(vx - vw / 2, vy - vh / 2, vw, vh);

          // Corner markers
          const cSize = 10;
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 3;
          // Top Left
          ctx.beginPath();
          ctx.moveTo(vx - vw / 2, vy - vh / 2 + cSize);
          ctx.lineTo(vx - vw / 2, vy - vh / 2);
          ctx.lineTo(vx - vw / 2 + cSize, vy - vh / 2);
          ctx.stroke();
          // Top Right
          ctx.beginPath();
          ctx.moveTo(vx + vw / 2 - cSize, vy - vh / 2);
          ctx.lineTo(vx + vw / 2, vy - vh / 2);
          ctx.lineTo(vx + vw / 2, vy - vh / 2 + cSize);
          ctx.stroke();
          // Bottom Left
          ctx.beginPath();
          ctx.moveTo(vx - vw / 2, vy + vh / 2 - cSize);
          ctx.lineTo(vx - vw / 2, vy + vh / 2);
          ctx.lineTo(vx - vw / 2 + cSize, vy + vh / 2);
          ctx.stroke();
          // Bottom Right
          ctx.beginPath();
          ctx.moveTo(vx + vw / 2 - cSize, vy + vh / 2);
          ctx.lineTo(vx + vw / 2, vy + vh / 2);
          ctx.lineTo(vx + vw / 2, vy + vh / 2 - cSize);
          ctx.stroke();

          // Vehicle silhouette inside box
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(vx - vw * 0.4, vy - vh * 0.2, vw * 0.8, vh * 0.55);
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(vx - vw * 0.3, vy - vh * 0.4, vw * 0.6, vh * 0.25);
          // Taillights
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(vx - vw * 0.38, vy + vh * 0.05, 14, 6);
          ctx.fillRect(vx + vw * 0.38 - 14, vy + vh * 0.05, 14, 6);

          // Bounding Box Header Pill
          ctx.fillStyle = 'rgba(0, 240, 255, 0.9)';
          ctx.fillRect(vx - vw / 2, vy - vh / 2 - 18, vw, 18);
          ctx.fillStyle = '#04070D';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`VEHICLE · ${vehicleObj.confidence}%`, vx, vy - vh / 2 - 5);

          // Distance / Velocity Tag
          if (showDistanceTags) {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.fillRect(vx - vw / 2, vy + vh / 2 + 4, vw, 16);
            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 9px monospace';
            ctx.fillText(`R: ${vehicleObj.distance}m | ${vehicleObj.velocity || 40}km/h`, vx, vy + vh / 2 + 16);
          }
        }
      }

      // 5. Pedestrian Bounding Box
      if (showPedestrians) {
        const pedObj = detectedObjects.find(o => o.type === 'PEDESTRIAN');
        if (pedObj && pedObj.confidence >= confidenceThreshold) {
          const px = w * 0.26;
          const py = h * 0.58;
          const pw = 42;
          const ph = 95;

          // Yellow Bounding Box
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 2;
          ctx.strokeRect(px - pw / 2, py - ph / 2, pw, ph);

          // Pedestrian Silhouette
          ctx.fillStyle = '#f59e0b';
          // Head
          ctx.beginPath();
          ctx.arc(px, py - ph * 0.35, 7, 0, Math.PI * 2);
          ctx.fill();
          // Torso
          ctx.fillRect(px - 6, py - ph * 0.24, 12, 34);
          // Legs
          ctx.fillRect(px - 5, py + 10, 4, 30);
          ctx.fillRect(px + 1, py + 10, 4, 30);

          // Header Pill
          ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
          ctx.fillRect(px - 45, py - ph / 2 - 18, 90, 18);
          ctx.fillStyle = '#04070D';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`PEDESTRIAN ${pedObj.confidence}%`, px, py - ph / 2 - 6);

          if (showDistanceTags) {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.fillRect(px - 30, py + ph / 2 + 4, 60, 15);
            ctx.fillStyle = '#fbbf24';
            ctx.fillText(`DIST: ${pedObj.distance}m`, px, py + ph / 2 + 15);
          }
        }
      }

      // 6. Weather Fog / Rain Atmospheric Overlay
      if (fogLevel > 0) {
        ctx.fillStyle = `rgba(148, 163, 184, ${fogLevel * 0.12})`;
        ctx.fillRect(0, 0, w, h);
      }

      if (rainLevel > 0) {
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.35)';
        ctx.lineWidth = 1;
        const dropCount = rainLevel * 30;
        for (let r = 0; r < dropCount; r++) {
          const rx = (Math.sin(r * 99 + offset) * 0.5 + 0.5) * w;
          const ry = ((r * 23 + offset * 8) % h);
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx - 3, ry + 12);
          ctx.stroke();
        }
      }

      // 7. Anti-Glare Filter Overlay
      if (cameraFilter === 'ANTI_GLARE' || agsActive) {
        ctx.fillStyle = 'rgba(6, 182, 212, 0.14)';
        ctx.fillRect(0, 0, w, h);
        // Vignette dimming
        const radGrad = ctx.createRadialGradient(w/2, h/2, 80, w/2, h/2, w*0.6);
        radGrad.addColorStop(0, 'rgba(0,0,0,0)');
        radGrad.addColorStop(1, 'rgba(0,0,0,0.6)');
        ctx.fillStyle = radGrad;
        ctx.fillRect(0, 0, w, h);
      }

      // 8. Low Visibility / Fog Alert Banner
      if (fogLevel > 1) {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
        ctx.fillRect(w * 0.2, 20, w * 0.6, 26);
        ctx.fillStyle = '#04070D';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`[LOW VISIBILITY / FOG - ${fogDensityPct}% DENSITY DETECTED]`, w * 0.5, 37);
      }

      // 9. Camera HUD Crosshair & Calibration Marks
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.lineWidth = 1;
      // Center crosshair
      ctx.beginPath();
      ctx.moveTo(w * 0.5 - 15, h * 0.5);
      ctx.lineTo(w * 0.5 + 15, h * 0.5);
      ctx.moveTo(w * 0.5, h * 0.5 - 15);
      ctx.lineTo(w * 0.5, h * 0.5 + 15);
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  const tooltipStyle = {
    backgroundColor: daylightMode ? '#ffffff' : '#090D16',
    border: daylightMode ? '1px solid #0284C7' : '1px solid #00F0FF',
    color: daylightMode ? '#0f172a' : '#f8fafc',
    fontSize: '11px',
    fontFamily: 'monospace',
    boxShadow: daylightMode ? '0 4px 12px rgba(0,0,0,0.1)' : '0 0 10px rgba(0,240,255,0.2)'
  };
  const gridStroke = daylightMode ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';

  // Confidence distribution data for bar chart
  const confidenceData = [
    { class: 'Vehicles', score: 98, fill: daylightMode ? '#0284C7' : '#00F0FF' },
    { class: 'Pedestrians', score: 96, fill: '#F59E0B' },
    { class: 'Potholes', score: 89, fill: '#FF0055' },
    { class: 'Lane Marks', score: 94, fill: daylightMode ? '#0369A1' : '#38BDF8' },
    { class: 'Traffic Signs', score: 91, fill: '#A855F7' },
  ];

  // Frame processing time vs target count
  const perfData = [
    { targets: 1, timeMs: 11.2 },
    { targets: 2, timeMs: 12.8 },
    { targets: 3, timeMs: 14.2 },
    { targets: 4, timeMs: 15.6 },
    { targets: 5, timeMs: 17.1 },
    { targets: 6, timeMs: 18.9 },
  ];

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto animate-fadeIn">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sky-500/20 dark:border-cyan-500/20">
        <div>
          <h1 className="text-lg font-mono font-bold tracking-wider text-sky-700 dark:text-cyan-400 flex items-center gap-2">
            <Eye className="w-5 h-5 text-sky-600 dark:text-cyan-400" />
            03. AI PERCEPTION & ROAD HAZARD VISION
          </h1>
          <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
            Real-time Computer Vision Inference Engine · TensorRT FP16 On Raspberry Pi 5 ISP
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <button
            onClick={() => setCameraFilter('STANDARD')}
            className={`px-2.5 py-1 rounded border transition-colors ${
              cameraFilter === 'STANDARD' 
                ? 'bg-sky-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold border-sky-600 dark:border-cyan-400' 
                : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            RGB NORMAL
          </button>
          <button
            onClick={() => setCameraFilter('NIGHT_IR')}
            className={`px-2.5 py-1 rounded border transition-colors ${
              cameraFilter === 'NIGHT_IR' 
                ? 'bg-sky-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold border-sky-600 dark:border-cyan-400' 
                : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            NIGHT IR
          </button>
          <button
            onClick={() => setCameraFilter('ANTI_GLARE')}
            className={`px-2.5 py-1 rounded border transition-colors ${
              cameraFilter === 'ANTI_GLARE' 
                ? 'bg-sky-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold border-sky-600 dark:border-cyan-400' 
                : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            ANTI-GLARE
          </button>
        </div>
      </div>

      {/* Main Split: HUD Video Feed Viewport (Left 8 cols) + Perception Control Sidebar (Right 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: HUD Canvas Viewport */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          <div className="relative w-full h-[480px] rounded-xl overflow-hidden glass-panel border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.12)]">
            {/* Viewport Top Bar */}
            <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-[#04070D]/90 to-transparent flex items-center justify-between text-xs font-mono z-10">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 font-bold">
                  <Scan className="w-3.5 h-3.5 text-cyan-400" />
                  FORWARD HUD VIEWPORT
                </span>
                <span className="text-[11px] text-emerald-400">{cameraFps} FPS</span>
              </div>

              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-slate-300">LATENCY: <strong className="text-cyan-300">{inferenceLatency}ms</strong></span>
                <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-bold">
                  YOLOv8-NANO RT
                </span>
              </div>
            </div>

            {/* The Simulation Canvas */}
            <canvas 
              ref={canvasRef} 
              width={760} 
              height={480} 
              className="w-full h-full object-cover"
            />

            {/* Viewport Bottom Overlay Metrics */}
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-[#04070D]/90 to-transparent flex items-center justify-between text-xs font-mono z-10">
              <div className="flex items-center gap-3">
                <span className="text-slate-400">
                  CONFIDENCE CUTOFF: <strong className="text-white">{confidenceThreshold}%</strong>
                </span>
                <span className="text-slate-400">
                  TRACKED OBJECTS: <strong className="text-cyan-400">{detectedObjects.length}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  agsActive ? 'bg-blue-950/80 text-blue-300 border border-blue-400' : 'text-slate-400'
                }`}>
                  AGS SHIELD: {agsActive ? 'ENGAGED' : 'CLEAR'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Overlay Layer Switches */}
          <div className="glass-panel p-3 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <span className="text-slate-600 dark:text-slate-400 font-bold">DETECTION OVERLAYS:</span>
            
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white">
              <input 
                type="checkbox" 
                checked={showVehicles} 
                onChange={(e) => setShowVehicles(e.target.checked)}
                className="rounded accent-sky-600 dark:accent-cyan-400"
              />
              <span className="text-sky-700 dark:text-cyan-300 font-semibold">[VEHICLES]</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white">
              <input 
                type="checkbox" 
                checked={showPedestrians} 
                onChange={(e) => setShowPedestrians(e.target.checked)}
                className="rounded accent-amber-500"
              />
              <span className="text-amber-600 dark:text-amber-300 font-semibold">[PEDESTRIANS]</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white">
              <input 
                type="checkbox" 
                checked={showPotholes} 
                onChange={(e) => setShowPotholes(e.target.checked)}
                className="rounded accent-rose-500"
              />
              <span className="text-rose-600 dark:text-rose-300 font-semibold">[POTHOLES]</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white">
              <input 
                type="checkbox" 
                checked={showLaneProjections} 
                onChange={(e) => setShowLaneProjections(e.target.checked)}
                className="rounded accent-sky-600 dark:accent-sky-400"
              />
              <span className="text-sky-700 dark:text-sky-300 font-semibold">[LANES]</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white">
              <input 
                type="checkbox" 
                checked={showDistanceTags} 
                onChange={(e) => setShowDistanceTags(e.target.checked)}
                className="rounded accent-sky-600 dark:accent-cyan-400"
              />
              <span>[DISTANCES]</span>
            </label>
          </div>
        </div>

        {/* Right: Perception Control Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          {/* Object Counts Widget */}
          <div className="glass-panel p-4 rounded-xl">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-700 dark:text-cyan-400 mb-3 flex items-center gap-2">
              <Scan className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
              LIVE DETECTED OBJECT MATRIX
            </h2>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px]">
                  <span>VEHICLES</span>
                  <Car className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400" />
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {detectedObjects.filter(o => o.type === 'VEHICLE').length}
                </div>
                <div className="text-[10px] text-sky-700 dark:text-cyan-400 font-semibold">98% CONFIDENCE</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px]">
                  <span>PEDESTRIANS</span>
                  <User className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {detectedObjects.filter(o => o.type === 'PEDESTRIAN').length}
                </div>
                <div className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">96% CONFIDENCE</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px]">
                  <span>POTHOLES / HAZARDS</span>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {detectedObjects.filter(o => o.type === 'POTHOLE').length}
                </div>
                <div className="text-[10px] text-rose-700 dark:text-rose-400 font-semibold">89% CONFIDENCE</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px]">
                  <span>TRAFFIC SIGNS</span>
                  <CircleDot className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">2</div>
                <div className="text-[10px] text-blue-700 dark:text-blue-400 font-semibold">SPEED LIMIT 50</div>
              </div>
            </div>

            {/* Threshold Slider */}
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="flex justify-between text-xs font-mono text-slate-700 dark:text-slate-300 mb-1">
                <span>CONFIDENCE THRESHOLD</span>
                <span className="font-bold text-sky-700 dark:text-cyan-300">{confidenceThreshold}%</span>
              </div>
              <input 
                type="range" 
                min="50" 
                max="95" 
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(parseInt(e.target.value, 10))}
                className="w-full accent-sky-600 dark:accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Model Inference Latency Monitor */}
          <div className="glass-panel p-4 rounded-xl text-xs font-mono">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sky-700 dark:text-cyan-400">INFERENCE LATENCY MONITOR</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">SAFETY COMPLIANT</span>
            </div>

            <div className="flex items-baseline gap-2 my-1">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">{inferenceLatency}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">MS / FRAME</span>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
              Pi 5 TensorRT neural engine processing target tracking at &lt;30ms automotive safety threshold.
            </p>

            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${(inferenceLatency / 30) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>0ms</span>
              <span>15ms</span>
              <span>30ms SAFETY LIMIT</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detection Analytics Graphs (Recharts) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Graph 1: Object Detection Confidence Distribution (Bar Chart) */}
        <div className="glass-panel p-4 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-700 dark:text-cyan-400">
                OBJECT DETECTION CONFIDENCE DISTRIBUTION
              </h2>
              <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                Model confidence scores across detected automotive classes
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">AVG: 93.6%</span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={confidenceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke={gridStroke} />
                <XAxis dataKey="class" stroke="#64748b" fontSize={10} fontFamily="monospace" />
                <YAxis domain={[50, 100]} stroke="#64748b" fontSize={10} fontFamily="monospace" />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="score" radius={[4, 4, 0, 0]} name="Confidence %">
                  {confidenceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 2: Frame Processing Time vs Target Count (Line Chart) */}
        <div className="glass-panel p-4 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-700 dark:text-cyan-400">
                FRAME PROCESSING TIME VS TARGET COUNT
              </h2>
              <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                Scaling compute overhead per simultaneous tracked bounding box
              </p>
            </div>
            <span className="text-xs font-mono text-sky-700 dark:text-cyan-300 font-bold">FP16 ENGINE</span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={perfData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke={gridStroke} />
                <XAxis dataKey="targets" stroke="#64748b" fontSize={10} fontFamily="monospace" label={{ value: 'Target Count', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#64748b' }} />
                <YAxis domain={[8, 25]} stroke="#64748b" fontSize={10} fontFamily="monospace" />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="timeMs" stroke={daylightMode ? '#0284C7' : '#00F0FF'} strokeWidth={2} dot={{ fill: daylightMode ? '#0284C7' : '#00F0FF', r: 4 }} name="Time (ms)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Road, Vehicle & Hazard Vision — video detection engine */}
      <div className="rounded-2xl border border-sky-500/25 dark:border-cyan-500/25 bg-white/70 dark:bg-[#04070D] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 dark:bg-cyan-500/10 border border-sky-500/25 dark:border-cyan-500/25 text-sky-600 dark:text-cyan-400 flex items-center justify-center">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-700 dark:text-cyan-400">
                Road, Vehicle &amp; Hazard Vision Engine
              </h2>
              <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                Video-based perception lab · optical flow, NMS tracking, blind-spot and forward-collision analytics
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto px-2 py-0.5 rounded border border-sky-500/30 dark:border-cyan-500/30 bg-sky-500/10 dark:bg-cyan-500/10 text-[10px] font-mono font-bold text-sky-700 dark:text-cyan-300">
            NMS · TRACKING · D3
          </span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {VISION_TABS.map((tab) => {
            const isActive = visionTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setVisionTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-mono whitespace-nowrap transition-colors border ${
                  isActive
                    ? 'bg-sky-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold border-sky-600 dark:border-cyan-400'
                    : 'bg-slate-100 dark:bg-slate-900/70 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`hidden lg:inline text-[9px] ${isActive ? 'opacity-80' : 'opacity-60'}`}>
                  {tab.hint}
                </span>
              </button>
            );
          })}
        </div>

        {/* The vision console is intentionally dark, like a camera feed wall. */}
        <div className="rounded-2xl bg-[#04070D] border border-slate-800 p-3 sm:p-4">
          <RoadVehicleDetector activeTab={visionTab} setActiveTab={setVisionTab} />
        </div>
      </div>
    </div>
  );
};
