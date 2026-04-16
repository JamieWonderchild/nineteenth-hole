"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { ChevronLeft, ChevronRight, Settings, Sunset, AlertTriangle, Plus, X } from "lucide-react";
import { getSunsetTime, minutesBeforeSunset } from "@/lib/sunset";

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

function datesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (cur <= last) {
    dates.push(toDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function AvailDots({ available, max }: { available: number; max: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`w-2 h-2 rounded-full ${i < (max - available) ? "bg-gray-400" : "bg-green-400"}`} />
      ))}
    </div>
  );
}

function WeekStrip({ selectedDate, onSelect, slotsMap }: {
  selectedDate: string; onSelect: (d: string) => void; slotsMap: Record<string, number>;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + weekOffset * 7 + i);
    return toDateStr(d);
  });
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => setWeekOffset(w => Math.max(0, w - 1))} disabled={weekOffset === 0}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
          <ChevronLeft size={15} />
        </button>
        <span className="flex-1 text-xs font-semibold text-gray-500 text-center uppercase tracking-wide">
          {new Date(days[0] + "T00:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </span>
        <button onClick={() => setWeekOffset(w => w + 1)} className="p-1 rounded hover:bg-gray-100">
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(dateStr => {
          const d = new Date(dateStr + "T00:00:00");
          const count = slotsMap[dateStr] ?? 0;
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === toDateStr(new Date());
          return (
            <button key={dateStr} onClick={() => onSelect(dateStr)}
              className={["flex flex-col items-center py-2 rounded-xl text-xs transition-colors",
                isSelected ? "bg-green-700 text-white" : "hover:bg-gray-50 text-gray-900",
                isToday && !isSelected ? "ring-1 ring-green-400" : "",
              ].join(" ")}
            >
              <span className="font-medium">{d.toLocaleDateString("en-GB", { weekday: "short" })}</span>
              <span className={`font-bold text-sm mt-0.5 ${isToday && !isSelected ? "text-green-700" : ""}`}>{d.getDate()}</span>
              <span className={`text-[10px] mt-0.5 ${isSelected ? "text-green-200" : count > 0 ? "text-green-600" : "text-gray-300"}`}>
                {count > 0 ? `${count}` : "–"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Inline "book for member" form
function BookForMemberForm({ slotId, clubId, available, onDone }: {
  slotId: Id<"teeTimeSlots">; clubId: Id<"clubs">; available: number; onDone: () => void;
}) {
  const bookForMember = useMutation(api.teeTimes.bookForMember);
  const [name, setName] = useState("");
  const [playerCount, setPlayerCount] = useState(1);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true); setError(null);
    try {
      await bookForMember({ slotId, clubId, displayName: name.trim(), playerCount, notes: notes.trim() || undefined });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-wrap items-end gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
      <div>
        <label className="block text-[10px] font-medium text-gray-500 mb-1">Name</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Member name" required autoFocus
          className="border border-gray-300 rounded-lg px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white w-36" />
      </div>
      <div>
        <label className="block text-[10px] font-medium text-gray-500 mb-1">Players</label>
        <div className="flex gap-1">
          {Array.from({ length: Math.min(available, 4) }, (_, i) => i + 1).map(n => (
            <button type="button" key={n} onClick={() => setPlayerCount(n)}
              className={`w-7 h-7 rounded text-xs font-semibold transition-colors ${playerCount === n ? "bg-green-700 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-w-28">
        <label className="block text-[10px] font-medium text-gray-500 mb-1">Note</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional"
          className="w-full border border-gray-300 rounded-lg px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
      </div>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="px-3 py-1.5 bg-green-700 text-white text-xs font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50">
        {loading ? "Adding…" : "Add booking"}
      </button>
      <button type="button" onClick={onDone} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
    </form>
  );
}

export default function ManageTeeTimes() {
  const { user } = useUser();
  const memberships = useQuery(api.clubMembers.listByUser, user ? { userId: user.id } : "skip");
  const adminMembership = memberships?.find(m => m.role === "admin");
  const club = useQuery(api.clubs.get, adminMembership ? { clubId: adminMembership.clubId } : "skip");

  const today = toDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [showGen, setShowGen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [genMsg, setGenMsg] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [addingToSlot, setAddingToSlot] = useState<string | null>(null);

  const [genStartDate, setGenStartDate] = useState(today);
  const [genEndDate, setGenEndDate] = useState(today);
  const [genFirstTime, setGenFirstTime] = useState("07:00");
  const [genLastTime, setGenLastTime] = useState("18:00");
  const [genInterval, setGenInterval] = useState(9);
  const [genMaxPlayers, setGenMaxPlayers] = useState(4);

  const [advanceDays, setAdvanceDays] = useState<number | null>(null);
  const [visitorStart, setVisitorStart] = useState<string | null>(null);
  const [savingPolicy, setSavingPolicy] = useState(false);

  const slots = useQuery(api.teeTimes.listSlotsForDate, club ? { clubId: club._id, date: selectedDate } : "skip");
  const availableDates = useQuery(api.teeTimes.listAvailableDates, club ? { clubId: club._id } : "skip");

  const generateSlots = useMutation(api.teeTimes.generateSlots);
  const cancelBooking = useMutation(api.teeTimes.cancelBooking);
  const setSlotBlocked = useMutation(api.teeTimes.setSlotBlocked);
  const deleteSlotsForDate = useMutation(api.teeTimes.deleteSlotsForDate);
  const updatePolicy = useMutation(api.teeTimes.updatePolicy);

  if (!club) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" /></div>;

  const effectiveAdvanceDays = advanceDays ?? (club.advanceBookingDays ?? 7);
  const effectiveVisitorStart = visitorStart ?? (club.weekendVisitorStartTime ?? "11:00");
  const sunset = getSunsetTime(selectedDate, club.latitude, club.longitude);
  const slotsMap: Record<string, number> = {};
  availableDates?.forEach(d => { slotsMap[d] = 1; });
  const totalBookings = slots?.reduce((sum, s) => sum + s.bookings.length, 0) ?? 0;
  const totalPlayers = slots?.reduce((sum, s) => sum + s.takenPlayers, 0) ?? 0;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!club) return;
    setGenerating(true); setGenMsg(null);
    try {
      const dates = datesInRange(genStartDate, genEndDate);
      const count = await generateSlots({ clubId: club._id, dates, firstTime: genFirstTime, lastTime: genLastTime, intervalMinutes: genInterval, maxPlayers: genMaxPlayers });
      setGenMsg(`Created ${count} new slot${count !== 1 ? "s" : ""} across ${dates.length} day${dates.length !== 1 ? "s" : ""}`);
      setShowGen(false);
    } catch (err) {
      setGenMsg(err instanceof Error ? err.message : "Failed");
    }
    setGenerating(false);
  }

  async function handleClearDay() {
    if (!club) return;
    if (!confirm(`Delete all slots for ${selectedDate}? This will also cancel any bookings.`)) return;
    await deleteSlotsForDate({ clubId: club._id, date: selectedDate });
  }

  async function handleSavePolicy() {
    if (!club) return;
    setSavingPolicy(true);
    try {
      await updatePolicy({ clubId: club._id, advanceBookingDays: effectiveAdvanceDays, weekendVisitorStartTime: effectiveVisitorStart });
      setShowSettings(false);
    } finally {
      setSavingPolicy(false);
    }
  }

  return (
    <div className="px-6 py-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tee Times</h1>
          <p className="text-gray-500 text-sm mt-0.5">{club.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50">
            <Settings size={14} /> Policy
          </button>
          <button onClick={() => setShowGen(v => !v)}
            className="px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-600">
            {showGen ? "Cancel" : "+ Generate slots"}
          </button>
        </div>
      </div>

      {/* Policy settings */}
      {showSettings && (
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Booking policy</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Advance booking window (days)</label>
              <input type="number" min={1} max={30} value={effectiveAdvanceDays} onChange={e => setAdvanceDays(parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <p className="text-xs text-gray-400 mt-1">Default for members without a specific category</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Earliest visitor tee time on weekends</label>
              <input type="time" value={effectiveVisitorStart} onChange={e => setVisitorStart(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <p className="text-xs text-gray-400 mt-1">Weekend slots before this time are members only</p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowSettings(false)} className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={handleSavePolicy} disabled={savingPolicy} className="px-4 py-2 bg-green-700 text-white text-sm font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50">
              {savingPolicy ? "Saving…" : "Save policy"}
            </button>
          </div>
        </div>
      )}

      {/* Generate slots */}
      {showGen && (
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Generate tee time slots</h2>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">From date</label>
                <input type="date" value={genStartDate} onChange={e => setGenStartDate(e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">To date</label>
                <input type="date" value={genEndDate} onChange={e => setGenEndDate(e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">First tee time</label>
                <input type="time" value={genFirstTime} onChange={e => setGenFirstTime(e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Last tee time</label>
                <input type="time" value={genLastTime} onChange={e => setGenLastTime(e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Interval (minutes)</label>
                <input type="number" value={genInterval} onChange={e => setGenInterval(parseInt(e.target.value))} min={5} max={30} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Max players per slot</label>
                <input type="number" value={genMaxPlayers} onChange={e => setGenMaxPlayers(parseInt(e.target.value))} min={1} max={8} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
            {genMsg && (
              <p className={`text-sm rounded-lg px-4 py-2 ${genMsg.includes("Created") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {genMsg}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowGen(false)} className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={generating} className="px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-600 disabled:opacity-50">
                {generating ? "Generating…" : "Generate"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Week strip */}
      <WeekStrip selectedDate={selectedDate} onSelect={setSelectedDate} slotsMap={slotsMap} />

      {/* Day bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-sm font-semibold text-gray-700">
          {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </span>
        {sunset && (
          <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full">
            <Sunset size={12} /> Sunset {sunset}
          </span>
        )}
        {slots && slots.length > 0 && (
          <span className="text-xs text-gray-500">
            {totalBookings} booking{totalBookings !== 1 ? "s" : ""} · {totalPlayers} player{totalPlayers !== 1 ? "s" : ""}
          </span>
        )}
        {slots && slots.length > 0 && (
          <button onClick={handleClearDay} className="ml-auto text-xs text-red-500 hover:text-red-700 hover:underline">Clear day</button>
        )}
      </div>

      {/* Slots */}
      {!slots ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin h-6 w-6 border-4 border-green-600 border-t-transparent rounded-full" />
        </div>
      ) : slots.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
          <p className="text-gray-400 text-sm">No slots for this date.</p>
          <button onClick={() => setShowGen(true)} className="mt-2 text-green-700 text-sm font-medium hover:underline">Generate slots →</button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
          {slots.map(slot => {
            const minsBeforeSunset = sunset ? minutesBeforeSunset(slot.time, sunset) : 999;
            const isAfterSunset = minsBeforeSunset < 0;
            const isLateSunset = minsBeforeSunset >= 0 && minsBeforeSunset <= 90;
            const isAddingHere = addingToSlot === slot._id;

            return (
              <div key={slot._id} className={`px-5 py-3.5 ${slot.isBlocked ? "bg-gray-50 opacity-60" : isAfterSunset ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-3">
                  {/* Time */}
                  <span className="font-mono text-sm font-bold text-gray-900 w-12 shrink-0">{slot.time}</span>

                  {/* Dots */}
                  <AvailDots available={slot.available} max={slot.maxPlayers} />

                  {/* Status badge */}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                    slot.isBlocked ? "bg-gray-200 text-gray-500" :
                    slot.available === 0 ? "bg-red-100 text-red-600" :
                    "bg-green-100 text-green-700"
                  }`}>
                    {slot.isBlocked ? "Blocked" : slot.available === 0 ? "Full" : `${slot.available} free`}
                  </span>

                  {isLateSunset && !isAfterSunset && (
                    <span className="flex items-center gap-1 text-xs text-orange-500 shrink-0">
                      <AlertTriangle size={11} /> Late
                    </span>
                  )}

                  {/* Right side controls */}
                  <div className="ml-auto flex items-center gap-3 shrink-0">
                    {!slot.isBlocked && slot.available > 0 && (
                      <button onClick={() => setAddingToSlot(isAddingHere ? null : slot._id)}
                        className={`flex items-center gap-1 text-xs font-medium transition-colors ${isAddingHere ? "text-gray-400" : "text-green-700 hover:text-green-900"}`}>
                        <Plus size={12} /> Add
                      </button>
                    )}
                    <button onClick={() => setSlotBlocked({ slotId: slot._id, blocked: !slot.isBlocked })}
                      className="text-xs text-gray-400 hover:text-gray-600 hover:underline">
                      {slot.isBlocked ? "Unblock" : "Block"}
                    </button>
                  </div>
                </div>

                {/* Bookings list */}
                {slot.bookings.length > 0 && (
                  <div className="mt-2.5 space-y-1.5 pl-15">
                    {slot.bookings.map(b => (
                      <div key={b._id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-900">{b.displayName}</span>
                          <span className="text-gray-400 text-xs">· {b.playerCount} player{b.playerCount !== 1 ? "s" : ""}</span>
                          {(b as { bookingType?: string }).bookingType === "visitor" && (
                            <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">visitor</span>
                          )}
                          {b.notes && <span className="text-gray-400 text-xs">· {b.notes}</span>}
                        </div>
                        <button onClick={() => cancelBooking({ bookingId: b._id as Id<"teeTimeBookings"> })}
                          className="text-gray-300 hover:text-red-500 transition-colors ml-3 shrink-0">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add booking form */}
                {isAddingHere && club && (
                  <div className="pl-15 mt-1">
                    <BookForMemberForm
                      slotId={slot._id} clubId={club._id} available={slot.available}
                      onDone={() => setAddingToSlot(null)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
