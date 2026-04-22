import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// ============================================================================
// Queries
// ============================================================================

// List all conversations for a user, enriched with members + last message
export const listMyConversations = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const memberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();

    const results = await Promise.all(memberships.map(async (membership) => {
      const conversation = await ctx.db.get(membership.conversationId);
      if (!conversation) return null;

      // All members of this conversation
      const members = await ctx.db
        .query("conversationMembers")
        .withIndex("by_conversation", q => q.eq("conversationId", conversation._id))
        .collect();

      // Last message
      const lastMessage = await ctx.db
        .query("messages")
        .withIndex("by_conversation", q => q.eq("conversationId", conversation._id))
        .order("desc")
        .first();

      // Unread count — messages from others after lastReadAt
      const lastReadAt = membership.lastReadAt ?? "";
      let unreadCount = 0;
      if (lastMessage && lastMessage.senderId !== userId && lastMessage.createdAt > lastReadAt) {
        // Count properly only when there might be unreads
        const allMessages = await ctx.db
          .query("messages")
          .withIndex("by_conversation", q => q.eq("conversationId", conversation._id))
          .collect();
        unreadCount = allMessages.filter(
          m => m.senderId !== userId && m.createdAt > lastReadAt
        ).length;
      }

      const otherMembers = members.filter(m => m.userId !== userId);

      return {
        _id: conversation._id,
        type: conversation.type,
        name: conversation.type === "group" ? conversation.name : otherMembers[0]?.displayName,
        avatarUrl: conversation.type === "direct" ? otherMembers[0]?.avatarUrl : undefined,
        members,
        lastMessage: lastMessage ?? null,
        unreadCount,
        lastMessageAt: conversation.lastMessageAt ?? conversation.createdAt,
      };
    }));

    return results
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  },
});

// Messages for a conversation (most recent 200, oldest first)
export const listMessages = query({
  args: { conversationId: v.id("conversations"), userId: v.string() },
  handler: async (ctx, { conversationId, userId }) => {
    // Verify membership
    const member = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation_and_user", q =>
        q.eq("conversationId", conversationId).eq("userId", userId)
      )
      .first();
    if (!member) return [];

    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_conversation", q => q.eq("conversationId", conversationId))
      .order("desc")
      .take(200);

    return msgs.reverse(); // oldest first for display
  },
});

// Get a single conversation with its members list
export const getConversation = query({
  args: { conversationId: v.id("conversations"), userId: v.string() },
  handler: async (ctx, { conversationId, userId }) => {
    const member = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation_and_user", q =>
        q.eq("conversationId", conversationId).eq("userId", userId)
      )
      .first();
    if (!member) return null;

    const conversation = await ctx.db.get(conversationId);
    if (!conversation) return null;

    const members = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation", q => q.eq("conversationId", conversationId))
      .collect();

    return { ...conversation, members };
  },
});

// Total unread count across all conversations (for sidebar badge)
export const totalUnread = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const memberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();

    let total = 0;
    for (const m of memberships) {
      const lastReadAt = m.lastReadAt ?? "";
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", q => q.eq("conversationId", m.conversationId))
        .collect();
      total += messages.filter(msg => msg.senderId !== userId && msg.createdAt > lastReadAt).length;
    }
    return total;
  },
});

// ============================================================================
// Mutations
// ============================================================================

// Get or create a direct (1:1) conversation between two users
export const getOrCreateDirect = mutation({
  args: {
    myUserId: v.string(),
    otherUserId: v.string(),
    myDisplayName: v.string(),
    myAvatarUrl: v.optional(v.string()),
    otherDisplayName: v.string(),
    otherAvatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Find existing direct conversation between these two users
    const myMemberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user", q => q.eq("userId", args.myUserId))
      .collect();

    for (const membership of myMemberships) {
      const conv = await ctx.db.get(membership.conversationId);
      if (!conv || conv.type !== "direct") continue;

      const otherMembership = await ctx.db
        .query("conversationMembers")
        .withIndex("by_conversation_and_user", q =>
          q.eq("conversationId", conv._id).eq("userId", args.otherUserId)
        )
        .first();

      if (otherMembership) return conv._id;
    }

    // Create new direct conversation
    const now = new Date().toISOString();
    const convId = await ctx.db.insert("conversations", {
      type: "direct",
      createdBy: args.myUserId,
      createdAt: now,
    });

    await ctx.db.insert("conversationMembers", {
      conversationId: convId,
      userId: args.myUserId,
      displayName: args.myDisplayName,
      avatarUrl: args.myAvatarUrl,
      joinedAt: now,
    });
    await ctx.db.insert("conversationMembers", {
      conversationId: convId,
      userId: args.otherUserId,
      displayName: args.otherDisplayName,
      avatarUrl: args.otherAvatarUrl,
      joinedAt: now,
    });

    return convId;
  },
});

// Create a group conversation
export const createGroup = mutation({
  args: {
    name: v.string(),
    clubId: v.optional(v.id("clubs")),
    members: v.array(v.object({
      userId: v.string(),
      displayName: v.string(),
      avatarUrl: v.optional(v.string()),
    })),
    createdByUserId: v.string(),
    createdByDisplayName: v.string(),
    createdByAvatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const now = new Date().toISOString();
    const convId = await ctx.db.insert("conversations", {
      type: "group",
      clubId: args.clubId,
      name: args.name,
      createdBy: args.createdByUserId,
      createdAt: now,
    });

    // Add creator
    await ctx.db.insert("conversationMembers", {
      conversationId: convId,
      userId: args.createdByUserId,
      displayName: args.createdByDisplayName,
      avatarUrl: args.createdByAvatarUrl,
      joinedAt: now,
    });

    // Add other members
    for (const member of args.members) {
      if (member.userId === args.createdByUserId) continue;
      await ctx.db.insert("conversationMembers", {
        conversationId: convId,
        userId: member.userId,
        displayName: member.displayName,
        avatarUrl: member.avatarUrl,
        joinedAt: now,
      });
    }

    return convId;
  },
});

// Send a message
export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    senderId: v.string(),
    senderName: v.string(),
    senderAvatar: v.optional(v.string()),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Verify sender is a member
    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation_and_user", q =>
        q.eq("conversationId", args.conversationId).eq("userId", args.senderId)
      )
      .first();
    if (!membership) throw new Error("Not a member of this conversation");

    const now = new Date().toISOString();
    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: args.senderId,
      senderName: args.senderName,
      senderAvatar: args.senderAvatar,
      body: args.body.trim(),
      createdAt: now,
    });

    // Update conversation lastMessageAt for sorting
    await ctx.db.patch(args.conversationId, { lastMessageAt: now });

    // Auto-mark as read for sender
    await ctx.db.patch(membership._id, { lastReadAt: now });

    // Push notification to all other members
    const allMembers = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation", q => q.eq("conversationId", args.conversationId))
      .collect();

    for (const member of allMembers) {
      if (member.userId === args.senderId) continue;
      await ctx.scheduler.runAfter(0, internal.pushNotifications.sendToUser, {
        userId: member.userId,
        title: args.senderName,
        body: args.body.trim().length > 100
          ? args.body.trim().slice(0, 97) + "…"
          : args.body.trim(),
        data: { type: "message", conversationId: args.conversationId },
      });
    }
  },
});

// Mark all messages in a conversation as read for a user
export const markRead = mutation({
  args: { conversationId: v.id("conversations"), userId: v.string() },
  handler: async (ctx, { conversationId, userId }) => {
    const membership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation_and_user", q =>
        q.eq("conversationId", conversationId).eq("userId", userId)
      )
      .first();
    if (!membership) return;
    await ctx.db.patch(membership._id, { lastReadAt: new Date().toISOString() });
  },
});

// Add members to an existing group
export const addMembersToGroup = mutation({
  args: {
    conversationId: v.id("conversations"),
    members: v.array(v.object({
      userId: v.string(),
      displayName: v.string(),
      avatarUrl: v.optional(v.string()),
    })),
  },
  handler: async (ctx, { conversationId, members }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Caller must already be a member of the conversation
    const callerMembership = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation_and_user", q =>
        q.eq("conversationId", conversationId).eq("userId", identity.subject)
      )
      .first();
    if (!callerMembership) throw new Error("Not a member of this conversation");

    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.type !== "group") throw new Error("Not a group conversation");

    const now = new Date().toISOString();
    for (const member of members) {
      const existing = await ctx.db
        .query("conversationMembers")
        .withIndex("by_conversation_and_user", q =>
          q.eq("conversationId", conversationId).eq("userId", member.userId)
        )
        .first();
      if (existing) continue;

      await ctx.db.insert("conversationMembers", {
        conversationId,
        userId: member.userId,
        displayName: member.displayName,
        avatarUrl: member.avatarUrl,
        joinedAt: now,
      });
    }
  },
});
