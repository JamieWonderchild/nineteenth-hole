import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateToken(): string {
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 36).toString(36)
  ).join("");
}

async function sendInviteEmail(opts: {
  to: string;
  clubName: string;
  inviteUrl: string;
}) {
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:32px 16px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:#14532d;padding:32px">
      <p style="color:#86efac;margin:0 0 8px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">⛳ The 19th Hole</p>
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">You've been invited to join</h1>
      <h2 style="color:#bbf7d0;margin:6px 0 0;font-size:18px;font-weight:600">${opts.clubName}</h2>
    </div>
    <div style="padding:32px;color:#111827;font-size:15px;line-height:1.6">
      <p style="margin:0 0 20px">You've been personally invited to join <strong>${opts.clubName}</strong> on The 19th Hole — the club's platform for competitions, interclub results, tee time booking, and more.</p>
      <a href="${opts.inviteUrl}" style="display:inline-block;background:#15803d;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:10px">Accept your invitation →</a>
      <p style="margin:24px 0 0;color:#6b7280;font-size:13px">This link is personal to you and expires in 7 days. If you didn't expect this email, you can safely ignore it.</p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #f3f4f6;color:#9ca3af;font-size:12px">
      Sent via Nineteenth Hole · ${opts.clubName}
    </div>
  </div>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${opts.clubName} <noreply@playthepool.golf>`,
      to: opts.to,
      subject: `You've been invited to join ${opts.clubName}`,
      html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("Resend error", res.status, body);
  }
  return res.ok;
}

// ── Internal mutation — store the invite record ───────────────────────────────

export const _create = mutation({
  args: {
    clubId: v.id("clubs"),
    email: v.string(),
    token: v.string(),
    invitedBy: v.string(),
    expiresAt: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("invites", {
      ...args,
      createdAt: new Date().toISOString(),
    });
  },
});

// ── Queries ───────────────────────────────────────────────────────────────────

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token", q => q.eq("token", token))
      .first();
    if (!invite) return null;

    const club = await ctx.db.get(invite.clubId);
    return { invite, club };
  },
});

export const listByClub = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    const invites = await ctx.db
      .query("invites")
      .withIndex("by_club", q => q.eq("clubId", clubId))
      .order("desc")
      .collect();

    const now = new Date().toISOString();
    return invites
      .filter(i => !i.usedAt && i.expiresAt > now)  // pending & not expired
      .slice(0, 20);
  },
});

// ── Send invite action ─────────────────────────────────────────────────────────

export const send = action({
  args: {
    clubId: v.id("clubs"),
    email: v.string(),
  },
  handler: async (ctx, { clubId, email }): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Auth: must be club admin or super admin
    const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
    const isSuperAdmin = identity.email && superAdminEmails.includes(identity.email);
    if (!isSuperAdmin) {
      const members = await ctx.runQuery(api.clubMembers.listByClub, { clubId });
      const caller = (members as Array<{ userId: string; role: string }>).find(m => m.userId === identity.subject);
      if (!caller || caller.role !== "admin") throw new Error("Not authorised");
    }

    const club = await ctx.runQuery(api.clubs.get, { clubId });
    if (!club) throw new Error("Club not found");

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await ctx.runMutation(api.invites._create, {
      clubId,
      email: email.toLowerCase().trim(),
      token,
      invitedBy: identity.subject,
      expiresAt,
    });

    const inviteUrl = `https://playthepool.golf/invite/${token}`;
    const sent = await sendInviteEmail({ to: email, clubName: club.name, inviteUrl });
    if (!sent) throw new Error("Invite saved but email failed to send — check RESEND_API_KEY in Convex env vars");
  },
});

// ── Redeem invite ─────────────────────────────────────────────────────────────

export const redeem = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token", q => q.eq("token", token))
      .first();

    if (!invite) throw new Error("Invite not found");
    if (invite.usedAt) throw new Error("This invite has already been used");
    if (new Date(invite.expiresAt) < new Date()) throw new Error("This invite has expired");

    // Mark invite as used
    await ctx.db.patch(invite._id, {
      usedAt: new Date().toISOString(),
      usedByUserId: identity.subject,
    });

    // Create or update membership — invited members go straight to active
    const existing = await ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_user", q =>
        q.eq("clubId", invite.clubId).eq("userId", identity.subject)
      )
      .first();

    if (existing) {
      if (existing.status !== "active") {
        await ctx.db.patch(existing._id, { status: "active", updatedAt: new Date().toISOString() });
      }
    } else {
      const name = identity.name ?? identity.givenName ?? identity.email?.split("@")[0] ?? "Member";
      await ctx.db.insert("clubMembers", {
        clubId: invite.clubId,
        userId: identity.subject,
        role: "member",
        status: "active",
        displayName: name,
        avatarUrl: undefined,
        totalEntered: 0,
        totalSpent: 0,
        totalWon: 0,
        totalProfit: 0,
        joinedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    return { clubId: invite.clubId };
  },
});
