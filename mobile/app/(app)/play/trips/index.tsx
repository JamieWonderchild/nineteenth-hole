import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/clerk-expo";
import { api } from "../../../../lib/convex";
import { LoadingSpinner } from "../../../../components/ui";
import { Stack } from "expo-router";

const STATUS_COLOUR: Record<string, { bg: string; text: string }> = {
  planning: { bg: "#fef3c7", text: "#92400e" },
  confirmed: { bg: "#dcfce7", text: "#166534" },
  completed: { bg: "#f3f4f6", text: "#6b7280" },
};

function formatDateRange(start: string, end: string) {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  if (s.getMonth() !== e.getMonth() || s.getFullYear() !== e.getFullYear()) {
    return `${s.toLocaleDateString("en-GB", opts)} – ${e.toLocaleDateString("en-GB", opts)}`;
  }
  return `${s.getDate()}–${e.getDate()} ${s.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`;
}

export default function TripsScreen() {
  const router = useRouter();
  const { user } = useUser();
  const trips = useQuery(api.trips.listMine, user ? {} : "skip");

  const pending = trips?.filter((t: any) => t.myStatus === "invited") ?? [];
  const active = trips?.filter((t: any) => t.myStatus !== "invited") ?? [];

  return (
    <>
      <Stack.Screen options={{ title: "Golf Trips" }} />
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4 pt-4 gap-4">

          {trips == null ? (
            <View className="py-12 items-center">
              <LoadingSpinner />
            </View>
          ) : trips.length === 0 ? (
            <View className="py-16 items-center gap-3">
              <Ionicons name="airplane-outline" size={40} color="#d1d5db" />
              <Text className="text-gray-500 font-medium">No trips yet</Text>
              <Text className="text-xs text-gray-400 text-center">
                Create trips on the web at playthepool.golf/trips
              </Text>
            </View>
          ) : (
            <>
              {pending.length > 0 && (
                <View className="gap-2">
                  <Text className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                    Invites ({pending.length})
                  </Text>
                  {pending.map((trip: any) => (
                    <TripCard key={trip._id} trip={trip} onPress={() => router.push(`/play/trips/${trip._id}` as any)} />
                  ))}
                </View>
              )}

              {active.length > 0 && (
                <View className="gap-2">
                  {pending.length > 0 && (
                    <Text className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                      My Trips
                    </Text>
                  )}
                  {active.map((trip: any) => (
                    <TripCard key={trip._id} trip={trip} onPress={() => router.push(`/play/trips/${trip._id}` as any)} />
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </>
  );
}

function TripCard({ trip, onPress }: { trip: any; onPress: () => void }) {
  const colour = STATUS_COLOUR[trip.status] ?? STATUS_COLOUR.planning;
  const nights = Math.round(
    (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86400000
  );
  return (
    <TouchableOpacity onPress={onPress}>
      <View className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex-row items-center gap-3">
        <View className="w-10 h-10 rounded-xl bg-green-50 items-center justify-center flex-shrink-0">
          <Ionicons name="airplane" size={18} color="#16a34a" />
        </View>
        <View className="flex-1 min-w-0">
          <View className="flex-row items-center gap-2 mb-0.5">
            <Text className="text-sm font-semibold text-gray-900 flex-shrink truncate" numberOfLines={1}>
              {trip.name}
            </Text>
            <View style={{ backgroundColor: colour.bg }} className="rounded-full px-2 py-0.5">
              <Text style={{ color: colour.text }} className="text-xs font-medium capitalize">
                {trip.status}
              </Text>
            </View>
          </View>
          <Text className="text-xs text-gray-500">
            {formatDateRange(trip.startDate, trip.endDate)} · {nights} night{nights !== 1 ? "s" : ""} · {trip.memberCount} players
          </Text>
          {trip.myStatus === "invited" && (
            <Text className="text-xs text-green-600 font-medium mt-0.5">Invited — tap to respond</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
      </View>
    </TouchableOpacity>
  );
}
