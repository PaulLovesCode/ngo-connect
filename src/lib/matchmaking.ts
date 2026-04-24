/**
 * Backend API client for the matchmaking service.
 * Communicates with the Node.js backend at localhost:5000.
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

interface MatchBreakdown {
  skill: {
    score: number;
    maxScore: number;
    matchedSkills: Array<{
      volunteerSkill: string;
      requiredSkill: string;
      type: 'exact' | 'partial' | 'synonym';
      score: number;
    }>;
    unmatchedSkills: string[];
    coverage: number;
    adjustedScore: number;
    urgencyMultiplier: number;
  };
  workload: { score: number; activeTasks: number };
  experience: { score: number; maxScore: number; years: number };
  availability: { score: number; maxScore: number };
  urgencyAffinity: { score: number; maxScore: number; reason: string };
}

export interface VolunteerMatch {
  volunteerId: string;
  volunteerName: string;
  volunteerEmail: string;
  volunteerSkills: string[];
  totalScore: number;
  maxPossibleScore: number;
  matchPercentage: number;
  breakdown: MatchBreakdown;
  isQualified: boolean;
  rank: number;
}

export interface MatchResponse {
  success: boolean;
  emergencyId: string | null;
  urgency: string;
  requiredSkills: string[];
  totalCandidates: number;
  matchCount: number;
  matches: VolunteerMatch[];
}

export interface BestMatchResponse {
  success: boolean;
  match: VolunteerMatch | null;
  message?: string;
}

export interface QualifyResponse {
  success: boolean;
  qualified: boolean;
  coverage: number;
  matchedSkills: Array<{
    volunteerSkill: string;
    requiredSkill: string;
    type: string;
    score: number;
  }>;
  unmatchedSkills: string[];
}

interface EmergencyInput {
  id?: string;
  requiredSkills: string[];
  urgency: string;
}

interface VolunteerInput {
  uid: string;
  name: string;
  email?: string;
  skills: string[];
  yearsVolunteering?: number;
}

/**
 * Find ranked volunteer matches for an emergency.
 */
export async function findMatches(
  emergency: EmergencyInput,
  volunteers: VolunteerInput[],
  taskCounts: Record<string, number> = {},
  options: { limit?: number; qualifiedOnly?: boolean } = {}
): Promise<MatchResponse> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.qualifiedOnly) params.set('qualifiedOnly', '1');

  const res = await fetch(`${BACKEND_URL}/api/match/find?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emergency, volunteers, taskCounts }),
  });

  if (!res.ok) {
    throw new Error(`Backend error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Find the single best volunteer match for an emergency.
 */
export async function findBestMatch(
  emergency: EmergencyInput,
  volunteers: VolunteerInput[],
  taskCounts: Record<string, number> = {}
): Promise<BestMatchResponse> {
  const res = await fetch(`${BACKEND_URL}/api/match/best`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emergency, volunteers, taskCounts }),
  });

  if (!res.ok) {
    throw new Error(`Backend error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Check if a specific volunteer is qualified for an emergency.
 */
export async function checkQualification(
  volunteer: VolunteerInput,
  emergency: EmergencyInput
): Promise<QualifyResponse> {
  const res = await fetch(`${BACKEND_URL}/api/match/qualify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ volunteer, emergency }),
  });

  if (!res.ok) {
    throw new Error(`Backend error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Score a specific volunteer against an emergency.
 */
export async function scoreVolunteer(
  volunteer: VolunteerInput,
  emergency: EmergencyInput,
  activeTasks: number = 0
): Promise<{ success: boolean; result: VolunteerMatch }> {
  const res = await fetch(`${BACKEND_URL}/api/match/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ volunteer, emergency, activeTasks }),
  });

  if (!res.ok) {
    throw new Error(`Backend error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Check if the backend is reachable and healthy.
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/health`, { 
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
