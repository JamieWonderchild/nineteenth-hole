// Patient Companion Types
// The "reverse AI scribe" - an AI companion for patients after their clinical visit.
// Helps patients understand their visit, medications, and follow-up instructions.

// ============================================================================
// COMPANION SESSION
// ============================================================================

export interface CompanionSession {
  id: string;
  encounterId: string;
  patientId: string;
  // Public access token (no auth needed for patients)
  accessToken: string;
  // Context loaded into the companion AI
  context: CompanionContext;
  // Session metadata
  createdAt: string;
  expiresAt: string; // Sessions expire (e.g., 30 days after encounter)
  isActive: boolean;
  // Usage tracking
  messageCount: number;
  lastAccessedAt?: string;
}

export interface CompanionContext {
  // Patient info
  patientName: string;
  age?: string;
  // Visit summary (plain language, not raw transcript)
  visitSummary: string;
  visitDate: string;
  // Extracted facts grouped for context
  diagnosis?: string;
  treatmentPlan?: string;
  medications?: CompanionMedication[];
  followUpDate?: string;
  followUpReason?: string;
  // Care instructions
  homeCareInstructions?: string[];
  warningSignsToWatch?: string[];
  dietaryInstructions?: string;
  activityRestrictions?: string;
  // Clinic/practice info for emergencies
  clinicName?: string;
  clinicPhone?: string;
  emergencyPhone?: string;
  // Billed services from finalized invoice
  chargedServices?: CompanionChargedService[];
}

export interface CompanionChargedService {
  description: string;
  quantity: number;
  unitPrice: number; // cents
  total: number; // cents
}

export interface CompanionMedication {
  name: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string; // Plain language
  startDate?: string;
  endDate?: string;
}

// ============================================================================
// COMPANION CHAT
// ============================================================================

export interface CompanionMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface CompanionChatRequest {
  sessionId: string;
  accessToken: string;
  message: string;
  // Previous messages for context (kept client-side to save DB writes)
  history?: CompanionMessage[];
}

export interface CompanionChatResponse {
  message: string;
  // Suggested follow-up questions (helps guide the patient)
  suggestions?: string[];
}

// ============================================================================
// CREATE SESSION REQUEST
// ============================================================================

export interface CreateCompanionRequest {
  encounterId: string;
  // Override context if provider wants to customize
  customInstructions?: string;
  // Expiry in days (default 30)
  expiryDays?: number;
}

export interface CreateCompanionResponse {
  sessionId: string;
  accessToken: string;
  shareableUrl: string;
  expiresAt: string;
}

// ============================================================================
// COMPANION AI SYSTEM PROMPT
// ============================================================================

export const COMPANION_SYSTEM_PROMPT = `You are a friendly, knowledgeable patient care companion helping a patient (or their caregiver) understand and follow through on their recent clinical visit.

## Your Role
- You help patients understand what happened during their visit
- You answer questions about medications, care instructions, and what to expect during recovery
- You provide reassurance while being honest about when to seek additional medical attention
- You are NOT a replacement for medical advice — you help patients follow through on their physician's instructions

## Your Personality
- Warm, empathetic, and patient
- You address the patient by name and speak respectfully
- You explain medical terms in plain, everyday language
- You never dismiss patient concerns
- You always err on the side of "contact your doctor" or "go to the ER" when unsure

## Rules
- NEVER provide new diagnoses or change the physician's treatment plan
- NEVER recommend medications not prescribed by the physician
- Always refer back to the physician's actual instructions from this visit
- If the patient describes NEW symptoms not covered in the visit notes, advise them to contact their care team
- If symptoms sound urgent (chest pain, difficulty breathing, sudden weakness, severe bleeding, signs of stroke), say "Please call 911 or go to the nearest emergency department immediately"
- Keep responses concise and actionable
- Use bullet points for instructions and timelines

## Medication Guidance
When answering questions about prescribed medications:
- Explain dosing instructions in simple, practical terms (e.g., "Take one tablet by mouth twice daily with food")
- Clarify timing if multiple medications are prescribed
- Explain what to do if a dose is missed (generally: take when remembered if within a few hours, otherwise skip and resume normal schedule — but always defer to the prescription label)
- Mention common side effects the patient should be aware of
- Emphasize the importance of completing the full course for antibiotics
- Note any special storage or food interaction requirements
- Always refer to the specific medications and instructions from THIS visit only

## Context
You have access to the full details of {patientName}'s recent visit on {visitDate}. Use this information to answer their questions accurately.`;

// ============================================================================
// SUGGESTED QUESTIONS (shown to patient on first load)
// ============================================================================

export const DEFAULT_SUGGESTIONS = [
  "Can you summarize what happened during my visit?",
  "How do I take my medications correctly?",
  "What warning signs should I watch for?",
  "When is my follow-up appointment?",
  "Are there any activity or dietary restrictions I should follow?",
];
