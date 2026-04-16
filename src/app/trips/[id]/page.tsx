"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import Link from "next/link";
import {
  ArrowLeft, Plus, Trash2, UserPlus, Check, X,
  MapPin, Search, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ── Types ─────────────────────────────────────────────────────────────────────

const FORMATS = [
  { value: "stableford", label: "Stableford" },
  { value: "strokeplay", label: "Strokeplay" },
  { value: "matchplay", label: "Matchplay" },
  { value: "scramble", label: "Scramble" },
  { value: "fourball", label: "Fourball" },
  { value: "rest", label: "Rest Day" },
] as const;

const STATUS_OPTIONS = ["planning", "confirmed", "completed"] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  });
}

function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (cur <= last) {
    dates.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

const MEMBER_STATUS_COLOUR: Record<string, string> = {
  organiser: "bg-green-100 text-green-700",
  accepted: "bg-blue-100 text-blue-700",
  invited: "bg-amber-100 text-amber-700",
  declined: "bg-gray-100 text-gray-500",
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const router = useRouter();

  const trip = useQuery(api.trips.get, { tripId: id as Id<"golfTrips"> });
  const updateTrip = useMutation(api.trips.update);
  const deleteTrip = useMutation(api.trips.deleteTrip);
  const respond = useMutation(api.trips.respond);

  const isOrganiser = trip?.members?.some(
    (m: any) => m.userId === user?.id && m.status === "organiser"
  );
  const myMembership = trip?.members?.find((m: any) => m.userId === user?.id);

  async function handleDelete() {
    if (!confirm("Delete this trip? This cannot be undone.")) return;
    await deleteTrip({ tripId: id as Id<"golfTrips"> });
    router.push("/trips");
  }

  if (trip === undefined) {
    return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-400">Loading…</div>;
  }
  if (trip === null) {
    return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-500">Trip not found or you don't have access.</div>;
  }

  const allDates = getDatesInRange(trip.startDate, trip.endDate);
  const dayMap = new Map(trip.days.map((d: any) => [d.date, d]));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <Link href="/trips" className="text-gray-400 hover:text-gray-700 mt-1">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{trip.name}</h1>
            {isOrganiser && (
              <StatusPicker
                value={trip.status}
                onChange={s => updateTrip({ tripId: id as Id<"golfTrips">, status: s })}
              />
            )}
            {!isOrganiser && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">
                {trip.status}
              </span>
            )}
          </div>
          {trip.description && (
            <p className="text-sm text-gray-500 mt-1">{trip.description}</p>
          )}
          <p className="text-sm text-gray-400 mt-1">
            {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
            {" · "}{allDates.length} day{allDates.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Invite banner for pending invitees */}
      {myMembership?.status === "invited" && (
        <div className="mb-6 rounded-xl border border-green-300 bg-green-50 p-4 flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-green-800">You've been invited to this trip</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => respond({ tripId: id as Id<"golfTrips">, accept: true })}
            >
              <Check size={14} className="mr-1" />Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => respond({ tripId: id as Id<"golfTrips">, accept: false })}
            >
              <X size={14} className="mr-1" />Decline
            </Button>
          </div>
        </div>
      )}

      {/* Itinerary */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">
          Itinerary
        </h2>
        <div className="flex flex-col gap-2">
          {allDates.map((date, i) => {
            const day = dayMap.get(date) as any | undefined;
            return (
              <DayRow
                key={date}
                date={date}
                dayNumber={i + 1}
                day={day}
                tripId={id as Id<"golfTrips">}
                isOrganiser={!!isOrganiser}
              />
            );
          })}
        </div>
      </section>

      {/* Players */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">
            Players ({trip.members.length})
          </h2>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-50">
          {trip.members.map((m: any) => (
            <MemberRow
              key={m._id}
              member={m}
              tripId={id as Id<"golfTrips">}
              isOrganiser={!!isOrganiser}
              currentUserId={user?.id}
            />
          ))}
        </div>
        {isOrganiser && (
          <InvitePanel tripId={id as Id<"golfTrips">} existingUserIds={trip.members.map((m: any) => m.userId)} />
        )}
      </section>

      {/* Danger zone */}
      {isOrganiser && (
        <div className="border border-red-200 rounded-xl p-4">
          <p className="text-sm font-medium text-red-700 mb-2">Danger zone</p>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 size={14} className="mr-1.5" />
            Delete trip
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Day row ───────────────────────────────────────────────────────────────────

function DayRow({
  date, dayNumber, day, tripId, isOrganiser,
}: {
  date: string;
  dayNumber: number;
  day: any | undefined;
  tripId: Id<"golfTrips">;
  isOrganiser: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const setDay = useMutation(api.trips.setDay);
  const removeDay = useMutation(api.trips.removeDay);

  const [format, setFormat] = useState(day?.format ?? "stableford");
  const [courseQuery, setCourseQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedCourseName, setSelectedCourseName] = useState(
    day?.courseNameFreetext ?? ""
  );
  const [notes, setNotes] = useState(day?.notes ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(courseQuery), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [courseQuery]);

  const courseResults = useQuery(
    api.golfCourses.search,
    debouncedQuery.length >= 2 ? { query: debouncedQuery, limit: 6 } : "skip"
  );

  // Reset form when day changes externally
  useEffect(() => {
    setFormat(day?.format ?? "stableford");
    setSelectedCourseName(day?.courseNameFreetext ?? "");
    setNotes(day?.notes ?? "");
    setCourseQuery("");
  }, [day?.format, day?.courseNameFreetext, day?.notes]);

  async function handleSave() {
    await setDay({
      tripId,
      date,
      format,
      courseNameFreetext: selectedCourseName || undefined,
      notes: notes || undefined,
    });
    setEditing(false);
  }

  async function handleClear() {
    await removeDay({ tripId, date });
    setFormat("stableford");
    setSelectedCourseName("");
    setNotes("");
    setEditing(false);
  }

  const formatLabel = FORMATS.find(f => f.value === format)?.label ?? format;

  return (
    <div className={`rounded-xl border p-4 ${editing ? "border-green-300 bg-green-50" : day ? "border-gray-200 bg-white" : "border-dashed border-gray-200 bg-gray-50"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0 mt-0.5">
            {dayNumber}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">{formatDate(date)}</p>
            {day ? (
              <p className="text-sm text-gray-500 mt-0.5">
                {formatLabel}
                {day.courseNameFreetext && ` · ${day.courseNameFreetext}`}
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">Not planned yet</p>
            )}
          </div>
        </div>
        {isOrganiser && (
          <button
            onClick={() => setEditing(e => !e)}
            className="text-xs text-green-600 hover:text-green-800 font-medium"
          >
            {editing ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-4 flex flex-col gap-3 border-t border-green-200 pt-4">
          {/* Format */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Format</Label>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setFormat(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    format === f.value
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-green-400"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Course */}
          {format !== "rest" && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Course</Label>
              {selectedCourseName ? (
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2">
                    {selectedCourseName}
                  </span>
                  <button
                    onClick={() => { setSelectedCourseName(""); setCourseQuery(""); }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    className="pl-8 text-sm"
                    placeholder="Search courses or type name"
                    value={courseQuery}
                    onChange={e => setCourseQuery(e.target.value)}
                  />
                  {courseResults && courseResults.length > 0 && (
                    <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {(courseResults as any[]).map((c: any) => (
                        <button
                          key={c._id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => {
                            setSelectedCourseName(c.name);
                            setCourseQuery("");
                            setDebouncedQuery("");
                          }}
                        >
                          <span className="font-medium">{c.name}</span>
                          {c.city && <span className="text-gray-400 ml-2 text-xs">{c.city}</span>}
                        </button>
                      ))}
                      <button
                        className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 border-t border-gray-100"
                        onClick={() => { setSelectedCourseName(courseQuery); setCourseQuery(""); }}
                      >
                        Use "{courseQuery}"
                      </button>
                    </div>
                  )}
                  {courseQuery.length >= 2 && courseResults?.length === 0 && (
                    <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
                      <button
                        className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
                        onClick={() => { setSelectedCourseName(courseQuery); setCourseQuery(""); }}
                      >
                        Use "{courseQuery}"
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Notes <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input
              className="text-sm"
              placeholder="Tee time, travel notes…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleSave}>Save</Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            {day && (
              <Button size="sm" variant="ghost" className="text-red-500 ml-auto" onClick={handleClear}>
                Clear day
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Member row ────────────────────────────────────────────────────────────────

function MemberRow({ member, tripId, isOrganiser, currentUserId }: {
  member: any;
  tripId: Id<"golfTrips">;
  isOrganiser: boolean;
  currentUserId?: string;
}) {
  const removeMember = useMutation(api.trips.removeMember);
  const canRemove = isOrganiser && member.status !== "organiser";

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600">
          {member.displayName?.[0]?.toUpperCase() ?? "?"}
        </div>
        <span className="text-sm font-medium text-gray-900">{member.displayName}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${MEMBER_STATUS_COLOUR[member.status] ?? "bg-gray-100 text-gray-500"}`}>
          {member.status === "organiser" ? "Organiser" : member.status}
        </span>
        {canRemove && (
          <button
            onClick={() => removeMember({ tripId, userId: member.userId })}
            className="text-gray-300 hover:text-red-500 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Invite panel ──────────────────────────────────────────────────────────────

function InvitePanel({ tripId, existingUserIds }: {
  tripId: Id<"golfTrips">;
  existingUserIds: string[];
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [inviting, setInviting] = useState<string | null>(null);
  const invite = useMutation(api.trips.invite);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  const results = useQuery(
    api.golferProfiles.search,
    debouncedQuery.length >= 2 ? { term: debouncedQuery } : "skip"
  );

  async function handleInvite(profile: any) {
    setInviting(profile.userId);
    try {
      await invite({ tripId, userId: profile.userId, displayName: profile.displayName });
      setQuery("");
      setDebouncedQuery("");
    } finally {
      setInviting(null);
    }
  }

  return (
    <div className="mt-3">
      <div className="relative">
        <UserPlus size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          className="pl-8 text-sm"
          placeholder="Search players by name…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>
      {results && results.length > 0 && (
        <div className="mt-1 rounded-xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-50">
          {(results as any[])
            .filter((p: any) => !existingUserIds.includes(p.userId))
            .map((p: any) => (
              <div key={p.userId} className="flex items-center justify-between px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.displayName}</p>
                  {p.homeClub && <p className="text-xs text-gray-400">{p.homeClub}</p>}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={inviting === p.userId}
                  onClick={() => handleInvite(p)}
                >
                  {inviting === p.userId ? "Inviting…" : "Invite"}
                </Button>
              </div>
            ))}
        </div>
      )}
      {debouncedQuery.length >= 2 && results?.length === 0 && (
        <p className="text-xs text-gray-400 mt-2 px-1">No platform users found for "{debouncedQuery}"</p>
      )}
    </div>
  );
}

// ── Status picker ─────────────────────────────────────────────────────────────

function StatusPicker({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  const COLOURS: Record<string, string> = {
    planning: "bg-amber-100 text-amber-700",
    confirmed: "bg-green-100 text-green-700",
    completed: "bg-gray-100 text-gray-500",
  };
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize flex items-center gap-1 ${COLOURS[value] ?? COLOURS.planning}`}
      >
        {value}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute z-10 top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[120px]">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              className="w-full text-left px-3 py-1.5 text-xs capitalize hover:bg-gray-50"
              onClick={() => { onChange(s); setOpen(false); }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
