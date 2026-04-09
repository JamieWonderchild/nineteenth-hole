"use client";

import { useState, use } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

function Calendar({
  availableDates,
  selectedDate,
  onSelect,
}: {
  availableDates: string[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const todayStr = toDateStr(new Date());
  const [viewMonth, setViewMonth] = useState(() => {
    // Open on the month of the first available date, or current month
    const first = availableDates.find(d => d >= todayStr);
    if (first) return new Date(first + "T00:00:00").getMonth();
    return new Date().getMonth();
  });
  const [viewYear, setViewYear] = useState(() => {
    const first = availableDates.find(d => d >= todayStr);
    if (first) return new Date(first + "T00:00:00").getFullYear();
    return new Date().getFullYear();
  });

  const available = new Set(availableDates);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  // Monday-first: Sunday=6, Monday=0 ... Saturday=5
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();
  const canGoPrev = viewYear > todayYear || (viewYear === todayYear && viewMonth > todayMonth);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const monthLabel = firstOfMonth.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      {/* Navigation */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={prevMonth}
          disabled={!canGoPrev}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={18} className="text-gray-600" />
        </button>
        <span className="font-semibold text-gray-900">{monthLabel}</span>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronRight size={18} className="text-gray-600" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: totalCells }, (_, i) => {
          const dayNum = i - startOffset + 1;
          if (dayNum < 1 || dayNum > daysInMonth) {
            return <div key={i} />;
          }
          const date = new Date(viewYear, viewMonth, dayNum);
          const dateStr = toDateStr(date);
          const isPast = date < today;
          const isToday = dateStr === todayStr;
          const hasSlots = available.has(dateStr);
          const isSelected = dateStr === selectedDate;
          const isClickable = hasSlots && !isPast;

          return (
            <button
              key={i}
              disabled={!isClickable}
              onClick={() => onSelect(dateStr)}
              className={[
                "relative flex flex-col items-center justify-center rounded-lg py-1.5 text-sm transition-colors",
                isSelected
                  ? "bg-green-700 text-white font-semibold"
                  : isClickable
                  ? "hover:bg-green-50 text-gray-900 font-medium cursor-pointer"
                  : "text-gray-300 cursor-default",
                isToday && !isSelected ? "ring-1 ring-green-400" : "",
              ].join(" ")}
            >
              <span>{dayNum}</span>
              {hasSlots && !isPast && (
                <span className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? "bg-green-200" : "bg-green-500"}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function TeeTimesPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { user } = useUser();

  const club = useQuery(api.clubs.getBySlug, { slug: clubSlug });
  const membership = useQuery(
    api.clubMembers.getByClubAndUser,
    club && user ? { clubId: club._id, userId: user.id } : "skip"
  );
  const availableDates = useQuery(
    api.teeTimes.listAvailableDates,
    club ? { clubId: club._id } : "skip"
  );
  const myBookings = useQuery(
    api.teeTimes.listMyBookings,
    club && user ? { clubId: club._id, userId: user.id } : "skip"
  );

  const todayStr = toDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);
  const [playerCount, setPlayerCount] = useState(1);
  const [notes, setNotes] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const slots = useQuery(
    api.teeTimes.listSlotsForDate,
    club ? { clubId: club._id, date: selectedDate } : "skip"
  );

  const bookSlot = useMutation(api.teeTimes.bookSlot);
  const cancelBooking = useMutation(api.teeTimes.cancelBooking);

  if (club === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!club) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Club not found.</p>
      </div>
    );
  }

  const isMember = membership?.status === "active";

  async function handleBook(slotId: string) {
    if (!user || !club) return;
    setBooking(true);
    setBookingError(null);
    try {
      await bookSlot({
        slotId: slotId as Id<"teeTimeSlots">,
        clubId: club._id,
        playerCount,
        notes: notes.trim() || undefined,
        displayName: user.fullName ?? user.username ?? "Member",
      });
      setBookingSlotId(null);
      setNotes("");
      setPlayerCount(1);
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "Booking failed");
    }
    setBooking(false);
  }

  const visibleSlots = slots?.filter(s => !s.isBlocked) ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tee Times</h1>
        <p className="text-gray-500 text-sm mt-1">{club.name}</p>
      </div>

      {/* Not a member */}
      {!isMember && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-800">
          You need to be an active member to book tee times.{" "}
          <Link href={`/${clubSlug}`} className="font-medium underline">Join the club →</Link>
        </div>
      )}

      {/* My upcoming bookings */}
      {myBookings && myBookings.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Your upcoming bookings</h2>
          <div className="space-y-2">
            {myBookings.map(b => (
              <div key={b._id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{formatDate(b.date)} at {b.time}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {b.playerCount} player{b.playerCount !== 1 ? "s" : ""}
                    {b.notes && ` · ${b.notes}`}
                  </p>
                </div>
                <button
                  onClick={() => cancelBooking({ bookingId: b._id as Id<"teeTimeBookings"> })}
                  className="text-xs text-red-400 hover:text-red-600 hover:underline shrink-0 ml-4"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Calendar */}
      {availableDates === undefined ? (
        <div className="bg-white border border-gray-200 rounded-xl h-64 flex items-center justify-center">
          <div className="animate-spin h-6 w-6 border-4 border-green-600 border-t-transparent rounded-full" />
        </div>
      ) : availableDates.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl px-5 py-12 text-center">
          <p className="text-gray-400">No tee times available yet — check back soon.</p>
        </div>
      ) : (
        <Calendar
          availableDates={availableDates}
          selectedDate={selectedDate}
          onSelect={(d) => { setSelectedDate(d); setBookingSlotId(null); setBookingError(null); }}
        />
      )}

      {/* Slots panel */}
      {availableDates && availableDates.includes(selectedDate) && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">{formatDate(selectedDate)}</h2>

          {!slots ? (
            <div className="h-20 flex items-center justify-center">
              <div className="animate-spin h-5 w-5 border-4 border-green-600 border-t-transparent rounded-full" />
            </div>
          ) : visibleSlots.length === 0 ? (
            <p className="text-sm text-gray-400 bg-white border border-gray-200 rounded-xl px-5 py-4">
              No available slots for this day.
            </p>
          ) : (
            <div className="space-y-2">
              {visibleSlots.map(slot => {
                const myBooking = user ? slot.bookings.find(b => b.userId === user.id) : null;
                const isOpen = bookingSlotId === slot._id;
                const isFull = slot.available === 0;

                return (
                  <div
                    key={slot._id}
                    className={`bg-white border rounded-xl overflow-hidden transition-all ${
                      myBooking ? "border-green-300 bg-green-50/30" :
                      isOpen ? "border-green-400 shadow-sm" :
                      "border-gray-200"
                    }`}
                  >
                    <div className="px-4 py-3.5 flex items-center gap-4">
                      {/* Time */}
                      <span className="font-mono font-bold text-gray-900 text-sm w-14 shrink-0">{slot.time}</span>

                      {/* Capacity badge */}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                        myBooking ? "bg-green-100 text-green-700" :
                        isFull ? "bg-red-100 text-red-600" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {myBooking ? "Booked ✓" : isFull ? "Full" : `${slot.available} of ${slot.maxPlayers} free`}
                      </span>

                      {/* Who's booked */}
                      {slot.bookings.length > 0 && (
                        <div className="flex-1 flex flex-wrap gap-x-3 gap-y-0.5 min-w-0">
                          {slot.bookings.map(b => (
                            <span key={b._id} className="text-xs text-gray-500 truncate">
                              {b.displayName}
                              {b.playerCount > 1 && <span className="text-gray-400"> +{b.playerCount - 1}</span>}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Action */}
                      {isMember && (
                        <div className="ml-auto shrink-0">
                          {myBooking ? (
                            <button
                              onClick={() => cancelBooking({ bookingId: myBooking._id as Id<"teeTimeBookings"> })}
                              className="text-xs text-red-400 hover:text-red-600 hover:underline"
                            >
                              Cancel
                            </button>
                          ) : !isFull ? (
                            <button
                              onClick={() => setBookingSlotId(isOpen ? null : slot._id)}
                              className={`text-xs px-3 py-1.5 font-medium rounded-lg transition-colors ${
                                isOpen
                                  ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                  : "bg-green-700 text-white hover:bg-green-600"
                              }`}
                            >
                              {isOpen ? "Cancel" : "Book"}
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {/* Inline booking form */}
                    {isOpen && (
                      <div className="border-t border-gray-100 px-4 py-4 bg-gray-50/80 space-y-3">
                        <div className="flex flex-wrap items-end gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Players in your group</label>
                            <select
                              value={playerCount}
                              onChange={e => setPlayerCount(parseInt(e.target.value))}
                              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                            >
                              {Array.from({ length: Math.min(slot.available, 4) }, (_, i) => i + 1).map(n => (
                                <option key={n} value={n}>{n} player{n !== 1 ? "s" : ""}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex-1 min-w-40">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Note (optional)</label>
                            <input
                              type="text"
                              value={notes}
                              onChange={e => setNotes(e.target.value)}
                              placeholder="e.g. Buggy required"
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                            />
                          </div>
                        </div>
                        {bookingError && (
                          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{bookingError}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setBookingSlotId(null); setBookingError(null); }}
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleBook(slot._id)}
                            disabled={booking}
                            className="px-4 py-1.5 text-sm bg-green-700 text-white font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
                          >
                            {booking ? "Booking…" : `Confirm ${slot.time}`}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* No date selected but dates exist */}
      {availableDates && availableDates.length > 0 && !availableDates.includes(selectedDate) && (
        <p className="text-sm text-gray-400 text-center py-4">
          Select a highlighted date to see available slots.
        </p>
      )}
    </div>
  );
}
