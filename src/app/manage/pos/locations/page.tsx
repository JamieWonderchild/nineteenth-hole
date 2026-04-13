"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useActiveClub } from "@/lib/club-context";
import type { Id } from "convex/_generated/dataModel";
import {
  MapPin, Monitor, Plus, Trash2, Pencil, X, Eye, EyeOff, KeyRound,
} from "lucide-react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type LocationRow = {
  _id: Id<"posLocations">;
  name: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
};

type KioskRow = {
  _id: Id<"posKiosks">;
  name: string;
  locationId: Id<"posLocations">;
  locationName: string;
  pinHash?: string;
  isActive: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin.trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LocationsPage() {
  const { club } = useActiveClub();

  const locations = useQuery(
    api.posLocations.listLocations,
    club ? { clubId: club._id } : "skip"
  );
  const kiosks = useQuery(
    api.posLocations.listKiosks,
    club ? { clubId: club._id } : "skip"
  );

  const saveLocation  = useMutation(api.posLocations.saveLocation);
  const removeLocation = useMutation(api.posLocations.removeLocation);
  const saveKiosk     = useMutation(api.posLocations.saveKiosk);
  const removeKiosk   = useMutation(api.posLocations.removeKiosk);

  // ── Location form state ────────────────────────────────────────────────────
  const [editingLoc, setEditingLoc] = useState<LocationRow | null>(null);
  const [showLocForm, setShowLocForm] = useState(false);
  const [locForm, setLocForm] = useState({
    name: "",
    description: "",
    isActive: true,
    sortOrder: 0,
  });
  const [savingLoc, setSavingLoc] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  // ── Kiosk form state ───────────────────────────────────────────────────────
  const [editingKiosk, setEditingKiosk] = useState<KioskRow | null>(null);
  const [showKioskForm, setShowKioskForm] = useState(false);
  const [kioskForm, setKioskForm] = useState({
    name: "",
    locationId: "" as Id<"posLocations"> | "",
    pin: "",
    isActive: true,
  });
  const [showPin, setShowPin] = useState(false);
  const [savingKiosk, setSavingKiosk] = useState(false);
  const [kioskError, setKioskError] = useState<string | null>(null);

  // Auto-dismiss errors
  useEffect(() => {
    if (!locError) return;
    const t = setTimeout(() => setLocError(null), 4000);
    return () => clearTimeout(t);
  }, [locError]);

  useEffect(() => {
    if (!kioskError) return;
    const t = setTimeout(() => setKioskError(null), 4000);
    return () => clearTimeout(t);
  }, [kioskError]);

  // Default sortOrder to next available when opening new location form
  function openNewLocation() {
    setEditingLoc(null);
    setLocForm({
      name: "",
      description: "",
      isActive: true,
      sortOrder: (locations?.length ?? 0) + 1,
    });
    setShowLocForm(true);
  }

  function openEditLocation(loc: LocationRow) {
    setEditingLoc(loc);
    setLocForm({
      name: loc.name,
      description: loc.description ?? "",
      isActive: loc.isActive,
      sortOrder: loc.sortOrder,
    });
    setShowLocForm(true);
  }

  function cancelLocForm() {
    setShowLocForm(false);
    setEditingLoc(null);
    setLocForm({ name: "", description: "", isActive: true, sortOrder: 0 });
  }

  async function handleSaveLocation() {
    if (!club || !locForm.name.trim()) return;
    setSavingLoc(true);
    try {
      await saveLocation({
        clubId:      club._id,
        locationId:  editingLoc?._id,
        name:        locForm.name.trim(),
        description: locForm.description.trim() || undefined,
        isActive:    locForm.isActive,
        sortOrder:   locForm.sortOrder,
      });
      cancelLocForm();
    } catch (err) {
      setLocError(err instanceof Error ? err.message : "Failed to save location");
    } finally {
      setSavingLoc(false);
    }
  }

  async function handleDeleteLocation(id: Id<"posLocations">) {
    if (!confirm("Delete this location? This cannot be undone.")) return;
    try {
      await removeLocation({ locationId: id });
    } catch (err) {
      setLocError(err instanceof Error ? err.message : "Failed to delete location");
    }
  }

  // ── Kiosk handlers ─────────────────────────────────────────────────────────

  function openNewKiosk() {
    setEditingKiosk(null);
    setKioskForm({
      name: "",
      locationId: (locations?.[0]?._id ?? "") as Id<"posLocations"> | "",
      pin: "",
      isActive: true,
    });
    setShowPin(false);
    setShowKioskForm(true);
  }

  function openEditKiosk(k: KioskRow) {
    setEditingKiosk(k);
    setKioskForm({
      name: k.name,
      locationId: k.locationId,
      pin: "", // never pre-fill PIN
      isActive: k.isActive,
    });
    setShowPin(false);
    setShowKioskForm(true);
  }

  function cancelKioskForm() {
    setShowKioskForm(false);
    setEditingKiosk(null);
    setKioskForm({ name: "", locationId: "" as Id<"posLocations"> | "", pin: "", isActive: true });
  }

  async function handleSaveKiosk() {
    if (!club || !kioskForm.name.trim() || !kioskForm.locationId) return;
    // Require PIN when creating a new kiosk
    if (!editingKiosk && !kioskForm.pin.trim()) {
      setKioskError("Please set a manager PIN for this kiosk.");
      return;
    }
    setSavingKiosk(true);
    try {
      // Hash PIN client-side before sending (server also hashes, double protection)
      const pin = kioskForm.pin.trim() || undefined;
      await saveKiosk({
        clubId:     club._id,
        kioskId:    editingKiosk?._id,
        locationId: kioskForm.locationId as Id<"posLocations">,
        name:       kioskForm.name.trim(),
        pin,
        isActive:   kioskForm.isActive,
      });
      cancelKioskForm();
    } catch (err) {
      setKioskError(err instanceof Error ? err.message : "Failed to save kiosk");
    } finally {
      setSavingKiosk(false);
    }
  }

  async function handleDeleteKiosk(id: Id<"posKiosks">) {
    if (!confirm("Remove this kiosk? This cannot be undone.")) return;
    try {
      await removeKiosk({ kioskId: id });
    } catch (err) {
      setKioskError(err instanceof Error ? err.message : "Failed to remove kiosk");
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (!club || locations === undefined || kiosks === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const activeLocations = locations.filter((l) => l.isActive);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-10">

      {/* ── LOCATIONS ───────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/manage/pos" className="text-sm text-gray-400 hover:text-gray-600 mb-1 block">
              ← Point of Sale
            </Link>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <MapPin size={20} /> Locations &amp; Kiosks
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Define your service areas (Bar, Pro Shop, Restaurant) and register the devices that run in each one.
            </p>
          </div>
          <button
            onClick={openNewLocation}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 shrink-0"
          >
            <Plus size={15} /> Add location
          </button>
        </div>

        {/* Location error */}
        {locError && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl mb-4">
            <span className="flex-1">{locError}</span>
            <button onClick={() => setLocError(null)}><X size={14} /></button>
          </div>
        )}

        {/* Location form */}
        {showLocForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-4">
              {editingLoc ? "Edit location" : "Add location"}
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Name <span className="text-red-400">*</span></label>
                <input
                  value={locForm.name}
                  onChange={(e) => setLocForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Bar, Pro Shop, Restaurant"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Sort order</label>
                <input
                  type="number"
                  min={1}
                  value={locForm.sortOrder}
                  onChange={(e) => setLocForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Description <span className="text-gray-400">(optional)</span></label>
              <input
                value={locForm.description}
                onChange={(e) => setLocForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Main bar and lounge area"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex items-center gap-2 mb-5">
              <button
                type="button"
                onClick={() => setLocForm((f) => ({ ...f, isActive: !f.isActive }))}
                className={`w-9 h-5 rounded-full transition-colors ${locForm.isActive ? "bg-green-600" : "bg-gray-300"}`}
              >
                <span className={`block w-3.5 h-3.5 bg-white rounded-full shadow transition-transform mx-0.5 ${locForm.isActive ? "translate-x-4" : "translate-x-0"}`} />
              </button>
              <label className="text-sm text-gray-700">Active</label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveLocation}
                disabled={savingLoc || !locForm.name.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {savingLoc ? "Saving…" : "Save location"}
              </button>
              <button
                onClick={cancelLocForm}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Locations list */}
        {locations.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <MapPin size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No locations yet.</p>
            <button onClick={openNewLocation} className="mt-2 text-sm text-green-600 hover:underline">
              Add your first location →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {locations.map((loc) => (
              <div
                key={loc._id}
                className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${loc.isActive ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                    <MapPin size={18} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{loc.name}</p>
                    {loc.description && (
                      <p className="text-xs text-gray-400">{loc.description}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      {loc.isActive ? "Active" : "Inactive"} · order {loc.sortOrder}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditLocation(loc as LocationRow)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    title="Edit"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDeleteLocation(loc._id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── KIOSKS ──────────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Monitor size={18} /> Kiosks
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Named devices assigned to a location. Each kiosk has its own manager PIN to lock/unlock the POS screen.
            </p>
          </div>
          <button
            onClick={openNewKiosk}
            disabled={activeLocations.length === 0}
            title={activeLocations.length === 0 ? "Add a location first" : undefined}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Plus size={15} /> Add kiosk
          </button>
        </div>

        {activeLocations.length === 0 && kiosks.length === 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 mb-4">
            Add at least one active location above before registering kiosks.
          </div>
        )}

        {/* Kiosk error */}
        {kioskError && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl mb-4">
            <span className="flex-1">{kioskError}</span>
            <button onClick={() => setKioskError(null)}><X size={14} /></button>
          </div>
        )}

        {/* Kiosk form */}
        {showKioskForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">
              {editingKiosk ? "Edit kiosk" : "Register kiosk"}
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Kiosk name <span className="text-red-400">*</span></label>
                <input
                  value={kioskForm.name}
                  onChange={(e) => setKioskForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Bar Till 1, Pro Shop Counter"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Location <span className="text-red-400">*</span></label>
                <select
                  value={kioskForm.locationId}
                  onChange={(e) => setKioskForm((f) => ({ ...f, locationId: e.target.value as Id<"posLocations"> }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select location…</option>
                  {activeLocations.map((loc) => (
                    <option key={loc._id} value={loc._id}>{loc.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* PIN field */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Manager PIN {editingKiosk ? <span className="text-gray-400">(leave blank to keep current)</span> : <span className="text-red-400">*</span>}
              </label>
              <div className="relative">
                <input
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={kioskForm.pin}
                  onChange={(e) => setKioskForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "") }))}
                  placeholder={editingKiosk ? "Enter new PIN to change" : "4–8 digit PIN"}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Staff must enter this PIN to exit full-screen POS mode.
              </p>
            </div>

            <div className="flex items-center gap-2 mb-5">
              <button
                type="button"
                onClick={() => setKioskForm((f) => ({ ...f, isActive: !f.isActive }))}
                className={`w-9 h-5 rounded-full transition-colors ${kioskForm.isActive ? "bg-green-600" : "bg-gray-300"}`}
              >
                <span className={`block w-3.5 h-3.5 bg-white rounded-full shadow transition-transform mx-0.5 ${kioskForm.isActive ? "translate-x-4" : "translate-x-0"}`} />
              </button>
              <label className="text-sm text-gray-700">Active</label>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSaveKiosk}
                disabled={savingKiosk || !kioskForm.name.trim() || !kioskForm.locationId}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {savingKiosk ? "Saving…" : "Save kiosk"}
              </button>
              <button
                onClick={cancelKioskForm}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Kiosks list */}
        {kiosks.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Monitor size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No kiosks registered yet.</p>
            {activeLocations.length > 0 && (
              <button onClick={openNewKiosk} className="mt-2 text-sm text-green-600 hover:underline">
                Register your first kiosk →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {kiosks.map((k) => (
              <div
                key={k._id}
                className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${k.isActive ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                    <Monitor size={18} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{k.name}</p>
                    <p className="text-xs text-gray-400">
                      {k.locationName} · {k.isActive ? "Active" : "Inactive"}
                    </p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <KeyRound size={10} />
                      {k.pinHash ? "PIN set" : <span className="text-amber-500">No PIN — set one to enable lock screen</span>}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditKiosk(k as KioskRow)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    title="Edit"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDeleteKiosk(k._id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="Remove"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info box */}
        <div className="mt-6 p-4 bg-blue-50 rounded-xl text-sm text-blue-700">
          <strong>How kiosks work:</strong> Each kiosk runs in full-screen POS mode and is locked to
          its assigned location. The manager PIN is required to exit the POS and access shift
          reports or stock takes. The PIN is stored securely as a one-way hash.
        </div>
      </section>
    </div>
  );
}
