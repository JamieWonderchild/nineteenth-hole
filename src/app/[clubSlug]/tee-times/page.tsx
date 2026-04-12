"use client";

import { useState, use } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Sunset, CalendarDays, AlertTriangle, X } from "lucide-react";
import { getSunsetTime, minutesBeforeSunset } from "@/lib/sunset";

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function isWeekend(dateStr: string) {
  const day = new Date(dateStr + "T00:00:00").getDay();
  return day === 0 || day === 6;
}

// ── Availability dots ─────────────────────────────────────────────────────────

function AvailDots({ available, max }: { available: number; max: number }) {
  return (
    <div className="flex gap-0.5 shrink-0">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full ${i < (max - available) ? "bg-gray-400" : "bg-green-500"}`}
        />
      ))}
    </div>
  );
}

// ── Week strip ────────────────────────────────────────────────────────────────

function WeekStrip({
  availableDates, selectedDate, weekOffset, onSelect, onWeekChange, advanceDays,
}: {
  availableDates: string[]; selectedDate: string; weekOffset: number;
  onSelect: (d: string) => void; onWeekChange: (delta: number) => void; advanceDays: number;
}) {
  const today = new Date();
  const todayStr = toDateStr(today);
  const available = new Set(availableDates);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + weekOffset * 7 + i);
    return toDateStr(d);
  });

  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + advanceDays);
  const maxStr = toDateStr(maxDate);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => onWeekChange(-1)} disabled={weekOffset === 0}
          className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors">
          <ChevronLeft size={16} className="text-gray-600" />
        </button>
        <span className="flex-1 text-xs font-semibold text-gray-500 text-center uppercase tracking-wide">
          {new Date(days[0] + "T00:00:00").toLocaleDateString("en-GB", { month: "long" })}
        </span>
        <button onClick={() => onWeekChange(1)} disabled={days[6] >= maxStr}
          className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors">
          <ChevronRight size={16} className="text-gray-600" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(dateStr => {
          const d = new Date(dateStr + "T00:00:00");
          const hasSlots = available.has(dateStr);
          const isPast = dateStr < todayStr;
          const isBeyond = dateStr > maxStr;
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === todayStr;
          const clickable = hasSlots && !isPast && !isBeyond;

          return (
            <button key={dateStr} disabled={!clickable} onClick={() => onSelect(dateStr)}
              className={[
                "flex flex-col items-center py-2 rounded-xl text-xs transition-colors",
                isSelected ? "bg-green-700 text-white"
                  : clickable ? "hover:bg-green-50 text-gray-900 cursor-pointer"
                  : "text-gray-300 cursor-default",
                isToday && !isSelected ? "ring-1 ring-green-400" : "",
              ].join(" ")}
            >
              <span className="font-medium">{d.toLocaleDateString("en-GB", { weekday: "short" })}</span>
              <span className={`font-bold text-sm mt-0.5 ${isSelected ? "" : isToday ? "text-green-700" : ""}`}>
                {d.getDate()}
              </span>
              {hasSlots && !isPast && !isBeyond && (
                <span className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? "bg-green-200" : "bg-green-500"}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Full calendar ─────────────────────────────────────────────────────────────

function Calendar({ availableDates, selectedDate, onSelect, advanceDays }: {
  availableDates: string[]; selectedDate: string; onSelect: (d: string) => void; advanceDays: number;
}) {
  const todayStr = toDateStr(new Date());
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today); maxDate.setDate(today.getDate() + advanceDays);
  const maxStr = toDateStr(maxDate);
  const [viewMonth, setViewMonth] = useState(() => {
    const first = availableDates.find(d => d >= todayStr);
    return first ? new Date(first + "T00:00:00").getMonth() : new Date().getMonth();
  });
  const [viewYear, setViewYear] = useState(() => {
    const first = availableDates.find(d => d >= todayStr);
    return first ? new Date(first + "T00:00:00").getFullYear() : new Date().getFullYear();
  });
  const available = new Set(availableDates);
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const canGoPrev = viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth > today.getMonth());
  function prevMonth() { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); }
  function nextMonth() { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); }
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} disabled={!canGoPrev} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={16} /></button>
        <span className="font-semibold text-sm text-gray-900">{firstOfMonth.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: totalCells }, (_, i) => {
          const dayNum = i - startOffset + 1;
          if (dayNum < 1 || dayNum > daysInMonth) return <div key={i} />;
          const date = new Date(viewYear, viewMonth, dayNum);
          const dateStr = toDateStr(date);
          const isPast = date < today;
          const isBeyond = dateStr > maxStr;
          const hasSlots = available.has(dateStr);
          const isSelected = dateStr === selectedDate;
          const isClickable = hasSlots && !isPast && !isBeyond;
          return (
            <button key={i} disabled={!isClickable} onClick={() => onSelect(dateStr)}
              className={[
                "relative flex flex-col items-center justify-center rounded-lg py-1.5 text-xs transition-colors",
                isSelected ? "bg-green-700 text-white font-semibold"
                  : isClickable ? "hover:bg-green-50 text-gray-900 font-medium cursor-pointer"
                  : "text-gray-300 cursor-default",
                dateStr === todayStr && !isSelected ? "ring-1 ring-green-400" : "",
              ].join(" ")}
            >
              {dayNum}
              {hasSlots && !isPast && !isBeyond && (
                <span className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? "bg-green-200" : "bg-green-500"}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Visitor booking form ──────────────────────────────────────────────────────

function VisitorForm({ slot, clubId, onSuccess, onCancel, weekendVisitorStart }: {
  slot: { _id: string; time: string; date: string; available: number; maxPlayers: number };
  clubId: string; onSuccess: () => void; onCancel: () => void; weekendVisitorStart: string;
}) {
  const bookAsVisitor = useMutation(api.teeTimes.bookAsVisitor);
  const [form, setForm] = useState({ name: "", email: "", phone: "", homeClub: "", playerCount: 1, notes: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const blockedForVisitors = isWeekend(slot.date) && slot.time < weekendVisitorStart;
  if (blockedForVisitors) {
    return (
      <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 text-sm text-amber-800 rounded-b-xl">
        Members only before {weekendVisitorStart} on weekends.{" "}
        <Link href="/sign-up" className="underline font-medium">Join as a member</Link> for unrestricted access.
      </div>
    );
  }
  if (success) {
    return (
      <div className="px-4 py-3 bg-green-50 border-t border-green-100 text-sm text-green-800 rounded-b-xl">
        <p className="font-semibold">Booking confirmed!</p>
        <p className="text-xs mt-0.5 text-green-600">Confirmation sent to {form.email}.</p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      await bookAsVisitor({
        slotId: slot._id as Id<"teeTimeSlots">,
        clubId: clubId as Id<"clubs">,
        displayName: form.name.trim(),
        playerCount: form.playerCount,
        visitorEmail: form.email.trim(),
        visitorPhone: form.phone.trim() || undefined,
        visitorHomeClub: form.homeClub.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      setSuccess(true); onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 py-4 bg-gray-50/80 border-t border-gray-100 space-y-3 rounded-b-xl">
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Book as visitor</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
          <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Home club</label>
          <input type="text" value={form.homeClub} onChange={e => setForm(f => ({ ...f, homeClub: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1.5">Players</p>
          <div className="flex gap-1.5">
            {Array.from({ length: Math.min(slot.available, 4) }, (_, i) => i + 1).map(n => (
              <button type="button" key={n} onClick={() => setForm(f => ({ ...f, playerCount: n }))}
                className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${form.playerCount === n ? "bg-green-700 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Note</label>
          <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Buggy needed"
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
        </div>
      </div>
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100">Cancel</button>
        <button type="submit" disabled={loading} className="px-4 py-1.5 text-sm bg-green-700 text-white font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50">
          {loading ? "Booking…" : `Confirm ${slot.time}`}
        </button>
      </div>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TeeTimesPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { user } = useUser();

  const club = useQuery(api.clubs.getBySlug, { slug: clubSlug });
  const membership = useQuery(
    api.clubMembers.getByClubAndUser,
    club && user ? { clubId: club._id, userId: user.id } : "skip"
  );
  const availableDates = useQuery(api.teeTimes.listAvailableDates, club ? { clubId: club._id } : "skip");
  const myBookings = useQuery(api.teeTimes.listMyBookings, club && user ? { clubId: club._id, userId: user.id } : "skip");

  const todayStr = toDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showCalendar, setShowCalendar] = useState(false);
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);
  const [visitorSlotId, setVisitorSlotId] = useState<string | null>(null);
  const [playerCount, setPlayerCount] = useState(1);
  const [notes, setNotes] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const slots = useQuery(api.teeTimes.listSlotsForDate, club ? { clubId: club._id, date: selectedDate } : "skip");
  const bookSlot = useMutation(api.teeTimes.bookSlot);
  const cancelBooking = useMutation(api.teeTimes.cancelBooking);

  if (club === undefined) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" /></div>;
  if (!club) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Club not found.</p></div>;

  const isMember = membership?.status === "active";
  const advanceDays = club.advanceBookingDays ?? 7;
  const weekendVisitorStart = club.weekendVisitorStartTime ?? "11:00";
  const sunset = getSunsetTime(selectedDate, club.latitude, club.longitude);

  async function handleBook(slotId: string) {
    if (!user || !club) return;
    setBooking(true); setBookingError(null);
    try {
      await bookSlot({
        slotId: slotId as Id<"teeTimeSlots">,
        clubId: club._id,
        playerCount,
        notes: notes.trim() || undefined,
        displayName: user.fullName ?? user.username ?? "Member",
      });
      setBookingSlotId(null);
      setNotes(""); setPlayerCount(1); setShowNote(false);
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "Booking failed");
    }
    setBooking(false);
  }

  function openBooking(slotId: string) {
    setBookingSlotId(slotId === bookingSlotId ? null : slotId);
    setVisitorSlotId(null);
    setBookingError(null);
    setPlayerCount(1);
    setNotes(""); setShowNote(false);
  }

  function handleSelectDate(d: string) {
    setSelectedDate(d);
    setBookingSlotId(null); setVisitorSlotId(null); setBookingError(null);
  }

  const visibleSlots = slots?.filter(s => !s.isBlocked) ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tee Times</h1>
        <p className="text-gray-500 text-sm mt-1">{club.name} · Book up to {advanceDays} days ahead</p>
      </div>

      {/* My upcoming bookings */}
      {myBookings && myBookings.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Your upcoming bookings</h2>
          <div className="space-y-2">
            {myBookings.map(b => (
              <div key={b._id} className="bg-white border border-green-200 bg-green-50/30 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{formatDate(b.date)} at {b.time}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{b.playerCount} player{b.playerCount !== 1 ? "s" : ""}{b.notes && ` · ${b.notes}`}</p>
                </div>
                <button onClick={() => cancelBooking({ bookingId: b._id as Id<"teeTimeBookings"> })}
                  className="text-xs text-red-400 hover:text-red-600 ml-4 shrink-0">
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Week strip */}
      {availableDates !== undefined && availableDates.length > 0 && (
        <WeekStrip
          availableDates={availableDates} selectedDate={selectedDate} weekOffset={weekOffset}
          onSelect={handleSelectDate} onWeekChange={delta => setWeekOffset(w => Math.max(0, w + delta))} advanceDays={advanceDays}
        />
      )}

      {/* Calendar toggle */}
      {availableDates && availableDates.length > 0 && (
        <button onClick={() => setShowCalendar(v => !v)} className="flex items-center gap-1.5 text-xs text-green-700 hover:text-green-900 font-medium">
          <CalendarDays size={13} />
          {showCalendar ? "Hide calendar" : "Show full calendar"}
        </button>
      )}
      {showCalendar && availableDates && (
        <Calendar availableDates={availableDates} selectedDate={selectedDate} onSelect={handleSelectDate} advanceDays={advanceDays} />
      )}

      {availableDates?.length === 0 && (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl px-5 py-12 text-center">
          <p className="text-gray-400">No tee times available yet — check back soon.</p>
        </div>
      )}

      {/* Day + slots */}
      {availableDates && availableDates.includes(selectedDate) && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">{formatDate(selectedDate)}</h2>
            {sunset && (
              <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full">
                <Sunset size={12} /> Sunset {sunset}
              </span>
            )}
          </div>

          {isWeekend(selectedDate) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-3 text-xs text-amber-800">
              <strong>Weekend:</strong> Visitor slots from {weekendVisitorStart}. Members may book any time.
            </div>
          )}

          {!slots ? (
            <div className="h-20 flex items-center justify-center">
              <div className="animate-spin h-5 w-5 border-4 border-green-600 border-t-transparent rounded-full" />
            </div>
          ) : visibleSlots.length === 0 ? (
            <p className="text-sm text-gray-400 bg-white border border-gray-200 rounded-xl px-5 py-4">No available slots for this day.</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
              {visibleSlots.map(slot => {
                const myBooking = user ? slot.bookings.find(b => b.userId === user.id) : null;
                const isOpenMember = bookingSlotId === slot._id;
                const isOpenVisitor = visitorSlotId === slot._id;
                const isFull = slot.available === 0;
                const minsBeforeSunset = sunset ? minutesBeforeSunset(slot.time, sunset) : 999;
                const isAfterSunset = minsBeforeSunset < 0;
                const isLateSunset = minsBeforeSunset >= 0 && minsBeforeSunset <= 90;
                const weekendVisitorBlocked = isWeekend(selectedDate) && slot.time < weekendVisitorStart;

                const bookerNames = slot.bookings
                  .map(b => b.playerCount > 1 ? `${b.displayName} +${b.playerCount - 1}` : b.displayName)
                  .join(", ");

                return (
                  <div key={slot._id} className={isAfterSunset ? "opacity-50" : ""}>
                    {/* Slot row */}
                    <div className={`px-4 py-3 flex items-center gap-3 ${myBooking ? "bg-green-50/50" : isOpenMember || isOpenVisitor ? "bg-gray-50/60" : ""}`}>
                      {/* Time */}
                      <span className="font-mono font-bold text-gray-900 text-sm w-12 shrink-0">{slot.time}</span>

                      {/* Availability dots */}
                      <AvailDots available={slot.available} max={slot.maxPlayers} />

                      {/* Booker names */}
                      <div className="flex-1 min-w-0">
                        {slot.bookings.length > 0 ? (
                          <p className="text-xs text-gray-600 truncate">{bookerNames}</p>
                        ) : (
                          <p className="text-xs text-gray-300">Available</p>
                        )}
                      </div>

                      {/* Sunset indicator */}
                      {isLateSunset && !isAfterSunset && (
                        <span className="flex items-center gap-1 text-xs text-orange-500 shrink-0">
                          <AlertTriangle size={11} /> Late
                        </span>
                      )}

                      {/* Action */}
                      {myBooking ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-semibold text-green-700">✓ Booked</span>
                          <button onClick={() => cancelBooking({ bookingId: myBooking._id as Id<"teeTimeBookings"> })}
                            className="text-gray-300 hover:text-red-500 transition-colors">
                            <X size={14} />
                          </button>
                        </div>
                      ) : isFull ? (
                        <span className="text-xs text-gray-400 shrink-0">Full</span>
                      ) : isAfterSunset ? null : (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isMember && (
                            <button onClick={() => openBooking(slot._id)}
                              className={`text-xs px-3 py-1.5 font-semibold rounded-lg transition-colors ${isOpenMember ? "bg-gray-200 text-gray-700" : "bg-green-700 text-white hover:bg-green-600"}`}>
                              {isOpenMember ? "Cancel" : "Book"}
                            </button>
                          )}
                          {!weekendVisitorBlocked && (
                            <button
                              onClick={() => { setVisitorSlotId(isOpenVisitor ? null : slot._id); setBookingSlotId(null); setBookingError(null); }}
                              className={`text-xs px-2.5 py-1.5 font-medium rounded-lg border transition-colors ${isOpenVisitor ? "bg-gray-200 text-gray-700 border-transparent" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                              {isMember ? "Guest" : "Visitor"}
                            </button>
                          )}
                          {weekendVisitorBlocked && !isMember && (
                            <span className="text-xs text-amber-600 font-medium">Members only</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quick-book panel */}
                    {isOpenMember && (
                      <div className="px-4 py-3 bg-green-50/60 border-t border-green-100 space-y-2.5">
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-600">Players</span>
                            <div className="flex gap-1">
                              {Array.from({ length: Math.min(slot.available, 4) }, (_, i) => i + 1).map(n => (
                                <button key={n} onClick={() => setPlayerCount(n)}
                                  className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${playerCount === n ? "bg-green-700 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>
                          <button onClick={() => handleBook(slot._id)} disabled={booking}
                            className="px-5 py-1.5 text-sm bg-green-700 text-white font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors">
                            {booking ? "Booking…" : `Confirm ${slot.time}`}
                          </button>
                        </div>
                        {!showNote ? (
                          <button onClick={() => setShowNote(true)} className="text-xs text-gray-400 hover:text-gray-600">+ Add note</button>
                        ) : (
                          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Buggy required" autoFocus
                            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
                        )}
                        {bookingError && <p className="text-xs text-red-600">{bookingError}</p>}
                      </div>
                    )}

                    {/* Visitor form */}
                    {isOpenVisitor && (
                      <VisitorForm
                        slot={slot} clubId={club._id} weekendVisitorStart={weekendVisitorStart}
                        onSuccess={() => setVisitorSlotId(null)} onCancel={() => setVisitorSlotId(null)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {availableDates && availableDates.length > 0 && !availableDates.includes(selectedDate) && (
        <p className="text-sm text-gray-400 text-center py-4">Select a highlighted date to see available slots.</p>
      )}

      {!user && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 text-sm text-green-800">
          <strong>Member of {club.name}?</strong>{" "}
          <Link href="/sign-in" className="font-medium underline">Sign in</Link> to book with your member account.
        </div>
      )}
    </div>
  );
}
