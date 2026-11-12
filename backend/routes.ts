import { Router, Request, Response } from 'express';
import { telemetryService } from './telemetryService';

export const apiRouter = Router();

// GET /api/telemetry - Live telemetry snapshot
apiRouter.get('/telemetry', (req: Request, res: Response) => {
  res.json({
    status: 'success',
    data: telemetryService.getSnapshot(),
  });
});

// GET /api/history - Historical trend frames for Recharts
apiRouter.get('/history', (req: Request, res: Response) => {
  res.json({
    status: 'success',
    data: telemetryService.getHistory(),
  });
});

// GET /api/logs - Diagnostic audit trail logs
apiRouter.get('/logs', (req: Request, res: Response) => {
  res.json({
    status: 'success',
    data: telemetryService.getLogs(),
  });
});

// POST /api/weather - Update rain/fog levels
apiRouter.post('/weather', (req: Request, res: Response) => {
  const { rainLevel, fogLevel } = req.body;
  telemetryService.setWeather(
    typeof rainLevel === 'number' ? rainLevel : 0,
    typeof fogLevel === 'number' ? fogLevel : 0
  );
  res.json({
    status: 'success',
    message: 'Weather levels updated',
    data: telemetryService.getSnapshot(),
  });
});

// POST /api/daylight-mode - Toggle daylight mode
apiRouter.post('/daylight-mode', (req: Request, res: Response) => {
  const { enabled } = req.body;
  telemetryService.setDaylightMode(Boolean(enabled));
  res.json({
    status: 'success',
    daylightMode: Boolean(enabled),
  });
});

// GET & POST /api/simulation/state - Pause/Resume simulation
apiRouter.get('/simulation/state', (req: Request, res: Response) => {
  res.json({
    status: 'success',
    isSimRunning: telemetryService.isSimRunning(),
    daylightMode: telemetryService.isDaylightMode(),
  });
});

apiRouter.post('/simulation/state', (req: Request, res: Response) => {
  const { running } = req.body;
  telemetryService.setSimRunning(Boolean(running));
  res.json({
    status: 'success',
    isSimRunning: Boolean(running),
  });
});

// POST /api/aeb/trigger - Immediate AEB override
apiRouter.post('/aeb/trigger', (req: Request, res: Response) => {
  telemetryService.triggerAEB();
  res.json({
    status: 'success',
    message: 'AEB brake engaged',
    data: telemetryService.getSnapshot(),
  });
});

// POST /api/aeb/release - Release AEB override
apiRouter.post('/aeb/release', (req: Request, res: Response) => {
  telemetryService.releaseAEB();
  res.json({
    status: 'success',
    message: 'AEB brake released',
    data: telemetryService.getSnapshot(),
  });
});
