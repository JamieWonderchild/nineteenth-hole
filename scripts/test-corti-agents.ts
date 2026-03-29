#!/usr/bin/env npx ts-node
/**
 * Test script for Corti Agentic Diagnosis Pipeline
 *
 * Usage:
 *   npx ts-node scripts/test-corti-agents.ts
 *
 * Or with environment variables:
 *   CORTI_CLIENT_ID=xxx CORTI_CLIENT_SECRET=xxx CORTI_TENANT=xxx npx ts-node scripts/test-corti-agents.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Check required env vars
const requiredEnvVars = ['CORTI_CLIENT_ID', 'CORTI_CLIENT_SECRET', 'CORTI_TENANT'];
const missing = requiredEnvVars.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error('Missing required environment variables:', missing.join(', '));
  console.error('\nMake sure these are set in .env.local or exported in your shell.');
  process.exit(1);
}

// Import after env vars are loaded
import { CortiAgentClient, ClinicalDiagnosisOrchestrator } from '../src/services/corti-agents';
import type { Fact } from '../src/types/corti';

// Sample test facts for an adult patient with GI complaint
const TEST_FACTS: Fact[] = [
  {
    id: 'test-1',
    text: 'Patient: 42-year-old male',
    group: 'demographics',
    groupId: 'demographics',
    isDiscarded: false,
    source: 'test',
    createdAt: new Date().toISOString(),
    createdAtTzOffset: null,
    updatedAt: new Date().toISOString(),
    updatedAtTzOffset: null,
    evidence: []
  },
  {
    id: 'test-2',
    text: 'PMH: hypertension, GERD',
    group: 'demographics',
    groupId: 'demographics',
    isDiscarded: false,
    source: 'test',
    createdAt: new Date().toISOString(),
    createdAtTzOffset: null,
    updatedAt: new Date().toISOString(),
    updatedAtTzOffset: null,
    evidence: []
  },
  {
    id: 'test-3',
    text: 'Age: 42 years',
    group: 'demographics',
    groupId: 'demographics',
    isDiscarded: false,
    source: 'test',
    createdAt: new Date().toISOString(),
    createdAtTzOffset: null,
    updatedAt: new Date().toISOString(),
    updatedAtTzOffset: null,
    evidence: []
  },
  {
    id: 'test-4',
    text: 'Weight: 32 kg',
    group: 'demographics',
    groupId: 'demographics',
    isDiscarded: false,
    source: 'test',
    createdAt: new Date().toISOString(),
    createdAtTzOffset: null,
    updatedAt: new Date().toISOString(),
    updatedAtTzOffset: null,
    evidence: []
  },
  {
    id: 'test-5',
    text: 'Vomiting for 2 days',
    group: 'chief-complaint',
    groupId: 'chief-complaint',
    isDiscarded: false,
    source: 'test',
    createdAt: new Date().toISOString(),
    createdAtTzOffset: null,
    updatedAt: new Date().toISOString(),
    updatedAtTzOffset: null,
    evidence: []
  },
  {
    id: 'test-6',
    text: 'Decreased appetite',
    group: 'chief-complaint',
    groupId: 'chief-complaint',
    isDiscarded: false,
    source: 'test',
    createdAt: new Date().toISOString(),
    createdAtTzOffset: null,
    updatedAt: new Date().toISOString(),
    updatedAtTzOffset: null,
    evidence: []
  },
  {
    id: 'test-7',
    text: 'Fatigue reported by patient',
    group: 'history-of-present-illness',
    groupId: 'history-of-present-illness',
    isDiscarded: false,
    source: 'test',
    createdAt: new Date().toISOString(),
    createdAtTzOffset: null,
    updatedAt: new Date().toISOString(),
    updatedAtTzOffset: null,
    evidence: []
  },
  {
    id: 'test-8',
    text: 'Temperature: 39.8°C',
    group: 'vitals',
    groupId: 'vitals',
    isDiscarded: false,
    source: 'test',
    createdAt: new Date().toISOString(),
    createdAtTzOffset: null,
    updatedAt: new Date().toISOString(),
    updatedAtTzOffset: null,
    evidence: []
  },
  {
    id: 'test-9',
    text: 'Heart rate: 110 bpm',
    group: 'vitals',
    groupId: 'vitals',
    isDiscarded: false,
    source: 'test',
    createdAt: new Date().toISOString(),
    createdAtTzOffset: null,
    updatedAt: new Date().toISOString(),
    updatedAtTzOffset: null,
    evidence: []
  },
  {
    id: 'test-10',
    text: 'Mild abdominal tenderness on palpation',
    group: 'physical-exam',
    groupId: 'physical-exam',
    isDiscarded: false,
    source: 'test',
    createdAt: new Date().toISOString(),
    createdAtTzOffset: null,
    updatedAt: new Date().toISOString(),
    updatedAtTzOffset: null,
    evidence: []
  },
  {
    id: 'test-11',
    text: 'No foreign body palpated',
    group: 'physical-exam',
    groupId: 'physical-exam',
    isDiscarded: false,
    source: 'test',
    createdAt: new Date().toISOString(),
    createdAtTzOffset: null,
    updatedAt: new Date().toISOString(),
    updatedAtTzOffset: null,
    evidence: []
  },
  {
    id: 'test-12',
    text: 'Started ibuprofen 3 days ago per patient',
    group: 'past-medical-history',
    groupId: 'past-medical-history',
    isDiscarded: false,
    source: 'test',
    createdAt: new Date().toISOString(),
    createdAtTzOffset: null,
    updatedAt: new Date().toISOString(),
    updatedAtTzOffset: null,
    evidence: []
  }
];

async function main() {
  console.log('='.repeat(60));
  console.log('CORTI AGENTIC DIAGNOSIS TEST');
  console.log('='.repeat(60));
  console.log();

  // Create client
  console.log('1. Creating Corti Agent Client...');
  const client = new CortiAgentClient({
    clientId: process.env.CORTI_CLIENT_ID!,
    clientSecret: process.env.CORTI_CLIENT_SECRET!,
    tenant: process.env.CORTI_TENANT!,
    region: (process.env.CORTI_ENV as 'eu' | 'us') || 'eu'
  });
  console.log('   ✓ Client created');
  console.log();

  // Test 1: List existing agents
  console.log('2. Listing existing agents...');
  try {
    const agents = await client.listAgents();
    console.log(`   Found ${agents.length} existing agents:`);
    agents.forEach(a => console.log(`   - ${a.name} (${a.id})`));
  } catch (error) {
    console.log('   ✗ Error listing agents:', error instanceof Error ? error.message : error);
  }
  console.log();

  // Test 2: List available experts
  console.log('3. Listing available experts...');
  try {
    const experts = await client.listExperts();
    console.log(`   Found ${experts.length} available experts:`);
    experts.slice(0, 10).forEach(e => console.log(`   - ${e.name}: ${e.description?.slice(0, 50)}...`));
    if (experts.length > 10) console.log(`   ... and ${experts.length - 10} more`);
  } catch (error) {
    console.log('   ✗ Error listing experts:', error instanceof Error ? error.message : error);
  }
  console.log();

  // Test 3: Initialize orchestrator (creates agents if needed)
  console.log('4. Initializing ClinicalDiagnosisOrchestrator...');
  console.log('   (This will create agents if they don\'t exist, or reuse existing ones)');
  const orchestrator = new ClinicalDiagnosisOrchestrator(client);

  const initStart = Date.now();
  try {
    await orchestrator.initialize();
    console.log(`   ✓ Orchestrator initialized in ${Date.now() - initStart}ms`);
  } catch (error) {
    console.log('   ✗ Error initializing orchestrator:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
  console.log();

  // Test 4: List agents again to confirm
  console.log('5. Listing agents after initialization...');
  try {
    const agents = await client.listAgents();
    const vetAgents = agents.filter(a => a.name.startsWith('provider-'));
    console.log(`   Found ${vetAgents.length} clinical agents:`);
    vetAgents.forEach(a => console.log(`   - ${a.name} (${a.id})`));
  } catch (error) {
    console.log('   ✗ Error:', error instanceof Error ? error.message : error);
  }
  console.log();

  // Test 5: Run a diagnosis
  console.log('6. Running diagnosis pipeline...');
  console.log(`   Input: ${TEST_FACTS.length} facts`);
  console.log('   Patient: 42yo male, vomiting, recently started ibuprofen');
  console.log();

  const diagStart = Date.now();
  try {
    const result = await orchestrator.diagnose({
      interactionId: `test-${Date.now()}`,
      facts: TEST_FACTS,
      patientInfo: {
        age: '42 years',
        sex: 'male',
      },
      encounterType: 'sick-visit'
    });

    console.log(`   ✓ Diagnosis completed in ${Date.now() - diagStart}ms`);
    console.log();

    // Print results
    console.log('='.repeat(60));
    console.log('DIAGNOSIS RESULTS');
    console.log('='.repeat(60));
    console.log();

    // Triage
    console.log('TRIAGE:');
    console.log(`   Urgency: ${result.diagnosis.triage.urgencyLevel.toUpperCase()}`);
    console.log(`   Workflow: ${result.diagnosis.triage.recommendedWorkflow}`);
    console.log(`   Reasoning: ${result.diagnosis.triage.reasoning}`);
    if (result.diagnosis.triage.redFlags.length > 0) {
      console.log(`   Red Flags: ${result.diagnosis.triage.redFlags.join(', ')}`);
    }
    console.log();

    // Patient summary
    console.log('PATIENT SUMMARY:');
    console.log(`   Age category: ${result.diagnosis.patientSummary?.ageCategory ?? 'N/A'}`);
    console.log(`   Risk factors: ${result.diagnosis.patientSummary?.riskFactors?.join(', ') ?? 'None noted'}`);
    console.log();

    // Differentials
    console.log('TOP DIFFERENTIALS:');
    result.diagnosis.differentials.differentials.slice(0, 5).forEach((d, i) => {
      console.log(`   ${i + 1}. ${d.condition} [${d.probability.toUpperCase()}]`);
      console.log(`      ${d.reasoning.slice(0, 100)}...`);
    });
    console.log();

    // Recommended Tests
    console.log('RECOMMENDED TESTS:');
    result.diagnosis.tests.recommendedTests.slice(0, 5).forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.test} [${t.priority.toUpperCase()}]`);
      console.log(`      ${t.rationale.slice(0, 80)}...`);
    });
    console.log();

    // Treatments
    console.log('TREATMENT PLAN:');
    result.diagnosis.treatments.medications.slice(0, 3).forEach((m, i) => {
      console.log(`   ${i + 1}. ${m.drug}`);
      console.log(`      Dose: ${m.dose} ${m.route} ${m.frequency}`);
      console.log(`      Duration: ${m.duration}`);
      if (m.contraindications && m.contraindications.length > 0) {
        console.log(`      ⚠️  ${m.contraindications[0]}`);
      }
    });
    console.log();

    if (result.diagnosis.treatments.patientInstructions.length > 0) {
      console.log('PATIENT INSTRUCTIONS:');
      result.diagnosis.treatments.patientInstructions.slice(0, 3).forEach(inst => {
        console.log(`   • ${inst}`);
      });
      console.log();
    }

    if (result.diagnosis.treatments.warningSignsForPatient.length > 0) {
      console.log('WARNING SIGNS - RETURN IF:');
      result.diagnosis.treatments.warningSignsForPatient.forEach(sign => {
        console.log(`   ⚠️  ${sign}`);
      });
      console.log();
    }

    // Agent trace
    console.log('AGENT EXECUTION TRACE:');
    result.agentTrace.forEach(entry => {
      const status = entry.status === 'success' ? '✓' : '✗';
      const experts = entry.expertsCalled.length > 0 ? ` (${entry.expertsCalled.join(', ')})` : '';
      console.log(`   ${status} ${entry.agent}: ${entry.duration}ms${experts}`);
    });
    console.log(`   Total: ${result.totalDuration}ms`);
    console.log();

  } catch (error) {
    console.log('   ✗ Error running diagnosis:', error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.log(error.stack);
    }
  }

  console.log('='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
}

main().catch(console.error);
