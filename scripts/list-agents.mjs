#!/usr/bin/env node
/**
 * List all Corti agents created for this project
 */

const CORTI_CLIENT_ID = process.env.CORTI_CLIENT_ID;
const CORTI_CLIENT_SECRET = process.env.CORTI_CLIENT_SECRET;
const CORTI_TENANT = process.env.CORTI_TENANT;
const CORTI_ENV = process.env.CORTI_ENV || 'eu';

const AUTH_URL = `https://auth.${CORTI_ENV}.corti.app/realms/${CORTI_TENANT}/protocol/openid-connect/token`;
const AGENTS_URL = `https://api.${CORTI_ENV}.corti.app/agents`;

async function getAccessToken() {
  const response = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CORTI_CLIENT_ID,
      client_secret: CORTI_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    throw new Error(`Auth failed: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function listAgents(token) {
  const response = await fetch(AGENTS_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Tenant-Name': CORTI_TENANT,
    },
  });

  if (!response.ok) {
    throw new Error(`List agents failed: ${response.status}`);
  }

  return response.json();
}

async function main() {
  console.log('Fetching Corti agents...\n');

  const token = await getAccessToken();
  const data = await listAgents(token);
  const agents = data.agents || data;

  // Filter to our vet agents
  const vetAgents = agents.filter(a => a.name.startsWith('vet-'));

  console.log(`Found ${vetAgents.length} veterinary agents:\n`);
  console.log('ID                                    | Name                | Created');
  console.log('-'.repeat(80));

  for (const agent of vetAgents) {
    const created = agent.createdAt ? new Date(agent.createdAt).toLocaleDateString() : 'N/A';
    console.log(`${agent.id} | ${agent.name.padEnd(19)} | ${created}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('AGENT DETAILS:');
  console.log('='.repeat(80));

  for (const agent of vetAgents) {
    console.log(`\n[${agent.name}]`);
    console.log(`  ID: ${agent.id}`);
    console.log(`  Description: ${agent.description?.substring(0, 80) || 'N/A'}...`);
    if (agent.experts?.length > 0) {
      console.log(`  Experts: ${agent.experts.map(e => e.name || e).join(', ')}`);
    }
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
