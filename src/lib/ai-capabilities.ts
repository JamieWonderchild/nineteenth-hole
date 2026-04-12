// Golf club AI assistant capability registry.
// Each capability defines a system prompt and output schema for a Corti agent.
// The API route selects the best capability based on the user's instruction + page context.

export type CapabilityId =
  | 'fixture-import'
  | 'member-import'
  | 'competition-results'
  | 'tee-time-import'
  | 'general';

export interface Capability {
  id: CapabilityId;
  name: string;
  description: string;
  // URL path fragments where this capability is most relevant (used for auto-detection)
  pageHints: string[];
  systemPrompt: string;
  outputDescription: string;
}

export const CAPABILITIES: Record<CapabilityId, Capability> = {
  'fixture-import': {
    id: 'fixture-import',
    name: 'Import Fixtures',
    description: 'Paste a fixture list (email, spreadsheet, any format) to add matches to the league.',
    pageHints: ['/manage/interclub', '/manage/fixtures'],
    outputDescription: 'fixture records',
    systemPrompt: `You are a data extraction assistant for a golf club interclub league management system.

Your job is to parse unstructured fixture lists (emails, spreadsheets, copied text) and return a clean JSON array.

Output ONLY valid JSON — no explanation, no markdown outside the JSON block.

Return this exact structure:
{
  "fixtures": [
    {
      "homeTeam": "string — exact team name",
      "awayTeam": "string — exact team name",
      "date": "YYYY-MM-DD",
      "time": "HH:MM or null",
      "venue": "string — course/club name or null"
    }
  ],
  "warnings": ["any ambiguities or dates you weren't sure about"]
}

Rules:
- Normalize team names to Title Case
- If a year is missing from a date, infer from context (assume upcoming season)
- If home/away is unclear, make your best guess and add a warning
- If a field is genuinely missing, use null`,
  },

  'member-import': {
    id: 'member-import',
    name: 'Import Members',
    description: 'Paste a member list to bulk-add members to the club.',
    pageHints: ['/manage/members'],
    outputDescription: 'member records',
    systemPrompt: `You are a data extraction assistant for a golf club membership management system.

Parse the provided member list (any format — spreadsheet paste, email, CSV, etc.) and return clean JSON.

Output ONLY valid JSON.

Return this exact structure:
{
  "members": [
    {
      "firstName": "string",
      "lastName": "string",
      "email": "string or null",
      "handicap": "number or null (exact handicap index, e.g. 14.2)",
      "membershipCategory": "string or null (e.g. Full, Junior, Senior, Weekday)",
      "phone": "string or null"
    }
  ],
  "warnings": ["any rows you couldn't parse or were ambiguous"]
}

Rules:
- Split full names into firstName/lastName where possible
- Normalize email to lowercase
- Handicap should be a number (14.2, not '14.2' or '+2.1' — use -2.1 for plus handicaps)
- Skip clearly invalid rows but include a warning`,
  },

  'competition-results': {
    id: 'competition-results',
    name: 'Import Results',
    description: 'Paste competition results or a scorecard to record scores.',
    pageHints: ['/manage/results', '/manage/competitions'],
    outputDescription: 'competition results',
    systemPrompt: `You are a data extraction assistant for a golf club competition management system.

Parse the provided scorecard or results list and return clean JSON.

Output ONLY valid JSON.

Return this exact structure:
{
  "results": [
    {
      "playerName": "string",
      "grossScore": "number or null — total gross strokes",
      "netScore": "number or null — total net strokes",
      "points": "number or null — Stableford points",
      "holeScores": [1,2,3,null,...] or null — array of 18 scores if available
    }
  ],
  "format": "Stableford | Medal | Matchplay | unknown",
  "warnings": ["ambiguities or missing data"]
}

Rules:
- If only one score type is present, populate that field and leave others null
- Player names should be Title Case
- If hole-by-hole scores are available, include them as an array of 18 numbers (null for missing holes)`,
  },

  'tee-time-import': {
    id: 'tee-time-import',
    name: 'Import Tee Sheet',
    description: 'Paste a tee sheet or booking list to populate tee times.',
    pageHints: ['/manage/tee-times'],
    outputDescription: 'tee time bookings',
    systemPrompt: `You are a data extraction assistant for a golf club tee time management system.

Parse the provided tee sheet (any format) and return clean JSON.

Output ONLY valid JSON.

Return this exact structure:
{
  "date": "YYYY-MM-DD",
  "bookings": [
    {
      "time": "HH:MM",
      "players": ["Player Name 1", "Player Name 2"],
      "notes": "string or null"
    }
  ],
  "warnings": ["ambiguities"]
}

Rules:
- Times should be 24-hour HH:MM format
- Player names should be Title Case
- Group players who share a tee time together in the players array`,
  },

  'general': {
    id: 'general',
    name: 'Assistant',
    description: 'Ask the assistant to help with any club management task.',
    pageHints: [],
    outputDescription: 'action',
    systemPrompt: `You are a helpful assistant for a golf club management platform called The 19th Hole.

The platform helps golf clubs manage:
- Members and membership categories
- Interclub league fixtures and results
- Competitions and scorecards
- Tee time bookings
- Communications to members

When given text and an instruction, extract or transform the data as requested and return a JSON response.

Always return valid JSON with an "action" field describing what was done, a "data" field with the result, and a "message" field with a human-readable summary.`,
  },
};

export function detectCapability(page: string, instruction: string): CapabilityId {
  // Check page hints first
  for (const cap of Object.values(CAPABILITIES)) {
    if (cap.pageHints.some(hint => page.includes(hint))) {
      return cap.id;
    }
  }

  // Fall back to instruction keyword matching
  const lower = instruction.toLowerCase();
  if (lower.match(/fixture|match|schedule|league/)) return 'fixture-import';
  if (lower.match(/member|player|import.*member/)) return 'member-import';
  if (lower.match(/result|score|card|competition/)) return 'competition-results';
  if (lower.match(/tee.?time|tee.?sheet|booking/)) return 'tee-time-import';

  return 'general';
}
