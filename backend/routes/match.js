import { Router } from 'express';
import db from '../config/firebase.js';
import { rankVolunteers, findBestMatch, scoreVolunteer, isVolunteerQualified } from '../services/matchmaker.js';

const router = Router();

// ─── Helper: Fetch data from Firestore ────────────────────────────────

async function getVolunteersFromFirestore() {
  if (!db) return null;
  try {
    const snapshot = await db.collection('volunteers').get();
    return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('Failed to fetch volunteers from Firestore:', err.message);
    return null;
  }
}

async function getEmergencyFromFirestore(emergencyId) {
  if (!db) return null;
  try {
    const doc = await db.collection('emergencies').doc(emergencyId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  } catch (err) {
    console.error('Failed to fetch emergency from Firestore:', err.message);
    return null;
  }
}

async function getActiveTaskCounts() {
  if (!db) return {};
  try {
    const snapshot = await db.collection('tasks')
      .where('status', 'in', ['open', 'in-progress'])
      .get();
    
    const counts = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const uid = data.assignedVolunteerUid;
      counts[uid] = (counts[uid] || 0) + 1;
    });
    return counts;
  } catch (err) {
    console.error('Failed to fetch task counts:', err.message);
    return {};
  }
}

// ═══════════════════════════════════════════════════════════════════════
// POST /api/match/find
// ═══════════════════════════════════════════════════════════════════════
// Find the best volunteer matches for an emergency.
//
// Request body (Firestore mode — just pass the emergency ID):
//   { emergencyId: "abc123" }
//
// Request body (Stateless mode — pass all data):
//   {
//     emergency: { requiredSkills: [...], urgency: "high" },
//     volunteers: [{ uid, name, skills, yearsVolunteering }, ...],
//     taskCounts: { "uid1": 2, "uid2": 0 }   // optional
//   }
//
// Query params:
//   ?limit=5          — Max results (default: 10)
//   ?qualifiedOnly=1  — Only return volunteers with skill matches
// ═══════════════════════════════════════════════════════════════════════
router.post('/find', async (req, res) => {
  try {
    const { emergencyId, emergency: bodyEmergency, volunteers: bodyVolunteers, taskCounts: bodyTaskCounts } = req.body;
    const limit = parseInt(req.query.limit) || 10;
    const qualifiedOnly = req.query.qualifiedOnly === '1' || req.query.qualifiedOnly === 'true';
    
    let emergency, volunteers, taskCounts;
    
    // Mode 1: Firestore-backed (just pass emergencyId)
    if (emergencyId && db) {
      emergency = await getEmergencyFromFirestore(emergencyId);
      if (!emergency) {
        return res.status(404).json({ error: 'Emergency not found', emergencyId });
      }
      volunteers = await getVolunteersFromFirestore();
      if (!volunteers) {
        return res.status(500).json({ error: 'Failed to fetch volunteers from Firestore' });
      }
      taskCounts = await getActiveTaskCounts();
    }
    // Mode 2: Stateless (all data in request body)
    else if (bodyEmergency && bodyVolunteers) {
      emergency = bodyEmergency;
      volunteers = bodyVolunteers;
      taskCounts = bodyTaskCounts || {};
    }
    // Mode 3: emergencyId provided but no Firestore
    else if (emergencyId && !db) {
      return res.status(503).json({
        error: 'Firestore not configured. Pass emergency and volunteers in request body, or configure serviceAccountKey.json.',
      });
    }
    else {
      return res.status(400).json({
        error: 'Provide either emergencyId (Firestore mode) or emergency + volunteers (stateless mode)',
      });
    }
    
    const ranked = rankVolunteers(volunteers, emergency, taskCounts, { limit, qualifiedOnly });
    
    res.json({
      success: true,
      emergencyId: emergency.id || emergencyId || null,
      urgency: emergency.urgency,
      requiredSkills: emergency.requiredSkills,
      totalCandidates: volunteers.length,
      matchCount: ranked.length,
      matches: ranked,
    });
  } catch (err) {
    console.error('Match find error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// POST /api/match/best
// ═══════════════════════════════════════════════════════════════════════
// Find the single best volunteer for an emergency.
// Same body format as /find.
// ═══════════════════════════════════════════════════════════════════════
router.post('/best', async (req, res) => {
  try {
    const { emergencyId, emergency: bodyEmergency, volunteers: bodyVolunteers, taskCounts: bodyTaskCounts } = req.body;
    
    let emergency, volunteers, taskCounts;
    
    if (emergencyId && db) {
      emergency = await getEmergencyFromFirestore(emergencyId);
      if (!emergency) return res.status(404).json({ error: 'Emergency not found' });
      volunteers = await getVolunteersFromFirestore();
      if (!volunteers) return res.status(500).json({ error: 'Failed to fetch volunteers' });
      taskCounts = await getActiveTaskCounts();
    } else if (bodyEmergency && bodyVolunteers) {
      emergency = bodyEmergency;
      volunteers = bodyVolunteers;
      taskCounts = bodyTaskCounts || {};
    } else {
      return res.status(400).json({ error: 'Invalid request body' });
    }
    
    const best = findBestMatch(volunteers, emergency, taskCounts);
    
    if (!best) {
      return res.json({
        success: true,
        match: null,
        message: 'No qualified volunteers found for the required skills',
      });
    }
    
    res.json({
      success: true,
      match: best,
    });
  } catch (err) {
    console.error('Match best error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// POST /api/match/score
// ═══════════════════════════════════════════════════════════════════════
// Score a specific volunteer against an emergency.
//
// Body:
//   {
//     volunteer: { uid, name, skills, yearsVolunteering },
//     emergency: { requiredSkills, urgency },
//     activeTasks: 2  // optional
//   }
// ═══════════════════════════════════════════════════════════════════════
router.post('/score', async (req, res) => {
  try {
    const { volunteer, emergency, activeTasks = 0 } = req.body;
    
    if (!volunteer || !emergency) {
      return res.status(400).json({ error: 'Both volunteer and emergency are required' });
    }
    
    const result = scoreVolunteer(volunteer, emergency, activeTasks);
    
    res.json({
      success: true,
      result,
    });
  } catch (err) {
    console.error('Match score error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// POST /api/match/qualify
// ═══════════════════════════════════════════════════════════════════════
// Check if a volunteer is qualified for an emergency (skill overlap check).
//
// Body:
//   {
//     volunteer: { skills: [...] },
//     emergency: { requiredSkills: [...] }
//   }
// ═══════════════════════════════════════════════════════════════════════
router.post('/qualify', (req, res) => {
  try {
    const { volunteer, emergency } = req.body;
    
    if (!volunteer || !emergency) {
      return res.status(400).json({ error: 'Both volunteer and emergency are required' });
    }
    
    const result = isVolunteerQualified(volunteer, emergency);
    
    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('Match qualify error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// POST /api/match/assign
// ═══════════════════════════════════════════════════════════════════════
// Auto-assign the best volunteer to an emergency (Firestore mode only).
//
// Body:
//   { emergencyId: "abc123" }
// ═══════════════════════════════════════════════════════════════════════
router.post('/assign', async (req, res) => {
  try {
    const { emergencyId } = req.body;
    
    if (!emergencyId) {
      return res.status(400).json({ error: 'emergencyId is required' });
    }
    
    if (!db) {
      return res.status(503).json({
        error: 'Firestore not configured. Auto-assign requires Firestore access.',
      });
    }
    
    // Get the emergency
    const emergency = await getEmergencyFromFirestore(emergencyId);
    if (!emergency) {
      return res.status(404).json({ error: 'Emergency not found' });
    }
    
    if (emergency.status !== 'pending') {
      return res.status(409).json({ error: 'Emergency is already assigned or resolved', status: emergency.status });
    }
    
    // Get volunteers and task counts
    const volunteers = await getVolunteersFromFirestore();
    const taskCounts = await getActiveTaskCounts();
    
    // Find best match
    const best = findBestMatch(volunteers, emergency, taskCounts);
    
    if (!best) {
      return res.json({
        success: false,
        message: 'No qualified volunteers found',
      });
    }
    
    // Create the task
    const now = new Date();
    const taskRef = await db.collection('tasks').add({
      emergencyId,
      assignedVolunteerUid: best.volunteerId,
      status: 'open',
      createdAt: now,
      matchScore: best.totalScore,
      matchPercentage: best.matchPercentage,
    });
    
    // Update emergency status
    await db.collection('emergencies').doc(emergencyId).update({
      status: 'assigned',
      assignedVolunteerUid: best.volunteerId,
    });
    
    res.json({
      success: true,
      taskId: taskRef.id,
      assignment: {
        volunteerId: best.volunteerId,
        volunteerName: best.volunteerName,
        matchScore: best.totalScore,
        matchPercentage: best.matchPercentage,
        breakdown: best.breakdown,
      },
    });
  } catch (err) {
    console.error('Match assign error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// POST /api/match/batch
// ═══════════════════════════════════════════════════════════════════════
// Score multiple volunteers against multiple emergencies.
//
// Body:
//   {
//     volunteers: [...],
//     emergencies: [...],
//     taskCounts: { ... }  // optional
//   }
// ═══════════════════════════════════════════════════════════════════════
router.post('/batch', (req, res) => {
  try {
    const { volunteers, emergencies, taskCounts = {} } = req.body;
    
    if (!volunteers || !emergencies) {
      return res.status(400).json({ error: 'Both volunteers and emergencies arrays are required' });
    }
    
    const results = emergencies.map(emergency => ({
      emergencyId: emergency.id || null,
      urgency: emergency.urgency,
      requiredSkills: emergency.requiredSkills,
      matches: rankVolunteers(volunteers, emergency, taskCounts, { limit: 5, qualifiedOnly: true }),
    }));
    
    res.json({
      success: true,
      totalEmergencies: emergencies.length,
      results,
    });
  } catch (err) {
    console.error('Match batch error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

export default router;
