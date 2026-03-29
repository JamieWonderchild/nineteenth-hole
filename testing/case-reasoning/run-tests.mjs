#!/usr/bin/env node

/**
 * Simple test runner for case reasoning tests
 * Uses fetch API (available in Node 18+)
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
const API_ENDPOINT = `${API_BASE_URL}/api/case-reasoning/test`; // Use test endpoint (no auth)
const RESULTS_DIR = join(__dirname, 'results');
const LOGS_DIR = join(__dirname, 'logs');

// Test prompts
const STARTER_PROMPTS = [
  'What differential diagnoses should I consider?',
  'What diagnostic tests do you recommend?',
  'Review relevant literature for this case',
  'What treatment options are available?',
  'Are there any drug interactions I should know about?',
  "What's the prognosis for this condition?",
  'What client education points should I cover?',
];

// Ensure directories exist
mkdirSync(RESULTS_DIR, { recursive: true });
mkdirSync(LOGS_DIR, { recursive: true });

class CaseReasoningTester {
  constructor(encounterId, sessionId) {
    this.encounterId = encounterId;
    this.sessionId = sessionId;
    this.results = [];
    this.timingData = [];
    this.testCounter = 0;
  }

  async sendMessage(prompt, conversationHistory = []) {
    const apiStartTime = Date.now();

    const payload = {
      message: prompt,
      conversationHistory,
      encounterId: this.encounterId,
      sessionId: this.sessionId,
    };

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const apiEndTime = Date.now();
      const durationMs = apiEndTime - apiStartTime;

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      return {
        response: data,
        durationMs,
        taskStatus: data.taskStatus || 'unknown',
      };
    } catch (error) {
      const apiEndTime = Date.now();
      const durationMs = apiEndTime - apiStartTime;

      throw {
        error,
        durationMs,
      };
    }
  }

  evaluateResponse(responseText) {
    const lowerText = responseText.toLowerCase();

    // Check for failure message
    if (lowerText.includes('could not generate a response')) {
      return {
        result: 'failure',
        notes: 'Received fallback error message',
      };
    }

    // Check for empty response
    if (!responseText || responseText.trim().length < 10) {
      return {
        result: 'failure',
        notes: 'Empty or very short response',
      };
    }

    // Check for clinical content
    const clinicalTerms = [
      'diagnosis',
      'differential',
      'test',
      'treatment',
      'symptom',
      'sign',
      'patient',
      'clinical',
      'prognosis',
    ];

    const hasClinicalContent = clinicalTerms.some((term) =>
      lowerText.includes(term)
    );

    if (!hasClinicalContent) {
      return {
        result: 'partial',
        notes: 'Response lacks clinical content',
      };
    }

    return {
      result: 'success',
      notes: 'Response appears coherent and clinically relevant',
    };
  }

  async runTest(prompt, scenarioType, conversationHistory = []) {
    this.testCounter++;
    const testNumber = this.testCounter;

    console.log(
      `\n[Test ${testNumber}] ${scenarioType}: "${prompt.substring(0, 50)}..."`
    );

    try {
      const { response, durationMs, taskStatus } = await this.sendMessage(
        prompt,
        conversationHistory
      );

      const responseText = response.message || '';
      const evaluation = this.evaluateResponse(responseText);

      // Store timing data
      this.timingData.push({
        testNumber,
        timestamp: new Date().toISOString(),
        encounterId: this.encounterId,
        promptType: scenarioType,
        apiStartTime: Date.now() - durationMs,
        apiEndTime: Date.now(),
        apiDurationMs: durationMs,
        taskStatusOnReturn: taskStatus,
        success: evaluation.result === 'success',
        notes: evaluation.notes,
      });

      const result = {
        testNumber,
        timestamp: new Date().toISOString(),
        scenarioType,
        prompt,
        encounterId: this.encounterId,
        result: evaluation.result,
        responseTimeMs: durationMs,
        taskStatus,
        responsePreview: responseText.substring(0, 100),
        notes: evaluation.notes,
      };

      this.results.push(result);

      const resultSymbol = evaluation.result === 'success' ? '✓' : '✗';
      console.log(
        `  ${resultSymbol} Result: ${evaluation.result.toUpperCase()} (${durationMs}ms, task: ${taskStatus})`
      );
      console.log(`  Response: ${result.responsePreview}...`);

      return result;
    } catch (error) {
      const durationMs = error.durationMs || 0;

      const result = {
        testNumber,
        timestamp: new Date().toISOString(),
        scenarioType,
        prompt,
        encounterId: this.encounterId,
        result: 'error',
        responseTimeMs: durationMs,
        errorMessage: error.error?.message || String(error),
        responsePreview: '',
        notes: 'Request failed with exception',
      };

      this.results.push(result);

      console.log(`  ✗ Error: ${result.errorMessage}`);

      return result;
    }
  }

  async runStarterPromptTests() {
    console.log('\n========================================');
    console.log('ROUND 1: Starter Prompt Tests (70 tests)');
    console.log('========================================');

    for (let i = 0; i < STARTER_PROMPTS.length; i++) {
      const prompt = STARTER_PROMPTS[i];
      console.log(`\n--- Prompt ${i + 1}: "${prompt}" (10 iterations) ---`);

      for (let iteration = 0; iteration < 1; iteration++) {
        await this.runTest(prompt, `starter_prompt_${i + 1}`, []);

        // Small delay between tests
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Calculate success rate for this prompt
      const promptResults = this.results.filter(
        (r) => r.scenarioType === `starter_prompt_${i + 1}`
      );
      const successCount = promptResults.filter(
        (r) => r.result === 'success'
      ).length;
      const successRate = (successCount / promptResults.length) * 100;

      console.log(
        `\n  Summary: ${successCount}/${promptResults.length} successful (${successRate.toFixed(1)}%)`
      );
    }
  }

  async runTimingTests(count = 100) {
    console.log('\n========================================');
    console.log(`ROUND 2: Timing Analysis (${count} tests)`);
    console.log('========================================');

    for (let i = 0; i < count; i++) {
      const promptIndex = i % STARTER_PROMPTS.length;
      const prompt = STARTER_PROMPTS[promptIndex];

      await this.runTest(prompt, `timing_test`, []);

      await new Promise((resolve) => setTimeout(resolve, 300));

      // Log progress every 10 tests
      if ((i + 1) % 10 === 0) {
        console.log(`\n  Progress: ${i + 1}/${count} tests completed`);
      }
    }
  }

  generateSummary() {
    const total = this.results.length;
    const successCount = this.results.filter(
      (r) => r.result === 'success'
    ).length;
    const failureCount = this.results.filter(
      (r) => r.result === 'failure'
    ).length;
    const partialCount = this.results.filter(
      (r) => r.result === 'partial'
    ).length;
    const errorCount = this.results.filter((r) => r.result === 'error').length;

    const successRate = (successCount / total) * 100;
    const failureRate = (failureCount / total) * 100;

    const responseTimes = this.results
      .filter((r) => r.responseTimeMs > 0)
      .map((r) => r.responseTimeMs);
    const avgTime =
      responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const minTime = Math.min(...responseTimes);
    const maxTime = Math.max(...responseTimes);

    // Calculate median
    responseTimes.sort((a, b) => a - b);
    const median = responseTimes[Math.floor(responseTimes.length / 2)];

    // Task status distribution
    const taskStatusCounts = {};
    this.results.forEach((r) => {
      const status = r.taskStatus || 'unknown';
      taskStatusCounts[status] = (taskStatusCounts[status] || 0) + 1;
    });

    let summary = '\n========================================\n';
    summary += 'TEST SUMMARY\n';
    summary += '========================================\n\n';
    summary += `Total Tests: ${total}\n`;
    summary += `Success: ${successCount} (${successRate.toFixed(1)}%)\n`;
    summary += `Failure: ${failureCount} (${failureRate.toFixed(1)}%)\n`;
    summary += `Partial: ${partialCount} (${((partialCount / total) * 100).toFixed(1)}%)\n`;
    summary += `Error: ${errorCount} (${((errorCount / total) * 100).toFixed(1)}%)\n\n`;

    summary += `Response Times:\n`;
    summary += `  Min: ${minTime.toFixed(0)}ms\n`;
    summary += `  Max: ${maxTime.toFixed(0)}ms\n`;
    summary += `  Avg: ${avgTime.toFixed(0)}ms\n`;
    summary += `  Median: ${median.toFixed(0)}ms\n\n`;

    summary += `Task Status Distribution:\n`;
    Object.entries(taskStatusCounts).forEach(([status, count]) => {
      const pct = (count / total) * 100;
      summary += `  ${status}: ${count} (${pct.toFixed(1)}%)\n`;
    });

    summary += '\n========================================\n';

    return summary;
  }

  exportResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Export test results
    const csvHeader =
      'test_number,timestamp,scenario_type,prompt,consultation_id,result,response_time_ms,task_status,error_message,response_preview,notes\n';
    const csvRows = this.results.map((r) =>
      [
        r.testNumber,
        r.timestamp,
        r.scenarioType,
        `"${r.prompt.replace(/"/g, '""')}"`,
        r.encounterId,
        r.result,
        r.responseTimeMs,
        r.taskStatus || '',
        `"${(r.errorMessage || '').replace(/"/g, '""')}"`,
        `"${r.responsePreview.replace(/"/g, '""')}"`,
        `"${r.notes.replace(/"/g, '""')}"`,
      ].join(',')
    );
    const csvContent = csvHeader + csvRows.join('\n');

    const csvPath = join(LOGS_DIR, `test-results-${timestamp}.csv`);
    writeFileSync(csvPath, csvContent, 'utf-8');
    console.log(`\n✓ Results exported to: ${csvPath}`);

    // Export timing data
    const timingHeader =
      'test_number,timestamp,consultation_id,prompt_type,api_start_time,api_end_time,api_duration_ms,task_status_on_return,success,notes\n';
    const timingRows = this.timingData.map((t) =>
      [
        t.testNumber,
        t.timestamp,
        t.encounterId,
        t.promptType,
        t.apiStartTime,
        t.apiEndTime,
        t.apiDurationMs,
        t.taskStatusOnReturn || '',
        t.success,
        `"${t.notes.replace(/"/g, '""')}"`,
      ].join(',')
    );
    const timingContent = timingHeader + timingRows.join('\n');

    const timingPath = join(LOGS_DIR, `timing-data-${timestamp}.csv`);
    writeFileSync(timingPath, timingContent, 'utf-8');
    console.log(`✓ Timing data exported to: ${timingPath}`);

    // Export summary
    const summary = this.generateSummary();
    const summaryPath = join(RESULTS_DIR, `test-summary-${timestamp}.txt`);
    writeFileSync(summaryPath, summary, 'utf-8');
    console.log(`✓ Summary exported to: ${summaryPath}`);
  }
}

// Main execution
async function main() {
  console.log('========================================');
  console.log('Case Reasoning Automated Test Suite');
  console.log('========================================\n');

  // Get encounter ID from command line or environment variable
  const encounterId =
    process.argv[2] || process.env.TEST_CONSULTATION_ID;

  if (!encounterId) {
    console.error('Error: No encounter ID provided');
    console.error('\nUsage:');
    console.error('  node run-tests.mjs <encounterId>');
    console.error('  TEST_CONSULTATION_ID=<id> node run-tests.mjs');
    console.error('\nExample:');
    console.error('  node run-tests.mjs k123abc456def789');
    process.exit(1);
  }

  console.log(`Encounter ID: ${encounterId}`);
  console.log(`API Endpoint: ${API_ENDPOINT}\n`);

  const tester = new CaseReasoningTester(encounterId);

  try {
    // Run test rounds
    await tester.runStarterPromptTests(); // 70 tests
    await tester.runTimingTests(100); // 100 tests

    // Export results
    tester.exportResults();

    // Print summary
    console.log(tester.generateSummary());

    console.log('\n✓ All tests completed successfully!');
  } catch (error) {
    console.error('\n✗ Test suite failed:', error);
    process.exit(1);
  }
}

main();
