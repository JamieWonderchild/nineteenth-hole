"use client";

/**
 * PinLock — Full-screen PIN lock overlay for kiosk POS.
 *
 * Usage:
 *   <PinLock kioskId={...} onUnlocked={() => setManagerMode(true)} onLock={() => setManagerMode(false)} />
 *
 * The component renders nothing when unlocked (returns null).
 * The parent is responsible for showing the "lock" affordance when in manager mode.
 *
 * PIN verification flow:
 *   1. Staff sees the locked POS and can use it normally.
 *   2. To access manager mode, they triple-tap the hidden trigger zone (top-right corner).
 *   3. PIN pad appears as a full-screen overlay.
 *   4. PIN is SHA-256 hashed client-side before being compared to the stored hash.
 *   5. On success, onUnlocked() fires and the overlay dismisses.
 *   6. On 5 failed attempts, a 30-second cooldown activates.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Lock, Delete } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── PIN Pad ───────────────────────────────────────────────────────────────────

const PAD_KEYS = ["1","2","3","4","5","6","7","8","9","","0","⌫"] as const;

function PinDisplay({ digits, error }: { digits: string; error: boolean }) {
  const MAX = 8;
  return (
    <div className={`flex gap-3 justify-center mb-8 transition-all ${error ? "animate-[shake_0.3s_ease]" : ""}`}>
      {Array.from({ length: Math.max(digits.length, 4) }, (_, i) => (
        <div
          key={i}
          className={`w-4 h-4 rounded-full border-2 transition-all ${
            i < digits.length
              ? error
                ? "bg-red-500 border-red-500"
                : "bg-white border-white"
              : "border-gray-600"
          }`}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface PinLockProps {
  kioskId: Id<"posKiosks">;
  /** Called when PIN is verified — parent should show manager controls */
  onUnlocked: () => void;
  /** Whether the PIN pad should be visible (controlled by parent trigger) */
  visible: boolean;
  /** Called when user dismisses the PIN pad without unlocking */
  onDismiss: () => void;
}

export function PinPad({ kioskId, onUnlocked, visible, onDismiss }: PinLockProps) {
  const kiosk = useQuery(api.posLocations.listKiosks, { clubId: "skip" as unknown as Id<"clubs"> }); // loaded via kioskId directly
  const kioskData = useQuery(api.posLocations.getKioskById, { kioskId });

  const [digits, setDigits] = useState("");
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0); // seconds remaining
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear on open
  useEffect(() => {
    if (visible) {
      setDigits("");
      setError(false);
    }
  }, [visible]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    cooldownRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(cooldownRef.current!);
          setAttempts(0);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, [cooldown]);

  const handleKey = useCallback(async (key: string) => {
    if (cooldown > 0) return;

    if (key === "⌫") {
      setDigits((d) => d.slice(0, -1));
      return;
    }

    const next = digits + key;
    setDigits(next);

    // Auto-submit when 4–8 digits entered and we have the hash to check
    if (next.length >= 4 && kioskData?.pinHash) {
      const hash = await sha256(next);
      if (hash === kioskData.pinHash) {
        setDigits("");
        setError(false);
        setAttempts(0);
        onUnlocked();
        onDismiss();
      } else if (next.length >= 8) {
        // Max digits reached, wrong PIN
        triggerError(next.length);
      }
      // If fewer than 8 digits, let them keep entering
    }
  }, [digits, cooldown, kioskData, onUnlocked, onDismiss]);

  async function handleSubmit() {
    if (!digits || !kioskData?.pinHash) return;
    const hash = await sha256(digits);
    if (hash === kioskData.pinHash) {
      setDigits("");
      setError(false);
      setAttempts(0);
      onUnlocked();
      onDismiss();
    } else {
      triggerError(digits.length);
    }
  }

  function triggerError(digitCount: number) {
    setError(true);
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    setTimeout(() => {
      setError(false);
      setDigits("");
    }, 600);
    // Lockout after 5 failed attempts
    if (newAttempts >= 5) {
      setCooldown(30);
    }
  }

  // Keyboard support
  useEffect(() => {
    if (!visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key >= "0" && e.key <= "9") handleKey(e.key);
      else if (e.key === "Backspace") handleKey("⌫");
      else if (e.key === "Enter") handleSubmit();
      else if (e.key === "Escape") onDismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, handleKey, handleSubmit, onDismiss]);

  if (!visible) return null;

  const noPinSet = kioskData !== undefined && !kioskData?.pinHash;

  return (
    <div className="fixed inset-0 z-[100] bg-gray-950 flex flex-col items-center justify-center select-none">
      {/* Lock icon */}
      <div className="mb-6 w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center">
        <Lock size={28} className="text-gray-400" />
      </div>

      <h2 className="text-white text-xl font-bold mb-1">Manager access</h2>
      <p className="text-gray-500 text-sm mb-8">
        {kioskData?.name ?? "Kiosk"} · Enter PIN to continue
      </p>

      {noPinSet ? (
        <div className="bg-amber-900/30 border border-amber-700 rounded-2xl px-6 py-4 text-amber-300 text-sm text-center max-w-xs mb-6">
          No PIN has been set for this kiosk.{" "}
          Set one in <strong>Locations &amp; Kiosks</strong> to enable the lock screen.
        </div>
      ) : (
        <>
          {/* PIN display */}
          <PinDisplay digits={digits} error={error} />

          {/* Cooldown message */}
          {cooldown > 0 && (
            <p className="text-red-400 text-sm mb-6 font-medium">
              Too many attempts. Try again in {cooldown}s.
            </p>
          )}

          {/* Error message */}
          {error && cooldown === 0 && (
            <p className="text-red-400 text-sm mb-2 -mt-6">Incorrect PIN</p>
          )}

          {/* Numeric pad */}
          <div className="grid grid-cols-3 gap-3 w-64 mb-6">
            {PAD_KEYS.map((key, i) => {
              if (key === "") return <div key={i} />;
              const isDelete = key === "⌫";
              return (
                <button
                  key={key}
                  onClick={() => handleKey(key)}
                  disabled={cooldown > 0}
                  className={`
                    h-16 rounded-2xl text-xl font-bold transition-all active:scale-95
                    ${isDelete
                      ? "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                      : "bg-gray-800 text-white hover:bg-gray-700 active:bg-gray-600"
                    }
                    disabled:opacity-30 disabled:cursor-not-allowed
                  `}
                >
                  {isDelete ? <Delete size={20} className="mx-auto" /> : key}
                </button>
              );
            })}
          </div>

          {/* Submit (shown when 4+ digits entered) */}
          {digits.length >= 4 && (
            <button
              onClick={handleSubmit}
              disabled={cooldown > 0}
              className="w-64 py-4 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-bold rounded-2xl text-lg transition-colors mb-4 disabled:opacity-30"
            >
              Unlock
            </button>
          )}
        </>
      )}

      {/* Cancel */}
      <button
        onClick={onDismiss}
        className="text-gray-600 hover:text-gray-400 text-sm transition-colors mt-2"
      >
        Cancel
      </button>
    </div>
  );
}

// ── Hidden trigger zone ───────────────────────────────────────────────────────
// Triple-tap the top-right corner of the screen to show the PIN pad.
// Invisible in normal use — staff learn the gesture.

interface HiddenTriggerProps {
  onTripleTap: () => void;
}

export function HiddenManagerTrigger({ onTripleTap }: HiddenTriggerProps) {
  const tapsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleTap() {
    tapsRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);

    if (tapsRef.current >= 3) {
      tapsRef.current = 0;
      onTripleTap();
    } else {
      timerRef.current = setTimeout(() => {
        tapsRef.current = 0;
      }, 800);
    }
  }

  return (
    <div
      onPointerDown={handleTap}
      className="absolute top-0 right-0 w-20 h-20 z-10"
      aria-hidden="true"
    />
  );
}
