import { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import { useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../../lib/convex";
import { EmptyState, LoadingSpinner } from "../../../../components/ui";

// ── helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase();
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

const ROLE_ORDER: Record<string, number> = { admin: 0, staff: 1, member: 2 };

function roleOrder(role: string): number {
  return ROLE_ORDER[role] ?? 3;
}

type Member = {
  _id: string;
  userId?: string;
  displayName: string;
  role: string;
  avatarUrl?: string;
  totalWon: number;
  handicapIndex?: number;
};

// ── sub-components ─────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  if (role === "admin") {
    return (
      <View className="bg-green-100 rounded-full px-2 py-0.5">
        <Text className="text-xs font-semibold text-green-700">Admin</Text>
      </View>
    );
  }
  if (role === "staff") {
    return (
      <View className="bg-blue-100 rounded-full px-2 py-0.5">
        <Text className="text-xs font-semibold text-blue-700">Staff</Text>
      </View>
    );
  }
  return (
    <View className="bg-gray-100 rounded-full px-2 py-0.5">
      <Text className="text-xs font-semibold text-gray-500">Member</Text>
    </View>
  );
}

function MemberRow({ member, onPress }: { member: Member; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} className="flex-row items-center px-4 py-3.5 bg-white border-b border-gray-50">
      {/* Avatar */}
      <View className="w-11 h-11 rounded-full bg-green-600 items-center justify-center mr-3">
        <Text className="text-white text-sm font-bold">
          {getInitials(member.displayName)}
        </Text>
      </View>

      {/* Name + role */}
      <View className="flex-1 gap-1">
        <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
          {member.displayName}
        </Text>
        <RoleBadge role={member.role} />
      </View>

      {/* Handicap */}
      {member.handicapIndex !== undefined && member.handicapIndex !== null ? (
        <View className="items-end mr-2">
          <Text className="text-xs text-gray-400 mb-0.5">HCP</Text>
          <Text className="text-base font-bold text-gray-900">
            {member.handicapIndex.toFixed(1)}
          </Text>
        </View>
      ) : (
        <View className="w-4" />
      )}
      <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
    </TouchableOpacity>
  );
}

function SkeletonRow() {
  return (
    <View className="flex-row items-center px-4 py-3.5 bg-white border-b border-gray-50">
      <View className="w-11 h-11 rounded-full bg-gray-200 mr-3" />
      <View className="flex-1 gap-2">
        <View className="h-4 bg-gray-200 rounded w-32" />
        <View className="h-3 bg-gray-100 rounded w-16" />
      </View>
      <View className="h-4 bg-gray-100 rounded w-8" />
    </View>
  );
}

// ── main screen ───────────────────────────────────────────────────────────────

export default function MembersScreen() {
  const { user } = useUser();
  const router = useRouter();
  const userId = user?.id ?? "";

  const [search, setSearch] = useState("");

  // Get the user's active clubs to find the current clubId
  const clubs = useQuery(api.clubMembers.myActiveClubs, {});
  const clubId = clubs?.[0]?.club._id;

  const rawMembers = useQuery(
    api.clubMembers.listWithProfiles,
    clubId ? { clubId: clubId as any } : "skip"
  );

  const isLoading = clubs === undefined || (clubId && rawMembers === undefined);

  const sortedMembers = useMemo(() => {
    if (!rawMembers) return [];
    const filtered = search.trim()
      ? rawMembers.filter(m =>
          m.displayName.toLowerCase().includes(search.toLowerCase())
        )
      : rawMembers;

    return [...filtered].sort((a, b) => {
      const roleDiff = roleOrder(a.role) - roleOrder(b.role);
      if (roleDiff !== 0) return roleDiff;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [rawMembers, search]);

  return (
    <>
      <Stack.Screen options={{ title: "Members" }} />

      {/* Search bar */}
      <View className="bg-white border-b border-gray-100 px-4 py-3">
        <View className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2.5 gap-2">
          <Ionicons name="search-outline" size={16} color="#9ca3af" />
          <TextInput
            className="flex-1 text-base text-gray-900"
            placeholder="Search members..."
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 bg-white">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </View>
      ) : !clubId ? (
        <EmptyState
          icon="people-outline"
          title="No club found"
          description="Join a club to view the member directory."
        />
      ) : (
        <FlatList
          className="flex-1 bg-white"
          data={sortedMembers}
          keyExtractor={item => item._id}
          renderItem={({ item }) => (
            <MemberRow
              member={item as Member}
              onPress={() => router.push(`/(app)/club/members/${item._id}` as any)}
            />
          )}
          ListEmptyComponent={
            search ? (
              <EmptyState
                icon="search-outline"
                title="No results"
                description={`No members matching "${search}"`}
              />
            ) : (
              <EmptyState
                icon="people-outline"
                title="No members yet"
                description="Club members will appear here once they join."
              />
            )
          }
          contentContainerStyle={
            sortedMembers.length === 0 ? { flexGrow: 1 } : { paddingBottom: 32 }
          }
          ListHeaderComponent={
            sortedMembers.length > 0 ? (
              <View className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <Text className="text-xs text-gray-400 font-medium">
                  {sortedMembers.length} {sortedMembers.length === 1 ? "member" : "members"}
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </>
  );
}
