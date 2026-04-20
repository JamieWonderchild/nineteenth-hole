"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { formatCurrency } from "@/lib/format";

const TIMEOUT_SECONDS = 90;

export function TerminalWaitingOverlay({
  amount,
  currency,
  terminalName,
  onCancel,
  onTimeout,
  theme = "light",
}: {
  amount: number;
  currency: string;
  terminalName?: string;
  onCancel: () => void;
  onTimeout: () => void;
  theme?: "light" | "dark";
}) {
  const [secondsLeft, setSecondsLeft] = useState(TIMEOUT_SECONDS);
  const d = theme === "dark";

  useEffect(() => {
    if (secondsLeft <= 0) { onTimeout(); return; }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, onTimeout]);

  const pct = (secondsLeft / TIMEOUT_SECONDS) * 100;
  const circumference = 2 * Math.PI * 28; // r=28

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-6 ${d ? "bg-black/90" : "bg-black/50"}`}>
      <div className={`w-full max-w-sm rounded-2xl shadow-2xl p-8 text-center ${d ? "bg-gray-900 border border-gray-700" : "bg-white"}`}>

        {/* Spinning loader + countdown ring */}
        <div className="relative w-20 h-20 mx-auto mb-6">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
            <circle
              cx="32" cy="32" r="28"
              fill="none"
              stroke={d ? "#374151" : "#e5e7eb"}
              strokeWidth="4"
            />
            <circle
              cx="32" cy="32" r="28"
              fill="none"
              stroke="#22c55e"
              strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - pct / 100)}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={24} className="text-green-500 animate-spin" />
          </div>
        </div>

        <p className={`text-3xl font-black mb-1 ${d ? "text-white" : "text-gray-900"}`}>
          {formatCurrency(amount, currency)}
        </p>
        <p className={`font-semibold mb-1 ${d ? "text-gray-300" : "text-gray-700"}`}>
          Waiting for payment…
        </p>
        {terminalName && (
          <p className={`text-sm mb-6 ${d ? "text-gray-500" : "text-gray-400"}`}>
            on {terminalName}
          </p>
        )}

        <p className={`text-xs mb-6 ${d ? "text-gray-600" : "text-gray-400"}`}>
          Times out in {secondsLeft}s
        </p>

        <button
          onClick={onCancel}
          className={`flex items-center gap-2 mx-auto text-sm font-medium px-4 py-2 rounded-xl transition-colors ${
            d
              ? "text-gray-400 hover:text-white hover:bg-gray-800"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          }`}
        >
          <X size={14} /> Cancel payment
        </button>
      </div>
    </div>
  );
}
