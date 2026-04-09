"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

function toDateInputValue(d: Date) {
  return d.toISOString().split("T")[0];
}

function datesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (cur <= last) {
    dates.push(toDateInputValue(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export default function ManageTeeTimes() {
  const { user } = useUser();
  const memberships = useQuery(api.clubMembers.listByUser, user ? { userId: user.id } : "skip");
  const adminMembership = memberships?.find(m => m.role === "admin");
  const club = useQuery(api.clubs.get, adminMembership ? { clubId: adminMembership.clubId } : "skip");

  const today = toDateInputValue(new Date());
  const [selectedDate, setSelectedDate] = useState(today);

  const slots = useQuery(
    api.teeTimes.listSlotsForDate,
    club ? { clubId: club._id, date: selectedDate } : "skip"
  );

  const generateSlots = useMutation(api.teeTimes.generateSlots);
  const cancelBooking = useMutation(api.teeTimes.cancelBooking);
  const setSlotBlocked = useMutation(api.teeTimes.setSlotBlocked);
  const deleteSlotsForDate = useMutation(api.teeTimes.deleteSlotsForDate);

  // Generate form state
  const [genStartDate, setGenStartDate] = useState(today);
  const [genEndDate, setGenEndDate] = useState(today);
  const [genFirstTime, setGenFirstTime] = useState("07:00");
  const [genLastTime, setGenLastTime] = useState("18:00");
  const [genInterval, setGenInterval] = useState(9);
  const [genMaxPlayers, setGenMaxPlayers] = useState(4);
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState<string | null>(null);
  const [showGen, setShowGen] = useState(false);

  if (!club) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

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
      setGenMsg(err instanceof Error ? err.message : "Failed to generate slots");
    }
    setGenerating(false);
  }

  async function handleClearDay() {
    if (!club) return;
    if (!confirm(`Delete all slots for ${selectedDate}? This will also cancel any bookings.`)) return;
    await deleteSlotsForDate({ clubId: club._id, date: selectedDate });
  }

  const totalBookings = slots?.reduce((sum, s) => sum + s.bookings.length, 0) ?? 0;
  const totalPlayers = slots?.reduce((sum, s) => sum + s.takenPlayers, 0) ?? 0;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tee Times</h1>
          <p className="text-gray-500 text-sm mt-0.5">{club.name}</p>
        </div>
        <button
          onClick={() => setShowGen(v => !v)}
          className="px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
        >
          {showGen ? "Cancel" : "+ Generate slots"}
        </button>
      </div>

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
              <button type="button" onClick={() => setShowGen(false)}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={generating}
                className="px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-600 disabled:opacity-50">
                {generating ? "Generating…" : "Generate"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Date picker + stats */}
      <div className="flex items-center gap-4">
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        {slots && slots.length > 0 && (
          <span className="text-sm text-gray-500">
            {totalBookings} booking{totalBookings !== 1 ? "s" : ""} · {totalPlayers} player{totalPlayers !== 1 ? "s" : ""}
          </span>
        )}
        {slots && slots.length > 0 && (
          <button onClick={handleClearDay}
            className="ml-auto text-xs text-red-500 hover:text-red-700 hover:underline">
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
          <button onClick={() => setShowGen(true)}
            className="mt-2 text-green-700 text-sm font-medium hover:underline">
            Generate slots →
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
          {slots.map(slot => (
            <div key={slot._id} className={`px-5 py-3 ${slot.isBlocked ? "bg-gray-50 opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-sm font-semibold text-gray-900 w-12">{slot.time}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    slot.isBlocked ? "bg-gray-200 text-gray-500" :
                    slot.available === 0 ? "bg-red-100 text-red-600" :
                    "bg-green-100 text-green-700"
                  }`}>
                    {slot.isBlocked ? "Blocked" : `${slot.available} of ${slot.maxPlayers} free`}
                  </span>
                </div>

                {/* Bookings */}
                <div className="flex-1 space-y-1">
                  {slot.bookings.map(b => (
                    <div key={b._id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">
                        <span className="font-medium">{b.displayName}</span>
                        <span className="text-gray-400 ml-1">· {b.playerCount} player{b.playerCount !== 1 ? "s" : ""}</span>
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

                {/* Block toggle */}
                <button
                  onClick={() => setSlotBlocked({ slotId: slot._id, blocked: !slot.isBlocked })}
                  className="text-xs text-gray-400 hover:text-gray-600 hover:underline shrink-0"
                >
                  {slot.isBlocked ? "Unblock" : "Block"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
