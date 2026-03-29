import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByConsultation = query({
  args: { encounterId: v.id("encounters") },
  handler: async (ctx, { encounterId }) => {
    const sessions = await ctx.db
      .query("caseReasoningSessions")
      .withIndex("by_encounter", (q) => q.eq("encounterId", encounterId))
      .collect();
    return sessions.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },
});

export const getByVet = query({
  args: { providerId: v.string() },
  handler: async (ctx, { providerId }) => {
    const sessions = await ctx.db
      .query("caseReasoningSessions")
      .withIndex("by_provider", (q) => q.eq("providerId", providerId))
      .collect();
    // Return only general sessions (no encounter linked)
    return sessions
      .filter((s) => !s.encounterId)
      .sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  },
});

export const getSession = query({
  args: { id: v.id("caseReasoningSessions") },
  handler: async (ctx, { id }) => {
    return ctx.db.get(id);
  },
});

export const createSession = mutation({
  args: {
    encounterId: v.optional(v.id("encounters")),
    providerId: v.string(),
    orgId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, { encounterId, providerId, orgId }) => {
    const now = new Date().toISOString();
    return ctx.db.insert("caseReasoningSessions", {
      ...(encounterId && { encounterId }),
      providerId,
      orgId,
      messages: [],
      messageCount: 0,
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const appendMessage = mutation({
  args: {
    sessionId: v.id("caseReasoningSessions"),
    message: v.object({
      id: v.string(),
      role: v.string(),
      content: v.string(),
      isError: v.optional(v.boolean()),
      createdAt: v.string(),
    }),
  },
  handler: async (ctx, { sessionId, message }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    const now = new Date().toISOString();
    await ctx.db.patch(sessionId, {
      messages: [...session.messages, message],
      messageCount: session.messageCount + 1,
      lastMessageAt: now,
      updatedAt: now,
    });
  },
});

export const updateCortiIds = mutation({
  args: {
    sessionId: v.id("caseReasoningSessions"),
    cortiAgentId: v.optional(v.string()),
    cortiContextId: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId, cortiAgentId, cortiContextId }) => {
    const now = new Date().toISOString();
    await ctx.db.patch(sessionId, {
      ...(cortiAgentId !== undefined && { cortiAgentId }),
      ...(cortiContextId !== undefined && { cortiContextId }),
      updatedAt: now,
    });
  },
});

export const updateTitle = mutation({
  args: {
    sessionId: v.id("caseReasoningSessions"),
    title: v.string(),
  },
  handler: async (ctx, { sessionId, title }) => {
    const now = new Date().toISOString();
    await ctx.db.patch(sessionId, { title, updatedAt: now });
  },
});

export const linkConsultation = mutation({
  args: {
    sessionId: v.id("caseReasoningSessions"),
    encounterId: v.id("encounters"),
  },
  handler: async (ctx, { sessionId, encounterId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    const now = new Date().toISOString();
    await ctx.db.patch(sessionId, { encounterId, updatedAt: now });
  },
});

export const deleteSession = mutation({
  args: { sessionId: v.id("caseReasoningSessions") },
  handler: async (ctx, { sessionId }) => {
    await ctx.db.delete(sessionId);
  },
});
