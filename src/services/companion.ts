// Companion AI Service
// "Reverse AI scribe" - helps patients understand and follow through on their provider visit.
// Uses Corti Agentic API with an ephemeral agent per session.

import type {
  CompanionContext,
  CompanionMessage,
  CompanionChatResponse,
  CompanionMedication,
} from '@/types/companion';
import { COMPANION_SYSTEM_PROMPT, DEFAULT_SUGGESTIONS } from '@/types/companion';
import { CortiAgentClient, getCortiAgentClient } from '@/services/corti-agents';
import type { CreateCortiAgentRequest } from '@/types/corti';
import { extractTaskText } from '@/types/corti';

// ============================================================================
// CORTI CLIENT
// ============================================================================

function getCortiClient(): CortiAgentClient {
  return getCortiAgentClient();
}

// ============================================================================
// LAZY AGENT CREATION
// ============================================================================

interface CompanionAgentIds {
  agentId: string;
  contextId: string | undefined;
  isNew: boolean;
}

/**
 * Get or create the Corti agent for a companion session.
 * On first message, creates an ephemeral agent with the full visit context as system prompt.
 * On subsequent messages, reuses the existing agent + contextId for conversation continuity.
 */
async function getOrCreateCompanionAgent(
  context: CompanionContext,
  options: { cortiAgentId?: string; cortiContextId?: string; sessionId?: string }
): Promise<CompanionAgentIds> {
  // Reuse existing agent if we have IDs
  if (options.cortiAgentId) {
    return {
      agentId: options.cortiAgentId,
      contextId: options.cortiContextId,
      isNew: false,
    };
  }

  // Pre-check Corti credentials before attempting agent creation
  const requiredVars = ['CORTI_CLIENT_ID', 'CORTI_CLIENT_SECRET', 'CORTI_TENANT'];
  const missing = requiredVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error('[Companion] Missing Corti credentials:', missing.join(', '));
    throw new Error(`Corti credentials not configured: ${missing.join(', ')}`);
  }

  // Create a new ephemeral Corti agent for this session
  const client = getCortiClient();
  const systemPrompt = buildCompanionSystemPrompt(context);
  const sessionPrefix = options.sessionId ? options.sessionId.slice(0, 8) : Date.now().toString(36);

  const request: CreateCortiAgentRequest = {
    name: `companion-${sessionPrefix}`,
    description: `Patient care companion for ${context.patientName}`,
    systemPrompt,
    experts: [], // No experts - rely on system prompt for all guidance
  };

  console.log('[Companion] Creating ephemeral agent:', request.name);
  let agent;
  try {
    agent = await client.createAgent(request, true); // ephemeral
    console.log('[Companion] Agent created:', agent.id);
  } catch (err) {
    console.error('[Companion] Failed to create agent:', err);
    throw err;
  }

  return {
    agentId: agent.id,
    contextId: undefined, // Will be set by first message response
    isNew: true,
  };
}

// ============================================================================
// CREATE COMPANION SESSION CONTEXT
// ============================================================================

/**
 * Creates a CompanionContext from raw encounter data.
 * This is the structured context that gets stored and loaded into the AI system prompt.
 */
export function createCompanionSession(
  encounterId: string,
  facts: Array<{ id: string; text: string; group: string }>,
  transcript: string | undefined,
  patientInfo: {
    name: string;
    age?: string;
  },
  documents?: {
    soapNote?: { sections: Array<{ key: string; title: string; content: string }> };
    afterVisitSummary?: { sections: Array<{ key: string; title: string; content: string }> };
    dischargeInstructions?: { sections: Array<{ key: string; title: string; content: string }> };
  },
  diagnosisResult?: {
    triage?: { urgencyLevel: string; redFlags: string[]; recommendedWorkflow: string; reasoning: string };
    differentials?: Array<{ condition: string; probability: string; reasoning: string }>;
    medications?: Array<{ drug: string; dose: string; route: string; frequency: string; duration: string }>;
  },
  clinicInfo?: {
    clinicName?: string;
    clinicPhone?: string;
    emergencyPhone?: string;
  },
  chargedServices?: Array<{ description: string; quantity: number; unitPrice: number; total: number }>
): CompanionContext {
  // Extract facts by group for structured context building
  const factsByGroup = groupFacts(facts);

  // Build visit summary from available sources (prefer client summary, fall back to facts)
  const visitSummary = buildVisitSummary(factsByGroup, documents, transcript);

  // Extract diagnosis from facts or diagnosis result
  const diagnosis = extractDiagnosis(factsByGroup, diagnosisResult);

  // Extract treatment plan
  const treatmentPlan = extractTreatmentPlan(factsByGroup, diagnosisResult);

  // Extract medications from diagnosis result or facts
  const medications = extractMedications(factsByGroup, diagnosisResult);

  // Extract follow-up info
  const followUp = extractFollowUp(factsByGroup);

  // Extract care instructions from discharge document or facts
  const careInstructions = extractCareInstructions(factsByGroup, documents);

  const context: CompanionContext = {
    patientName: patientInfo.name,
    age: patientInfo.age,
    visitSummary,
    visitDate: new Date().toISOString().split('T')[0],
    diagnosis: diagnosis || undefined,
    treatmentPlan: treatmentPlan || undefined,
    medications: medications.length > 0 ? medications : undefined,
    followUpDate: followUp.date || undefined,
    followUpReason: followUp.reason || undefined,
    homeCareInstructions: careInstructions.homeCare.length > 0 ? careInstructions.homeCare : undefined,
    warningSignsToWatch: careInstructions.warningsSigns.length > 0 ? careInstructions.warningsSigns : undefined,
    dietaryInstructions: careInstructions.dietary || undefined,
    activityRestrictions: careInstructions.activity || undefined,
    clinicName: clinicInfo?.clinicName,
    clinicPhone: clinicInfo?.clinicPhone,
    emergencyPhone: clinicInfo?.emergencyPhone,
    chargedServices: chargedServices && chargedServices.length > 0 ? chargedServices : undefined,
  };

  return context;
}

// ============================================================================
// BUILD SYSTEM PROMPT
// ============================================================================

/**
 * Builds the full system prompt with all encounter context injected.
 * This is what the companion AI sees as its "knowledge" about the visit.
 */
export function buildCompanionSystemPrompt(
  context: CompanionContext,
  customInstructions?: string
): string {
  // Start with the base prompt, replacing placeholders
  let prompt = COMPANION_SYSTEM_PROMPT
    .replace('{patientName}', context.patientName)
    .replace('{visitDate}', context.visitDate);

  // Add structured encounter data
  prompt += '\n\n---\n\n## Visit Details\n\n';

  // Patient info
  prompt += `### Patient\n`;
  prompt += `- **Name:** ${context.patientName}\n`;
  if (context.age) prompt += `- **Age:** ${context.age}\n`;
  prompt += '\n';

  // Visit summary
  prompt += `### Visit Summary\n${context.visitSummary}\n\n`;

  // Diagnosis
  if (context.diagnosis) {
    prompt += `### Diagnosis\n${context.diagnosis}\n\n`;
  }

  // Treatment plan
  if (context.treatmentPlan) {
    prompt += `### Treatment Plan\n${context.treatmentPlan}\n\n`;
  }

  // Medications
  if (context.medications && context.medications.length > 0) {
    prompt += `### Medications\n`;
    for (const med of context.medications) {
      prompt += `- **${med.name}**: ${med.dose}, ${med.frequency}, for ${med.duration}\n`;
      prompt += `  - Instructions: ${med.instructions}\n`;
      if (med.startDate) prompt += `  - Start date: ${med.startDate}\n`;
      if (med.endDate) prompt += `  - End date: ${med.endDate}\n`;
    }
    prompt += '\n';
  }

  // Follow-up
  if (context.followUpDate || context.followUpReason) {
    prompt += `### Follow-Up\n`;
    if (context.followUpDate) prompt += `- **Date:** ${context.followUpDate}\n`;
    if (context.followUpReason) prompt += `- **Reason:** ${context.followUpReason}\n`;
    prompt += '\n';
  }

  // Home care instructions
  if (context.homeCareInstructions && context.homeCareInstructions.length > 0) {
    prompt += `### Home Care Instructions\n`;
    for (const instruction of context.homeCareInstructions) {
      prompt += `- ${instruction}\n`;
    }
    prompt += '\n';
  }

  // Warning signs
  if (context.warningSignsToWatch && context.warningSignsToWatch.length > 0) {
    prompt += `### Warning Signs to Watch For\n`;
    for (const sign of context.warningSignsToWatch) {
      prompt += `- ${sign}\n`;
    }
    prompt += '\n';
  }

  // Dietary instructions
  if (context.dietaryInstructions) {
    prompt += `### Dietary Instructions\n${context.dietaryInstructions}\n\n`;
  }

  // Activity restrictions
  if (context.activityRestrictions) {
    prompt += `### Activity Restrictions\n${context.activityRestrictions}\n\n`;
  }

  // Clinic contact info
  if (context.clinicName || context.clinicPhone || context.emergencyPhone) {
    prompt += `### Clinic Contact Information\n`;
    if (context.clinicName) prompt += `- **Clinic:** ${context.clinicName}\n`;
    if (context.clinicPhone) prompt += `- **Phone:** ${context.clinicPhone}\n`;
    if (context.emergencyPhone) prompt += `- **Emergency:** ${context.emergencyPhone}\n`;
    prompt += '\n';
  }

  // Charged services from finalized invoice
  if (context.chargedServices && context.chargedServices.length > 0) {
    prompt += `### Services Charged During This Visit\n`;
    for (const svc of context.chargedServices) {
      const unitDollars = (svc.unitPrice / 100).toFixed(2);
      const totalDollars = (svc.total / 100).toFixed(2);
      const qtyLabel = svc.quantity > 1 ? ` x${svc.quantity}` : '';
      prompt += `- ${svc.description}${qtyLabel}: $${totalDollars} ($${unitDollars} each)\n`;
    }
    prompt += '\nNote: These are the services that were billed for this visit. You can help the patient understand what each service involved and why it was performed, but do not provide new pricing estimates or suggest additional unbilled services.\n\n';
  }

  // Custom instructions from the provider
  if (customInstructions) {
    prompt += `### Additional Notes from the Provider\n${customInstructions}\n\n`;
  }

  return prompt;
}

// ============================================================================
// CHAT WITH COMPANION
// ============================================================================

export interface CompanionChatOptions {
  cortiAgentId?: string;
  cortiContextId?: string;
  sessionId?: string;
}

export interface CompanionChatResult extends CompanionChatResponse {
  cortiAgentId?: string;
  cortiContextId?: string;
  isNewAgent?: boolean;
}

/**
 * Send a message to the companion AI and get a response.
 * Corti tracks conversation state via contextId — no history needed from client.
 */
export async function chatWithCompanion(
  context: CompanionContext,
  message: string,
  options: CompanionChatOptions = {}
): Promise<CompanionChatResult> {
  const client = getCortiClient();

  // Get or create the Corti agent for this session
  const agentIds = await getOrCreateCompanionAgent(context, options);

  // Send the message to the Corti agent
  console.log('[Companion] Sending message to agent:', agentIds.agentId, 'contextId:', agentIds.contextId);
  let task;
  try {
    task = await client.sendTextMessage(
      agentIds.agentId,
      message,
      agentIds.contextId
    );
    console.log('[Companion] Task response received:', JSON.stringify(task).slice(0, 500));
  } catch (err) {
    console.error('[Companion] sendTextMessage failed:', err);
    throw err;
  }

  // Extract the text response
  const assistantMessage = extractTaskText(task) ||
    client.extractTextFromTask(task) ||
    'I apologize, but I could not generate a response. Please try rephrasing your question.';

  // Capture contextId from the task response for subsequent messages
  const responseContextId = task.contextId || agentIds.contextId;

  // Generate contextual follow-up suggestions
  const suggestions = generateSuggestions(context, message, assistantMessage, []);

  return {
    message: assistantMessage,
    suggestions,
    // IMPORTANT: Always return agentId and contextId (not just on first message)
    // This ensures the session database stays updated with the latest contextId
    cortiAgentId: agentIds.agentId,
    cortiContextId: responseContextId,
    isNewAgent: agentIds.isNew,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Group facts by their group name for easier extraction.
 */
function groupFacts(
  facts: Array<{ id: string; text: string; group: string }>
): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const fact of facts) {
    const group = fact.group.toLowerCase();
    if (!grouped[group]) {
      grouped[group] = [];
    }
    grouped[group].push(fact.text);
  }
  return grouped;
}

/**
 * Build a visit summary from available data sources.
 */
function buildVisitSummary(
  factsByGroup: Record<string, string[]>,
  documents?: {
    afterVisitSummary?: { sections: Array<{ key: string; title: string; content: string }> };
    soapNote?: { sections: Array<{ key: string; title: string; content: string }> };
    dischargeInstructions?: { sections: Array<{ key: string; title: string; content: string }> };
  },
  transcript?: string
): string {
  // Prefer the after-visit summary if a document was generated
  if (documents?.afterVisitSummary?.sections) {
    return documents.afterVisitSummary.sections
      .map((s) => `**${s.title}**\n${s.content}`)
      .join('\n\n');
  }

  // Fall back to building from facts
  const summaryParts: string[] = [];

  // Presenting complaint / reason for visit
  const complaints = factsByGroup['presenting_complaint'] ||
    factsByGroup['chief_complaint'] ||
    factsByGroup['reason_for_visit'] ||
    factsByGroup['complaint'];
  if (complaints) {
    summaryParts.push(`Reason for visit: ${complaints.join('. ')}`);
  }

  // History
  const history = factsByGroup['history'] || factsByGroup['medical_history'];
  if (history) {
    summaryParts.push(`History: ${history.join('. ')}`);
  }

  // Physical exam findings
  const exam = factsByGroup['physical_exam'] ||
    factsByGroup['examination'] ||
    factsByGroup['vitals'];
  if (exam) {
    summaryParts.push(`Examination findings: ${exam.join('. ')}`);
  }

  // Assessment
  const assessment = factsByGroup['assessment'] || factsByGroup['diagnosis'];
  if (assessment) {
    summaryParts.push(`Assessment: ${assessment.join('. ')}`);
  }

  // Plan
  const plan = factsByGroup['plan'] || factsByGroup['treatment'];
  if (plan) {
    summaryParts.push(`Plan: ${plan.join('. ')}`);
  }

  if (summaryParts.length > 0) {
    return summaryParts.join('\n\n');
  }

  // Last resort: all facts concatenated
  const allFacts = Object.values(factsByGroup).flat();
  if (allFacts.length > 0) {
    return allFacts.join('. ');
  }

  // Very last resort: truncated transcript
  if (transcript) {
    const maxLength = 2000;
    return transcript.length > maxLength
      ? transcript.slice(0, maxLength) + '...'
      : transcript;
  }

  return 'Visit summary not available.';
}

/**
 * Extract diagnosis from facts or diagnosis result.
 */
function extractDiagnosis(
  factsByGroup: Record<string, string[]>,
  diagnosisResult?: {
    differentials?: Array<{ condition: string; probability: string; reasoning: string }>;
  }
): string | null {
  // Use diagnosis result differentials if available
  if (diagnosisResult?.differentials && diagnosisResult.differentials.length > 0) {
    return diagnosisResult.differentials
      .map((d) => `${d.condition} (${d.probability})`)
      .join('; ');
  }

  // Fall back to facts
  const diagnosis = factsByGroup['diagnosis'] || factsByGroup['assessment'];
  if (diagnosis) {
    return diagnosis.join('. ');
  }

  return null;
}

/**
 * Extract treatment plan from facts or diagnosis result.
 */
function extractTreatmentPlan(
  factsByGroup: Record<string, string[]>,
  diagnosisResult?: {
    medications?: Array<{ drug: string; dose: string; route: string; frequency: string; duration: string }>;
  }
): string | null {
  const plan = factsByGroup['plan'] || factsByGroup['treatment'] || factsByGroup['treatment_plan'];
  if (plan) {
    return plan.join('. ');
  }

  // Build from diagnosis result medications
  if (diagnosisResult?.medications && diagnosisResult.medications.length > 0) {
    return diagnosisResult.medications
      .map((m) => `${m.drug} ${m.dose} ${m.route} ${m.frequency} for ${m.duration}`)
      .join('; ');
  }

  return null;
}

/**
 * Extract medications into the CompanionMedication format.
 */
function extractMedications(
  factsByGroup: Record<string, string[]>,
  diagnosisResult?: {
    medications?: Array<{ drug: string; dose: string; route: string; frequency: string; duration: string }>;
  }
): CompanionMedication[] {
  const medications: CompanionMedication[] = [];

  // Use diagnosis result medications (most structured source)
  if (diagnosisResult?.medications) {
    for (const med of diagnosisResult.medications) {
      medications.push({
        name: med.drug,
        dose: `${med.dose} (${med.route})`,
        frequency: med.frequency,
        duration: med.duration,
        instructions: `Take ${med.dose} ${med.route} ${med.frequency} for ${med.duration}`,
      });
    }
  }

  // If no structured meds, try to extract from facts
  if (medications.length === 0) {
    const medFacts = factsByGroup['medications'] || factsByGroup['prescriptions'];
    if (medFacts) {
      for (const fact of medFacts) {
        medications.push({
          name: fact,
          dose: 'See prescription',
          frequency: 'As directed',
          duration: 'As directed',
          instructions: fact,
        });
      }
    }
  }

  return medications;
}

/**
 * Extract follow-up information from facts.
 */
function extractFollowUp(
  factsByGroup: Record<string, string[]>
): { date: string | null; reason: string | null } {
  const followUp = factsByGroup['follow_up'] ||
    factsByGroup['follow-up'] ||
    factsByGroup['followup'] ||
    factsByGroup['recheck'];

  if (followUp && followUp.length > 0) {
    // Try to parse a date from the first follow-up fact
    const combined = followUp.join('. ');
    return {
      date: null, // Dates are hard to extract reliably from free text
      reason: combined,
    };
  }

  return { date: null, reason: null };
}

/**
 * Extract care instructions from discharge documents or facts.
 */
function extractCareInstructions(
  factsByGroup: Record<string, string[]>,
  documents?: {
    dischargeInstructions?: { sections: Array<{ key: string; title: string; content: string }> };
  }
): {
  homeCare: string[];
  warningsSigns: string[];
  dietary: string | null;
  activity: string | null;
} {
  const result = {
    homeCare: [] as string[],
    warningsSigns: [] as string[],
    dietary: null as string | null,
    activity: null as string | null,
  };

  // Try discharge instructions document first
  if (documents?.dischargeInstructions?.sections) {
    for (const section of documents.dischargeInstructions.sections) {
      const key = section.key.toLowerCase();
      if (key.includes('home_care') || key.includes('homecare') || key.includes('instructions')) {
        // Split content by newlines or bullet points into individual instructions
        const instructions = section.content
          .split(/[\n\r]+/)
          .map((line) => line.replace(/^[-*]\s*/, '').trim())
          .filter((line) => line.length > 0);
        result.homeCare.push(...instructions);
      }
      if (key.includes('warning') || key.includes('watch') || key.includes('emergency')) {
        const signs = section.content
          .split(/[\n\r]+/)
          .map((line) => line.replace(/^[-*]\s*/, '').trim())
          .filter((line) => line.length > 0);
        result.warningsSigns.push(...signs);
      }
      if (key.includes('diet') || key.includes('nutrition') || key.includes('feeding')) {
        result.dietary = section.content;
      }
      if (key.includes('activity') || key.includes('exercise') || key.includes('restriction')) {
        result.activity = section.content;
      }
    }
  }

  // Fill in from facts if document data is missing
  if (result.homeCare.length === 0) {
    const homeCare = factsByGroup['home_care'] ||
      factsByGroup['homecare'] ||
      factsByGroup['care_instructions'] ||
      factsByGroup['instructions'];
    if (homeCare) {
      result.homeCare = homeCare;
    }
  }

  if (result.warningsSigns.length === 0) {
    const warnings = factsByGroup['warning_signs'] ||
      factsByGroup['warnings'] ||
      factsByGroup['red_flags'];
    if (warnings) {
      result.warningsSigns = warnings;
    }
  }

  if (!result.dietary) {
    const dietary = factsByGroup['diet'] || factsByGroup['dietary'] || factsByGroup['nutrition'];
    if (dietary) {
      result.dietary = dietary.join('. ');
    }
  }

  if (!result.activity) {
    const activity = factsByGroup['activity'] ||
      factsByGroup['exercise'] ||
      factsByGroup['restrictions'];
    if (activity) {
      result.activity = activity.join('. ');
    }
  }

  return result;
}

/**
 * Generate contextual follow-up question suggestions based on the conversation state.
 * Since Corti manages conversation state, we generate suggestions based on context
 * and the current exchange only.
 */
function generateSuggestions(
  context: CompanionContext,
  lastUserMessage: string,
  _lastAssistantMessage: string,
  _history: CompanionMessage[]
): string[] {
  const suggestions: string[] = [];

  // Medication-related follow-ups
  if (context.medications && context.medications.length > 0) {
    const medNames = context.medications.map((m) => m.name);
    const askedAboutMeds = /medication|medicine|pill|dose|drug/i.test(lastUserMessage);
    if (!askedAboutMeds) {
      suggestions.push(`How do I give ${medNames[0]} to ${context.patientName}?`);
    } else if (medNames.length > 1) {
      suggestions.push('Can I give all the medications at the same time?');
    }
    suggestions.push('What if I miss a dose?');
  }

  // Follow-up related
  if (context.followUpDate || context.followUpReason) {
    const askedAboutFollowUp = /follow.?up|next.?visit|appointment|recheck/i.test(lastUserMessage);
    if (!askedAboutFollowUp) {
      suggestions.push('What will happen at the follow-up appointment?');
    }
  }

  // Warning signs
  if (context.warningSignsToWatch && context.warningSignsToWatch.length > 0) {
    const askedAboutWarnings = /warning|worry|concern|emergency|urgent|worse/i.test(lastUserMessage);
    if (!askedAboutWarnings) {
      suggestions.push(`When should I be worried about ${context.patientName}?`);
    }
  }

  // Billing-related follow-ups
  if (context.chargedServices && context.chargedServices.length > 0) {
    const askedAboutBilling = /charge|bill|cost|price|pay|invoice/i.test(lastUserMessage);
    if (!askedAboutBilling) {
      suggestions.push('Can you explain what I was charged for?');
    }
  }

  // General helpful questions
  suggestions.push(`Is ${context.patientName} in pain? How can I tell?`);

  // Keep suggestions to 3 max
  return suggestions.slice(0, 3);
}

/**
 * Get initial suggestions tailored to what data is available in the context.
 */
function getInitialSuggestions(context: CompanionContext): string[] {
  const suggestions: string[] = [];

  // Always start with a summary option
  suggestions.push(`Can you summarize what happened during ${context.patientName}'s visit?`);

  // Add medication question if there are medications
  if (context.medications && context.medications.length > 0) {
    suggestions.push('How do I give the medications?');
  }

  // Add warning signs if available
  if (context.warningSignsToWatch && context.warningSignsToWatch.length > 0) {
    suggestions.push('What warning signs should I watch for?');
  }

  // Add follow-up if scheduled
  if (context.followUpDate || context.followUpReason) {
    suggestions.push('When is the follow-up appointment?');
  }

  // Add diet question if there are dietary instructions
  if (context.dietaryInstructions) {
    suggestions.push(`What should I feed ${context.patientName} during recovery?`);
  }

  // Add billing question if invoice was included
  if (context.chargedServices && context.chargedServices.length > 0) {
    suggestions.push('Can you explain what I was charged for?');
  }

  // Fall back to defaults if we have fewer than 3
  if (suggestions.length < 3) {
    for (const defaultSugg of DEFAULT_SUGGESTIONS) {
      if (!suggestions.includes(defaultSugg) && suggestions.length < 4) {
        suggestions.push(defaultSugg);
      }
    }
  }

  return suggestions.slice(0, 4);
}
