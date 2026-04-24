/**
 * =====================================================================
 * Deterministic Skill Matchmaking Engine
 * =====================================================================
 * 
 * Scoring System (Total: 100 points max)
 * ─────────────────────────────────────────
 *  1. Skill Match Score       (0 – 45 pts)  — Primary weight
 *  2. Workload Score          (0 – 20 pts)  — Fewer active tasks = higher
 *  3. Experience Score        (0 – 15 pts)  — Years of volunteering
 *  4. Availability Bonus      (0 – 10 pts)  — No current tasks = full bonus
 *  5. Urgency Affinity Bonus  (0 – 10 pts)  — Higher-experienced vols for critical
 * 
 * Tie-breaking: Higher experience → alphabetical name
 * =====================================================================
 */

// ─── Skill Taxonomy / Synonyms ────────────────────────────────────────
// Maps common synonyms/abbreviations to canonical skill names.
// This allows "First Aid" to match "Medical", "EMT" to match "Medicine", etc.
const SKILL_SYNONYMS = {
  'medicine':       ['medical', 'doctor', 'physician', 'healthcare', 'health care', 'clinical'],
  'first aid':      ['firstaid', 'first-aid', 'emergency care', 'cpr', 'emt', 'paramedic'],
  'logistics':      ['supply chain', 'transport', 'transportation', 'distribution', 'delivery'],
  'construction':   ['building', 'carpentry', 'engineering', 'structural'],
  'teaching':       ['education', 'tutoring', 'instruction', 'training', 'mentoring'],
  'counseling':     ['counselling', 'therapy', 'mental health', 'psychological', 'psychotherapy'],
  'cooking':        ['food preparation', 'catering', 'nutrition', 'chef'],
  'driving':        ['driver', 'vehicle operation', 'transport'],
  'communication':  ['public speaking', 'outreach', 'media', 'pr', 'public relations'],
  'fundraising':    ['donor relations', 'grant writing', 'crowdfunding'],
  'it':             ['technology', 'tech support', 'computer', 'software', 'programming'],
  'search and rescue': ['sar', 'rescue', 'search & rescue'],
  'water purification': ['water treatment', 'sanitation', 'hygiene'],
  'childcare':      ['child care', 'babysitting', 'pediatric'],
  'translation':    ['interpreter', 'language', 'multilingual'],
};

// ─── Urgency Multipliers ──────────────────────────────────────────────
// Critical emergencies inflate skill match importance.
const URGENCY_WEIGHTS = {
  critical: 1.5,
  high:     1.25,
  medium:   1.0,
  low:      0.8,
};

// ─── Core Scoring Functions ───────────────────────────────────────────

/**
 * Normalize a skill string for comparison.
 */
function normalizeSkill(skill) {
  return skill.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

/**
 * Get canonical name and all synonyms for a skill.
 */
function getSkillFamily(skill) {
  const normalized = normalizeSkill(skill);
  
  // Check if the skill IS a canonical name
  if (SKILL_SYNONYMS[normalized]) {
    return [normalized, ...SKILL_SYNONYMS[normalized]];
  }
  
  // Check if the skill is a synonym of a canonical name
  for (const [canonical, synonyms] of Object.entries(SKILL_SYNONYMS)) {
    if (synonyms.includes(normalized)) {
      return [canonical, ...synonyms];
    }
  }
  
  // No family found — return the skill itself
  return [normalized];
}

/**
 * Check if two skills are semantically equivalent.
 */
function skillsMatch(volunteerSkill, requiredSkill) {
  const vNorm = normalizeSkill(volunteerSkill);
  const rNorm = normalizeSkill(requiredSkill);
  
  // Exact match
  if (vNorm === rNorm) return { match: true, type: 'exact', score: 1.0 };
  
  // Substring match (one contains the other)
  if (vNorm.includes(rNorm) || rNorm.includes(vNorm)) {
    return { match: true, type: 'partial', score: 0.7 };
  }
  
  // Synonym match (both belong to the same skill family)
  const vFamily = getSkillFamily(volunteerSkill);
  const rFamily = getSkillFamily(requiredSkill);
  
  const hasOverlap = vFamily.some(v => rFamily.includes(v));
  if (hasOverlap) {
    return { match: true, type: 'synonym', score: 0.85 };
  }
  
  return { match: false, type: 'none', score: 0 };
}

/**
 * Compute the skill match score for a volunteer against required skills.
 * Returns detailed breakdown.
 */
function computeSkillScore(volunteerSkills, requiredSkills) {
  if (!requiredSkills || requiredSkills.length === 0) {
    return { score: 0, maxScore: 45, matchedSkills: [], unmatchedSkills: [], coverage: 0 };
  }
  
  const matchedSkills = [];
  const unmatchedSkills = [];
  let totalMatchScore = 0;
  
  for (const reqSkill of requiredSkills) {
    let bestMatch = null;
    let bestScore = 0;
    
    for (const volSkill of volunteerSkills) {
      const result = skillsMatch(volSkill, reqSkill);
      if (result.match && result.score > bestScore) {
        bestMatch = { volunteerSkill: volSkill, requiredSkill: reqSkill, ...result };
        bestScore = result.score;
      }
    }
    
    if (bestMatch) {
      matchedSkills.push(bestMatch);
      totalMatchScore += bestScore;
    } else {
      unmatchedSkills.push(reqSkill);
    }
  }
  
  // Normalize: full coverage of all skills = 45 points
  const coverage = totalMatchScore / requiredSkills.length;
  const score = Math.round(coverage * 45);
  
  return {
    score,
    maxScore: 45,
    matchedSkills,
    unmatchedSkills,
    coverage: Math.round(coverage * 100),
  };
}

/**
 * Compute workload score based on active task count.
 * Fewer tasks = higher score (max 20).
 */
function computeWorkloadScore(activeTasks) {
  const count = activeTasks || 0;
  if (count === 0) return { score: 20, activeTasks: count };
  if (count === 1) return { score: 15, activeTasks: count };
  if (count === 2) return { score: 10, activeTasks: count };
  if (count === 3) return { score: 5, activeTasks: count };
  return { score: 0, activeTasks: count };
}

/**
 * Compute experience score based on years of volunteering.
 * Max 15 points at 5+ years.
 */
function computeExperienceScore(yearsVolunteering) {
  const years = yearsVolunteering || 0;
  const score = Math.min(Math.round((years / 5) * 15), 15);
  return { score, maxScore: 15, years };
}

/**
 * Compute availability bonus.
 * Full bonus (10) if volunteer has NO active tasks.
 */
function computeAvailabilityBonus(activeTasks) {
  return {
    score: (activeTasks || 0) === 0 ? 10 : 0,
    maxScore: 10,
  };
}

/**
 * Compute urgency affinity bonus.
 * Experienced volunteers get a bonus for critical/high emergencies.
 */
function computeUrgencyAffinityBonus(urgency, yearsVolunteering) {
  const years = yearsVolunteering || 0;
  if ((urgency === 'critical' || urgency === 'high') && years >= 3) {
    return { score: 10, maxScore: 10, reason: 'Experienced volunteer for urgent emergency' };
  }
  if ((urgency === 'critical' || urgency === 'high') && years >= 1) {
    return { score: 5, maxScore: 10, reason: 'Some experience for urgent emergency' };
  }
  return { score: 0, maxScore: 10, reason: 'N/A' };
}

// ─── Main Matchmaking Function ───────────────────────────────────────

/**
 * Score a single volunteer against an emergency.
 * 
 * @param {Object} volunteer     - { uid, name, skills, yearsVolunteering, ... }
 * @param {Object} emergency     - { requiredSkills, urgency, ... }
 * @param {number} activeTasks   - Number of currently active (non-completed) tasks
 * @returns {Object}             - Detailed score breakdown
 */
export function scoreVolunteer(volunteer, emergency, activeTasks = 0) {
  const skillResult = computeSkillScore(
    volunteer.skills || [],
    emergency.requiredSkills || []
  );
  
  const workloadResult = computeWorkloadScore(activeTasks);
  const experienceResult = computeExperienceScore(volunteer.yearsVolunteering);
  const availabilityResult = computeAvailabilityBonus(activeTasks);
  const urgencyResult = computeUrgencyAffinityBonus(
    emergency.urgency,
    volunteer.yearsVolunteering
  );
  
  // Apply urgency multiplier to skill score
  const urgencyMultiplier = URGENCY_WEIGHTS[emergency.urgency] || 1.0;
  const adjustedSkillScore = Math.min(
    Math.round(skillResult.score * urgencyMultiplier),
    45
  );
  
  const totalScore = adjustedSkillScore
    + workloadResult.score
    + experienceResult.score
    + availabilityResult.score
    + urgencyResult.score;
  
  return {
    volunteerId: volunteer.uid,
    volunteerName: volunteer.name,
    volunteerEmail: volunteer.email,
    volunteerSkills: volunteer.skills || [],
    totalScore,
    maxPossibleScore: 100,
    matchPercentage: totalScore,
    breakdown: {
      skill: { ...skillResult, adjustedScore: adjustedSkillScore, urgencyMultiplier },
      workload: workloadResult,
      experience: experienceResult,
      availability: availabilityResult,
      urgencyAffinity: urgencyResult,
    },
    isQualified: skillResult.matchedSkills.length > 0,
    rank: 0, // Will be set by rankVolunteers
  };
}

/**
 * Rank all volunteers for a given emergency.
 * 
 * @param {Array}  volunteers   - Array of volunteer objects
 * @param {Object} emergency    - Emergency object with requiredSkills & urgency
 * @param {Object} taskCounts   - Map of { volunteerId: activeTaskCount }
 * @param {Object} options      - { limit, qualifiedOnly }
 * @returns {Array}             - Sorted array of scored volunteers
 */
export function rankVolunteers(volunteers, emergency, taskCounts = {}, options = {}) {
  const { limit = 10, qualifiedOnly = false } = options;
  
  let scored = volunteers.map(vol => {
    const activeTasks = taskCounts[vol.uid] || 0;
    return scoreVolunteer(vol, emergency, activeTasks);
  });
  
  // Filter to qualified only if requested
  if (qualifiedOnly) {
    scored = scored.filter(s => s.isQualified);
  }
  
  // Sort: higher score first, then by experience (tiebreaker), then name
  scored.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.breakdown.experience.years !== a.breakdown.experience.years) {
      return b.breakdown.experience.years - a.breakdown.experience.years;
    }
    return a.volunteerName.localeCompare(b.volunteerName);
  });
  
  // Assign ranks
  scored.forEach((s, i) => { s.rank = i + 1; });
  
  // Apply limit
  return scored.slice(0, limit);
}

/**
 * Find the single best match for an emergency.
 */
export function findBestMatch(volunteers, emergency, taskCounts = {}) {
  const ranked = rankVolunteers(volunteers, emergency, taskCounts, { qualifiedOnly: true });
  return ranked.length > 0 ? ranked[0] : null;
}

/**
 * Check if a specific volunteer is qualified for an emergency.
 */
export function isVolunteerQualified(volunteer, emergency) {
  const result = computeSkillScore(volunteer.skills || [], emergency.requiredSkills || []);
  return {
    qualified: result.matchedSkills.length > 0,
    coverage: result.coverage,
    matchedSkills: result.matchedSkills,
    unmatchedSkills: result.unmatchedSkills,
  };
}

export default {
  scoreVolunteer,
  rankVolunteers,
  findBestMatch,
  isVolunteerQualified,
};
