import { ClubContextProvider } from "@/app/providers/club-context-provider";
import { LeaderboardView } from "./LeaderboardView";

export default function CompetitionPage({
  params,
}: {
  params: { clubSlug: string; competitionSlug: string };
}) {
  return (
    <ClubContextProvider clubSlug={params.clubSlug}>
      <LeaderboardView
        clubSlug={params.clubSlug}
        competitionSlug={params.competitionSlug}
      />
    </ClubContextProvider>
  );
}
