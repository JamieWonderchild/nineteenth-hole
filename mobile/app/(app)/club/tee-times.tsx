import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
} from "react-native";
import { Stack } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import { useQuery, useMutation } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../lib/convex";
import { Badge, Card, EmptyState, LoadingSpinner } from "../../../components/ui";

// ── date helpers ──────────────────────────────────────────────────────────────

function toDateStr(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatDayShort(dateStr: string): { day: string; date: string } {
  const d = new Date(dateStr + "T00:00:00");
  return {
    day: d.toLocaleDateString("en-GB", { weekday: "short" }),
    date: d.getDate().toString(),
  };
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m.toString().padStart(2, "0")}${suffix}`;
}

function next14Days(): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 0; i < 15; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(toDateStr(d));
  }
  return days;
}

// ── space indicator ────────────────────────────────────────────────────────────

function SpacesBadge({ available, max }: { available: number; max: number }) {
  if (available === 0) {
    return (
      <View className="bg-gray-100 rounded-full px-2.5 py-0.5">
        <Text className="text-xs font-medium text-gray-500">Full</Text>
      </View>
    );
  }
  const variant =
    available >= Math.ceil(max / 2)
      ? "bg-green-100"
      : available === 1
      ? "bg-red-100"
      : "bg-amber-100";
  const textVariant =
    available >= Math.ceil(max / 2)
      ? "text-green-800"
      : available === 1
      ? "text-red-700"
      : "text-amber-800";

  return (
    <View className={`rounded-full px-2.5 py-0.5 ${variant}`}>
      <Text className={`text-xs font-medium ${textVariant}`}>
        {available} space{available !== 1 ? "s" : ""}
      </Text>
    </View>
  );
}

// ── booking confirmation modal ────────────────────────────────────────────────

function BookingModal({
  visible,
  onClose,
  slot,
  clubId,
  displayName,
}: {
  visible: boolean;
  onClose: () => void;
  slot: any | null;
  clubId: string;
  displayName: string;
}) {
  const [playerCount, setPlayerCount] = useState(1);
  const [booking, setBooking] = useState(false);

  const bookSlot = useMutation(api.teeTimes.bookSlot);

  async function handleConfirm() {
    if (!slot) return;
    setBooking(true);
    try {
      await bookSlot({
        slotId: slot._id,
        clubId: clubId as any,
        playerCount,
        displayName,
      });
      Alert.alert("Booked!", `Tee time at ${formatTime(slot.time)} confirmed.`);
      onClose();
    } catch (err: any) {
      Alert.alert("Booking failed", err?.message ?? "Please try again.");
    } finally {
      setBooking(false);
    }
  }

  if (!slot) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-white">
        {/* header */}
        <View className="flex-row items-center justify-between px-4 pt-6 pb-4 border-b border-gray-100">
          <Text className="text-lg font-bold text-gray-900">
            Confirm Booking
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <View className="px-4 pt-6 flex-1">
          {/* slot info */}
          <Card className="p-4 mb-6">
            <View className="flex-row items-center gap-3">
              <View className="w-12 h-12 rounded-full bg-green-50 items-center justify-center">
                <Ionicons name="calendar-outline" size={24} color="#16a34a" />
              </View>
              <View>
                <Text className="text-base font-bold text-gray-900">
                  {formatTime(slot.time)}
                </Text>
                <Text className="text-sm text-gray-500">
                  {formatDateLabel(slot.date)}
                </Text>
              </View>
            </View>
          </Card>

          {/* player count */}
          <Text className="text-sm font-semibold text-gray-700 mb-3">
            How many players?
          </Text>
          <View className="flex-row items-center gap-5 mb-8">
            {[1, 2, 3, 4].map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => setPlayerCount(n)}
                className={`w-14 h-14 rounded-full items-center justify-center border-2 ${
                  playerCount === n
                    ? "bg-green-600 border-green-600"
                    : "bg-white border-gray-200"
                }`}
              >
                <Text
                  className={`font-bold text-lg ${
                    playerCount === n ? "text-white" : "text-gray-700"
                  }`}
                >
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-xs text-gray-400 mb-8">
            {slot.available} space{slot.available !== 1 ? "s" : ""} remaining in
            this slot
          </Text>
        </View>

        <View className="px-4 pb-12 pt-4 border-t border-gray-100">
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={booking || playerCount > (slot.available ?? 0)}
            className={`rounded-full py-4 items-center ${
              booking || playerCount > (slot.available ?? 0)
                ? "bg-green-300"
                : "bg-green-600"
            }`}
          >
            <Text className="text-white font-semibold text-base">
              {booking ? "Booking…" : `Confirm Booking for ${playerCount}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── main screen ────────────────────────────────────────────────────────────────

export default function TeeTimesScreen() {
  const { user } = useUser();
  const userId = user?.id ?? "";
  const displayName = user?.fullName ?? user?.firstName ?? "Member";

  const days = next14Days();
  const [selectedDate, setSelectedDate] = useState(days[0]);
  const [bookingSlot, setBookingSlot] = useState<any | null>(null);

  const clubs = useQuery(api.clubMembers.myActiveClubs, {});
  const clubId =
    clubs && clubs.length > 0 ? clubs[0].club._id : null;

  const slots = useQuery(
    api.teeTimes.listSlotsForDate,
    clubId && selectedDate
      ? { clubId: clubId as any, date: selectedDate }
      : "skip"
  );

  const myBookings = useQuery(
    api.teeTimes.listMyBookings,
    clubId && userId
      ? { clubId: clubId as any, userId }
      : "skip"
  );

  const cancelBooking = useMutation(api.teeTimes.cancelBooking);

  const myBookingSlotIds = new Set(
    (myBookings ?? []).map((b: any) => b.slotId)
  );

  const myBookingsBySlotId = new Map<string, any>(
    (myBookings ?? []).map((b: any) => [b.slotId, b])
  );

  function handleCancel(booking: any) {
    Alert.alert(
      "Cancel booking?",
      `Cancel your tee time at ${formatTime(booking.time)} on ${formatDateLabel(booking.date)}?`,
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Cancel booking",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelBooking({ bookingId: booking._id });
            } catch (err: any) {
              Alert.alert("Error", err?.message ?? "Could not cancel.");
            }
          },
        },
      ]
    );
  }

  if (clubs === undefined) {
    return (
      <>
        <Stack.Screen options={{ title: "Tee Times" }} />
        <LoadingSpinner fullScreen />
      </>
    );
  }

  if (!clubId) {
    return (
      <>
        <Stack.Screen options={{ title: "Tee Times" }} />
        <EmptyState
          icon="calendar-outline"
          title="No club connected"
          description="Join a club to book tee times."
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Tee Times" }} />
      <View className="flex-1 bg-gray-50">
        {/* date picker strip */}
        <View className="bg-white border-b border-gray-100">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12 }}
          >
            {days.map((d) => {
              const { day, date } = formatDayShort(d);
              const isSelected = d === selectedDate;
              return (
                <TouchableOpacity
                  key={d}
                  onPress={() => setSelectedDate(d)}
                  className={`mx-1 w-14 py-2 rounded-xl items-center ${
                    isSelected ? "bg-green-600" : "bg-gray-50 border border-gray-100"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      isSelected ? "text-green-200" : "text-gray-400"
                    }`}
                  >
                    {day}
                  </Text>
                  <Text
                    className={`text-lg font-bold ${
                      isSelected ? "text-white" : "text-gray-800"
                    }`}
                  >
                    {date}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* selected date label */}
        <View className="px-4 pt-4 pb-2">
          <Text className="text-sm font-semibold text-gray-500">
            {formatDateLabel(selectedDate)}
          </Text>
        </View>

        {/* slots list */}
        {slots === undefined ? (
          <LoadingSpinner fullScreen />
        ) : slots.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="No tee times available"
            description="There are no tee time slots set up for this date."
          />
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48, paddingTop: 4 }}
          >
            {slots.map((slot: any) => {
              const isBlocked = slot.isBlocked;
              const isFull = slot.available === 0;
              const myBooking = myBookingsBySlotId.get(slot._id);
              const isMyBooking = !!myBooking;

              return (
                <View key={slot._id} className="mb-3">
                  <Card
                    className={`px-4 py-3.5 ${
                      isBlocked || isFull ? "opacity-50" : ""
                    }`}
                  >
                    <View className="flex-row items-center gap-3">
                      {/* time */}
                      <View className="w-16 items-center">
                        <Text className="font-bold text-lg text-gray-900">
                          {formatTime(slot.time)}
                        </Text>
                      </View>

                      {/* info */}
                      <View className="flex-1">
                        <View className="flex-row flex-wrap gap-1.5 items-center">
                          {isBlocked ? (
                            <Badge variant="error">Unavailable</Badge>
                          ) : isMyBooking ? (
                            <Badge variant="success">Your booking</Badge>
                          ) : (
                            <SpacesBadge
                              available={slot.available}
                              max={slot.maxPlayers}
                            />
                          )}
                        </View>
                        {isMyBooking && myBooking && (
                          <Text className="text-xs text-gray-400 mt-0.5">
                            {myBooking.playerCount}{" "}
                            {myBooking.playerCount === 1 ? "player" : "players"}
                          </Text>
                        )}
                        {!isBlocked && !isMyBooking && (
                          <Text className="text-xs text-gray-400 mt-0.5">
                            {slot.takenPlayers}/{slot.maxPlayers} taken
                          </Text>
                        )}
                      </View>

                      {/* action */}
                      {!isBlocked && (
                        <View>
                          {isMyBooking ? (
                            <TouchableOpacity
                              onPress={() => handleCancel(myBooking)}
                              className="border border-red-200 rounded-full px-3 py-1.5"
                            >
                              <Text className="text-red-600 text-xs font-semibold">
                                Cancel
                              </Text>
                            </TouchableOpacity>
                          ) : !isFull ? (
                            <TouchableOpacity
                              onPress={() => setBookingSlot(slot)}
                              className="bg-green-600 rounded-full px-4 py-2"
                            >
                              <Text className="text-white text-sm font-semibold">
                                Book
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      )}
                    </View>
                  </Card>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      <BookingModal
        visible={!!bookingSlot}
        onClose={() => setBookingSlot(null)}
        slot={bookingSlot}
        clubId={clubId}
        displayName={displayName}
      />
    </>
  );
}
