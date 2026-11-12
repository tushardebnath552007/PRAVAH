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
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('ONLINE_PI5');
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
  const lastAlarmTimeRef = useRef<number>(0);
  const lastHazardAckRef = useRef<number>(0);
  const lastSimMessageTimeRef = useRef<number>(0);
  const telemetryStateRef = useRef<any>({});

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
  }, []);

  const setFogLevel = useCallback((lvl: number) => {
    const val = Math.min(5, Math.max(0, lvl));
    setFogLevelState(val);
    localStorage.setItem('adas_fog', val.toString());
    weatherChannelRef.current?.postMessage({ fogLevel: val });
  }, []);

  const toggleNightMode = useCallback(() => {
    setNightMode(prev => !prev);
  }, []);

  const toggleDaylightMode = useCallback(() => {
    setDaylightMode(prev => !prev);
  }, []);

  const toggleSimRunning = useCallback(() => {
    setIsSimRunning(prev => {
      const next = !prev;
      try {
        fetch('/api/simulation/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ running: next }),
        }).catch(() => {});
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const updateSettings = useCallback((newSettings: Partial<AdasSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // Emergency actions
  const triggerManualAEB = useCallback(() => {
    setAebActive(true);
    setSpeed(0);
    setServoAngle(90); // 90° Emergency Brake servo position
    setFcwState('FCW: EMERGENCY BRAKING OVERRIDE (AEB)');
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
    addEventLog({
      timestamp: new Date().toLocaleTimeString(),
      severity: 'INFO',
      category: 'AEB',
      message: 'AEB brake released. Normal drive actuation restored.',
      metricValue: 'Servo: 0°'
    });
  }, [addEventLog]);

  const toggleKillSwitch = useCallback(() => {
    setKillSwitchActive(prev => {
      const next = !prev;
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
      return next;
    });
  }, [addEventLog]);

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

  // BroadcastChannel Setup for inter-tab / simulator synchronization
  useEffect(() => {
    try {
      const tChannel = new BroadcastChannel('adas_telemetry_channel');
      const wChannel = new BroadcastChannel('adas_weather_channel');

      telemetryChannelRef.current = tChannel;
      weatherChannelRef.current = wChannel;

      tChannel.onmessage = (event) => {
        if (!event || !event.data || killSwitchActive) return;
        lastSimMessageTimeRef.current = Date.now();
        const d = event.data;

        if (d.speed !== undefined) {
          const s = Math.round(Math.abs(d.speed));
          setSpeed(prev => (prev === s ? prev : s));
        }
        if (d.steer !== undefined) {
          const st = Number(d.steer);
          setSteerAngle(prev => (Math.abs(prev - st) < 0.5 ? prev : st));
        }
        if (d.gear !== undefined) {
          setGear(prev => (prev === d.gear ? prev : d.gear));
        }
        if (d.minDistance !== undefined) {
          const mDist = parseFloat(d.minDistance);
          setLidarDistance(prev => (Math.abs(prev - mDist) < 0.05 ? prev : mDist));
        }
        if (d.aebActive !== undefined) {
          setAebActive(prev => (prev === d.aebActive ? prev : d.aebActive));
        }
        if (d.fcwState !== undefined) {
          setFcwState(prev => (prev === d.fcwState ? prev : d.fcwState));
        }

        if (d.rainLevel !== undefined) {
          setRainLevelState(prev => (prev === d.rainLevel ? prev : d.rainLevel));
        }
        if (d.fogLevel !== undefined) {
          setFogLevelState(prev => (prev === d.fogLevel ? prev : d.fogLevel));
        }
      };

      wChannel.onmessage = (event) => {
        if (!event || !event.data) return;
        if (event.data.rainLevel !== undefined) setRainLevelState(event.data.rainLevel);
        if (event.data.fogLevel !== undefined) setFogLevelState(event.data.fogLevel);
      };

      return () => {
        tChannel.close();
        wChannel.close();
      };
    } catch {
      // fallback
    }
  }, [killSwitchActive]);

  // Derived environmental metrics
  const rainRate = Number((rainLevel * 9.2).toFixed(1)); // mm/h
  const fogDensityPct = fogLevel * 20; // 0 - 100%
  const lightScatterCoeff = Number((0.08 + (fogLevel * 0.16) + (rainLevel * 0.06)).toFixed(2));
  const baseLux = nightMode ? 40 : 8500;
  const ambientLux = Math.max(15, Math.round(baseLux - (fogLevel * 1200) - (rainLevel * 600) + (Math.random() * 40 - 20)));
  const roadWetness = Math.min(100, Math.round(rainLevel * 18 + (fogLevel > 2 ? 15 : 0)));
  const frictionMu = Number(Math.max(0.18, 0.85 - (roadWetness * 0.0062)).toFixed(2));
  const hydroplaningRisk = roadWetness > 65 && speed > 50 ? 'HIGH' : roadWetness > 35 && speed > 40 ? 'MEDIUM' : 'LOW';

  // Anti-glare check
  useEffect(() => {
    if (nightMode && settings.antiGlareShieldAuto) {
      // If oncoming vehicles present at night
      const oncoming = detectedObjects.some(o => o.type === 'VEHICLE' && o.distance < 25);
      setGlareDetected(oncoming);
      setAgsActive(oncoming);
    } else {
      setGlareDetected(false);
      setAgsActive(false);
    }
  }, [nightMode, detectedObjects, settings.antiGlareShieldAuto]);

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

  // Main simulation tick loop running stably every 1000ms
  useEffect(() => {
    if (connectionMode === 'OFFLINE') return;

    const interval = setInterval(() => {
      setUptimeSeconds(prev => prev + 1);

      const st = telemetryStateRef.current;
      const isSimActive = (Date.now() - lastSimMessageTimeRef.current) < 2500;

      // In simulation or online mode, smoothly fluctuate real-world parameters
      if (!killSwitchActive) {
        if (!isSimRunning) {
          setSpeed(0);
          setGear('P');
          setSteerAngle(0);
          setServoAngle(0);
          setFcwState('FCW: SIMULATION PAUSED');
        } else if (!isSimActive) {
          // Only generate mock cruising changes if real 3D simulator is not actively broadcasting
          if (!st.aebActive) {
            setGear('D');
            setSpeed(prev => {
              const delta = (Math.random() - 0.48) * 3;
              return Math.min(75, Math.max(20, Math.round(prev + delta)));
            });
            setSteerAngle(prev => {
              const s = Number((prev * 0.7 + (Math.random() * 6 - 3)).toFixed(1));
              return Math.min(25, Math.max(-25, s));
            });
            setHeading(prev => (prev + (Math.random() * 1.5 - 0.75) + 360) % 360);
            setServoAngle(prev => Math.min(45, Math.max(0, Math.round(prev * 0.6 + (Math.random() * 6)))));
          } else {
            setServoAngle(90);
            setSpeed(0);
          }

          // TF-Luna LiDAR Distance fluctuation based on forward traffic
          setLidarDistance(prev => {
            if (st.aebActive) return Math.min(prev, 1.2);
            const noise = (Math.random() - 0.49) * 0.6;
            let newDist = prev + noise;
            if (newDist > 16) newDist = 14;
            if (newDist < 0.8) newDist = 1.4;
            return Number(newDist.toFixed(2));
          });
        }

        // Compute LiDAR SNR under atmospheric weather attenuation
        const weatherLoss = (st.fogLevel * 3.2) + (st.rainLevel * 2.1);
        setLidarSnr(Math.max(4, Math.round(44 - (st.lidarDistance * 1.8) - weatherLoss + (Math.random() * 2 - 1))));
        setLidarSignal(Math.max(15, Math.min(99, Math.round(100 - (st.lidarDistance * 3.5) - weatherLoss))));

        // Vision frame rate and inference latency
        const jitter = (Math.random() * 1.2 - 0.6);
        setInferenceLatency(Number(Math.max(11, 13.8 + (st.detectedObjects.length * 0.9) + jitter).toFixed(1)));
        setCameraFps(Math.round(59 + Math.random() * 3));

        // CAN Bus load
        setCanBusLoad(Number((28 + (st.speed * 0.35) + (st.aebActive ? 25 : 0) + (Math.random() * 4)).toFixed(1)));

        // Pi 5 Core metrics
        setCpuLoad(Number((22 + (st.detectedObjects.length * 3.5) + (Math.random() * 4)).toFixed(1)));
        setCpuTemp(Number((46 + (st.fogLevel > 2 ? 3 : 0) + (Math.random() * 2.5)).toFixed(1)));
        setRamUsage(Number((41 + (Math.random() * 2)).toFixed(1)));
        setLatencyMs(Math.round(10 + Math.random() * 5));

        // Update 360° Proximity Zones
        setProximityZones(prev => prev.map(zone => {
          let dist = zone.distance;
          let threat: ThreatLevel = 'SAFE';

          if (zone.id === 'z1') {
            dist = st.lidarDistance;
            if (dist < 1.0) threat = 'CRITICAL';
            else if (dist < 2.0) threat = 'WARNING';
            else if (dist < 4.0) threat = 'CAUTION';
            else threat = 'CLEAR';
          } else {
            const delta = (Math.random() - 0.5) * 0.15;
            dist = Math.max(zone.minClearance, Math.min(zone.maxRange, Number((dist + delta).toFixed(2))));
            if (dist < 0.9) threat = 'WARNING';
            else if (dist < 1.8) threat = 'CAUTION';
            else threat = 'SAFE';
          }

          return {
            ...zone,
            distance: dist,
            obstacleDetected: threat !== 'CLEAR' && threat !== 'SAFE',
            threatLevel: threat,
            lastTriggerTime: threat === 'CRITICAL' || threat === 'WARNING' ? '00:00:01' : zone.lastTriggerTime,
          };
        }));

        // Dynamic Objects movement in camera
        setDetectedObjects(prev => prev.map(obj => {
          let newDist = obj.distance;
          if (obj.type === 'VEHICLE') {
            newDist = Math.max(3.2, Number((obj.distance + (Math.random() * 0.8 - 0.4)).toFixed(1)));
          } else if (obj.type === 'PEDESTRIAN') {
            newDist = Math.max(2.5, Number((obj.distance + (Math.random() * 0.4 - 0.2)).toFixed(1)));
          }
          return {
            ...obj,
            distance: newDist,
            confidence: Math.min(99, Math.max(82, Math.round(obj.confidence + (Math.random() * 2 - 1)))),
          };
        }));

        // FCW and AEB threat logic evaluation if not in real 3D sim override
        if (!isSimActive) {
          if (st.lidarDistance < st.settings.aebThresholdMeters || (st.hydroplaningRisk === 'HIGH' && st.lidarDistance < 3.5)) {
            if (!st.aebActive) {
              setAebActive(true);
              setFcwState('FCW: CRITICAL COLLISION ALERT (AEB ENGAGED)');
              setServoAngle(90);
              
              const now = Date.now();
              if (now - lastAlarmTimeRef.current > 3500) {
                lastAlarmTimeRef.current = now;
                audioSynth.playEmergencyAlarm();
                if (st.settings.voiceAlertsEnabled) {
                  audioSynth.speakAlert('Warning: Critical Distance! Emergency Brake Applied!');
                }
              }

              if (now - lastHazardAckRef.current > 8000) {
                setCriticalHazardModal({
                  isOpen: true,
                  reason: st.hydroplaningRisk === 'HIGH' ? 'HYDROPLANING SEVERE LOSS OF TRACTION' : 'PROXIMITY THREAT BELOW CRITICAL THRESHOLD',
                  minDistance: st.lidarDistance,
                  severity: 'CRITICAL',
                });
              }

              addEventLog({
                timestamp: new Date().toLocaleTimeString(),
                severity: 'CRITICAL',
                category: 'AEB',
                message: `CRITICAL THREAT: Forward obstacle at ${st.lidarDistance}m! Automated emergency braking engaged.`,
                metricValue: `Distance: ${st.lidarDistance}m | Threshold: ${st.settings.aebThresholdMeters}m`
              });
            }
          } else if (st.lidarDistance < 3.8) {
            setFcwState('FCW: WARNING - DISTANCE CLOSING');
          } else if (st.lidarDistance < 6.5) {
            setFcwState('FCW: CAUTION - MONITOR TRAFFIC');
          } else {
            setFcwState('FCW: SYSTEM NOMINAL');
          }
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
      }
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
