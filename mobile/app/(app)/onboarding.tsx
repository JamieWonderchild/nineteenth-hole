import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../lib/convex";
import { Button } from "../../components/ui";

const GOALS = [
  { id: "casual", label: "Casual", icon: "😊", desc: "Just enjoy the game" },
  { id: "competitive", label: "Competitive", icon: "🏆", desc: "Improve my handicap" },
  { id: "social", label: "Social", icon: "👥", desc: "Play with friends & family" },
];

const HANDICAP_RANGES = [
  { id: "0-5", label: "0–5", desc: "Scratch / elite" },
  { id: "6-12", label: "6–12", desc: "Single figures" },
  { id: "13-20", label: "13–20", desc: "Mid handicap" },
  { id: "21-28", label: "21–28", desc: "High handicap" },
  { id: "29+", label: "29+", desc: "Beginner" },
  { id: "none", label: "None yet", desc: "New to golf" },
];

function rangeToIndex(range: string): number | undefined {
  const map: Record<string, number> = {
    "0-5": 3, "6-12": 9, "13-20": 16, "21-28": 24, "29+": 36, "none": 54,
  };
  return map[range];
}

export default function OnboardingScreen() {
  const { user } = useUser();
  const router = useRouter();
  const { club: clubSlug } = useLocalSearchParams<{ club?: string }>();
  const upsert = useMutation(api.golferProfiles.upsert);
  const claimProvisionalMember = useMutation(api.clubMembers.claimProvisionalMember);

  // If we arrived via a club link, look up the club so we can auto-join
  const clubBySlug = useQuery(
    api.clubs.getBySlug,
    clubSlug ? { slug: clubSlug } : "skip"
  );

  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState(
    user?.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}` : ""
  );
  const [homeClub, setHomeClub] = useState("");
  const [goal, setGoal] = useState<string>("casual");
  const [handicapRange, setHandicapRange] = useState<string>("none");
  const [loading, setLoading] = useState(false);

  async function handleFinish() {
    if (!displayName.trim()) {
      Alert.alert("Name required", "Please enter your name to continue.");
      return;
    }
    setLoading(true);
    try {
      await upsert({
        displayName: displayName.trim(),
        homeClub: homeClub.trim() || undefined,
        goals: goal,
        handicapIndex: handicapRange !== "none" ? rangeToIndex(handicapRange) : undefined,
      });

      // If arrived via a club link, try to join and auto-match provisional member
      if (clubSlug && clubBySlug) {
        try {
          await claimProvisionalMember({
            clubId: clubBySlug._id,
            displayName: displayName.trim(),
          });
        } catch {
          // Non-fatal: admin will handle matching
        }
      }

      router.replace("/(app)");
    } catch (e) {
      Alert.alert("Error", "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const totalSteps = 3;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Progress bar */}
      <View className="pt-14 px-6">
        <View className="flex-row gap-1.5 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              className={`flex-1 h-1 rounded-full ${i < step ? "bg-green-600" : "bg-gray-200"}`}
            />
          ))}
        </View>
      </View>

      <ScrollView className="flex-1 px-6" keyboardShouldPersistTaps="handled">
        {step === 1 && (
          <View className="gap-6">
            <View className="gap-2">
              <Text className="text-3xl font-bold text-gray-900">Welcome! 👋</Text>
              <Text className="text-gray-500 text-base">
                Let's set up your profile. This takes about 30 seconds.
              </Text>
            </View>

            <View className="gap-1.5">
              <Text className="text-sm font-medium text-gray-700">Your name</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="e.g. Jamie Ward"
                className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900"
                placeholderTextColor="#9ca3af"
                autoFocus
                returnKeyType="next"
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-sm font-medium text-gray-700">
                Home club <Text className="text-gray-400 font-normal">(optional)</Text>
              </Text>
              <TextInput
                value={homeClub}
                onChangeText={setHomeClub}
                placeholder="e.g. Finchley Golf Club"
                className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900"
                placeholderTextColor="#9ca3af"
                returnKeyType="done"
              />
            </View>

            <Button
              onPress={() => {
                if (!displayName.trim()) {
                  Alert.alert("Name required", "Please enter your name.");
                  return;
                }
                setStep(2);
              }}
              className="mt-2"
            >
              Next →
            </Button>
          </View>
        )}

        {step === 2 && (
          <View className="gap-6">
            <View className="gap-2">
              <Text className="text-3xl font-bold text-gray-900">How do you play?</Text>
              <Text className="text-gray-500 text-base">
                This helps us personalise your experience.
              </Text>
            </View>

            <View className="gap-3">
              {GOALS.map(g => (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => setGoal(g.id)}
                  className={`flex-row items-center gap-4 p-4 rounded-xl border-2 ${
                    goal === g.id ? "border-green-600 bg-green-50" : "border-gray-200 bg-white"
                  }`}
                >
                  <Text className="text-3xl">{g.icon}</Text>
                  <View className="flex-1">
                    <Text className={`font-semibold text-base ${goal === g.id ? "text-green-700" : "text-gray-900"}`}>
                      {g.label}
                    </Text>
                    <Text className="text-gray-500 text-sm">{g.desc}</Text>
                  </View>
                  {goal === g.id && (
                    <View className="w-5 h-5 rounded-full bg-green-600 items-center justify-center">
                      <Text className="text-white text-xs font-bold">✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View className="flex-row gap-3 mt-2">
              <Button onPress={() => setStep(1)} variant="outline" className="flex-1">
                ← Back
              </Button>
              <Button onPress={() => setStep(3)} className="flex-1">
                Next →
              </Button>
            </View>
          </View>
        )}

        {step === 3 && (
          <View className="gap-6">
            <View className="gap-2">
              <Text className="text-3xl font-bold text-gray-900">Your handicap</Text>
              <Text className="text-gray-500 text-base">
                We'll refine this once you start logging rounds.
              </Text>
            </View>

            <View className="gap-2">
              {HANDICAP_RANGES.map(r => (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => setHandicapRange(r.id)}
                  className={`flex-row items-center justify-between px-4 py-3 rounded-xl border-2 ${
                    handicapRange === r.id
                      ? "border-green-600 bg-green-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      className={`w-10 h-10 rounded-full items-center justify-center ${
                        handicapRange === r.id ? "bg-green-600" : "bg-gray-100"
                      }`}
                    >
                      <Text
                        className={`font-bold text-sm ${
                          handicapRange === r.id ? "text-white" : "text-gray-600"
                        }`}
                      >
                        {r.label}
                      </Text>
                    </View>
                    <Text className="text-gray-500 text-sm">{r.desc}</Text>
                  </View>
                  {handicapRange === r.id && (
                    <View className="w-5 h-5 rounded-full bg-green-600 items-center justify-center">
                      <Text className="text-white text-xs font-bold">✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View className="flex-row gap-3 mt-2 mb-8">
              <Button onPress={() => setStep(2)} variant="outline" className="flex-1">
                ← Back
              </Button>
              <Button onPress={handleFinish} loading={loading} className="flex-1">
                Let's go ⛳
              </Button>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
