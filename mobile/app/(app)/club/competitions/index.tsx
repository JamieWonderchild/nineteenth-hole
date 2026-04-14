import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import { useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../../lib/convex";
import {
  Badge,
  Card,
  EmptyState,
  LoadingSpinner,
  SectionHeader,
} from "../../../../components/ui";

// ── helpers ────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusBadgeVariant(
  status: string
): "success" | "warning" | "muted" | "default" {
  if (status === "live" || status === "open") return "success";
  if (status === "draft") return "warning";
  return "muted";
}

function statusLabel(status: string) {
  if (status === "live") return "Live";
  if (status === "open") return "Open";
  if (status === "draft") return "Upcoming";
  if (status === "complete") return "Complete";
  return status;
}

function formatBadgeVariant(
  format: string
): "default" | "warning" | "muted" {
  if (format === "stableford") return "default";
  if (format === "strokeplay") return "warning";
  return "muted";
}

function formatLabel(format?: string) {
  if (!format) return "Stableford";
  return format.charAt(0).toUpperCase() + format.slice(1);
}

// ── competition card ────────────────────────────────────────────────────────────

type Competition = {
  _id: string;
  name: string;
  scoringFormat?: string;
  startDate: string;
  endDate: string;
  status: string;
  type: string;
};

function CompetitionCard({
  comp,
  onPress,
}: {
  comp: Competition;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress}>
      <Card className="px-4 py-3.5">
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1 mr-2">
            <Text className="font-bold text-gray-900 text-base" numberOfLines={1}>
              {comp.name}
            </Text>
            <Text className="text-xs text-gray-400 mt-0.5">
              {formatDate(comp.startDate)}
              {comp.startDate !== comp.endDate
                ? ` – ${formatDate(comp.endDate)}`
                : ""}
            </Text>
          </View>
          <View className="flex-row gap-1.5 items-center">
            <Badge variant={formatBadgeVariant(comp.scoringFormat ?? "")}>
              {formatLabel(comp.scoringFormat)}
            </Badge>
            <Badge variant={statusBadgeVariant(comp.status)}>
              {statusLabel(comp.status)}
            </Badge>
          </View>
        </View>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-1">
            <Ionicons name="golf-outline" size={13} color="#9ca3af" />
            <Text className="text-xs text-gray-500">Club competition</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

// ── main screen ────────────────────────────────────────────────────────────────

export default function ClubCompetitionsScreen() {
  const { user } = useUser();
  const router = useRouter();

  const clubs = useQuery(api.clubMembers.myActiveClubs, {});

  const [selectedClubIdx] = useState(0);

  const clubId =
    clubs && clubs.length > 0
      ? clubs[Math.min(selectedClubIdx, clubs.length - 1)].club._id
      : null;

  const competitions = useQuery(
    api.competitions.listByClub,
    clubId ? { clubId: clubId as any } : "skip"
  );

  const isLoading = clubs === undefined || competitions === undefined;

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: "Competitions" }} />
        <LoadingSpinner fullScreen />
      </>
    );
  }

  if (!clubId || clubs.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: "Competitions" }} />
        <EmptyState
          icon="trophy-outline"
          title="No club connected"
          description="Join a club to see competitions."
        />
      </>
    );
  }

  const comps = (competitions ?? []) as Competition[];

  const active = comps.filter(
    (c) => c.status === "live" || c.status === "open"
  );
  const upcoming = comps.filter((c) => c.status === "draft");
  const past = comps.filter((c) => c.status === "complete");

  return (
    <>
      <Stack.Screen options={{ title: "Competitions" }} />
      {comps.length === 0 ? (
        <EmptyState
          icon="trophy-outline"
          title="No competitions yet"
          description="Your club hasn't created any competitions yet."
        />
      ) : (
        <ScrollView
          className="flex-1 bg-gray-50"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48, paddingTop: 16 }}
        >
          {active.length > 0 && (
            <View className="mb-6">
              <SectionHeader title="Active" />
              <View className="gap-3">
                {active.map((comp) => (
                  <CompetitionCard
                    key={comp._id}
                    comp={comp}
                    onPress={() =>
                      router.push(`/(app)/club/competitions/${comp._id}` as any)
                    }
                  />
                ))}
              </View>
            </View>
          )}

          {upcoming.length > 0 && (
            <View className="mb-6">
              <SectionHeader title="Upcoming" />
              <View className="gap-3">
                {upcoming.map((comp) => (
                  <CompetitionCard
                    key={comp._id}
                    comp={comp}
                    onPress={() =>
                      router.push(`/(app)/club/competitions/${comp._id}` as any)
                    }
                  />
                ))}
              </View>
            </View>
          )}

          {past.length > 0 && (
            <View>
              <SectionHeader title="Past" />
              <View className="gap-3">
                {past.map((comp) => (
                  <CompetitionCard
                    key={comp._id}
                    comp={comp}
                    onPress={() =>
                      router.push(`/(app)/club/competitions/${comp._id}` as any)
                    }
                  />
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </>
  );
}
