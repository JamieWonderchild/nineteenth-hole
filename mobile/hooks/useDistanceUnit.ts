import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type DistanceUnit = "yards" | "metres";

const STORAGE_KEY = "distance_unit";
const DEFAULT: DistanceUnit = "yards";

export function useDistanceUnit() {
  const [unit, setUnitState] = useState<DistanceUnit>(DEFAULT);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === "yards" || val === "metres") setUnitState(val);
      setLoaded(true);
    });
  }, []);

  const setUnit = useCallback(async (u: DistanceUnit) => {
    setUnitState(u);
    await AsyncStorage.setItem(STORAGE_KEY, u);
  }, []);

  /** Format a distance value with its unit label, e.g. "342m" or "374yds" */
  function fmt(yards?: number | null, metres?: number | null): string | null {
    if (unit === "metres") {
      if (metres) return `${metres}m`;
      if (yards) return `${Math.round(yards * 0.9144)}m`;
      return null;
    }
    if (yards) return `${yards}yds`;
    if (metres) return `${Math.round(metres / 0.9144)}yds`;
    return null;
  }

  /** Format a total distance (tee total), e.g. "6,450 yds" or "5,899 m" */
  function fmtTotal(yards?: number | null, metres?: number | null): string | null {
    if (unit === "metres") {
      const m = metres ?? (yards ? Math.round(yards * 0.9144) : null);
      return m ? `${m.toLocaleString()} m` : null;
    }
    const y = yards ?? (metres ? Math.round(metres / 0.9144) : null);
    return y ? `${y.toLocaleString()} yds` : null;
  }

  return { unit, setUnit, fmt, fmtTotal, loaded };
}
