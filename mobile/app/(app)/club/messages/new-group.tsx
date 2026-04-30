/**
 * New Group — enter a group name, search and select members, then create.
 */
import { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import { useQuery, useMutation } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../../lib/convex";
import { LoadingSpinner, EmptyState } from "../../../../components/ui";

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase();
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

type Member = {
  _id: string;
  userId?: string;
  displayName: string;
  avatarUrl?: string;
};

export default function NewGroupScreen() {
  const { user } = useUser();
  const router = useRouter();

  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Map<string, Member>>(new Map());
  const [creating, setCreating] = useState(false);

  const clubs = useQuery(api.clubMembers.myActiveClubs, {});
  const clubId = clubs?.[0]?.club._id;

  const rawMembers = useQuery(
    api.clubMembers.listWithProfiles,
    clubId ? { clubId: clubId as any } : "skip"
  );

  const createGroup = useMutation(api.messaging.createGroup);

  const members = useMemo(() => {
    if (!rawMembers) return [];
    const others = (rawMembers as Member[]).filter(m => m.userId && m.userId !== user?.id);
    const q = search.trim().toLowerCase();
    return q
      ? others.filter(m => m.displayName.toLowerCase().includes(q))
      : [...others].sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [rawMembers, search, user?.id]);

  function toggleMember(member: Member) {
    if (!member.userId) return;
    setSelected(prev => {
      const next = new Map(prev);
      if (next.has(member.userId!)) {
        next.delete(member.userId!);
      } else {
        next.set(member.userId!, member);
      }
      return next;
    });
  }

  async function handleCreate() {
    const name = groupName.trim();
    if (!name) {
      Alert.alert("Group name required", "Please enter a name for the group.");
      return;
    }
    if (selected.size === 0) {
      Alert.alert("No members selected", "Please select at least one member to add.");
      return;
    }
    if (!user) return;

    setCreating(true);
    try {
      const members = Array.from(selected.values()).map(m => ({
        userId: m.userId!,
        displayName: m.displayName,
        avatarUrl: m.avatarUrl,
      }));

      const convId = await createGroup({
        name,
        clubId: clubId as any,
        members,
        createdByUserId: user.id,
        createdByDisplayName: user.fullName ?? user.username ?? "Me",
        createdByAvatarUrl: user.imageUrl ?? undefined,
      });

      // Replace this screen with the new group thread
      router.replace(`/(app)/club/messages/${convId}` as any);
    } catch (e: any) {
      Alert.alert("Failed to create group", e?.message ?? "Please try again.");
      setCreating(false);
    }
  }

  const isLoading = clubs === undefined || (clubId && rawMembers === undefined);
  const canCreate = groupName.trim().length > 0 && selected.size > 0 && !creating;
  const selectedList = Array.from(selected.values());

  return (
    <>
      <Stack.Screen
        options={{
          title: "New Group",
          headerRight: () => (
            <TouchableOpacity
              onPress={handleCreate}
              disabled={!canCreate}
              className="mr-1"
            >
              <Text
                className={`text-base font-semibold ${canCreate ? "text-green-700" : "text-gray-300"}`}
              >
                {creating ? "Creating…" : "Create"}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />

      {isLoading ? (
        <LoadingSpinner fullScreen />
      ) : (
        <View className="flex-1 bg-white">
          {/* Group name input */}
          <View className="px-4 pt-4 pb-3 border-b border-gray-100">
            <TextInput
              className="text-base text-gray-900 border border-gray-200 rounded-xl px-4 py-3 bg-gray-50"
              placeholder="Group name…"
              placeholderTextColor="#9ca3af"
              value={groupName}
              onChangeText={setGroupName}
              returnKeyType="next"
              autoFocus
            />
          </View>

          {/* Selected members chips */}
          {selectedList.length > 0 && (
            <View className="border-b border-gray-100">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
              >
                {selectedList.map(m => (
                  <TouchableOpacity
                    key={m.userId}
                    onPress={() => toggleMember(m)}
                    className="flex-row items-center bg-green-50 border border-green-200 rounded-full px-3 py-1.5 gap-1.5"
                  >
                    <Text className="text-sm font-medium text-green-800">{m.displayName}</Text>
                    <Ionicons name="close-circle" size={15} color="#166534" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Search */}
          <View className="px-4 py-3 border-b border-gray-100">
            <View className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2.5 gap-2">
              <Ionicons name="search-outline" size={16} color="#9ca3af" />
              <TextInput
                className="flex-1 text-base text-gray-900"
                placeholder="Search members…"
                placeholderTextColor="#9ca3af"
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
          </View>

          {/* Member list */}
          <FlatList
            data={members}
            keyExtractor={item => item._id}
            renderItem={({ item }) => {
              const isSelected = !!item.userId && selected.has(item.userId);
              return (
                <TouchableOpacity
                  onPress={() => toggleMember(item)}
                  activeOpacity={0.7}
                  className={`flex-row items-center px-4 py-3.5 border-b border-gray-50 ${
                    isSelected ? "bg-green-50" : "bg-white"
                  }`}
                >
                  <View
                    className={`w-11 h-11 rounded-full items-center justify-center mr-3 ${
                      isSelected ? "bg-green-600" : "bg-gray-200"
                    }`}
                  >
                    <Text
                      className={`text-sm font-bold ${isSelected ? "text-white" : "text-gray-600"}`}
                    >
                      {getInitials(item.displayName)}
                    </Text>
                  </View>
                  <Text className="flex-1 text-base font-medium text-gray-900" numberOfLines={1}>
                    {item.displayName}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
                  )}
                </TouchableOpacity>
              );
            }}
            ListHeaderComponent={
              members.length > 0 ? (
                <View className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                  <Text className="text-xs text-gray-400 font-medium">
                    {members.length} {members.length === 1 ? "member" : "members"}
                    {selected.size > 0 ? ` · ${selected.size} selected` : ""}
                  </Text>
                </View>
              ) : null
            }
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
                  title="No other members"
                  description="No club members to add yet."
                />
              )
            }
            contentContainerStyle={
              members.length === 0 ? { flexGrow: 1 } : { paddingBottom: 32 }
            }
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}
    </>
  );
}
