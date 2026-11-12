import React, { useState } from 'react';
import { useTelemetry } from '../../context/TelemetryContext';
import { ThreatLevel } from '../../types/telemetry';

export const RadarSurroundingsViewport: React.FC = () => {
  const { 
    lidarDistance, 
    steerAngle, 
    speed, 
    proximityZones, 
    detectedObjects, 
    aebActive,
    fogLevel,
    rainLevel,
    daylightMode
  } = useTelemetry();

  const [selectedObstacle, setSelectedObstacle] = useState<{
    id: string;
    label: string;
    dist: number;
    speed: number;
    threat: ThreatLevel;
    angle: number;
  } | null>(null);

  // Derive directional threat levels
  const frontLiDAR = proximityZones.find(z => z.direction === 'Front Center');
  const sideLeft = proximityZones.find(z => z.direction === 'Side Left');
  const sideRight = proximityZones.find(z => z.direction === 'Side Right');
  const rearCenter = proximityZones.find(z => z.direction === 'Rear Center');

  const getThreatColor = (level?: ThreatLevel) => {
    switch (level) {
      case 'CRITICAL': return '#FF0055';
      case 'WARNING': return '#FF6B00';
      case 'CAUTION': return '#F59E0B';
      case 'SAFE': return daylightMode ? '#0284C7' : '#10B981';
      default: return daylightMode ? '#0066CC' : '#00F0FF';
    }
  };

  const getThreatFill = (level?: ThreatLevel) => {
    switch (level) {
      case 'CRITICAL': return 'rgba(255, 0, 85, 0.35)';
      case 'WARNING': return 'rgba(255, 107, 0, 0.25)';
      case 'CAUTION': return 'rgba(245, 158, 11, 0.2)';
      case 'SAFE': return daylightMode ? 'rgba(2, 132, 199, 0.2)' : 'rgba(16, 185, 129, 0.15)';
      default: return daylightMode ? 'rgba(0, 102, 204, 0.15)' : 'rgba(0, 240, 255, 0.12)';
    }
  };

  const frontColor = getThreatColor(frontLiDAR?.threatLevel);
  const frontFill = getThreatFill(frontLiDAR?.threatLevel);
  const leftColor = getThreatColor(sideLeft?.threatLevel);
  const rightColor = getThreatColor(sideRight?.threatLevel);
  const rearColor = getThreatColor(rearCenter?.threatLevel);

  return (
    <div className="relative w-full h-[460px] rounded-xl bg-white dark:bg-[#060912]/90 border border-slate-300 dark:border-cyan-500/25 p-4 flex flex-col justify-between overflow-hidden shadow-md dark:shadow-[inset_0_0_30px_rgba(6,182,212,0.06)] transition-colors">
      {/* Viewport Top Legend */}
      <div className="flex items-center justify-between text-xs font-mono z-10">
        <div className="flex items-center gap-2">
          <span className="text-blue-700 dark:text-cyan-400 font-bold uppercase tracking-wider">
            360° SPATIAL PROXIMITY RADAR
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-cyan-950/60 border border-blue-200 dark:border-cyan-500/30 text-blue-800 dark:text-cyan-300">
            RANGE: 5.0m
          </span>
        </div>

        <div className="flex items-center gap-4 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400" /> CLEAR / SAFE
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> CAUTION
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500" /> WARNING
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> CRITICAL
          </span>
        </div>
      </div>

      {/* Main Radar SVG Canvas */}
      <div className="relative flex-1 flex items-center justify-center my-2">
        <svg 
          viewBox="-220 -220 440 440" 
          className="w-full h-full max-h-[380px] max-w-[420px] overflow-visible"
        >
          <defs>
            {/* Radar sweep gradient */}
            <linearGradient id="radarSweepGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(0, 240, 255, 0)" />
              <stop offset="85%" stopColor="rgba(0, 240, 255, 0.08)" />
              <stop offset="100%" stopColor="rgba(0, 240, 255, 0.35)" />
            </linearGradient>

            {/* Glowing filter */}
            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Range Rings: 0.5m, 1.0m, 2.0m, 5.0m */}
          {/* 5.0m Ring (R = 190) */}
          <circle cx="0" cy="0" r="190" fill="none" stroke="rgba(6, 182, 212, 0.18)" strokeWidth="1" strokeDasharray="3 3" />
          <text x="5" y="-192" fill="#64748b" fontSize="8" fontFamily="monospace">5.0m</text>

          {/* 2.0m Ring (R = 125) */}
          <circle cx="0" cy="0" r="125" fill="none" stroke="rgba(6, 182, 212, 0.22)" strokeWidth="1" />
          <text x="5" y="-127" fill="#64748b" fontSize="8" fontFamily="monospace">2.0m</text>

          {/* 1.0m Ring (R = 75) */}
          <circle cx="0" cy="0" r="75" fill="none" stroke="rgba(245, 158, 11, 0.25)" strokeWidth="1" strokeDasharray="2 2" />
          <text x="5" y="-77" fill="#f59e0b" fontSize="8" fontFamily="monospace">1.0m</text>

          {/* 0.5m Critical Buffer Ring (R = 45) */}
          <circle cx="0" cy="0" r="45" fill="none" stroke="rgba(255, 0, 85, 0.35)" strokeWidth="1.2" />
          <text x="5" y="-47" fill="#ff0055" fontSize="8" fontFamily="monospace">0.5m</text>

          {/* Crosshairs & Angle Ticks */}
          <line x1="-205" y1="0" x2="205" y2="0" stroke="rgba(6, 182, 212, 0.15)" strokeWidth="1" />
          <line x1="0" y1="-205" x2="0" y2="205" stroke="rgba(6, 182, 212, 0.15)" strokeWidth="1" />
          
          {/* Diagonal guidelines */}
          <line x1="-140" y1="-140" x2="140" y2="140" stroke="rgba(6, 182, 212, 0.08)" strokeWidth="0.8" />
          <line x1="140" y1="-140" x2="-140" y2="140" stroke="rgba(6, 182, 212, 0.08)" strokeWidth="0.8" />

          {/* Animated Radar Sweep Cone */}
          <g className="animate-radar-sweep origin-center">
            <path 
              d="M 0 0 L 0 -190 A 190 190 0 0 1 134 -134 Z" 
              fill="url(#radarSweepGradient)" 
            />
          </g>

          {/* THREAT VECTOR 1: Front Center LiDAR Cone */}
          <g>
            <path 
              d={`M 0 -24 L -55 -175 A 185 185 0 0 1 55 -175 Z`}
              fill={frontFill}
              stroke={frontColor}
              strokeWidth="1.5"
              filter="url(#neonGlow)"
              className={frontLiDAR?.threatLevel === 'CRITICAL' ? 'animate-pulse' : ''}
            />
            {/* Front Distance Marker */}
            <circle cx="0" cy={-Math.min(180, Math.max(45, (lidarDistance / 5.0) * 190))} r="4" fill={frontColor} />
            <text 
              x="0" 
              y={-Math.min(170, Math.max(35, (lidarDistance / 5.0) * 190)) - 8} 
              fill={frontColor} 
              fontSize="9" 
              fontWeight="bold" 
              fontFamily="monospace" 
              textAnchor="middle"
            >
              LiDAR {lidarDistance.toFixed(2)}m
            </text>
          </g>

          {/* THREAT VECTOR 2: Left Side Proximity Arc */}
          <g>
            <path 
              d="M -16 -18 A 65 65 0 0 0 -16 22 L -85 75 A 115 115 0 0 1 -85 -75 Z"
              fill={getThreatFill(sideLeft?.threatLevel)}
              stroke={leftColor}
              strokeWidth="1.2"
            />
            <text x="-120" y="5" fill={leftColor} fontSize="8" fontFamily="monospace" textAnchor="end">
              SIDE L: {sideLeft?.distance.toFixed(2)}m
            </text>
          </g>

          {/* THREAT VECTOR 3: Right Side Proximity Arc */}
          <g>
            <path 
              d="M 16 -18 A 65 65 0 0 1 16 22 L 85 75 A 115 115 0 0 0 85 -75 Z"
              fill={getThreatFill(sideRight?.threatLevel)}
              stroke={rightColor}
              strokeWidth="1.2"
            />
            <text x="120" y="5" fill={rightColor} fontSize="8" fontFamily="monospace" textAnchor="start">
              SIDE R: {sideRight?.distance.toFixed(2)}m
            </text>
          </g>

          {/* THREAT VECTOR 4: Rear Clearance Proximity Zone */}
          <g>
            <path 
              d="M -15 25 L -55 130 A 140 140 0 0 0 55 130 L 15 25 Z"
              fill={getThreatFill(rearCenter?.threatLevel)}
              stroke={rearColor}
              strokeWidth="1.2"
            />
            <text x="0" y="145" fill={rearColor} fontSize="8" fontFamily="monospace" textAnchor="middle">
              REAR: {rearCenter?.distance.toFixed(2)}m
            </text>
          </g>

          {/* EGO VEHICLE TOP-DOWN VECTOR MODEL */}
          <g transform={`rotate(${steerAngle * 0.3})`}>
            {/* Headlight Beams */}
            <polygon 
              points="-12,-24 -35,-85 35,-85 12,-24" 
              fill="rgba(255, 255, 255, 0.08)" 
            />
            
            {/* Wheels */}
            <rect x="-18" y="-22" width="5" height="12" rx="1.5" fill="#334155" stroke="#00f0ff" strokeWidth="0.5" />
            <rect x="13" y="-22" width="5" height="12" rx="1.5" fill="#334155" stroke="#00f0ff" strokeWidth="0.5" />
            <rect x="-18" y="10" width="5" height="12" rx="1.5" fill="#334155" stroke="#00f0ff" strokeWidth="0.5" />
            <rect x="13" y="10" width="5" height="12" rx="1.5" fill="#334155" stroke="#00f0ff" strokeWidth="0.5" />

            {/* Chassis Body */}
            <rect 
              x="-14" 
              y="-25" 
              width="28" 
              height="50" 
              rx="6" 
              fill="#0A101D" 
              stroke={aebActive ? "#FF0055" : "#00F0FF"} 
              strokeWidth="1.5" 
              filter="url(#neonGlow)"
            />

            {/* Front Windshield & Cabin Glass */}
            <polygon points="-10,-12 -8,-4 8,-4 10,-12" fill="rgba(6, 182, 212, 0.6)" />
            <rect x="-8" y="-4" width="16" height="16" fill="rgba(6, 182, 212, 0.35)" rx="2" />
            <polygon points="-10,18 -8,12 8,12 10,18" fill="rgba(6, 182, 212, 0.4)" />

            {/* LED Headlights */}
            <circle cx="-10" cy="-24" r="2.5" fill="#ffffff" />
            <circle cx="10" cy="-24" r="2.5" fill="#ffffff" />

            {/* LED Taillight Bar */}
            <line x1="-10" y1="24" x2="10" y2="24" stroke="#ff0055" strokeWidth="2" strokeLinecap="round" />
            
            {/* Center Heading Arrow */}
            <polygon points="0,-18 -4,-8 4,-8" fill="#00f0ff" />
          </g>

          {/* Interactive Obstacle Pins */}
          {detectedObjects.map((obj, i) => {
            // Plot obstacles based on simulated distance and orientation
            const baseAngles = [ -15, 28, 48, -40 ];
            const angle = baseAngles[i % baseAngles.length];
            const rad = (angle - 90) * (Math.PI / 180);
            const r = Math.min(180, (obj.distance / 5.0) * 190);
            const px = r * Math.cos(rad);
            const py = r * Math.sin(rad);

            const isThreat = obj.distance < 2.0;

            return (
              <g 
                key={obj.id} 
                className="cursor-pointer group"
                onClick={() => setSelectedObstacle({
                  id: obj.id,
                  label: obj.label,
                  dist: obj.distance,
                  speed: obj.velocity || 0,
                  threat: isThreat ? 'CRITICAL' : obj.distance < 3.5 ? 'WARNING' : 'SAFE',
                  angle: angle,
                })}
              >
                {/* Target Pulsing Ring */}
                <circle 
                  cx={px} 
                  cy={py} 
                  r="9" 
                  fill={isThreat ? 'rgba(255, 0, 85, 0.3)' : 'rgba(0, 240, 255, 0.2)'} 
                  stroke={isThreat ? '#FF0055' : '#00F0FF'} 
                  strokeWidth="1.2"
                  className="animate-ping origin-center opacity-70"
                />

                {/* Target Pin Marker */}
                <circle 
                  cx={px} 
                  cy={py} 
                  r="5" 
                  fill={isThreat ? '#FF0055' : '#00F0FF'} 
                  stroke="#ffffff" 
                  strokeWidth="1"
                />

                {/* Tag label */}
                <text 
                  x={px + 8} 
                  y={py - 6} 
                  fill={isThreat ? '#FF7799' : '#38BDF8'} 
                  fontSize="7.5" 
                  fontFamily="monospace" 
                  fontWeight="bold"
                >
                  {obj.label} [{obj.distance}m]
                </text>
              </g>
            );
          })}
        </svg>

        {/* Selected Obstacle HUD Overlay Card */}
        {selectedObstacle && (
          <div className="absolute bottom-2 left-2 p-2.5 rounded-lg bg-slate-900/90 border border-cyan-500/40 text-[11px] font-mono shadow-xl z-20 backdrop-blur-md">
            <div className="flex items-center justify-between gap-3 text-cyan-300 font-bold mb-1">
              <span>TARGET: {selectedObstacle.label}</span>
              <button 
                onClick={() => setSelectedObstacle(null)}
                className="text-slate-400 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-slate-300">
              <div>RANGE: <span className="text-white font-bold">{selectedObstacle.dist}m</span></div>
              <div>REL SPEED: <span className="text-white">{selectedObstacle.speed} km/h</span></div>
              <div>ANGLE: <span className="text-white">{selectedObstacle.angle}°</span></div>
              <div>THREAT: <span className={
                selectedObstacle.threat === 'CRITICAL' ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'
              }>{selectedObstacle.threat}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Viewport Bottom Quick Readouts */}
      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-cyan-500/15 text-center text-xs font-mono z-10">
        <div className="p-1 rounded bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
          <div className="text-[10px] text-slate-500 dark:text-slate-400">FRONT LIDAR</div>
          <div className="font-bold text-blue-700 dark:text-cyan-300">{lidarDistance.toFixed(2)}m</div>
        </div>
        <div className="p-1 rounded bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
          <div className="text-[10px] text-slate-500 dark:text-slate-400">SIDE L CLEAR</div>
          <div className="font-bold text-amber-600 dark:text-amber-300">{sideLeft?.distance.toFixed(2)}m</div>
        </div>
        <div className="p-1 rounded bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
          <div className="text-[10px] text-slate-500 dark:text-slate-400">SIDE R CLEAR</div>
          <div className="font-bold text-emerald-600 dark:text-emerald-300">{sideRight?.distance.toFixed(2)}m</div>
        </div>
        <div className="p-1 rounded bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
          <div className="text-[10px] text-slate-500 dark:text-slate-400">REAR CLEAR</div>
          <div className="font-bold text-blue-700 dark:text-cyan-300">{rearCenter?.distance.toFixed(2)}m</div>
        </div>
      </div>
    </div>
  );
};
