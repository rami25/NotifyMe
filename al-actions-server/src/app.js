import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { config } from './config/env.js';
import { authRouter } from './routes/auth.routes.js';
import { actionsRouter } from './routes/actions.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { loggerMiddleware } from './middleware/loggerMiddleware.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json());
  app.use(pinoHttp({ level: config.nodeEnv === 'production' ? 'info' : 'debug' }));

  app.use(loggerMiddleware)
  // Generous but present — protects the auth endpoint from credential stuffing
  // without getting in the way of normal mobile app usage.
  app.use(
    '/api/auth',
    rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false })
  );

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRouter);
  app.use('/api/actions', actionsRouter);
  app.use('/api/users', usersRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
