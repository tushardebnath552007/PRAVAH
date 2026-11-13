import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { 
  NavigationTab, 
  ConnectionMode, 
  ThreatLevel, 
  DetectedObject, 
  ProximitySensorZone, 
  TelemetryDataPoint, 
  DiagnosticEventLog, 
  AdasSettings 
} from '../types/telemetry';
import { audioSynth } from '../utils/audioSynthesizer';

interface TelemetryContextType {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  connectionMode: ConnectionMode;
  setConnectionMode: (mode: ConnectionMode) => void;
  killSwitchActive: boolean;
  toggleKillSwitch: () => void;
  simulatorModalOpen: boolean;
  setSimulatorModalOpen: (open: boolean) => void;
  criticalHazardModal: {
    isOpen: boolean;
    reason: string;
    minDistance: number;
    severity: 'CRITICAL' | 'WARNING';
  };
  dismissHazardModal: () => void;

  // Live Telemetry Values
  speed: number;
  steerAngle: number;
  gear: 'P' | 'R' | 'N' | 'D';
  heading: number;
  lidarDistance: number;
  lidarSignal: number;
  lidarSnr: number;
  healthScore: number;
  fcwState: string;
  aebActive: boolean;
  lkaActive: boolean;
  accActive: boolean;
  agsActive: boolean;
  servoAngle: number;
  cameraFps: number;
  inferenceLatency: number;
  detectedObjects: DetectedObject[];
  proximityZones: ProximitySensorZone[];

  // Weather & Environment
  rainLevel: number;
  fogLevel: number;
  rainRate: number;
  fogDensityPct: number;
  ambientLux: number;
  lightScatterCoeff: number;
  roadWetness: number;
  frictionMu: number;
  hydroplaningRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  nightMode: boolean;
  daylightMode: boolean;
  glareDetected: boolean;
  setRainLevel: (lvl: number) => void;
  setFogLevel: (lvl: number) => void;
  toggleNightMode: () => void;
  toggleDaylightMode: () => void;

  // Simulation Running State
  isSimRunning: boolean;
  toggleSimRunning: () => void;
  simulationLinked: boolean;
  hardwareLinked: boolean;

  // Hardware / Pi 5 stats
  cpuTemp: number;
  cpuLoad: number;
  ramUsage: number;
  latencyMs: number;
  packetDeliveryRate: number;
  uptimeSeconds: number;
  canBusLoad: number;

  // Additional Sensors
  imu: { ax: number; ay: number; az: number; gx: number; gy: number; gz: number };
  gps: { lat: number; lng: number; satellites: number; alt: number; fix: boolean };

  // Settings & Controls
  settings: AdasSettings;
  updateSettings: (newSettings: Partial<AdasSettings>) => void;
  triggerManualAEB: () => void;
  releaseAEB: () => void;
  testPiezoBeep: () => void;
  speakVoiceAlert: (phrase: string) => void;

  // History & Logs
  history: TelemetryDataPoint[];
  eventLogs: DiagnosticEventLog[];
  acknowledgeLog: (id: string) => void;
  clearLogs: () => void;
}

const TelemetryContext = createContext<TelemetryContextType | undefined>(undefined);

const INITIAL_ZONES: ProximitySensorZone[] = [
  { id: 'z1', zone: 'Front Center', direction: 'Front Center', sensorType: 'TF-Luna LiDAR', distance: 4.52, minClearance: 0.5, maxRange: 12.0, obstacleDetected: false, threatLevel: 'CLEAR', lastTriggerTime: '00:00:12' },
  { id: 'z2', zone: 'Front Left', direction: 'Front Left', sensorType: 'IR Optical Array', distance: 1.20, minClearance: 0.3, maxRange: 4.0, obstacleDetected: true, threatLevel: 'CAUTION', lastTriggerTime: '00:00:04' },
  { id: 'z3', zone: 'Front Right', direction: 'Front Right', sensorType: 'IR Optical Array', distance: 2.15, minClearance: 0.3, maxRange: 4.0, obstacleDetected: false, threatLevel: 'SAFE', lastTriggerTime: '00:00:28' },
  { id: 'z4', zone: 'Side Left Blind Spot', direction: 'Side Left', sensorType: 'Ultrasonic Transceiver', distance: 0.85, minClearance: 0.4, maxRange: 3.5, obstacleDetected: true, threatLevel: 'WARNING', lastTriggerTime: '00:00:02' },
  { id: 'z5', zone: 'Side Right Blind Spot', direction: 'Side Right', sensorType: 'Ultrasonic Transceiver', distance: 3.40, minClearance: 0.4, maxRange: 3.5, obstacleDetected: false, threatLevel: 'SAFE', lastTriggerTime: '00:01:14' },
  { id: 'z6', zone: 'Rear Left Clearance', direction: 'Rear Left', sensorType: 'IR Optical Array', distance: 2.80, minClearance: 0.3, maxRange: 4.0, obstacleDetected: false, threatLevel: 'SAFE', lastTriggerTime: '00:00:45' },
  { id: 'z7', zone: 'Rear Right Clearance', direction: 'Rear Right', sensorType: 'IR Optical Array', distance: 2.95, minClearance: 0.3, maxRange: 4.0, obstacleDetected: false, threatLevel: 'SAFE', lastTriggerTime: '00:00:52' },
  { id: 'z8', zone: 'Rear Center', direction: 'Rear Center', sensorType: 'Ultrasonic Transceiver', distance: 5.00, minClearance: 0.5, maxRange: 6.0, obstacleDetected: false, threatLevel: 'CLEAR', lastTriggerTime: '00:02:10' },
];

const ZONE_SECTOR_MAP: Record<string, string> = {
  'Front Center': 'front',
  'Front Left': 'frontLeft',
  'Front Right': 'frontRight',
  'Side Left': 'left',
  'Side Right': 'right',
  'Rear Left': 'rearLeft',
  'Rear Right': 'rearRight',
  'Rear Center': 'rear',
};

const generateSeedHistory = (): TelemetryDataPoint[] => {
  const points: TelemetryDataPoint[] = [];
  const now = Date.now();
  for (let i = 20; i >= 1; i--) {
    const t = new Date(now - i * 1000);
    const dist = Number((4.5 + Math.sin(i * 0.4) * 1.5 + (Math.random() * 0.3)).toFixed(2));
    const speed = Math.round(38 + Math.sin(i * 0.3) * 6);
    const servo = dist < 2.0 ? 80 : dist < 3.5 ? 45 : Math.round(Math.max(0, (1 - dist / 8) * 60));
    points.push({
      timestamp: t.toLocaleTimeString('en-US', { hour12: false }),
      timeSec: Math.floor(t.getTime() / 1000) % 3600,
      speed,
      steerAngle: Number((Math.sin(i * 0.5) * 4).toFixed(1)),
      gear: 'D',
      lidarDistance: dist,
      lidarSnr: Math.round(36 + Math.random() * 5),
      leftClearance: Number((1.2 + Math.random() * 0.3).toFixed(2)),
      rightClearance: Number((2.4 + Math.random() * 0.4).toFixed(2)),
      rearClearance: Number((5.0 + Math.random() * 0.5).toFixed(2)),
      rainLevel: 0,
      rainRate: 0,
      fogLevel: 0,
      fogDensityPct: 0,
      ambientLux: Math.round(8400 + Math.random() * 100),
      cpuLoad: Number((24 + Math.random() * 5).toFixed(1)),
      cpuTemp: Number((48 + Math.random() * 2).toFixed(1)),
      ramUsage: Number((42 + Math.random() * 2).toFixed(1)),
      cameraFps: 60,
      inferenceLatency: Number((13.5 + Math.random() * 1.5).toFixed(1)),
      canBusLoad: Number((34 + Math.random() * 4).toFixed(1)),
      threatIndex: dist < 2 ? 85 : dist < 4 ? 45 : 15,
      accelX: Number((Math.sin(i * 0.6) * 0.15).toFixed(2)),
      accelY: Number((Math.cos(i * 0.4) * 0.12).toFixed(2)),
      accelZ: 0.99,
      gyroZ: Number((Math.sin(i * 0.3) * 0.8).toFixed(2)),
      aebActive: false,
      fcwState: 'FCW: SYSTEM NOMINAL',
      pm25: Number((24 + Math.random() * 4).toFixed(1)),
      pm10: Number((46 + Math.random() * 6).toFixed(1)),
      irDetected: i % 4 === 0 ? 1 : 0,
      servoAngle: servo,
      pedConfidence: Math.round(95 + Math.random() * 4),
      vehConfidence: Math.round(97 + Math.random() * 2),
      potholeConfidence: Math.round(88 + Math.random() * 5),
      gpsLat: Number((28.6139 + (20 - i) * 0.00012).toFixed(5)),
      gpsLng: Number((77.2090 + (20 - i) * 0.00008).toFixed(5)),
    });
  }
  return points;
};

export const TelemetryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('command-center');
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('SIMULATION');
  const [killSwitchActive, setKillSwitchActive] = useState<boolean>(false);
  const [simulatorModalOpen, setSimulatorModalOpen] = useState<boolean>(false);

  const [criticalHazardModal, setCriticalHazardModal] = useState<{
    isOpen: boolean;
    reason: string;
    minDistance: number;
    severity: 'CRITICAL' | 'WARNING';
  }>({
    isOpen: false,
    reason: '',
    minDistance: 50,
    severity: 'WARNING',
  });

  // Settings
  const [settings, setSettings] = useState<AdasSettings>({
    fcwSensitivity: 'Balanced',
    aebThresholdMeters: 1.8,
    lkaEnabled: true,
    lkaDriftThresholdDeg: 8,
    accEnabled: true,
    accTimeGapSec: 1.5,
    antiGlareShieldAuto: true,
    piezoVolume: 80,
    piezoFrequency: 2400,
    ledPattern: 'OFF',
    voiceAlertsEnabled: true,
  });

  // Live state values
  const [speed, setSpeed] = useState<number>(38);
  const [steerAngle, setSteerAngle] = useState<number>(2);
  const [gear, setGear] = useState<'P' | 'R' | 'N' | 'D'>('D');
  const [heading, setHeading] = useState<number>(142);
  const [lidarDistance, setLidarDistance] = useState<number>(4.52);
  const [lidarSignal, setLidarSignal] = useState<number>(94);
  const [lidarSnr, setLidarSnr] = useState<number>(36);
  const [healthScore, setHealthScore] = useState<number>(98);
  const [fcwState, setFcwState] = useState<string>('FCW: SYSTEM NOMINAL');
  const [aebActive, setAebActive] = useState<boolean>(false);
  const [lkaActive, setLkaActive] = useState<boolean>(true);
  const [accActive, setAccActive] = useState<boolean>(true);
  const [agsActive, setAgsActive] = useState<boolean>(false);
  const [servoAngle, setServoAngle] = useState<number>(12); // degrees
  const [cameraFps, setCameraFps] = useState<number>(60);
  const [inferenceLatency, setInferenceLatency] = useState<number>(14.2);

  // Weather initial states from localStorage
  const [rainLevel, setRainLevelState] = useState<number>(() => {
    const r = localStorage.getItem('adas_rain');
    return r ? Math.min(5, Math.max(0, parseInt(r, 10))) : 0;
  });
  const [fogLevel, setFogLevelState] = useState<number>(() => {
    const f = localStorage.getItem('adas_fog');
    return f ? Math.min(5, Math.max(0, parseInt(f, 10))) : 0;
  });
  const [nightMode, setNightMode] = useState<boolean>(false);
  const [daylightMode, setDaylightMode] = useState<boolean>(() => {
    return localStorage.getItem('pravah_daylight_mode') === 'true';
  });
  const [isSimRunning, setIsSimRunning] = useState<boolean>(true);
  const [simulationLinked, setSimulationLinked] = useState<boolean>(false);
  const [hardwareLinked, setHardwareLinked] = useState<boolean>(false);
  const [glareDetected, setGlareDetected] = useState<boolean>(false);

  // Sync Daylight Mode with HTML class & storage
  useEffect(() => {
    if (daylightMode) {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('daylight');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('daylight');
    }
    localStorage.setItem('pravah_daylight_mode', String(daylightMode));
    
    // Sync to backend API if available
    try {
      fetch('/api/daylight-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: daylightMode }),
      }).catch(() => {});
    } catch {
      // ignore
    }
  }, [daylightMode]);

  // Pi 5 hardware metrics
  const [cpuTemp, setCpuTemp] = useState<number>(48.5);
  const [cpuLoad, setCpuLoad] = useState<number>(26.4);
  const [ramUsage, setRamUsage] = useState<number>(42.1);
  const [latencyMs, setLatencyMs] = useState<number>(12);
  const [packetDeliveryRate, setPacketDeliveryRate] = useState<number>(99.8);
  const [uptimeSeconds, setUptimeSeconds] = useState<number>(14285);
  const [canBusLoad, setCanBusLoad] = useState<number>(34.8);

  // IMU & GPS
  const [imu, setImu] = useState({ ax: 0.04, ay: -0.02, az: 0.99, gx: 0.2, gy: -0.1, gz: 0.4 });
  const [gps, setGps] = useState({ lat: 28.6139, lng: 77.2090, satellites: 14, alt: 216, fix: true });

  // Detection and Sensor Zones
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([
    { id: 'obj-1', type: 'VEHICLE', label: 'SEDAN', confidence: 98, distance: 14.8, x: 52, y: 44, width: 90, height: 75, velocity: 42 },
    { id: 'obj-2', type: 'PEDESTRIAN', label: 'PEDESTRIAN', confidence: 96, distance: 8.4, x: 28, y: 56, width: 34, height: 85 },
    { id: 'obj-3', type: 'POTHOLE', label: 'POTHOLE / ANOMALY', confidence: 89, distance: 5.1, x: 44, y: 78, width: 55, height: 35 },
  ]);

  const [proximityZones, setProximityZones] = useState<ProximitySensorZone[]>(INITIAL_ZONES);

  // History for charts - initialized with seed points
  const [history, setHistory] = useState<TelemetryDataPoint[]>(generateSeedHistory);
  const [eventLogs, setEventLogs] = useState<DiagnosticEventLog[]>([
    { id: 'log-1', timestamp: '00:00:01', severity: 'INFO', category: 'SYSTEM', message: 'PRAVAH Core Telemetry Engine initialized on Raspberry Pi 5' },
    { id: 'log-2', timestamp: '00:00:02', severity: 'INFO', category: 'CAN_BUS', message: 'CAN bus transceiver synchronized @ 500kbps arbitration rate' },
    { id: 'log-3', timestamp: '00:00:04', severity: 'INFO', category: 'LIDAR', message: 'TF-Luna LiDAR stream active. 100Hz ranging calibration valid' },
    { id: 'log-4', timestamp: '00:00:05', severity: 'INFO', category: 'VISION', message: 'TensorRT FP16 model loaded. Target latency: 14.2ms' },
  ]);

  const telemetryChannelRef = useRef<BroadcastChannel | null>(null);
  const weatherChannelRef = useRef<BroadcastChannel | null>(null);
  const controlChannelRef = useRef<BroadcastChannel | null>(null);
  const lastAlarmTimeRef = useRef<number>(0);
  const lastHazardAckRef = useRef<number>(0);
  const lastSimMessageTimeRef = useRef<number>(0);
  const telemetryStateRef = useRef<any>({});
  const connectionModeRef = useRef<ConnectionMode>('SIMULATION');
  const killSwitchRef = useRef<boolean>(false);
  const settingsRef = useRef<AdasSettings | null>(null);
  const modalOpenRef = useRef<boolean>(false);
  const prevAebRef = useRef<boolean>(false);
  const lastSimAebLogRef = useRef<number>(0);
  const isSimRunningRef = useRef<boolean>(true);
  const hardwareLinkedRef = useRef<boolean>(false);
  const demoFramesRef = useRef<any[] | null>(null);
  const demoFrameIndexRef = useRef<number>(0);

  // Helper to add event logs
  const addEventLog = useCallback((log: Omit<DiagnosticEventLog, 'id'>) => {
    const newLog: DiagnosticEventLog = {
      ...log,
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };
    setEventLogs(prev => [newLog, ...prev.slice(0, 99)]);
  }, []);

  const acknowledgeLog = useCallback((id: string) => {
    setEventLogs(prev => prev.map(l => l.id === id ? { ...l, acknowledged: true } : l));
  }, []);

  const clearLogs = useCallback(() => {
    setEventLogs([]);
  }, []);

  // Set weather levels and propagate to BroadcastChannel
  const setRainLevel = useCallback((lvl: number) => {
    const val = Math.min(5, Math.max(0, lvl));
    setRainLevelState(val);
    localStorage.setItem('adas_rain', val.toString());
    weatherChannelRef.current?.postMessage({ rainLevel: val });
    try { controlChannelRef.current?.postMessage({ type: 'weather', rainLevel: val }); } catch { /* ignore */ }
  }, []);

  const setFogLevel = useCallback((lvl: number) => {
    const val = Math.min(5, Math.max(0, lvl));
    setFogLevelState(val);
    localStorage.setItem('adas_fog', val.toString());
    weatherChannelRef.current?.postMessage({ fogLevel: val });
    try { controlChannelRef.current?.postMessage({ type: 'weather', fogLevel: val }); } catch { /* ignore */ }
  }, []);

  const toggleNightMode = useCallback(() => {
    // Compute from the current value outside the updater: side effects inside a
    // state updater run twice under React StrictMode and toggle straight back.
    const next = !nightMode;
    setNightMode(next);
    try { controlChannelRef.current?.postMessage({ type: 'night', enabled: next }); } catch { /* ignore */ }
  }, [nightMode]);

  const toggleDaylightMode = useCallback(() => {
    setDaylightMode(prev => !prev);
  }, []);

  const toggleSimRunning = useCallback(() => {
    const next = !isSimRunning;
    setIsSimRunning(next);
    try { controlChannelRef.current?.postMessage({ type: 'pause', paused: !next }); } catch { /* ignore */ }
    try {
      fetch('/api/simulation/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ running: next }),
      }).catch(() => {});
    } catch {
      // ignore
    }
  }, [isSimRunning]);

  const updateSettings = useCallback((newSettings: Partial<AdasSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // Push ADAS configuration into the 3D simulator
  useEffect(() => {
    try {
      controlChannelRef.current?.postMessage({
        type: 'config',
        aebThreshold: settings.aebThresholdMeters,
        antiGlare: settings.antiGlareShieldAuto,
      });
    } catch {
      // ignore
    }
  }, [settings.aebThresholdMeters, settings.antiGlareShieldAuto]);

  // Emergency actions
  const triggerManualAEB = useCallback(() => {
    setAebActive(true);
    setSpeed(0);
    setServoAngle(90); // 90° Emergency Brake servo position
    setFcwState('FCW: EMERGENCY BRAKING OVERRIDE (AEB)');
    try { controlChannelRef.current?.postMessage({ type: 'aeb', active: true }); } catch { /* ignore */ }
    audioSynth.playEmergencyAlarm();
    if (settings.voiceAlertsEnabled) {
      audioSynth.speakAlert('Emergency Brake Applied!');
    }
    addEventLog({
      timestamp: new Date().toLocaleTimeString(),
      severity: 'CRITICAL',
      category: 'AEB',
      message: 'MANUAL OVERRIDE: Automatic Emergency Braking (AEB) engaged immediately.',
      metricValue: 'Servo: 90° | Speed: 0 km/h'
    });
  }, [addEventLog, settings.voiceAlertsEnabled]);

  const releaseAEB = useCallback(() => {
    setAebActive(false);
    setServoAngle(0);
    setFcwState('FCW: SYSTEM NOMINAL');
    try { controlChannelRef.current?.postMessage({ type: 'aeb', active: false }); } catch { /* ignore */ }
    addEventLog({
      timestamp: new Date().toLocaleTimeString(),
      severity: 'INFO',
      category: 'AEB',
      message: 'AEB brake released. Normal drive actuation restored.',
      metricValue: 'Servo: 0°'
    });
  }, [addEventLog]);

  const toggleKillSwitch = useCallback(() => {
    const next = !killSwitchActive;
    setKillSwitchActive(next);
    try { controlChannelRef.current?.postMessage({ type: 'kill', active: next }); } catch { /* ignore */ }
    if (next) {
      setSpeed(0);
      setAebActive(true);
      setServoAngle(90);
      audioSynth.playEmergencyAlarm();
      addEventLog({
        timestamp: new Date().toLocaleTimeString(),
        severity: 'CRITICAL',
        category: 'SYSTEM',
        message: 'EMERGENCY KILL SWITCH ENGAGED. All vehicle actuators locked in safe state.',
      });
    } else {
      setAebActive(false);
      setServoAngle(0);
      addEventLog({
        timestamp: new Date().toLocaleTimeString(),
        severity: 'INFO',
        category: 'SYSTEM',
        message: 'Emergency Kill Switch disengaged. System returning to standby.',
      });
    }
  }, [addEventLog, killSwitchActive]);

  const testPiezoBeep = useCallback(() => {
    audioSynth.playPiezoBeep(settings.piezoFrequency, 180, settings.piezoVolume / 100);
  }, [settings.piezoFrequency, settings.piezoVolume]);

  const speakVoiceAlert = useCallback((phrase: string) => {
    audioSynth.speakAlert(phrase);
  }, []);

  const dismissHazardModal = useCallback(() => {
    setCriticalHazardModal(prev => ({ ...prev, isOpen: false }));
    lastHazardAckRef.current = Date.now();
  }, []);

  // Shared application of a telemetry frame onto dashboard state.
  // Used by the recorded DEMO dataset replay and by the 3D simulation (OFF mode).
  const applyTelemetryFrame = useCallback((d: any) => {
    if (!d || typeof d !== 'object') return;

    const clampNum = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const frameSpeed = typeof d.speed === 'number' ? d.speed : 0;
    const frameSteer = typeof d.steer === 'number' ? d.steer : 0;
    const frameHeading = typeof d.heading === 'number' ? d.heading : 0;
    const frameGear: 'P' | 'R' | 'N' | 'D' =
      d.gear === 'P' ? 'P' : d.gear === 'R' ? 'R' : d.gear === 'N' ? 'N' : 'D';

    setSpeed(prev => (Math.abs(prev - frameSpeed) < 0.15 ? prev : Number(frameSpeed.toFixed(1))));
    setSteerAngle(prev => (Math.abs(prev - frameSteer) < 0.5 ? prev : frameSteer));
    setGear(prev => (prev === frameGear ? prev : frameGear));
    setHeading(prev => {
      const next = Number(((frameHeading % 360) + 360) % 360);
      return Math.abs(prev - next) < 0.4 ? prev : next;
    });

    const sectors = (d.sectors || {}) as Record<string, number>;
    const rawFront = typeof sectors.front === 'number' ? sectors.front : typeof d.minDistance === 'number' ? d.minDistance : 50;
    const frontDistance = Number(clampNum(rawFront, 0, 12).toFixed(2));
    setLidarDistance(prev => (Math.abs(prev - frontDistance) < 0.03 ? prev : frontDistance));

    // Directional proximity zones follow the simulation LiDAR sectors
    setProximityZones(prev => prev.map(zone => {
      const raw = sectors[ZONE_SECTOR_MAP[zone.direction]];
      if (typeof raw !== 'number') return zone;
      const maxRange = zone.maxRange || 5;
      const distance = Number(clampNum(raw, 0.05, maxRange).toFixed(2));
      const ratio = distance / maxRange;
      let threatLevel: ThreatLevel;
      if (ratio < 0.18) threatLevel = 'CRITICAL';
      else if (ratio < 0.35) threatLevel = 'WARNING';
      else if (ratio < 0.6) threatLevel = 'CAUTION';
      else if (ratio >= 0.999) threatLevel = 'CLEAR';
      else threatLevel = 'SAFE';
      const triggered = threatLevel === 'CRITICAL' || threatLevel === 'WARNING';
      return {
        ...zone,
        distance,
        obstacleDetected: triggered,
        threatLevel,
        lastTriggerTime: triggered
          ? new Date().toLocaleTimeString('en-US', { hour12: false })
          : zone.lastTriggerTime,
      };
    }));

    // AI perception detections are streamed directly from the simulated scene
    if (Array.isArray(d.detections)) {
      const mapped: DetectedObject[] = d.detections.slice(0, 8).map((o: any, index: number) => ({
        id: typeof o.id === 'string' ? o.id : `sim-obj-${index}`,
        type: o.type === 'PEDESTRIAN' ? 'PEDESTRIAN' : o.type === 'POTHOLE' ? 'POTHOLE' : o.type === 'TRAFFIC_SIGN' ? 'TRAFFIC_SIGN' : 'VEHICLE',
        label: typeof o.label === 'string' ? o.label : 'OBJECT',
        confidence: clampNum(Number(o.confidence) || 90, 0, 100),
        distance: Math.max(0, Number(o.distance) || 0),
        x: clampNum(Number(o.x) || 50, 0, 100),
        y: clampNum(Number(o.y) || 50, 0, 100),
        width: clampNum(Number(o.width) || 40, 4, 200),
        height: clampNum(Number(o.height) || 40, 4, 200),
        velocity: Number(o.velocity) || 0,
      }));
      setDetectedObjects(mapped);
    }

    const aebNow = !!d.aebActive;
    setAebActive(aebNow);
    if (typeof d.fcwState === 'string') setFcwState(d.fcwState);
    if (typeof d.servoAngle === 'number') setServoAngle(clampNum(d.servoAngle, 0, 90));
    // Weather and night mode are site-controlled; they flow to the simulator via
    // the control channel and are echoed back through adas_weather_channel.
    setGlareDetected(!!d.glareDetected);
    setAgsActive(!!d.agsActive);

    if (d.imu && typeof d.imu === 'object') {
      setImu({
        ax: Number(d.imu.ax) || 0,
        ay: Number(d.imu.ay) || 0,
        az: Number(d.imu.az) || 0.99,
        gx: Number(d.imu.gx) || 0,
        gy: Number(d.imu.gy) || 0,
        gz: Number(d.imu.gz) || 0,
      });
    }
    if (d.gps && typeof d.gps === 'object') {
      setGps({
        lat: Number(d.gps.lat) || 28.6139,
        lng: Number(d.gps.lng) || 77.209,
        satellites: Number(d.gps.satellites) || 14,
        alt: Number(d.gps.alt) || 216,
        fix: d.gps.fix !== false,
      });
    }

    if (typeof d.inferenceLatency === 'number') setInferenceLatency(clampNum(d.inferenceLatency, 0, 99));
    if (typeof d.cameraFps === 'number') setCameraFps(clampNum(d.cameraFps, 1, 240));
    if (typeof d.cpuLoad === 'number') setCpuLoad(clampNum(d.cpuLoad, 0, 100));
    if (typeof d.cpuTemp === 'number') setCpuTemp(clampNum(d.cpuTemp, -10, 125));
    if (typeof d.ramUsage === 'number') setRamUsage(clampNum(d.ramUsage, 0, 100));
    if (typeof d.canBusLoad === 'number') setCanBusLoad(clampNum(d.canBusLoad, 0, 100));
    if (typeof d.latencyMs === 'number') setLatencyMs(clampNum(d.latencyMs, 0, 300));
    if (typeof d.packetDeliveryRate === 'number') setPacketDeliveryRate(clampNum(d.packetDeliveryRate, 0, 100));
    if (typeof d.lidarSnr === 'number') setLidarSnr(clampNum(d.lidarSnr, 0, 60));
    if (typeof d.lidarSignal === 'number') setLidarSignal(clampNum(d.lidarSignal, 0, 100));

    const activeSettings = settingsRef.current;
    if (activeSettings) {
      setLkaActive(activeSettings.lkaEnabled && Math.abs(frameSteer) < activeSettings.lkaDriftThresholdDeg);
      setAccActive(activeSettings.accEnabled && frameSpeed > 2);
    }

    // Announce automatic emergency braking transitions once
    if (aebNow && !prevAebRef.current && Date.now() - lastSimAebLogRef.current > 3000) {
      lastSimAebLogRef.current = Date.now();
      audioSynth.playEmergencyAlarm();
      if (settingsRef.current?.voiceAlertsEnabled) {
        audioSynth.speakAlert('Warning: Critical Distance! Emergency Brake Applied!');
      }
      addEventLog({
        timestamp: new Date().toLocaleTimeString(),
        severity: 'CRITICAL',
        category: 'AEB',
        message: `AUTOMATED BRAKING: Forward obstacle inside ${frontDistance}m. Emergency braking engaged.`,
        metricValue: `Distance: ${frontDistance}m | Speed: ${Math.round(frameSpeed)} km/h`,
      });
    }
    prevAebRef.current = aebNow;
  }, [addEventLog]);

  // Apply a live telemetry frame from the 3D ADAS world simulation.
  // The 3D world owns the dashboard only in OFF mode; DEMO replays a recorded
  // dataset and PI 5 polls the Pi 5 node instead.
  const applySimFrame = useCallback((d: any) => {
    if (!d || typeof d !== 'object') return;
    if (connectionModeRef.current !== 'OFFLINE') return;
    if (d.instance === 'modal' && !modalOpenRef.current) return;
    if (d.instance === 'embedded' && modalOpenRef.current) return;

    lastSimMessageTimeRef.current = Date.now();
    setSimulationLinked(true);
    if (killSwitchRef.current) return;

    applyTelemetryFrame(d);
  }, [applyTelemetryFrame]);

  // Map a flat Pi 5 hardware snapshot (/api/telemetry) onto dashboard state.
  // Only scalars the Pi 5 node actually reports are applied; weather/night stay site-owned.
  const applyPiSnapshot = useCallback((s: any) => {
    if (!s || typeof s !== 'object') return;
    const clampNum = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const num = (v: any, fallback: number) =>
      (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

    setSpeed(prev => {
      const next = num(s.speed, prev);
      return Math.abs(prev - next) < 0.15 ? prev : Number(next.toFixed(1));
    });
    setSteerAngle(prev => {
      const next = num(s.steerAngle, prev);
      return Math.abs(prev - next) < 0.5 ? prev : next;
    });
    if (s.gear === 'P' || s.gear === 'R' || s.gear === 'N' || s.gear === 'D') setGear(s.gear);
    if (typeof s.heading === 'number') {
      setHeading(Number(((s.heading % 360) + 360) % 360));
    }
    const front = clampNum(num(s.lidarDistance, 12), 0, 12);
    setLidarDistance(front);
    setLidarSignal(clampNum(num(s.lidarSignal, 94), 0, 100));
    setLidarSnr(clampNum(num(s.lidarSnr, 36), 0, 60));
    setHealthScore(clampNum(num(s.healthScore, 98), 0, 100));
    if (typeof s.fcwState === 'string') setFcwState(s.fcwState);
    const aebNow = !!s.aebActive;
    setAebActive(aebNow);
    if (typeof s.servoAngle === 'number') setServoAngle(clampNum(s.servoAngle, 0, 90));
    setLkaActive(!!s.lkaActive);
    setAccActive(!!s.accActive);
    setAgsActive(!!s.agsActive);
    setCameraFps(clampNum(num(s.cameraFps, 60), 1, 240));
    setInferenceLatency(clampNum(num(s.inferenceLatency, 14), 0, 99));
    setCpuTemp(clampNum(num(s.cpuTemp, 46), -10, 125));
    setCpuLoad(clampNum(num(s.cpuLoad, 20), 0, 100));
    setRamUsage(clampNum(num(s.ramUsage, 40), 0, 100));
    setLatencyMs(clampNum(num(s.latencyMs, 10), 0, 300));
    setPacketDeliveryRate(clampNum(num(s.packetDeliveryRate, 99), 0, 100));
    if (typeof s.uptimeSeconds === 'number') setUptimeSeconds(s.uptimeSeconds);
    setCanBusLoad(clampNum(num(s.canBusLoad, 30), 0, 100));

    if (s.imu && typeof s.imu === 'object') {
      setImu({
        ax: Number(s.imu.ax) || 0,
        ay: Number(s.imu.ay) || 0,
        az: Number(s.imu.az) || 0.99,
        gx: Number(s.imu.gx) || 0,
        gy: Number(s.imu.gy) || 0,
        gz: Number(s.imu.gz) || 0,
      });
    }
    if (s.gps && typeof s.gps === 'object') {
      setGps({
        lat: Number(s.gps.lat) || 28.6139,
        lng: Number(s.gps.lng) || 77.209,
        satellites: Number(s.gps.satellites) || 14,
        alt: Number(s.gps.alt) || 216,
        fix: s.gps.fix !== false,
      });
    }

    // The hardware's forward LiDAR drives zone 1; other zones stay untouched.
    setProximityZones(prev => prev.map(zone => {
      if (zone.id !== 'z1') return zone;
      const distance = Number(clampNum(front, 0.05, zone.maxRange).toFixed(2));
      const ratio = distance / zone.maxRange;
      let threatLevel: ThreatLevel;
      if (ratio < 0.18) threatLevel = 'CRITICAL';
      else if (ratio < 0.35) threatLevel = 'WARNING';
      else if (ratio < 0.6) threatLevel = 'CAUTION';
      else threatLevel = 'CLEAR';
      const triggered = threatLevel === 'CRITICAL' || threatLevel === 'WARNING';
      return {
        ...zone,
        distance,
        obstacleDetected: triggered,
        threatLevel,
        lastTriggerTime: triggered
          ? new Date().toLocaleTimeString('en-US', { hour12: false })
          : zone.lastTriggerTime,
      };
    }));

    // Announce automatic emergency braking transitions once
    if (aebNow && !prevAebRef.current && Date.now() - lastSimAebLogRef.current > 3000) {
      lastSimAebLogRef.current = Date.now();
      audioSynth.playEmergencyAlarm();
      if (settingsRef.current?.voiceAlertsEnabled) {
        audioSynth.speakAlert('Warning: Critical Distance! Emergency Brake Applied!');
      }
      addEventLog({
        timestamp: new Date().toLocaleTimeString(),
        severity: 'CRITICAL',
        category: 'AEB',
        message: `PI 5 HARDWARE: Forward obstacle inside ${front.toFixed(1)}m. Emergency braking engaged.`,
        metricValue: `Distance: ${front.toFixed(1)}m | Speed: ${Math.round(num(s.speed, 0))} km/h`,
      });
    }
    prevAebRef.current = aebNow;
  }, [addEventLog]);

  // DEMO mode: replay the recorded telemetry dataset on a loop
  useEffect(() => {
    if (connectionMode !== 'SIMULATION') return;
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const start = (frames: any[]) => {
      if (cancelled || !Array.isArray(frames) || frames.length === 0) return;
      demoFramesRef.current = frames;
      intervalId = setInterval(() => {
        if (!isSimRunningRef.current) return;
        const frame = frames[demoFrameIndexRef.current % frames.length];
        demoFrameIndexRef.current = (demoFrameIndexRef.current + 1) % frames.length;
        if (killSwitchRef.current) return;
        applyTelemetryFrame(frame);
      }, 500);
    };

    if (demoFramesRef.current) {
      start(demoFramesRef.current);
    } else {
      fetch('/assets/demo-telemetry.json')
        .then((res) => {
          if (!res.ok) throw new Error(String(res.status));
          return res.json();
        })
        .then((payload) => {
          if (!cancelled && Array.isArray(payload?.frames)) start(payload.frames);
        })
        .catch(() => {
          if (cancelled) return;
          addEventLog({
            timestamp: new Date().toLocaleTimeString(),
            severity: 'WARNING',
            category: 'SYSTEM',
            message: 'DEMO recorded dataset could not be loaded; dashboard values stay frozen.',
          });
        });
    }

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [connectionMode, applyTelemetryFrame, addEventLog]);

  // PI 5 mode: poll the Pi 5 node's telemetry API; values freeze when unreachable
  useEffect(() => {
    if (connectionMode !== 'ONLINE_PI5') {
      hardwareLinkedRef.current = false;
      setHardwareLinked(false);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch('/api/telemetry', { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        const s = json?.data;
        if (!s || typeof s !== 'object') throw new Error('invalid payload');
        if (cancelled) return;
        hardwareLinkedRef.current = true;
        setHardwareLinked(true);
        if (killSwitchRef.current) return;
        applyPiSnapshot(s);
      } catch {
        if (cancelled) return;
        hardwareLinkedRef.current = false;
        setHardwareLinked(false);
      }
    };
    void poll();
    const id = setInterval(poll, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [connectionMode, applyPiSnapshot]);

  // BroadcastChannel Setup for inter-tab / simulator synchronization
  useEffect(() => {
    try {
      const tChannel = new BroadcastChannel('adas_telemetry_channel');
      const wChannel = new BroadcastChannel('adas_weather_channel');
      const cChannel = new BroadcastChannel('adas_control_channel');

      telemetryChannelRef.current = tChannel;
      weatherChannelRef.current = wChannel;
      controlChannelRef.current = cChannel;

      tChannel.onmessage = (event) => {
        if (!event || !event.data) return;
        applySimFrame(event.data);
      };

      wChannel.onmessage = (event) => {
        if (!event || !event.data) return;
        if (connectionModeRef.current !== 'OFFLINE') return;
        if (event.data.rainLevel !== undefined) setRainLevelState(event.data.rainLevel);
        if (event.data.fogLevel !== undefined) setFogLevelState(event.data.fogLevel);
      };

      cChannel.onmessage = (event) => {
        const d = event?.data;
        if (!d || typeof d !== 'object') return;
        if (connectionModeRef.current !== 'OFFLINE') return;
        // Night toggled from inside the simulator UI (fullscreen view)
        if (d.type === 'nightState' && typeof d.enabled === 'boolean') {
          setNightMode(prev => (prev === d.enabled ? prev : d.enabled));
        }
      };

      return () => {
        tChannel.close();
        wChannel.close();
        cChannel.close();
        telemetryChannelRef.current = null;
        weatherChannelRef.current = null;
        controlChannelRef.current = null;
      };
    } catch {
      // fallback
    }
  }, [applySimFrame]);

  // Derived environmental metrics
  const rainRate = Number((rainLevel * 9.2).toFixed(1)); // mm/h
  const fogDensityPct = fogLevel * 20; // 0 - 100%
  const lightScatterCoeff = Number((0.08 + (fogLevel * 0.16) + (rainLevel * 0.06)).toFixed(2));
  const baseLux = nightMode ? 40 : 8500;
  const ambientLux = Math.max(15, Math.round(baseLux - (fogLevel * 1200) - (rainLevel * 600) + (Math.random() * 40 - 20)));
  const roadWetness = Math.min(100, Math.round(rainLevel * 18 + (fogLevel > 2 ? 15 : 0)));
  const frictionMu = Number(Math.max(0.18, 0.85 - (roadWetness * 0.0062)).toFixed(2));
  const hydroplaningRisk = roadWetness > 65 && speed > 50 ? 'HIGH' : roadWetness > 35 && speed > 40 ? 'MEDIUM' : 'LOW';

  // Anti-glare fallback. When the 3D world is actively driving (OFF mode), the sim
  // owns glare state; the dataset and Pi 5 sources don't report it, so apply locally.
  useEffect(() => {
    const simStreaming = connectionMode === 'OFFLINE'
      && (Date.now() - lastSimMessageTimeRef.current) < 2500;
    if (simStreaming) return;
    if (nightMode && settings.antiGlareShieldAuto) {
      const oncoming = detectedObjects.some(o => o.type === 'VEHICLE' && o.distance < 25);
      setGlareDetected(oncoming);
      setAgsActive(oncoming);
    } else {
      setGlareDetected(false);
      setAgsActive(false);
    }
  }, [connectionMode, nightMode, detectedObjects, settings.antiGlareShieldAuto]);

  // Keep telemetryStateRef in sync with latest state
  telemetryStateRef.current = {
    connectionMode,
    killSwitchActive,
    aebActive,
    speed,
    steerAngle,
    gear,
    lidarDistance,
    lidarSnr,
    fogLevel,
    rainLevel,
    rainRate,
    fogDensityPct,
    ambientLux,
    cpuLoad,
    cpuTemp,
    ramUsage,
    cameraFps,
    inferenceLatency,
    canBusLoad,
    imu,
    fcwState,
    hydroplaningRisk,
    proximityZones,
    detectedObjects,
    settings,
    isSimRunning
  };

  connectionModeRef.current = connectionMode;
  killSwitchRef.current = killSwitchActive;
  settingsRef.current = settings;
  modalOpenRef.current = simulatorModalOpen;
  isSimRunningRef.current = isSimRunning;
  hardwareLinkedRef.current = hardwareLinked;

  // Leaving the 3D-driven mode (OFF) detaches the simulation feed immediately.
  useEffect(() => {
    if (connectionMode === 'OFFLINE') return;
    lastSimMessageTimeRef.current = 0;
    prevAebRef.current = false;
    setSimulationLinked(false);
  }, [connectionMode]);

  // Main dashboard tick running stably every 1000ms.
  // The active source owns the data; without an active source the dashboard stays frozen.
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const mode = connectionMode;
      const simFresh = (now - lastSimMessageTimeRef.current) < 2500;

      if (mode === 'ONLINE_PI5' && !hardwareLinkedRef.current) return; // Pi 5 not connected: frozen
      if (mode === 'OFFLINE' && !simFresh) return;                     // 3D telemetry feed absent: frozen

      setUptimeSeconds(prev => prev + 1);

      const st = telemetryStateRef.current;
      const isSimActive = mode === 'OFFLINE' && simFresh;
      setSimulationLinked(isSimActive);

      if (!killSwitchActive && !isSimRunning && mode === 'OFFLINE') {
        setSpeed(0);
        setGear('P');
        setSteerAngle(0);
        setServoAngle(0);
        setFcwState('FCW: SIMULATION PAUSED');
      }
        // Global Vehicle Health Score computation
        const healthPenalties = (st.aebActive ? 15 : 0) + (st.fogLevel > 3 ? 5 : 0) + (st.rainLevel > 3 ? 5 : 0) + (st.cpuTemp > 65 ? 8 : 0);
        setHealthScore(Math.max(65, 100 - healthPenalties));

        // Append to time-series history
        setHistory(prev => {
          const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false });
          const pedObj = st.detectedObjects?.find((o: any) => o.type === 'PEDESTRIAN');
          const vehObj = st.detectedObjects?.find((o: any) => o.type === 'VEHICLE');
          const potholeObj = st.detectedObjects?.find((o: any) => o.type === 'POTHOLE');
          const irZone = st.proximityZones?.find((z: any) => z.sensorType?.includes('IR'));
          const irTriggered = irZone && irZone.distance < 1.0 ? 1 : 0;

          const pmBase = 22 + (st.fogLevel * 12) + (st.rainLevel * 3.5);
          const currentServo = st.aebActive ? 90 : Math.max(0, Math.min(90, Math.round((1 - (Math.min(st.lidarDistance, 8) / 8)) * 90)));

          const newPt: TelemetryDataPoint = {
            timestamp: nowStr,
            timeSec: Math.floor(Date.now() / 1000) % 3600,
            speed: st.speed,
            steerAngle: st.steerAngle,
            gear: st.gear,
            lidarDistance: st.lidarDistance,
            lidarSnr: st.lidarSnr,
            leftClearance: st.proximityZones.find((z: any) => z.direction === 'Side Left')?.distance || 1.2,
            rightClearance: st.proximityZones.find((z: any) => z.direction === 'Side Right')?.distance || 2.4,
            rearClearance: st.proximityZones.find((z: any) => z.direction === 'Rear Center')?.distance || 5.0,
            rainLevel: st.rainLevel,
            rainRate: st.rainRate,
            fogLevel: st.fogLevel,
            fogDensityPct: st.fogDensityPct,
            ambientLux: st.ambientLux,
            cpuLoad: st.cpuLoad,
            cpuTemp: st.cpuTemp,
            ramUsage: st.ramUsage,
            cameraFps: st.cameraFps,
            inferenceLatency: st.inferenceLatency,
            canBusLoad: st.canBusLoad,
            threatIndex: st.aebActive ? 95 : st.lidarDistance < 3 ? 75 : st.lidarDistance < 6 ? 40 : 12,
            accelX: st.imu.ax,
            accelY: st.imu.ay,
            accelZ: st.imu.az,
            gyroZ: st.imu.gz,
            aebActive: st.aebActive,
            fcwState: st.fcwState,
            pm25: Number((pmBase + (Math.random() * 4 - 2)).toFixed(1)),
            pm10: Number((pmBase * 1.8 + (Math.random() * 6 - 3)).toFixed(1)),
            irDetected: irTriggered,
            servoAngle: currentServo,
            pedConfidence: pedObj?.confidence || Math.round(95 + Math.random() * 3),
            vehConfidence: vehObj?.confidence || Math.round(97 + Math.random() * 2),
            potholeConfidence: potholeObj?.confidence || Math.round(88 + Math.random() * 4),
            gpsLat: Number((28.6139 + (prev.length * 0.00008) + (Math.random() * 0.00002)).toFixed(5)),
            gpsLng: Number((77.2090 + (prev.length * 0.00006) + (Math.random() * 0.00002)).toFixed(5)),
          };
          const updated = [...prev, newPt];
          return updated.length > 50 ? updated.slice(updated.length - 50) : updated;
        });
    }, 1000);

    return () => clearInterval(interval);
  }, [
    connectionMode,
    killSwitchActive,
    isSimRunning,
    addEventLog
  ]);

  return (
    <TelemetryContext.Provider
      value={{
        activeTab,
        setActiveTab,
        connectionMode,
        setConnectionMode,
        killSwitchActive,
        toggleKillSwitch,
        simulatorModalOpen,
        setSimulatorModalOpen,
        criticalHazardModal,
        dismissHazardModal,

        speed,
        steerAngle,
        gear,
        heading,
        lidarDistance,
        lidarSignal,
        lidarSnr,
        healthScore,
        fcwState,
        aebActive,
        lkaActive,
        accActive,
        agsActive,
        servoAngle,
        cameraFps,
        inferenceLatency,
        detectedObjects,
        proximityZones,

        rainLevel,
        fogLevel,
        rainRate,
        fogDensityPct,
        ambientLux,
        lightScatterCoeff,
        roadWetness,
        frictionMu,
        hydroplaningRisk,
        nightMode,
        daylightMode,
        glareDetected,
        setRainLevel,
        setFogLevel,
        toggleNightMode,
        toggleDaylightMode,
        isSimRunning,
        toggleSimRunning,
        simulationLinked,
        hardwareLinked,

        cpuTemp,
        cpuLoad,
        ramUsage,
        latencyMs,
        packetDeliveryRate,
        uptimeSeconds,
        canBusLoad,

        imu,
        gps,

        settings,
        updateSettings,
        triggerManualAEB,
        releaseAEB,
        testPiezoBeep,
        speakVoiceAlert,

        history,
        eventLogs,
        acknowledgeLog,
        clearLogs,
      }}
    >
      {children}
    </TelemetryContext.Provider>
  );
};

export const useTelemetry = () => {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
};
