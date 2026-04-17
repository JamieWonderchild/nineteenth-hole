import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/clerk-expo";
import { api } from "../../../lib/convex";
import { Badge, Card, SectionHeader, LoadingSpinner } from "../../../components/ui";

const FORMAT_CARDS = [
  { type: "stableford", label: "Stableford", icon: "golf" as const, color: "bg-green-50", iconColor: "#16a34a" },
  { type: "strokeplay", label: "Strokeplay", icon: "flag" as const, color: "bg-blue-50", iconColor: "#2563eb" },
  { type: "skins", label: "Skins", icon: "cash" as const, color: "bg-amber-50", iconColor: "#d97706" },
  { type: "nassau", label: "Nassau", icon: "shuffle" as const, color: "bg-purple-50", iconColor: "#7c3aed" },
] as const;

function statusVariant(status: string): "success" | "warning" | "muted" {
  if (status === "live") return "success";
  if (status === "open") return "warning";
  return "muted";
}

export default function PlayScreen() {
  const router = useRouter();
  const { user } = useUser();

  const myGames = useQuery(
    api.quickGames.listByUser,
    user?.id ? { userId: user.id } : "skip"
  );
  const activePools = useQuery(api.competitions.listPlatformActive, {});

  const activeGameCount =
    myGames?.filter((g: any) => g.status === "active").length ?? 0;

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="px-4 pt-6 gap-6">
        {/* Quick Games section */}
        <View>
          <SectionHeader
            title="Quick Games"
            action={{ label: "My Games", onPress: () => router.push("/play/games") }}
          />
          <Text className="text-gray-500 text-sm mb-4">Play with friends, track scores live</Text>

          {/* Format cards row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4">
            <View className="flex-row gap-3">
              {FORMAT_CARDS.map((f) => (
                <TouchableOpacity
                  key={f.type}
                  onPress={() => router.push(`/play/games/new?type=${f.type}` as any)}
                  className={`w-24 h-24 rounded-xl items-center justify-center gap-1 ${f.color}`}
                >
                  <Ionicons name={f.icon} size={28} color={f.iconColor} />
                  <Text className="text-xs font-semibold text-gray-700 text-center">{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* My Games button */}
          <TouchableOpacity
            onPress={() => router.push("/play/games")}
            className="mt-4"
          >
            <Card className="px-4 py-3 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="w-9 h-9 rounded-full bg-green-100 items-center justify-center">
                  <Ionicons name="list" size={18} color="#16a34a" />
                </View>
                <View>
                  <Text className="font-semibold text-gray-900">My Games</Text>
                  <Text className="text-xs text-gray-500">
                    {myGames == null
                      ? "Loading..."
                      : activeGameCount > 0
                      ? `${activeGameCount} active game${activeGameCount !== 1 ? "s" : ""}`
                      : "No active games"}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </Card>
          </TouchableOpacity>
        </View>

        {/* Golf Trips section */}
        <View>
          <SectionHeader
            title="Golf Trips"
            action={{ label: "View All", onPress: () => router.push("/play/trips" as any) }}
          />
          <Text className="text-gray-500 text-sm mb-4">Multi-day trips with friends</Text>
          <TouchableOpacity onPress={() => router.push("/play/trips" as any)}>
            <Card className="px-4 py-3 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="w-9 h-9 rounded-full bg-green-100 items-center justify-center">
                  <Ionicons name="airplane-outline" size={18} color="#16a34a" />
                </View>
                <View>
                  <Text className="font-semibold text-gray-900">My Trips</Text>
                  <Text className="text-xs text-gray-500">View itineraries & invites</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </Card>
          </TouchableOpacity>
        </View>

        {/* Interclub section */}
        <View>
          <SectionHeader
            title="Interclub"
            action={{ label: "My Fixtures", onPress: () => router.push("/play/interclub" as any) }}
          />
          <Text className="text-gray-500 text-sm mb-4">County league & matchplay fixtures</Text>
          <TouchableOpacity onPress={() => router.push("/play/interclub" as any)}>
            <Card className="px-4 py-3 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="w-9 h-9 rounded-full bg-green-100 items-center justify-center">
                  <Ionicons name="trophy-outline" size={18} color="#16a34a" />
                </View>
                <View>
                  <Text className="font-semibold text-gray-900">My Fixtures</Text>
                  <Text className="text-xs text-gray-500">Score and follow matches live</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </Card>
          </TouchableOpacity>
        </View>

        {/* Course Directory section */}
        <View>
          <SectionHeader title="Course Directory" />
          <Text className="text-gray-500 text-sm mb-4">Find courses, check tees & ratings</Text>
          <TouchableOpacity onPress={() => router.push("/(app)/courses" as any)}>
            <Card className="px-4 py-3 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="w-9 h-9 rounded-full bg-green-100 items-center justify-center">
                  <Ionicons name="map-outline" size={18} color="#16a34a" />
                </View>
                <View>
                  <Text className="font-semibold text-gray-900">Courses</Text>
                  <Text className="text-xs text-gray-500">Search & browse golf courses</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </Card>
          </TouchableOpacity>
        </View>

        {/* Platform Pools section */}
        <View>
          <SectionHeader
            title="Tour Pools"
            action={{ label: "View All", onPress: () => router.push("/play/pools") }}
          />
          <Text className="text-gray-500 text-sm mb-4">Pick your squad for the majors</Text>

          {activePools == null ? (
            <View className="py-6 items-center">
              <LoadingSpinner />
            </View>
          ) : activePools.length === 0 ? (
            <Card className="px-4 py-6 items-center">
              <Text className="text-gray-500 text-sm">No active pools right now</Text>
            </Card>
          ) : (
            <View className="gap-3">
              {activePools.slice(0, 3).map((pool: any) => (
                <TouchableOpacity
                  key={pool._id}
                  onPress={() => router.push(`/play/pools/${pool.slug}` as any)}
                >
                  <Card className="px-4 py-3">
                    <View className="flex-row items-start justify-between mb-2">
                      <Text className="text-base font-bold text-gray-900 flex-1 mr-2">
                        {pool.name}
                      </Text>
                      <Badge variant={statusVariant(pool.status)}>
                        {pool.status.charAt(0).toUpperCase() + pool.status.slice(1)}
                      </Badge>
                    </View>
                    <View className="flex-row items-center gap-4">
                      <Text className="text-xs text-gray-500">
                        {pool.entryCount ?? 0} entries
                      </Text>
                      {pool.entryDeadline && (
                        <Text className="text-xs text-gray-500">
                          Closes {new Date(pool.entryDeadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </Text>
                      )}
                      {pool.entryFee > 0 && (
                        <Badge variant="default">
                          £{(pool.entryFee / 100).toFixed(0)}
                        </Badge>
                      )}
                    </View>
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
