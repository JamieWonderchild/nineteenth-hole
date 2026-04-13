"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useActiveClub } from "@/lib/club-context";
import type { Id } from "convex/_generated/dataModel";
import {
  MapPin, Monitor, Plus, Trash2, Pencil, X, Eye, EyeOff,
  GripVertical, Copy, Check, ExternalLink,
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

// ── Copy-to-clipboard button ───────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs text-gray-400 hover:text-green-600 transition-colors"
      title="Copy URL"
    >
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy URL"}
    </button>
  );
}

// ── Draggable location list ────────────────────────────────────────────────────

function DraggableLocations({
  locations,
  onReorder,
  onEdit,
  onDelete,
}: {
  locations: LocationRow[];
  onReorder: (reordered: LocationRow[]) => void;
  onEdit: (loc: LocationRow) => void;
  onDelete: (id: Id<"posLocations">) => void;
}) {
  const [items, setItems] = useState(locations);
  const dragIndex = useRef<number | null>(null);
  const overIndex = useRef<number | null>(null);

  // Sync when locations prop changes (e.g. after save)
  useEffect(() => { setItems(locations); }, [locations]);

  function handleDragStart(i: number) { dragIndex.current = i; }
  function handleDragEnter(i: number) {
    if (dragIndex.current === null || dragIndex.current === i) return;
    overIndex.current = i;
    const next = [...items];
    const [moved] = next.splice(dragIndex.current, 1);
    next.splice(i, 0, moved);
    dragIndex.current = i;
    setItems(next);
  }
  function handleDragEnd() {
    dragIndex.current = null;
    overIndex.current = null;
    onReorder(items);
  }

  return (
    <div className="space-y-2">
      {items.map((loc, i) => (
        <div
          key={loc._id}
          draggable
          onDragStart={() => handleDragStart(i)}
          onDragEnter={() => handleDragEnter(i)}
          onDragEnd={handleDragEnd}
          onDragOver={e => e.preventDefault()}
          className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 cursor-default select-none"
        >
          {/* Drag handle */}
          <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0">
            <GripVertical size={18} />
          </div>

          <div className={`p-2 rounded-lg shrink-0 ${loc.isActive ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
            <MapPin size={16} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 text-sm">{loc.name}</p>
            {loc.description && (
              <p className="text-xs text-gray-400">{loc.description}</p>
            )}
            {!loc.isActive && <p className="text-xs text-gray-400">Inactive</p>}
          </div>

          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => onEdit(loc)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              title="Edit"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => onDelete(loc._id)}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
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

  const saveLocation   = useMutation(api.posLocations.saveLocation);
  const removeLocation = useMutation(api.posLocations.removeLocation);
  const saveKiosk      = useMutation(api.posLocations.saveKiosk);
  const removeKiosk    = useMutation(api.posLocations.removeKiosk);

  // ── Location form state ────────────────────────────────────────────────────
  const [editingLoc, setEditingLoc] = useState<LocationRow | null>(null);
  const [showLocForm, setShowLocForm] = useState(false);
  const [locForm, setLocForm] = useState({ name: "", description: "", isActive: true });
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

  // ── Location handlers ──────────────────────────────────────────────────────

  function openNewLocation() {
    setEditingLoc(null);
    setLocForm({ name: "", description: "", isActive: true });
    setShowLocForm(true);
  }

  function openEditLocation(loc: LocationRow) {
    setEditingLoc(loc);
    setLocForm({ name: loc.name, description: loc.description ?? "", isActive: loc.isActive });
    setShowLocForm(true);
  }

  function cancelLocForm() {
    setShowLocForm(false);
    setEditingLoc(null);
    setLocForm({ name: "", description: "", isActive: true });
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
        // Assign to end of list if new, keep existing order if editing
        sortOrder:   editingLoc?.sortOrder ?? (locations?.length ?? 0) + 1,
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

  async function handleReorder(reordered: LocationRow[]) {
    // Save new sort orders based on array position
    await Promise.all(
      reordered.map((loc, i) =>
        saveLocation({
          clubId:     club!._id,
          locationId: loc._id,
          name:       loc.name,
          description: loc.description,
          isActive:   loc.isActive,
          sortOrder:  i + 1,
        })
      )
    );
  }

  // ── Kiosk handlers ─────────────────────────────────────────────────────────

  function openNewKiosk() {
    setEditingKiosk(null);
    setKioskForm({
      name: "",
      locationId: (activeLocations[0]?._id ?? "") as Id<"posLocations"> | "",
      pin: "",
      isActive: true,
    });
    setShowPin(false);
    setShowKioskForm(true);
  }

  function openEditKiosk(k: KioskRow) {
    setEditingKiosk(k);
    setKioskForm({ name: k.name, locationId: k.locationId, pin: "", isActive: k.isActive });
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
    if (!editingKiosk && !kioskForm.pin.trim()) {
      setKioskError("A manager PIN is required when registering a kiosk.");
      return;
    }
    setSavingKiosk(true);
    try {
      await saveKiosk({
        clubId:     club._id,
        kioskId:    editingKiosk?._id,
        locationId: kioskForm.locationId as Id<"posLocations">,
        name:       kioskForm.name.trim(),
        pin:        kioskForm.pin.trim() || undefined,
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
  const origin = typeof window !== "undefined" ? window.location.origin : "";

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
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Name <span className="text-red-400">*</span></label>
              <input
                autoFocus
                value={locForm.name}
                onChange={(e) => setLocForm((f) => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleSaveLocation()}
                placeholder="e.g. Bar, Pro Shop, Restaurant"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
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
              <button onClick={cancelLocForm} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
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
          <>
            <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
              <GripVertical size={11} /> Drag to reorder
            </p>
            <DraggableLocations
              locations={locations as LocationRow[]}
              onReorder={handleReorder}
              onEdit={openEditLocation}
              onDelete={handleDeleteLocation}
            />
          </>
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
              A kiosk is a named device (iPad, tablet, till) assigned to a location.
              Each gets its own URL and manager PIN.
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
                  autoFocus
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
                Manager PIN{" "}
                {editingKiosk
                  ? <span className="text-gray-400">(leave blank to keep current)</span>
                  : <span className="text-red-400">*</span>}
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
                Staff use this PIN to exit full-screen POS and access manager options.
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
              <button onClick={cancelKioskForm} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
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
            {kiosks.map((k) => {
              const kioskUrl = `${origin}/kiosk/pos?kiosk=${k._id}`;
              return (
                <div
                  key={k._id}
                  className="bg-white border border-gray-200 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 ${k.isActive ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                        <Monitor size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm">{k.name}</p>
                        <p className="text-xs text-gray-400">{k.locationName} · {k.isActive ? "Active" : "Inactive"}</p>
                        {!k.pinHash && (
                          <p className="text-xs text-amber-500 mt-0.5">⚠ No PIN set — kiosk won&apos;t lock</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => openEditKiosk(k as KioskRow)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteKiosk(k._id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Kiosk URL — the key piece of info */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-[11px] text-gray-400 mb-1 font-medium uppercase tracking-wide">Kiosk URL — open this on the till device</p>
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                      <code className="text-xs text-gray-600 flex-1 truncate">{kioskUrl}</code>
                      <CopyButton text={kioskUrl} />
                      <a
                        href={kioskUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-green-600 transition-colors"
                        title="Open in new tab"
                      >
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
