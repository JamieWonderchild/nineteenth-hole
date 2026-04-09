"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Plus, Pencil, Trash2, ClipboardPaste, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";

const DEFAULT_PARS = [4, 4, 3, 4, 5, 3, 4, 4, 4, 4, 5, 4, 3, 4, 5, 3, 4, 4];
const DEFAULT_SI   = [1,11, 5,15, 9,17, 3,13, 7, 4,10, 2,16, 8,12,18, 6,14];

// ── Scorecard text parser ────────────────────────────────────────────────────
// Handles two formats:
//   Vertical:   one row per hole — "1  4  5" or "1,4,5" (hole, par, SI)
//   Horizontal: rows labelled "Par" and "SI/Stroke Index/Hdcp" with hole values as columns

type ParsedHole = { number: number; par: number; strokeIndex: number };

function parseScorecard(text: string): ParsedHole[] | null {
  const lines = text.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // ── Vertical: rows like "1 4 5" or "1,4,5" ──────────────────────────────
  const vertData: ParsedHole[] = [];
  for (const line of lines) {
    const nums = line.split(/[\t,;|\s]+/).map(s => parseInt(s)).filter(n => !isNaN(n) && n > 0);
    if (
      nums.length >= 3 &&
      nums[0] >= 1 && nums[0] <= 18 &&
      [3, 4, 5].includes(nums[1]) &&
      nums[2] >= 1 && nums[2] <= 18
    ) {
      vertData.push({ number: nums[0], par: nums[1], strokeIndex: nums[2] });
    }
  }
  if (vertData.length >= 9) {
    const byHole = new Map(vertData.map(h => [h.number, h]));
    const result = Array.from({ length: 18 }, (_, i) => byHole.get(i + 1)).filter(Boolean) as ParsedHole[];
    if (result.length >= 9) return result;
  }

  // ── Horizontal: find labelled "Par" and "SI/Stroke Index" rows ───────────
  let parRow: number[] | null = null;
  let siRow: number[] | null = null;

  for (const line of lines) {
    const allNums = [...line.matchAll(/\d+/g)].map(m => parseInt(m[0]));
    if (/^par\b/i.test(line)) {
      const pars = allNums.filter(n => n >= 3 && n <= 5);
      if (pars.length >= 9) parRow = pars;
    }
    if (/^(s\.?i\.?|stroke|hdcp|handicap|index|si\b)/i.test(line)) {
      const sis = allNums.filter(n => n >= 1 && n <= 18);
      if (sis.length >= 9) siRow = sis;
    }
  }

  if (parRow && siRow) {
    const len = Math.min(parRow.length, siRow.length, 18);
    if (len >= 9) {
      return Array.from({ length: len }, (_, i) => ({
        number: i + 1,
        par: parRow![i],
        strokeIndex: siRow![i],
      }));
    }
  }

  return null;
}

const TEE_COLOURS = [
  { key: "yardsWhite",  label: "White", bg: "bg-gray-100",   text: "text-gray-700" },
  { key: "yardsYellow", label: "Yellow", bg: "bg-yellow-100", text: "text-yellow-800" },
  { key: "yardsBlue",   label: "Blue",  bg: "bg-blue-100",   text: "text-blue-800" },
  { key: "yardsRed",    label: "Red",   bg: "bg-red-100",    text: "text-red-700" },
] as const;

type TeeKey = "yardsWhite" | "yardsYellow" | "yardsBlue" | "yardsRed";

function emptyHoles() {
  return Array.from({ length: 18 }, (_, i) => ({
    number: i + 1,
    par: DEFAULT_PARS[i],
    strokeIndex: DEFAULT_SI[i],
    yardsWhite: undefined as number | undefined,
    yardsYellow: undefined as number | undefined,
    yardsBlue: undefined as number | undefined,
    yardsRed: undefined as number | undefined,
  }));
}

type Hole = {
  number: number;
  par: number;
  strokeIndex: number;
  yards?: number;        // legacy
  yardsWhite?: number;
  yardsYellow?: number;
  yardsBlue?: number;
  yardsRed?: number;
};

function CourseForm({
  clubId,
  initial,
  onSaved,
  onCancel,
}: {
  clubId: Id<"clubs">;
  initial?: { _id: Id<"courses">; name: string; holes: Hole[] };
  onSaved: () => void;
  onCancel: () => void;
}) {
  const upsert = useMutation(api.courses.upsert);
  const [name, setName] = useState(initial?.name ?? "Main Course");
  const [holes, setHoles] = useState<Hole[]>(initial?.holes ?? emptyHoles());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Import panel
  const [showImport, setShowImport] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [parsed, setParsed] = useState<ParsedHole[] | null>(null);
  const [parseError, setParseError] = useState("");

  function handleParse() {
    const result = parseScorecard(pasteText);
    if (result) {
      setParsed(result);
      setParseError("");
    } else {
      setParsed(null);
      setParseError(
        "Couldn't detect par and stroke index. Try pasting in one of these formats:\n" +
        '• Vertical: one row per hole — "1  4  5" (hole, par, SI)\n' +
        '• Horizontal: rows labelled "Par" and "SI" or "Stroke Index" with values across'
      );
    }
  }

  function applyParsed() {
    if (!parsed) return;
    setHoles(prev => prev.map((h, i) => {
      const p = parsed.find(p => p.number === h.number) ?? parsed[i];
      return p ? { ...h, par: p.par, strokeIndex: p.strokeIndex } : h;
    }));
    setPasteText("");
    setParsed(null);
    setParseError("");
    setShowImport(false);
  }

  function setHoleField(idx: number, field: keyof Hole, value: string) {
    setHoles(prev => prev.map((h, i) => {
      if (i !== idx) return h;
      const num = value === "" ? undefined : parseInt(value);
      return { ...h, [field]: num };
    }));
  }

  function setHolePar(idx: number, value: string) {
    const num = parseInt(value);
    if (!isNaN(num)) setHoles(prev => prev.map((h, i) => i === idx ? { ...h, par: num } : h));
  }

  const totalPar = holes.reduce((s, h) => s + (h.par ?? 0), 0);

  // Check all SI values 1–18 used once
  const siValues = holes.map(h => h.strokeIndex).filter(Boolean);
  const siValid = siValues.length === 18 && new Set(siValues).size === 18;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!siValid) { setError("Stroke indexes must be unique values 1–18"); return; }
    setLoading(true);
    setError("");
    try {
      await upsert({
        courseId: initial?._id,
        clubId,
        name: name.trim() || "Main Course",
        holes: holes.map(h => ({
          number: h.number,
          par: h.par ?? 4,
          strokeIndex: h.strokeIndex ?? 1,
          yards: h.yards,
        })),
      });
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">

      {/* Paste import panel */}
      <div className="border border-dashed border-gray-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowImport(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2 font-medium">
            <ClipboardPaste size={14} />
            Import from scorecard text
          </span>
          {showImport ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showImport && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 pt-3">
              Copy your scorecard from your club website, a PDF, or a spreadsheet and paste it below.
              Works with both horizontal (Par/SI rows) and vertical (one hole per row) layouts.
            </p>
            <textarea
              value={pasteText}
              onChange={e => { setPasteText(e.target.value); setParsed(null); setParseError(""); }}
              rows={6}
              placeholder={"Paste scorecard here — for example:\n\nHole  1  2  3  4  5  6  7  8  9\nPar   4  4  3  4  5  4  3  5  4\nSI    7  3 17  9  5 13 15  1 11\n\nor one row per hole: 1  4  7"}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-green-600/30"
            />

            {parseError && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 whitespace-pre-line">
                {parseError}
              </p>
            )}

            {parsed && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 flex items-start gap-2">
                <CheckCircle2 size={15} className="text-green-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-800">
                    Detected {parsed.length} holes · Par {parsed.reduce((s, h) => s + h.par, 0)}
                  </p>
                  <p className="text-xs text-green-700 mt-0.5">
                    Par: {parsed.map(h => h.par).join(" ")}
                  </p>
                  <p className="text-xs text-green-700">
                    SI: {parsed.map(h => h.strokeIndex).join(" ")}
                  </p>
                </div>
                <Button type="button" size="sm" onClick={applyParsed} className="shrink-0">
                  Apply
                </Button>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleParse}
              disabled={!pasteText.trim()}
            >
              Parse scorecard
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-sm font-medium text-gray-700 block mb-1">Course name</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Main Course" />
        </div>
        <div className="text-right pt-6">
          <span className="text-sm text-gray-500">Par {totalPar}</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs uppercase tracking-wide">
              <th className="px-3 py-2.5 text-left font-medium text-gray-500">Hole</th>
              <th className="px-3 py-2.5 font-medium text-center text-gray-500">Par</th>
              <th className="px-3 py-2.5 font-medium text-center text-gray-500">SI</th>
              {TEE_COLOURS.map(t => (
                <th key={t.key} className={`px-2 py-2.5 font-medium text-center min-w-[4.5rem] ${t.text}`}>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${t.bg}`}>{t.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {holes.map((hole, idx) => (
              <tr key={hole.number} className="border-b border-gray-50 last:border-0">
                <td className="px-3 py-1.5 font-medium text-gray-700 w-14">{hole.number}</td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center justify-center gap-1">
                    {[3, 4, 5].map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setHolePar(idx, String(p))}
                        className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                          hole.par === p
                            ? "bg-green-700 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    type="number"
                    min="1"
                    max="18"
                    value={hole.strokeIndex ?? ""}
                    onChange={e => setHoleField(idx, "strokeIndex", e.target.value)}
                    className="w-16 text-center h-8 text-sm"
                  />
                </td>
                {TEE_COLOURS.map(t => (
                  <td key={t.key} className="px-1.5 py-1.5">
                    <Input
                      type="number"
                      min="0"
                      value={(hole[t.key as TeeKey] ?? hole.yards) ?? ""}
                      onChange={e => setHoleField(idx, t.key as keyof Hole, e.target.value)}
                      placeholder="—"
                      className="w-[4rem] text-center h-8 text-sm"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!siValid && holes.some(h => h.strokeIndex) && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Stroke indexes must be unique values 1–18 (currently: duplicates or missing values detected).
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : initial ? "Save changes" : "Add course"}
        </Button>
      </div>
    </form>
  );
}

export default function CoursesPage() {
  const { user } = useUser();
  const superAdmin = useQuery(api.clubs.isSuperAdmin);
  const memberships = useQuery(api.clubMembers.listByUser, user ? { userId: user.id } : "skip");
  const activeMembership = memberships?.find(m => m.status === "active");
  const isAdmin = activeMembership?.role === "admin" || superAdmin === true;
  const club = useQuery(api.clubs.get, activeMembership ? { clubId: activeMembership.clubId } : "skip");
  const courses = useQuery(api.courses.listByClub, club ? { clubId: club._id } : "skip");
  const removeCourse = useMutation(api.courses.remove);

  const [editing, setEditing] = useState<string | "new" | null>(null);

  // Reset editing when courses reload after save
  useEffect(() => { setEditing(null); }, [courses?.length]);

  if (!club) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <p className="text-gray-500">Admins only.</p>
      </div>
    );
  }

  const editingCourse = courses?.find(c => c._id === editing);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <MapPin size={22} className="text-green-700" />
            Course Card
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Add your club course to enable auto-scoring in Quick Games.
          </p>
        </div>
        {!editing && (courses?.length ?? 0) < 3 && (
          <Button onClick={() => setEditing("new")} size="sm">
            <Plus size={14} className="mr-1.5" />
            Add course
          </Button>
        )}
      </div>

      {editing === "new" && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-4">New course</h2>
          <CourseForm
            clubId={club._id}
            onSaved={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {courses === undefined ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : courses.length === 0 && editing !== "new" ? (
        <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-xl">
          <div className="text-4xl mb-3">⛳</div>
          <p className="text-gray-500 mb-1">No course card yet.</p>
          <p className="text-gray-400 text-sm mb-4">
            Add your course to enable net score and stableford auto-calculation in Quick Games.
          </p>
          <Button onClick={() => setEditing("new")}>
            <Plus size={14} className="mr-1.5" />
            Add course
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {courses.map(course => (
            <div key={course._id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {editing === course._id ? (
                <div className="p-5">
                  <h2 className="font-semibold text-gray-900 mb-4">Edit {course.name}</h2>
                  <CourseForm
                    clubId={club._id}
                    initial={course}
                    onSaved={() => setEditing(null)}
                    onCancel={() => setEditing(null)}
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                    <div>
                      <span className="font-semibold text-gray-900">{course.name}</span>
                      <span className="ml-2 text-sm text-gray-500">
                        Par {course.holes.reduce((s, h) => s + h.par, 0)} · 18 holes
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditing(course._id)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors rounded"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete ${course.name}? This cannot be undone.`)) {
                            removeCourse({ courseId: course._id });
                          }
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 text-center border-b border-gray-50">
                          <th className="px-2 py-1.5 text-left font-medium text-gray-500">Hole</th>
                          {course.holes.map(h => (
                            <th key={h.number} className="px-1.5 py-1.5 font-medium min-w-[2rem]">{h.number}</th>
                          ))}
                          <th className="px-2 py-1.5 font-medium text-gray-500">Tot</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="text-center border-b border-gray-50">
                          <td className="px-2 py-1.5 text-left text-gray-500 font-medium">Par</td>
                          {course.holes.map(h => (
                            <td key={h.number} className="px-1.5 py-1.5 font-medium text-gray-700">{h.par}</td>
                          ))}
                          <td className="px-2 py-1.5 font-semibold text-gray-900">
                            {course.holes.reduce((s, h) => s + h.par, 0)}
                          </td>
                        </tr>
                        <tr className="text-center border-b border-gray-50">
                          <td className="px-2 py-1.5 text-left text-gray-500 font-medium">SI</td>
                          {course.holes.map(h => (
                            <td key={h.number} className="px-1.5 py-1.5 text-gray-500">{h.strokeIndex}</td>
                          ))}
                          <td className="px-2 py-1.5" />
                        </tr>
                        {TEE_COLOURS.map(t => {
                          const hasData = course.holes.some(h => h[t.key as TeeKey] !== undefined);
                          if (!hasData) return null;
                          return (
                            <tr key={t.key} className="text-center border-b border-gray-50 last:border-0">
                              <td className={`px-2 py-1.5 text-left font-medium`}>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${t.bg} ${t.text}`}>{t.label}</span>
                              </td>
                              {course.holes.map(h => (
                                <td key={h.number} className="px-1.5 py-1.5 text-gray-500 text-[11px]">
                                  {h[t.key as TeeKey] ?? "—"}
                                </td>
                              ))}
                              <td className="px-2 py-1.5 text-gray-700 font-medium text-[11px]">
                                {course.holes.reduce((s, h) => s + (h[t.key as TeeKey] ?? 0), 0) || "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
