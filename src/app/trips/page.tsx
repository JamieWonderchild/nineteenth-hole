"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import Link from "next/link";
import { Plus, MapPin, Users, Calendar, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const STATUS_LABEL: Record<string, string> = {
  planning: "Planning",
  confirmed: "Confirmed",
  completed: "Completed",
};

const STATUS_COLOUR: Record<string, string> = {
  planning: "bg-amber-100 text-amber-700",
  confirmed: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-500",
};

const MY_STATUS_LABEL: Record<string, string> = {
  organiser: "Organiser",
  accepted: "Going",
  invited: "Invited",
  declined: "Declined",
};

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  if (s.getFullYear() !== e.getFullYear()) {
    return `${s.toLocaleDateString("en-GB", { ...opts, year: "numeric" })} – ${e.toLocaleDateString("en-GB", { ...opts, year: "numeric" })}`;
  }
  if (s.getMonth() !== e.getMonth()) {
    return `${s.toLocaleDateString("en-GB", opts)} – ${e.toLocaleDateString("en-GB", opts)} ${e.getFullYear()}`;
  }
  return `${s.getDate()}–${e.getDate()} ${s.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`;
}

function nights(start: string, end: string) {
  const diff = (new Date(end).getTime() - new Date(start).getTime()) / 86400000;
  return diff;
}

export default function TripsPage() {
  const { user } = useUser();
  const trips = useQuery(api.trips.listMine, user ? {} : "skip");

  const pending = trips?.filter((t: any) => t.myStatus === "invited") ?? [];
  const active = trips?.filter((t: any) => t.myStatus !== "invited") ?? [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Golf Trips</h1>
          <p className="text-sm text-gray-500 mt-1">Plan multi-day golf trips with friends</p>
        </div>
        <Button asChild>
          <Link href="/trips/new">
            <Plus size={16} className="mr-1.5" />
            New Trip
          </Link>
        </Button>
      </div>

      {/* Pending invites */}
      {pending.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
            Invites ({pending.length})
          </h2>
          <div className="flex flex-col gap-2">
            {pending.map((trip: any) => (
              <TripCard key={trip._id} trip={trip} highlight />
            ))}
          </div>
        </div>
      )}

      {/* My trips */}
      <div>
        {active.length > 0 && (
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
            {pending.length > 0 ? "My Trips" : undefined}
          </h2>
        )}
        {trips == null ? (
          <div className="text-center py-16 text-gray-400">Loading…</div>
        ) : active.length === 0 && pending.length === 0 ? (
          <div className="text-center py-16">
            <MapPin size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No trips yet</p>
            <p className="text-sm text-gray-400 mt-1">Create your first golf trip</p>
            <Button asChild className="mt-4">
              <Link href="/trips/new">
                <Plus size={16} className="mr-1.5" />
                Plan a Trip
              </Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {active.map((trip: any) => (
              <TripCard key={trip._id} trip={trip} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TripCard({ trip, highlight }: { trip: any; highlight?: boolean }) {
  const n = nights(trip.startDate, trip.endDate);
  return (
    <Link href={`/trips/${trip._id}`}>
      <div className={`rounded-xl border p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors ${highlight ? "border-green-300 bg-green-50 hover:bg-green-50" : "border-gray-200 bg-white"}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900 truncate">{trip.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOUR[trip.status] ?? STATUS_COLOUR.planning}`}>
              {STATUS_LABEL[trip.status] ?? trip.status}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {formatDateRange(trip.startDate, trip.endDate)}
            </span>
            <span>{n} night{n !== 1 ? "s" : ""}</span>
            <span className="flex items-center gap-1">
              <Users size={12} />
              {trip.memberCount}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {trip.myStatus === "invited" && (
            <span className="text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
              Invited
            </span>
          )}
          {trip.myStatus === "organiser" && (
            <span className="text-xs text-gray-400">Organiser</span>
          )}
          <ChevronRight size={16} className="text-gray-400" />
        </div>
      </div>
    </Link>
  );
}
