import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { Id } from './_generated/dataModel';

// Generate a secure random token using Web Crypto API
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Create a new invitation
export const create = mutation({
  args: {
    orgId: v.id('organizations'),
    email: v.string(),
    role: v.string(), // 'admin' | 'provider' | 'practice-admin'
    invitedBy: v.string(),
    inviterName: v.string(),
    locationIds: v.optional(v.array(v.id('locations'))),
  },
  handler: async (ctx, args) => {
    // Check if there's already a pending invitation for this email
    const existing = await ctx.db
      .query('invitations')
      .withIndex('by_email_org', (q) => q.eq('email', args.email).eq('orgId', args.orgId))
      .filter((q) => q.eq(q.field('status'), 'pending'))
      .first();

    if (existing) {
      throw new Error('An invitation for this email is already pending');
    }

    // Generate secure token using Web Crypto API
    const token = generateToken();

    // Set expiration to 7 days from now
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const invitationId = await ctx.db.insert('invitations', {
      orgId: args.orgId,
      email: args.email,
      role: args.role,
      token,
      status: 'pending',
      invitedBy: args.invitedBy,
      inviterName: args.inviterName,
      locationIds: args.locationIds,
      expiresAt,
      createdAt: new Date().toISOString(),
    });

    return { invitationId, token };
  },
});

// Get invitation by token
export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const invitation = await ctx.db
      .query('invitations')
      .withIndex('by_token', (q) => q.eq('token', token))
      .first();

    if (!invitation) {
      return null;
    }

    // Check if expired (just report status, don't update in query)
    const isExpired = new Date(invitation.expiresAt) < new Date();
    const effectiveStatus = isExpired && invitation.status === 'pending'
      ? 'expired' as const
      : invitation.status;

    // Get organization details
    const org = await ctx.db.get(invitation.orgId);

    return {
      ...invitation,
      status: effectiveStatus,
      organization: org,
    };
  },
});

// Get pending invitations for an organization
export const getByOrg = query({
  args: { orgId: v.id('organizations') },
  handler: async (ctx, { orgId }) => {
    const invitations = await ctx.db
      .query('invitations')
      .withIndex('by_org', (q) => q.eq('orgId', orgId))
      .order('desc')
      .collect();

    // Mark expired invitations (just in the response, don't update DB in query)
    const now = new Date();
    return invitations.map((invitation) => {
      const isExpired = new Date(invitation.expiresAt) < now;
      return {
        ...invitation,
        status: isExpired && invitation.status === 'pending'
          ? 'expired' as const
          : invitation.status,
      };
    });
  },
});

// Accept an invitation
export const accept = mutation({
  args: {
    token: v.string(),
    userId: v.string(), // Clerk user ID of the person accepting
  },
  handler: async (ctx, { token, userId }) => {
    const invitation = await ctx.db
      .query('invitations')
      .withIndex('by_token', (q) => q.eq('token', token))
      .first();

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new Error(`Invitation is ${invitation.status}`);
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      await ctx.db.patch(invitation._id, { status: 'expired' });
      throw new Error('Invitation has expired');
    }

    // Mark invitation as accepted
    await ctx.db.patch(invitation._id, {
      status: 'accepted',
      acceptedBy: userId,
      acceptedAt: new Date().toISOString(),
    });

    return invitation;
  },
});

// Cancel an invitation
export const cancel = mutation({
  args: { invitationId: v.id('invitations') },
  handler: async (ctx, { invitationId }) => {
    const invitation = await ctx.db.get(invitationId);

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Only pending invitations can be cancelled');
    }

    await ctx.db.patch(invitationId, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    });
  },
});
