import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Missing invitation token' },
        { status: 400 }
      );
    }

    // Get invitation details
    const invitation = await convex.query(api.invitations.getByToken, {
      token,
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `Invitation is ${invitation.status}` },
        { status: 400 }
      );
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      );
    }

    // Get user's email to verify it matches invitation
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const userEmail = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId
    )?.emailAddress;

    if (userEmail !== invitation.email) {
      return NextResponse.json(
        { error: 'This invitation was sent to a different email address' },
        { status: 403 }
      );
    }

    // Map invitation role to Clerk org role
    const clerkRole =
      invitation.role === 'admin' ? 'org:admin' : 'org:member';

    // Create Clerk organization membership
    if (invitation.organization?.clerkOrgId) {
      try {
        await client.organizations.createOrganizationMembership({
          organizationId: invitation.organization.clerkOrgId,
          userId: userId,
          role: clerkRole,
        });
      } catch (error: any) {
        // If user is already a member, that's okay
        if (!error.message?.includes('already a member')) {
          throw error;
        }
      }
    }

    // Accept invitation in Convex (this will mark it as accepted)
    const acceptedInvitation = await convex.mutation(api.invitations.accept, {
      token,
      userId,
    });

    // Create Convex membership
    await convex.mutation(api.memberships.create, {
      orgId: acceptedInvitation.orgId,
      userId,
      role: invitation.role,
      status: 'active',
    });

    return NextResponse.json({
      success: true,
      organizationId: acceptedInvitation.orgId,
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to accept invitation',
      },
      { status: 500 }
    );
  }
}
