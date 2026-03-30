// E&M (Evaluation & Management) MDM complexity scoring
// Implements 2021 CMS Medical Decision Making framework from Corti fact groups.
//
// MDM has 3 elements — need 2 of 3 to meet a level:
//   1. Number and complexity of problems addressed (from: assessment)
//   2. Amount/complexity of data reviewed (from: laboratory-results, imaging-results)
//   3. Risk of complications (from: plan, actions, medications-prior-to-visit)

export type MDMLevel = 'low' | 'moderate' | 'high';
export type PatientType = 'new' | 'established';

export interface MDMScores {
  problems: MDMLevel;
  data: MDMLevel;
  risk: MDMLevel;
  overall: MDMLevel;
}

export interface EMScoringResult {
  code: string;           // CPT code e.g. "99214"
  level: MDMLevel;
  mdm: MDMScores;
  reasoning: {
    problems: string;
    data: string;
    risk: string;
  };
}

interface Fact {
  id: string;
  text: string;
  group: string;
}

// ─── Keyword patterns ────────────────────────────────────────────────────────

const HIGH_SEVERITY = /\b(severe|acute|exacerbat|uncontrolled|unstable|decompensate|crisis|emerg|failure|sepsis|shock|critical|deteriorat|worsen|rapid|sudden onset)\b/i;

const CHRONIC_DISEASE = /\b(diabetes|hypertension|COPD|asthma|heart failure|CKD|chronic kidney|coronary|atrial fib|depression|anxiety|cancer|HIV|epilepsy|Parkinson|dementia|stroke|cirrhosis|IBD|Crohn|lupus|rheumatoid|multiple sclerosis)\b/i;

const HIGH_RISK_PLAN = /\b(hospitali|admit|ICU|intravenous|IV |surgery|surgical|referral to specialist|urgent care|emergency|drug therapy requiring|intensive monitor|decision.*hospitali|major.*procedure|biopsie|biopsy|intubat|ventilat)\b/i;

const MODERATE_RISK_PLAN = /\b(prescri|new medication|start.*mg|titrat|refill|physical therapy|OT|occupational therapy|follow.?up with|specialist consult|imaging order|lab order|monitor|adjust dose|escalat)\b/i;

// ─── E&M code tables ─────────────────────────────────────────────────────────

const ESTABLISHED_CODES: Record<MDMLevel, string> = {
  low: '99213',
  moderate: '99214',
  high: '99215',
};

const NEW_PATIENT_CODES: Record<MDMLevel, string> = {
  low: '99203',
  moderate: '99204',
  high: '99205',
};

// ─── Scoring functions ────────────────────────────────────────────────────────

function scoreProblems(assessmentFacts: Fact[]): { level: MDMLevel; reason: string } {
  if (assessmentFacts.length === 0) {
    return { level: 'low', reason: 'No assessment facts found' };
  }

  const allText = assessmentFacts.map((f) => f.text).join(' ');
  const count = assessmentFacts.length;

  if (HIGH_SEVERITY.test(allText)) {
    return {
      level: 'high',
      reason: `${count} problem(s) with high-severity language (acute/severe/exacerbation)`,
    };
  }

  if (count >= 3 || (count >= 2 && CHRONIC_DISEASE.test(allText))) {
    return {
      level: 'high',
      reason: `${count} problems addressed including complex chronic conditions`,
    };
  }

  if (count >= 2 || CHRONIC_DISEASE.test(allText)) {
    return {
      level: 'moderate',
      reason: `${count} problem(s) including chronic disease management`,
    };
  }

  return { level: 'low', reason: `${count} self-limited or minor problem(s)` };
}

function scoreData(labFacts: Fact[], imagingFacts: Fact[]): { level: MDMLevel; reason: string } {
  const total = labFacts.length + imagingFacts.length;

  if (total === 0) {
    return { level: 'low', reason: 'No lab or imaging data reviewed' };
  }

  if (total >= 3 || (labFacts.length >= 1 && imagingFacts.length >= 1)) {
    return {
      level: 'high',
      reason: `${labFacts.length} lab result(s) and ${imagingFacts.length} imaging result(s) reviewed`,
    };
  }

  return {
    level: 'moderate',
    reason: `${total} data point(s) reviewed (${labFacts.length} lab, ${imagingFacts.length} imaging)`,
  };
}

function scoreRisk(planFacts: Fact[], actionFacts: Fact[]): { level: MDMLevel; reason: string } {
  const allText = [...planFacts, ...actionFacts].map((f) => f.text).join(' ');

  if (planFacts.length === 0 && actionFacts.length === 0) {
    return { level: 'low', reason: 'No plan or action facts' };
  }

  if (HIGH_RISK_PLAN.test(allText)) {
    return {
      level: 'high',
      reason: 'High-risk decision making (hospitalization, surgery, or intensive monitoring)',
    };
  }

  if (MODERATE_RISK_PLAN.test(allText)) {
    return {
      level: 'moderate',
      reason: 'Prescription drug management or specialist referral',
    };
  }

  return { level: 'low', reason: 'Minor or self-limiting treatment plan' };
}

// ─── MDM matrix — need 2 of 3 elements ───────────────────────────────────────

function applyMDMMatrix(
  problems: MDMLevel,
  data: MDMLevel,
  risk: MDMLevel
): MDMLevel {
  const levels: MDMLevel[] = [problems, data, risk];
  const score = (level: MDMLevel) =>
    level === 'high' ? 2 : level === 'moderate' ? 1 : 0;

  const scores = levels.map(score);
  const highCount = scores.filter((s) => s === 2).length;
  const moderateCount = scores.filter((s) => s >= 1).length;

  // High: 2+ elements at high
  if (highCount >= 2) return 'high';
  // Moderate: 2+ elements at moderate OR 1 high + 1 moderate
  if (moderateCount >= 2) return 'moderate';
  return 'low';
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function scoreEM(
  facts: Fact[],
  patientType: PatientType = 'established'
): EMScoringResult {
  const byGroup = (group: string) => facts.filter((f) => f.group === group);

  const assessmentFacts = byGroup('assessment');
  const labFacts = byGroup('laboratory-results');
  const imagingFacts = byGroup('imaging-results');
  const planFacts = byGroup('plan');
  const actionFacts = byGroup('actions');

  const problems = scoreProblems(assessmentFacts);
  const data = scoreData(labFacts, imagingFacts);
  const risk = scoreRisk(planFacts, actionFacts);

  const overall = applyMDMMatrix(problems.level, data.level, risk.level);

  const codes = patientType === 'new' ? NEW_PATIENT_CODES : ESTABLISHED_CODES;

  return {
    code: codes[overall],
    level: overall,
    mdm: {
      problems: problems.level,
      data: data.level,
      risk: risk.level,
      overall,
    },
    reasoning: {
      problems: problems.reason,
      data: data.reason,
      risk: risk.reason,
    },
  };
}
