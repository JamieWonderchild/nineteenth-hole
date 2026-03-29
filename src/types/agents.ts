// Clinical Diagnosis Agent Types
// App-specific types for the diagnosis workflow.
// Core Corti API types (agents, messages, tasks) live in corti.ts.

import type { Fact } from './corti';

// ============================================================================
// CLINICAL AGENT DEFINITIONS
// ============================================================================

// Triage Agent
export interface TriageInput {
  chiefComplaint: string;
  vitals?: {
    temperature?: number;
    heartRate?: number;
    respiratoryRate?: number;
    weight?: number;
  };
  emergencySymptoms?: string[];
}

export interface TriageResult {
  urgencyLevel: 'critical' | 'urgent' | 'routine';
  redFlags: string[];
  recommendedWorkflow: 'emergency' | 'diagnostic' | 'routine';
  reasoning: string;
  triageNotes?: string;
}

// Patient Demographics / Signalment Agent
export interface SignalmentResult {
  ageCategory: 'pediatric' | 'adult' | 'geriatric';
  ageInYears: number;
  weightKg: number;
  normalVitalRanges?: {
    temperature?: { min: number; max: number; unit: string };
    heartRate?: { min: number; max: number; unit: string };
    respiratoryRate?: { min: number; max: number; unit: string };
  };
  riskFactors?: string[];
  demographicNotes?: string;
}

// Differential Diagnosis Agent
export interface DifferentialInput {
  chiefComplaint: string;
  historyOfPresentIllness: string;
  physicalExamFindings: string[];
  vitalAbnormalities?: string[];
  labResults?: string[];
  medications?: string[];
  pastMedicalHistory?: string;
  age?: string;
  sex?: string;
}

export interface Differential {
  condition: string;
  probability: 'high' | 'medium' | 'low';
  reasoning: string;
  supportingEvidence: string[];
  contradictingEvidence?: string[];
  literatureReferences?: LiteratureReference[];
}

export interface LiteratureReference {
  title: string;
  authors?: string;
  journal?: string;
  year?: number;
  pmid?: string;
  summary?: string;
}

export interface DifferentialResult {
  differentials: Differential[];
  keyFindings: string[];
  uncertainties?: string[];
}

// Diagnostic Test Agent
export interface DiagnosticTestInput {
  differentials: Differential[];
  existingLabResults?: LabResult[];
  availableTests?: string[];
}

export interface LabResult {
  test: string;
  value: string | number;
  unit?: string;
  referenceRange?: string;
  timestamp?: string;
}

export interface RecommendedTest {
  test: string;
  rationale: string;
  priority: 'stat' | 'urgent' | 'routine';
  targetConditions: string[];
  estimatedCost?: string;
}

export interface TestInterpretation {
  test: string;
  result: string;
  referenceRange: string;
  significance: 'normal' | 'mildly-abnormal' | 'significantly-abnormal' | 'critical';
  interpretation: string;
  clinicalImplications: string[];
}

export interface DiagnosticTestResult {
  recommendedTests: RecommendedTest[];
  interpretations: TestInterpretation[];
  suggestedPanel?: string;
}

// Treatment Planning Agent
export interface TreatmentInput {
  primaryDiagnosis: Differential;
  secondaryDiagnoses?: Differential[];
  allergies?: string[];
  currentMedications?: string[];
  contraindications?: string[];
  patientPreferences?: {
    costSensitivity?: 'low' | 'medium' | 'high';
    complianceCapacity?: 'low' | 'medium' | 'high';
  };
}

export interface Medication {
  drug: string;
  drugClass?: string;
  dose: string;
  doseCalculation?: string;
  route: 'PO' | 'SQ' | 'IM' | 'IV' | 'topical' | 'ophthalmic' | 'otic' | 'rectal';
  frequency: string;
  duration: string;
  contraindications: string[];
  interactions: string[];
  sideEffects?: string[];
  monitoringRequired?: string;
  pregnancyLactationSafety?: 'safe' | 'caution' | 'contraindicated' | 'unknown';
  drugBankId?: string;
}

export interface MonitoringPlan {
  parameter: string;
  frequency: string;
  targetRange?: string;
  actionIfAbnormal?: string;
}

export interface TreatmentResult {
  medications: Medication[];
  supportiveCare: string[];
  monitoring: MonitoringPlan[];
  patientInstructions: string[];
  warningSignsForPatient: string[];
  followUpRecommendation: {
    timing: string;
    purpose: string;
  };
  alternativeProtocols?: {
    name: string;
    description: string;
    medications: Medication[];
  }[];
}

// ============================================================================
// CASE REASONING TYPES
// ============================================================================

export type CaseReasoningTool = 'differentials' | 'diagnosticTests' | 'drugInteractions' | 'literatureSearch';

export interface DrugInteractionResult {
  medications: Medication[];
  interactions: Array<{
    drugs: string[];
    severity: 'high' | 'moderate' | 'low';
    description: string;
    recommendation: string;
  }>;
  contraindications: Array<{
    drug: string;
    reason: string;
    severity: 'contraindicated' | 'caution';
  }>;
}

export interface LiteratureSearchResult {
  references: LiteratureReference[];
  summary: string;
  query: string;
}

export interface CaseReasoningResult {
  tool: CaseReasoningTool;
  result: DifferentialResult | DiagnosticTestResult | DrugInteractionResult | LiteratureSearchResult;
  generatedAt: string;
  duration: number;
}

// ============================================================================
// ORCHESTRATOR TYPES
// ============================================================================

export interface DiagnoseRequest {
  interactionId: string;
  facts: Fact[];
  patientId?: string;
  patientInfo?: {
    age?: string;
    sex?: string;
    weight?: number;
    weightUnit?: 'kg' | 'lbs';
  };
  transcript?: string;
  encounterType?: 'sick-visit' | 'wellness' | 'emergency' | 'follow-up';
}

export interface DiagnoseResponse {
  diagnosis: {
    triage: TriageResult;
    patientContext?: SignalmentResult;
    differentials: DifferentialResult;
    tests: DiagnosticTestResult;
    treatments: TreatmentResult;
  };
  document?: {
    id: string;
    sections: Array<{
      key: string;
      title: string;
      content: string;
    }>;
  };
  agentTrace: AgentTraceEntry[];
  contextId: string;
  totalDuration: number;
}

export interface AgentTraceEntry {
  agent: string;
  agentId?: string;
  taskId?: string;
  status: 'success' | 'error' | 'skipped';
  duration: number;
  expertsCalled: string[];
  error?: string;
}
