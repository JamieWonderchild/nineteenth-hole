"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewTripPage() {
  const router = useRouter();
  const createTrip = useMutation(api.trips.create);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = name.trim() && startDate && endDate && endDate >= startDate;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError("");
    try {
      const tripId = await createTrip({
        name: name.trim(),
        description: description.trim() || undefined,
        startDate,
        endDate,
      });
      router.push(`/trips/${tripId}`);
    } catch (err: any) {
      setError(err?.message ?? "Failed to create trip");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/trips" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Plan a Trip</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Trip name</Label>
          <Input
            id="name"
            placeholder="e.g. Ryder Cup Lads Trip 2026"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={80}
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">Description <span className="text-gray-400 font-normal">(optional)</span></Label>
          <Input
            id="description"
            placeholder="Where are you going? Any notes for the group…"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="startDate">Start date</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="endDate">End date</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              min={startDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {endDate && startDate && endDate < startDate && (
          <p className="text-sm text-red-600">End date must be after start date</p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={!canSubmit || saving} className="w-full mt-2">
          {saving ? "Creating…" : "Create Trip"}
        </Button>
      </form>
    </div>
  );
}
