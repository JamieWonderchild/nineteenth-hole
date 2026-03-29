/**
 * Automated Case Reasoning Test Suite
 *
 * This script programmatically tests the case reasoning API endpoint
 * to quantify failure rates and identify timing patterns.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
const API_ENDPOINT = `${API_BASE_URL}/api/case-reasoning/chat`;
const RESULTS_DIR = join(process.cwd(), 'testing/case-reasoning/results');
const LOGS_DIR = join(process.cwd(), 'testing/case-reasoning/logs');

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

// Test result types
type TestResult = {
  testNumber: number;
  timestamp: string;
  scenarioType: string;
  prompt: string;
  encounterId: string;
  result: 'success' | 'failure' | 'partial' | 'error';
  responseTimeMs: number;
  taskStatus?: string;
  errorMessage?: string;
  responsePreview: string;
  notes: string;
};

// Timing data
type TimingData = {
  testNumber: number;
  timestamp: string;
  encounterId: string;
  promptType: string;
  apiStartTime: number;
  apiEndTime: number;
  apiDurationMs: number;
  taskStatusOnReturn?: string;
  success: boolean;
  notes: string;
};

class CaseReasoningTester {
  private results: TestResult[] = [];
  private timingData: TimingData[] = [];
  private testCounter = 0;

  constructor(private encounterId: string, private sessionId?: string) {
    // Ensure directories exist
    try {
      mkdirSync(RESULTS_DIR, { recursive: true });
      mkdirSync(LOGS_DIR, { recursive: true });
    } catch (error) {
      // Directories might already exist
    }
  }

  /**
   * Send a message to the case reasoning API
   */
  async sendMessage(
    prompt: string,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): Promise<{
    response: any;
    durationMs: number;
    taskStatus?: string;
  }> {
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

  /**
   * Evaluate if a response is successful
   */
  evaluateResponse(responseText: string): {
    result: 'success' | 'failure' | 'partial';
    notes: string;
  } {
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

    // Check for generic response (doesn't reference facts)
    // This is a heuristic - responses that mention clinical terms are likely good
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

  /**
   * Run a single test
   */
  async runTest(
    prompt: string,
    scenarioType: string,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): Promise<TestResult> {
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

      const result: TestResult = {
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

      console.log(
        `  ✓ Result: ${evaluation.result.toUpperCase()} (${durationMs}ms, task: ${taskStatus})`
      );
      console.log(`  ✓ Response preview: ${result.responsePreview}...`);

      return result;
    } catch (error: any) {
      const durationMs = error.durationMs || 0;

      const result: TestResult = {
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

  /**
   * Run all starter prompt tests (70 tests = 7 prompts × 10 iterations)
   */
  async runStarterPromptTests(): Promise<void> {
    console.log('\n========================================');
    console.log('ROUND 1: Starter Prompt Tests (70 tests)');
    console.log('========================================');

    for (let i = 0; i < STARTER_PROMPTS.length; i++) {
      const prompt = STARTER_PROMPTS[i];
      console.log(`\n--- Prompt ${i + 1}: "${prompt}" (10 iterations) ---`);

      for (let iteration = 0; iteration < 10; iteration++) {
        await this.runTest(prompt, `starter_prompt_${i + 1}`, []);

        // Small delay between tests to avoid rate limiting
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

  /**
   * Run conversation continuity tests
   */
  async runConversationTests(): Promise<void> {
    console.log('\n========================================');
    console.log('ROUND 2: Conversation Continuity (15 tests)');
    console.log('========================================');

    // 3-message conversations (5 tests)
    for (let i = 0; i < 5; i++) {
      console.log(`\n--- 3-Message Conversation ${i + 1} ---`);

      const history: Array<{ role: string; content: string }> = [];

      // First message
      const msg1 = STARTER_PROMPTS[0];
      const result1 = await this.runTest(msg1, 'conversation_3msg', history);
      history.push(
        { role: 'user', content: msg1 },
        { role: 'assistant', content: result1.responsePreview }
      );

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Second message
      const msg2 = 'Can you elaborate on that?';
      const result2 = await this.runTest(msg2, 'conversation_3msg', history);
      history.push(
        { role: 'user', content: msg2 },
        { role: 'assistant', content: result2.responsePreview }
      );

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Third message
      const msg3 = 'What about treatment options?';
      await this.runTest(msg3, 'conversation_3msg', history);

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // 5-message conversations (5 tests)
    for (let i = 0; i < 5; i++) {
      console.log(`\n--- 5-Message Conversation ${i + 1} ---`);

      const history: Array<{ role: string; content: string }> = [];

      for (let msgNum = 0; msgNum < 5; msgNum++) {
        const prompt =
          msgNum === 0
            ? STARTER_PROMPTS[1]
            : `Follow-up question ${msgNum}`;
        const result = await this.runTest(
          prompt,
          'conversation_5msg',
          history
        );
        history.push(
          { role: 'user', content: prompt },
          { role: 'assistant', content: result.responsePreview }
        );

        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // 10-message conversations (5 tests)
    for (let i = 0; i < 5; i++) {
      console.log(`\n--- 10-Message Conversation ${i + 1} ---`);

      const history: Array<{ role: string; content: string }> = [];

      for (let msgNum = 0; msgNum < 10; msgNum++) {
        const prompt =
          msgNum === 0
            ? STARTER_PROMPTS[2]
            : `Follow-up question ${msgNum}`;
        const result = await this.runTest(
          prompt,
          'conversation_10msg',
          history
        );
        history.push(
          { role: 'user', content: prompt },
          { role: 'assistant', content: result.responsePreview }
        );

        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  /**
   * Run timing analysis tests
   */
  async runTimingTests(count: number = 100): Promise<void> {
    console.log('\n========================================');
    console.log(`ROUND 4: Timing Analysis (${count} tests)`);
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

  /**
   * Generate summary statistics
   */
  generateSummary(): string {
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

    // Task status distribution
    const taskStatusCounts: Record<string, number> = {};
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
    summary += `  Avg: ${avgTime.toFixed(0)}ms\n\n`;

    summary += `Task Status Distribution:\n`;
    Object.entries(taskStatusCounts).forEach(([status, count]) => {
      const pct = (count / total) * 100;
      summary += `  ${status}: ${count} (${pct.toFixed(1)}%)\n`;
    });

    summary += '\n========================================\n';

    return summary;
  }

  /**
   * Export results to CSV
   */
  exportResults(): void {
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

/**
 * Main execution
 */
async function main() {
  console.log('========================================');
  console.log('Case Reasoning Automated Test Suite');
  console.log('========================================\n');

  // Get encounter ID from command line or use test ID
  const encounterId =
    process.argv[2] || process.env.TEST_CONSULTATION_ID;

  if (!encounterId) {
    console.error('Error: No encounter ID provided');
    console.error('Usage: npm run test:case-reasoning <encounterId>');
    console.error(
      'Or set TEST_CONSULTATION_ID environment variable'
    );
    process.exit(1);
  }

  console.log(`Encounter ID: ${encounterId}`);
  console.log(`API Endpoint: ${API_ENDPOINT}\n`);

  const tester = new CaseReasoningTester(encounterId);

  try {
    // Run all test rounds
    await tester.runStarterPromptTests(); // 70 tests
    await tester.runConversationTests(); // 15 tests
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

// Run if executed directly
if (require.main === module) {
  main();
}

export { CaseReasoningTester };
