import { fetchCortiToken, getCortiAuthUrl, getCortiApiUrl } from './corti-auth';
import type { CortiTask } from './corti-polling';

interface CreateAgentRequest {
  name: string;
  description: string;
  systemPrompt: string;
}

interface SendMessageRequest {
  message: {
    role: 'user';
    parts: Array<{ type: 'text'; text: string } | { type: 'data'; data: unknown }>;
  };
  contextId?: string;
}

export class CortiAgentClient {
  private clientId: string;
  private clientSecret: string;
  private tenant: string;
  private region: 'eu' | 'us';
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(config: { clientId: string; clientSecret: string; tenant: string; region?: 'eu' | 'us' }) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.tenant = config.tenant;
    this.region = config.region ?? 'eu';
  }

  private get agentsUrl() {
    return `${getCortiApiUrl(this.region)}/agents`;
  }

  private async auth(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiry) return;
    const data = await fetchCortiToken(getCortiAuthUrl(this.tenant, this.region), this.clientId, this.clientSecret);
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 30) * 1000;
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      'Tenant-Name': this.tenant,
    };
  }

  async createAgent(req: CreateAgentRequest, ephemeral = true): Promise<{ id: string; name: string }> {
    await this.auth();
    const url = `${this.agentsUrl}${ephemeral ? '?ephemeral=true' : ''}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`Create agent failed: ${res.status} - ${await res.text()}`);
    return res.json();
  }

  async listAgents(): Promise<Array<{ id: string; name: string }>> {
    await this.auth();
    const res = await fetch(this.agentsUrl, { headers: this.headers() });
    if (!res.ok) throw new Error(`List agents failed: ${res.status}`);
    const data = await res.json();
    return data.agents ?? data;
  }

  async deleteAgent(agentId: string): Promise<void> {
    await this.auth();
    await fetch(`${this.agentsUrl}/${agentId}`, { method: 'DELETE', headers: this.headers() });
  }

  async sendTextMessage(agentId: string, text: string, contextId?: string): Promise<CortiTask> {
    const req: SendMessageRequest = {
      message: { role: 'user', parts: [{ type: 'text', text }] },
      contextId,
    };
    return this.sendMessage(agentId, req);
  }

  async sendMessage(agentId: string, req: SendMessageRequest): Promise<CortiTask> {
    await this.auth();
    const body = {
      message: {
        role: req.message.role,
        kind: 'message',
        messageId: crypto.randomUUID(),
        parts: req.message.parts.map(p =>
          p.type === 'text'
            ? { kind: 'text', text: p.text }
            : { kind: 'data', mimeType: 'application/json', data: p.data }
        ),
      },
      contextId: req.contextId,
    };
    const res = await fetch(`${this.agentsUrl}/${agentId}/v1/message:send`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Send message failed: ${res.status} - ${await res.text()}`);
    const data = await res.json();
    return data.task ?? data;
  }

  async getTask(agentId: string, taskId: string): Promise<CortiTask> {
    await this.auth();
    const res = await fetch(`${this.agentsUrl}/${agentId}/tasks/${taskId}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Get task failed: ${res.status}`);
    return res.json();
  }

  extractText(task: CortiTask): string | null {
    if (task.artifacts?.length) {
      for (const artifact of task.artifacts) {
        const part = artifact.parts.find(p => p.kind === 'text');
        if (part?.text) return part.text;
      }
    }
    if (task.history) {
      for (let i = task.history.length - 1; i >= 0; i--) {
        const msg = task.history[i] as { role?: string; parts?: Array<{ kind: string; text?: string }> };
        if (msg.role === 'agent') {
          const part = msg.parts?.find(p => p.kind === 'text');
          if (part?.text) return part.text;
        }
      }
    }
    return null;
  }

  parseJson<T>(task: CortiTask): T | null {
    const text = this.extractText(task);
    if (!text) return null;

    const tryParse = (s: string): T | null => {
      try { return JSON.parse(s); } catch { return null; }
    };

    const fenced = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
    if (fenced) { const r = tryParse(fenced[1]); if (r) return r; }

    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      const r = tryParse(text.slice(start, end + 1));
      if (r) return r;
    }

    return tryParse(text);
  }
}

let instance: CortiAgentClient | null = null;

export function getCortiAgentClient(): CortiAgentClient {
  if (!instance) {
    const clientId = process.env.CORTI_CLIENT_ID;
    const clientSecret = process.env.CORTI_CLIENT_SECRET;
    const tenant = process.env.CORTI_TENANT;
    const region = (process.env.CORTI_ENV as 'eu' | 'us') ?? 'eu';

    if (!clientId || !clientSecret || !tenant) {
      throw new Error('Missing Corti env vars: CORTI_CLIENT_ID, CORTI_CLIENT_SECRET, CORTI_TENANT');
    }

    instance = new CortiAgentClient({ clientId, clientSecret, tenant, region });
  }
  return instance;
}
