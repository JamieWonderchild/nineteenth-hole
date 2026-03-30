import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { ConvexHttpClient } from 'convex/browser';
import { api } from 'convex/_generated/api';
import { PLAN_CONFIGS } from '@/types/billing';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

interface ClerkWebhookEvent {
  type: string;
  data: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  const body = await request.text();
  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: 'Missing svix headers' },
      { status: 400 }
    );
  }

  let event: ClerkWebhookEvent;
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error('Clerk webhook verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

    // Idempotency: use svix-id as unique event identifier
    const isNew = await convex.mutation(api.webhookEvents.checkAndRecord, {
      eventId: svixId,
      source: 'clerk',
    });
    if (!isNew) {
      console.log(`[ClerkWebhook] Skipping duplicate event: ${svixId}`);
      return NextResponse.json({ received: true, duplicate: true });
    }

  try {
    switch (event.type) {
      case 'organization.created': {
        const data = event.data as {
          id: string;
          name: string;
          slug: string;
          created_by: string;
          public_metadata?: { plan?: string };
          private_metadata?: { plan?: string };
        };

        // Idempotent: retry check to handle race condition with onboarding
        // The onboarding flow creates the org first, then Clerk fires this webhook
        // Due to timing, we need to check multiple times with delays
        let existingOrg: Awaited<ReturnType<typeof convex.query<typeof api.organizations.getByClerkOrg>>> | null = null;
        const maxRetries = 3;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
          existingOrg = await convex.query(api.organizations.getByClerkOrg, {
            clerkOrgId: data.id,
          });

          if (existingOrg) {
            console.log('[Clerk Webhook] Org already exists (created by onboarding):', {
              clerkOrgId: data.id,
              orgId: existingOrg._id,
              attempt: attempt + 1,
            });
            break;
          }

          // Wait before retry (except on last attempt)
          if (attempt < maxRetries - 1) {
            console.log('[Clerk Webhook] Org not found yet, retrying...', {
              clerkOrgId: data.id,
              attempt: attempt + 1,
              waitMs: 500 * (attempt + 1),
            });
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
          }
        }

        if (!existingOrg) {
          console.log('[Clerk Webhook] Org not found after retries, creating new org:', {
            clerkOrgId: data.id,
          });

          // Read plan from Clerk metadata (public first, then private)
          const metadataPlan = data.public_metadata?.plan || data.private_metadata?.plan;

          // Validate and default to 'solo' (changed from 'practice')
          const validPlans = ['solo', 'practice', 'multi-location'];
          const planTier =
            metadataPlan && validPlans.includes(metadataPlan)
              ? (metadataPlan as 'solo' | 'practice' | 'multi-location')
              : 'solo'; // Default to solo instead of practice

          console.log('[Clerk Webhook] Creating org with plan:', {
            clerkOrgId: data.id,
            metadataPlan: metadataPlan || 'none',
            finalPlan: planTier,
            source: metadataPlan ? 'metadata' : 'default',
          });

          const config = PLAN_CONFIGS[planTier];

          try {
            const orgId = await convex.mutation(api.organizations.create, {
              name: data.name,
              slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-'),
              clerkOrgId: data.id,
              plan: planTier,
              maxProviderSeats: config.includedSeats,
            });

            await convex.mutation(api.memberships.create, {
              orgId,
              userId: data.created_by,
              role: 'owner',
              status: 'active',
            });

            // Create provider record for the organization owner
            try {
              const clerkSecretKey = process.env.CLERK_SECRET_KEY;
              if (clerkSecretKey) {
                const userResponse = await fetch(
                  `https://api.clerk.com/v1/users/${data.created_by}`,
                  {
                    headers: {
                      Authorization: `Bearer ${clerkSecretKey}`,
                      'Content-Type': 'application/json',
                    },
                  }
                );

                if (userResponse.ok) {
                  const userData = (await userResponse.json()) as {
                    first_name?: string;
                    last_name?: string;
                    email_addresses?: Array<{
                      email_address: string;
                      id: string;
                    }>;
                    primary_email_address_id?: string;
                  };

                  const name =
                    [userData.first_name, userData.last_name]
                      .filter(Boolean)
                      .join(' ') || 'Provider User';

                  const email =
                    userData.email_addresses?.find(
                      (e) => e.id === userData.primary_email_address_id
                    )?.email_address ||
                    userData.email_addresses?.[0]?.email_address ||
                    'provider@example.com';

                  await convex.mutation(api.providers.createOrUpdateProvider, {
                    userId: data.created_by,
                    name,
                    email,
                    orgId,
                  });

                  console.log('[Clerk Webhook] Created provider record for owner:', {
                    userId: data.created_by,
                    name,
                    email,
                    orgId,
                  });
                }
              }
            } catch (error) {
              console.error('[Clerk Webhook] Failed to create provider record:', error);
              // Don't fail the webhook - provider record can be created later
            }
          } catch (error) {
            // Handle case where org was created between retries
            console.error('[Clerk Webhook] Failed to create org (likely already exists):', {
              clerkOrgId: data.id,
              error: error instanceof Error ? error.message : String(error),
            });

            // Check one more time if org exists
            const finalCheck = await convex.query(api.organizations.getByClerkOrg, {
              clerkOrgId: data.id,
            });

            if (!finalCheck) {
              // Org truly doesn't exist and creation failed - re-throw error
              throw error;
            }

            console.log('[Clerk Webhook] Org found on final check, continuing:', {
              clerkOrgId: data.id,
              orgId: finalCheck._id,
            });
          }
        }

        break;
      }

      case 'organization.updated': {
        const data = event.data as {
          id: string;
          name: string;
          slug: string;
        };

        const org = await convex.query(api.organizations.getByClerkOrg, {
          clerkOrgId: data.id,
        });

        if (org) {
          await convex.mutation(api.organizations.update, {
            id: org._id,
            name: data.name,
          });
        }
        break;
      }

      case 'organizationMembership.created': {
        const data = event.data as {
          organization: { id: string };
          public_user_data: { user_id: string };
          role: string;
        };

        const org = await convex.query(api.organizations.getByClerkOrg, {
          clerkOrgId: data.organization.id,
        });

        if (org) {
          // Idempotent: skip if membership already exists (onboarding creates it first)
          const existingMembership = await convex.query(
            api.memberships.getByOrgAndUser,
            {
              orgId: org._id,
              userId: data.public_user_data.user_id,
            }
          );

          if (!existingMembership) {
            const role = data.role === 'org:admin' ? 'admin' : 'provider';
            await convex.mutation(api.memberships.create, {
              orgId: org._id,
              userId: data.public_user_data.user_id,
              role,
              status: 'active',
            });

            // Create provider record for the new member
            try {
              const clerkSecretKey = process.env.CLERK_SECRET_KEY;
              if (clerkSecretKey) {
                const userResponse = await fetch(
                  `https://api.clerk.com/v1/users/${data.public_user_data.user_id}`,
                  {
                    headers: {
                      Authorization: `Bearer ${clerkSecretKey}`,
                      'Content-Type': 'application/json',
                    },
                  }
                );

                if (userResponse.ok) {
                  const userData = (await userResponse.json()) as {
                    first_name?: string;
                    last_name?: string;
                    email_addresses?: Array<{
                      email_address: string;
                      id: string;
                    }>;
                    primary_email_address_id?: string;
                  };

                  const name =
                    [userData.first_name, userData.last_name]
                      .filter(Boolean)
                      .join(' ') || 'Provider User';

                  const email =
                    userData.email_addresses?.find(
                      (e) => e.id === userData.primary_email_address_id
                    )?.email_address ||
                    userData.email_addresses?.[0]?.email_address ||
                    'provider@example.com';

                  await convex.mutation(api.providers.createOrUpdateProvider, {
                    userId: data.public_user_data.user_id,
                    name,
                    email,
                    orgId: org._id,
                  });

                  console.log('[Clerk Webhook] Created provider record for new member:', {
                    userId: data.public_user_data.user_id,
                    name,
                    email,
                    orgId: org._id,
                  });
                }
              }
            } catch (error) {
              console.error('[Clerk Webhook] Failed to create provider record:', error);
              // Don't fail the webhook - provider record can be created later
            }
          }
        }
        break;
      }

      case 'organizationMembership.deleted': {
        const data = event.data as {
          organization: { id: string };
          public_user_data: { user_id: string };
        };

        const org = await convex.query(api.organizations.getByClerkOrg, {
          clerkOrgId: data.organization.id,
        });

        if (org) {
          const membership = await convex.query(
            api.memberships.getByOrgAndUser,
            {
              orgId: org._id,
              userId: data.public_user_data.user_id,
            }
          );

          if (membership) {
            // Pass fromClerk flag to avoid calling Clerk API again (circular sync)
            await convex.mutation(api.memberships.deactivate, {
              membershipId: membership._id,
              fromClerk: true,
            });
          }
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Clerk webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
