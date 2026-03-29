#!/usr/bin/env node
/**
 * Test script for Corti Agentic Diagnosis API
 *
 * Usage:
 *   1. Start the dev server: npm run dev
 *   2. Run: node scripts/test-diagnosis.mjs
 *
 * Or with custom URL:
 *   BASE_URL=http://localhost:3000 node scripts/test-diagnosis.mjs
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Sample test facts for a sick dog
const testFacts = [
  { id: 'test-1', text: 'Species: canine', group: 'demographics' },
  { id: 'test-2', text: 'Breed: Labrador Retriever', group: 'demographics' },
  { id: 'test-3', text: 'Age: 7 years', group: 'demographics' },
  { id: 'test-4', text: 'Weight: 32 kg', group: 'demographics' },
  { id: 'test-5', text: 'Vomiting for 2 days', group: 'chief-complaint' },
  { id: 'test-6', text: 'Decreased appetite', group: 'chief-complaint' },
  { id: 'test-7', text: 'Lethargy noted by owner', group: 'history-of-present-illness' },
  { id: 'test-8', text: 'Temperature: 39.8°C (elevated)', group: 'vitals' },
  { id: 'test-9', text: 'Heart rate: 110 bpm', group: 'vitals' },
  { id: 'test-10', text: 'Mild abdominal tenderness on palpation', group: 'physical-exam' },
  { id: 'test-11', text: 'No foreign body palpated', group: 'physical-exam' },
  { id: 'test-12', text: 'Got into garbage 3 days ago per owner', group: 'past-medical-history' },
].map(f => ({
  ...f,
  groupId: f.group,
  isDiscarded: false,
  source: 'test',
  createdAt: new Date().toISOString(),
  createdAtTzOffset: null,
  updatedAt: new Date().toISOString(),
  updatedAtTzOffset: null,
  evidence: []
}));

async function main() {
  console.log('='.repeat(60));
  console.log('CORTI AGENTIC DIAGNOSIS API TEST');
  console.log('='.repeat(60));
  console.log();

  // Step 1: Health check
  console.log('1. Checking endpoint health...');
  try {
    const healthRes = await fetch(`${BASE_URL}/api/corti/diagnose`);
    const health = await healthRes.json();
    console.log('   Status:', health.status);
    console.log('   Agents:', health.agents?.join(', '));
    console.log('   Experts:', health.experts?.join(', '));
  } catch (error) {
    console.log('   Error:', error.message);
    console.log('   Make sure the dev server is running: npm run dev');
    process.exit(1);
  }
  console.log();

  // Step 2: Send diagnosis request
  console.log('2. Sending diagnosis request...');
  console.log('   Patient: 7yo Labrador Retriever');
  console.log('   Chief Complaint: Vomiting for 2 days, decreased appetite');
  console.log('   History: Got into garbage 3 days ago');
  console.log('   Facts:', testFacts.length);
  console.log();

  const startTime = Date.now();

  try {
    const response = await fetch(`${BASE_URL}/api/corti/diagnose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interactionId: `test-${Date.now()}`,
        facts: testFacts,
        patientInfo: {
          species: 'canine',
          breed: 'Labrador Retriever',
          age: '7 years',
          weight: 32,
          weightUnit: 'kg'
        },
        consultationType: 'sick-visit'
      })
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.json();
      console.log('   ERROR:', error.error || error.details || 'Unknown error');
      process.exit(1);
    }

    const result = await response.json();
    console.log(`   Completed in ${duration}ms`);
    console.log();

    // Print results
    console.log('='.repeat(60));
    console.log('DIAGNOSIS RESULTS');
    console.log('='.repeat(60));
    console.log();

    // Triage
    const triage = result.diagnosis.triage;
    console.log('TRIAGE ASSESSMENT:');
    console.log(`   Urgency Level: ${triage.urgencyLevel.toUpperCase()}`);
    console.log(`   Recommended Workflow: ${triage.recommendedWorkflow}`);
    console.log(`   Reasoning: ${triage.reasoning}`);
    if (triage.redFlags?.length > 0) {
      console.log(`   Red Flags: ${triage.redFlags.join(', ')}`);
    }
    console.log();

    // Signalment
    const signalment = result.diagnosis.signalment;
    console.log('SIGNALMENT:');
    console.log(`   Species: ${signalment.species}`);
    console.log(`   Breed: ${signalment.breed}`);
    console.log(`   Age Category: ${signalment.ageCategory} (${signalment.ageInYears} years)`);
    console.log(`   Weight: ${signalment.weightKg} kg`);
    if (signalment.breedPredispositions?.length > 0) {
      console.log(`   Breed Predispositions:`);
      signalment.breedPredispositions.slice(0, 5).forEach(p => console.log(`     - ${p}`));
    }
    console.log();

    // Differentials
    const differentials = result.diagnosis.differentials.differentials;
    console.log('TOP DIFFERENTIALS:');
    differentials.slice(0, 5).forEach((d, i) => {
      console.log(`   ${i + 1}. ${d.condition} [${d.probability.toUpperCase()}]`);
      console.log(`      ${d.reasoning.substring(0, 100)}${d.reasoning.length > 100 ? '...' : ''}`);
      if (d.literatureReferences?.length > 0) {
        console.log(`      Literature: ${d.literatureReferences[0].title || d.literatureReferences[0].pmid}`);
      }
    });
    console.log();

    // Recommended Tests
    const tests = result.diagnosis.tests.recommendedTests;
    console.log('RECOMMENDED TESTS:');
    tests.slice(0, 5).forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.test} [${t.priority.toUpperCase()}]`);
      console.log(`      ${t.rationale.substring(0, 80)}${t.rationale.length > 80 ? '...' : ''}`);
    });
    console.log();

    // Treatments
    const treatments = result.diagnosis.treatments;
    console.log('MEDICATIONS:');
    treatments.medications.slice(0, 3).forEach((m, i) => {
      console.log(`   ${i + 1}. ${m.drug}`);
      console.log(`      Dose: ${m.dose}`);
      console.log(`      Route: ${m.route}, Frequency: ${m.frequency}`);
      console.log(`      Duration: ${m.duration}`);
      if (m.speciesContraindications?.length > 0) {
        console.log(`      ⚠️  Contraindications: ${m.speciesContraindications[0]}`);
      }
    });
    console.log();

    if (treatments.supportiveCare?.length > 0) {
      console.log('SUPPORTIVE CARE:');
      treatments.supportiveCare.forEach(s => console.log(`   • ${s}`));
      console.log();
    }

    if (treatments.patientInstructions?.length > 0) {
      console.log('CLIENT INSTRUCTIONS:');
      treatments.patientInstructions.forEach(i => console.log(`   • ${i}`));
      console.log();
    }

    if (treatments.warningSignsForPatient?.length > 0) {
      console.log('WARNING SIGNS (RETURN IF):');
      treatments.warningSignsForPatient.forEach(w => console.log(`   ⚠️  ${w}`));
      console.log();
    }

    if (treatments.followUpRecommendation) {
      console.log('FOLLOW-UP:');
      console.log(`   ${treatments.followUpRecommendation.timing}: ${treatments.followUpRecommendation.purpose}`);
      console.log();
    }

    // Agent trace
    console.log('AGENT EXECUTION TRACE:');
    result.agentTrace.forEach(entry => {
      const status = entry.status === 'success' ? '✓' : '✗';
      const experts = entry.expertsCalled?.length > 0 ? ` [${entry.expertsCalled.join(', ')}]` : '';
      console.log(`   ${status} ${entry.agent}: ${entry.duration}ms${experts}`);
    });
    console.log(`   ─────────────────────────`);
    console.log(`   Total: ${result.totalDuration}ms`);
    console.log();

  } catch (error) {
    console.log('   ERROR:', error.message);
    if (error.cause) console.log('   Cause:', error.cause);
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
