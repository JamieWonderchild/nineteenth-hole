import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "convex/_generated/api";
import ClubPageClient from "./client";

export async function generateMetadata(
  { params }: { params: Promise<{ clubSlug: string }> }
): Promise<Metadata> {
  const { clubSlug } = await params;
  const club = await fetchQuery(api.clubs.getBySlug, { slug: clubSlug });

  if (!club) {
    return { title: "Club not found — The 19th Hole" };
  }

  const title = `Join ${club.name} — The 19th Hole`;
  const description = `You've been invited to join ${club.name} on The 19th Hole. Access competitions, interclub results, tee time booking, and more.`;

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

export default function ClubPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  return <ClubPageClient params={params} />;
}
