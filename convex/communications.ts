import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

type ClerkUser = {
  id: string;
  email_addresses: Array<{ email_address: string }>;
  first_name?: string;
  last_name?: string;
};

async function fetchClerkUser(userId: string): Promise<ClerkUser | null> {
  const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
  });
  if (!res.ok) return null;
  return res.json();
}

async function sendViaResend(opts: {
  to: string;
  subject: string;
  html: string;
  fromName: string;
}) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${opts.fromName} <noreply@nineteenth.golf>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    }),
  });
  return res.ok;
}

function bodyToHtml(body: string, clubName: string) {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const paragraphs = escaped
    .split(/\n\n+/)
    .map(p => `<p style="margin:0 0 16px">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:32px 16px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:#14532d;padding:24px 32px">
      <p style="color:#86efac;margin:0;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">⛳ ${clubName}</p>
    </div>
    <div style="padding:32px;color:#111827;font-size:15px;line-height:1.6">
      ${paragraphs}
    </div>
    <div style="padding:16px 32px;border-top:1px solid #f3f4f6;color:#9ca3af;font-size:12px">
      Sent via Nineteenth Hole · ${clubName}
    </div>
  </div>
</body>
</html>`;
}

// ── Queries ──────────────────────────────────────────────────────────────────

export const listByClub = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    return ctx.db
      .query("communications")
      .withIndex("by_club", q => q.eq("clubId", clubId))
      .order("desc")
      .collect();
  },
});

// ── Actions ──────────────────────────────────────────────────────────────────

export const sendBulkEmail = action({
  args: {
    clubId: v.id("clubs"),
    sentBy: v.string(),
    subject: v.string(),
    body: v.string(),
    recipientFilter: v.string(), // 'all' | 'active' | 'admins'
  },
  handler: async (ctx, args): Promise<{ sent: number; failed: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Auth: must be club admin or super admin
    const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
    const isSuperAdmin = identity.email && superAdminEmails.includes(identity.email);
    if (!isSuperAdmin) {
      const members = await ctx.runQuery(api.clubMembers.listByClub, { clubId: args.clubId });
      const caller = (members as Array<{ userId: string; role: string }>).find(m => m.userId === identity.subject);
      if (!caller || caller.role !== "admin") throw new Error("Not authorised");
    }

    // Get club for display name
    const club = await ctx.runQuery(api.clubs.get, { clubId: args.clubId });
    if (!club) throw new Error("Club not found");

    // Get members to email
    const allMembers = await ctx.runQuery(api.clubMembers.listByClub, { clubId: args.clubId }) as Array<{ userId: string; role: string; status: string }>;
    const targets = allMembers.filter(m => {
      if (args.recipientFilter === "admins") return m.role === "admin";
      return m.status === "active"; // 'all' and 'active' both target active members
    });

    const html = bodyToHtml(args.body, club.name);
    let sent = 0;
    let failed = 0;

    for (const member of targets) {
      const clerkUser = await fetchClerkUser(member.userId);
      const email = clerkUser?.email_addresses?.[0]?.email_address;
      if (!email) { failed++; continue; }

      const ok = await sendViaResend({
        to: email,
        subject: args.subject,
        html,
        fromName: club.name,
      });
      if (ok) sent++; else failed++;
    }

    // Record the send
    await ctx.runMutation(api.communications.record, {
      clubId: args.clubId,
      sentBy: args.sentBy,
      subject: args.subject,
      body: args.body,
      recipientFilter: args.recipientFilter,
      recipientCount: sent,
    });

    return { sent, failed };
  },
});

// Internal mutation — records a sent communication
export const record = mutation({
  args: {
    clubId: v.id("clubs"),
    sentBy: v.string(),
    subject: v.string(),
    body: v.string(),
    recipientFilter: v.string(),
    recipientCount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("communications", {
      ...args,
      sentAt: new Date().toISOString(),
    });
  },
});
