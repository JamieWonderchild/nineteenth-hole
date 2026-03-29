// Case Reasoning Chat Service
// Free-form AI chat for providers — clinical reasoning assistant with expert access.
// Uses Corti Agentic API with ephemeral agent per conversation.

import { getCortiAgentClient } from '@/services/corti-agents';
import type { CreateCortiAgentRequest } from '@/types/corti';
import { extractTaskText } from '@/types/corti';

// ============================================================================
// TYPES
// ============================================================================

export interface ClinicalChatFact {
  id: string;
  text: string;
  group: string;
}

export interface ClinicalChatPatientInfo {
  name: string;
  age?: string;
  sex?: string;
  weight?: string;
  weightUnit?: string;
}

export interface ClinicalChatOptions {
  agentId?: string;
  contextId?: string;
}

export interface ClinicalChatResult {
  message: string;
  agentId?: string;
  contextId?: string;
  isNewAgent?: boolean;
}

// ============================================================================
// FACT FILTERING BY QUESTION TYPE
// ============================================================================

/**
 * Maps question types to relevant fact groups.
 * This reduces context size and improves response time for targeted queries.
 */
const QUESTION_TYPE_FACT_FILTERS: Record<string, string[]> = {
  // Drug questions → only need meds + demographics for dosing
  'drug-interaction': ['Current Medications', 'Patient Demographics', 'Diagnosis', 'History'],
  'drug-dose': ['Patient Demographics', 'Current Medications'],

  // Diagnostic questions → need clinical picture
  'differential': ['Presenting Complaint', 'History', 'Physical Exam Findings', 'Lab Results', 'Diagnostic Imaging', 'Patient Demographics'],
  'diagnostic-plan': ['Presenting Complaint', 'Physical Exam Findings', 'Lab Results', 'Diagnosis', 'Patient Demographics', 'History'],

  // Prognosis questions → need outcomes data
  'prognosis': ['Diagnosis', 'Lab Results', 'Patient Demographics', 'Treatment', 'History'],

  // Literature questions → need diagnosis context
  'literature': ['Diagnosis', 'Presenting Complaint', 'Patient Demographics', 'Treatment'],

  // Summary questions → need everything
  'summarize': ['*'],

  // Emergency questions → need everything (accuracy > speed)
  'emergency': ['*'],

  // General → send all as fallback
  'general': ['*'],
};

/**
 * Detects the question type from the user's message using keyword matching.
 */
function detectQuestionType(message: string): string {
  const lowerMsg = message.toLowerCase();

  // Emergency (check first — always include everything)
  if (lowerMsg.match(/\b(emergency|critical|unstable|stabilize|urgent|gvd|gdv|urethral obstruction|toxicity|poison|anaphylaxis|status epilepticus|dyspnea|respiratory distress)\b/)) {
    return 'emergency';
  }

  // Drug questions
  if (lowerMsg.match(/\b(drug|medication|dose|dosing|interaction|contraindication|side effect|adverse|pharmacology)\b/)) {
    if (lowerMsg.match(/\b(interaction|contraindication|combine|together|concurrent|with)\b/)) {
      return 'drug-interaction';
    }
    if (lowerMsg.match(/\b(dose|dosing|calculate|mg\/kg|amount|how much)\b/)) {
      return 'drug-dose';
    }
    return 'drug-interaction'; // Default for drug questions
  }

  // Differential diagnosis
  if (lowerMsg.match(/\b(differential|rule out|ddx|possible diagnos|what could|causes of)\b/)) {
    return 'differential';
  }

  // Diagnostic plan
  if (lowerMsg.match(/\b(test|diagnostic|workup|lab|imaging|next step|recommend|should i)\b/)) {
    return 'diagnostic-plan';
  }

  // Prognosis
  if (lowerMsg.match(/\b(prognos|outlook|survival|outcome|expect|likely|chance)\b/)) {
    return 'prognosis';
  }

  // Literature review
  if (lowerMsg.match(/\b(literature|research|study|studies|evidence|recent|publication|guideline)\b/)) {
    return 'literature';
  }

  // Summary/findings
  if (lowerMsg.match(/\b(summar|key finding|overview|recap)\b/)) {
    return 'summarize';
  }

  // Default: send everything
  return 'general';
}

/**
 * Checks if a fact group matches an expected group name (with fuzzy matching for common variations).
 */
function groupMatches(factGroup: string, expectedGroup: string): boolean {
  const normalize = (s: string) => s.toLowerCase().trim();
  const factNorm = normalize(factGroup);
  const expectedNorm = normalize(expectedGroup);

  // Exact match
  if (factNorm === expectedNorm) return true;

  // Common variations
  const variations: Record<string, string[]> = {
    'patient demographics': ['demographics', 'patient info', 'demographics', 'patient data'],
    'current medications': ['medications', 'meds', 'drugs', 'current meds'],
    'presenting complaint': ['chief complaint', 'complaint', 'presentation', 'reason for visit'],
    'physical exam findings': ['physical exam', 'exam findings', 'examination', 'pe findings'],
    'lab results': ['labs', 'laboratory', 'bloodwork', 'lab work'],
    'diagnostic imaging': ['imaging', 'radiology', 'diagnostics'],
    'history': ['medical history', 'patient history', 'hx'],
  };

  for (const [canonical, alts] of Object.entries(variations)) {
    if (normalize(canonical) === expectedNorm) {
      return alts.some(alt => factNorm.includes(alt) || alt.includes(factNorm));
    }
  }

  // Partial match (e.g., "Physical Exam" matches "Physical Exam Findings")
  return factNorm.includes(expectedNorm) || expectedNorm.includes(factNorm);
}

/**
 * Filters facts based on the detected question type.
 * Returns all facts if the question type requires full context or if filtering would remove too many facts.
 */
export function filterFactsByQuestion(facts: ClinicalChatFact[], message: string): ClinicalChatFact[] {
  // If no facts, return as-is
  if (facts.length === 0) return facts;

  const questionType = detectQuestionType(message);
  const allowedGroups = QUESTION_TYPE_FACT_FILTERS[questionType];

  // If '*' or no filter defined, return all facts
  if (!allowedGroups || allowedGroups.includes('*')) {
    console.log(`[FactFilter] Question type: ${questionType} → sending all ${facts.length} facts (no filtering)`);
    return facts;
  }

  // Get unique groups from facts for logging
  const actualGroups = Array.from(new Set(facts.map(f => f.group)));
  console.log(`[FactFilter] Actual fact groups in encounter: ${actualGroups.join(', ')}`);

  // Filter facts by allowed groups (with fuzzy matching)
  let filtered = facts.filter(fact =>
    allowedGroups.some(allowedGroup => groupMatches(fact.group, allowedGroup))
  );

  // Safety: always try to include demographics/patient info (needed for dosing calculations)
  const demographicsKeywords = ['demographic', 'patient info', 'demographics'];
  const demographics = facts.filter(fact =>
    demographicsKeywords.some(keyword => fact.group.toLowerCase().includes(keyword))
  );

  const filteredIds = new Set(filtered.map(f => f.id));
  for (const demo of demographics) {
    if (!filteredIds.has(demo.id)) {
      filtered.push(demo);
    }
  }

  // Fallback 1: If filtering results in 0 facts, send all instead
  if (filtered.length === 0) {
    console.log(`[FactFilter] ⚠️ Question type: ${questionType} resulted in 0 facts (group mismatch?), sending all ${facts.length} facts`);
    console.log(`[FactFilter] Expected groups: ${allowedGroups.join(', ')}`);
    console.log(`[FactFilter] Actual groups: ${actualGroups.join(', ')}`);
    return facts;
  }

  // Fallback 2: If filtering removes >70% of facts, send all instead
  // This prevents over-aggressive filtering when group names don't match expectations
  const retentionRate = filtered.length / facts.length;
  if (retentionRate < 0.3) {
    console.log(`[FactFilter] ⚠️ Question type: ${questionType} would remove ${((1 - retentionRate) * 100).toFixed(0)}% of facts (${facts.length} → ${filtered.length}), sending all instead`);
    console.log(`[FactFilter] This may indicate fact group name mismatch. Expected: ${allowedGroups.join(', ')}`);
    console.log(`[FactFilter] Actual: ${actualGroups.join(', ')}`);
    return facts;
  }

  // Fallback 3: If we have very few facts (< 5 total), send all to avoid missing context
  if (facts.length < 5) {
    console.log(`[FactFilter] ⚠️ Only ${facts.length} total facts, sending all (too few to filter safely)`);
    return facts;
  }

  console.log(`[FactFilter] ✂️ Question type: ${questionType} → filtered ${facts.length} → ${filtered.length} facts (${(retentionRate * 100).toFixed(0)}% retained)`);
  console.log(`[FactFilter] Allowed groups: ${allowedGroups.join(', ')}`);

  return filtered;
}

// ============================================================================
// BUILD SYSTEM PROMPT
// ============================================================================

export function buildClinicalSystemPrompt(
  facts: ClinicalChatFact[],
  patientInfo: ClinicalChatPatientInfo,
  providerNotes?: { diagnosis?: string; treatmentPlan?: string }
): string {
  let prompt = `You are a clinical reasoning assistant. Your user is a licensed physician. You help them think through cases with evidence-based analysis, differential diagnoses, drug information, diagnostic plans, and literature references.

## Core Rules

1. **Be concise and focused.** Provide the most clinically relevant information. Busy physicians need actionable answers, not comprehensive textbooks. When listing differentials, limit to the **top 3-5 ranked by likelihood** based on the presentation. For diagnostic plans, prioritize the most cost-effective and informative tests first.

2. **Always provide specific dosing.** When discussing any medication, you MUST include:
   - Dose in mg/kg
   - Route (PO, SQ, IM, IV, topical)
   - Frequency (SID, BID, TID, q8h, etc.)
   - Duration when relevant
   - If the patient's weight is known, calculate the actual dose (e.g. "Amoxicillin 500 mg PO TID → standard adult dose")
   Never say "consult a reference" or defer dosing — the provider is asking YOU for this information.

3. **Never ask clarifying questions when you have enough to reason.** Provide your best clinical analysis with what you have. If information is missing, state your assumptions and proceed. The provider can correct you.

4. **For emergencies, give immediate protocols.** If the presentation is an emergency (acute MI, sepsis, toxicity, anaphylaxis, status epilepticus, dyspnea), lead with the stabilization protocol — do not ask preliminary questions first. Follow this order: stabilize → diagnostics → definitive treatment.

5. **Always format with markdown.** Use headers, bold, bullet points, and numbered lists. Structure longer responses with clear sections.

6. **Cite evidence when available.** Reference studies, guidelines, or textbook sources. Use your pubmed-expert when the question involves treatment efficacy, prognosis, or emerging protocols.

7. **For differential diagnoses, list the top 3-5 ranked by likelihood and always include the confirmatory test.** Each differential you list MUST include the gold-standard or first-line diagnostic test to confirm or rule it out. Format: "Differential → Key Test (brief rationale)". Common examples:
   - Hyperthyroidism → Total T4 (± free T4 if equivocal)
   - Hyperadrenocorticism → LDDS or ACTH stim
   - Diabetes mellitus → Fasting glucose + fructosamine
   - Immune-mediated hemolytic anemia → Saline agglutination test, Coombs test
   - Pancreatitis → cPL/fPL (SNAP or Spec)
   - Lymphoma → Fine needle aspirate + cytology (or biopsy for histopath)
   - Addison's disease → ACTH stimulation test (baseline cortisol if screening)
   - Degenerative myelopathy → Diagnosis of exclusion (MRI to rule out compressive, SOD1 genotype)

8. **For emergencies, answer from your training first.** Emergency protocols (urethral obstruction, GDV, toxicities, status epilepticus, anaphylaxis) should be answered immediately from built-in knowledge. Do NOT wait for expert lookups before responding to emergencies — speed saves lives. You may enrich with citations afterward if time permits, but the stabilization protocol must come first and fast.

## High-Risk Pharmacogenomics & Drug Safety (CRITICAL)

Flag these automatically when relevant medications are discussed:
- **CYP2D6 poor metabolizers:** Reduced metabolism of codeine (no analgesia), tramadol (no activation), tricyclics, metoprolol, haloperidol — consider alternatives or dose adjustments.
- **G6PD deficiency:** Avoid dapsone, primaquine, nitrofurantoin, rasburicase, methylene blue in at-risk patients.
- **Warfarin/CYP2C9:** Many drugs significantly alter INR — always check interactions before prescribing.
- **QTc prolongation:** Azithromycin + fluoroquinolones, antipsychotics, methadone, haloperidol — check baseline QTc and electrolytes.
- **Serotonin syndrome:** Tramadol + SSRIs/SNRIs/MAOIs, linezolid + serotonergic agents, fentanyl + SSRIs.
- **Renal/hepatic dose adjustment:** Flag any medication requiring renal clearance adjustment (e.g., gabapentin, most antibiotics, metformin) when impaired function is documented.

## Drug Interaction Reference

When the provider asks about drug combinations, always check:
- NSAID + NSAID or NSAID + corticosteroid → GI ulceration, GI bleeding risk
- ACE inhibitor/ARB + NSAID → reduced renal perfusion, AKI risk
- Anticoagulants (warfarin, DOACs) + many antibiotics/antifungals → bleeding risk
- Serotonin syndrome risk: tramadol + SSRIs/SNRIs/MAOIs, linezolid + serotonergics
- Gabapentin/pregabalin + opioids → enhanced sedation, respiratory depression
- Fluconazole/ketoconazole → CYP3A4/CYP2C9 inhibition, increases levels of many drugs
- QT-prolonging combinations → check CredibleMeds database for risk stratification
- Metformin + iodinated contrast → hold 48h peri-procedure if GFR < 60

---

## Patient demographics
`;

  prompt += `- **Name:** ${patientInfo.name}\n`;
  if (patientInfo.age) prompt += `- **Age:** ${patientInfo.age}\n`;
  if (patientInfo.sex) prompt += `- **Sex:** ${patientInfo.sex}\n`;
  if (patientInfo.weight) {
    prompt += `- **Weight:** ${patientInfo.weight}${patientInfo.weightUnit ? ` ${patientInfo.weightUnit}` : ''}\n`;
  }

  // Group facts by category
  const grouped: Record<string, string[]> = {};
  for (const fact of facts) {
    const group = fact.group;
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(fact.text);
  }

  prompt += `\n## Clinical Facts (${facts.length} total)\n\n`;
  for (const [group, items] of Object.entries(grouped)) {
    prompt += `### ${group}\n`;
    for (const item of items) {
      prompt += `- ${item}\n`;
    }
    prompt += '\n';
  }

  if (providerNotes?.diagnosis || providerNotes?.treatmentPlan) {
    prompt += `## Provider Notes\n\n`;
    if (providerNotes.diagnosis) {
      prompt += `### Working Diagnosis\n${providerNotes.diagnosis}\n\n`;
    }
    if (providerNotes.treatmentPlan) {
      prompt += `### Treatment Plan\n${providerNotes.treatmentPlan}\n\n`;
    }
  }

  return prompt;
}

// ============================================================================
// LAZY AGENT CREATION
// ============================================================================

interface ClinicalAgentIds {
  agentId: string;
  contextId: string | undefined;
  isNew: boolean;
}

async function getOrCreateClinicalAgent(
  facts: ClinicalChatFact[],
  patientInfo: ClinicalChatPatientInfo,
  providerNotes: { diagnosis?: string; treatmentPlan?: string } | undefined,
  options: ClinicalChatOptions
): Promise<ClinicalAgentIds> {
  // Reuse existing agent if we have IDs
  if (options.agentId) {
    console.log('[CaseReasoning] ♻️ Reusing existing agent:', options.agentId);
    console.log('[CaseReasoning] Context ID:', options.contextId || 'none');
    return {
      agentId: options.agentId,
      contextId: options.contextId,
      isNew: false,
    };
  }

  console.log('[CaseReasoning] 🆕 Creating new agent (first call)');

  const requiredVars = ['CORTI_CLIENT_ID', 'CORTI_CLIENT_SECRET', 'CORTI_TENANT'];
  const missing = requiredVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error('[CaseReasoning] Missing Corti credentials:', missing.join(', '));
    throw new Error(`Corti credentials not configured: ${missing.join(', ')}`);
  }

  const client = getCortiAgentClient();

  const promptStartTime = Date.now();
  const systemPrompt = buildClinicalSystemPrompt(facts, patientInfo, providerNotes);
  const promptDuration = Date.now() - promptStartTime;

  console.log('[CaseReasoning] System prompt built in', promptDuration, 'ms');
  console.log('[CaseReasoning] System prompt length:', systemPrompt.length, 'chars');
  console.log('[CaseReasoning] Facts included:', facts.length);

  const request: CreateCortiAgentRequest = {
    name: `provider-reasoning-${Date.now().toString(36)}`,
    description: `Clinical reasoning assistant for `,
    systemPrompt,
    // NOTE: Using single expert to reduce latency and fit within Vercel Hobby 60s limit.
    // web-search-expert provides practical clinical info (dosing, protocols, guidelines).
    // pubmed-expert removed to reduce expert call latency (was adding 10-20s when both called).
    // drugbank-expert is excluded — Corti tenant auth for DrugBank API is not configured.
    // TEMPORARY: Disabled web-search-expert to test if it's causing timeouts
    experts: [],
    // experts: [
    //   {
    //     type: 'reference',
    //     name: 'web-search-expert',
    //     systemPrompt: 'Search for current clinical treatment guidelines, drug formulary information, clinical protocols, and evidence-based recommendations. Focus on BSAVA, Plumb\'s, ACVIM consensus statements, and clinical clinical resources. When literature references would be helpful, search for accessible clinical guidelines and summaries rather than primary research papers.',
    //   },
    // ],
  };

  console.log('[CaseReasoning] ⏱️ Creating ephemeral agent:', request.name);
  console.log('[CaseReasoning] Expert count:', request.experts?.length || 0);

  const agentCreateStartTime = Date.now();
  let agent: Awaited<ReturnType<typeof client.createAgent>>;
  try {
    agent = await client.createAgent(request, true);
    const agentCreateDuration = Date.now() - agentCreateStartTime;
    console.log('[CaseReasoning] ✅ Agent created in', agentCreateDuration, 'ms');
    console.log('[CaseReasoning] Agent ID:', agent.id);
  } catch (err) {
    const agentCreateDuration = Date.now() - agentCreateStartTime;
    console.error('[CaseReasoning] ❌ Agent creation with experts failed after', agentCreateDuration, 'ms');
    console.warn('[CaseReasoning] Retrying without experts:', err instanceof Error ? err.message : err);

    const retryStartTime = Date.now();
    const { experts: _experts, ...requestWithoutExperts } = request;
    agent = await client.createAgent(requestWithoutExperts, true);
    const retryDuration = Date.now() - retryStartTime;
    console.log('[CaseReasoning] ✅ Agent created without experts in', retryDuration, 'ms');
    console.log('[CaseReasoning] Agent ID:', agent.id);
  }

  return {
    agentId: agent.id,
    contextId: undefined,
    isNew: true,
  };
}

// ============================================================================
// CHAT WITH VET
// ============================================================================

export async function chatWithVet(
  facts: ClinicalChatFact[],
  patientInfo: ClinicalChatPatientInfo,
  message: string,
  options: ClinicalChatOptions = {},
  providerNotes?: { diagnosis?: string; treatmentPlan?: string }
): Promise<ClinicalChatResult> {
  // ⏱️ TIMING: Start of entire request
  const requestStartTime = Date.now();
  console.log('[CaseReasoning] ⏱️ REQUEST START');
  console.log('[CaseReasoning] Agent reuse:', options.agentId ? 'YES (2nd+ call)' : 'NO (1st call)');
  console.log('[CaseReasoning] Context ID:', options.contextId || 'none (fresh conversation)');

  const client = getCortiAgentClient();

  const agentIds = await getOrCreateClinicalAgent(facts, patientInfo, providerNotes, options);

  console.log('[CaseReasoning] Sending message to agent:', agentIds.agentId, 'contextId:', agentIds.contextId);
  console.log('[CaseReasoning] Message length:', message.length, 'chars');
  console.log('[CaseReasoning] Facts count:', facts.length);
  console.log('[CaseReasoning] ⏳ Calling sendTextMessage...');

  // ⏱️ TIMING: Track sendTextMessage duration
  const sendStartTime = Date.now();

  // Send message to Corti agent (no artificial timeout - let Vercel's 60s limit handle it)
  let task;
  try {
    task = await client.sendTextMessage(
      agentIds.agentId,
      message,
      agentIds.contextId
    );
  } catch (error) {
    const sendDuration = Date.now() - sendStartTime;
    console.error('[CaseReasoning] ❌ sendTextMessage failed after', sendDuration, 'ms');
    console.error('[CaseReasoning] Error:', error instanceof Error ? error.message : String(error));
    throw error;
  }

  const sendDuration = Date.now() - sendStartTime;

  // ⏱️ TIMING: Analyze sendTextMessage performance
  console.log('[CaseReasoning] ✅ sendTextMessage returned in', sendDuration, 'ms');
  console.log('[CaseReasoning] Task ID:', task.id);
  console.log('[CaseReasoning] Task state on return:', task.status?.state);

  // 🚨 CRITICAL: Detect slow sendTextMessage (likely contextId loading bottleneck)
  if (sendDuration > 20000) {
    console.error('[CaseReasoning] 🚨 CRITICAL: sendTextMessage took over 20s!');
    console.error('[CaseReasoning] This suggests Corti API is hanging during:');
    console.error('[CaseReasoning]   - Context loading from storage (if contextId provided)');
    console.error('[CaseReasoning]   - Network issues');
    console.error('[CaseReasoning]   - Corti infrastructure slowdown');
  } else if (sendDuration > 10000) {
    console.warn('[CaseReasoning] ⚠️ WARNING: sendTextMessage took over 10s (slower than expected)');
  } else {
    console.log('[CaseReasoning] ✅ sendTextMessage performance: GOOD (<10s)');
  }

  console.log('[CaseReasoning] Task response preview:', JSON.stringify(task).slice(0, 500));

  // Poll for task completion (Corti tasks are asynchronous)
  // Extended timeout to accommodate expert calls (PubMed, Web Search)
  // Limited to 35s to fit within Vercel Hobby 60s API limit (leaving 25s buffer for overhead)
  // Overhead includes: auth (5s), fact fetch (3s), agent creation (3-8s), response extraction (2s) = ~15-20s
  const maxAttempts = 175; // 35 seconds with 200ms interval
  const pollInterval = 200; // ms (matches Corti chunk interval)
  let attempts = 0;
  const pollStartTime = Date.now();

  console.log('[CaseReasoning] ⏱️ Starting polling loop');
  console.log('[CaseReasoning] Max attempts:', maxAttempts, '(', maxAttempts * pollInterval / 1000, 'seconds)');
  console.log('[CaseReasoning] Poll interval:', pollInterval, 'ms');

  // Track state changes for debugging
  let lastState = task.status?.state;
  let stateChangeCount = 0;

  while (attempts < maxAttempts) {
    const state = task.status?.state;
    const elapsed = Date.now() - pollStartTime;

    // Detect state changes
    if (state !== lastState) {
      stateChangeCount++;
      console.log(`[CaseReasoning] 🔄 State change #${stateChangeCount}: ${lastState} → ${state} (at ${elapsed}ms)`);
      lastState = state;
    }

    // Log every 5th attempt (every second)
    if (attempts % 5 === 0) {
      console.log(`[CaseReasoning] Poll ${attempts}/${maxAttempts} | ${elapsed}ms | state: ${state}`);
    }

    // 🚨 Warn if stuck in pending for too long
    if (attempts > 50 && state === 'pending') {
      console.warn(`[CaseReasoning] ⚠️ Task stuck in 'pending' for ${elapsed}ms (${attempts} polls)`);
      console.warn('[CaseReasoning] Corti may not be processing the task');
    }

    // Task completed successfully
    if (state === 'completed') {
      console.log(`[CaseReasoning] ✅ Task completed after ${attempts} polls (${elapsed}ms total)`);
      console.log('[CaseReasoning] Final task:', JSON.stringify(task).slice(0, 1000));
      break;
    }

    // Task failed
    if (state === 'failed') {
      console.error('[CaseReasoning] ❌ Task failed after', elapsed, 'ms');
      console.error('[CaseReasoning] Failure reason:', task.status?.message);
      console.error('[CaseReasoning] Full task:', JSON.stringify(task));
      break;
    }

    // Task still running - poll again
    if (state === 'pending' || state === 'running') {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      // Fetch updated task status
      try {
        task = await client.getTask(agentIds.agentId, task.id);
      } catch (error) {
        console.error('[CaseReasoning] ❌ Error fetching task status at attempt', attempts, ':', error);
        console.error('[CaseReasoning] Error details:', error instanceof Error ? error.message : String(error));
        break;
      }
    } else {
      // Unknown state
      console.warn('[CaseReasoning] ⚠️ Unknown task state:', state, 'after', elapsed, 'ms');
      console.warn('[CaseReasoning] Task details:', JSON.stringify(task));
      break;
    }
  }

  if (attempts >= maxAttempts) {
    const totalTime = Date.now() - pollStartTime;
    console.error('[CaseReasoning] ⏱️ Task polling timeout after', attempts, 'attempts (', totalTime, 'ms)');
    console.error('[CaseReasoning] Final task state:', task.status?.state);
    console.error('[CaseReasoning] Task at timeout:', JSON.stringify(task));
    console.error('[CaseReasoning] ⚠️ Corti agent is taking longer than expected. Consider:');
    console.error('[CaseReasoning]   1. Check if fact filtering is working (should see [FactFilter] logs above)');
    console.error('[CaseReasoning]   2. Try simpler questions or remove web-search-expert for faster responses');
    console.error('[CaseReasoning]   3. Verify Corti API is responsive (check Corti dashboard)');
  }

  console.log('[CaseReasoning] Extracting response from task...');
  const extractedPrimary = extractTaskText(task);
  const extractedFallback = client.extractTextFromTask(task);

  console.log('[CaseReasoning] Primary extraction result:', extractedPrimary ? 'SUCCESS' : 'FAILED');
  console.log('[CaseReasoning] Fallback extraction result:', extractedFallback ? 'SUCCESS' : 'FAILED');

  const assistantMessage = extractedPrimary ||
    extractedFallback ||
    'I could not generate a response. Please try rephrasing your question.';

  console.log('[CaseReasoning] Final message length:', assistantMessage.length, 'chars');
  console.log('[CaseReasoning] Message preview:', assistantMessage.slice(0, 200));

  const responseContextId = task.contextId || agentIds.contextId;

  // ⏱️ TIMING: Comprehensive summary
  const pollingDuration = Date.now() - pollStartTime;
  const totalDuration = Date.now() - requestStartTime;
  const remainingTime = 60000 - totalDuration;

  console.log('\n[CaseReasoning] ============ TIMING SUMMARY ============');
  console.log('[CaseReasoning] ⏱️ sendTextMessage:    ', sendDuration, 'ms');
  console.log('[CaseReasoning] ⏱️ Polling:            ', pollingDuration, 'ms');
  console.log('[CaseReasoning] ⏱️ Total:              ', totalDuration, 'ms');
  console.log('[CaseReasoning] ⏱️ Vercel remaining:   ', remainingTime, 'ms');
  console.log('[CaseReasoning] 📊 State changes:      ', stateChangeCount);
  console.log('[CaseReasoning] 📊 Poll attempts:      ', attempts, '/', maxAttempts);
  console.log('[CaseReasoning] 📊 Agent type:         ', agentIds.isNew ? 'NEW (1st call)' : 'REUSED (2nd+ call)');
  console.log('[CaseReasoning] 📊 Final task state:   ', task.status?.state);

  // 🚨 Performance warnings
  if (totalDuration > 55000) {
    console.error('[CaseReasoning] 🚨 DANGER: Within 5s of Vercel 60s timeout!');
  } else if (totalDuration > 50000) {
    console.warn('[CaseReasoning] ⚠️ WARNING: Within 10s of timeout');
  }

  // 💡 Diagnostic hints
  if (sendDuration > 20000 && pollingDuration < 10000) {
    console.error('[CaseReasoning] 💡 DIAGNOSIS: sendTextMessage is the bottleneck');
    console.error('[CaseReasoning]    → Likely cause: contextId loading is slow');
    console.error('[CaseReasoning]    → Try: Disable contextId or reduce system prompt size');
  } else if (sendDuration < 5000 && pollingDuration > 30000) {
    console.error('[CaseReasoning] 💡 DIAGNOSIS: Corti agent processing is slow');
    console.error('[CaseReasoning]    → Likely cause: Expert calls or large context');
    console.error('[CaseReasoning]    → Try: Remove web-search-expert or limit facts');
  } else if (sendDuration > 10000 && pollingDuration > 30000) {
    console.error('[CaseReasoning] 💡 DIAGNOSIS: Both sendTextMessage AND polling are slow');
    console.error('[CaseReasoning]    → Likely cause: Corti infrastructure issues');
    console.error('[CaseReasoning]    → Contact Corti support');
  }

  console.log('[CaseReasoning] ========================================\n');

  return {
    message: assistantMessage,
    agentId: agentIds.isNew ? agentIds.agentId : undefined,
    contextId: agentIds.isNew ? responseContextId : undefined,
    isNewAgent: agentIds.isNew,
  };
}
