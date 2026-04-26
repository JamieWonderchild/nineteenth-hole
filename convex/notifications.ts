import { v } from "convex/values";
import { internalAction } from "./_generated/server";

export const notifyMatchFailed = internalAction({
  args: {
    name: v.string(),
    clerkUserId: v.string(),
    clubName: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "The 19th Hole <noreply@playthepool.golf>",
        to: "jar@corti.ai",
        subject: `${args.clubName} sign-up needs linking — ${args.name}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 16px">
            <div style="background:#14532d;border-radius:12px 12px 0 0;padding:24px 32px">
              <p style="color:#86efac;margin:0;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">⛳ The 19th Hole</p>
            </div>
            <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:32px;color:#111827">
              <h2 style="margin:0 0 16px;font-size:18px">New sign-up needs manual linking</h2>
              <p style="margin:0 0 8px"><strong>Name they signed up with:</strong> ${args.name}</p>
              <p style="margin:0 0 8px"><strong>Club:</strong> ${args.clubName}</p>
              <p style="margin:0 0 24px;font-family:monospace;font-size:13px;background:#f3f4f6;padding:8px 12px;border-radius:6px">${args.clerkUserId}</p>
              <p style="color:#6b7280;font-size:14px;margin:0 0 20px">
                No provisional member record matched this name. Go to the Members page and link them manually under "Provisional players".
              </p>
              <a href="https://www.nineteenth.golf/manage/members"
                style="display:inline-block;background:#15803d;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
                Go to Members →
              </a>
            </div>
          </div>
        `,
      }),
    });
  },
});
