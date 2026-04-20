"use client";

import { X, Terminal, Check, CheckCircle } from "lucide-react";
import Link from "next/link";
import type { Id } from "convex/_generated/dataModel";

type TerminalEntry = {
  _id: Id<"posTerminals">;
  terminalId: string;
  name: string;
  provider: string;
};

export function TerminalPickerModal({
  terminals,
  selected,
  onSelect,
  onClose,
  theme = "light",
}: {
  terminals: TerminalEntry[];
  selected: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  theme?: "light" | "dark";
}) {
  const d = theme === "dark";

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-6 ${d ? "bg-black/80" : "items-end sm:items-center bg-black/40"}`}>
      <div className={`w-full max-w-sm shadow-2xl ${
        d
          ? "bg-gray-900 border border-gray-700 rounded-2xl p-6"
          : "bg-white rounded-t-2xl sm:rounded-2xl p-6 shadow-xl"
      }`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className={`font-bold text-lg ${d ? "text-white" : "text-gray-900"}`}>Select terminal</h2>
          <button
            onClick={onClose}
            className={d
              ? "text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition-colors"
              : "text-gray-400 hover:text-gray-600"
            }
          >
            <X size={20} />
          </button>
        </div>

        {terminals.length === 0 ? (
          <div className="text-center py-6">
            <p className={`text-sm mb-3 ${d ? "text-gray-500" : "text-gray-500"}`}>No terminals registered.</p>
            <Link
              href="/manage/pos/terminals"
              className={`font-medium underline text-sm ${d ? "text-green-400" : "text-green-600"}`}
            >
              Add a terminal →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {terminals.map(t => {
              const isSelected = selected === t.terminalId;
              return (
                <button
                  key={t._id}
                  onClick={() => { onSelect(t.terminalId); onClose(); }}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 transition-all text-left ${
                    d
                      ? isSelected
                        ? "border-green-500 bg-green-900/30"
                        : "border-gray-700 bg-gray-800 hover:border-gray-600"
                      : isSelected
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <Terminal size={20} className={isSelected ? (d ? "text-green-400" : "text-green-600") : "text-gray-400"} />
                  <div>
                    <p className={`font-semibold ${d ? "text-white" : "text-gray-900"}`}>{t.name}</p>
                    <p className={`text-xs capitalize ${d ? "text-gray-500" : "text-gray-400"}`}>{t.provider}</p>
                  </div>
                  {isSelected && (
                    d
                      ? <Check size={18} className="ml-auto text-green-400" />
                      : <CheckCircle size={18} className="ml-auto text-green-500" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
