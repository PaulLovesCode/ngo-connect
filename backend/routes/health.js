import { Router } from 'express';
import db from '../config/firebase.js';

const router = Router();

router.get('/', async (req, res) => {
  const firestoreStatus = db ? 'connected' : 'not_configured';
  
  res.json({
    status: 'ok',
    service: 'NGO Connect Matchmaking Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    firestore: firestoreStatus,
    endpoints: [
      'POST /api/match/find     — Find ranked volunteer matches',
      'POST /api/match/best     — Find single best match',
      'POST /api/match/score    — Score a specific volunteer',
      'POST /api/match/qualify  — Check volunteer qualification',
      'POST /api/match/assign   — Auto-assign best volunteer (Firestore)',
      'POST /api/match/batch    — Batch scoring for multiple emergencies',
      'GET  /api/health         — This endpoint',
    ],
  });
});

export default router;
