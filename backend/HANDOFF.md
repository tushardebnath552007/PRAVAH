# PRAVAH Backend — Handoff

The backend is a small Express service that serves the React dashboard, hosts the REST telemetry surface, and runs an in-memory telemetry engine for integrations and diagnostics.

It drives the live dashboard **only in PI 5 mode**. When DATA STREAM MODE is `PI 5`, the dashboard polls `GET /api/telemetry` once per second and renders those values; the visual composition (3D world, dataset) is not involved. In DEMO mode the dashboard replays a recorded dataset, and in OFF mode the browser 3D simulation drives it over `BroadcastChannel`. The REST feed is an independent, headless 1 Hz model.

---

## 1. Responsibilities

- Serve the SPA in development (Vite middleware) and production (built `dist/`).
- Expose telemetry, history, logs, weather, daylight, simulation-state and AEB endpoints.
- Maintain a Raspberry Pi 5-style telemetry snapshot in memory.
- Keep 60 history frames and an audit log.
- Provide `/api/health` for liveness checks.
- Serve static files from `public/` (including the 3D simulator at `/assets/simulation/adas-world.html`).

---

## 2. Entry points

```
server.ts                  # Root entry: imports startServer() and exits on fatal error
backend/server.ts          # Express app factory, middleware, static/SPA, listen
backend/routes.ts          # /api router
backend/telemetryService.ts# In-memory engine and snapshot/log/history types
```

`package.json` runs the server with `tsx`:

```json
"dev": "tsx server.ts",
"start": "tsx server.ts"
```

TypeScript is executed directly; there is no compiled server output.

---

## 3. Startup sequence

`startServer()` in `backend/server.ts`:

1. Creates the Express app.
2. Reads `PORT` (default `3000`).
3. Adds `express.json()`.
4. Mounts `apiRouter` at `/api`.
5. Registers `GET /api/health`.
6. Serves `public/` statically.
7. If `NODE_ENV !== 'production'`, creates a Vite dev server in middleware mode with `appType: 'spa'` and mounts `vite.middlewares`.
8. Otherwise serves `dist/` and adds the SPA fallback `app.get('*')` → `dist/index.html`.
9. Listens on `0.0.0.0:${PORT}` and logs the URL.

The root `server.ts` catches startup failures and exits with code 1.

> Note: `backend/telemetryService.ts` starts its interval in the constructor when the module is imported. Importing the module anywhere starts the engine.

---

## 4. Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | `production` serves `dist/` and SPA fallback |
| `DISABLE_HMR` | `false` | Vite setting; `true` disables HMR and file watching |

No API keys, database URLs or external services are required.

`.env` is not loaded explicitly by the code. Export variables in the shell or use your process manager / hosting platform's environment settings. (The `dotenv` package is present but not imported by the server.)

---

## 5. API reference

Base path: `/api`

### `GET /health`

```json
{ "status": "healthy", "platform": "PRAVAH ADAS Raspberry Pi 5 Node" }
```

### `GET /telemetry`

Returns the current snapshot:

```json
{
  "status": "success",
  "data": {
    "timestamp": "2026-11-12T09:14:22.000Z",
    "speed": 42,
    "steerAngle": 1.5,
    "gear": "D",
    "heading": 142,
    "lidarDistance": 4.52,
    "lidarSignal": 94,
    "lidarSnr": 36,
    "healthScore": 98,
    "fcwState": "FCW: SYSTEM NOMINAL",
    "aebActive": false,
    "lkaActive": true,
    "accActive": true,
    "agsActive": false,
    "servoAngle": 12,
    "cameraFps": 60,
    "inferenceLatency": 14.2,
    "rainLevel": 0,
    "fogLevel": 0,
    "rainRate": 0,
    "fogDensityPct": 0,
    "ambientLux": 9200,
    "lightScatterCoeff": 0.08,
    "roadWetness": 0,
    "frictionMu": 0.85,
    "hydroplaningRisk": "LOW",
    "nightMode": false,
    "daylightMode": false,
    "glareDetected": false,
    "cpuTemp": 48.5,
    "cpuLoad": 26.4,
    "ramUsage": 42.1,
    "latencyMs": 12,
    "packetDeliveryRate": 99.8,
    "uptimeSeconds": 14320,
    "canBusLoad": 34.8,
    "imu": { "ax": 0.04, "ay": -0.02, "az": 0.99, "gx": 0.2, "gy": -0.1, "gz": 0.4 },
    "gps": { "lat": 28.6139, "lng": 77.209, "satellites": 14, "alt": 216, "fix": true },
    "detectedObjectsCount": 3,
    "isSimRunning": true
  }
}
```

### `GET /history`

Returns up to 60 frames, oldest first. Each frame:

```json
{
  "timestamp": "09:14:22",
  "speed": 42,
  "lidarDistance": 4.5,
  "cpuTemp": 48.5,
  "cpuLoad": 26.4,
  "rainRate": 0,
  "fogDensityPct": 0,
  "ambientLux": 9200,
  "threatIndex": 15
}
```

Frames are appended once per second and trimmed to 60.

### `GET /logs`

Returns the diagnostic audit trail, newest first. Entries:

```json
{
  "id": "log-1700000000000",
  "timestamp": "09:14:22",
  "severity": "CRITICAL",
  "category": "AEB",
  "message": "MANUAL OVERRIDE: AEB Emergency Brake applied immediately",
  "metricValue": "Speed: 0 km/h | Servo: 90°"
}
```

Only `triggerAEB()` and `releaseAEB()` add entries. The log is not capped or persisted.

### `POST /weather`

Body:

```json
{ "rainLevel": 3, "fogLevel": 1 }
```

- Missing or non-number values default to `0`.
- The service clamps both to `0–5`.
- Returns the updated snapshot as `data`.

### `POST /daylight-mode`

Body:

```json
{ "enabled": true }
```

Sets `daylightMode`. Returns `{ status, daylightMode }`. It does **not** change `nightMode`, `ambientLux`, or the frontend theme; the frontend handles its own theme locally.

### `GET /simulation/state`

```json
{ "status": "success", "isSimRunning": true, "daylightMode": false }
```

### `POST /simulation/state`

Body:

```json
{ "running": false }
```

Sets `isSimRunning` and returns the new value.

### `POST /aeb/trigger`

Engages backend AEB:

- `aebActive = true`
- `speed = 0`
- `servoAngle = 90`
- `fcwState = "FCW: EMERGENCY BRAKING OVERRIDE (AEB)"`
- Adds a `CRITICAL` / `AEB` log entry
- Returns the updated snapshot

### `POST /aeb/release`

Releases backend AEB:

- `aebActive = false`
- `servoAngle = 0`
- `fcwState = "FCW: SYSTEM NOMINAL"`
- Adds an `INFO` / `AEB` log entry
- Returns the updated snapshot

### Error behavior

- Unknown `/api/*` routes fall through to the SPA/static handling and are not JSON 404s.
- There is no schema validation library; malformed JSON is handled by Express's JSON parser, and individual fields are coerced/guarded per route.
- No authentication, rate limiting or CORS configuration is present. The API is intended for same-origin/local use.

---

## 6. Telemetry engine

`backend/telemetryService.ts` exports a singleton `telemetryService`.

### Startup state

| Field | Value |
| --- | --- |
| `speed` | 42 km/h |
| `gear` | `D` |
| `heading` | 142° |
| `lidarDistance` | 4.52 m |
| `servoAngle` | 12° |
| `cpuTemp` / `cpuLoad` | 48.5 °C / 26.4 % |
| `ramUsage` | 42.1 % |
| `gps` | 28.6139, 77.2090 |
| `isSimRunning` | `true` |
| `daylightMode` / `nightMode` | `false` / `false` |

Initial logs: system init, CAN bus sync, LiDAR calibration.

### Tick (every 1000 ms)

When running and not braking:

- Speed jitters within 22–85 km/h.
- Steering jitters within ±25°, damped by 0.7.
- Heading advances by `steerAngle * 0.2` and wraps at 360.
- LiDAR fluctuates around 0.9–16 m, with wrap-around resets.
- Servo derives from steering and proximity (0–40°).
- IMU acceleration and yaw rate follow the speed/steering jitter.

When AEB is active:

- Speed is 0, servo is 90°, longitudinal acceleration is −0.85 g.

Every tick regardless of state:

- Rain rate = `rainLevel * 9.2` mm/h.
- Fog density = `fogLevel * 20` %.
- Light scatter = `0.08 + fog*0.16 + rain*0.06`.
- Ambient lux starts from 14,500 (daylight), 40 (night), or 8,500 (default), minus weather attenuation.
- Road wetness = `rain*18` (+15 if fog > 2), capped at 100.
- Friction = `max(0.18, 0.85 - wetness*0.0062)`.
- Hydroplaning risk from wetness and speed.
- CPU load/temp, CAN load, latency modelled from speed, fog and random jitter.
- FCW thresholds (hardcoded): `< 1.8 m` → critical and auto-AEB; `< 3.5 m` → warning; otherwise nominal.
- Uptime increments.
- History frame appended and trimmed to 60.

### Methods

| Method | Effect |
| --- | --- |
| `getSnapshot()` | Shallow copy of state |
| `getHistory()` | Copy of history array |
| `getLogs()` | Copy of logs array |
| `triggerAEB()` / `releaseAEB()` | Override, logs |
| `setWeather(rain, fog)` | Clamped 0–5 |
| `setDaylightMode(enabled)` | Sets flag only |
| `setSimRunning(running)` / `isSimRunning()` | Pause flag |
| `isDaylightMode()` | Read flag |

### Important design notes

- **In-memory only.** Restart resets state, uptime, history and logs.
- **Timer starts on import.** There is no `stop()`/`dispose()` and no graceful shutdown; the interval keeps the process alive.
- **Independent from the 3D world.** The browser simulation is not connected to this engine. Changing `/api/weather` does not change the dashboard's live values.
- **`setWeather` does not immediately recompute derived values.** They update on the next tick (within ~1 s).
- **`daylightMode` does not affect `nightMode`.** They are separate flags.
- **AEB threshold is fixed at 1.8 m** in the backend engine and is not configurable through the API.
- **Logs from AEB are unbounded.** Only the frontend trims logs.
- **No persistence or external hardware I/O.** CAN, LiDAR, IMU and GPS values are modelled, not read from a device.

---

## 7. Local development

```bash
npm install --legacy-peer-deps
npm run dev
```

- Server: `http://localhost:3000`
- Vite middleware provides React HMR and serves `index.html`.
- Static files in `public/` are served directly; the 3D simulation is available at:
  - `/assets/simulation/adas-world.html` (standalone)
  - `/assets/simulation/adas-world.html?embed=1&instance=embedded` (dashboard panel)
  - `/assets/simulation/adas-world.html?embed=0&instance=modal` (modal)

API smoke test:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/telemetry | head -c 500
curl http://localhost:3000/api/simulation/state
```

---

## 8. Build and production

```bash
npm install --legacy-peer-deps
npm run build
```

`npm run build` runs `vite build` and writes the client bundle to `dist/`. The server itself is not bundled.

Run:

```bash
NODE_ENV=production PORT=3000 npm start
```

or PowerShell:

```powershell
$env:NODE_ENV="production"; $env:PORT="3000"; npm start
```

Behavior in production:

1. `/api/*` routes are matched first.
2. `public/` is served statically.
3. `dist/` is served statically.
4. Any unmatched route returns `dist/index.html`.

If `NODE_ENV` is not `production`, step 4 becomes a Vite middleware dev server instead, even if `dist/` exists.

### Deployment checklist

- Node 20.19+ / 22.12+ available (needed by Vite 8).
- `NODE_ENV=production` set.
- `dist/` built from the same source revision.
- `PORT` reachable through your proxy/load balancer.
- Same-origin serving for the dashboard and simulator (BroadcastChannel requirement).
- Process manager configured to restart the process; state is not persisted.
- Consider `DISABLE_HMR=true` only for dev on constrained hardware; it has no effect on the built bundle.

---

## 9. Adding or changing an endpoint

1. Add the handler in `backend/routes.ts` using `apiRouter`.
2. Keep the `{ status, data }` response shape where practical.
3. Add a method to `telemetryService` rather than mutating its private state from routes.
4. Guard and clamp request values; there is no validation middleware.
5. Update this document and the API table in the root `README.md`.
6. Smoke-test with `curl` and run `npm run lint`.

Example:

```ts
apiRouter.post('/demo', (req: Request, res: Response) => {
  const value = typeof req.body?.value === 'number' ? req.body.value : 0;
  telemetryService.setSimRunning(value > 0);
  res.json({ status: 'success', isSimRunning: telemetryService.isSimRunning() });
});
```

---

## 10. Gotchas and failure modes

- **Blank page in production:** `NODE_ENV` was not `production`, so Vite middleware served the app instead of `dist/`, or `npm run build` was not run.
- **API works but React does not:** check that Vite middleware is mounted in dev; `appType: 'spa'` handles history fallback.
- **Port conflicts:** change `PORT`. The server binds `0.0.0.0`.
- **`npm install` peer errors:** use `--legacy-peer-deps`.
- **`npm run clean` fails on Windows:** the script uses `rm -rf`; delete `dist` manually or use Git Bash/WSL.
- **History empty after start:** the engine needs up to a minute to fill 60 frames; the array starts empty.
- **Weather endpoint appears to do nothing on the dashboard:** expected. The dashboard owns weather locally; in PI 5 mode it still reads only telemetry scalars from `/api/telemetry`, not weather.
- **Simulation 404 after deploy:** confirm `public/assets/simulation/adas-world.html` is present after the build. Vite copies `public/` into `dist/`.
- **State resets on restart:** no database; uptime, history, logs and settings return to defaults.
- **No CORS headers:** call the API from the same origin or add CORS explicitly if you expose it to another host.
- **Unmatched `/api` paths:** they may return `index.html` rather than JSON because SPA fallback is last. Use explicit handlers if you need JSON 404s.
- **Engine keeps running after import:** tests that import `telemetryService` will leave a 1 s interval behind; account for this in unit tests or add a disposal method if needed.

---

## 11. File ownership quick reference

| Concern | File |
| --- | --- |
| Server bootstrap, middleware order, SPA fallback | `backend/server.ts` |
| REST routes and request parsing | `backend/routes.ts` |
| Telemetry state, tick logic, history, logs | `backend/telemetryService.ts` |
| Root process entry / fatal error handling | `server.ts` |
| Client build and dev middleware config | `vite.config.ts` |
| Static 3D simulation | `public/assets/simulation/adas-world.html` |
