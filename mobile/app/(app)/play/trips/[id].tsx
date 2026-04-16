import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/clerk-expo";
import { api } from "../../../../lib/convex";
import type { Id } from "../../../../lib/convex";
import { LoadingSpinner } from "../../../../components/ui";

// ── Helpers ───────────────────────────────────────────────────────────────────

const FORMAT_LABEL: Record<string, string> = {
  stableford: "Stableford",
  strokeplay: "Strokeplay",
  matchplay: "Matchplay",
  scramble: "Scramble",
  fourball: "Fourball",
  rest: "Rest Day",
};

const MEMBER_STATUS_COLOUR: Record<string, { bg: string; text: string }> = {
  organiser: { bg: "#dcfce7", text: "#166534" },
  accepted: { bg: "#dbeafe", text: "#1e40af" },
  invited: { bg: "#fef3c7", text: "#92400e" },
  declined: { bg: "#f3f4f6", text: "#6b7280" },
};

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  });
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  return `${s.toLocaleDateString("en-GB", opts)} – ${e.toLocaleDateString("en-GB", opts)}`;
}

function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (cur <= last) {
    dates.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useUser();
  const respond = useMutation(api.trips.respond);

  const trip = useQuery(api.trips.get, id ? { tripId: id as Id<"golfTrips"> } : "skip");

  const myMembership = trip?.members?.find((m: any) => m.userId === user?.id);
  const isPending = myMembership?.status === "invited";

  function handleRespond(accept: boolean) {
    Alert.alert(
      accept ? "Join trip?" : "Decline invite?",
      accept ? `You'll be added to ${trip?.name}.` : `You'll decline the invite to ${trip?.name}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: accept ? "Accept" : "Decline",
          style: accept ? "default" : "destructive",
          onPress: () => respond({ tripId: id as Id<"golfTrips">, accept }),
        },
      ]
    );
  }

  if (trip === undefined) {
    return (
      <View className="flex-1 items-center justify-center">
        <LoadingSpinner />
      </View>
    );
  }

  if (trip === null) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-gray-500 text-center">Trip not found or you don't have access.</Text>
      </View>
    );
  }

  const allDates = getDatesInRange(trip.startDate, trip.endDate);
  const dayMap = new Map(trip.days.map((d: any) => [d.date, d]));
  const nights = allDates.length - 1;

  return (
    <>
      <Stack.Screen options={{ title: trip.name }} />
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-4 pt-4 gap-5">

          {/* Header card */}
          <View className="bg-white rounded-xl border border-gray-200 px-4 py-4 gap-2">
            <Text className="text-lg font-bold text-gray-900">{trip.name}</Text>
            {trip.description ? (
              <Text className="text-sm text-gray-500">{trip.description}</Text>
            ) : null}
            <Text className="text-xs text-gray-400">
              {formatDateRange(trip.startDate, trip.endDate)} · {nights} night{nights !== 1 ? "s" : ""}
            </Text>
            <View className="flex-row items-center gap-2 pt-1">
              <View className="px-2 py-0.5 rounded-full bg-gray-100">
                <Text className="text-xs text-gray-500 capitalize">{trip.status}</Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Ionicons name="people-outline" size={12} color="#9ca3af" />
                <Text className="text-xs text-gray-500">{trip.members.length} players</Text>
              </View>
            </View>
          </View>

          {/* Invite banner */}
          {isPending && (
            <View className="bg-green-50 border border-green-300 rounded-xl px-4 py-4">
              <Text className="text-sm font-semibold text-green-800 mb-3">
                You've been invited to this trip
              </Text>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => handleRespond(true)}
                  className="flex-1 bg-green-600 rounded-xl py-2.5 items-center"
                >
                  <Text className="text-white text-sm font-semibold">Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleRespond(false)}
                  className="flex-1 bg-white border border-gray-200 rounded-xl py-2.5 items-center"
                >
                  <Text className="text-gray-700 text-sm font-medium">Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Itinerary */}
          <View className="gap-2">
            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
              Itinerary
            </Text>
            {allDates.map((date, i) => {
              const day = dayMap.get(date) as any | undefined;
              return (
                <View
                  key={date}
                  className={`rounded-xl border px-4 py-3 flex-row items-start gap-3 ${day ? "bg-white border-gray-200" : "bg-gray-50 border-dashed border-gray-200"}`}
                >
                  <View className="w-7 h-7 rounded-full bg-gray-100 items-center justify-center mt-0.5">
                    <Text className="text-xs font-bold text-gray-500">{i + 1}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-gray-700">{formatDate(date)}</Text>
                    {day ? (
                      <View className="mt-0.5">
                        <Text className="text-sm text-gray-600">
                          {FORMAT_LABEL[day.format] ?? day.format}
                          {day.courseNameFreetext ? ` · ${day.courseNameFreetext}` : ""}
                        </Text>
                        {day.notes ? (
                          <Text className="text-xs text-gray-400 mt-0.5">{day.notes}</Text>
                        ) : null}
                      </View>
                    ) : (
                      <Text className="text-xs text-gray-400 mt-0.5">Not planned yet</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Players */}
          <View className="gap-2">
            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
              Players
            </Text>
            <View className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
              {trip.members.map((m: any) => {
                const colour = MEMBER_STATUS_COLOUR[m.status] ?? MEMBER_STATUS_COLOUR.invited;
                return (
                  <View key={m._id} className="flex-row items-center justify-between px-4 py-3">
                    <View className="flex-row items-center gap-3">
                      <View className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center">
                        <Text className="text-sm font-semibold text-gray-600">
                          {m.displayName?.[0]?.toUpperCase() ?? "?"}
                        </Text>
                      </View>
                      <Text className="text-sm font-medium text-gray-900">{m.displayName}</Text>
                    </View>
                    <View style={{ backgroundColor: colour.bg }} className="rounded-full px-2 py-0.5">
                      <Text style={{ color: colour.text }} className="text-xs font-medium capitalize">
                        {m.status === "organiser" ? "Organiser" : m.status}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

        </View>
      </ScrollView>
    </>
  );
}
