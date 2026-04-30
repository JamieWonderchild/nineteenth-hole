import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/clerk-expo";
import { api } from "../../../../lib/convex";
import { Button, Card } from "../../../../components/ui";
import { CoursePickerSheet, CourseSelection } from "../../../../components/CoursePickerSheet";

// ── Types ──────────────────────────────────────────────────────────────────────

type GameType = "stableford" | "strokeplay" | "skins" | "nassau" | "betterball";

interface Player {
  id: string;
  name: string;
  handicap?: number;
  userId?: string;
}

const FORMATS: Array<{
  type: GameType;
  label: string;
  emoji: string;
  description: string;
}> = [
  { type: "stableford", label: "Stableford", emoji: "🏌️", description: "Points-based" },
  { type: "strokeplay", label: "Strokeplay", emoji: "⛳", description: "Lowest score wins" },
  { type: "skins", label: "Skins", emoji: "💰", description: "Hole by hole drama" },
  { type: "nassau", label: "Nassau", emoji: "🔀", description: "Front 9 / Back 9 / Overall" },
  { type: "betterball", label: "Betterball", emoji: "🤝", description: "Team best ball" },
];

function newPlayerId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function toDateString(d: Date): string {
  return d.toISOString().split("T")[0];
}

function stepTitle(step: number): string {
  return ["Game Type", "Players", "Stakes", "Review"][step - 1] ?? "";
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function NewGameScreen() {
  const router = useRouter();
  const { type: typeParam } = useLocalSearchParams<{ type?: string }>();
  const createGame = useMutation(api.quickGames.create);

  // Step state
  const [step, setStep] = useState(typeParam ? 2 : 1);

  // Step 1
  const [gameType, setGameType] = useState<GameType>(
    (typeParam as GameType) || "stableford"
  );

  // Step 2
  const [gameName, setGameName] = useState("Saturday game");
  const [date, setDate] = useState<Date>(new Date());
  const [players, setPlayers] = useState<Player[]>([]);

  // Step 3
  const [withStakes, setWithStakes] = useState(false);
  const [stakeInput, setStakeInput] = useState("");
  const [scoringMode, setScoringMode] = useState<"overall" | "per_hole">("overall");
  const [courseSelection, setCourseSelection] = useState<CourseSelection | null>(null);
  const [showCoursePicker, setShowCoursePicker] = useState(false);

  // Submit
  const [submitting, setSubmitting] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function addPlayer(name: string, handicap?: number, userId?: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPlayers((prev) => [...prev, { id: newPlayerId(), name: trimmed, handicap, userId }]);
  }

  function removePlayer(id: string) {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  }

  function canAdvance(): boolean {
    if (step === 1) return true;
    if (step === 2) return players.length >= 2 && gameName.trim().length > 0;
    if (step === 3) return true;
    return true;
  }

  function goNext() {
    if (!canAdvance()) {
      if (step === 2 && players.length < 2)
        Alert.alert("Add players", "You need at least 2 players to start a game.");
      return;
    }
    if (step < 4) setStep((s) => s + 1);
  }

  function goBack() {
    if (step > 1) setStep((s) => s - 1);
    else router.back();
  }

  async function handleCreate() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const stakePerPlayer = withStakes
        ? Math.round(parseFloat(stakeInput || "0") * 100)
        : 0;

      const gameId = await createGame({
        name: gameName.trim(),
        type: gameType,
        currency: "gbp",
        stakePerPlayer,
        settlementType: "cash",
        scoringMode,
        golfCourseId: courseSelection?.golfCourseId as any ?? undefined,
        teeId: courseSelection?.teeId as any ?? undefined,
        players: players.map((p) => ({
          id: p.id,
          name: p.name,
          userId: p.userId,
          handicap: p.handicap,
        })),
        date: date.toISOString(),
      });

      router.replace(`/play/games/${gameId}` as any);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to create game.");
      setSubmitting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen options={{ title: stepTitle(step), headerBackVisible: false }} />
      <CoursePickerSheet
        visible={showCoursePicker}
        onClose={() => setShowCoursePicker(false)}
        onSelect={(sel) => { setCourseSelection(sel); setShowCoursePicker(false); }}
      />
      <KeyboardAvoidingView
        className="flex-1 bg-gray-50"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Progress bar */}
        <View className="flex-row px-4 pt-2 pb-1 gap-1">
          {[1, 2, 3, 4].map((s) => (
            <View
              key={s}
              className={`flex-1 h-1 rounded-full ${s <= step ? "bg-green-600" : "bg-gray-200"}`}
            />
          ))}
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {step === 1 && <Step1GameType selected={gameType} onSelect={setGameType} />}
          {step === 2 && (
            <Step2Players
              gameName={gameName}
              setGameName={setGameName}
              date={date}
              setDate={setDate as (d: Date) => void}
              players={players}
              onAddPlayer={addPlayer}
              onRemovePlayer={removePlayer}
            />
          )}
          {step === 3 && (
            <Step3Stakes
              withStakes={withStakes}
              setWithStakes={setWithStakes}
              stakeInput={stakeInput}
              setStakeInput={setStakeInput}
              scoringMode={scoringMode}
              setScoringMode={(mode) => {
                setScoringMode(mode);
                if (mode === "overall") setCourseSelection(null);
              }}
              courseSelection={courseSelection}
              onPickCourse={() => setShowCoursePicker(true)}
              onClearCourse={() => setCourseSelection(null)}
            />
          )}
          {step === 4 && (
            <Step4Review
              gameType={gameType}
              gameName={gameName}
              date={toDateString(date)}
              players={players}
              withStakes={withStakes}
              stakeInput={stakeInput}
              scoringMode={scoringMode}
              courseSelection={courseSelection}
            />
          )}
        </ScrollView>

        {/* Navigation buttons */}
        <View className="flex-row gap-3 px-4 pb-6 pt-2 border-t border-gray-100 bg-white">
          <Button variant="outline" onPress={goBack} className="flex-1">
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          {step < 4 ? (
            <Button onPress={goNext} className="flex-1">
              Next
            </Button>
          ) : (
            <Button onPress={handleCreate} loading={submitting} className="flex-1">
              Start Game
            </Button>
          )}
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

// ── Step 1 ────────────────────────────────────────────────────────────────────

function Step1GameType({
  selected,
  onSelect,
}: {
  selected: GameType;
  onSelect: (t: GameType) => void;
}) {
  return (
    <View className="gap-3">
      <Text className="text-xl font-bold text-gray-900 mb-2">Choose a format</Text>
      {FORMATS.map((f) => (
        <TouchableOpacity
          key={f.type}
          onPress={() => onSelect(f.type)}
          className={`flex-row items-center gap-4 p-4 rounded-xl border-2 ${
            selected === f.type
              ? "border-green-600 bg-green-50"
              : "border-gray-100 bg-white"
          }`}
        >
          <Text className="text-3xl">{f.emoji}</Text>
          <View className="flex-1">
            <Text
              className={`font-bold text-base ${
                selected === f.type ? "text-green-700" : "text-gray-900"
              }`}
            >
              {f.label}
            </Text>
            <Text className="text-sm text-gray-500">{f.description}</Text>
          </View>
          {selected === f.type && (
            <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Date picker field ─────────────────────────────────────────────────────────

function DatePickerField({ date, onChange }: { date: Date; onChange: (d: Date) => void }) {
  const [show, setShow] = useState(false);

  const label = date.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  if (Platform.OS === "ios") {
    return (
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-gray-700">Date</Text>
        <TouchableOpacity
          onPress={() => setShow(true)}
          className="flex-row items-center bg-white border border-gray-200 rounded-xl px-4 py-3 gap-2"
        >
          <Ionicons name="calendar-outline" size={18} color="#6b7280" />
          <Text className="flex-1 text-gray-900">{label}</Text>
          <Ionicons name="chevron-down" size={16} color="#9ca3af" />
        </TouchableOpacity>

        <Modal visible={show} transparent animationType="slide">
          <View className="flex-1 justify-end">
            <View className="bg-white rounded-t-2xl">
              <View className="flex-row justify-between items-center px-4 pt-4 pb-2 border-b border-gray-100">
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text className="text-gray-500 text-base">Cancel</Text>
                </TouchableOpacity>
                <Text className="font-semibold text-gray-900">Select date</Text>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text className="text-green-600 font-semibold text-base">Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={date}
                mode="date"
                display="spinner"
                onChange={(_, d) => { if (d) onChange(d); }}
              />
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // Android — native inline picker
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-gray-700">Date</Text>
      <TouchableOpacity
        onPress={() => setShow(true)}
        className="flex-row items-center bg-white border border-gray-200 rounded-xl px-4 py-3 gap-2"
      >
        <Ionicons name="calendar-outline" size={18} color="#6b7280" />
        <Text className="flex-1 text-gray-900">{label}</Text>
        <Ionicons name="chevron-down" size={16} color="#9ca3af" />
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={(_, d) => { setShow(false); if (d) onChange(d); }}
        />
      )}
    </View>
  );
}

// ── Step 2 ────────────────────────────────────────────────────────────────────

function Step2Players({
  gameName,
  setGameName,
  date,
  setDate,
  players,
  onAddPlayer,
  onRemovePlayer,
}: {
  gameName: string;
  setGameName: (v: string) => void;
  date: Date;
  setDate: (v: Date) => void;
  players: Player[];
  onAddPlayer: (name: string, handicap?: number, userId?: string) => void;
  onRemovePlayer: (id: string) => void;
}) {
  const [nameInput, setNameInput] = useState("");
  const [hcpInput, setHcpInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { user } = useUser();
  const myProfile = useQuery(
    api.golferProfiles.get,
    user?.id ? { userId: user.id } : "skip"
  );

  const searchResults = useQuery(
    api.golferProfiles.search,
    nameInput.trim().length >= 2 ? { term: nameInput.trim(), includeSelf: true } : "skip"
  );

  const suggestions = showSuggestions && searchResults && searchResults.length > 0
    ? searchResults
    : [];

  const alreadyAddedSelf = myProfile && players.some((p) => p.userId === myProfile.userId);

  function handleAddManual() {
    const name = nameInput.trim();
    if (!name) return;
    const hcp = hcpInput.trim() ? parseFloat(hcpInput.trim()) : undefined;
    onAddPlayer(name, hcp, undefined);
    setNameInput("");
    setHcpInput("");
    setShowSuggestions(false);
  }

  function handleSelectProfile(profile: any) {
    onAddPlayer(
      profile.displayName,
      profile.handicapIndex != null ? profile.handicapIndex : undefined,
      profile.userId
    );
    setNameInput("");
    setHcpInput("");
    setShowSuggestions(false);
  }

  return (
    <View className="gap-5">
      <Text className="text-xl font-bold text-gray-900">Game details</Text>

      <View className="gap-1">
        <Text className="text-sm font-medium text-gray-700">Game name</Text>
        <TextInput
          value={gameName}
          onChangeText={setGameName}
          placeholder="e.g. Saturday game"
          className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
        />
      </View>

      <DatePickerField date={date} onChange={setDate} />

      <View className="gap-3">
        <Text className="text-sm font-medium text-gray-700">
          Players{" "}
          <Text className="text-gray-400 font-normal">(min. 2)</Text>
        </Text>

        {/* Quick-add yourself */}
        {myProfile && !alreadyAddedSelf && (
          <TouchableOpacity
            onPress={() => handleSelectProfile(myProfile)}
            className="flex-row items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5"
          >
            <Ionicons name="person-circle" size={18} color="#16a34a" />
            <View className="flex-1">
              <Text className="text-sm font-medium text-green-900">
                Add me — {myProfile.displayName}
              </Text>
              {myProfile.handicapIndex != null && (
                <Text className="text-xs text-green-700">HCP {myProfile.handicapIndex.toFixed(1)}</Text>
              )}
            </View>
            <Ionicons name="add-circle" size={18} color="#16a34a" />
          </TouchableOpacity>
        )}

        {/* Add player row */}
        <View className="flex-row gap-2">
          <TextInput
            value={nameInput}
            onChangeText={(v) => { setNameInput(v); setShowSuggestions(true); }}
            placeholder="Name or search platform"
            className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-3 text-gray-900"
            onSubmitEditing={handleAddManual}
            returnKeyType="done"
          />
          <TextInput
            value={hcpInput}
            onChangeText={setHcpInput}
            placeholder="HCP"
            keyboardType="decimal-pad"
            className="w-20 bg-white border border-gray-200 rounded-xl px-3 py-3 text-gray-900"
          />
          <TouchableOpacity
            onPress={handleAddManual}
            className="bg-green-600 rounded-xl px-4 items-center justify-center"
          >
            <Text className="text-white font-bold text-lg">+</Text>
          </TouchableOpacity>
        </View>

        {/* Platform member suggestions */}
        {suggestions.length > 0 && (
          <View className="bg-white border border-gray-200 rounded-xl overflow-hidden -mt-1">
            {suggestions.map((profile: any, idx: number) => (
              <TouchableOpacity
                key={profile._id}
                onPress={() => handleSelectProfile(profile)}
                className={`flex-row items-center px-3 py-2.5 gap-3 ${
                  idx < suggestions.length - 1 ? "border-b border-gray-50" : ""
                }`}
              >
                <View className="w-8 h-8 rounded-full bg-green-100 items-center justify-center">
                  <Text className="text-green-700 text-xs font-bold">
                    {profile.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-900">{profile.displayName}</Text>
                  {profile.handicapIndex != null && (
                    <Text className="text-xs text-gray-400">
                      HCP {profile.handicapIndex.toFixed(1)}
                      {profile.homeClub ? ` · ${profile.homeClub}` : ""}
                    </Text>
                  )}
                </View>
                <Ionicons name="person-add-outline" size={16} color="#9ca3af" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Player chips */}
        {players.length > 0 && (
          <View className="flex-row flex-wrap gap-2">
            {players.map((p) => (
              <View
                key={p.id}
                className="flex-row items-center bg-green-100 rounded-full px-3 py-1.5 gap-1.5"
              >
                {p.userId && (
                  <Ionicons name="person-circle" size={14} color="#15803d" />
                )}
                <Text className="text-green-800 font-medium text-sm">
                  {p.name}
                  {p.handicap != null ? ` (${p.handicap})` : ""}
                </Text>
                <TouchableOpacity onPress={() => onRemovePlayer(p.id)} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color="#15803d" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {players.length < 2 && (
          <Text className="text-xs text-amber-600">Add at least 2 players to continue.</Text>
        )}
      </View>
    </View>
  );
}

// ── Step 3 ────────────────────────────────────────────────────────────────────

function Step3Stakes({
  withStakes,
  setWithStakes,
  stakeInput,
  setStakeInput,
  scoringMode,
  setScoringMode,
  courseSelection,
  onPickCourse,
  onClearCourse,
}: {
  withStakes: boolean;
  setWithStakes: (v: boolean) => void;
  stakeInput: string;
  setStakeInput: (v: string) => void;
  scoringMode: "overall" | "per_hole";
  setScoringMode: (v: "overall" | "per_hole") => void;
  courseSelection: CourseSelection | null;
  onPickCourse: () => void;
  onClearCourse: () => void;
}) {
  return (
    <View className="gap-6">
      <Text className="text-xl font-bold text-gray-900">Stakes & scoring</Text>

      {/* Stake toggle */}
      <View className="gap-3">
        <Text className="text-sm font-medium text-gray-700">Playing for</Text>
        <View className="flex-row gap-3">
          {[
            { value: false, label: "Just for fun", icon: "happy-outline" as const },
            { value: true, label: "With stakes", icon: "cash-outline" as const },
          ].map((opt) => (
            <TouchableOpacity
              key={String(opt.value)}
              onPress={() => setWithStakes(opt.value)}
              className={`flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl border-2 ${
                withStakes === opt.value
                  ? "border-green-600 bg-green-50"
                  : "border-gray-100 bg-white"
              }`}
            >
              <Ionicons
                name={opt.icon}
                size={18}
                color={withStakes === opt.value ? "#16a34a" : "#6b7280"}
              />
              <Text
                className={`font-medium text-sm ${
                  withStakes === opt.value ? "text-green-700" : "text-gray-600"
                }`}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Stake amount */}
      {withStakes && (
        <View className="gap-2">
          <Text className="text-sm font-medium text-gray-700">Stake per player (£)</Text>
          <TextInput
            value={stakeInput}
            onChangeText={setStakeInput}
            placeholder="e.g. 5"
            keyboardType="decimal-pad"
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
          />
          <Text className="text-xs text-gray-400">Settlement via cash (Stripe coming soon)</Text>
        </View>
      )}

      {/* Scoring mode */}
      <View className="gap-3">
        <Text className="text-sm font-medium text-gray-700">Score tracking</Text>
        {[
          {
            value: "overall" as const,
            label: "Overall score",
            description: "Enter final totals at the end",
          },
          {
            value: "per_hole" as const,
            label: "Hole by hole",
            description: "Track each hole live",
          },
        ].map((opt) => (
          <TouchableOpacity
            key={opt.value}
            onPress={() => setScoringMode(opt.value)}
            className={`flex-row items-center gap-4 p-4 rounded-xl border-2 ${
              scoringMode === opt.value
                ? "border-green-600 bg-green-50"
                : "border-gray-100 bg-white"
            }`}
          >
            <View className="flex-1">
              <Text
                className={`font-semibold text-sm ${
                  scoringMode === opt.value ? "text-green-700" : "text-gray-900"
                }`}
              >
                {opt.label}
              </Text>
              <Text className="text-xs text-gray-500 mt-0.5">{opt.description}</Text>
            </View>
            {scoringMode === opt.value && (
              <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Course picker — shown when hole-by-hole selected */}
      {scoringMode === "per_hole" && (
        <View className="gap-2">
          <Text className="text-sm font-medium text-gray-700">Course</Text>
          {courseSelection ? (
            <View className="flex-row items-center bg-green-50 border border-green-200 rounded-xl px-3 py-3 gap-2">
              <Ionicons name="golf" size={18} color="#16a34a" />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-green-900">
                  {courseSelection.courseName}
                </Text>
                <Text className="text-xs text-green-700">
                  {courseSelection.teeName} tees
                  {courseSelection.courseRating
                    ? ` · CR ${courseSelection.courseRating} / S ${courseSelection.slopeRating}`
                    : ""}
                </Text>
              </View>
              <TouchableOpacity onPress={onClearCourse} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#16a34a" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={onPickCourse}
              className="flex-row items-center gap-3 border-2 border-dashed border-gray-200 rounded-xl px-4 py-3.5"
            >
              <Ionicons name="search-outline" size={20} color="#9ca3af" />
              <View className="flex-1">
                <Text className="text-sm text-gray-500">Select course</Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  Enables auto-scoring with par & stroke index
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ── Step 4 ────────────────────────────────────────────────────────────────────

function Step4Review({
  gameType,
  gameName,
  date,
  players,
  withStakes,
  stakeInput,
  scoringMode,
  courseSelection,
}: {
  gameType: GameType;
  gameName: string;
  date: string;
  players: Player[];
  withStakes: boolean;
  stakeInput: string;
  scoringMode: "overall" | "per_hole";
  courseSelection: CourseSelection | null;
}) {
  const format = FORMATS.find((f) => f.type === gameType);
  const stakeDisplay = withStakes && stakeInput
    ? `£${parseFloat(stakeInput || "0").toFixed(2)}/player`
    : "None";

  const rows = [
    { label: "Format", value: `${format?.emoji ?? ""} ${format?.label ?? gameType}` },
    { label: "Name", value: gameName },
    { label: "Date", value: date },
    { label: "Players", value: `${players.length} player${players.length !== 1 ? "s" : ""}` },
    { label: "Stakes", value: stakeDisplay },
    { label: "Scoring", value: scoringMode === "per_hole" ? "Hole by hole" : "Overall score" },
    ...(courseSelection
      ? [{ label: "Course", value: `${courseSelection.courseName} (${courseSelection.teeName})` }]
      : []),
  ];

  return (
    <View className="gap-4">
      <Text className="text-xl font-bold text-gray-900">Review</Text>

      <Card className="overflow-hidden">
        {rows.map((row, i) => (
          <View
            key={row.label}
            className={`flex-row items-center justify-between px-4 py-3 ${
              i < rows.length - 1 ? "border-b border-gray-50" : ""
            }`}
          >
            <Text className="text-gray-500 text-sm">{row.label}</Text>
            <Text className="text-gray-900 font-medium text-sm">{row.value}</Text>
          </View>
        ))}
      </Card>

      <Card className="px-4 py-3">
        <Text className="text-sm font-medium text-gray-700 mb-2">Players</Text>
        <View className="gap-2">
          {players.map((p) => (
            <View key={p.id} className="flex-row items-center gap-2">
              <View className="w-6 h-6 rounded-full bg-green-100 items-center justify-center">
                <Text className="text-green-700 text-xs font-bold">
                  {p.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text className="text-gray-900 text-sm flex-1">{p.name}</Text>
              {p.handicap != null && (
                <Text className="text-gray-400 text-sm">HCP {p.handicap}</Text>
              )}
            </View>
          ))}
        </View>
      </Card>

      <Text className="text-xs text-gray-400 text-center">
        Tap Start Game to begin. Scores update live for all players.
      </Text>
    </View>
  );
}
