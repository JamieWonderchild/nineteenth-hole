import { ClubContextProvider } from "@/app/providers/club-context-provider";
import { EntryForm } from "./EntryForm";

export default function EnterPage({
  params,
}: {
  params: { clubSlug: string; competitionSlug: string };
}) {
  return (
    <ClubContextProvider clubSlug={params.clubSlug}>
      <EntryForm clubSlug={params.clubSlug} competitionSlug={params.competitionSlug} />
    </ClubContextProvider>
  );
}
