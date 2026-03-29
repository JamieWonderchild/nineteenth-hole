// Superadmin detection
// Env var: NEXT_PUBLIC_SUPERADMIN_EMAILS=you@example.com,other@example.com

const SUPERADMIN_EMAILS: string[] = (
  process.env.NEXT_PUBLIC_SUPERADMIN_EMAILS || ''
)
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isSuperadmin(email: string | undefined | null): boolean {
  if (!email) return false;
  return SUPERADMIN_EMAILS.includes(email.toLowerCase());
}
