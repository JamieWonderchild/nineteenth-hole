import { v } from "convex/values";
import { mutation, internalQuery, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const saveToken = mutation({
  args: {
    token: v.string(),
    platform: v.string(),
  },
  handler: async (ctx, { token, platform }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db
      .query("pushTokens")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .first();

    const now = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, { token, platform, updatedAt: now });
    } else {
      await ctx.db.insert("pushTokens", {
        userId: identity.subject,
        token,
        platform,
        updatedAt: now,
      });
    }
  },
});

export const removeToken = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;
    const existing = await ctx.db
      .query("pushTokens")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const getToken = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return ctx.db
      .query("pushTokens")
      .withIndex("by_user", q => q.eq("userId", userId))
      .first();
  },
});

export const sendToUser = internalAction({
  args: {
    userId: v.string(),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, { userId, title, body, data }) => {
    const tokenRow = (await ctx.runQuery(internal.pushNotifications.getToken, { userId })) as { token: string } | null;
    if (!tokenRow) return false;

    const response: Response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: tokenRow.token,
        sound: "default",
        title,
        body,
        data: data ?? {},
      }),
    });

    return response.ok;
  },
});
