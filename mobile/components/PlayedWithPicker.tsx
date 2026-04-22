/**
 * PlayedWithPicker
 *
 * Searches the platform directory as you type and lets you add players
 * by name (from the directory or manually). Selected players shown as chips.
 */
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "../lib/convex";

interface Props {
  players: string[];
  onChange: (players: string[]) => void;
}

export function PlayedWithPicker({ players, onChange }: Props) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const searchResults = useQuery(
    api.golferProfiles.search,
    input.trim().length >= 2 ? { term: input.trim() } : "skip"
  );

  const suggestions =
    showSuggestions && searchResults && searchResults.length > 0
      ? searchResults.slice(0, 5)
      : [];

  function addPlayer(name: string) {
    const trimmed = name.trim();
    if (!trimmed || players.includes(trimmed)) return;
    onChange([...players, trimmed]);
    setInput("");
    setShowSuggestions(false);
  }

  function removePlayer(name: string) {
    onChange(players.filter((p) => p !== name));
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 14, fontWeight: "500", color: "#374151" }}>
        Playing with (optional)
      </Text>

      {/* Selected player chips */}
      {players.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {players.map((name) => (
            <TouchableOpacity
              key={name}
              onPress={() => removePlayer(name)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#f0fdf4",
                borderWidth: 1,
                borderColor: "#bbf7d0",
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 6,
                gap: 5,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#166534" }}>
                {name}
              </Text>
              <Ionicons name="close-circle" size={14} color="#16a34a" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Search / manual input row */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1, position: "relative" }}>
          <TextInput
            value={input}
            onChangeText={(v) => {
              setInput(v);
              setShowSuggestions(true);
            }}
            placeholder="Search platform or type a name…"
            placeholderTextColor="#9ca3af"
            style={{
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: "#e5e7eb",
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 12,
              fontSize: 15,
              color: "#111827",
            }}
            returnKeyType="done"
            onSubmitEditing={() => addPlayer(input)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          />
        </View>
        {input.trim().length > 0 && (
          <TouchableOpacity
            onPress={() => addPlayer(input)}
            style={{
              backgroundColor: "#16a34a",
              borderRadius: 12,
              paddingHorizontal: 16,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
              Add
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Platform directory suggestions */}
      {suggestions.length > 0 && (
        <View
          style={{
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: "#e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
            marginTop: -4,
          }}
        >
          {suggestions.map((profile: any, idx: number) => (
            <TouchableOpacity
              key={profile._id}
              onPress={() => addPlayer(profile.displayName)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 12,
                paddingVertical: 10,
                gap: 10,
                borderBottomWidth: idx < suggestions.length - 1 ? 1 : 0,
                borderBottomColor: "#f9fafb",
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: "#dcfce7",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#166534" }}>
                  {profile.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "500", color: "#111827" }}>
                  {profile.displayName}
                </Text>
                {profile.handicapIndex != null && (
                  <Text style={{ fontSize: 12, color: "#9ca3af" }}>
                    HCP {profile.handicapIndex.toFixed(1)}
                    {profile.homeClub ? ` · ${profile.homeClub}` : ""}
                  </Text>
                )}
              </View>
              <Ionicons name="add-circle-outline" size={20} color="#16a34a" />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
