import type {
  CortiConfig,
  AuthToken,
  Interaction,
  Transcript,
  ExtractedFact,
  Document,
  GeneratedDocument,
  MedicalCode,
  Template,
  DocumentGenerationPayload,
} from '@/types/corti';

// Custom error class for document generation with full error details
export class DocumentGenerationError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = 'DocumentGenerationError';
    this.status = status;
    this.details = details;
  }
}

export class CortiClient {
  private config: Required<CortiConfig>;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: CortiConfig) {
    this.config = {
      ...config,
      region: config.region || 'eu',
    };
  }

  private getAuthUrl(): string {
    return `https://auth.${this.config.region}.corti.app/realms/${this.config.tenant}/protocol/openid-connect/token`;
  }

  private getApiBaseUrl(): string {
    return `https://api.${this.config.region}.corti.app`;
  }

  private async authenticate(): Promise<void> {
    // Check if we have a valid token (with 30 second buffer for the 5 min expiry)
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return;
    }

    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: 'client_credentials',
      scope: 'openid',
    });

    const response = await fetch(this.getAuthUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Authentication failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data: AuthToken = await response.json();
    this.accessToken = data.access_token;
    // Token expires in 300 seconds (5 min), use 30 second buffer
    this.tokenExpiry = Date.now() + (data.expires_in - 30) * 1000;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.authenticate();

    const response = await fetch(`${this.getApiBaseUrl()}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  // Get current access token (for WebSocket auth)
  async getAccessToken(): Promise<string> {
    await this.authenticate();
    return this.accessToken!;
  }

  // Get config for external use
  getConfig() {
    return this.config;
  }

  // Test authentication
  async testAuth(): Promise<boolean> {
    try {
      await this.authenticate();
      return true;
    } catch {
      return false;
    }
  }

  // Interaction Management
  async createInteraction(): Promise<Interaction> {
    return this.request<Interaction>('/interactions/', { method: 'POST' });
  }

  // Create interaction with v2 API (returns websocketUrl)
  async createInteractionV2(): Promise<Interaction> {
    await this.authenticate();

    const response = await fetch(
      `${this.getApiBaseUrl()}/v2/interactions/`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Tenant-Name': this.config.tenant,
        },
        body: JSON.stringify({
          encounter: {
            identifier: `provider-encounter-${Date.now()}`,
            status: 'in-progress',
            type: 'encounter',
            period: { startedAt: new Date().toISOString() },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create interaction: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  async getInteraction(id: string): Promise<Interaction> {
    return this.request<Interaction>(`/interactions/${id}`);
  }

  async listInteractions(): Promise<Interaction[]> {
    return this.request<Interaction[]>('/interactions/');
  }

  // Speech to Text (batch)
  async createTranscript(
    interactionId: string,
    audioFile: File | Blob
  ): Promise<Transcript> {
    await this.authenticate();

    const formData = new FormData();
    formData.append('audio', audioFile);

    const response = await fetch(
      `${this.getApiBaseUrl()}/interactions/${interactionId}/transcripts/`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.accessToken}` },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Transcript creation failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  async getTranscript(
    interactionId: string,
    transcriptId: string
  ): Promise<Transcript> {
    return this.request<Transcript>(
      `/interactions/${interactionId}/transcripts/${transcriptId}`
    );
  }

  async getTranscriptStatus(
    interactionId: string,
    transcriptId: string
  ): Promise<{ status: Transcript['status'] }> {
    return this.request<{ status: Transcript['status'] }>(
      `/interactions/${interactionId}/transcripts/${transcriptId}/status`
    );
  }

  // Fact Extraction
  async extractFacts(text: string, outputLanguage = 'en'): Promise<{ id: string; text: string; group: string }[]> {
    await this.authenticate();

    const response = await fetch(`${this.getApiBaseUrl()}/v2/tools/extract-facts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Tenant-Name': this.config.tenant,
      },
      body: JSON.stringify({
        context: [{ type: 'text', text }],
        outputLanguage,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const facts: { text: string; group: string }[] = data.facts ?? [];
    return facts.map((f, i) => ({
      id: `note-fact-${Date.now()}-${i}`,
      text: f.text,
      group: f.group,
    }));
  }

  // Document Generation
  async generateDocument(
    interactionId: string,
    templateId: string,
    data?: Record<string, unknown>
  ): Promise<Document> {
    return this.request<Document>(`/interactions/${interactionId}/documents/`, {
      method: 'POST',
      body: JSON.stringify({ template_id: templateId, data }),
    });
  }

  // Document Generation - Raw payload for v2 API
  async generateDocumentRaw(
    interactionId: string,
    payload: DocumentGenerationPayload
  ): Promise<GeneratedDocument> {
    await this.authenticate();

    const url = `${this.getApiBaseUrl()}/v2/interactions/${interactionId}/documents`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Tenant-Name': this.config.tenant,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = errorText;
      }
      throw new DocumentGenerationError(
        `Document generation failed: ${response.status} ${response.statusText}`,
        response.status,
        errorDetails
      );
    }

    return response.json();
  }

  // Medical Coding
  async predictCodes(text: string, encounterType?: string): Promise<MedicalCode[]> {
    await this.authenticate();

    const icd10System = encounterType === 'inpatient' ? 'icd10cm-inpatient' : 'icd10cm-outpatient';

    const response = await fetch(`${this.getApiBaseUrl()}/v2/tools/coding/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Tenant-Name': this.config.tenant,
      },
      body: JSON.stringify({
        system: [icd10System, 'cpt'],
        context: [{ type: 'text', text }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`predictCodes failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as {
      codes: Array<{
        system: string;
        code: string;
        display: string;
        evidences?: Array<{ contextIndex: number; text: string; start: number; end: number }>;
      }>;
    };

    const systemMap: Record<string, MedicalCode['system']> = {
      'icd10cm-outpatient': 'ICD-10-CM',
      'icd10cm-inpatient': 'ICD-10-CM',
      'icd10pcs': 'ICD-10-PCS',
      'cpt': 'CPT',
    };

    return (data.codes || []).map((c) => ({
      code: c.code,
      system: systemMap[c.system] ?? (c.system as MedicalCode['system']),
      description: c.display,
      confidence: c.evidences?.length ? Math.min(1, c.evidences.length * 0.3) : 0.5,
      evidences: c.evidences?.map(({ text, start, end }) => ({ text, start, end })),
    }));
  }

  // Templates
  async listTemplates(): Promise<Template[]> {
    return this.request<Template[]>('/templates/');
  }

  // Build WebSocket URL for streaming
  buildWebSocketUrl(interactionId: string, websocketUrl?: string): string {
    let wsUrl = websocketUrl;
    if (!wsUrl) {
      wsUrl = `wss://api.${this.config.region}.corti.app/audio-bridge/v2/interactions/${interactionId}/streams?tenant-name=${this.config.tenant}`;
    }
    const separator = wsUrl.includes('?') ? '&' : '?';
    return `${wsUrl}${separator}token=Bearer%20${this.accessToken}`;
  }

  // WebSocket for real-time transcription (basic helper)
  createTranscriptionStream(
    interactionId: string,
    onMessage: (data: Partial<Transcript>) => void,
    onError?: (error: Error) => void
  ): WebSocket {
    const wsUrl = `wss://api.${this.config.region}.corti.app`;
    const ws = new WebSocket(
      `${wsUrl}/interactions/${interactionId}/stream?token=${this.accessToken}`
    );

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (e) {
        onError?.(e as Error);
      }
    };

    ws.onerror = () => {
      onError?.(new Error('WebSocket error'));
    };

    return ws;
  }
}

// Singleton instance factory
let clientInstance: CortiClient | null = null;

export function getCortiClient(config?: CortiConfig): CortiClient {
  if (!clientInstance && config) {
    clientInstance = new CortiClient(config);
  }
  if (!clientInstance) {
    throw new Error('Corti client not initialized. Provide config first.');
  }
  return clientInstance;
}

// Helper to create client from environment
export function createCortiClientFromEnv(): CortiClient {
  const clientId = process.env.CORTI_CLIENT_ID;
  const clientSecret = process.env.CORTI_CLIENT_SECRET;
  const tenant = process.env.CORTI_TENANT?.trim();
  const region = (process.env.CORTI_ENV as 'eu' | 'us') || 'eu';

  if (!clientId || !clientSecret || !tenant) {
    throw new Error('Missing required Corti environment variables: CORTI_CLIENT_ID, CORTI_CLIENT_SECRET, CORTI_TENANT');
  }

  return new CortiClient({
    clientId,
    clientSecret,
    tenant,
    region,
  });
}
