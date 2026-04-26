import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

// Internal — link a club courses record to the global golfCourses entry.
// Run via CLI: npx convex run courses:linkToGolfCourse '{...}'
export const linkToGolfCourse = internalMutation({
  args: {
    courseId: v.id("courses"),
    golfCourseId: v.id("golfCourses"),
    defaultTeeId: v.id("courseTees"),
  },
  handler: async (ctx, { courseId, golfCourseId, defaultTeeId }) => {
    await ctx.db.patch(courseId, {
      golfCourseId,
      defaultTeeId,
      updatedAt: new Date().toISOString(),
    });
    return { ok: true };
  },
});

export const listByClub = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    return ctx.db
      .query("courses")
      .withIndex("by_club", q => q.eq("clubId", clubId))
      .collect();
  },
});

export const get = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => ctx.db.get(courseId),
});

export const upsert = mutation({
  args: {
    courseId: v.optional(v.id("courses")),
    clubId: v.id("clubs"),
    name: v.string(),
    golfCourseId: v.optional(v.id("golfCourses")),
    defaultTeeId: v.optional(v.id("courseTees")),
    holes: v.array(v.object({
      number: v.number(),
      par: v.number(),
      strokeIndex: v.number(),
      yards: v.optional(v.number()),
      yardsWhite: v.optional(v.number()),
      yardsYellow: v.optional(v.number()),
      yardsBlue: v.optional(v.number()),
      yardsRed: v.optional(v.number()),
    })),
  },
  handler: async (ctx, { courseId, clubId, name, golfCourseId, defaultTeeId, holes }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
    const isSuperAdmin = identity.email && superAdminEmails.includes(identity.email);
    if (!isSuperAdmin) {
      const member = await ctx.db
        .query("clubMembers")
        .withIndex("by_club_and_user", q => q.eq("clubId", clubId).eq("userId", identity.subject))
        .unique();
      if (!member || member.role !== "admin") throw new Error("Not authorised");
    }

    const now = new Date().toISOString();
    const fields = {
      name, holes,
      ...(golfCourseId !== undefined ? { golfCourseId } : {}),
      ...(defaultTeeId !== undefined ? { defaultTeeId } : {}),
      updatedAt: now,
    };
    if (courseId) {
      await ctx.db.patch(courseId, fields);
      return courseId;
    }
    return ctx.db.insert("courses", { clubId, ...fields, createdAt: now });
  },
});

export const remove = mutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const course = await ctx.db.get(courseId);
    if (!course) throw new Error("Course not found");

    const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
    const isSuperAdmin = identity.email && superAdminEmails.includes(identity.email);
    if (!isSuperAdmin) {
      const member = await ctx.db
        .query("clubMembers")
        .withIndex("by_club_and_user", q => q.eq("clubId", course.clubId).eq("userId", identity.subject))
        .unique();
      if (!member || member.role !== "admin") throw new Error("Not authorised");
    }

    await ctx.db.delete(courseId);
  },
});
