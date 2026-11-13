# PRAVAH Frontend — Handoff

This document explains how the React dashboard is organized, where state lives, how it is wired to the Three.js simulation, and what to watch out for when changing it.

---

## 1. Runtime overview

- **Framework:** React 19 + TypeScript, built with Vite 8.
- **Entry:** `frontend/main.tsx` mounts `<App />` inside `<TelemetryProvider>`.
- **Routing:** no router. `activeTab` in `TelemetryContext` selects one of six views.
- **Primary state:** a single context, `TelemetryContext`, owns telemetry, settings, history, logs, modals and audio.
- **Simulation:** an iframe (`public/assets/simulation/adas-world.html`) runs a Three.js world and streams telemetry over `BroadcastChannel`.
- **Backend calls:** two unconditional — `POST /api/daylight-mode` and `POST /api/simulation/state`. PI 5 mode additionally polls `GET /api/telemetry` every second as its source of truth; DEMO values come from the recorded dataset, OFF values from the 3D simulation.

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
| Data stream mode | `TelemetryContext` | `DEMO` (`SIMULATION`) replays the recorded dataset; `OFF` (`OFFLINE`) lets the 3D world own the dashboard; `PI 5` (`ONLINE_PI5`) reads the Pi 5 node API |
| Vehicle physics, collisions, LiDAR rays | Simulator (`adas-world.html`) | Broadcast at ~10 Hz; accepted only in OFF |
| Speed, steering, gear, heading, range | `TelemetryContext` | Written by `applyTelemetryFrame` (DEMO dataset / OFF 3D feed) or `applyPiSnapshot` (PI 5) |
| 8 proximity zones | `TelemetryContext` | Derived from `sectors` in DEMO/OFF; in PI 5 only zone 1 follows hardware LiDAR |
| Weather sliders | `TelemetryContext` (site authoritative) | Persisted in `localStorage` |
| Night mode | `TelemetryContext` (site authoritative) | Simulator can echo a toggle back (OFF mode) |
| AEB / FCW / servo | Active source, with site override | Manual AEB sends a control message |
| Kill switch | `TelemetryContext` → simulator | Site freezes telemetry while active |
| Pi 5 hardware metrics | Dataset / Pi 5 node API | DEMO carries recorded node metrics; PI 5 reads them live; OFF uses the 3D feed |
| History | `TelemetryContext` | 50 client points, appended every 1 s when a source is live |
| Event logs | `TelemetryContext` | Newest first, capped at 100 |
| Settings | `TelemetryContext` | Pushed to simulator via `config` |
| Backend snapshot/history/logs | `backend/telemetryService.ts` | Independent REST feed; drives the UI only in PI 5 mode |

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
| `isSimRunning` | boolean | Pause state (3D sim / dataset replay) |
| `toggleSimRunning` | `() => void` | Pushes pause + backend state |
| `simulationLinked` | boolean | 3D frames received in last 2.5 s (OFF mode) |
| `hardwareLinked` | boolean | `GET /api/telemetry` answered successfully (PI 5 mode); false means frozen |
| `cpuTemp`, `cpuLoad`, `ramUsage` | number | From active source |
| `latencyMs`, `packetDeliveryRate` | number | From active source |
| `uptimeSeconds`, `canBusLoad` | number | From active source |
| `imu` | `{ ax, ay, az, gx, gy, gz }` | From active source |
| `gps` | `{ lat, lng, satellites, alt, fix }` | From active source |

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
if (connectionModeRef.current !== 'OFFLINE') return; // 3D world only in OFF
if (d.instance === 'modal' && !modalOpenRef.current) return;
if (d.instance === 'embedded' && modalOpenRef.current) return;
```

Effectively:

| Mode | Telemetry source | Simulator panel |
| --- | --- | --- |
| `SIMULATION` (DEMO) | Recorded dataset (`/assets/demo-telemetry.json`) replayed on a loop | `VIEW ONLY` |
| `ONLINE_PI5` (PI 5) | Pi 5 node hardware API (`GET /api/telemetry`, polled 1 Hz) | `VIEW ONLY` |
| `OFFLINE` (OFF) | 3D world; dashboard freezes if stale | `LIVE FEED` / `PAUSED` / `CONNECTING` |

DEMO is the default. The simulator panel is view-only outside OFF, but the same iframe is still mounted (Command Center stays mounted for that reason).

### Mode-specific effects in `TelemetryContext`

Three effects implement the sources:

1. **DEMO replay** — active only in `SIMULATION` mode. Fetches `/assets/demo-telemetry.json` once (cached for the session), then applies a frame every 500 ms through `applyTelemetryFrame`. Pausing via `toggleSimRunning` halts the replay. If the dataset fails to load, a warning is logged and the dashboard stays frozen.
2. **PI 5 poll** — active only in `ONLINE_PI5` mode. Polls `GET /api/telemetry` every second. On success, `hardwareLinked` becomes `true` and `applyPiSnapshot` maps the flat snapshot (scalars + forward LiDAR → zone 1 + AEB latch) onto state. On failure, `hardwareLinked` becomes `false` and nothing else happens.
3. **OFF link watchdog** — the 1 Hz tick marks the 3D link stale when frames older than 2.5 s are observed and reminds that only OFF accepts frames.

### Frame application

`applySimFrame(d)` (3D world, OFF mode):

1. Aborts unless `connectionMode` is `OFFLINE`.
2. Marks the link live and updates `lastSimMessageTimeRef`.
3. Aborts if the kill switch is engaged (link stays live, values freeze).
4. Clamps speed/steer/heading and writes them.
5. Maps `sectors` into the 8 `proximityZones`, deriving threat levels from each zone's max range.
6. Sanitises the detection list (type, confidence, position, size, velocity) and writes up to 8 objects.
7. Writes AEB, FCW, servo, glare, AGS, IMU, GPS and node metrics (FPS/latency/CAN/CPU/SNR).
8. Derives LKA/ACC from settings and current steering/speed.
9. Announces automatic AEB transitions with an alarm, optional voice alert and an event log (rate-limited to one every 3 s).

The DEMO dataset replay calls the same application logic through `applyTelemetryFrame` (steps 4–9), while the PI 5 poll calls `applyPiSnapshot`, which writes only the fields the hardware reports.

### Frozen when source is absent

A 1 Hz interval in the context does the following:

- increments uptime **when the selected source is live**;
- tracks the live link only in OFF mode;
- returns early — no values change — when the source is unavailable (`ONLINE_PI5` without a responding Pi 5 node, or `OFFLINE` with frames older than 2.5 s);
- otherwise advances uptime, updates `simulationLinked`, zeroes speed/gear/servo when `isSimRunning` is false in OFF mode, recomputes health and appends history.

There is no mock cruise loop. The dashboard never invents telemetry.

### Weather/night authority

The dashboard owns the controls:

- `setRainLevel` / `setFogLevel` update state, `localStorage`, and broadcast on both weather and control channels.
- `toggleNightMode` computes the next value **outside** the state updater (StrictMode safety) and sends `night`.
- A toggle inside the iframe sends `nightState`; in OFF mode the context applies it without echoing another control message.
- On arrival, weather is also received on `adas_weather_channel`. In OFF mode the context listens and updates display state; in DEMO and PI 5 modes simulator echoes are ignored.

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
3. Write it in `applyTelemetryFrame`, with a type guard and clamp (it feeds both the DEMO dataset and OFF 3D frames).
4. Include it in `telemetryStateRef.current` so history can use it.
5. If the PI 5 node also reports it, add it to `applyPiSnapshot` as well.
6. Consume it in the relevant view.

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
- Site AEB evaluation lives in the active source (dataset/sim carry it); manual AEB works in every mode.
- The simulator's default threshold is 2.0 m; the site default is 1.8 m, and syncing the site config applies the site value.

---

## 11. Testing checklist

1. `npm run lint` — TypeScript clean.
2. `npm run build` — production bundle builds.
3. Command Center in DEMO — `VIEW ONLY` chip; speed and front range follow the dataset (it loops, so they keep changing).
4. Data stream modes — `DEMO` replays the dataset; `PI 5` polls `/api/telemetry` and freezes when it fails (chip `PI 5 NOT CONNECTED · FROZEN`); `OFF` shows `LIVE FEED` and the 3D world drives; switching to `OFF` without a responding 3D world freezes values (`CONNECTING`).
   Items 5–17 assume DATA STREAM MODE is **OFF** unless stated. DEMO mode instead replays the recorded dataset and cannot be driven by inputs.
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
- **Mode gating:** the BroadcastChannel handler and `applySimFrame` return early unless `connectionMode === 'OFFLINE'`; the simulator weather/night echoes are equally OFF-only. Keep this guard or PI 5 and DEMO get overwritten by the 3D world. Mode is read through `connectionModeRef` so the channel listener does not need re-subscribing.
- **No fallback loop:** there is deliberately no mock telemetry source. In DEMO the dataset must load (see fetch errors in the console); in OFF the 3D world must stream; in PI 5 the node must answer `/api/telemetry` — otherwise the dashboard is frozen and that is correct behaviour.
- **Leaving OFF:** an effect resets `lastSimMessageTimeRef` and `prevAebRef` when the mode changes away from OFF, so stale frames cannot leak across modes.
- **Simulator panel status:** `AdasWorldSimulation` shows `VIEW ONLY` outside OFF mode, regardless of whether frames are arriving, and `LIVE FEED`/`PAUSED`/`CONNECTING` inside OFF.
- **Two instances:** always include `target`/`instance`; otherwise the embedded and modal engines will both react and telemetry will oscillate.
- **Modal gating:** the embedded instance is paused while the modal is open by design. If you change `syncSimulator`, preserve this rule. This gating only affects which instance drives telemetry while OFF is selected.
- **Site vs. simulator defaults:** site AEB default is 1.8 m; simulator default is 2.0 m. The site config wins after sync.
- **Forward range clamp:** the site clamps forward LiDAR to 12 m for display while the simulator ranges up to 50 m.
- **Weather echo loop:** both site and simulator post weather. The site only updates local display state on echo in OFF mode and does not re-broadcast on every echo, which avoids feedback loops. Keep it that way.
- **`applyTelemetryFrame` is memoised** with `addEventLog`; it reads mutable state through refs (`killSwitchRef`, `modalOpenRef`, `settingsRef`, `prevAebRef`). Use refs instead of adding dependencies that would rebuild the channel listener.
- **Backend is the live feed only in PI 5:** `/api/telemetry` drives the dashboard while `ONLINE_PI5` is selected. In DEMO and OFF it is only the headless REST surface. Its AEB state may be active because the backend engine simulates braking — the dashboard intentionally mirrors it.
- **`CommandCenterView` is always mounted:** avoid expensive duplicate subscriptions inside it; it runs even when hidden.
- **Web Audio:** audio only starts after a user gesture; test accordingly.
- **localStorage weather:** tests can inherit previous rain/fog values. Clear `adas_rain` / `adas_fog` for reproducible runs.
- **Browser support:** `BroadcastChannel` is required for OFF mode; DEMO uses `fetch` for its dataset. Very old browsers will see the dashboard stay frozen except for manual controls.

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
