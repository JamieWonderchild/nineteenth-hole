import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { Resend } from 'resend';
import { renderInvitationEmail } from '@/lib/email-templates/invitation';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orgId, email, role, locationIds } = body;

    if (!orgId || !email || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get organization details
    const org = await convex.query(api.organizations.getById, {
      id: orgId as Id<'organizations'>,
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get inviter details
    const provider = await convex.query(api.providers.getProviderByUserId, { userId });
    const inviterName = provider?.name || 'A team member';

    // Create invitation in Convex
    const { token } = await convex.mutation(api.invitations.create, {
      orgId: orgId as Id<'organizations'>,
      email,
      role,
      invitedBy: userId,
      inviterName,
      locationIds: locationIds as Id<'locations'>[] | undefined,
    });

    // Generate accept URL
    const acceptUrl = `${request.nextUrl.origin}/accept-invitation/${token}`;

    // Get invitation details for expiry
    const invitation = await convex.query(api.invitations.getByToken, {
      token,
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Failed to create invitation' },
        { status: 500 }
      );
    }

    // Send email via Resend (optional - skip if API key not configured)
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);

        const emailHtml = renderInvitationEmail({
          inviterName,
          organizationName: org.name,
          role,
          acceptUrl,
          expiresAt: invitation.expiresAt,
        });

        const emailResult = await resend.emails.send({
          from: '[PRODUCT_NAME] <invitations@[PRODUCT_NAME_DOMAIN]>',
          to: email,
          subject: `You've been invited to join ${org.name} on [PRODUCT_NAME]`,
          html: emailHtml,
        });

        if (emailResult.error) {
          console.error('Failed to send invitation email:', emailResult.error);
          // Don't fail the request - invitation is still created
        }
      } catch (emailError) {
        console.error('Email send error:', emailError);
        // Don't fail the request - invitation is still created
      }
    } else {
      console.warn('RESEND_API_KEY not configured - invitation email not sent');
    }

    return NextResponse.json({
      success: true,
      invitationId: invitation._id,
    });
  } catch (error) {
    console.error('Invitation send error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to send invitation',
      },
      { status: 500 }
    );
  }
}
