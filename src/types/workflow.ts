// Workflow Agent Types
// These replace the diagnosis-centric agents with workflow automation agents.
// The provider diagnoses. The app handles everything else.

import type { Fact } from './corti';

// ============================================================================
// DOCUMENT TYPES
// ============================================================================

export type DocumentType =
  | 'soap-note'
  | 'after-visit-summary'
  | 'discharge-instructions'
  | 'referral-letter'
  | 'prescription'
  | 'lab-order'
  | 'follow-up-plan'
  | 'shift-handoff';

export interface DocumentRequest {
  type: DocumentType;
  interactionId: string;
  facts: Fact[];
  transcript?: string;
  patientInfo?: PatientContext;
  // Additional context the provider wants included
  providerNotes?: string;
  // For referral letters
  referralTo?: string;
  referralReason?: string;
}

export interface GeneratedDocument {
  type: DocumentType;
  title: string;
  sections: DocumentSection[];
  generatedAt: string;
  // For sharing with patient
  shareableId?: string;
}

export interface DocumentSection {
  key: string;
  title: string;
  content: string;
}

// ============================================================================
// WORKFLOW AGENT DEFINITIONS
// ============================================================================

export type WorkflowAgentRole =
  | 'document'              // SOAP notes, referral letters, discharge summaries
  | 'patient-communication' // Plain-language summaries, care instructions
  | 'prescription'          // Medication orders with dosing, interactions check
  | 'follow-up'             // Scheduling, reminders, outcome tracking
  | 'form-filler';          // Extract patient info from transcript

// ============================================================================
// PATIENT CONTEXT (shared across agents)
// ============================================================================

export interface PatientContext {
  name?: string;
  age?: string;
  sex?: string;
  weight?: number;
  weightUnit?: 'kg' | 'lbs';
  mrn?: string;
}

// ============================================================================
// WORKFLOW REQUEST/RESPONSE
// ============================================================================

export interface WorkflowRequest {
  interactionId: string;
  facts: Fact[];
  transcript?: string;
  patientInfo?: PatientContext;
  // Which documents to generate
  documents: DocumentType[];
  // Optional: provider's own assessment (they still diagnose)
  providerDiagnosis?: string;
  providerTreatmentPlan?: string;
  providerNotes?: string;
  // Evidence findings from uploaded files
  evidenceFindings?: Array<{ id: string; text: string; group: string; confidence?: number }>;
  // Prior encounter context
  priorContext?: Array<{ encounterId: string; date: string; facts: Array<{ id: string; text: string; group: string }>; diagnosis?: string }>;
  // Language for Corti document generation ('en' | 'fr')
  language?: string;
}

export interface WorkflowResponse {
  documents: GeneratedDocument[];
  // Extracted patient info if not provided
  extractedPatientInfo?: PatientContext;
  // Follow-up suggestions
  followUp?: FollowUpSuggestion;
  // Execution trace for debugging
  agentTrace: WorkflowTraceEntry[];
  totalDuration: number;
}

export interface WorkflowTraceEntry {
  agent: WorkflowAgentRole;
  status: 'success' | 'error' | 'skipped';
  duration: number;
  documentsGenerated: DocumentType[];
  error?: string;
}

// ============================================================================
// PRESCRIPTION TYPES
// ============================================================================

export interface PrescriptionItem {
  drug: string;
  dose: string;
  doseCalculation?: string;
  route: string;
  frequency: string;
  duration: string;
  quantity?: string;
  refills?: number;
  instructions: string; // Plain language for patient
  warnings?: string[];
}

export interface PrescriptionDocument {
  patientName: string;
  age?: string;
  weight?: string;
  date: string;
  prescriptions: PrescriptionItem[];
  prescribingProvider: string;
  npi?: string;
  dea?: string;
  clinicInfo?: string;
}

// ============================================================================
// FOLLOW-UP TYPES
// ============================================================================

export interface FollowUpSuggestion {
  recommendedDate: string; // ISO date
  reason: string;
  type: 'recheck' | 'lab-recheck' | 'wound-check' | 'imaging' | 'custom';
  instructions?: string;
  // What to monitor between now and follow-up
  monitoringInstructions?: string[];
  warningSignsForPatient?: string[];
}

export interface FollowUpRecord {
  id: string;
  encounterId: string;
  patientId: string;
  scheduledDate: string;
  type: FollowUpSuggestion['type'];
  reason: string;
  status: 'pending' | 'scheduled' | 'completed' | 'missed' | 'cancelled';
  reminderSent: boolean;
  completedDate?: string;
  notes?: string;
}
