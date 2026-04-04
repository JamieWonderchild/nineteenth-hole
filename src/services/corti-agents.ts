// Corti Agentic Framework Service
// Manages clinical diagnosis agents and orchestration

import type {
  CortiAgent,
  CortiTask,
  CreateCortiAgentRequest,
  SendCortiMessageRequest,
  Fact,
} from '@/types/corti';

import type {
  AgentTraceEntry,
  DiagnoseRequest,
  DiagnoseResponse,
  TriageResult,
  SignalmentResult,
  DifferentialResult,
  DiagnosticTestResult,
  TreatmentResult,
} from '@/types/agents';

import {
  checkContraindications,
} from '@/lib/experts/drugbank';

// ============================================================================
// CORTI AGENTIC CLIENT
// ============================================================================

export class CortiAgentClient {
  private region: 'eu' | 'us';
  private tenant: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private clientId: string;
  private clientSecret: string;

  // Cached agent IDs
  private agentCache: Map<string, string> = new Map();

  constructor(config: {
    clientId: string;
    clientSecret: string;
    tenant: string;
    region?: 'eu' | 'us';
  }) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.tenant = config.tenant;
    this.region = config.region || 'eu';
  }

  private getAuthUrl(): string {
    return `https://auth.${this.region}.corti.app/realms/${this.tenant}/protocol/openid-connect/token`;
  }

  private getAgentApiUrl(): string {
    return `https://api.${this.region}.corti.app/agents`;
  }

  private async authenticate(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return;
    }

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'client_credentials',
      scope: 'openid',
    });

    const response = await fetch(this.getAuthUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Authentication failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 30) * 1000;
  }

  // ============================================================================
  // AGENT MANAGEMENT
  // ============================================================================

  /**
   * Create a new agent on the Corti platform
   */
  async createAgent(request: CreateCortiAgentRequest, ephemeral = false): Promise<CortiAgent> {
    await this.authenticate();

    const url = ephemeral
      ? `${this.getAgentApiUrl()}?ephemeral=true`
      : this.getAgentApiUrl();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Tenant-Name': this.tenant,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[CortiAgentClient] Create agent failed:', response.status, errorText);
      throw new Error(`Failed to create agent: ${response.status} - ${errorText}`);
    }

    const agent = await response.json();

    // Cache the agent ID
    this.agentCache.set(request.name, agent.id);

    return agent;
  }

  /**
   * Get an agent by ID
   */
  async getAgent(agentId: string): Promise<CortiAgent> {
    await this.authenticate();

    const response = await fetch(`${this.getAgentApiUrl()}/${agentId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Tenant-Name': this.tenant,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get agent: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * List all available agents
   */
  async listAgents(): Promise<CortiAgent[]> {
    await this.authenticate();

    const response = await fetch(this.getAgentApiUrl(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Tenant-Name': this.tenant,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list agents: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.agents || data;
  }

  /**
   * Delete an agent
   */
  async deleteAgent(agentId: string): Promise<void> {
    await this.authenticate();

    const response = await fetch(`${this.getAgentApiUrl()}/${agentId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Tenant-Name': this.tenant,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete agent: ${response.status} - ${errorText}`);
    }

    // Remove from cache
    for (const [name, id] of this.agentCache.entries()) {
      if (id === agentId) {
        this.agentCache.delete(name);
        break;
      }
    }
  }

  /**
   * List available experts in the registry
   */
  async listExperts(): Promise<Array<{ id: string; name: string; description: string }>> {
    await this.authenticate();

    const response = await fetch(`${this.getAgentApiUrl()}/experts`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Tenant-Name': this.tenant,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list experts: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.experts || data;
  }

  // ============================================================================
  // MESSAGE HANDLING
  // ============================================================================

  /**
   * Send a message to an agent and get a response (with retry for transient errors)
   */
  async sendMessage(agentId: string, request: SendCortiMessageRequest, retries = 2): Promise<CortiTask> {
    await this.authenticate();

    const url = `${this.getAgentApiUrl()}/${agentId}/v1/message:send`;

    // Transform message format to Corti's expected schema
    // Corti uses 'kind' instead of 'type', and requires messageId and message kind
    const cortiRequest = {
      message: {
        role: request.message.role,
        kind: 'message',
        messageId: crypto.randomUUID(),
        parts: request.message.parts.map(part => {
          if (part.type === 'text') {
            return { kind: 'text', text: (part as { type: 'text'; text: string }).text };
          } else if (part.type === 'data') {
            return { kind: 'data', mimeType: 'application/json', data: (part as { type: 'data'; data: unknown }).data };
          } else if (part.type === 'file') {
            const filePart = part as { type: 'file'; mimeType: string; uri: string; name?: string };
            return { kind: 'file', mimeType: filePart.mimeType, uri: filePart.uri, name: filePart.name };
          } else {
            return part;
          }
        }),
      },
      contextId: request.contextId,
    };

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'Tenant-Name': this.tenant,
          },
          body: JSON.stringify(cortiRequest),
        });

        if (!response.ok) {
          const errorText = await response.text();
          // Retry on 500 errors (transient)
          if (response.status >= 500 && attempt < retries) {
            console.warn(`[CortiAgentClient] Transient error (${response.status}), retrying... (${attempt + 1}/${retries})`);
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // Exponential backoff
            continue;
          }
          console.error('[CortiAgentClient] ❌ sendMessage failed:', {
            status: response.status,
            statusText: response.statusText,
            url,
            tenant: this.tenant,
            agentId,
            hasToken: !!this.accessToken,
            tokenLength: this.accessToken?.length,
            errorBody: errorText.slice(0, 500),
          });
          throw new Error(`Failed to send message: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data.task || data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < retries) {
          console.warn(`[CortiAgentClient] Error, retrying... (${attempt + 1}/${retries}):`, lastError.message);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error('Failed to send message after retries');
  }

  /**
   * Send a text message to an agent
   */
  async sendTextMessage(agentId: string, text: string, contextId?: string): Promise<CortiTask> {
    return this.sendMessage(agentId, {
      message: {
        role: 'user',
        parts: [{ type: 'text', text }],
      },
      contextId,
    });
  }

  /**
   * Send a data message to an agent
   */
  async sendDataMessage(
    agentId: string,
    data: Record<string, unknown>,
    contextId?: string
  ): Promise<CortiTask> {
    return this.sendMessage(agentId, {
      message: {
        role: 'user',
        parts: [{ type: 'data', mimeType: 'application/json', data }],
      },
      contextId,
    });
  }

  /**
   * Send a mixed message (text + data) to an agent
   */
  async sendMixedMessage(
    agentId: string,
    text: string,
    data: Record<string, unknown>,
    contextId?: string
  ): Promise<CortiTask> {
    return this.sendMessage(agentId, {
      message: {
        role: 'user',
        parts: [
          { type: 'text', text },
          { type: 'data', mimeType: 'application/json', data },
        ],
      },
      contextId,
    });
  }

  /**
   * Get a task by ID
   */
  async getTask(agentId: string, taskId: string): Promise<CortiTask> {
    await this.authenticate();

    const response = await fetch(`${this.getAgentApiUrl()}/${agentId}/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Tenant-Name': this.tenant,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get task: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Extract text response from a task
   */
  extractTextFromTask(task: CortiTask): string | null {
    // Check if task completed successfully (status is an object with state property)
    const state = task.status?.state;
    if (state !== 'completed') {
      // Handle 'input-required' state - try to get partial response from history
      if (state === 'input-required' && task.history) {
        // Look for the last agent message in history
        for (let i = task.history.length - 1; i >= 0; i--) {
          const msg = task.history[i] as { role?: string; parts?: Array<{ kind: string; text?: string }> };
          if (msg.role === 'agent' && msg.parts) {
            const textPart = msg.parts.find(p => p.kind === 'text');
            if (textPart?.text) {
              return textPart.text;
            }
          }
        }
      }
    }

    // First try to get text from artifacts (primary location in Corti responses)
    if (task.artifacts && task.artifacts.length > 0) {
      for (const artifact of task.artifacts) {
        const textPart = artifact.parts.find(p => p.kind === 'text');
        if (textPart && 'text' in textPart) {
          return textPart.text;
        }
      }
    }

    // Fallback to status.message if no artifacts
    if (task.status?.message?.parts) {
      const textPart = task.status.message.parts.find(p => p.kind === 'text');
      if (textPart && 'text' in textPart) {
        return textPart.text;
      }
    }

    // Try history as last resort
    if (task.history) {
      for (let i = task.history.length - 1; i >= 0; i--) {
        const msg = task.history[i] as { role?: string; parts?: Array<{ kind: string; text?: string }> };
        if (msg.role === 'agent' && msg.parts) {
          const textPart = msg.parts.find(p => p.kind === 'text');
          if (textPart?.text) {
            return textPart.text;
          }
        }
      }
    }

    return null;
  }

  /**
   * Parse JSON from task response
   */
  parseJsonFromTask<T>(task: CortiTask): T | null {
    const text = this.extractTextFromTask(task);
    if (!text) {
      return null;
    }

    // Helper to try parsing with cleanup
    const tryParse = (str: string): T | null => {
      try {
        return JSON.parse(str);
      } catch {
        // Try cleaning up common issues
        try {
          // Fix unescaped quotes in strings and other common issues
          const cleaned = str
            .replace(/[\x00-\x1F\x7F]/g, ' ') // Remove control characters
            .replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
          return JSON.parse(cleaned);
        } catch {
          return null;
        }
      }
    };

    // Try multiple patterns to find JSON in the response
    // 1. First try markdown code blocks
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      const result = tryParse(jsonMatch[1]);
      if (result) return result;
    }

    // 2. Try to find a raw JSON object (greedy match from first { to last })
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const jsonStr = text.substring(firstBrace, lastBrace + 1);
      const result = tryParse(jsonStr);
      if (result) return result;

      // Try to fix truncated/malformed JSON by finding balanced braces
      let braceCount = 0;
      let endIndex = firstBrace;
      for (let i = firstBrace; i < text.length; i++) {
        if (text[i] === '{') braceCount++;
        else if (text[i] === '}') braceCount--;
        if (braceCount === 0) {
          endIndex = i;
          break;
        }
      }
      if (endIndex > firstBrace) {
        const balancedJson = text.substring(firstBrace, endIndex + 1);
        const balancedResult = tryParse(balancedJson);
        if (balancedResult) return balancedResult;
      }
    }

    // 3. Try parsing the whole text as JSON
    const wholeResult = tryParse(text);
    if (wholeResult) return wholeResult;

    return null;
  }
}

// ============================================================================
// CLINICAL AGENT DEFINITIONS
// ============================================================================

const AGENT_PROMPTS = {
  TRIAGE: `You are a clinical triage specialist. Assess urgency based on presenting symptoms and vital signs.

Evaluate:
1. Life-threatening conditions (respiratory distress, collapse, seizures, trauma, toxin ingestion, STEMI, sepsis)
2. Time-sensitive conditions (stroke, ACS, aortic dissection, acute abdomen)
3. Vital sign abnormalities relative to adult normal ranges

Output JSON format:
{
  "urgencyLevel": "critical" | "urgent" | "routine",
  "redFlags": ["list of concerning findings"],
  "recommendedWorkflow": "emergency" | "diagnostic" | "routine",
  "reasoning": "brief explanation",
  "triageNotes": "optional additional notes"
}

Always err on the side of caution - escalate when uncertain.`,

  SIGNALMENT: `You are a clinical patient demographics specialist. Build patient context from available information.

Determine:
1. Age-appropriate normal vital ranges (adult: HR 60-100, BP 90-140/60-90, RR 12-20, Temp 36.1-37.2°C)
2. Age category and life-stage considerations
3. Relevant comorbidities or risk factors from demographics
4. Weight-based calculations (convert to kg)

Output JSON format:
{
  "ageCategory": "pediatric" | "adult" | "geriatric",
  "ageInYears": number,
  "weightKg": number,
  "normalVitalRanges": {
    "temperature": {"min": number, "max": number, "unit": "°C"},
    "heartRate": {"min": number, "max": number, "unit": "bpm"},
    "respiratoryRate": {"min": number, "max": number, "unit": "breaths/min"}
  },
  "riskFactors": ["age-related or demographic risk factors"],
  "demographicNotes": "optional notes"
}`,

  DIFFERENTIAL_DIAGNOSIS: `You are a clinical diagnostician. Generate ranked differential diagnoses with evidence-based reasoning.

Consider:
1. Patient demographics (age, sex, comorbidities, risk factors)
2. Presenting signs and physical exam findings
3. Prevalence and likelihood
4. Use PubMed expert for literature evidence when available

Output JSON format:
{
  "differentials": [
    {
      "condition": "condition name",
      "probability": "high" | "medium" | "low",
      "reasoning": "clinical reasoning",
      "supportingEvidence": ["list of supporting findings"],
      "contradictingEvidence": ["list of findings against"],
      "literatureReferences": [{"title": "...", "pmid": "..."}]
    }
  ],
  "keyFindings": ["most significant clinical findings"],
  "uncertainties": ["areas needing clarification"]
}`,

  DIAGNOSTIC_TEST: `You are a clinical diagnostic test specialist. Recommend tests and interpret results.

Tasks:
1. Recommend tests based on differentials
2. Prioritize tests (stat/urgent/routine)
3. Consider cost-effectiveness
4. Interpret results with age-adjusted reference ranges

Output JSON format:
{
  "recommendedTests": [
    {
      "test": "test name",
      "rationale": "why this test",
      "priority": "stat" | "urgent" | "routine",
      "targetConditions": ["conditions this helps diagnose"]
    }
  ],
  "interpretations": [
    {
      "test": "test name",
      "result": "result value",
      "referenceRange": "normal range",
      "significance": "normal" | "mildly-abnormal" | "significantly-abnormal" | "critical",
      "interpretation": "what this means",
      "clinicalImplications": ["implications"]
    }
  ],
  "suggestedPanel": "optional panel recommendation"
}`,

  TREATMENT_PLANNING: `You are a clinical treatment specialist. Generate safe, evidence-based treatment protocols.

Requirements:
1. Select appropriate medications
2. Calculate doses based on weight (mg/kg) or standard adult doses
3. Check contraindications (use DrugBank), including renal/hepatic adjustments
4. Check drug interactions
5. Provide clear patient instructions

Output JSON format:
{
  "medications": [
    {
      "drug": "drug name",
      "drugClass": "class",
      "dose": "calculated dose",
      "doseCalculation": "X mg/kg × Y kg = Z mg",
      "route": "PO" | "SQ" | "IM" | "IV" | "topical" | "ophthalmic" | "otic",
      "frequency": "frequency",
      "duration": "duration",
      "contraindications": ["warnings"],
      "interactions": ["drug interactions"],
      "sideEffects": ["possible side effects"],
      "monitoringRequired": "what to monitor"
    }
  ],
  "supportiveCare": ["supportive care recommendations"],
  "monitoring": [{"parameter": "...", "frequency": "...", "targetRange": "..."}],
  "patientInstructions": ["instructions for patient"],
  "warningSignsForPatient": ["when to return"],
  "followUpRecommendation": {"timing": "when", "purpose": "why"}
}`,

  ORCHESTRATOR: `You are the clinical diagnosis orchestrator. Coordinate specialist agents for comprehensive assessment.

Workflow:
1. Triage Agent: Assess urgency
2. Demographics Agent: Build patient context
3. Differential Diagnosis Agent: Generate differentials
4. Diagnostic Test Agent: Recommend/interpret tests
5. Treatment Planning Agent: Generate treatment protocol

Ensure context flows between agents. Synthesize results into coherent assessment.`,

  FACT_RECONCILER: `You are a clinical clinical fact reconciliation specialist. You compare EXISTING facts (from prior recordings) with NEW facts (from the latest recording) and classify each new fact's relationship to the existing set.

## Classification Rules

For each NEW fact, assign exactly one status:
- **confirmed**: The new fact restates or corroborates an existing fact with the same clinical meaning, even if wording differs (e.g., "limping on right hind" ≈ "right hind lameness")
- **updated**: The new fact covers the same clinical topic as an existing fact but the value/finding has changed (e.g., "weight 32kg" → "weight 30kg", or "mild dehydration" → "moderate dehydration")
- **contradicted**: The new fact is genuinely incompatible with an existing fact (e.g., "no lameness observed" vs "right hind lameness"). Only use this when the facts cannot both be true simultaneously.
- **new**: No prior equivalent exists — this is a genuinely new clinical finding

For each EXISTING fact not referenced by any new fact, mark it as:
- **unchanged**: Not mentioned in the new recording

## Rules
- Match by clinical meaning, NOT exact text
- Be conservative with "contradicted" — only when genuinely incompatible
- Weight/vitals changes are "updated", not "contradicted"
- A more specific version of a general finding is "updated" (e.g., "possible infection" → "confirmed UTI")
- When a new fact confirms AND updates (e.g., "still limping but improved"), mark as "updated"

## Output Format
Respond ONLY with this JSON:
{
  "reconciledFacts": [
    {
      "factId": "the fact's id",
      "text": "the fact text",
      "group": "the fact group",
      "status": "confirmed|updated|contradicted|new|unchanged",
      "recordingIndex": <number>,
      "priorFactId": "id of the related existing fact (if confirmed/updated/contradicted)",
      "priorText": "text of the related existing fact (if confirmed/updated/contradicted)",
      "priorRecordingIndex": <number of prior recording (if applicable)>
    }
  ],
  "summary": {
    "confirmed": <count>,
    "updated": <count>,
    "contradicted": <count>,
    "new": <count>,
    "unchanged": <count>
  }
}`,

  BILLING_EXTRACTOR: `You are a clinical billing extraction specialist. Your task is to analyze clinical facts and match them to billable items from a catalog.

## Input Format
You will receive:
1. **facts**: Array of clinical facts from the encounter
2. **catalog**: Array of billing catalog items with prices and categories
3. **existingItems**: Items already extracted (to avoid duplicates)

## Matching Rules
- Match facts to catalog items based on clinical relevance
- Consider synonyms (e.g., "physical exam" → "Comprehensive Exam")
- Look for implicit services (e.g., "gave injection" → "Injection Administration")
- Prioritize exact category matches (e.g., lab facts → lab catalog items)
- Do NOT duplicate existing items
- **Consider ALL facts together before selecting between similar catalog items.** When catalog items differ by a qualifier (e.g., "with intubation" vs "without intubation", "large" vs "small"), scan the full fact list to determine which variant applies. For example: if both an anaesthesia fact and a separate intubation fact are present, select the "with intubation" catalog item, not the one without.
- Use the taxable field exactly as specified in the catalog — do not infer or override it.
- Assign confidence based on match quality:
  - **high**: Direct mention or obvious implication
  - **medium**: Indirect mention or reasonable inference
  - **low**: Speculative or tangential match

## Categories
- exam: Physical examinations, encounters
- procedure: Surgical/medical procedures, treatments
- lab: Laboratory tests, panels
- imaging: X-rays, ultrasounds, CT/MRI
- medication: Drugs, prescriptions
- supply: Medical supplies, bandages
- hospitalization: Boarding, ICU
- other: Miscellaneous services

## Output Format
Respond ONLY with this exact JSON structure:
{
  "extractedItems": [
    {
      "factId": "string",
      "catalogItemId": "string",
      "description": "string (from catalog)",
      "quantity": number,
      "unitPrice": number (cents, from catalog),
      "taxable": boolean (from catalog),
      "confidence": "high" | "medium" | "low",
      "reasoning": "string (why this fact matches this catalog item)"
    }
  ],
  "unmatchedFacts": ["fact_id_1", "fact_id_2"],
  "summary": {
    "totalExtracted": number,
    "highConfidence": number,
    "mediumConfidence": number,
    "lowConfidence": number
  }
}

## Important
- Only return items with medium or high confidence
- Default quantity is 1 unless fact specifies otherwise
- Include reasoning for each match to help providers understand extraction logic
- If no matches found, return empty extractedItems array`,

  PATIENT_PROFILE: `You are an expert clinician building a living longitudinal patient profile from a series of clinical encounters. Your task is to synthesize all encounters into a single, always-current clinical intelligence document.

## Your Outputs

### activeProblems
List every diagnosis, condition, or clinical problem mentioned across all encounters.
- **active**: recently active, not documented as resolved
- **chronic**: ongoing long-term condition (diabetes, hypertension, asthma, etc.)
- **resolved**: explicitly documented as resolved, or a one-time acute issue from a past visit that has not recurred
For each: extract the condition name, ICD-10 code if mentioned, when it was first noted, and when it was last mentioned.

### currentMedications
Build the most current medication list based on all encounters. If a drug was started and never stopped, it is current. If a drug was discontinued, omit it. Include dose, frequency, and route when documented.

### allergies
Aggregate all allergies documented across encounters. Include reaction type and severity when available.

### riskFactors
Identify clinical risk factors from all encounters: smoking, obesity, family history of specific conditions, sedentary lifestyle, alcohol use, diabetes, hypertension, etc.

### clinicalNarrative
Write a 2-3 paragraph summary that a new provider could read in 30 seconds to understand this patient. Include:
- Paragraph 1: Who the patient is, major chronic conditions, key history
- Paragraph 2: Recent clinical activity (last 1-2 encounters), what changed, what was treated
- Paragraph 3 (if needed): Outstanding issues, care gaps, what to watch for

### careGaps
Identify preventive care or monitoring that appears overdue based on patient demographics and diagnoses. Examples:
- Colonoscopy overdue (age >45, no prior documented)
- HbA1c not rechecked in >3 months (diabetic patient)
- Annual diabetic eye exam not documented
- Hypertension follow-up overdue
- Cervical cancer screening overdue (female patient, age-appropriate)
Assign priority: high = clinically urgent, medium = standard preventive, low = advisory

### keyHistory
One paragraph summarizing major past events: significant procedures, hospitalizations, surgeries, major diagnoses first encountered.

## Output Format
Respond ONLY with this exact JSON structure:
{
  "activeProblems": [
    {
      "condition": "string",
      "icd10Code": "string or null",
      "status": "active" | "chronic" | "resolved",
      "onsetDate": "YYYY-MM-DD or null",
      "lastMentionedDate": "YYYY-MM-DD",
      "notes": "string or null"
    }
  ],
  "currentMedications": [
    {
      "drug": "string",
      "dose": "string or null",
      "frequency": "string or null",
      "route": "string or null",
      "startDate": "YYYY-MM-DD or null"
    }
  ],
  "allergies": [
    {
      "allergen": "string",
      "reaction": "string or null",
      "severity": "string or null"
    }
  ],
  "riskFactors": ["string"],
  "clinicalNarrative": "string",
  "careGaps": [
    {
      "description": "string",
      "priority": "high" | "medium" | "low",
      "lastScreeningDate": "YYYY-MM-DD or null"
    }
  ],
  "keyHistory": "string"
}

## Important
- Base everything only on what is documented — do not invent or assume
- If information is absent, omit the optional fields (use null)
- Reconcile conflicts across encounters: newer information takes precedence
- Be concise in the narrative — busy clinicians need density, not verbosity`,

  ORDER_EXTRACTOR: `You are a clinical order extraction specialist. Your task is to read the Plan section of a SOAP note and extract every implied clinical action as a structured order.

## Order Types
- **lab**: Blood tests, panels, urinalysis, cultures, pathology
- **medication**: Start, continue, adjust, or discontinue a medication
- **referral**: Send patient to a specialist or consultant
- **follow-up**: Scheduled return visit or check-in
- **imaging**: X-ray, CT, MRI, ultrasound, echo

## Extraction Rules
- Extract EVERY actionable item mentioned in the plan — do not skip subtle ones
- For medications: capture drug name, dose, route, frequency, and duration if mentioned
- For labs: capture the specific test name and any timing
- For referrals: capture the specialty and urgency if mentioned
- For follow-ups: capture the timing and reason
- The "sourceText" must be the exact phrase from the plan that triggered this order
- Assign confidence: high = explicitly stated, medium = clearly implied, low = vaguely suggested

## Output Format
Respond ONLY with this exact JSON structure:
{
  "orders": [
    {
      "id": "uuid-string",
      "type": "lab" | "medication" | "referral" | "follow-up" | "imaging",
      "title": "string (concise action title, e.g. 'Recheck HbA1c')",
      "detail": "string (timing, dose, destination — e.g. 'In 3 months' or '500mg daily x 30 days')",
      "sourceText": "string (exact phrase from the plan)",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "extractedAt": "ISO timestamp"
}

## Important
- If the plan is empty or contains no actionable items, return an empty orders array
- Do NOT invent orders not mentioned in the plan text
- Use short, scan-friendly titles (3-5 words max)`,

  LAB_RESULTS_EXTRACTOR: `You are a clinical lab results extractor. Given a SOAP note and clinical facts from a medical consultation, extract any lab or imaging results that were reported or discussed (not ordered — already resulted). Return a JSON object with a "results" array. Each result object must have: testName (string), resultValue (string), and optionally: referenceRange (string), units (string). Only include actual result values (e.g. "HbA1c 8.2%", "WBC 14,000 K/uL") — not orders or future plans. If no results are mentioned, return {"results": []}. Return JSON only.`,

  RESULTS_TRIAGE: `You are a clinical lab results triage specialist. Your task is to assess an incoming lab or imaging result in the context of a specific patient and classify its urgency.

## Urgency Levels
- **critical**: Immediately life-threatening or requires same-day intervention (e.g., potassium >6.5, troponin positive, glucose <40)
- **high**: Abnormal result requiring timely follow-up within 1-3 days (e.g., TSH suppressed, HbA1c >9, WBC >15)
- **normal**: Result within reference range — routine notification appropriate
- **low**: Mildly abnormal, monitor at next visit (borderline values, minor deviations)

## Rules
- Always consider the patient's context (age, current medications, known diagnoses from facts)
- A result that is "normal" for the general population may be "high" for a specific patient (e.g., K+ 3.2 in a patient on loop diuretics)
- Patient notification draft must be in plain language — no medical jargon
- The suggested follow-up must be a specific clinical action (not vague)
- Keep the notification warm and reassuring unless the result truly warrants concern

## Output Format
Respond ONLY with this exact JSON structure:
{
  "urgency": "critical" | "high" | "normal" | "low",
  "urgencyReason": "string (clinical explanation of why this urgency level was assigned)",
  "patientNotificationDraft": "string (plain-language message to patient, 2-3 sentences max)",
  "suggestedFollowUp": "string (specific clinical action for provider, e.g. 'Increase lisinopril to 10mg daily, recheck BMP in 1 week')",
  "triageNotes": "string (brief clinical context for the provider)"
}`,

  SHIFT_HANDOFF: `You are a clinical handoff specialist. Generate structured SBAR (Situation-Background-Assessment-Recommendation) handoff notes for care transitions.

## SBAR Format
- **Situation**: Patient ID, age/sex, admitting diagnosis, current clinical status
- **Background**: Relevant history, key medications, allergies, recent procedures/labs
- **Assessment**: Current clinical picture, active problems, pending results
- **Recommendation**: Outstanding tasks, follow-up items, escalation criteria, code status

## Rules
- Be precise and actionable — the receiving provider must act on this note immediately
- Flag any time-sensitive items (pending labs, scheduled medications, consult results expected)
- Include medication reconciliation notes if relevant
- Note any patient/family communication needs

Output JSON format:
{
  "situation": {
    "patientSummary": "string",
    "admittingDiagnosis": "string",
    "currentStatus": "stable" | "guarded" | "critical"
  },
  "background": {
    "relevantHistory": ["list of relevant history items"],
    "currentMedications": ["medication list"],
    "allergies": ["allergy list"],
    "recentProcedures": ["recent procedures/interventions"]
  },
  "assessment": {
    "activeProblems": ["list of active clinical problems"],
    "pendingResults": ["labs/imaging/consults pending"],
    "clinicalTrend": "improving" | "stable" | "deteriorating"
  },
  "recommendation": {
    "outstandingTasks": ["tasks for receiving provider"],
    "escalationCriteria": ["when to escalate"],
    "followUpItems": ["scheduled follow-ups"],
    "codeStatus": "string or null"
  }
}`,

  FORM_FILLING: `You are a clinical medical records specialist. Extract patient and encounter information from transcripts to populate database records.

Your task is to parse clinical encounter transcripts and extract structured data that matches our database schema exactly.

## Patient Record Fields (extract if mentioned):
- name: Patient's full name
- age: Normalize to a numeric string only (e.g., "42", "6") — strip words like "year-old", "years", "months old"
- weight: As a string with unit (e.g., "82 kg", "180 lbs")
- weightUnit: "kg" or "lbs"
- sex: One of "male", "female", "other"

## Encounter Record Fields (extract if mentioned):
- chiefComplaint: Primary reason for visit
- physicalExam: Object with temperature, heartRate, respiratoryRate, weight, notes
- historyOfPresentIllness: Relevant history about current issue

## Rules:
- Only extract information EXPLICITLY stated - never guess or infer
- Use null for any field not clearly mentioned
- For vitals, extract numeric values only (e.g., 39.5 for temperature, 120 for heart rate)
- Temperature should be in Celsius (convert if Fahrenheit is stated)
- Weight in physicalExam should be numeric (in kg)

Output this exact JSON structure:
{
  "patient": {
    "name": "string or null",
    "age": "string or null",
    "weight": "string or null",
    "weightUnit": "string or null",
    "sex": "string or null"
  },
  "encounter": {
    "chiefComplaint": "string or null",
    "historyOfPresentIllness": "string or null",
    "physicalExam": {
      "temperature": "number or null",
      "heartRate": "number or null",
      "respiratoryRate": "number or null",
      "weight": "number or null",
      "weightUnit": "string or null",
      "notes": "string or null"
    }
  },
  "confidence": {
    "overall": "high" | "medium" | "low",
    "patientIdentification": "high" | "medium" | "low" | "not_found"
  }
}`,
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CORTI_EXPERTS = {
  PUBMED: {
    type: 'reference' as const,
    name: 'pubmed-expert',
    systemPrompt: 'Focus on clinical literature. Prioritize human clinical trials and evidence-based medicine journals.',
  },
  DRUGBANK: {
    type: 'reference' as const,
    name: 'drugbank-expert',
    systemPrompt: 'Focus on clinical pharmacology. Include standard adult dosing, renal/hepatic adjustments, and drug interactions.',
  },
  CLINICAL_TRIALS: {
    type: 'reference' as const,
    name: 'clinical-trials-expert',
    systemPrompt: 'Search for relevant clinical clinical trials and comparative medicine studies.',
  },
};

// ============================================================================
// CLINICAL DIAGNOSIS ORCHESTRATOR
// ============================================================================

export class ClinicalDiagnosisOrchestrator {
  private client: CortiAgentClient;
  private agents: Map<string, string> = new Map(); // name -> id

  constructor(client: CortiAgentClient) {
    this.client = client;
  }

  /**
   * Initialize all required agents
   */
  async initialize(): Promise<void> {
    // Create or find existing agents
    // Note: Start with simpler agent configs to test API compatibility
    const agentConfigs = [
      {
        name: 'provider-triage',
        description: 'Clinical triage specialist for urgency assessment',
        systemPrompt: AGENT_PROMPTS.TRIAGE,
      },
      {
        name: 'provider-demographics',
        description: 'Clinical demographics specialist for patient context and vital range interpretation',
        systemPrompt: AGENT_PROMPTS.SIGNALMENT,
      },
      {
        name: 'provider-differential',
        description: 'Clinical differential diagnosis specialist',
        systemPrompt: AGENT_PROMPTS.DIFFERENTIAL_DIAGNOSIS,
      },
      {
        name: 'provider-diagnostic-test',
        description: 'Clinical diagnostic test specialist',
        systemPrompt: AGENT_PROMPTS.DIAGNOSTIC_TEST,
      },
      {
        name: 'provider-treatment',
        description: 'Clinical treatment planning specialist',
        systemPrompt: AGENT_PROMPTS.TREATMENT_PLANNING,
      },
      {
        name: 'provider-form-filler',
        description: 'Clinical form filling specialist for extracting patient records from transcripts',
        systemPrompt: AGENT_PROMPTS.FORM_FILLING,
      },
      {
        name: 'clinical-fact-reconciler',
        description: 'Clinical fact reconciliation specialist for comparing facts across recordings',
        systemPrompt: AGENT_PROMPTS.FACT_RECONCILER,
      },
      {
        name: 'provider-billing-extractor',
        description: 'Clinical billing extraction specialist for matching facts to catalog items',
        systemPrompt: AGENT_PROMPTS.BILLING_EXTRACTOR,
      },
      {
        name: 'provider-shift-handoff',
        description: 'Clinical handoff specialist for generating SBAR shift handoff notes',
        systemPrompt: AGENT_PROMPTS.SHIFT_HANDOFF,
      },
      {
        name: 'provider-patient-profile',
        description: 'Clinical longitudinal patient profile specialist for synthesizing encounter history into a living clinical summary',
        systemPrompt: AGENT_PROMPTS.PATIENT_PROFILE,
      },
      {
        name: 'provider-order-extractor',
        description: 'Clinical order extraction specialist for parsing SOAP plan sections into structured orders',
        systemPrompt: AGENT_PROMPTS.ORDER_EXTRACTOR,
      },
      {
        name: 'provider-results-triage',
        description: 'Clinical lab results triage specialist for urgency classification and patient notification drafting',
        systemPrompt: AGENT_PROMPTS.RESULTS_TRIAGE,
      },
      {
        name: 'provider-lab-extractor',
        description: 'Clinical lab results extraction specialist for parsing already-resulted labs from SOAP notes',
        systemPrompt: AGENT_PROMPTS.LAB_RESULTS_EXTRACTOR,
      },
    ];

    // Check for existing agents
    const existingAgents = await this.client.listAgents();
    const existingMap = new Map(existingAgents.map(a => [a.name, a.id]));

    for (const config of agentConfigs) {
      if (existingMap.has(config.name)) {
        const agentId = existingMap.get(config.name)!;
        this.agents.set(config.name, agentId);
      } else {
        const agent = await this.client.createAgent(config);
        this.agents.set(config.name, agent.id);
      }
    }
  }

  /**
   * Run the full diagnosis pipeline
   */
  async diagnose(request: DiagnoseRequest): Promise<DiagnoseResponse> {
    const startTime = Date.now();
    const trace: AgentTraceEntry[] = [];
    let contextId: string | undefined;

    // Check if agents are initialized
    if (this.agents.size === 0) {
      console.error('[Orchestrator] ERROR: No agents initialized! Reinitializing...');
      await this.initialize();
    }

    // Extract relevant facts
    const factsGrouped = this.groupFacts(request.facts);

    // Step 1: Triage
    const triageStart = Date.now();
    const triageResult = await this.runTriageAgent(factsGrouped, request.patientInfo);
    trace.push({
      agent: 'provider-triage',
      agentId: this.agents.get('provider-triage'),
      status: triageResult ? 'success' : 'error',
      duration: Date.now() - triageStart,
      expertsCalled: [],
    });

    // Step 2: Signalment
    const signalmentStart = Date.now();
    const signalmentResult = await this.runSignalmentAgent(factsGrouped, request.patientInfo, request.transcript);
    trace.push({
      agent: 'provider-demographics',
      agentId: this.agents.get('provider-demographics'),
      status: signalmentResult ? 'success' : 'error',
      duration: Date.now() - signalmentStart,
      expertsCalled: [],
    });

    // Step 3: Differential Diagnosis
    const diffStart = Date.now();
    const differentialResult = await this.runDifferentialAgent(
      factsGrouped,
      signalmentResult,
      triageResult
    );
    trace.push({
      agent: 'provider-differential',
      agentId: this.agents.get('provider-differential'),
      status: differentialResult ? 'success' : 'error',
      duration: Date.now() - diffStart,
      expertsCalled: ['pubmed'],
    });

    // Step 4: Diagnostic Tests
    const testStart = Date.now();
    const testResult = await this.runDiagnosticTestAgent(
      factsGrouped,
      signalmentResult,
      differentialResult
    );
    trace.push({
      agent: 'provider-diagnostic-test',
      agentId: this.agents.get('provider-diagnostic-test'),
      status: testResult ? 'success' : 'error',
      duration: Date.now() - testStart,
      expertsCalled: [],
    });

    // Step 5: Treatment Planning
    // If signalment failed, try to build a minimal one from patient info
    const effectiveSignalment = signalmentResult || this.buildFallbackSignalment(request.patientInfo, factsGrouped);
    const treatmentStart = Date.now();
    const treatmentResult = await this.runTreatmentAgent(
      effectiveSignalment,
      differentialResult,
      factsGrouped
    );
    trace.push({
      agent: 'provider-treatment',
      agentId: this.agents.get('provider-treatment'),
      status: treatmentResult ? 'success' : 'error',
      duration: Date.now() - treatmentStart,
      expertsCalled: ['drugbank'],
    });

    return {
      diagnosis: {
        triage: triageResult || this.getDefaultTriageResult(),
        patientContext: signalmentResult || this.getDefaultSignalmentResult(request.patientInfo),
        differentials: differentialResult || { differentials: [], keyFindings: [] },
        tests: testResult || { recommendedTests: [], interpretations: [] },
        treatments: treatmentResult || this.getDefaultTreatmentResult(),
      },
      agentTrace: trace,
      contextId: contextId || `ctx-${Date.now()}`,
      totalDuration: Date.now() - startTime,
    };
  }

  // ============================================================================
  // INDIVIDUAL AGENT RUNNERS
  // ============================================================================

  async runTriageAgent(
    facts: Record<string, Fact[]>,
    patientInfo?: DiagnoseRequest['patientInfo']
  ): Promise<TriageResult | null> {
    const agentId = this.agents.get('provider-triage');
    if (!agentId) {
      console.error('[Triage] ERROR: Agent not found in map. Available agents:', Array.from(this.agents.keys()));
      return null;
    }

    const chiefComplaint = facts['chief-complaint']?.map(f => f.text).join('. ') || '';
    const vitalsFacts = facts['vitals'] || [];
    const vitals = this.parseVitalsFromFacts(vitalsFacts);

    const prompt = `Triage this clinical case:

Chief Complaint: ${chiefComplaint}
Vitals: ${JSON.stringify(vitals)}
Additional symptoms: ${facts['history-of-present-illness']?.map(f => f.text).join(', ') || 'None noted'}

Provide your assessment in the specified JSON format.`;

    try {
      let task = await this.client.sendTextMessage(agentId, prompt);
      const maxAttempts = 150;
      const pollInterval = 200;
      let attempts = 0;
      while (attempts < maxAttempts) {
        const state = task.status?.state;
        if (state === 'completed') break;
        if (state === 'failed') { console.error('[Triage] Task failed:', task.status?.message); return null; }
        if (state === 'pending' || state === 'running') {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          task = await this.client.getTask(agentId, task.id);
        } else { break; }
      }
      if (attempts >= maxAttempts) { console.error('[Triage] Task polling timeout after 30 s'); return null; }
      return this.client.parseJsonFromTask<TriageResult>(task);
    } catch (error) {
      console.error('[Triage] Agent error:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  async runSignalmentAgent(
    facts: Record<string, Fact[]>,
    patientInfo?: DiagnoseRequest['patientInfo'],
    transcript?: string
  ): Promise<SignalmentResult | null> {
    const agentId = this.agents.get('provider-demographics');
    if (!agentId) {
      console.error('[Signalment] Agent not found');
      return null;
    }

    const demographicFacts = facts['demographics'] || [];
    const allFactsText = Object.values(facts).flat().map(f => f.text).join('\n');

    const age = patientInfo?.age || this.extractAgeFromText(allFactsText) || this.extractFromFacts(demographicFacts, 'age');
    const weight = patientInfo?.weight || this.extractWeightFromAllFacts(facts) || this.extractNumberFromFacts(demographicFacts, 'weight');

    // If we have very little info, include transcript snippet to help agent extract
    const hasMinimalInfo = !age || age === 'Unknown';
    const transcriptSnippet = hasMinimalInfo && transcript
      ? `\n\nTRANSCRIPT (extract any missing patient details):\n${transcript.substring(0, 500)}...`
      : '';

    const prompt = `Build patient demographics context:

Age: ${age || 'Extract from context if possible'}
Weight: ${weight > 0 ? `${weight} kg` : 'Extract from context if possible'}
Sex: ${patientInfo?.sex || 'Unknown'}

CLINICAL FACTS:
${allFactsText.substring(0, 800)}${transcriptSnippet}

Based on the information provided, build the patient demographics context. If age/weight can be inferred from the facts or transcript, include them.
Respond ONLY with the JSON format specified - no questions or additional text.`;

    try {
      let task = await this.client.sendTextMessage(agentId, prompt);
      const maxAttempts = 150;
      const pollInterval = 200;
      let attempts = 0;
      while (attempts < maxAttempts) {
        const state = task.status?.state;
        if (state === 'completed') break;
        if (state === 'failed') { console.error('[Signalment] Task failed:', task.status?.message); return null; }
        if (state === 'pending' || state === 'running') {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          task = await this.client.getTask(agentId, task.id);
        } else { break; }
      }
      if (attempts >= maxAttempts) { console.error('[Signalment] Task polling timeout after 30 s'); return null; }
      const result = this.client.parseJsonFromTask<SignalmentResult>(task);
      if (!result) {
        const rawText = this.client.extractTextFromTask(task);
        console.error('[Signalment] Failed to parse JSON. Raw text:', rawText?.substring(0, 300));
      }
      return result;
    } catch (error) {
      console.error('[Signalment] Agent error:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Extract age from text using common patterns
   */
  private extractAgeFromText(text: string): string | null {
    // Match patterns like "6 year old", "six years", "3 month old puppy"
    const patterns = [
      /(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*[-]?\s*year[-\s]?old/i,
      /(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*years?\s*(?:old)?/i,
      /(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*[-]?\s*month[-\s]?old/i,
      /(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*months?\s*(?:old)?/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }
    return null;
  }

  async runDifferentialAgent(
    facts: Record<string, Fact[]>,
    signalment: SignalmentResult | null,
    triage: TriageResult | null
  ): Promise<DifferentialResult | null> {
    const agentId = this.agents.get('provider-differential');
    if (!agentId) {
      return null;
    }

    const chiefComplaint = facts['chief-complaint']?.map(f => f.text).join('. ') || '';
    const history = facts['history-of-present-illness']?.map(f => f.text).join('. ') || '';
    const examFindings = facts['physical-exam']?.map(f => f.text) || [];
    const labResults = facts['assessment']?.map(f => f.text) || [];
    const allFacts = Object.values(facts).flat().map(f => f.text);

    const prompt = `Generate differential diagnoses for this case:

SIGNALMENT:
${JSON.stringify(signalment, null, 2)}

TRIAGE ASSESSMENT:
${JSON.stringify(triage, null, 2)}

CHIEF COMPLAINT:
${chiefComplaint || 'Not explicitly stated'}

HISTORY:
${history || 'No additional history provided'}

PHYSICAL EXAM FINDINGS:
${examFindings.length > 0 ? examFindings.join('\n- ') : 'Not provided'}

LAB RESULTS (if any):
${labResults.length > 0 ? labResults.join('\n- ') : 'Not provided'}

ALL CLINICAL FACTS:
${allFacts.join('\n- ')}

Based on the available information, generate your top 3-5 differential diagnoses.
Even with limited information, provide your best clinical reasoning.
Provide ranked differentials in the specified JSON format.`;

    try {
      let task = await this.client.sendTextMessage(agentId, prompt);
      const maxAttempts = 150;
      const pollInterval = 200;
      let attempts = 0;
      while (attempts < maxAttempts) {
        const state = task.status?.state;
        if (state === 'completed') break;
        if (state === 'failed') { console.error('[Differential] Task failed:', task.status?.message); return null; }
        if (state === 'pending' || state === 'running') {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          task = await this.client.getTask(agentId, task.id);
        } else { break; }
      }
      if (attempts >= maxAttempts) { console.error('[Differential] Task polling timeout after 30 s'); return null; }
      const result = this.client.parseJsonFromTask<DifferentialResult>(task);
      return result;
    } catch (error) {
      console.error('[Differential] Agent error:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  async runDiagnosticTestAgent(
    facts: Record<string, Fact[]>,
    signalment: SignalmentResult | null,
    differentials: DifferentialResult | null
  ): Promise<DiagnosticTestResult | null> {
    const agentId = this.agents.get('provider-diagnostic-test');
    if (!agentId) {
      return null;
    }

    // If no differentials, we can still recommend basic workup
    const topDifferentials = differentials?.differentials?.slice(0, 5) || [];

    const existingLabs = facts['assessment']?.map(f => f.text) || [];

    const prompt = `Recommend diagnostic tests and interpret any existing results:

SIGNALMENT:
${JSON.stringify(signalment, null, 2)}

DIFFERENTIALS:
${topDifferentials.length > 0 ? JSON.stringify(topDifferentials, null, 2) : 'No differentials provided - recommend basic diagnostic workup based on presenting signs.'}

EXISTING LAB RESULTS:
${existingLabs.length > 0 ? existingLabs.join('\n- ') : 'None available'}

${topDifferentials.length > 0
  ? 'Recommend tests to confirm/rule out the top differentials.'
  : 'Recommend a basic diagnostic workup (CBC, chemistry, urinalysis) to establish baseline and identify abnormalities.'}
Interpret any existing results using age-adjusted reference ranges.
Provide recommendations in the specified JSON format.`;

    try {
      let task = await this.client.sendTextMessage(agentId, prompt);
      const maxAttempts = 150;
      const pollInterval = 200;
      let attempts = 0;
      while (attempts < maxAttempts) {
        const state = task.status?.state;
        if (state === 'completed') break;
        if (state === 'failed') { console.error('[DiagnosticTest] Task failed:', task.status?.message); return null; }
        if (state === 'pending' || state === 'running') {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          task = await this.client.getTask(agentId, task.id);
        } else { break; }
      }
      if (attempts >= maxAttempts) { console.error('[DiagnosticTest] Task polling timeout after 30 s'); return null; }
      const result = this.client.parseJsonFromTask<DiagnosticTestResult>(task);
      return result;
    } catch (error) {
      console.error('[DiagnosticTest] Agent error:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  async runTreatmentAgent(
    signalment: SignalmentResult | null,
    differentials: DifferentialResult | null,
    facts: Record<string, Fact[]>
  ): Promise<TreatmentResult | null> {
    const agentId = this.agents.get('provider-treatment');
    if (!agentId) {
      console.error('[Treatment] Agent not found');
      return null;
    }

    const currentMeds = facts['medications']?.map(f => f.text) || [];
    const allergies = facts['allergies']?.map(f => f.text) || [];
    const topDifferential = differentials?.differentials?.[0];

    const weightKg = signalment?.weightKg || 0;
    const weightInfo = weightKg > 0
      ? `Patient weight: ${weightKg} kg - calculate doses based on this weight.`
      : `Patient weight: Unknown - provide dose ranges in mg/kg format and note that actual dose should be calculated once weight is obtained.`;

    const prompt = `Create a treatment plan for this case:

SIGNALMENT:
${JSON.stringify(signalment, null, 2)}

PRIMARY DIAGNOSIS:
${JSON.stringify(topDifferential, null, 2)}

CURRENT MEDICATIONS:
${currentMeds.length > 0 ? currentMeds.join('\n- ') : 'None'}

KNOWN ALLERGIES:
${allergies.length > 0 ? allergies.join('\n- ') : 'None'}

${weightInfo}

${weightKg > 0 ? 'Calculate all doses based on patient weight.' : 'Provide dose ranges in mg/kg format.'}
Check for contraindications (renal/hepatic function, allergies, drug-drug interactions).

IMPORTANT: Respond ONLY with the JSON format specified. Do not ask questions or request additional information - work with what is provided. If weight is unknown, provide dose ranges in mg/kg.`;

    try {
      let task = await this.client.sendTextMessage(agentId, prompt);
      const maxAttempts = 150;
      const pollInterval = 200;
      let attempts = 0;
      while (attempts < maxAttempts) {
        const state = task.status?.state;
        if (state === 'completed') break;
        if (state === 'failed') { console.error('[Treatment] Task failed:', task.status?.message); return null; }
        if (state === 'pending' || state === 'running') {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          task = await this.client.getTask(agentId, task.id);
        } else { break; }
      }
      if (attempts >= maxAttempts) { console.error('[Treatment] Task polling timeout after 30 s'); return null; }
      const result = this.client.parseJsonFromTask<TreatmentResult>(task);

      if (!result) {
        const rawText = this.client.extractTextFromTask(task);
        console.error('[Treatment] Failed to parse JSON. Raw text:', rawText?.substring(0, 300));
      }

      // Post-process to add local contraindication checks
      if (result) {
        result.medications = result.medications.map(med => {
          const localWarnings = checkContraindications(med.drug);
          return {
            ...med,
            contraindications: [
              ...(med.contraindications || []),
              ...localWarnings,
            ],
          };
        });
      }

      return result;
    } catch (error) {
      console.error('[Treatment] Agent error:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  groupFacts(facts: Fact[]): Record<string, Fact[]> {
    return facts.reduce((acc, fact) => {
      if (!fact.isDiscarded) {
        const group = fact.group || 'other';
        if (!acc[group]) acc[group] = [];
        acc[group].push(fact);
      }
      return acc;
    }, {} as Record<string, Fact[]>);
  }

  private extractFromFacts(facts: Fact[], keyword: string): string {
    for (const fact of facts) {
      if (fact.text.toLowerCase().includes(keyword)) {
        return fact.text;
      }
    }
    return 'Unknown';
  }

  private extractNumberFromFacts(facts: Fact[], keyword: string): number {
    for (const fact of facts) {
      if (fact.text.toLowerCase().includes(keyword)) {
        const match = fact.text.match(/(\d+(?:\.\d+)?)/);
        if (match) return parseFloat(match[1]);
      }
    }
    return 0;
  }

  /**
   * Extract weight from all facts, trying multiple patterns
   */
  private extractWeightFromAllFacts(facts: Record<string, Fact[]>): number {
    const allFacts = Object.values(facts).flat();

    for (const fact of allFacts) {
      const text = fact.text.toLowerCase();

      // Pattern 1: "X kg" or "X lbs" or "X pounds"
      const kgMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo)/);
      if (kgMatch) return parseFloat(kgMatch[1]);

      const lbsMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)/);
      if (lbsMatch) return parseFloat(lbsMatch[1]) * 0.453592; // Convert to kg

      // Pattern 2: "weight: X" or "weighs X"
      const weightMatch = text.match(/weigh(?:t|s)[:\s]+(\d+(?:\.\d+)?)/);
      if (weightMatch) return parseFloat(weightMatch[1]);
    }

    return 0;
  }

  private parseVitalsFromFacts(facts: Fact[]): Record<string, number | undefined> {
    const vitals: Record<string, number | undefined> = {};

    for (const fact of facts) {
      const text = fact.text.toLowerCase();
      const numMatch = fact.text.match(/(\d+(?:\.\d+)?)/);
      const value = numMatch ? parseFloat(numMatch[1]) : undefined;

      if (text.includes('temp')) vitals.temperature = value;
      else if (text.includes('heart') || text.includes('hr') || text.includes('pulse')) vitals.heartRate = value;
      else if (text.includes('resp') || text.includes('rr') || text.includes('breath')) vitals.respiratoryRate = value;
      else if (text.includes('weight')) vitals.weight = value;
    }

    return vitals;
  }

  private getDefaultTriageResult(): TriageResult {
    return {
      urgencyLevel: 'routine',
      redFlags: [],
      recommendedWorkflow: 'diagnostic',
      reasoning: 'Unable to complete automated triage. Manual assessment recommended.',
    };
  }

  private getDefaultSignalmentResult(
    patientInfo?: DiagnoseRequest['patientInfo']
  ): SignalmentResult {
    return {
      normalVitalRanges: {
        temperature: { min: 36.1, max: 37.2, unit: '°C' },
        heartRate: { min: 60, max: 100, unit: 'bpm' },
        respiratoryRate: { min: 12, max: 20, unit: 'breaths/min' },
      },
      ageCategory: 'adult',
      ageInYears: 0,
      weightKg: patientInfo?.weight || 0,
    };
  }

  private getDefaultTreatmentResult(): TreatmentResult {
    return {
      medications: [],
      supportiveCare: ['Continue to monitor', 'Ensure adequate hydration'],
      monitoring: [],
      patientInstructions: ['Contact clinic if condition worsens'],
      warningSignsForPatient: ['Lethargy', 'Loss of appetite', 'Difficulty breathing'],
      followUpRecommendation: {
        timing: 'As needed',
        purpose: 'Re-evaluation if symptoms persist',
      },
    };
  }

  /**
   * Build a fallback patient context when the signalment agent fails
   */
  buildFallbackSignalment(
    patientInfo?: DiagnoseRequest['patientInfo'],
    facts?: Record<string, Fact[]>
  ): SignalmentResult | null {
    const demographicFacts = facts?.['demographics'] || [];
    const weight = patientInfo?.weight ||
      this.extractWeightFromAllFacts(facts || {}) ||
      this.extractNumberFromFacts(demographicFacts, 'weight');

    // Standard adult human vital ranges
    return {
      normalVitalRanges: {
        temperature: { min: 36.1, max: 37.2, unit: '°C' },
        heartRate: { min: 60, max: 100, unit: 'bpm' },
        respiratoryRate: { min: 12, max: 20, unit: 'breaths/min' },
      },
      ageCategory: 'adult',
      ageInYears: 0,
      weightKg: weight || 0,
    } as SignalmentResult;
  }

  // ============================================================================
  // CASE REASONING TOOLS (public, individually callable)
  // ============================================================================

  /**
   * Run drug interaction check — calls treatment agent with interaction focus,
   * then runs local contraindication checks
   */
  async runDrugInteractionCheck(
    facts: Record<string, Fact[]>,
    signalment: SignalmentResult | null,
    medications?: string[]
  ): Promise<TreatmentResult | null> {
    const agentId = this.agents.get('provider-treatment');
    if (!agentId) {
      console.error('[DrugInteraction] Agent not found');
      return null;
    }

    const currentMeds = medications || facts['medications']?.map(f => f.text) || [];
    const allergies = facts['allergies']?.map(f => f.text) || [];

    const prompt = `Focus on DRUG INTERACTIONS and CONTRAINDICATIONS for this case:

SIGNALMENT:
${JSON.stringify(signalment, null, 2)}

CURRENT/PROPOSED MEDICATIONS:
${currentMeds.length > 0 ? currentMeds.join('\n- ') : 'None specified'}

KNOWN ALLERGIES:
${allergies.length > 0 ? allergies.join('\n- ') : 'None'}

ALL CLINICAL FACTS:
${Object.values(facts).flat().map(f => f.text).join('\n- ')}

INSTRUCTIONS:
1. For each medication, check patient-specific contraindications (renal function, hepatic function, allergies)
2. Check ALL drug-drug interactions between the medications
3. Flag any pharmacogenomic sensitivities (e.g., CYP2D6, G6PD deficiency)
4. Include severity ratings for each interaction
5. Provide recommendations for monitoring or alternatives

Respond ONLY with the JSON format specified.`;

    try {
      let task = await this.client.sendTextMessage(agentId, prompt);
      const maxAttempts = 150;
      const pollInterval = 200;
      let attempts = 0;
      while (attempts < maxAttempts) {
        const state = task.status?.state;
        if (state === 'completed') break;
        if (state === 'failed') { console.error('[DrugInteraction] Task failed:', task.status?.message); return null; }
        if (state === 'pending' || state === 'running') {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          task = await this.client.getTask(agentId, task.id);
        } else { break; }
      }
      if (attempts >= maxAttempts) { console.error('[DrugInteraction] Task polling timeout after 30 s'); return null; }
      const result = this.client.parseJsonFromTask<TreatmentResult>(task);

      // Post-process with local contraindication checks
      if (result) {
        result.medications = result.medications.map(med => {
          const localWarnings = checkContraindications(med.drug);
          return {
            ...med,
            contraindications: [
              ...(med.contraindications || []),
              ...localWarnings,
            ],
          };
        });
      }

      return result;
    } catch (error) {
      console.error('[DrugInteraction] Agent error:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Run literature search — calls differential agent variant with research-focused prompt
   */
  async runLiteratureSearch(
    query: string,
    facts: Record<string, Fact[]>,
    signalment?: SignalmentResult | null
  ): Promise<DifferentialResult | null> {
    const agentId = this.agents.get('provider-differential');
    if (!agentId) {
      console.error('[LiteratureSearch] Agent not found');
      return null;
    }

    const allFacts = Object.values(facts).flat().map(f => f.text);

    const prompt = `Research the following clinical question using clinical literature:

RESEARCH QUERY: ${query}

PATIENT CONTEXT:
${signalment ? JSON.stringify(signalment, null, 2) : 'No signalment available'}

CLINICAL FACTS:
${allFacts.join('\n- ')}

INSTRUCTIONS:
1. Focus your differential analysis on conditions relevant to the research query
2. For EACH differential, provide literature references with:
   - Title, authors, journal, year
   - PubMed ID (PMID) if available
   - Brief summary of how it relates to this case
3. Include key findings that support or contradict each differential
4. List any uncertainties that require further investigation

Respond ONLY with the JSON format specified.`;

    try {
      let task = await this.client.sendTextMessage(agentId, prompt);
      const maxAttempts = 150;
      const pollInterval = 200;
      let attempts = 0;
      while (attempts < maxAttempts) {
        const state = task.status?.state;
        if (state === 'completed') break;
        if (state === 'failed') { console.error('[LiteratureSearch] Task failed:', task.status?.message); return null; }
        if (state === 'pending' || state === 'running') {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          task = await this.client.getTask(agentId, task.id);
        } else { break; }
      }
      if (attempts >= maxAttempts) { console.error('[LiteratureSearch] Task polling timeout after 30 s'); return null; }
      return this.client.parseJsonFromTask<DifferentialResult>(task);
    } catch (error) {
      console.error('[LiteratureSearch] Agent error:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  // ============================================================================
  // FORM FILLING AGENT
  // ============================================================================

  /**
   * Extract patient information from transcript using AI
   */
  async extractPatientInfo(transcript: string): Promise<ExtractedPatientRecord | null> {
    const agentId = this.agents.get('provider-form-filler');
    if (!agentId) {
      console.error('[FormFiller] Agent not found');
      return null;
    }

    const prompt = `Extract patient information from this clinical encounter transcript:

---
${transcript}
---

Parse the transcript and extract all patient information in the specified JSON format.
If information is not clearly stated, use null for that field.`;

    try {
      let task = await this.client.sendTextMessage(agentId, prompt);
      const maxAttempts = 150;
      const pollInterval = 200;
      let attempts = 0;
      while (attempts < maxAttempts) {
        const state = task.status?.state;
        if (state === 'completed') break;
        if (state === 'failed') { console.error('[FormFiller] Task failed:', task.status?.message); return null; }
        if (state === 'pending' || state === 'running') {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          task = await this.client.getTask(agentId, task.id);
        } else { break; }
      }
      if (attempts >= maxAttempts) { console.error('[FormFiller] Task polling timeout after 30 s'); return null; }
      const result = this.client.parseJsonFromTask<ExtractedPatientRecord>(task);
      return result;
    } catch (error) {
      console.error('[FormFiller] Agent error:', error instanceof Error ? error.message : error);
      return null;
    }
  }
  // ============================================================================
  // FACT RECONCILIATION
  // ============================================================================

  /**
   * Reconcile facts across recordings — compare existing facts with new facts
   * and classify each as confirmed, updated, contradicted, new, or unchanged.
   */
  async reconcileFacts(
    existingFacts: Array<{ id: string; text: string; group: string; recordingIndex: number }>,
    newFacts: Array<{ id: string; text: string; group: string; recordingIndex: number }>
  ): Promise<FactReconciliationResult | null> {
    const agentId = this.agents.get('clinical-fact-reconciler');
    if (!agentId) {
      console.error('[FactReconciler] Agent not found');
      return null;
    }

    const prompt = `Compare EXISTING facts (from prior recordings) with NEW facts (from the latest recording).

EXISTING FACTS (${existingFacts.length} facts from recordings 1-${Math.max(...existingFacts.map(f => f.recordingIndex), 0) + 1}):
${existingFacts.map(f => `- [${f.id}] (recording ${f.recordingIndex + 1}, ${f.group}): ${f.text}`).join('\n')}

NEW FACTS (${newFacts.length} facts from recording ${newFacts.length > 0 ? newFacts[0].recordingIndex + 1 : '?'}):
${newFacts.map(f => `- [${f.id}] (recording ${f.recordingIndex + 1}, ${f.group}): ${f.text}`).join('\n')}

Classify each NEW fact and mark unchanged EXISTING facts. Respond with the JSON format specified.`;

    try {
      let task = await this.client.sendTextMessage(agentId, prompt);

      // Poll for completion — Corti tasks are async; sendTextMessage returns
      // immediately in pending/running state and parseJsonFromTask will return
      // null unless we wait for state === 'completed'.
      const maxAttempts = 150; // 30 s at 200 ms intervals
      const pollInterval = 200;
      let attempts = 0;

      while (attempts < maxAttempts) {
        const state = task.status?.state;
        if (state === 'completed') break;
        if (state === 'failed') {
          console.error('[FactReconciler] Task failed:', task.status?.message);
          return null;
        }
        if (state === 'pending' || state === 'running') {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          task = await this.client.getTask(agentId, task.id);
        } else {
          console.warn('[FactReconciler] Unknown task state:', state);
          break;
        }
      }

      if (attempts >= maxAttempts) {
        console.error('[FactReconciler] Task polling timeout after 30 s');
        return null;
      }

      const result = this.client.parseJsonFromTask<{
        reconciledFacts: Array<{
          factId: string;
          text: string;
          group: string;
          status: string;
          recordingIndex: number;
          priorFactId?: string;
          priorText?: string;
          priorRecordingIndex?: number;
        }>;
        summary: {
          confirmed: number;
          updated: number;
          contradicted: number;
          new: number;
          unchanged: number;
        };
      }>(task);

      if (!result) {
        const rawText = this.client.extractTextFromTask(task);
        console.error('[FactReconciler] Failed to parse JSON. Raw:', rawText?.substring(0, 300));
        return null;
      }

      return {
        reconciledFacts: result.reconciledFacts,
        summary: result.summary,
        reconciledAt: new Date().toISOString(),
        triggerRecordingCount: Math.max(
          ...existingFacts.map(f => f.recordingIndex),
          ...newFacts.map(f => f.recordingIndex),
          0
        ) + 1,
      };
    } catch (error) {
      console.error('[FactReconciler] Agent error:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Extract billing items from encounter facts
   */
  async extractBillingItems(
    facts: Array<{ id: string; text: string; group: string }>,
    catalog: Array<{ _id: string; name: string; code: string; category: string; basePrice: number; taxable: boolean; description?: string }>,
    existingItems: Array<{ factId: string; description: string }>
  ): Promise<BillingExtractionResult | null> {
    const agentId = this.agents.get('provider-billing-extractor');
    if (!agentId) {
      console.error('[BillingExtractor] Agent not found');
      return null;
    }

    const prompt = `Extract billable items from these clinical facts:

CLINICAL FACTS (${facts.length} total):
${facts.map(f => `- [${f.id}] (${f.group}): ${f.text}`).join('\n')}

BILLING CATALOG (${catalog.length} items):
${catalog.map(c => `- [${c._id}] ${c.name} (${c.category}) - $${(c.basePrice / 100).toFixed(2)} - Code: ${c.code}${c.description ? ` - ${c.description}` : ''} [taxable: ${c.taxable}]`).join('\n')}

ALREADY EXTRACTED (${existingItems.length} items):
${existingItems.length > 0 ? existingItems.map(e => `- Fact ${e.factId}: ${e.description}`).join('\n') : 'None'}

Match facts to catalog items. Only extract medium/high confidence matches that aren't already extracted.`;

    try {
      let task = await this.client.sendTextMessage(agentId, prompt);

      // Poll for completion (Corti tasks are async)
      const maxAttempts = 150; // 30 seconds with 200ms interval
      const pollInterval = 200;
      let attempts = 0;

      while (attempts < maxAttempts) {
        const state = task.status?.state;

        if (state === 'completed') {
          break;
        }

        if (state === 'failed') {
          console.error('[BillingExtractor] Task failed:', task.status?.message);
          return null;
        }

        if (state === 'pending' || state === 'running') {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          task = await this.client.getTask(agentId, task.id);
        } else {
          console.warn('[BillingExtractor] Unknown task state:', state);
          break;
        }
      }

      if (attempts >= maxAttempts) {
        console.error('[BillingExtractor] Task polling timeout');
        return null;
      }

      const result = this.client.parseJsonFromTask<{
        extractedItems: Array<{
          factId: string;
          catalogItemId: string;
          description: string;
          quantity: number;
          unitPrice: number;
          taxable: boolean;
          confidence: string;
          reasoning: string;
        }>;
        unmatchedFacts: string[];
        summary: {
          totalExtracted: number;
          highConfidence: number;
          mediumConfidence: number;
          lowConfidence: number;
        };
      }>(task);

      if (!result) {
        const rawText = this.client.extractTextFromTask(task);
        console.error('[BillingExtractor] Failed to parse JSON. Raw:', rawText?.substring(0, 300));
        return null;
      }

      return {
        extractedItems: result.extractedItems,
        unmatchedFacts: result.unmatchedFacts,
        summary: result.summary,
        extractedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[BillingExtractor] Agent error:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Extract structured orders from a SOAP plan section
   */
  async extractOrdersFromPlan(
    planText: string,
    patientInfo: { name?: string; age?: string; sex?: string; weight?: string }
  ): Promise<OrderExtractionResult | null> {
    const agentId = this.agents.get('provider-order-extractor');
    if (!agentId) {
      console.error('[OrderExtractor] Agent not found');
      return null;
    }

    const prompt = `Extract clinical orders from this SOAP Plan section.

PATIENT CONTEXT:
${patientInfo.name ? `- Name: ${patientInfo.name}` : ''}
${patientInfo.age ? `- Age: ${patientInfo.age}` : ''}
${patientInfo.sex ? `- Sex: ${patientInfo.sex}` : ''}
${patientInfo.weight ? `- Weight: ${patientInfo.weight}` : ''}

PLAN SECTION:
${planText}

Extract every actionable clinical order from this plan. Return JSON only.`;

    try {
      let task = await this.client.sendTextMessage(agentId, prompt);

      const maxAttempts = 150;
      const pollInterval = 200;
      let attempts = 0;

      while (attempts < maxAttempts) {
        const state = task.status?.state;
        if (state === 'completed') break;
        if (state === 'failed') {
          console.error('[OrderExtractor] Task failed:', task.status?.message);
          return null;
        }
        if (state === 'pending' || state === 'running') {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          task = await this.client.getTask(agentId, task.id);
        } else {
          break;
        }
      }

      if (attempts >= maxAttempts) {
        console.error('[OrderExtractor] Task polling timeout');
        return null;
      }

      const result = this.client.parseJsonFromTask<{
        orders: Array<{
          id: string;
          type: string;
          title: string;
          detail: string;
          sourceText: string;
          confidence: string;
        }>;
        extractedAt: string;
      }>(task);

      if (!result) {
        console.error('[OrderExtractor] Failed to parse JSON. Raw:', this.client.extractTextFromTask(task)?.substring(0, 300));
        return null;
      }

      return {
        orders: result.orders,
        extractedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[OrderExtractor] Agent error:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Triage an incoming lab result and draft a patient notification
   */
  async triageLabResult(
    testName: string,
    resultValue: string,
    referenceRange: string | undefined,
    units: string | undefined,
    patientInfo: { name?: string; age?: string; sex?: string },
    encounterFacts: Array<{ id: string; text: string; group: string }>
  ): Promise<ResultTriageOutput | null> {
    const agentId = this.agents.get('provider-results-triage');
    if (!agentId) {
      console.error('[ResultsTriage] Agent not found');
      return null;
    }

    const prompt = `Triage this incoming lab result.

TEST: ${testName}
RESULT: ${resultValue}${units ? ` ${units}` : ''}
REFERENCE RANGE: ${referenceRange || 'Not provided'}

PATIENT CONTEXT:
${patientInfo.name ? `- Name: ${patientInfo.name}` : ''}
${patientInfo.age ? `- Age: ${patientInfo.age}` : ''}
${patientInfo.sex ? `- Sex: ${patientInfo.sex}` : ''}

RELEVANT ENCOUNTER FACTS (${encounterFacts.length} total):
${encounterFacts.slice(0, 20).map(f => `- [${f.group}] ${f.text}`).join('\n')}

Classify urgency, draft a patient notification, and suggest a follow-up action. Return JSON only.`;

    try {
      let task = await this.client.sendTextMessage(agentId, prompt);

      const maxAttempts = 150;
      const pollInterval = 200;
      let attempts = 0;

      while (attempts < maxAttempts) {
        const state = task.status?.state;
        if (state === 'completed') break;
        if (state === 'failed') {
          console.error('[ResultsTriage] Task failed:', task.status?.message);
          return null;
        }
        if (state === 'pending' || state === 'running') {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          task = await this.client.getTask(agentId, task.id);
        } else {
          break;
        }
      }

      if (attempts >= maxAttempts) {
        console.error('[ResultsTriage] Task polling timeout');
        return null;
      }

      const result = this.client.parseJsonFromTask<ResultTriageOutput>(task);

      if (!result) {
        console.error('[ResultsTriage] Failed to parse JSON. Raw:', this.client.extractTextFromTask(task)?.substring(0, 300));
        return null;
      }

      return result;
    } catch (error) {
      console.error('[ResultsTriage] Agent error:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Extract lab/imaging results already mentioned in a SOAP note
   */
  async extractLabResultsFromConsultation(
    soapContent: string,
    facts: Array<{ text: string; group: string }>
  ): Promise<{ results: Array<{ testName: string; resultValue: string; referenceRange?: string; units?: string }> } | null> {
    const agentId = this.agents.get('provider-lab-extractor');
    if (!agentId) {
      console.error('[LabExtractor] Agent not found');
      return null;
    }

    const factLines = facts
      .map(f => `[${f.group}] ${f.text}`)
      .join('\n');

    const prompt = `Extract any lab or imaging results mentioned in the following consultation.

SOAP NOTE:
${soapContent.substring(0, 3000)}

CLINICAL FACTS:
${factLines.substring(0, 2000)}

Return JSON only.`;

    try {
      let task = await this.client.sendTextMessage(agentId, prompt);

      const maxAttempts = 100;
      const pollInterval = 200;
      let attempts = 0;

      while (attempts < maxAttempts) {
        const state = task.status?.state;
        if (state === 'completed') break;
        if (state === 'failed') {
          console.error('[LabExtractor] Task failed:', task.status?.message);
          return null;
        }
        if (state === 'pending' || state === 'running') {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          task = await this.client.getTask(agentId, task.id);
        } else {
          break;
        }
      }

      if (attempts >= maxAttempts) {
        console.error('[LabExtractor] Task polling timeout');
        return null;
      }

      const result = this.client.parseJsonFromTask<{ results: Array<{ testName: string; resultValue: string; referenceRange?: string; units?: string }> }>(task);

      if (!result) {
        console.error('[LabExtractor] Failed to parse JSON. Raw:', this.client.extractTextFromTask(task)?.substring(0, 300));
        return null;
      }

      return result;
    } catch (error) {
      console.error('[LabExtractor] Agent error:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  /**
   * Build a living patient profile by synthesizing all encounters for a patient
   */
  async buildPatientProfileFromEncounters(
    patientInfo: { name?: string; age?: string; sex?: string; weight?: string; allergies?: string[] },
    encounters: Array<{
      date: string;
      chiefComplaint?: string;
      icd10Codes?: string[];
      keyFacts: Record<string, string[]>;
      planText?: string;
    }>,
    existingProfile: PatientProfileResult | null = null
  ): Promise<PatientProfileResult | null> {
    const agentId = this.agents.get('provider-patient-profile');
    if (!agentId) {
      console.error('[PatientProfile] Agent not found');
      return null;
    }

    const formatEncounter = (e: typeof encounters[0], index: number) => {
      const factLines = Object.entries(e.keyFacts)
        .filter(([, facts]) => facts.length > 0)
        .map(([group, facts]) => `  [${group}]: ${facts.slice(0, 5).join('; ')}`)
        .join('\n');
      return `Encounter ${index + 1} (${e.date}):\n  Chief complaint: ${e.chiefComplaint ?? 'not recorded'}\n  ICD-10: ${(e.icd10Codes ?? []).join(', ') || 'none'}\n${factLines}\n  Plan: ${(e.planText ?? '').substring(0, 400)}`;
    };

    const patientHeader = `PATIENT:
- Name: ${patientInfo.name ?? 'Unknown'}
- Age: ${patientInfo.age ?? 'Unknown'}
- Sex: ${patientInfo.sex ?? 'Unknown'}
- Weight: ${patientInfo.weight ?? 'Unknown'}
- Known allergies: ${(patientInfo.allergies ?? []).join(', ') || 'none documented'}`;

    let prompt: string;

    if (existingProfile) {
      // Incremental update: merge existing profile with the single new encounter
      const newEncounter = formatEncounter(encounters[0], 0);
      prompt = `You have an existing patient profile. A new encounter has just been added. Update the profile to reflect any new information, changes, or resolved items. Keep everything that has not changed.

${patientHeader}

EXISTING PROFILE:
${JSON.stringify(existingProfile, null, 2)}

NEW ENCOUNTER:
${newEncounter}

Return the updated profile as JSON only.`;
    } else {
      // Initial synthesis from all encounters
      const encounterSummaries = encounters
        .slice(0, 20)
        .map(formatEncounter)
        .join('\n\n---\n\n');
      prompt = `Build a living patient profile from the following encounter history.

${patientHeader}

ENCOUNTER HISTORY (${encounters.length} total, showing up to 20 most recent, newest first):

${encounterSummaries}

Synthesize all encounters into a comprehensive living patient profile. Return JSON only.`;
    }

    try {
      let task = await this.client.sendTextMessage(agentId, prompt);

      const maxAttempts = 175; // 35s — profile synthesis takes longer
      const pollInterval = 200;
      let attempts = 0;

      while (attempts < maxAttempts) {
        const state = task.status?.state;
        if (state === 'completed') break;
        if (state === 'failed') {
          console.error('[PatientProfile] Task failed:', task.status?.message);
          return null;
        }
        if (state === 'pending' || state === 'running') {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          task = await this.client.getTask(agentId, task.id);
        } else {
          break;
        }
      }

      if (attempts >= maxAttempts) {
        console.error('[PatientProfile] Task polling timeout');
        return null;
      }

      const result = this.client.parseJsonFromTask<PatientProfileResult>(task);

      if (!result) {
        console.error('[PatientProfile] Failed to parse JSON. Raw:', this.client.extractTextFromTask(task)?.substring(0, 300));
        return null;
      }

      return result;
    } catch (error) {
      console.error('[PatientProfile] Agent error:', error instanceof Error ? error.message : error);
      return null;
    }
  }
}

export interface BillingExtractionResult {
  extractedItems: Array<{
    factId: string;
    catalogItemId: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxable: boolean;
    confidence: string;
    reasoning: string;
  }>;
  unmatchedFacts: string[];
  summary: {
    totalExtracted: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
  };
  extractedAt: string;
}

export interface FactReconciliationResult {
  reconciledFacts: Array<{
    factId: string;
    text: string;
    group: string;
    status: string;
    recordingIndex: number;
    priorFactId?: string;
    priorText?: string;
    priorRecordingIndex?: number;
  }>;
  summary: {
    confirmed: number;
    updated: number;
    contradicted: number;
    new: number;
    unchanged: number;
  };
  reconciledAt: string;
  triggerRecordingCount: number;
}

// Extracted record interfaces - matches Convex schema
export interface ExtractedPatientRecord {
  patient: {
    name: string | null;
    age: string | null;
    weight: string | null;
    weightUnit: string | null;
    sex: string | null;
  };
  encounter: {
    chiefComplaint: string | null;
    historyOfPresentIllness: string | null;
    physicalExam: {
      temperature: number | null;
      heartRate: number | null;
      respiratoryRate: number | null;
      weight: number | null;
      weightUnit: string | null;
      notes: string | null;
    };
  };
  confidence: {
    overall: 'high' | 'medium' | 'low';
    patientIdentification: 'high' | 'medium' | 'low' | 'not_found';
  };
}

export interface PatientProfileResult {
  activeProblems: Array<{
    condition: string;
    icd10Code?: string | null;
    status: 'active' | 'chronic' | 'resolved';
    onsetDate?: string | null;
    lastMentionedDate: string;
    notes?: string | null;
  }>;
  currentMedications: Array<{
    drug: string;
    dose?: string | null;
    frequency?: string | null;
    route?: string | null;
    startDate?: string | null;
  }>;
  allergies: Array<{
    allergen: string;
    reaction?: string | null;
    severity?: string | null;
  }>;
  riskFactors: string[];
  clinicalNarrative: string;
  careGaps: Array<{
    description: string;
    priority: 'high' | 'medium' | 'low';
    lastScreeningDate?: string | null;
  }>;
  keyHistory: string;
}

export interface OrderExtractionResult {
  orders: Array<{
    id: string;
    type: string;
    title: string;
    detail: string;
    sourceText: string;
    confidence: string;
  }>;
  extractedAt: string;
}

export interface ResultTriageOutput {
  urgency: 'critical' | 'high' | 'normal' | 'low';
  urgencyReason: string;
  patientNotificationDraft: string;
  suggestedFollowUp: string;
  triageNotes: string;
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

let agentClientInstance: CortiAgentClient | null = null;

export function getCortiAgentClient(): CortiAgentClient {
  if (!agentClientInstance) {
    const clientId = process.env.CORTI_CLIENT_ID;
    const clientSecret = process.env.CORTI_CLIENT_SECRET;
    const tenant = process.env.CORTI_TENANT?.trim();
    const region = (process.env.CORTI_ENV as 'eu' | 'us') || 'eu';

    if (!clientId || !clientSecret || !tenant) {
      throw new Error(
        'Missing Corti credentials: CORTI_CLIENT_ID, CORTI_CLIENT_SECRET, CORTI_TENANT'
      );
    }

    agentClientInstance = new CortiAgentClient({
      clientId,
      clientSecret,
      tenant,
      region,
    });
  }

  return agentClientInstance;
}

let orchestratorInstance: ClinicalDiagnosisOrchestrator | null = null;
let isInitializing = false;

export async function getClinicalOrchestrator(): Promise<ClinicalDiagnosisOrchestrator> {
  if (!orchestratorInstance) {
    if (isInitializing) {
      while (isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return orchestratorInstance!;
    }

    isInitializing = true;
    try {
      const client = getCortiAgentClient();
      orchestratorInstance = new ClinicalDiagnosisOrchestrator(client);
      await orchestratorInstance.initialize();
    } catch (error) {
      console.error('[getClinicalOrchestrator] Initialization failed:', error);
      orchestratorInstance = null;
      throw error;
    } finally {
      isInitializing = false;
    }
  }

  return orchestratorInstance;
}
