// FHIR Client Service
// Wraps Epic FHIR R4 API calls.
// Tokens come from the SMART on FHIR OAuth flow (/api/fhir/launch → /api/fhir/callback).

export interface FhirTokenSet {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  patient?: string;         // Epic patient FHIR ID (if returned at token time)
  encounter?: string;       // Epic encounter FHIR ID (if returned at token time)
  issued_at: number;        // Date.now() when token was stored
}

export interface FhirDocumentReference {
  resourceType: 'DocumentReference';
  status: 'current';
  type: {
    coding: Array<{
      system: string;
      code: string;
      display?: string;
    }>;
    text?: string;
  };
  subject: { reference: string };           // Patient/xxx
  context?: {
    encounter?: Array<{ reference: string }>; // Encounter/xxx
  };
  date?: string;                             // ISO 8601
  author?: Array<{ reference: string }>;     // Practitioner/xxx
  content: Array<{
    attachment: {
      contentType: string;
      data: string;     // base64-encoded document text
      title?: string;
    };
  }>;
}

export class FhirClient {
  private baseUrl: string;
  private token: FhirTokenSet;

  constructor(baseUrl: string, token: FhirTokenSet) {
    // Strip trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
  }

  isTokenExpired(): boolean {
    const expiresAt = this.token.issued_at + this.token.expires_in * 1000;
    return Date.now() > expiresAt - 30_000; // 30-second buffer
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token.access_token}`,
        Accept: 'application/fhir+json',
        'Content-Type': 'application/fhir+json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`FHIR ${options.method ?? 'GET'} ${path} → ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  // ─── Patient ──────────────────────────────────────────────────────────────

  async getPatient(patientId: string) {
    return this.request<Record<string, unknown>>(`/Patient/${patientId}`);
  }

  /** Pull basic demographics for pre-filling a new patient record */
  async getPatientDemographics(patientId: string): Promise<{
    name?: string;
    dateOfBirth?: string;
    sex?: string;
    mrn?: string;
    allergies?: string[];
  }> {
    const pt = await this.getPatient(patientId) as Record<string, unknown>;

    // Extract human name
    const nameEntry = (pt.name as Array<Record<string, unknown>> | undefined)?.[0];
    const given = (nameEntry?.given as string[] | undefined)?.join(' ') ?? '';
    const family = (nameEntry?.family as string) ?? '';
    const name = [given, family].filter(Boolean).join(' ') || undefined;

    // Sex
    const sex = (pt.gender as string) ?? undefined;

    // Date of birth
    const dateOfBirth = (pt.birthDate as string) ?? undefined;

    // MRN from identifiers
    const identifiers = pt.identifier as Array<Record<string, unknown>> | undefined;
    const mrnEntry = identifiers?.find(
      (id) => (id.type as Record<string, unknown>)?.text === 'MRN'
        || (id.system as string)?.includes('mrn')
    );
    const mrn = (mrnEntry?.value as string) ?? undefined;

    return { name, dateOfBirth, sex, mrn };
  }

  // ─── DocumentReference (note push) ────────────────────────────────────────

  async pushNote(payload: FhirDocumentReference): Promise<{ id: string }> {
    return this.request<{ id: string }>('/DocumentReference', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // ─── Encounter ────────────────────────────────────────────────────────────

  async getEncounter(encounterId: string) {
    return this.request<Record<string, unknown>>(`/Encounter/${encounterId}`);
  }
}

// ─── SMART on FHIR helpers ────────────────────────────────────────────────────

/**
 * Build the SMART authorization redirect URL.
 * Implements PKCE (S256) as required by Epic.
 */
export async function buildSmartAuthUrl(params: {
  issuer: string;           // e.g. https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
  clientId: string;
  redirectUri: string;
  scope: string;
  launch?: string;          // Present in EHR-embedded launch
  codeVerifier: string;     // Pre-generated PKCE verifier
  state: string;
}): Promise<string> {
  // Fetch the SMART well-known configuration to get the authorization endpoint
  const wellKnown = await fetch(
    `${params.issuer.replace(/\/$/, '')}/.well-known/smart-configuration`
  ).then((r) => r.json()) as { authorization_endpoint: string };

  const codeChallenge = await generateS256Challenge(params.codeVerifier);

  const query = new URLSearchParams({
    response_type: 'code',
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: params.scope,
    state: params.state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    aud: params.issuer,
  });

  if (params.launch) {
    query.set('launch', params.launch);
  }

  return `${wellKnown.authorization_endpoint}?${query.toString()}`;
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeCodeForTokens(params: {
  issuer: string;
  clientId: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}): Promise<FhirTokenSet> {
  const wellKnown = await fetch(
    `${params.issuer.replace(/\/$/, '')}/.well-known/smart-configuration`
  ).then((r) => r.json()) as { token_endpoint: string };

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    code: params.code,
    code_verifier: params.codeVerifier,
  });

  const res = await fetch(wellKnown.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json() as Omit<FhirTokenSet, 'issued_at'>;
  return { ...data, issued_at: Date.now() };
}

// ─── PKCE helpers ─────────────────────────────────────────────────────────────

/** Generate a cryptographically random code verifier (43–128 chars, URL-safe) */
export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/** Compute S256 code challenge from verifier */
async function generateS256Challenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

function base64UrlEncode(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** Build a DocumentReference payload from plain-text note sections */
export function buildDocumentReference(params: {
  patientFhirId: string;
  encounterFhirId?: string;
  practitionerFhirId?: string;
  docTitle: string;
  noteText: string;
  /** LOINC code — defaults to 11488-4 (Consultation note) */
  loincCode?: string;
}): FhirDocumentReference {
  const {
    patientFhirId,
    encounterFhirId,
    practitionerFhirId,
    docTitle,
    noteText,
    loincCode = '11488-4',
  } = params;

  const loincDisplay: Record<string, string> = {
    '11488-4': 'Consultation note',
    '18842-5': 'Discharge summary',
    '34117-2': 'History and physical note',
    '51847-2': 'Evaluation + Plan note',
    '34748-4': 'Telephone encounter note',
  };

  const encoded = Buffer.from(noteText, 'utf-8').toString('base64');

  const doc: FhirDocumentReference = {
    resourceType: 'DocumentReference',
    status: 'current',
    type: {
      coding: [
        {
          system: 'http://loinc.org',
          code: loincCode,
          display: loincDisplay[loincCode] ?? 'Clinical note',
        },
      ],
      text: docTitle,
    },
    subject: { reference: `Patient/${patientFhirId}` },
    date: new Date().toISOString(),
    content: [
      {
        attachment: {
          contentType: 'text/plain',
          data: encoded,
          title: docTitle,
        },
      },
    ],
  };

  if (encounterFhirId) {
    doc.context = {
      encounter: [{ reference: `Encounter/${encounterFhirId}` }],
    };
  }

  if (practitionerFhirId) {
    doc.author = [{ reference: `Practitioner/${practitionerFhirId}` }];
  }

  return doc;
}
