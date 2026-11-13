# PRAVAH Frontend — Handoff

This document explains how the React dashboard is organized, where state lives, how it is wired to the Three.js simulation, and what to watch out for when changing it.

---

## 1. Runtime overview

- **Framework:** React 19 + TypeScript, built with Vite 8.
- **Entry:** `frontend/main.tsx` mounts `<App />` inside `<TelemetryProvider>`.
- **Routing:** no router. `activeTab` in `TelemetryContext` selects one of six views.
- **Primary state:** a single context, `TelemetryContext`, owns telemetry, settings, history, logs, modals and audio.
- **Simulation:** an iframe (`public/assets/simulation/adas-world.html`) runs a Three.js world and streams telemetry over `BroadcastChannel`.
- **Backend calls:** only two — `POST /api/daylight-mode` and `POST /api/simulation/state`. In DEMO mode, all live values come from the 3D simulation; PI 5 mode uses the local fallback and OFF freezes updates.

```
main.tsx
└── App.tsx
    └── TelemetryProvider (frontend/context/TelemetryContext.tsx)
        └── DashboardContent
            ├── LeftNavigationDrawer
            ├── TopHeader
            ├── main
            │   ├── CommandCenterView        (always mounted, hidden on other tabs)
            │   └── active view              (sensor-matrix / ai-perception / data-sheet / …)
            ├── footer telemetry ribbon
            ├── CriticalHazardModal
            └── SimulatorModal
```

`CommandCenterView` stays mounted even when another tab is active. This is deliberate: unmounting it would remove the embedded simulator and stop the telemetry feed.

---

## 2. State ownership

| State | Owner | Notes |
| --- | --- | --- |
| Data stream mode | `TelemetryContext` | `DEMO` (`SIMULATION`) lets the 3D world own the dashboard; `PI 5` and `OFF` do not |
| Vehicle physics, collisions, LiDAR rays | Simulator (`adas-world.html`) | Broadcast at ~10 Hz; accepted only in DEMO |
| Speed, steering, gear, heading, range | `TelemetryContext` | Written by `applySimFrame` (DEMO) or the fallback loop |
| 8 proximity zones | `TelemetryContext` | Derived from simulator `sectors` in DEMO, mock otherwise |
| Weather sliders | `TelemetryContext` (site authoritative) | Persisted in `localStorage` |
| Night mode | `TelemetryContext` (site authoritative) | Simulator can echo a toggle back |
| AEB / FCW / servo | Simulator, with site override | Manual AEB sends a control message |
| Kill switch | `TelemetryContext` → simulator | Site freezes telemetry while active |
| Pi 5 hardware metrics | `TelemetryContext` | Locally modelled, weather-aware |
| History | `TelemetryContext` | 50 client points, appended every 1 s |
| Event logs | `TelemetryContext` | Newest first, capped at 100 |
| Settings | `TelemetryContext` | Pushed to simulator via `config` |
| Backend snapshot/history/logs | `backend/telemetryService.ts` | Independent REST feed, not the UI source |

---

## 3. `TelemetryContext` API

Import with:

```ts
import { useTelemetry } from '../context/TelemetryContext';
```

### Navigation and system

| Key | Type | Purpose |
| --- | --- | --- |
| `activeTab` | `NavigationTab` | Current view |
| `setActiveTab` | `(tab) => void` | Switch view |
| `connectionMode` | `ONLINE_PI5 \| SIMULATION \| OFFLINE` | Data stream mode; default `SIMULATION` (DEMO) |
| `setConnectionMode` | `(mode) => void` | Change mode |
| `killSwitchActive` | `boolean` | Actuator lock |
| `toggleKillSwitch` | `() => void` | Engage/release lock |
| `simulatorModalOpen` | `boolean` | Fullscreen modal |
| `setSimulatorModalOpen` | `(open) => void` | Open/close modal |
| `criticalHazardModal` | `{ isOpen, reason, minDistance, severity }` | Hazard dialog |
| `dismissHazardModal` | `() => void` | Acknowledge |

### Vehicle telemetry

| Key | Type | Unit / range |
| --- | --- | --- |
| `speed` | number | km/h |
| `steerAngle` | number | degrees |
| `gear` | `P \| R \| N \| D` | — |
| `heading` | number | 0–360° |
| `lidarDistance` | number | metres (clamped 0–12) |
| `lidarSignal` | number | % |
| `lidarSnr` | number | dB |
| `healthScore` | number | 0–100 |
| `fcwState` | string | FCW message |
| `aebActive` | boolean | — |
| `lkaActive` | boolean | — |
| `accActive` | boolean | — |
| `agsActive` | boolean | Anti-glare shield |
| `servoAngle` | number | 0–90° |
| `cameraFps` | number | — |
| `inferenceLatency` | number | ms |
| `detectedObjects` | `DetectedObject[]` | Vision detections |
| `proximityZones` | `ProximitySensorZone[]` | 8 zones |

### Weather and environment

| Key | Type | Notes |
| --- | --- | --- |
| `rainLevel`, `fogLevel` | number | 0–5 |
| `rainRate` | number | mm/h (`rainLevel * 9.2`) |
| `fogDensityPct` | number | `fogLevel * 20` |
| `ambientLux` | number | derived from night/day + weather |
| `lightScatterCoeff` | number | derived |
| `roadWetness` | number | % |
| `frictionMu` | number | 0.18–0.85 |
| `hydroplaningRisk` | `LOW \| MEDIUM \| HIGH` | derived from wetness + speed |
| `nightMode` | boolean | Night scene |
| `daylightMode` | boolean | Site theme |
| `glareDetected` | boolean | From simulation |
| `setRainLevel`, `setFogLevel` | `(level) => void` | Persists + broadcasts |
| `toggleNightMode` | `() => void` | Pushes `night` control |
| `toggleDaylightMode` | `() => void` | Theme + backend |

### Simulation and hardware

| Key | Type | Notes |
| --- | --- | --- |
| `isSimRunning` | boolean | Site pause state |
| `toggleSimRunning` | `() => void` | Pushes pause + backend state |
| `simulationLinked` | boolean | Live frames received in last 2.5 s |
| `cpuTemp`, `cpuLoad`, `ramUsage` | number | Pi 5 stats |
| `latencyMs`, `packetDeliveryRate` | number | Pi 5 stats |
| `uptimeSeconds`, `canBusLoad` | number | Pi 5 stats |
| `imu` | `{ ax, ay, az, gx, gy, gz }` | From simulator |
| `gps` | `{ lat, lng, satellites, alt, fix }` | From simulator |

### Controls, history, logs

| Key | Type | Notes |
| --- | --- | --- |
| `settings` | `AdasSettings` | ADAS config |
| `updateSettings` | `(partial) => void` | Merge settings |
| `triggerManualAEB` | `() => void` | Alarm + log + control message |
| `releaseAEB` | `() => void` | Release + log |
| `testPiezoBeep` | `() => void` | Web Audio test |
| `speakVoiceAlert` | `(phrase) => void` | Speech Synthesis |
| `history` | `TelemetryDataPoint[]` | Last 50 points, 1 Hz |
| `eventLogs` | `DiagnosticEventLog[]` | Newest first, max 100 |
| `acknowledgeLog` | `(id) => void` | Mark acknowledged |
| `clearLogs` | `() => void` | Empty log list |

---

## 4. Component map

| File | Responsibility |
| --- | --- |
| `frontend/App.tsx` | App shell, tab rendering, always-mounted Command Center, footer ribbon, global modals |
| `frontend/components/layout/LeftNavigationDrawer.tsx` | Desktop/mobile navigation, connection mode, kill switch |
| `frontend/components/layout/TopHeader.tsx` | Clock, link state, AEB controls, notifications, theme/night toggles |
| `frontend/components/views/CommandCenterView.tsx` | Primary dashboard and embedded 3D simulation |
| `frontend/components/views/SensorMatrixView.tsx` | 8-zone proximity matrix and radar |
| `frontend/components/views/AiPerceptionView.tsx` | Embedded road-vision engine (the whole AI Perception view) |
| `frontend/components/ai-perception/RoadVehicleDetector.tsx` | Video/canvas perception engine: optical flow, NMS tracking, FCW, BSD, potholes, CSV telemetry |
| `frontend/components/ai-perception/ConfidenceHistoryChart.tsx` | D3.js temporal stability and spatial hazard-density charts |
| `frontend/components/ai-perception/HistoricalAlertsSidePanel.tsx` | Critical-alert drawer with jump-to-timestamp and acknowledgements |
| `frontend/components/views/DataSheetEnvironmentView.tsx` | Weather, environment tables, CSV/JSON export |
| `frontend/components/views/ThreatActuationView.tsx` | ADAS settings, actuator state, buzzer/LED/voice tests |
| `frontend/components/views/DiagnosticsLogsView.tsx` | Logs, charts, IMU/GPS, system health |
| `frontend/components/radar/RadarSurroundingsViewport.tsx` | Animated radar sweep with zone markers |
| `frontend/components/simulation/AdasWorldSimulation.tsx` | Iframe wrapper, panel controls, drive pad, settings sync |
| `frontend/components/simulation/Custom3dSimulation.tsx` | Alternate `DIGITAL TWIN` engine used in the modal |
| `frontend/components/modals/SimulatorModal.tsx` | Fullscreen simulator, engine selector (`adas-world` default) |
| `frontend/components/modals/CriticalHazardModal.tsx` | Critical AEB/hazard dialog |
| `frontend/context/TelemetryContext.tsx` | All shared state and simulation wiring |
| `frontend/utils/audioSynthesizer.ts` | Web Audio alarms, piezo tones, speech synthesis |
| `frontend/utils/exportCsv.ts` | CSV/JSON download helpers |
| `frontend/types/telemetry.ts` | Shared types and tab union |

### Road-vision engine (AI Perception)

`AiPerceptionView` is a thin shell around a self-contained video perception console. The console is ported from the standalone road-vision prototype and lives entirely in `frontend/components/ai-perception/`:

- `RoadVehicleDetector.tsx` — owns the `<video>`, hidden compute canvas and overlay canvas. It tracks vehicles with IoU/NMS and a counting line, finds potholes/pedestrians, derives FCW/BSD/blind-corner/unstructured-road state, and logs 30-frame telemetry.
- `ConfidenceHistoryChart.tsx` — D3.js temporal confidence plot plus 2D hazard heatmap. Chart width is clamped to at least 320 px so narrow viewports cannot produce negative SVG sizes.
- `HistoricalAlertsSidePanel.tsx` — alert drawer with timestamp jump, filters and acknowledgements.
- `types.ts` — `VisionTabType` union for the four sub-tabs.

The sample video is `public/assets/road-vision/demo.mp4` (about 21 MB, 1280×720, 18 s, looped). It is served as a static asset and copied into `dist/` on build. The engine does not touch `TelemetryContext`; it is an independent perception lab, so it never competes with the 3D world for dashboard telemetry. It starts paused — press **Play & Detect** to run the detection loop.

---

## 5. Simulation wiring

### Iframe

`AdasWorldSimulation` renders:

```
/assets/simulation/adas-world.html?embed=1&instance=embedded
/assets/simulation/adas-world.html?embed=0&instance=modal
```

- `embed=1` applies compact HUD CSS and hides the simulator's own navbar/control deck.
- `instance` separates the two engines so telemetry and commands do not cross.

On iframe load, it re-sends config, weather, night, camera and pause state at 250 ms and 1200 ms to cover module startup timing.

### Channels

| Channel | Direction | Payload |
| --- | --- | --- |
| `adas_telemetry_channel` | sim → site | Full telemetry frame (see README) |
| `adas_control_channel` | site ↔ sim | `drive`, `brake`, `camera`, `weather`, `night`, `pause`, `kill`, `aeb`, `config`, `reset`, plus `nightState` from sim |
| `adas_weather_channel` | site ↔ sim | `{ rainLevel?, fogLevel? }` |

Control messages from the wrapper include `target: instance`. Simulator messages include `instance`; the context uses this to ignore stale or competing frames:

```ts
if (connectionModeRef.current !== 'SIMULATION') return; // DEMO only
if (d.instance === 'modal' && !modalOpenRef.current) return;
if (d.instance === 'embedded' && modalOpenRef.current) return;
```

Effectively:

| Mode | Telemetry source | Simulator panel |
| --- | --- | --- |
| `SIMULATION` (DEMO) | 3D world, falling back to mock if stale | `LIVE FEED` / `PAUSED` / `CONNECTING` |
| `ONLINE_PI5` (PI 5) | Local fallback loop | `VIEW ONLY` |
| `OFFLINE` (OFF) | No updates; last values freeze | `VIEW ONLY` |

### Frame application

`applySimFrame(d)`:

1. Aborts unless `connectionMode` is `SIMULATION` (DEMO).
2. Marks the link live and updates `lastSimMessageTimeRef`.
3. Aborts if the kill switch is engaged (link stays live, values freeze).
4. Clamps speed/steer/heading and writes them.
5. Maps `sectors` into the 8 `proximityZones`, deriving threat levels from each zone's max range.
6. Sanitises the detection list (type, confidence, position, size, velocity) and writes up to 8 objects.
7. Writes AEB, FCW, servo, glare, AGS, IMU and GPS.
8. Derives LKA/ACC from settings and current steering/speed.
9. Announces automatic AEB transitions with an alarm, optional voice alert and an event log (rate-limited to one every 3 s).

### Stale-link fallback

A 1 Hz interval in the context does the following:

- increments uptime;
- tracks the live link only in DEMO mode;
- marks `simulationLinked` false when the mode is not DEMO or frames are older than 2.5 s;
- runs the mock cruise loop whenever the 3D world is not actively driving (PI 5, or a stale DEMO link);
- recomputes LiDAR SNR/signal, FPS, latency, CAN load, CPU/RAM, health and history;
- runs mock AEB/FCW logic and hazard modal triggers when the simulation is not driving.

In `OFFLINE` mode the interval returns early, so values and uptime freeze. Switching out of DEMO also resets `lastSimMessageTimeRef` and clears the AEB transition latch so the fallback takes over immediately.

This fallback is why the dashboard remains usable with the iframe blocked, hidden, or deliberately set to view-only.

### Weather/night authority

The dashboard owns the controls:

- `setRainLevel` / `setFogLevel` update state, `localStorage`, and broadcast on both weather and control channels.
- `toggleNightMode` computes the next value **outside** the state updater (StrictMode safety) and sends `night`.
- A toggle inside the iframe sends `nightState`; in DEMO mode the context applies it without echoing another control message.
- On arrival, weather is also received on `adas_weather_channel`. In DEMO mode the context listens and updates display state; in PI 5/OFF modes simulator echoes are ignored.

### Modal behavior

- `SimulatorModal` defaults to `adas-world`.
- The embedded instance is paused while the modal is open (`pause: { paused: true }`), so only the modal engine drives telemetry.
- Closing the modal resumes the embedded instance.
- `DIGITAL TWIN` (`Custom3dSimulation`) is a separate visual engine and does not implement the same broadcast protocol.

---

## 6. Playback and telemetry history

- The context appends one `TelemetryDataPoint` per second inside the 1 Hz interval.
- It keeps the last **50** points.
- Seed history (20 points) is generated at startup so charts are not empty.
- History includes speed, steering, LiDAR, weather, Pi metrics, IMU, confidence, GPS, AEB/FCW and derived threat index.
- The UI reads `history` directly; there is no client-side chart simulation beyond the one appended point.

---

## 7. Logs and alarms

`addEventLog` prepends entries and trims to 100. Categories: `LIDAR`, `AEB`, `VISION`, `WEATHER`, `SYSTEM`, `CAN_BUS`. Severities: `CRITICAL`, `WARNING`, `CAUTION`, `INFO`.

Audio:

- `audioSynth.playEmergencyAlarm()` — AEB/kill switch.
- `audioSynth.playPiezoBeep(freq, duration, volume)` — test tone.
- `audioSynth.speakAlert(text)` — optional voice alert.

Browsers require a user gesture before audio can start; the synth resumes a suspended `AudioContext` on first use.

---

## 8. Styling and theming

- Tailwind CSS 4 with the `@tailwindcss/vite` plugin.
- Theme variables live in `frontend/index.css` (`:root` for daylight, `html.dark` for cyber dark).
- `daylightMode` toggles `dark` / `daylight` classes on `<html>` and persists to `localStorage` (`pravah_daylight_mode`).
- Shared classes: `glass-panel`, `glass-panel-glow`, `glass-panel-danger`, `bg-grid-pattern`, `animate-hazard`, `animate-radar-sweep`.
- Fonts: Chakra Petch (display), JetBrains Mono (telemetry), Plus Jakarta Sans (body), loaded in `index.html`.
- The dashboard intentionally mixes Tailwind `dark:` variants and runtime `daylightMode` checks. When adding a component, support both themes and check contrast in each.

---

## 9. Local persistence summary

| Key | Stored by | Purpose |
| --- | --- | --- |
| `adas_rain` | context + simulator | Rain level 0–5 |
| `adas_fog` | context + simulator | Fog level 0–5 |
| `pravah_daylight_mode` | context | `"true"` when daylight theme active |

Clear these keys when testing to start from a clean state.

---

## 10. Extending the dashboard

### Add a telemetry value from the simulator

1. Emit the field in `adas-world.html` inside `processADASInference` (the telemetry `postMessage`).
2. Add it to the context interface and state in `TelemetryContext.tsx`.
3. Write it in `applySimFrame`, with a type guard and clamp.
4. Include it in `telemetryStateRef.current` so history/fallback can use it.
5. Consume it in the relevant view.

### Add a control

1. Add a `case` in `initControlChannel` in `adas-world.html`.
2. Send it from `AdasWorldSimulation` with a `target`.
3. If it is site-persistent, store it in context/localStorage and re-sync it in `syncSimulator`.

### Add a view

1. Add the id to `NavigationTab` in `frontend/types/telemetry.ts`.
2. Add the entry to `LeftNavigationDrawer`.
3. Add a `case` in `App.tsx`.
4. Read state via `useTelemetry()`; do not create a second telemetry provider.

### Change AEB behavior

- Site setting: `settings.aebThresholdMeters` in `ThreatActuationView`.
- Simulator threshold: pushed as `config.aebThreshold`; the simulator clamps 0.5–30 m.
- Site fallback logic uses the same setting only when no live simulation is present.
- The simulator's default threshold is 2.0 m; the site default is 1.8 m, and syncing the site config applies the site value.

---

## 11. Testing checklist

1. `npm run lint` — TypeScript clean.
2. `npm run build` — production bundle builds.
3. Command Center — `LIVE FEED`, moving speed and range (DEMO default).
4. Data stream modes — `PI 5` shows `VIEW ONLY` and stops sim control; `DEMO` reconnects; `OFF` freezes values.
5. Drive pad — accelerate, steer, reverse, brake.
6. Keyboard inside iframe — `W/A/S/D`, arrows, `Space`, `1/2` camera.
7. Pause/resume — speed 0 and `FCW: SIMULATION PAUSED` while paused.
8. Manual AEB/release — 0 km/h, 90° servo, log entry, alarm.
9. Automatic AEB — drive into a vehicle at a low threshold and confirm the transition log fires once.
10. Night — scene change and glare/AGS with oncoming traffic.
11. Weather — sliders propagate to both instances and site cards update.
12. Proximity zones — warnings escalate as the car closes in.
13. Tab switching — telemetry and history continue while other views are open.
14. Fullscreen — modal drives telemetry; embedded pauses; closing resumes it.
15. Kill switch — actuators freeze; releasing restores the feed.
16. Theme — daylight/dark both render correctly; preference survives reload.
17. Audio — piezo test and AEB alarm work after a user gesture.
18. Road-vision engine — the sample video loads, **Play & Detect** starts overlays, the four sub-tabs render, and the stability tab shows D3 charts without console errors.

---

## 12. Known gotchas

- **StrictMode double-invocation:** never put channel posts, `fetch`, or other side effects inside a `setState` updater. Follow the `toggleNightMode`/`toggleSimRunning`/`toggleKillSwitch` pattern: compute next value from closure state, set state, then send.
- **Iframe focus:** raw keyboard input only works when the iframe document has focus. The drive pad exists specifically to avoid this limitation.
- **Rendering vs. physics:** the simulator's physics runs on `setInterval(33)`, rendering on `requestAnimationFrame`. Telemetry continues even when the iframe is hidden or the host pane is not painting. Do not move physics into the render loop.
- **Road-vision console is dark by design:** the video perception panel keeps its own dark chrome in both themes, like a camera wall. The surrounding card adapts to the PRAVAH theme.
- **21 MB sample video:** `demo.mp4` is large by design. If you deploy over a slow link, replace it with a smaller clip or host it behind a CDN; the component only needs `videoSrcUrl` to change.
- **Vision engine is independent:** it does not read or write `TelemetryContext`. Do not wire it to `detectedObjects` — it has its own optical-flow pipeline.
- **Mode gating:** `applySimFrame` and the simulator weather/night echoes return early unless `connectionMode === 'SIMULATION'`. Keep this guard; otherwise PI 5 and OFF modes are silently overwritten by the 3D world. The mode is read through `connectionModeRef` so the channel listener does not need re-subscribing.
- **Leaving DEMO:** an effect resets `lastSimMessageTimeRef` and `prevAebRef` when the mode changes away from DEMO, so the fallback loop and AEB announcements take over immediately.
- **Simulator panel status:** `AdasWorldSimulation` shows `VIEW ONLY` outside DEMO, regardless of whether frames are arriving, and `LIVE FEED`/`PAUSED`/`CONNECTING` inside DEMO.
- **Two instances:** always include `target`/`instance`; otherwise the embedded and modal engines will both react and telemetry will oscillate.
- **Modal gating:** the embedded instance is paused while the modal is open by design. If you change `syncSimulator`, preserve this rule. This gating only affects which instance drives telemetry while DEMO is selected.
- **Site vs. simulator defaults:** site AEB default is 1.8 m; simulator default is 2.0 m. The site config wins after sync.
- **Forward range clamp:** the site clamps forward LiDAR to 12 m for display while the simulator ranges up to 50 m.
- **Weather echo loop:** both site and simulator post weather. The site only updates local display state on echo in DEMO and does not re-broadcast on every echo, which avoids feedback loops. Keep it that way.
- **`applySimFrame` is memoised** with `addEventLog`; it reads mutable state through refs (`connectionModeRef`, `killSwitchRef`, `modalOpenRef`, `settingsRef`, `prevAebRef`). Use refs instead of adding dependencies that would rebuild the channel listener.
- **Backend is not the live feed:** `/api/telemetry` is a separate 1 Hz engine. Do not wire views to it expecting the 3D world's values.
- **`CommandCenterView` is always mounted:** avoid expensive duplicate subscriptions inside it; it runs even when hidden.
- **Web Audio:** audio only starts after a user gesture; test accordingly.
- **localStorage weather:** tests can inherit previous rain/fog values. Clear `adas_rain` / `adas_fog` for reproducible runs.
- **Browser support:** `BroadcastChannel` is required. Very old browsers fall back to the mock loop, not a live sim.

---

## 13. File ownership quick reference

| Concern | File |
| --- | --- |
| Telemetry schema and clamping | `frontend/context/TelemetryContext.tsx` |
| Simulator payload and physics | `public/assets/simulation/adas-world.html` |
| Iframe lifecycle and controls | `frontend/components/simulation/AdasWorldSimulation.tsx` |
| Modal and engine choice | `frontend/components/modals/SimulatorModal.tsx` |
| Theme tokens | `frontend/index.css` |
| Road-vision engine and sample video | `frontend/components/ai-perception/`, `public/assets/road-vision/demo.mp4` |
| Shared types | `frontend/types/telemetry.ts` |
| Alarm and voice synthesis | `frontend/utils/audioSynthesizer.ts` |
| Exports | `frontend/utils/exportCsv.ts` |
