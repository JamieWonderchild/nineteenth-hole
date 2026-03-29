#!/usr/bin/env tsx
/**
 * Test script to compare Corti document generation quality:
 * - Approach A: Facts as context (current implementation)
 * - Approach B: Transcript as context
 * - Approach C: Transcript + provider notes as additional transcript segment
 *
 * Each approach creates its own interaction and generates a SOAP note.
 * Run with: npx tsx scripts/test-doc-gen-comparison.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

interface SimplifiedFact {
  text: string;
  source: 'core' | 'system' | 'user';
  group?: string;
}

interface DocumentContext {
  type: 'facts' | 'transcript';
  data: SimplifiedFact[] | { text: string };
}

interface DocumentGenerationPayload {
  context: DocumentContext[];
  templateKey: string;
  outputLanguage: string;
  name?: string;
  documentationMode?: 'routed_parallel' | 'sequential';
}

interface GeneratedSection {
  key: string;
  name?: string;
  text?: string;
}

interface GeneratedDocument {
  id: string;
  name?: string;
  sections: GeneratedSection[];
  createdAt: string;
}

interface Interaction {
  id: string;
  interactionId: string;
  created_at: string;
}

// ============================================================================
// CORTI CLIENT
// ============================================================================

class CortiClient {
  private clientId: string;
  private clientSecret: string;
  private tenant: string;
  private region: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(clientId: string, clientSecret: string, tenant: string, region: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.tenant = tenant;
    this.region = region;
  }

  private getAuthUrl(): string {
    return `https://auth.${this.region}.corti.app/realms/${this.tenant}/protocol/openid-connect/token`;
  }

  private getApiBaseUrl(): string {
    return `https://api.${this.region}.corti.app`;
  }

  async authenticate(): Promise<void> {
    // Check if we have a valid token (with 30 second buffer)
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
      throw new Error(`Authentication failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 30) * 1000;
  }

  async createInteractionV2(): Promise<Interaction> {
    await this.authenticate();

    const response = await fetch(`${this.getApiBaseUrl()}/v2/interactions/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Tenant-Name': this.tenant,
      },
      body: JSON.stringify({
        encounter: {
          identifier: `test-doc-gen-${Date.now()}`,
          status: 'in-progress',
          type: 'encounter',
          period: { startedAt: new Date().toISOString() },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create interaction: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  async generateDocumentRaw(
    interactionId: string,
    payload: DocumentGenerationPayload
  ): Promise<GeneratedDocument> {
    await this.authenticate();

    const url = `${this.getApiBaseUrl()}/v2/interactions/${interactionId}/documents`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Tenant-Name': this.tenant,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = errorText;
      }
      throw new Error(
        `Document generation failed: ${response.status} ${response.statusText}\nDetails: ${JSON.stringify(errorDetails, null, 2)}`
      );
    }

    return response.json();
  }
}

// ============================================================================
// TEST DATA
// ============================================================================

const SAMPLE_FACTS: SimplifiedFact[] = [
  {
    text: 'Seven year old female spayed golden retriever',
    group: 'demographics',
    source: 'system',
  },
  {
    text: 'Limping on right front leg for past three days',
    group: 'chief-complaint',
    source: 'system',
  },
  {
    text: 'Previous visit two weeks ago showed mild arthritis in both hips',
    group: 'past-medical-history',
    source: 'system',
  },
  {
    text: 'Currently on Rimadyl, seventy-five milligrams twice daily',
    group: 'medications',
    source: 'system',
  },
  {
    text: 'Weight was thirty-two kilograms at last visit',
    group: 'vitals',
    source: 'system',
  },
];

const VET_NOTES_AS_FACTS: SimplifiedFact[] = [
  {
    text: 'Provider Assessment: Right forelimb soft tissue strain, concurrent bilateral hip osteoarthritis',
    source: 'user',
  },
  {
    text: 'Treatment Plan: Gabapentin 100mg BID x14 days, continue Rimadyl 75mg BID, exercise restriction 2 weeks, recheck 14 days',
    source: 'user',
  },
];

const SAMPLE_TRANSCRIPT = `This is a follow up for Bella, a seven year old female spayed golden retriever. Owner reports she's been limping on her right front leg for the past three days. Previous visit two weeks ago showed mild arthritis in both hips, currently on Rimadyl, seventy-five milligrams twice daily. Weight was thirty-two kilograms at last visit.`;

const VET_NOTES_TRANSCRIPT = `Provider Assessment: Right forelimb soft tissue strain, concurrent bilateral hip osteoarthritis. Treatment Plan: Gabapentin 100mg BID x14 days, continue Rimadyl 75mg BID, exercise restriction 2 weeks, recheck 14 days.`;

// ============================================================================
// TEST RUNNER
// ============================================================================

async function testApproachA(client: CortiClient): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('APPROACH A: Facts as Context (Current Implementation)');
  console.log('='.repeat(80));

  try {
    // Create interaction
    const interaction = await client.createInteractionV2();
    console.log(`✓ Created interaction: ${interaction.interactionId}`);

    // Build payload with facts + provider notes as additional facts
    const payload: DocumentGenerationPayload = {
      context: [
        {
          type: 'facts',
          data: [...SAMPLE_FACTS, ...VET_NOTES_AS_FACTS],
        },
      ],
      templateKey: 'corti-soap',
      outputLanguage: 'en',
      name: 'SOAP Note - Approach A (Facts)',
    };

    console.log('\nPayload:');
    console.log(JSON.stringify(payload, null, 2));

    // Generate document
    console.log('\nGenerating SOAP note...');
    const startTime = Date.now();
    const doc = await client.generateDocumentRaw(interaction.interactionId, payload);
    const duration = Date.now() - startTime;

    console.log(`✓ Document generated in ${duration}ms`);
    console.log(`  Document ID: ${doc.id}`);
    console.log(`  Sections: ${doc.sections.length}`);

    // Print sections
    console.log('\n--- GENERATED DOCUMENT ---\n');
    for (const section of doc.sections) {
      const title = section.name || section.key;
      const content = section.text || '';
      console.log(`### ${title}`);
      console.log(content);
      console.log('');
    }
  } catch (error) {
    console.error('❌ APPROACH A FAILED:');
    console.error(error instanceof Error ? error.message : String(error));
  }
}

async function testApproachB(client: CortiClient): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('APPROACH B: Transcript as Context');
  console.log('='.repeat(80));

  try {
    // Create NEW interaction for this approach
    const interaction = await client.createInteractionV2();
    console.log(`✓ Created interaction: ${interaction.interactionId}`);

    // Build payload with transcript only
    const payload: DocumentGenerationPayload = {
      context: [
        {
          type: 'transcript',
          data: {
            text: SAMPLE_TRANSCRIPT,
          },
        },
      ],
      templateKey: 'corti-soap',
      outputLanguage: 'en',
      name: 'SOAP Note - Approach B (Transcript)',
    };

    console.log('\nPayload:');
    console.log(JSON.stringify(payload, null, 2));

    // Generate document
    console.log('\nGenerating SOAP note...');
    const startTime = Date.now();
    const doc = await client.generateDocumentRaw(interaction.interactionId, payload);
    const duration = Date.now() - startTime;

    console.log(`✓ Document generated in ${duration}ms`);
    console.log(`  Document ID: ${doc.id}`);
    console.log(`  Sections: ${doc.sections.length}`);

    // Print sections
    console.log('\n--- GENERATED DOCUMENT ---\n');
    for (const section of doc.sections) {
      const title = section.name || section.key;
      const content = section.text || '';
      console.log(`### ${title}`);
      console.log(content);
      console.log('');
    }
  } catch (error) {
    console.error('❌ APPROACH B FAILED:');
    console.error(error instanceof Error ? error.message : String(error));
  }
}

async function testApproachC(client: CortiClient): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('APPROACH C: Transcript + Provider Notes as Additional Transcript Segment');
  console.log('='.repeat(80));

  try {
    // Create NEW interaction for this approach
    const interaction = await client.createInteractionV2();
    console.log(`✓ Created interaction: ${interaction.interactionId}`);

    // Build payload with two transcript entries
    const payload: DocumentGenerationPayload = {
      context: [
        {
          type: 'transcript',
          data: {
            text: SAMPLE_TRANSCRIPT,
          },
        },
        {
          type: 'transcript',
          data: {
            text: VET_NOTES_TRANSCRIPT,
          },
        },
      ],
      templateKey: 'corti-soap',
      outputLanguage: 'en',
      name: 'SOAP Note - Approach C (Transcript + Provider Notes)',
    };

    console.log('\nPayload:');
    console.log(JSON.stringify(payload, null, 2));

    // Generate document
    console.log('\nGenerating SOAP note...');
    const startTime = Date.now();
    const doc = await client.generateDocumentRaw(interaction.interactionId, payload);
    const duration = Date.now() - startTime;

    console.log(`✓ Document generated in ${duration}ms`);
    console.log(`  Document ID: ${doc.id}`);
    console.log(`  Sections: ${doc.sections.length}`);

    // Print sections
    console.log('\n--- GENERATED DOCUMENT ---\n');
    for (const section of doc.sections) {
      const title = section.name || section.key;
      const content = section.text || '';
      console.log(`### ${title}`);
      console.log(content);
      console.log('');
    }
  } catch (error) {
    console.error('❌ APPROACH C FAILED:');
    console.error(error instanceof Error ? error.message : String(error));
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('Corti Document Generation Comparison Test');
  console.log('==========================================\n');

  // Validate environment variables
  const clientId = process.env.CORTI_CLIENT_ID;
  const clientSecret = process.env.CORTI_CLIENT_SECRET;
  const tenant = process.env.CORTI_TENANT;
  const region = process.env.CORTI_ENV || 'eu';

  if (!clientId || !clientSecret || !tenant) {
    console.error('❌ Missing required environment variables:');
    console.error('   CORTI_CLIENT_ID, CORTI_CLIENT_SECRET, CORTI_TENANT');
    console.error('   Make sure .env.local is present in the project root.');
    process.exit(1);
  }

  console.log(`Using Corti environment: ${region}`);
  console.log(`Tenant: ${tenant}\n`);

  // Create client
  const client = new CortiClient(clientId, clientSecret, tenant, region);

  // Test authentication
  console.log('Authenticating with Corti...');
  try {
    await client.authenticate();
    console.log('✓ Authentication successful\n');
  } catch (error) {
    console.error('❌ Authentication failed:', error);
    process.exit(1);
  }

  // Run all three approaches sequentially
  await testApproachA(client);
  await testApproachB(client);
  await testApproachC(client);

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`
Compare the three outputs above to assess:

1. **Completeness**: Which approach captured all the clinical information?
   - Patient demographics (7yo FS Golden Retriever)
   - Chief complaint (limping right front leg, 3 days)
   - History (previous arthritis diagnosis, current medications)
   - Assessment (forelimb strain + hip OA)
   - Treatment plan (Gabapentin, Rimadyl, exercise restriction, recheck)

2. **Structure**: Which sections were populated in each approach?
   - Subjective (history, complaint)
   - Objective (exam findings)
   - Assessment (diagnosis)
   - Plan (treatment)

3. **Provider Notes Integration**: How well were the provider's manual notes incorporated?
   - Approach A: Added as 'user' source facts
   - Approach B: Not included (transcript only)
   - Approach C: Added as separate transcript segment

4. **Clinical Quality**: Which approach produced the most clinically accurate
   and professional SOAP note?

Based on the results, we can determine if switching from facts to transcript
context improves document generation quality, or if the current facts-based
approach is optimal.
`);

  console.log('Test complete.\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
