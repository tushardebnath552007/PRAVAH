import React, { useState } from 'react';
import { TelemetryProvider, useTelemetry } from './context/TelemetryContext';
import { LeftNavigationDrawer } from './components/layout/LeftNavigationDrawer';
import { TopHeader } from './components/layout/TopHeader';
import { CommandCenterView } from './components/views/CommandCenterView';
import { SensorMatrixView } from './components/views/SensorMatrixView';
import { AiPerceptionView } from './components/views/AiPerceptionView';
import { DataSheetEnvironmentView } from './components/views/DataSheetEnvironmentView';
import { ThreatActuationView } from './components/views/ThreatActuationView';
import { DiagnosticsLogsView } from './components/views/DiagnosticsLogsView';
import { CriticalHazardModal } from './components/modals/CriticalHazardModal';
import { SimulatorModal } from './components/modals/SimulatorModal';
import { Menu, X } from 'lucide-react';

const DashboardContent: React.FC = () => {
  const { activeTab } = useTelemetry();
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'command-center':
        return <CommandCenterView />;
      case 'sensor-matrix':
        return <SensorMatrixView />;
      case 'ai-perception':
        return <AiPerceptionView />;
      case 'data-sheet':
        return <DataSheetEnvironmentView />;
      case 'threat-actuation':
        return <ThreatActuationView />;
      case 'diagnostics-logs':
        return <DiagnosticsLogsView />;
      default:
        return <CommandCenterView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#04070D] text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row relative bg-grid-pattern selection:bg-blue-500/20 dark:selection:bg-cyan-500/30 selection:text-blue-900 dark:selection:text-cyan-200 transition-colors duration-200">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Left Navigation Drawer (Fixed on desktop, drawer on mobile) */}
      <div className={`fixed lg:sticky top-0 left-0 h-screen z-50 transform transition-transform duration-300 lg:translate-x-0 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <LeftNavigationDrawer />
        {/* Mobile close button */}
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="absolute top-4 right-4 p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white lg:hidden"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Mobile Top Navbar with hamburger */}
        <div className="lg:hidden h-14 px-4 bg-white/95 dark:bg-[#04070D]/95 border-b border-slate-200 dark:border-cyan-500/20 flex items-center justify-between sticky top-0 z-30 backdrop-blur-lg">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-['Chakra_Petch'] text-lg font-bold tracking-widest text-blue-700 dark:text-cyan-400">
            PRAVAH ADAS
          </span>
          <div className="w-6" /> {/* spacer */}
        </div>

        {/* Global Top Header */}
        <TopHeader />

        {/* Dynamic View Container */}
        <main className="flex-1 pb-12 overflow-y-auto relative">
          {/* Command Center stays mounted so the 3D world keeps driving telemetry on other tabs */}
          <div className={activeTab === 'command-center' ? 'block' : 'hidden'} aria-hidden={activeTab !== 'command-center'}>
            <CommandCenterView />
          </div>
          {activeTab !== 'command-center' && renderActiveView()}
        </main>

        {/* Pinned Bottom Telemetry Micro-Ribbon */}
        <footer className="h-9 px-6 bg-white/95 dark:bg-[#04070D]/95 border-t border-slate-200 dark:border-cyan-500/15 backdrop-blur-md flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0 select-none transition-colors">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-blue-700 dark:text-cyan-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-cyan-400 animate-pulse" />
              PRAVAH RPi5 NODE
            </span>
            <span className="hidden sm:inline">ARCHITECTURE: ARM64 CORTEX-A76 @ 2.4GHz</span>
            <span className="hidden md:inline">KERNEL: LINUX 6.6-V8+ ADAS RT</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-slate-600 dark:text-slate-400">CAN 2.0B · 500 KBPS</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">TELEMETRY STREAM NOMINAL</span>
          </div>
        </footer>
      </div>

      {/* Global Modals */}
      <CriticalHazardModal />
      <SimulatorModal />
    </div>
  );
};

export default function App() {
  return (
    <TelemetryProvider>
      <DashboardContent />
    </TelemetryProvider>
  );
}
