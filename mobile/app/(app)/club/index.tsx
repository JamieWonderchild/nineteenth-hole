import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import { useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../lib/convex";
import {
  Badge,
  Card,
  EmptyState,
  LoadingSpinner,
  SectionHeader,
} from "../../../components/ui";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m.toString().padStart(2, "0")}${suffix}`;
}

// ── sub-components ────────────────────────────────────────────────────────────

function FeatureTeaser({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View className="flex-1 items-center gap-2 px-2 py-4 bg-white rounded-xl border border-gray-100">
      <View className="w-12 h-12 rounded-full bg-green-50 items-center justify-center">
        <Ionicons name={icon} size={24} color="#16a34a" />
      </View>
      <Text className="text-xs font-semibold text-gray-700 text-center">
        {label}
      </Text>
    </View>
  );
}

function QuickActionButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-1 items-center gap-2 px-2 py-5 bg-white rounded-2xl border border-gray-100 shadow-sm"
    >
      <View className="w-12 h-12 rounded-full bg-green-50 items-center justify-center">
        <Ionicons name={icon} size={26} color="#16a34a" />
      </View>
      <Text className="text-sm font-semibold text-gray-800 text-center">
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── no-membership empty state ─────────────────────────────────────────────────

function NoClubView() {
  const [search, setSearch] = useState("");

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
    >
      {/* hero */}
      <View className="items-center pt-12 pb-8 gap-4">
        <View className="w-24 h-24 rounded-full bg-green-100 items-center justify-center">
          <Ionicons name="flag" size={48} color="#16a34a" />
        </View>
        <Text className="text-2xl font-bold text-gray-900 text-center">
          Connect Your Club
        </Text>
        <Text className="text-base text-gray-500 text-center leading-6">
          Join your club on The 19th Hole to access competitions, book tee
          times, and chat with members.
        </Text>
      </View>

      {/* search */}
      <View className="flex-row items-center bg-white border border-gray-200 rounded-xl px-4 py-3 gap-3 mb-4">
        <Ionicons name="search-outline" size={18} color="#9ca3af" />
        <TextInput
          className="flex-1 text-base text-gray-900"
          placeholder="Search for your club..."
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
      </View>

      {/* invite button */}
      <TouchableOpacity
        onPress={() =>
          Alert.alert(
            "Coming soon",
            "We'll let you generate an invite link for your club."
          )
        }
        className="bg-green-600 rounded-full py-4 items-center mb-10"
      >
        <Text className="text-white font-semibold text-base">
          Invite Your Club
        </Text>
      </TouchableOpacity>

      {/* feature teasers */}
      <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
        What you'll get
      </Text>
      <View className="flex-row gap-3">
        <FeatureTeaser icon="trophy-outline" label="Competitions" />
        <FeatureTeaser icon="calendar-outline" label="Tee Times" />
        <FeatureTeaser icon="chatbubble-outline" label="Messaging" />
      </View>
    </ScrollView>
  );
}

// ── main screen ───────────────────────────────────────────────────────────────

export default function ClubScreen() {
  const { user } = useUser();
  const router = useRouter();
  const userId = user?.id ?? "";

  const clubs = useQuery(api.clubMembers.myActiveClubs, {});

  const [selectedIdx, setSelectedIdx] = useState(0);

  if (clubs === undefined) {
    return (
      <>
        <Stack.Screen options={{ title: "Club", headerShown: false }} />
        <LoadingSpinner fullScreen />
      </>
    );
  }

  if (clubs.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: "Club", headerShown: false }} />
        <NoClubView />
      </>
    );
  }

  const { membership, club } =
    clubs[Math.min(selectedIdx, clubs.length - 1)];
  const clubId = club._id;

  return (
    <>
      <Stack.Screen options={{ title: "Club", headerShown: false }} />
      <ClubDashboard
        clubs={clubs}
        selectedIdx={selectedIdx}
        onSelectClub={setSelectedIdx}
        clubId={clubId}
        clubName={club.name}
        userId={userId}
        membership={membership}
        router={router}
      />
    </>
  );
}

// ── dashboard for a club member ───────────────────────────────────────────────

function ClubDashboard({
  clubs,
  selectedIdx,
  onSelectClub,
  clubId,
  clubName,
  userId,
  membership,
  router,
}: {
  clubs: Array<{ membership: any; club: any }>;
  selectedIdx: number;
  onSelectClub: (i: number) => void;
  clubId: string;
  clubName: string;
  userId: string;
  membership: any;
  router: ReturnType<typeof useRouter>;
}) {
  const activeComps = useQuery(
    api.competitions.listActiveForClub,
    clubId ? { clubId: clubId as any } : "skip"
  );

  const myBookings = useQuery(
    api.teeTimes.listMyBookings,
    clubId && userId ? { clubId: clubId as any, userId } : "skip"
  );

  const nextBooking = myBookings?.[0] ?? null;

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      {/* header */}
      <View className="bg-white border-b border-gray-100 px-4 pt-14 pb-4">
        <View className="flex-row items-center gap-2 mb-1">
          <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center">
            <Ionicons name="golf-outline" size={22} color="#16a34a" />
          </View>
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-900">{clubName}</Text>
            <Text className="text-xs text-gray-500 capitalize">
              {membership.role}
            </Text>
          </View>
        </View>

        {/* club picker (multi-club members) */}
        {clubs.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3 -mx-1"
          >
            {clubs.map(({ club }, i) => (
              <TouchableOpacity
                key={club._id}
                onPress={() => onSelectClub(i)}
                className={`mx-1 px-4 py-1.5 rounded-full border ${
                  i === selectedIdx
                    ? "bg-green-600 border-green-600"
                    : "bg-white border-gray-200"
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    i === selectedIdx ? "text-white" : "text-gray-700"
                  }`}
                >
                  {club.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* quick actions 2x2 */}
      <View className="px-4 pt-5 mb-4">
        <SectionHeader title="Quick Actions" />
        <View className="flex-row gap-3 mb-3">
          <QuickActionButton
            icon="trophy-outline"
            label="Competitions"
            onPress={() =>
              router.push("/(app)/club/competitions" as any)
            }
          />
          <QuickActionButton
            icon="calendar-outline"
            label="Tee Times"
            onPress={() => router.push("/(app)/club/tee-times" as any)}
          />
        </View>
        <View className="flex-row gap-3">
          <QuickActionButton
            icon="chatbubble-ellipses-outline"
            label="Messages"
            onPress={() =>
              router.push("/(app)/club/messages" as any)
            }
          />
          <QuickActionButton
            icon="people-outline"
            label="Members"
            onPress={() =>
              router.push("/(app)/club/members" as any)
            }
          />
        </View>
      </View>

      {/* today's competitions */}
      <View className="px-4 mb-4">
        <SectionHeader
          title="Today's Competitions"
          action={{
            label: "All",
            onPress: () =>
              router.push("/(app)/club/competitions" as any),
          }}
        />
        {activeComps === undefined ? (
          <LoadingSpinner />
        ) : activeComps.length === 0 ? (
          <Card className="p-4">
            <Text className="text-gray-400 text-sm text-center">
              No active competitions today
            </Text>
          </Card>
        ) : (
          <View className="gap-2">
            {activeComps.slice(0, 3).map((comp: any) => (
              <TouchableOpacity
                key={comp._id}
                onPress={() =>
                  router.push(`/(app)/club/competitions/${comp._id}` as any)
                }
              >
                <Card className="p-4 flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-full bg-green-50 items-center justify-center">
                    <Ionicons name="trophy-outline" size={20} color="#16a34a" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold text-gray-900">
                      {comp.name}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-0.5">
                      {comp.scoringFormat ?? "Stableford"} ·{" "}
                      {formatDate(comp.startDate)}
                    </Text>
                  </View>
                  <Badge variant="success">Live</Badge>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color="#d1d5db"
                  />
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* next tee time */}
      <View className="px-4">
        <SectionHeader
          title="Next Tee Time"
          action={{
            label: "Book",
            onPress: () => router.push("/(app)/club/tee-times" as any),
          }}
        />
        {myBookings === undefined ? (
          <LoadingSpinner />
        ) : !nextBooking ? (
          <Card className="p-4">
            <Text className="text-gray-400 text-sm text-center">
              No upcoming tee times
            </Text>
          </Card>
        ) : (
          <Card className="p-4 flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-full bg-green-50 items-center justify-center">
              <Ionicons name="calendar-outline" size={20} color="#16a34a" />
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-gray-900">
                {formatDate(nextBooking.date)}
              </Text>
              <Text className="text-xs text-gray-500 mt-0.5">
                {formatTime(nextBooking.time)} ·{" "}
                {nextBooking.playerCount}{" "}
                {nextBooking.playerCount === 1 ? "player" : "players"}
              </Text>
            </View>
            <Badge variant="success">Confirmed</Badge>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}
