#!/usr/bin/env node

/**
 * Simple script to get a encounter ID from the running dev server
 */

const API_BASE_URL = 'http://localhost:3000';

async function getConsultationId() {
  try {
    // Try to fetch the encounters page data
    // This is a hack but should work if the dev server is running

    console.log('Attempting to find a encounter ID...');
    console.log('Note: This requires the dev server to be running.\n');

    // We'll need to use the Convex HTTP API directly
    // For now, let's just use a known test ID or create one

    console.log('Option 1: Use Convex Dashboard');
    console.log('  1. Open https://dashboard.convex.dev');
    console.log('  2. Navigate to your [PRODUCT_NAME] project');
    console.log('  3. Go to Data → encounters table');
    console.log('  4. Copy any _id field\n');

    console.log('Option 2: Create a test encounter');
    console.log('  1. Start dev server: npm run dev');
    console.log('  2. Open http://localhost:3000/patients');
    console.log('  3. Create/select a patient');
    console.log('  4. Record a voice encounter');
    console.log('  5. Copy the ID from the URL\n');

    console.log('Then run:');
    console.log('  npm run test:case-reasoning <CONSULTATION_ID>');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

getConsultationId();
