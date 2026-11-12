export type NavigationTab = 
  | 'command-center' 
  | 'sensor-matrix' 
  | 'ai-perception' 
  | 'data-sheet' 
  | 'threat-actuation' 
  | 'diagnostics-logs';

export type ConnectionMode = 'ONLINE_PI5' | 'SIMULATION' | 'OFFLINE';

export type ThreatLevel = 'CLEAR' | 'SAFE' | 'CAUTION' | 'WARNING' | 'CRITICAL';

export interface DetectedObject {
  id: string;
  type: 'VEHICLE' | 'PEDESTRIAN' | 'POTHOLE' | 'TRAFFIC_SIGN';
  label: string;
  confidence: number; // 0 - 100
  distance: number; // meters
  x: number; // percentage in viewport 0-100
  y: number; // percentage in viewport 0-100
  width: number;
  height: number;
  velocity?: number; // km/h
}

export interface ProximitySensorZone {
  id: string;
  zone: string;
  direction: 'Front Center' | 'Front Left' | 'Front Right' | 'Side Left' | 'Side Right' | 'Rear Left' | 'Rear Right' | 'Rear Center';
  sensorType: 'TF-Luna LiDAR' | 'IR Optical Array' | 'Ultrasonic Transceiver';
  distance: number; // meters
  minClearance: number; // meters
  maxRange: number; // meters
  obstacleDetected: boolean;
  threatLevel: ThreatLevel;
  lastTriggerTime: string;
}

export interface TelemetryDataPoint {
  timestamp: string;
  timeSec: number;
  speed: number; // km/h
  steerAngle: number; // deg
  gear: 'P' | 'R' | 'N' | 'D';
  lidarDistance: number; // m
  lidarSnr: number; // dB
  leftClearance: number; // m
  rightClearance: number; // m
  rearClearance: number; // m
  rainLevel: number; // 0 - 5
  rainRate: number; // mm/h
  fogLevel: number; // 0 - 5
  fogDensityPct: number; // %
  ambientLux: number; // lux
  cpuLoad: number; // %
  cpuTemp: number; // °C
  ramUsage: number; // %
  cameraFps: number;
  inferenceLatency: number; // ms
  canBusLoad: number; // %
  threatIndex: number; // 0 - 100
  accelX: number; // g
  accelY: number; // g
  accelZ: number; // g
  gyroZ: number; // deg/s
  aebActive: boolean;
  fcwState: string;
  pm25?: number; // µg/m³
  pm10?: number; // µg/m³
  irDetected?: number; // 0 or 1
  servoAngle?: number; // deg (0 - 90)
  pedConfidence?: number; // %
  vehConfidence?: number; // %
  potholeConfidence?: number; // %
  gpsLat?: number;
  gpsLng?: number;
}

export interface DiagnosticEventLog {
  id: string;
  timestamp: string;
  severity: 'CRITICAL' | 'WARNING' | 'CAUTION' | 'INFO';
  category: 'LIDAR' | 'AEB' | 'VISION' | 'WEATHER' | 'SYSTEM' | 'CAN_BUS';
  message: string;
  metricValue?: string;
  acknowledged?: boolean;
}

export interface AdasSettings {
  fcwSensitivity: 'Conservative' | 'Balanced' | 'Aggressive';
  aebThresholdMeters: number; // default 1.8m
  lkaEnabled: boolean;
  lkaDriftThresholdDeg: number; // 8 deg
  accEnabled: boolean;
  accTimeGapSec: number; // 1.5s
  antiGlareShieldAuto: boolean;
  piezoVolume: number; // 0 - 100%
  piezoFrequency: number; // Hz (e.g. 2400Hz)
  ledPattern: 'OFF' | 'FLASH_RED' | 'STROBE_AMBER' | 'SOLID_BLUE' | 'SEQUENTIAL_HAZARD';
  voiceAlertsEnabled: boolean;
}
