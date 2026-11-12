import React, { useState } from 'react';
import { X, Car, ExternalLink, Radio, Maximize2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import { Custom3dSimulation } from '../simulation/Custom3dSimulation';

export const SimulatorModal: React.FC = () => {
  const { 
    simulatorModalOpen, 
    setSimulatorModalOpen, 
    speed, 
    lidarDistance, 
    aebActive,
    triggerManualAEB,
    releaseAEB
  } = useTelemetry();

  const [simEngine, setSimEngine] = useState<'custom-3d' | 'highway-drive'>('custom-3d');

  if (!simulatorModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 z-50 animate-fadeIn select-none">
      <div className="w-full max-w-7xl h-[92vh] glass-panel rounded-2xl flex flex-col overflow-hidden border border-cyan-500/40 shadow-2xl">
        {/* Modal Top Bar */}
        <div className="p-3.5 bg-slate-950/95 border-b border-cyan-500/25 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-cyan-400 font-bold">
              <Car className="w-5 h-5 text-cyan-400 animate-pulse" />
              <span className="font-display text-sm tracking-wider">PRAVAH 3D ADAS DRIVING SIMULATOR</span>
            </div>
            <span className="hidden sm:inline text-slate-700">|</span>
            <div className="hidden sm:flex items-center gap-1.5 text-slate-400 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE SENSOR SYNC</span>
            </div>
          </div>

          {/* Engine Selector */}
          <div className="flex items-center gap-2">
            <div className="flex items-center p-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-display">
              <button
                onClick={() => setSimEngine('custom-3d')}
                className={`px-3 py-1 rounded-md transition-all font-bold ${
                  simEngine === 'custom-3d'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                CUSTOM 3D DIGITAL TWIN
              </button>
              <button
                onClick={() => setSimEngine('highway-drive')}
                className={`px-3 py-1 rounded-md transition-all font-bold ${
                  simEngine === 'highway-drive'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                INTERACTIVE HIGHWAY DRIVE
              </button>
            </div>

            <a
              href="/assets/aistudio/GRAPHICS_1e693f54.HTML"
              target="_blank"
              rel="noreferrer"
              title="Open Simulator in Standalone Browser Window"
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-cyan-300 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            <button
              onClick={() => setSimulatorModalOpen(false)}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-rose-500 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Simulator Container */}
        <div className="flex-1 w-full relative bg-slate-950 overflow-hidden">
          {simEngine === 'custom-3d' ? (
            <div className="w-full h-full p-2">
              <Custom3dSimulation height="100%" />
            </div>
          ) : (
            <iframe
              src="/assets/aistudio/GRAPHICS_1e693f54.HTML"
              title="Interactive 3D Autonomous Driving"
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; encrypted-media; gyroscope"
            />
          )}
        </div>

        {/* User-Friendly Footer Bar */}
        <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between text-[11px] font-sans text-slate-400 gap-2">
          <div className="flex items-center gap-3">
            <span><strong>Camera Views:</strong> Switch between Chase, Cockpit, Overhead Drone, or Orbit (360° click & drag)</span>
            <span>·</span>
            <span><strong>Hover:</strong> Move your mouse over car or obstacles for live distance & speed tooltips</span>
          </div>
          <div className="font-mono text-cyan-400 font-bold">
            SPEED: {speed} KM/H · OBSTACLE: {lidarDistance.toFixed(2)}M
          </div>
        </div>
      </div>
    </div>
  );
};
