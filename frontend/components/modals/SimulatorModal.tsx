import React, { useState } from 'react';
import { X, Car, ExternalLink } from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import { Custom3dSimulation } from '../simulation/Custom3dSimulation';
import { AdasWorldSimulation } from '../simulation/AdasWorldSimulation';

export const SimulatorModal: React.FC = () => {
  const { 
    simulatorModalOpen, 
    setSimulatorModalOpen, 
    speed, 
    lidarDistance
  } = useTelemetry();

  const [simEngine, setSimEngine] = useState<'custom-3d' | 'adas-world'>('adas-world');

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
                onClick={() => setSimEngine('adas-world')}
                className={`px-3 py-1 rounded-md transition-all font-bold ${
                  simEngine === 'adas-world'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                3D ADAS WORLD (LIVE)
              </button>
              <button
                onClick={() => setSimEngine('custom-3d')}
                className={`px-3 py-1 rounded-md transition-all font-bold ${
                  simEngine === 'custom-3d'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                DIGITAL TWIN
              </button>
            </div>

            <a
              href="/assets/simulation/adas-world.html"
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
          {simEngine === 'adas-world' ? (
            <div className="w-full h-full p-2">
              <AdasWorldSimulation height="100%" embed={false} instance="modal" allowFullscreen={false} />
            </div>
          ) : (
            <div className="w-full h-full p-2">
              <Custom3dSimulation height="100%" />
            </div>
          )}
        </div>

        {/* User-Friendly Footer Bar */}
        <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between text-[11px] font-sans text-slate-400 gap-2">
          <div className="flex items-center gap-3">
            <span><strong>Drive:</strong> W / A / S / D or Arrow Keys · Space to brake (click the viewport first)</span>
            <span>·</span>
            <span><strong>Camera:</strong> keys 1 / 2 or the CHASE / ORBIT buttons</span>
          </div>
          <div className="font-mono text-cyan-400 font-bold">
            SPEED: {Math.round(speed)} KM/H · OBSTACLE: {lidarDistance.toFixed(2)}M
          </div>
        </div>
      </div>
    </div>
  );
};
