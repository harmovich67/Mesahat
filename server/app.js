import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { config } from './config/env.js';
import { api } from './routes/index.js';
import { errorHandler, notFound, apiLimiter } from './middleware/index.js';
import { storage, sniffMime } from './storage/index.js';

export function createApp() {
  const app = express();

  // Security headers
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // CORS configured for the frontend origin
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same origin)
      if (!origin || origin === config.clientOrigin || origin.startsWith('http://localhost:')) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive for local dev
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }));

  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Public storage media directory (space images, avatars, review photos)
  app.use('/media', express.static(config.storage.publicDir, {
    maxAge: '7d',
    fallthrough: true,
  }));

  // Dynamic media handler for database-stored / S3 public files
  app.get('/media/{*key}', async (req, res, next) => {
    try {
      const key = Array.isArray(req.params.key) ? req.params.key.join('/') : String(req.params.key || '');
      if (!key) return next();
      const file = await storage.read('public', key);
      if (!file) return next();
      const mime = sniffMime(file) || 'image/jpeg';
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(file);
    } catch {
      next();
    }
  });

  // Serve static public/images from project root if needed
  const rootImages = path.resolve(config.root, '..', 'public', 'images');
  app.use('/images', express.static(rootImages, { maxAge: '7d' }));

  // API Router with rate limiting
  app.use('/api', apiLimiter, api);

  // 404 & error handlers
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
