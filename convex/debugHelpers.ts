import { query } from "./_generated/server";

export const listVets = query({
  args: {},
  handler: async (ctx) => {
    const providers = await ctx.db.query("providers").take(10);
    return providers.map(v => ({ id: v._id, email: v.email, name: v.name, orgId: v.orgId }));
  },
});

export const listOrgs = query({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").take(10);
    return orgs.map(o => ({ id: o._id, name: o.name, slug: o.slug }));
  },
});
