"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";

// ── Config ────────────────────────────────────────────────────────────────────

const TENANT = "golf-club-software";
const AGENT_API = "https://api.eu.corti.app/agents";

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Tenant-Name": TENANT,
  };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  const authUrl = `https://auth.eu.corti.app/realms/${TENANT}/protocol/openid-connect/token`;
  const body = new URLSearchParams({
    client_id: process.env.CORTI_CLIENT_ID!,
    client_secret: process.env.CORTI_CLIENT_SECRET!,
    grant_type: "client_credentials",
    scope: "openid",
  });

  const res = await fetch(authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Corti auth failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

// ── Agent helpers ─────────────────────────────────────────────────────────────

async function createAgent(token: string, systemPrompt: string): Promise<string> {
  const res = await fetch(`${AGENT_API}?ephemeral=true`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      type: "ephemeral",
      name: `golf-${Date.now()}`,
      systemPrompt,
      experts: [],
    }),
  });

  if (!res.ok) {
    throw new Error(`Create agent failed: ${res.status} ${await res.text()}`);
  }

  const agent = await res.json();
  return (agent.id ?? agent.agentId) as string;
}

async function sendMessage(token: string, agentId: string, text: string): Promise<string> {
  const res = await fetch(`${AGENT_API}/${agentId}/v1/message:send`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      message: {
        role: "user",
        kind: "message",
        messageId: `msg-${Date.now()}`,
        parts: [{ kind: "text", text }],
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Send message failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const task = data.task ?? data;
  return task.id as string;
}

async function pollTask(token: string, agentId: string, taskId: string): Promise<string> {
  const url = `${AGENT_API}/${agentId}/tasks/${taskId}`;

  for (let i = 0; i < 150; i++) {
    const res = await fetch(url, { headers: headers(token) });
    if (!res.ok) throw new Error(`Poll failed: ${res.status}`);

    const task = await res.json();
    const state = task.status?.state as string | undefined;

    if (state === "completed") {
      // Artifacts first, then status.message
      if (Array.isArray(task.artifacts) && task.artifacts.length > 0) {
        const part = task.artifacts[0].parts?.find((p: { kind: string; text?: string }) => p.kind === "text");
        if (part?.text) return part.text as string;
      }
      const msgPart = task.status?.message?.parts?.find((p: { kind: string; text?: string }) => p.kind === "text");
      if (msgPart?.text) return msgPart.text as string;
      throw new Error("Task completed but no text in response");
    }

    if (state === "failed") throw new Error("Corti task failed");

    await new Promise(r => setTimeout(r, 200));
  }

  throw new Error("Corti task timed out after 30s");
}

async function runAgent(systemPrompt: string, userMessage: string): Promise<string> {
  const token = await getToken();
  const agentId = await createAgent(token, systemPrompt);
  const taskId = await sendMessage(token, agentId, userMessage);
  return pollTask(token, agentId, taskId);
}

// ── Actions ───────────────────────────────────────────────────────────────────

export const generateCompetitionSummary = action({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    const [competition, leaderboard] = await Promise.all([
      ctx.runQuery(api.competitions.get, { competitionId }),
      ctx.runQuery(api.scoring.leaderboard, { competitionId }),
    ]);

    if (!competition) throw new Error("Competition not found");
    if (!leaderboard.length) throw new Error("No scores to summarise yet");

    const format = competition.scoringFormat ?? "stableford";
    const dateStr = competition.startDate
      ? new Date(competition.startDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : "";

    const top = leaderboard.slice(0, 5).map((p: any, i: number) => {
      const score = format === "strokeplay"
        ? `net ${p.netScore} (gross ${p.grossScore})`
        : `${p.stablefordPoints} points`;
      return `${i + 1}. ${p.displayName} — ${score}`;
    }).join("\n");

    const summary = await runAgent(
      `You are a golf club communications assistant. Write warm, engaging competition result summaries for club members. Keep it under 120 words. Celebratory in tone. Suitable for a WhatsApp group, email newsletter, or noticeboard. Always name the winner and top finishers. Do not use hashtags.`,
      `Write a results summary for: ${competition.name}${dateStr ? `, ${dateStr}` : ""}. Format: ${format}.\n\nTop finishers:\n${top}`
    );

    return summary;
  },
});

export const generateClubInsights = action({
  args: {
    clubName: v.string(),
    teeTimes: v.object({
      totalSlots: v.number(),
      filledSlots: v.number(),
      visitorRounds: v.number(),
    }),
    posRevenue: v.optional(v.object({
      total: v.number(),
      bar: v.number(),
      proShop: v.number(),
    })),
    memberCount: v.number(),
    competitionsThisMonth: v.number(),
  },
  handler: async (_ctx, args) => {
    const { clubName, teeTimes, posRevenue, memberCount, competitionsThisMonth } = args;
    const utilisation = teeTimes.totalSlots > 0
      ? Math.round((teeTimes.filledSlots / teeTimes.totalSlots) * 100)
      : 0;

    const statsText = [
      `Club: ${clubName}`,
      `Members: ${memberCount}`,
      `Tee time utilisation: ${utilisation}% (${teeTimes.filledSlots}/${teeTimes.totalSlots} slots filled)`,
      `Visitor rounds this month: ${teeTimes.visitorRounds}`,
      posRevenue ? `Bar & pro shop revenue: £${posRevenue.total.toFixed(2)} (bar £${posRevenue.bar.toFixed(2)}, pro shop £${posRevenue.proShop.toFixed(2)})` : null,
      `Competitions run this month: ${competitionsThisMonth}`,
    ].filter(Boolean).join("\n");

    return runAgent(
      `You are a golf club business analyst. Write a concise, friendly monthly insights summary for a golf club committee. Highlight what's going well, flag anything that could be improved, and suggest one or two practical actions. Keep it under 150 words. Conversational but professional.`,
      `Generate a monthly insights summary for this club:\n\n${statsText}`
    );
  },
});

export const optimiseDrawGrievances = action({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    const [competition, allEntries, grievances] = await Promise.all([
      ctx.runQuery(api.competitions.get, { competitionId }),
      ctx.runQuery(api.entries.listByCompetition, { competitionId }),
      ctx.runQuery(internal.drawGrievances.getAllInternal, { competitionId }),
    ]);

    if (!competition) throw new Error("Competition not found");
    if (!grievances.length) throw new Error("No grievances have been submitted");

    const drawnEntries = (allEntries as any[]).filter((e: any) => e.groupNumber !== undefined);
    if (!drawnEntries.length) throw new Error("No draw has been generated yet");

    // Assign anonymous codes — names never leave the server
    const sorted = [...drawnEntries].sort((a: any, b: any) => (a.drawOrder ?? 0) - (b.drawOrder ?? 0));
    const idToCode = new Map<string, string>();
    const codeToId = new Map<string, string>();
    const userToCode = new Map<string, string>();
    sorted.forEach((e: any, i: number) => {
      const code = `P${i + 1}`;
      idToCode.set(e._id, code);
      codeToId.set(code, e._id);
      userToCode.set(e.userId, code);
    });

    // Group map
    const groupMap = new Map<number, any[]>();
    for (const e of sorted) {
      const g = e.groupNumber as number;
      if (!groupMap.has(g)) groupMap.set(g, []);
      groupMap.get(g)!.push(e);
    }

    const [startH, startM] = ((competition as any).teeStartTime ?? "09:00").split(":").map(Number);
    const interval = (competition as any).teeInterval ?? 10;
    const startType = (competition as any).startType ?? "sequential";

    function groupLabel(groupNumber: number): string {
      if (startType === "shotgun") return `Hole ${((groupNumber - 1) % 18) + 1}`;
      const totalMins = startH * 60 + startM + (groupNumber - 1) * interval;
      return `${Math.floor(totalMins / 60).toString().padStart(2, "0")}:${(totalMins % 60).toString().padStart(2, "0")}`;
    }

    const drawLines = [...groupMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([gNum, entries]) => {
        const codes = entries
          .sort((a: any, b: any) => (a.drawOrder ?? 0) - (b.drawOrder ?? 0))
          .map((e: any) => idToCode.get(e._id)!)
          .join(", ");
        return `[Group ${gNum} — ${groupLabel(gNum)}] ${codes}`;
      })
      .join("\n");

    const grievanceLines = (grievances as any[]).map((g: any) => {
      const code = userToCode.get(g.userId) ?? "??";
      return `- ${code} | severity:${g.severity} | ${g.type} | "${g.body}"`;
    }).join("\n");

    const systemPrompt = `You are a golf draw optimiser. You receive a current draw sheet (groups with player codes and tee times) and a list of member grievances with severity scores (1–5, where 5 = most important).

Your job is to produce an optimised draw that:
- Maximises total weighted grievance satisfaction (severity × satisfied)
- Minimises total number of player swaps — prefer targeted changes over wholesale reshuffling
- Maintains identical group sizes and the same number of groups
- Uses the same group numbers — only the player assignments change
- Never outputs player names or personal details — use only the player codes (P1, P2, etc.)

Output ONLY valid JSON in this exact format with no text before or after:
{
  "groups": [
    { "groupNumber": 1, "playerCodes": ["P1", "P2", "P3", "P4"] }
  ],
  "changes": [
    { "playerCode": "P5", "reason": "Moved to a later group to accommodate a time preference" }
  ],
  "summary": "We reviewed N pieces of feedback and made X adjustments to the draw.",
  "grievancesAddressed": 3,
  "grievancesTotal": 14
}`;

    const userMessage = `CURRENT DRAW:\n${drawLines}\n\nGRIEVANCES (severity 1–5):\n${grievanceLines}`;
    const rawResponse = await runAgent(systemPrompt, userMessage);

    // Parse JSON — try fenced block first, then raw object
    const fenced = rawResponse.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    const jsonStr = fenced ? fenced[1] : rawResponse.match(/(\{[\s\S]+\})/)?.[1];
    if (!jsonStr) throw new Error("Agent returned no parseable JSON");

    const result = JSON.parse(jsonStr) as {
      groups: Array<{ groupNumber: number; playerCodes: string[] }>;
      changes: Array<{ playerCode: string; reason: string }>;
      summary: string;
      grievancesAddressed: number;
      grievancesTotal: number;
    };

    // Resolve codes back to real entry IDs + display names
    const resolvedGroups = result.groups.map(g => ({
      groupNumber: g.groupNumber,
      teeTime: groupLabel(g.groupNumber),
      entryIds: g.playerCodes.map(code => codeToId.get(code)).filter(Boolean) as string[],
    }));

    const originalGroupByEntry = new Map<string, number>();
    for (const e of drawnEntries) originalGroupByEntry.set((e as any)._id, (e as any).groupNumber);

    const diffs = (result.changes ?? []).map(c => {
      const entryId = codeToId.get(c.playerCode);
      const entry = drawnEntries.find((e: any) => e._id === entryId) as any;
      const fromGroup = entry ? (originalGroupByEntry.get(entry._id) ?? 0) : 0;
      const toGroup = resolvedGroups.find(g => g.entryIds.includes(entryId ?? ""))?.groupNumber ?? 0;
      return {
        entryId: entryId ?? "",
        displayName: entry?.displayName ?? c.playerCode,
        fromGroup,
        fromTime: groupLabel(fromGroup),
        toGroup,
        toTime: groupLabel(toGroup),
        reason: c.reason,
      };
    });

    const draft = JSON.stringify({
      groups: resolvedGroups,
      diffs,
      summary: result.summary,
      grievancesAddressed: result.grievancesAddressed,
      grievancesTotal: result.grievancesTotal,
    });

    await ctx.runMutation(internal.drawGrievances.saveDraft, {
      competitionId,
      draft,
      summary: result.summary,
    });

    return {
      grievancesAddressed: result.grievancesAddressed,
      grievancesTotal: result.grievancesTotal,
    };
  },
});

export const suggestInterclubTeam = action({
  args: {
    fixtureDescription: v.string(),
    handicapMin: v.optional(v.number()),
    handicapMax: v.optional(v.number()),
    availableMembers: v.array(v.object({
      name: v.string(),
      handicap: v.optional(v.number()),
    })),
    teamSize: v.number(),
  },
  handler: async (_ctx, args) => {
    const { fixtureDescription, handicapMin, handicapMax, availableMembers, teamSize } = args;

    const bandText = handicapMin !== undefined && handicapMax !== undefined
      ? `Handicap band: ${handicapMin}–${handicapMax}.`
      : "";

    const memberList = availableMembers
      .map(m => `${m.name} (hcp: ${m.handicap ?? "unknown"})`)
      .join(", ");

    return runAgent(
      `You are a golf club team captain's assistant. Suggest optimal interclub team selections based on handicap bands and available players. Be practical and concise. Explain your reasoning briefly.`,
      `Fixture: ${fixtureDescription}. ${bandText} Team size: ${teamSize}.\n\nAvailable players: ${memberList}\n\nSuggest the best team of ${teamSize} with brief reasoning.`
    );
  },
});
