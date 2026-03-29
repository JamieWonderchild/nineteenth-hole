#!/usr/bin/env node
// Test script for Corti document generation API

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
} catch (e) {
  console.log('No .env.local found');
}

const config = {
  clientId: process.env.CORTI_CLIENT_ID,
  clientSecret: process.env.CORTI_CLIENT_SECRET,
  tenant: process.env.CORTI_TENANT,
  region: process.env.CORTI_ENV || 'eu',
};

async function authenticate() {
  const authUrl = `https://auth.${config.region}.corti.app/realms/${config.tenant}/protocol/openid-connect/token`;

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'client_credentials',
    scope: 'openid',
  });

  const response = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Auth failed: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

// First, create an interaction to get a valid ID
async function createInteraction(token) {
  const url = `https://api.${config.region}.corti.app/v2/interactions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Tenant-Name': config.tenant,
    },
    body: JSON.stringify({
      encounter: {
        identifier: `test-encounter-${Date.now()}`,
        status: 'in-progress',
        type: 'encounter',
        period: { startedAt: new Date().toISOString() },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Create interaction failed: ${response.status} - ${text}`);
  }

  return response.json();
}

// Generate document
async function generateDocument(token, interactionId, templateKey, facts) {
  const url = `https://api.${config.region}.corti.app/v2/interactions/${interactionId}/documents`;

  // Corti expects simplified facts: { text, source, group? }
  const simplifiedFacts = facts.map(f => ({
    text: f.text,
    source: 'core',  // LLM-generated facts
    group: f.group || undefined,
  }));

  const payload = {
    context: [
      { type: 'facts', data: simplifiedFacts },
    ],
    templateKey: templateKey,
    outputLanguage: 'en',
    documentationMode: 'routed_parallel',
  };

  console.log('\n--- Request ---');
  console.log('URL:', url);
  console.log('Payload:', JSON.stringify(payload, null, 2));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Tenant-Name': config.tenant,
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  console.log('\n--- Response ---');
  console.log('Status:', response.status);
  console.log('Body:', responseText);

  if (!response.ok) {
    throw new Error(`Document generation failed: ${response.status}`);
  }

  return JSON.parse(responseText);
}

async function main() {
  const interactionId = process.argv[2];

  console.log('='.repeat(60));
  console.log('Corti Document Generation Test');
  console.log('='.repeat(60));

  console.log('\n1. Authenticating...');
  const token = await authenticate();
  console.log('   Authenticated!');

  let testInteractionId = interactionId;

  if (!testInteractionId) {
    console.log('\n2. Creating test interaction...');
    const interaction = await createInteraction(token);
    testInteractionId = interaction.id || interaction.interactionId;
    console.log('   Interaction ID:', testInteractionId);
  } else {
    console.log('\n2. Using provided interaction ID:', testInteractionId);
  }

  // Sample facts
  const sampleFacts = [
    {
      id: 'fact-1',
      text: '7-year-old male neutered Labrador',
      group: 'demographics',
      groupId: 'demographics',
      isDiscarded: false,
      source: 'transcript',
      createdAt: new Date().toISOString(),
      createdAtTzOffset: null,
      updatedAt: new Date().toISOString(),
      updatedAtTzOffset: null,
      evidence: [],
    },
    {
      id: 'fact-2',
      text: 'Vomiting for 3 days',
      group: 'chief-complaint',
      groupId: 'chief-complaint',
      isDiscarded: false,
      source: 'transcript',
      createdAt: new Date().toISOString(),
      createdAtTzOffset: null,
      updatedAt: new Date().toISOString(),
      updatedAtTzOffset: null,
      evidence: [],
    },
    {
      id: 'fact-3',
      text: 'Decreased appetite',
      group: 'history-of-present-illness',
      groupId: 'hpi',
      isDiscarded: false,
      source: 'transcript',
      createdAt: new Date().toISOString(),
      createdAtTzOffset: null,
      updatedAt: new Date().toISOString(),
      updatedAtTzOffset: null,
      evidence: [],
    },
  ];

  console.log('\n3. Generating SOAP note...');
  try {
    const doc = await generateDocument(token, testInteractionId, 'corti-soap', sampleFacts);
    console.log('\n   SUCCESS!');
    console.log('   Document ID:', doc.id);
    console.log('   Sections:', doc.sections?.length || 0);
    if (doc.sections) {
      doc.sections.forEach(s => {
        console.log(`   - ${s.name || s.key}: ${(s.text || '').substring(0, 100)}...`);
      });
    }
  } catch (err) {
    console.log('\n   FAILED:', err.message);
  }

  console.log('\n4. Generating Client Summary...');
  try {
    const doc = await generateDocument(token, testInteractionId, 'corti-patient-summary', sampleFacts);
    console.log('\n   SUCCESS!');
    console.log('   Document ID:', doc.id);
    console.log('   Sections:', doc.sections?.length || 0);
    if (doc.sections) {
      doc.sections.forEach(s => {
        console.log(`   - ${s.name || s.key}: ${(s.text || '').substring(0, 100)}...`);
      });
    }
  } catch (err) {
    console.log('\n   FAILED:', err.message);
  }
}

main().catch(console.error);
