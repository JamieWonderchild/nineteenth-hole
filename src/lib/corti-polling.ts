export interface CortiTask {
  id: string;
  status?: { state: string; message?: unknown };
  artifacts?: Array<{ parts: Array<{ kind: string; text?: string }> }>;
  history?: unknown[];
}

interface TaskPoller {
  getTask(agentId: string, taskId: string): Promise<CortiTask>;
}

export interface PollResult {
  task: CortiTask;
  timedOut: boolean;
  failed: boolean;
}

export async function pollCortiTask(
  client: TaskPoller,
  agentId: string,
  task: CortiTask,
  options: { maxAttempts?: number; pollInterval?: number; label?: string } = {}
): Promise<PollResult> {
  const { maxAttempts = 150, pollInterval = 300, label = 'Task' } = options;
  let attempts = 0;
  let current = task;

  while (attempts < maxAttempts) {
    const state = current.status?.state;

    if (state === 'completed') return { task: current, timedOut: false, failed: false };
    if (state === 'failed') {
      console.error(`[${label}] Task failed`);
      return { task: current, timedOut: false, failed: true };
    }

    attempts++;
    await new Promise(r => setTimeout(r, pollInterval));

    try {
      current = await client.getTask(agentId, current.id);
    } catch {
      return { task: current, timedOut: false, failed: true };
    }
  }

  console.error(`[${label}] Timed out`);
  return { task: current, timedOut: true, failed: false };
}
