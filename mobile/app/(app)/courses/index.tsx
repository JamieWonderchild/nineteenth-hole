import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/clerk-expo";
import * as Location from "expo-location";
import { api } from "../../../lib/convex";
import { SectionHeader, EmptyState } from "../../../components/ui";

// ── Tee colour helper (reused from CoursePickerSheet) ─────────────────────────

const TEE_HEX: Record<string, string> = {
  white: "#f9fafb",
  yellow: "#fbbf24",
  red: "#ef4444",
  blue: "#3b82f6",
  black: "#111827",
  gold: "#d97706",
  silver: "#9ca3af",
  green: "#16a34a",
  other: "#6b7280",
};

// ── Course row ────────────────────────────────────────────────────────────────

function CourseRow({
  course,
  onPress,
}: {
  course: any;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-white border-b border-gray-100 px-4 py-3.5 flex-row items-center"
    >
      <View className="w-9 h-9 rounded-full bg-green-50 items-center justify-center mr-3">
        <Ionicons name="golf" size={18} color="#16a34a" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
          {course.name}
        </Text>
        <Text className="text-xs text-gray-400">
          {[course.city, course.county].filter(Boolean).join(", ")}
        </Text>
      </View>
      {course.par && (
        <View className="bg-gray-100 rounded-full px-2 py-0.5 mr-2">
          <Text className="text-xs text-gray-600 font-medium">Par {course.par}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
    </Pressable>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CoursesScreen() {
  const router = useRouter();
  const { user } = useUser();
  const userId = user?.id ?? "";

  // Search state with debounce
  const [rawQuery, setRawQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Location state
  const [locationGranted, setLocationGranted] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  // Debounce search
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(rawQuery), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [rawQuery]);

  // Request location on mount
  useEffect(() => {
    (async () => {
      setLocationLoading(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          setLocationGranted(true);
          const pos = await Location.getCurrentPositionAsync({});
          setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        }
      } catch {
        // silently ignore if location unavailable
      } finally {
        setLocationLoading(false);
      }
    })();
  }, []);

  const isSearching = debouncedQuery.length >= 2;

  const searchResults = useQuery(
    api.golfCourses.search,
    isSearching ? { query: debouncedQuery, limit: 20 } : "skip"
  );

  const nearbyCourses = useQuery(
    api.golfCourses.listNearby,
    coords ? { latitude: coords.latitude, longitude: coords.longitude, radiusMiles: 20, limit: 10 } : "skip"
  );

  const recentCourses = useQuery(
    api.golfCourses.listRecentByUser,
    userId ? { userId, limit: 5 } : "skip"
  );

  const searchLoading = isSearching && searchResults === undefined;

  function navigateToCourse(courseId: string) {
    router.push(`/(app)/courses/${courseId}` as any);
  }

  // ── Render helpers ───────────────────────────────────────────────────────

  function renderSearchContent() {
    if (searchLoading) {
      return (
        <View className="items-center py-10">
          <ActivityIndicator color="#16a34a" />
        </View>
      );
    }

    if (searchResults && searchResults.length === 0) {
      return (
        <EmptyState
          icon="golf-outline"
          title={`No courses found`}
          description={`Try a different spelling or shorter name`}
        />
      );
    }

    if (searchResults && searchResults.length > 0) {
      return (
        <>
          <View className="px-4 pt-4 pb-2">
            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Search results
            </Text>
          </View>
          {searchResults.map((course: any) => (
            <CourseRow
              key={course._id}
              course={course}
              onPress={() => navigateToCourse(course._id)}
            />
          ))}
        </>
      );
    }

    return null;
  }

  function renderDiscoverySections() {
    return (
      <>
        {/* Nearby section */}
        {locationGranted && (
          <View>
            <View className="px-4 pt-5 pb-2">
              <SectionHeader title="Nearby" />
            </View>
            {locationLoading || nearbyCourses === undefined ? (
              <View className="items-center py-6">
                <ActivityIndicator color="#16a34a" />
              </View>
            ) : nearbyCourses.length === 0 ? (
              <View className="px-4 py-4">
                <Text className="text-sm text-gray-400">No courses found nearby</Text>
              </View>
            ) : (
              nearbyCourses.map((course: any) => (
                <CourseRow
                  key={course._id}
                  course={course}
                  onPress={() => navigateToCourse(course._id)}
                />
              ))
            )}
          </View>
        )}

        {/* Recent section */}
        {recentCourses && recentCourses.length > 0 && (
          <View>
            <View className="px-4 pt-5 pb-2">
              <SectionHeader title="Recent" />
            </View>
            {recentCourses.map((course: any) => (
              <CourseRow
                key={course._id}
                course={course}
                onPress={() => navigateToCourse(course._id)}
              />
            ))}
          </View>
        )}

        {/* Empty prompt when no location and no recent */}
        {!locationGranted && (!recentCourses || recentCourses.length === 0) && (
          <EmptyState
            icon="search-outline"
            title="Search for a course"
            description="Type at least 2 characters in the search bar above"
          />
        )}
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Courses" }} />
      <FlatList
        className="flex-1 bg-gray-50"
        data={[]}
        renderItem={null}
        keyExtractor={() => ""}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            {/* Search bar */}
            <View className="bg-white px-4 pt-4 pb-3 border-b border-gray-100">
              <View className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2.5 gap-2">
                <Ionicons name="search" size={18} color="#9ca3af" />
                <TextInput
                  className="flex-1 text-base text-gray-900"
                  placeholder="Search courses…"
                  placeholderTextColor="#9ca3af"
                  value={rawQuery}
                  onChangeText={setRawQuery}
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {rawQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setRawQuery("")}>
                    <Ionicons name="close-circle" size={18} color="#9ca3af" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Content: search results OR discovery sections */}
            {isSearching ? renderSearchContent() : renderDiscoverySections()}
          </View>
        }
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
      />
    </>
  );
}
