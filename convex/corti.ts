"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

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

    const top = leaderboard.slice(0, 5).map((p, i) => {
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
