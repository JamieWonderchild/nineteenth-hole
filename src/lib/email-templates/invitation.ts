export interface InvitationEmailProps {
  inviterName: string;
  organizationName: string;
  role: string;
  acceptUrl: string;
  expiresAt: string;
}

export function renderInvitationEmail({
  inviterName,
  organizationName,
  role,
  acceptUrl,
  expiresAt,
}: InvitationEmailProps): string {
  const roleLabel = role === 'admin' ? 'Admin' : role === 'practice-admin' ? 'Practice Admin' : 'Provider';
  const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Join ${organizationName} on [PRODUCT_NAME]</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header with Logo -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 12px 12px 0 0;">
              <div style="background-color: white; width: 60px; height: 60px; border-radius: 12px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7V13C2 18 6 21.5 12 22C18 21.5 22 18 22 13V7L12 2Z" fill="#3b82f6"/>
                  <path d="M12 8V16M8 12H16" stroke="white" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </div>
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">You're Invited!</h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 24px;">
                <strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on [PRODUCT_NAME].
              </p>

              <div style="background-color: #f9fafb; border-left: 4px solid #3b82f6; padding: 16px 20px; margin: 24px 0; border-radius: 8px;">
                <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px; font-weight: 500;">Your Role</p>
                <p style="margin: 0; color: #111827; font-size: 18px; font-weight: 600;">${roleLabel}</p>
              </div>

              <p style="margin: 0 0 28px; color: #6b7280; font-size: 15px; line-height: 22px;">
                [PRODUCT_NAME] helps clinical practices streamline encounters with AI-powered documentation, owner communication tools, and intelligent workflow automation.
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td style="text-align: center; padding: 0 0 24px;">
                    <a href="${acceptUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Features List -->
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 12px; color: #111827; font-size: 15px; font-weight: 600;">What you'll get:</p>
                <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 14px; line-height: 24px;">
                  <li style="margin-bottom: 8px;">AI-powered encounter documentation</li>
                  <li style="margin-bottom: 8px;">Automated SOAP notes & discharge instructions</li>
                  <li style="margin-bottom: 8px;">Owner companion AI for post-visit support</li>
                  <li style="margin-bottom: 0;">Team collaboration & workflow tools</li>
                </ul>
              </div>

              <!-- Expiration Notice -->
              <p style="margin: 0; padding: 16px; background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; color: #92400e; font-size: 13px; line-height: 20px;">
                ⏰ This invitation expires on <strong>${expiryDate}</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #e5e7eb; background-color: #f9fafb; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 20px;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 16px; color: #3b82f6; font-size: 12px; word-break: break-all;">
                ${acceptUrl}
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 18px;">
                If you weren't expecting this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Branding Footer -->
          <tr>
            <td style="padding: 20px; text-align: center;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                Sent by <strong style="color: #6b7280;">[PRODUCT_NAME]</strong> • AI-powered clinical practice management
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
