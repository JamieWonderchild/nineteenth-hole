import { ClubContextProvider } from "@/app/providers/club-context-provider";
import { LeaderboardView } from "./LeaderboardView";

export default async function CompetitionPage({
  params,
}: {
  params: Promise<{ clubSlug: string; competitionSlug: string }>;
}) {
  const { clubSlug, competitionSlug } = await params;
  return (
    <ClubContextProvider clubSlug={clubSlug}>
      <LeaderboardView
        clubSlug={clubSlug}
        competitionSlug={competitionSlug}
      />
    </ClubContextProvider>
  );
}
