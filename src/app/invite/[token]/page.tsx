import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "convex/_generated/api";
import InvitePageClient from "./client";

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> }
): Promise<Metadata> {
  const { token } = await params;
  const result = await fetchQuery(api.invites.getByToken, { token });

  const clubName = result?.club?.name;
  const title = clubName
    ? `You've been invited to join ${clubName}`
    : "You've been invited — The 19th Hole";
  const description = clubName
    ? `Join ${clubName} on The 19th Hole — competitions, interclub results, tee time booking, and more.`
    : "You have a personal invitation to join a golf club on The 19th Hole.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "The 19th Hole",
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  return <InvitePageClient params={params} />;
}
