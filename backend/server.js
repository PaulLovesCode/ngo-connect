/**
 * ═══════════════════════════════════════════════════════════════════════
 * NGO Connect — Skill Matchmaking Backend Server
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Deterministic, rule-based volunteer-to-emergency matchmaking engine.
 * Replaces AI-driven matching with a transparent, auditable scoring system.
 * 
 * Port: 5000 (configurable via PORT env var)
 * ═══════════════════════════════════════════════════════════════════════
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// Load env from the project root
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

import matchRoutes from './routes/match.js';
import healthRoutes from './routes/health.js';

const app = express();
const PORT = process.env.BACKEND_PORT || 5000;

// ─── Middleware ────────────────────────────────────────────────────────

// CORS — allow the Vite frontend (port 3000) and any localhost origin
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Parse JSON bodies up to 5MB (for batch requests with many volunteers)
app.use(express.json({ limit: '5mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const color = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
    console.log(
      `${color}${req.method}\x1b[0m ${req.originalUrl} → ${res.statusCode} (${duration}ms)`
    );
  });
  next();
});

// ─── Routes ────────────────────────────────────────────────────────────

app.use('/api/match', matchRoutes);
app.use('/api/health', healthRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'NGO Connect Matchmaking Backend',
    version: '1.0.0',
    docs: 'GET /api/health for endpoint documentation',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `${req.method} ${req.originalUrl} does not exist`,
    hint: 'GET /api/health for available endpoints',
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
  });
});

// ─── Start Server ──────────────────────────────────────────────────────

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  NGO Connect — Matchmaking Backend');
    console.log(`  🚀 Server running on http://localhost:${PORT}`);
    console.log(`  📋 Health check:     http://localhost:${PORT}/api/health`);
    console.log(`  🎯 Match endpoint:   POST http://localhost:${PORT}/api/match/find`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
  });
}

export default app;
