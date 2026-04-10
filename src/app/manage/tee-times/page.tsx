"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { ChevronLeft, ChevronRight, Settings, Sunset, AlertTriangle } from "lucide-react";
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

// ── Week strip (admin — no advance-booking limit) ─────────────────────────────

function WeekStrip({
  selectedDate,
  onSelect,
  slotsMap,
}: {
  selectedDate: string;
  onSelect: (d: string) => void;
  slotsMap: Record<string, number>; // date → slot count
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
        <button
          onClick={() => setWeekOffset(w => Math.max(0, w - 1))}
          disabled={weekOffset === 0}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
        >
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
            <button
              key={dateStr}
              onClick={() => onSelect(dateStr)}
              className={[
                "flex flex-col items-center py-2 rounded-xl text-xs transition-colors",
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

  // Generate form
  const [genStartDate, setGenStartDate] = useState(today);
  const [genEndDate, setGenEndDate] = useState(today);
  const [genFirstTime, setGenFirstTime] = useState("07:00");
  const [genLastTime, setGenLastTime] = useState("18:00");
  const [genInterval, setGenInterval] = useState(9);
  const [genMaxPlayers, setGenMaxPlayers] = useState(4);

  // Policy settings
  const [advanceDays, setAdvanceDays] = useState<number | null>(null);
  const [visitorStart, setVisitorStart] = useState<string | null>(null);
  const [savingPolicy, setSavingPolicy] = useState(false);

  const slots = useQuery(
    api.teeTimes.listSlotsForDate,
    club ? { clubId: club._id, date: selectedDate } : "skip"
  );
  const availableDates = useQuery(
    api.teeTimes.listAvailableDates,
    club ? { clubId: club._id } : "skip"
  );

  const generateSlots = useMutation(api.teeTimes.generateSlots);
  const cancelBooking = useMutation(api.teeTimes.cancelBooking);
  const setSlotBlocked = useMutation(api.teeTimes.setSlotBlocked);
  const deleteSlotsForDate = useMutation(api.teeTimes.deleteSlotsForDate);
  const updatePolicy = useMutation(api.teeTimes.updatePolicy);

  if (!club) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" /></div>;
  }

  const effectiveAdvanceDays = advanceDays ?? (club.advanceBookingDays ?? 7);
  const effectiveVisitorStart = visitorStart ?? (club.weekendVisitorStartTime ?? "11:00");
  const sunset = getSunsetTime(selectedDate, club.latitude, club.longitude);

  // Build a slot count map for the week strip
  const slotsMap: Record<string, number> = {};
  availableDates?.forEach(d => { slotsMap[d] = 1; });

  const totalBookings = slots?.reduce((sum, s) => sum + s.bookings.length, 0) ?? 0;
  const totalPlayers = slots?.reduce((sum, s) => sum + s.takenPlayers, 0) ?? 0;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!club) return;
    setGenerating(true);
    setGenMsg(null);
    try {
      const dates = datesInRange(genStartDate, genEndDate);
      const count = await generateSlots({
        clubId: club._id,
        dates,
        firstTime: genFirstTime,
        lastTime: genLastTime,
        intervalMinutes: genInterval,
        maxPlayers: genMaxPlayers,
      });
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
      await updatePolicy({
        clubId: club._id,
        advanceBookingDays: effectiveAdvanceDays,
        weekendVisitorStartTime: effectiveVisitorStart,
      });
      setShowSettings(false);
    } finally {
      setSavingPolicy(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tee Times</h1>
          <p className="text-gray-500 text-sm mt-0.5">{club.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Settings size={14} />
            Policy
          </button>
          <button
            onClick={() => setShowGen(v => !v)}
            className="px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
          >
            {showGen ? "Cancel" : "+ Generate slots"}
          </button>
        </div>
      </div>

      {/* Policy settings panel */}
      {showSettings && (
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Booking policy</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Advance booking window (days)</label>
              <input
                type="number"
                min={1}
                max={30}
                value={effectiveAdvanceDays}
                onChange={e => setAdvanceDays(parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-400 mt-1">Members and visitors can book this many days in advance</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Earliest visitor tee time on weekends</label>
              <input
                type="time"
                value={effectiveVisitorStart}
                onChange={e => setVisitorStart(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
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

      {/* Generate slots form */}
      {showGen && (
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Generate tee time slots</h2>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">From date</label>
                <input type="date" value={genStartDate} onChange={e => setGenStartDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">To date</label>
                <input type="date" value={genEndDate} onChange={e => setGenEndDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">First tee time</label>
                <input type="time" value={genFirstTime} onChange={e => setGenFirstTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Last tee time</label>
                <input type="time" value={genLastTime} onChange={e => setGenLastTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Interval (minutes)</label>
                <input type="number" value={genInterval} onChange={e => setGenInterval(parseInt(e.target.value))}
                  min={5} max={30} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Max players per slot</label>
                <input type="number" value={genMaxPlayers} onChange={e => setGenMaxPlayers(parseInt(e.target.value))}
                  min={1} max={8} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
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
      <WeekStrip
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
        slotsMap={slotsMap}
      />

      {/* Day stats bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-sm font-semibold text-gray-700">
          {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </span>
        {sunset && (
          <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full">
            <Sunset size={12} />
            Sunset {sunset}
          </span>
        )}
        {slots && slots.length > 0 && (
          <span className="text-xs text-gray-500">
            {totalBookings} booking{totalBookings !== 1 ? "s" : ""} · {totalPlayers} player{totalPlayers !== 1 ? "s" : ""}
          </span>
        )}
        {slots && slots.length > 0 && (
          <button onClick={handleClearDay} className="ml-auto text-xs text-red-500 hover:text-red-700 hover:underline">
            Clear day
          </button>
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
          <button onClick={() => setShowGen(true)} className="mt-2 text-green-700 text-sm font-medium hover:underline">
            Generate slots →
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
          {slots.map(slot => {
            const minsBeforeSunset = sunset ? minutesBeforeSunset(slot.time, sunset) : 999;
            const isAfterSunset = minsBeforeSunset < 0;
            const isLateSunset = minsBeforeSunset >= 0 && minsBeforeSunset <= 90;

            return (
              <div key={slot._id} className={`px-5 py-3 ${slot.isBlocked ? "bg-gray-50 opacity-60" : isAfterSunset ? "bg-gray-50/50" : ""}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-sm font-semibold text-gray-900 w-12">{slot.time}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      slot.isBlocked ? "bg-gray-200 text-gray-500" :
                      slot.available === 0 ? "bg-red-100 text-red-600" :
                      "bg-green-100 text-green-700"
                    }`}>
                      {slot.isBlocked ? "Blocked" : `${slot.available}/${slot.maxPlayers} free`}
                    </span>
                    {isAfterSunset && <span className="text-xs text-gray-400">After sunset</span>}
                    {isLateSunset && !isAfterSunset && (
                      <span className="flex items-center gap-1 text-xs text-orange-500">
                        <AlertTriangle size={11} /> Late round
                      </span>
                    )}
                  </div>

                  {/* Bookings */}
                  <div className="flex-1 space-y-1">
                    {slot.bookings.map(b => (
                      <div key={b._id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">
                          <span className="font-medium">{b.displayName}</span>
                          <span className="text-gray-400 ml-1">· {b.playerCount} player{b.playerCount !== 1 ? "s" : ""}</span>
                          {(b as any).bookingType === "visitor" && <span className="text-blue-500 ml-1 text-xs">visitor</span>}
                          {b.notes && <span className="text-gray-400 ml-1">· {b.notes}</span>}
                        </span>
                        <button
                          onClick={() => cancelBooking({ bookingId: b._id as Id<"teeTimeBookings"> })}
                          className="text-xs text-red-400 hover:text-red-600 hover:underline ml-3 shrink-0"
                        >
                          Cancel
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setSlotBlocked({ slotId: slot._id, blocked: !slot.isBlocked })}
                    className="text-xs text-gray-400 hover:text-gray-600 hover:underline shrink-0"
                  >
                    {slot.isBlocked ? "Unblock" : "Block"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
