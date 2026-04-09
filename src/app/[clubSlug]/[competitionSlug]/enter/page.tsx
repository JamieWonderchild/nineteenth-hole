import { ClubContextProvider } from "@/app/providers/club-context-provider";
import { EntryForm } from "./EntryForm";

export default async function EnterPage({
  params,
}: {
  params: Promise<{ clubSlug: string; competitionSlug: string }>;
}) {
  const { clubSlug, competitionSlug } = await params;
  return (
    <ClubContextProvider clubSlug={clubSlug}>
      <EntryForm clubSlug={clubSlug} competitionSlug={competitionSlug} />
    </ClubContextProvider>
  );
}
