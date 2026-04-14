import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "../../../../lib/convex";
import { Badge, Card, EmptyState, LoadingSpinner } from "../../../../components/ui";

type Competition = {
  _id: string;
  slug: string;
  name: string;
  description?: string;
  status: "open" | "live" | "complete" | string;
  entryCount?: number;
  entryFee?: number;
  startDate?: number;
  prizeStructure?: Array<{ position: number; percentage: number }>;
};

function statusVariant(status: string): "success" | "warning" | "muted" {
  if (status === "live") return "success";
  if (status === "open") return "warning";
  return "muted";
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatStartDate(ts?: number): string | null {
  if (!ts) return null;
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function topPrizeSummary(prizeStructure?: Array<{ position: number; percentage: number }>): string | null {
  if (!prizeStructure || prizeStructure.length === 0) return null;
  const winner = prizeStructure.find((p) => p.position === 1);
  if (!winner) return null;
  return `${winner.percentage}% winner`;
}

export default function PoolsScreen() {
  const router = useRouter();
  const allPools = useQuery(api.competitions.listPlatform, {});

  if (allPools == null) {
    return <LoadingSpinner fullScreen />;
  }

  if (allPools.length === 0) {
    return (
      <View className="flex-1 bg-gray-50">
        <EmptyState
          icon="trophy-outline"
          title="No pools yet"
          description="Platform tour pools for the majors will appear here."
        />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text className="text-2xl font-bold text-gray-900 mb-1">Tour Pools</Text>
      <Text className="text-gray-500 text-sm mb-5">Pick your squad for the majors</Text>

      <View className="gap-3">
        {allPools.map((pool: Competition) => {
          const prizeSummary = topPrizeSummary(pool.prizeStructure);
          const startDateStr = formatStartDate(pool.startDate);

          return (
            <TouchableOpacity
              key={pool._id}
              onPress={() => router.push(`/play/pools/${pool.slug}` as any)}
            >
              <Card className="px-4 py-4">
                {/* Top row: name + status */}
                <View className="flex-row items-start justify-between mb-2">
                  <Text className="text-lg font-bold text-gray-900 flex-1 mr-3">
                    {pool.name}
                  </Text>
                  <Badge variant={statusVariant(pool.status)}>
                    {statusLabel(pool.status)}
                  </Badge>
                </View>

                {/* Description */}
                {pool.description && (
                  <Text className="text-sm text-gray-500 mb-3 leading-5">
                    {pool.description}
                  </Text>
                )}

                {/* Meta row */}
                <View className="flex-row flex-wrap items-center gap-3">
                  {pool.entryCount != null && (
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="people-outline" size={13} color="#9ca3af" />
                      <Text className="text-xs text-gray-500">{pool.entryCount} entries</Text>
                    </View>
                  )}

                  {pool.entryFee != null && pool.entryFee > 0 && (
                    <View className="bg-green-100 rounded-full px-2.5 py-0.5">
                      <Text className="text-xs font-medium text-green-800">
                        £{(pool.entryFee / 100).toFixed(0)}
                      </Text>
                    </View>
                  )}

                  {prizeSummary && (
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="trophy-outline" size={13} color="#9ca3af" />
                      <Text className="text-xs text-gray-500">{prizeSummary}</Text>
                    </View>
                  )}

                  {startDateStr && (
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="calendar-outline" size={13} color="#9ca3af" />
                      <Text className="text-xs text-gray-500">{startDateStr}</Text>
                    </View>
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}
