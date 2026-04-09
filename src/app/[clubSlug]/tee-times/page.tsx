"use client";

import { useState, use } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import Link from "next/link";

function toDateInputValue(d: Date) {
  return d.toISOString().split("T")[0];
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long",
  });
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

  const today = toDateInputValue(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tee Times</h1>
        <p className="text-gray-500 text-sm mt-1">Book your tee time at {club.name}</p>
      </div>

        {/* Not a member */}
        {!isMember && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-800">
            You need to be a club member to book tee times.{" "}
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
                    <p className="text-sm font-semibold text-gray-900">
                      {formatDate(b.date)} at {b.time}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {b.playerCount} player{b.playerCount !== 1 ? "s" : ""}
                      {b.notes && ` · ${b.notes}`}
                    </p>
                  </div>
                  <button
                    onClick={() => cancelBooking({ bookingId: b._id as Id<"teeTimeBookings"> })}
                    className="text-xs text-red-400 hover:text-red-600 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Date selector */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">Select a date</h2>
          {availableDates && availableDates.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {availableDates.slice(0, 14).map(d => (
                <button
                  key={d}
                  onClick={() => { setSelectedDate(d); setBookingSlotId(null); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    selectedDate === d
                      ? "bg-green-700 text-white border-green-700"
                      : "bg-white text-gray-700 border-gray-200 hover:border-green-400"
                  }`}
                >
                  {new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No tee times available yet.</p>
          )}
        </div>

        {/* Slots for selected date */}
        {availableDates && availableDates.includes(selectedDate) && (
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">{formatDate(selectedDate)}</h2>
            {!slots ? (
              <div className="h-20 flex items-center justify-center">
                <div className="animate-spin h-5 w-5 border-4 border-green-600 border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="space-y-2">
                {slots.filter(s => !s.isBlocked).map(slot => {
                  const myBooking = user ? slot.bookings.find(b => b.userId === user.id) : null;
                  const isOpen = bookingSlotId === slot._id;

                  return (
                    <div key={slot._id} className={`bg-white border rounded-xl overflow-hidden transition-all ${
                      isOpen ? "border-green-400 shadow-sm" : "border-gray-200"
                    }`}>
                      <div className="px-4 py-3 flex items-center justify-between gap-4">
                        {/* Time + capacity */}
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-semibold text-gray-900 text-sm w-12">{slot.time}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            slot.available === 0 ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"
                          }`}>
                            {slot.available === 0 ? "Full" : `${slot.available} spot${slot.available !== 1 ? "s" : ""} left`}
                          </span>
                        </div>

                        {/* Who's booked */}
                        {slot.bookings.length > 0 && (
                          <div className="flex-1 flex flex-wrap gap-x-3 gap-y-0.5">
                            {slot.bookings.map(b => (
                              <span key={b._id} className="text-xs text-gray-500">
                                {b.displayName}
                                {b.playerCount > 1 && <span className="text-gray-400"> +{b.playerCount - 1}</span>}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Book / cancel button */}
                        {isMember && (
                          myBooking ? (
                            <button
                              onClick={() => cancelBooking({ bookingId: myBooking._id as Id<"teeTimeBookings"> })}
                              className="text-xs text-red-400 hover:text-red-600 hover:underline shrink-0"
                            >
                              Cancel booking
                            </button>
                          ) : slot.available > 0 ? (
                            <button
                              onClick={() => setBookingSlotId(isOpen ? null : slot._id)}
                              className="text-xs px-3 py-1.5 bg-green-700 text-white font-medium rounded-lg hover:bg-green-600 transition-colors shrink-0"
                            >
                              Book
                            </button>
                          ) : null
                        )}
                      </div>

                      {/* Booking form */}
                      {isOpen && (
                        <div className="border-t border-gray-100 px-4 py-4 bg-gray-50 space-y-3">
                          <div className="flex items-center gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Players in your group</label>
                              <select
                                value={playerCount}
                                onChange={e => setPlayerCount(parseInt(e.target.value))}
                                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                              >
                                {Array.from({ length: Math.min(slot.available, 4) }, (_, i) => i + 1).map(n => (
                                  <option key={n} value={n}>{n}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-600 mb-1">Note (optional)</label>
                              <input
                                type="text"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="e.g. Buggy required"
                                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
                              className="px-4 py-1.5 text-sm bg-green-700 text-white font-medium rounded-lg hover:bg-green-600 disabled:opacity-50"
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
    </div>
  );
}
