// Corti API Types
// Reference: https://docs.corti.ai/about/introduction

export interface CortiConfig {
  clientId: string;
  clientSecret: string;
  tenant: string;
  region?: 'eu' | 'us';
}

export interface AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface Interaction {
  id: string;
  interactionId: string;
  created_at: string;
  status: string;
  websocketUrl?: string;
}

export interface Transcript {
  id: string;
  interaction_id: string;
  text: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  segments?: TranscriptSegment[];
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface ExtractedFact {
  type: string;
  value: string;
  confidence: number;
  source_text?: string;
}

export interface Document {
  id: string;
  interaction_id: string;
  template_id: string;
  content: string;
  created_at: string;
}

export interface MedicalCode {
  code: string;
  system: 'ICD-10-CM' | 'ICD-10-PCS' | 'CPT';
  description: string;
  confidence: number;
  evidences?: Array<{ text: string; start: number; end: number }>;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  specialty?: string;
  fields: TemplateField[];
}

export interface TemplateField {
  name: string;
  type: 'text' | 'select' | 'multiselect' | 'date' | 'number';
  required: boolean;
  options?: string[];
}

// Document Generation Types
// Simplified fact format for Corti document generation API
export interface SimplifiedFact {
  text: string;
  source: 'core' | 'system' | 'user';
  group?: string;
}

export interface FactContext {
  type: 'facts';
  data: Fact[] | SimplifiedFact[];
}

export interface TranscriptContext {
  type: 'transcript';
  data: string;
}

export interface StringContext {
  type: 'string';
  data: string;
}

export type DocumentContext = FactContext | TranscriptContext | StringContext;

export interface Fact {
  id: string;
  text: string;
  group: string;
  groupId: string;
  isDiscarded: boolean;
  source: string;
  createdAt: string;
  createdAtTzOffset: string | null;
  updatedAt: string;
  updatedAtTzOffset: string | null;
  evidence: unknown[];
}

export interface TemplateSection {
  key: string;
  nameOverride?: string;
  contentOverride?: string;
  writingStyleOverride?: string;
  formatRuleOverride?: string;
  additionalInstructionsOverride?: string;
}

export interface DocumentGenerationPayload {
  context: DocumentContext[];
  templateKey?: string;
  template?: {
    sections: TemplateSection[];
  };
  outputLanguage: string;
  name?: string;
  documentationMode?: 'routed_parallel' | 'sequential';
}

// Generated document with sections (matches Corti v2 API response)
export interface GeneratedDocument {
  id: string;
  name?: string;
  templateRef?: string;
  isStream?: boolean;
  sections: GeneratedSection[];
  createdAt: string;
  updatedAt?: string;
  outputLanguage?: string;
  usageInfo?: {
    creditsConsumed: number;
  };
}

export interface GeneratedSection {
  key: string;
  name?: string;  // Corti uses 'name' for title
  text?: string;  // Corti uses 'text' for content
  // Legacy/normalized fields
  title?: string;
  content?: string;
  sort?: number;
  createdAt?: string;
  updatedAt?: string;
}

// Streaming/WebSocket Types
export interface StreamConfig {
  transcription: {
    primaryLanguage: string;
    isDiarization: boolean;
    isMultichannel: boolean;
    participants: Array<{
      channel: number;
      role: 'clinician' | 'patient' | 'multiple';
    }>;
  };
  mode: {
    type: 'facts' | 'transcription';
    outputLocale: string;
  };
}

export interface StreamTranscriptSegment {
  id: string;
  transcript: string;
  final: boolean;
  speakerId: number;
  participant: {
    channel: number;
  };
  time: {
    start: number;
    end: number;
  };
}

export interface StreamTranscriptMessage {
  type: 'transcript';
  data: StreamTranscriptSegment[];
}

export interface StreamFactMessage {
  type: 'facts';
  fact: Fact[];
}

export interface StreamConfigAccepted {
  type: 'CONFIG_ACCEPTED';
}

export interface StreamFlushed {
  type: 'flushed';
}

export interface StreamEnded {
  type: 'ENDED';
}

export interface StreamError {
  type: 'error';
  id: string;
  title: string;
  status: number;
}

export type StreamMessage =
  | StreamTranscriptMessage
  | StreamFactMessage
  | StreamConfigAccepted
  | StreamFlushed
  | StreamEnded
  | StreamError;

// Recording type (matches convex/schema.ts recordings table)
export interface Recording {
  _id: string;
  encounterId: string;
  interactionId?: string;
  duration?: number;
  transcript?: string;
  facts?: Array<{ id: string; text: string; group: string }>;
  phase?: 'history' | 'exam' | 'assessment' | 'follow-up';
  orderIndex?: number;
  createdAt: string;
}

// Encounter session data (for passing between pages)
export interface EncounterSession {
  interactionId: string;
  transcript: StreamTranscriptSegment[];
  transcriptText: string;  // Pre-accumulated transcript (deduplicated)
  facts: Fact[];
  duration: number;
  createdAt: string;
  encounterId?: string; // For appending to existing encounter
}

// Clinical-specific extensions
export interface VetFact extends Fact {
  // Map Corti fact groups to clinical concepts
  vetCategory?: 'vitals' | 'history' | 'exam' | 'labs' | 'assessment' | 'plan';
}

// Fact group mappings for clinical use
export const FACT_GROUP_LABELS: Record<string, string> = {
  'chief-complaint': 'Chief Complaint',
  'history-of-present-illness': 'History of Present Illness',
  'past-medical-history': 'Past Medical History',
  medications: 'Current Medications',
  allergies: 'Allergies',
  'family-history': 'Family History',
  'review-of-systems': 'Review of Systems',
  'physical-exam': 'Physical Exam',
  vitals: 'Vitals',
  assessment: 'Assessment',
  plan: 'Plan',
  demographics: 'Patient Info',

  // Billing groups
  'billing-procedure': 'Billable Procedures',
  'billing-exam': 'Billable Exams',
  'billing-lab': 'Billable Lab Tests',
  'billing-medication': 'Billable Medications',
  'billing-supply': 'Billable Supplies',
};

// ============================================================================
// CORTI AGENTIC API TYPES
// ============================================================================

// Agent types
export type CortiAgentType = 'expert' | 'orchestrator' | 'interviewing-expert';

export interface CortiAgent {
  id: string;
  name: string;
  description: string;
  systemPrompt?: string;
  agentType?: CortiAgentType;
  experts?: CortiExpertConfig[];
  createdAt?: string;
  updatedAt?: string;
}

// Expert configuration
export type CortiExpertConfig = CortiExpertReference | CortiNewExpert;

export interface CortiExpertReference {
  type: 'reference';
  id?: string;
  name: string;
  systemPrompt?: string;
}

export interface CortiNewExpert {
  type: 'new';
  name: string;
  description: string;
  systemPrompt?: string;
  mcpServers?: CortiMcpServer[];
}

export interface CortiMcpServer {
  name: string;
  description?: string;
  transportType: 'streamable_http' | 'stdio';
  authorizationType: 'none' | 'bearer' | 'inherit' | 'oauth2';
  url: string;
  bearerToken?: string;
}

// Message types for A2A protocol
export type CortiMessageRole = 'user' | 'agent';

export interface CortiMessage {
  role: CortiMessageRole;
  parts: CortiMessagePart[];
}

export type CortiMessagePart = CortiTextPart | CortiDataPart | CortiFilePart;

export interface CortiTextPart {
  type: 'text';
  text: string;
}

export interface CortiDataPart {
  type: 'data';
  mimeType: 'application/json';
  data: Record<string, unknown>;
}

export interface CortiFilePart {
  type: 'file';
  mimeType: string;
  uri: string;
  name?: string;
}

// Task types
export type CortiTaskState = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'input-required';

// Response part types (Corti API uses 'kind' instead of 'type')
export interface CortiResponseTextPart {
  kind: 'text';
  text: string;
}

export interface CortiResponseDataPart {
  kind: 'data';
  mimeType: string;
  data: unknown;
}

export type CortiResponsePart = CortiResponseTextPart | CortiResponseDataPart;

export interface CortiTaskStatus {
  state: CortiTaskState;
  message?: {
    kind: 'message';
    messageId: string;
    contextId: string;
    parts: CortiResponsePart[];
    role: string;
    taskId: string;
  };
  timestamp: string;
}

export interface CortiTask {
  kind: 'task';
  id: string;
  contextId: string;
  status: CortiTaskStatus;
  artifacts?: CortiArtifact[];
  history?: unknown[];
  metadata?: Record<string, unknown>;
  error?: CortiTaskError;
}

export interface CortiTaskError {
  code: string;
  description: string;
  howToFix?: string;
}

export interface CortiArtifact {
  artifactId: string;
  parts: CortiResponsePart[];
}

// API Request/Response types
export interface CreateCortiAgentRequest {
  name: string;
  description: string;
  agentType?: CortiAgentType;
  systemPrompt?: string;
  experts?: CortiExpertConfig[];
}

export type CreateCortiAgentResponse = CortiAgent;

export interface SendCortiMessageRequest {
  message: CortiMessage;
  contextId?: string;
}

export interface SendCortiMessageResponse {
  task: CortiTask;
}

export interface ListCortiAgentsResponse {
  agents: CortiAgent[];
}

export interface ListCortiExpertsResponse {
  experts: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

// Utility function to extract text from task response
export function extractTaskText(task: CortiTask): string | null {
  // Check if task completed successfully
  if (task.status?.state !== 'completed') {
    return null;
  }

  // First try to get text from artifacts (primary location)
  if (task.artifacts && task.artifacts.length > 0) {
    for (const artifact of task.artifacts) {
      const textPart = artifact.parts.find((p): p is CortiResponseTextPart => p.kind === 'text');
      if (textPart?.text) {
        return textPart.text;
      }
    }
  }

  // Fallback to status.message if no artifacts
  if (task.status?.message?.parts) {
    const textPart = task.status.message.parts.find((p): p is CortiResponseTextPart => p.kind === 'text');
    if (textPart?.text) {
      return textPart.text;
    }
  }

  return null;
}


