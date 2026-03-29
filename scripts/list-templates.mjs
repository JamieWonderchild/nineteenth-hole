#!/usr/bin/env node
// Quick script to list available templates from Corti API

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local manually
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
  // Try .env if .env.local doesn't exist
  try {
    const envPath = resolve(process.cwd(), '.env');
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    });
  } catch (e2) {
    console.log('No .env file found, using existing env vars');
  }
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

async function listTemplates(token) {
  const apiUrl = `https://api.${config.region}.corti.app/v2/templates/`;

  const response = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Tenant-Name': config.tenant,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to list templates: ${response.status} - ${text}`);
  }

  return response.json();
}

async function main() {
  console.log('Authenticating with Corti...');
  const token = await authenticate();
  console.log('Authenticated!\n');

  console.log('Fetching templates...\n');
  const templates = await listTemplates(token);

  console.log('Available Templates:');
  console.log('='.repeat(60));

  const templateList = templates.data || templates;

  if (Array.isArray(templateList)) {
    templateList.forEach((t, i) => {
      console.log(`\n${i + 1}. ${t.name || t.key}`);
      if (t.description) console.log(`   Description: ${t.description}`);
      if (t.key) console.log(`   Key: ${t.key}`);
      if (t.status) console.log(`   Status: ${t.status}`);
      if (t.documentationMode) console.log(`   Mode: ${t.documentationMode}`);
      if (t.templateSections && t.templateSections.length > 0) {
        console.log(`   Sections (${t.templateSections.length}):`);
        t.templateSections
          .sort((a, b) => a.sort - b.sort)
          .forEach(s => {
            const sec = s.section || s;
            console.log(`     ${s.sort}. ${sec.name || sec.key}`);
          });
      }
    });
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Total: ${templateList.length} templates`);
  } else {
    console.log(JSON.stringify(templates, null, 2));
  }
}

main().catch(console.error);
