"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useActiveClub } from "@/lib/club-context";
import type { Id } from "convex/_generated/dataModel";
import { formatCurrency } from "@/lib/format";
import { Plus, X, Pencil, Trash2, Search, ArrowLeft, Package, Tag, Upload, Download, AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import Papa from "papaparse";

type Category = { _id: Id<"posCategories">; name: string; icon?: string; sortOrder: number; locationId?: Id<"posLocations"> };
type Location = { _id: Id<"posLocations">; name: string; isActive: boolean };
type Product = {
  _id: Id<"posProducts">;
  name: string; sku?: string; description?: string;
  pricePence: number; currency: string;
  categoryId?: Id<"posCategories">;
  locationId?: Id<"posLocations">;
  trackStock?: boolean; stockCount?: number;
  isActive: boolean;
};

// ── CSV import types ──────────────────────────────────────────────────────────

type ParsedRow = {
  name: string;
  pricePence: number;
  category: string;
  sku?: string;
  trackStock: boolean;
  stockCount?: number;
  /** location column value from the CSV (overrides the modal-level picker) */
  locationName?: string;
  error?: string;
};

function downloadTemplate() {
  const a = document.createElement("a");
  a.href = "/products-template.csv";
  a.download = "products-template.csv";
  a.click();
}

function parseRow(raw: Record<string, string>, idx: number): ParsedRow {
  const name = (raw["name"] ?? "").trim();
  const priceStr = (raw["price"] ?? "").trim();
  const category = (raw["category"] ?? "").trim();
  const sku = (raw["sku"] ?? "").trim() || undefined;
  const trackStockStr = (raw["trackstock"] ?? raw["trackStock"] ?? "true").trim().toLowerCase();
  const stockCountStr = (raw["stockcount"] ?? raw["stockCount"] ?? "").trim();
  // optional per-row location (lower-cased key after transformHeader)
  const locationName = (raw["location"] ?? "").trim() || undefined;

  if (!name) return { name: `Row ${idx + 1}`, pricePence: 0, category, sku, trackStock: false, locationName, error: "Name is required" };
  const price = parseFloat(priceStr);
  if (isNaN(price) || price < 0) return { name, pricePence: 0, category, sku, trackStock: false, locationName, error: "Invalid price" };

  const trackStock = trackStockStr !== "false" && trackStockStr !== "0" && trackStockStr !== "no";
  const stockCount = stockCountStr !== "" ? parseInt(stockCountStr, 10) : undefined;

  return { name, pricePence: Math.round(price * 100), category, sku, trackStock, stockCount, locationName };
}

// ── Import modal ──────────────────────────────────────────────────────────────

function ImportCSVModal({
  clubId,
  currency,
  existingCategories,
  locations,
  onClose,
}: {
  clubId: Id<"clubs">;
  currency: string;
  existingCategories: Category[];
  locations: Location[];
  onClose: () => void;
}) {
  const saveProduct  = useMutation(api.pos.saveProduct);
  const saveCategory = useMutation(api.pos.saveCategory);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  // Modal-level location override — applies to all rows that don't specify their own location
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");

  const validRows = rows.filter(r => !r.error);
  const errorRows = rows.filter(r => r.error);

  // Build a name→id map for locations (case-insensitive)
  const locByName = new Map<string, Id<"posLocations">>();
  for (const l of locations) locByName.set(l.name.toLowerCase(), l._id);

  function handleFile(file: File) {
    setFileName(file.name);
    setRows([]);
    setImportResult(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim().toLowerCase().replace(/\s+/g, ""),
      complete: (result) => {
        const parsed = (result.data as Record<string, string>[]).map((raw, i) => parseRow(raw, i));
        setRows(parsed);
      },
    });
  }

  /** Resolve the locationId for a row: per-row CSV value → modal picker → undefined */
  function resolveLocationId(row: ParsedRow): Id<"posLocations"> | undefined {
    if (row.locationName) {
      return locByName.get(row.locationName.toLowerCase());
    }
    return selectedLocationId ? selectedLocationId as Id<"posLocations"> : undefined;
  }

  async function handleImport() {
    if (validRows.length === 0) return;
    setImporting(true);

    // Build a local map of category name → id (seeded from existing)
    const catMap = new Map<string, Id<"posCategories">>();
    for (const c of existingCategories) catMap.set(c.name.toLowerCase(), c._id);

    let imported = 0;
    let skipped = 0;

    try {
      for (const row of validRows) {
        // Upsert category if needed
        let categoryId: Id<"posCategories"> | undefined;
        if (row.category) {
          const key = row.category.toLowerCase();
          if (catMap.has(key)) {
            categoryId = catMap.get(key);
          } else {
            const newCatId = await saveCategory({ clubId, name: row.category });
            catMap.set(key, newCatId);
            categoryId = newCatId;
          }
        }

        try {
          await saveProduct({
            clubId,
            name: row.name,
            sku: row.sku,
            pricePence: row.pricePence,
            currency,
            categoryId,
            locationId: resolveLocationId(row),
            trackStock: row.trackStock || undefined,
            stockCount: row.stockCount,
            isActive: true,
          });
          imported++;
        } catch {
          skipped++;
        }
      }
    } finally {
      setImporting(false);
      setImportResult({ imported, skipped });
    }
  }

  const activeLocations = locations.filter(l => l.isActive);
  const hasCsvLocations = validRows.some(r => r.locationName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">Import products from CSV</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Upload a spreadsheet to bulk-add products to your catalogue
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">

          {/* Template download */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Download template</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Columns: <code className="font-mono bg-gray-100 px-1 rounded text-[11px]">name, price, category, sku, trackStock, stockCount, location</code>
              </p>
            </div>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-white transition-colors"
            >
              <Download size={14} /> Template
            </button>
          </div>

          {/* Location picker */}
          {activeLocations.length > 0 && !importResult && (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Assign to location
                </label>
                <select
                  value={selectedLocationId}
                  onChange={e => setSelectedLocationId(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">All locations (no restriction)</option>
                  {activeLocations.map(l => (
                    <option key={l._id} value={l._id}>{l.name}</option>
                  ))}
                </select>
              </div>
              {hasCsvLocations && (
                <p className="text-[11px] text-blue-500 mt-5 flex items-start gap-1 max-w-[180px]">
                  <AlertCircle size={11} className="mt-0.5 shrink-0" />
                  Some rows have a location column — those will override this selection
                </p>
              )}
            </div>
          )}

          {/* File picker */}
          {!importResult && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-8 hover:border-green-400 hover:bg-green-50/30 transition-colors"
              >
                <Upload size={22} className="text-gray-400" />
                <span className="text-sm text-gray-500">
                  {fileName ? fileName : "Click to select a CSV file"}
                </span>
                {fileName && (
                  <span className="text-xs text-gray-400">Click to choose a different file</span>
                )}
              </button>
            </div>
          )}

          {/* Success / done state */}
          {importResult && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 size={40} className="text-green-500" />
              <div>
                <p className="font-semibold text-gray-900 text-lg">{importResult.imported} product{importResult.imported !== 1 ? "s" : ""} imported</p>
                {importResult.skipped > 0 && (
                  <p className="text-sm text-gray-400 mt-1">{importResult.skipped} row{importResult.skipped !== 1 ? "s" : ""} skipped due to errors</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="mt-2 px-6 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-xl"
              >
                Done
              </button>
            </div>
          )}

          {/* Preview table */}
          {rows.length > 0 && !importResult && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">
                  Preview — {rows.length} row{rows.length !== 1 ? "s" : ""} found
                </p>
                {errorRows.length > 0 && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle size={12} /> {errorRows.length} row{errorRows.length !== 1 ? "s" : ""} with errors will be skipped
                  </p>
                )}
              </div>
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Name</th>
                      <th className="px-3 py-2 text-left font-medium">Category</th>
                      <th className="px-3 py-2 text-left font-medium">SKU</th>
                      <th className="px-3 py-2 text-right font-medium">Price</th>
                      <th className="px-3 py-2 text-center font-medium">Stock</th>
                      <th className="px-3 py-2 text-left font-medium">Location</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      // Work out the display label for location
                      const resolvedLocId = resolveLocationId(row);
                      const locLabel = resolvedLocId
                        ? locations.find(l => l._id === resolvedLocId)?.name
                        : row.locationName ?? null;
                      return (
                        <tr key={i} className={`border-t border-gray-50 ${row.error ? "bg-red-50" : "bg-white"}`}>
                          <td className="px-3 py-2 font-medium text-gray-900">{row.name}</td>
                          <td className="px-3 py-2 text-gray-500">{row.category || <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-2 text-gray-400 font-mono">{row.sku || <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900">
                            {row.error ? "—" : formatCurrency(row.pricePence, currency)}
                          </td>
                          <td className="px-3 py-2 text-center text-gray-500">
                            {row.trackStock && row.stockCount != null
                              ? row.stockCount
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-2 text-gray-500">
                            {locLabel
                              ? <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-semibold">{locLabel}</span>
                              : <span className="text-gray-300">All</span>}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {row.error && (
                              <span className="text-red-500 flex items-center gap-1 justify-end">
                                <AlertCircle size={12} /> {row.error}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {rows.length > 0 && !importResult && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
            <p className="text-xs text-gray-400">
              {validRows.length} of {rows.length} rows will be imported
              {validRows.some(r => r.category) && " · new categories created automatically"}
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button
                onClick={handleImport}
                disabled={importing || validRows.length === 0}
                className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2"
              >
                {importing ? (
                  <><span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" /> Importing…</>
                ) : (
                  `Import ${validRows.length} product${validRows.length !== 1 ? "s" : ""}`
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Category modal ────────────────────────────────────────────────────────────

function CategoryModal({
  clubId, locations, category, onClose,
}: {
  clubId: Id<"clubs">;
  locations: Location[];
  category?: Category;
  onClose: () => void;
}) {
  const saveCategory = useMutation(api.pos.saveCategory);
  const deleteCategory = useMutation(api.pos.deleteCategory);
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "");
  const [locationId, setLocationId] = useState(category?.locationId ?? "" as string);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await saveCategory({
        clubId,
        categoryId: category?._id,
        name: name.trim(),
        icon: icon.trim() || undefined,
        locationId: locationId ? locationId as Id<"posLocations"> : undefined,
      });
      onClose();
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!category || !confirm(`Delete "${category.name}"?`)) return;
    await deleteCategory({ categoryId: category._id });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{category ? "Edit category" : "New category"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Pints, Spirits, Food"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Icon (emoji)</label>
            <input type="text" value={icon} onChange={e => setIcon(e.target.value)}
              placeholder="🍺"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          {locations.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
              <select value={locationId} onChange={e => setLocationId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">All locations (no restriction)</option>
                {locations.filter(l => l.isActive).map(l => (
                  <option key={l._id} value={l._id}>{l.name}</option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">
                Restrict this category to a specific location, or leave blank to show everywhere.
              </p>
            </div>
          )}
        </div>
        <div className="flex justify-between gap-3 px-6 py-4 border-t border-gray-100">
          {category && (
            <button onClick={handleDelete} className="text-sm text-red-500 hover:text-red-700">Delete</button>
          )}
          <div className="flex gap-3 ml-auto">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
            <button onClick={handleSave} disabled={saving || !name.trim()}
              className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Product modal ─────────────────────────────────────────────────────────────

function ProductModal({
  clubId, currency, categories, locations, product, defaultCategoryId, onClose,
}: {
  clubId: Id<"clubs">;
  currency: string;
  categories: Category[];
  locations: Location[];
  product?: Product;
  defaultCategoryId?: string;
  onClose: () => void;
}) {
  const saveProduct = useMutation(api.pos.saveProduct);
  const [form, setForm] = useState({
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    description: product?.description ?? "",
    price: product ? (product.pricePence / 100).toFixed(2) : "",
    categoryId: product?.categoryId ?? defaultCategoryId ?? "" as string,
    locationId: product?.locationId ?? "" as string,
    trackStock: product?.trackStock ?? true,
    stockCount: product?.stockCount?.toString() ?? "",
    isActive: product?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.name.trim() || !form.price) return;
    setSaving(true);
    try {
      await saveProduct({
        clubId,
        productId: product?._id,
        name: form.name.trim(),
        sku: form.sku.trim() || undefined,
        description: form.description.trim() || undefined,
        pricePence: Math.round(parseFloat(form.price) * 100),
        currency,
        categoryId: form.categoryId ? form.categoryId as Id<"posCategories"> : undefined,
        locationId: form.locationId ? form.locationId as Id<"posLocations"> : undefined,
        trackStock: form.trackStock || undefined,
        stockCount: form.trackStock && form.stockCount ? parseInt(form.stockCount) : undefined,
        isActive: form.isActive,
      });
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{product ? "Edit product" : "New product"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Pint of lager"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Price ({currency}) *</label>
              <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                placeholder="0.00" min="0" step="0.01"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">SKU / Barcode</label>
              <input type="text" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
              <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">No category</option>
                {categories.map(c => (
                  <option key={c._id} value={c._id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
            {locations.length > 0 && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
                <select value={form.locationId} onChange={e => setForm(f => ({ ...f, locationId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">All locations (no restriction)</option>
                  {locations.filter(l => l.isActive).map(l => (
                    <option key={l._id} value={l._id}>{l.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  Restrict this product to a specific till location, or leave blank to show everywhere.
                </p>
              </div>
            )}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <div onClick={() => setForm(f => ({ ...f, trackStock: !f.trackStock }))}
                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${form.trackStock ? "bg-green-600 border-green-600" : "border-gray-300"}`}>
                {form.trackStock && <span className="text-white text-xs">✓</span>}
              </div>
              <span className="text-sm text-gray-700">Track inventory</span>
            </label>
            {form.trackStock && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Current stock</label>
                <input type="number" value={form.stockCount} onChange={e => setForm(f => ({ ...f, stockCount: e.target.value }))}
                  min="0" step="1" placeholder="0"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            )}
            {product && (
              <label className="flex items-center gap-2.5 cursor-pointer">
                <div onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                  className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${form.isActive ? "bg-green-600 border-green-600" : "border-gray-300"}`}>
                  {form.isActive && <span className="text-white text-xs">✓</span>}
                </div>
                <span className="text-sm text-gray-700">Active (visible on till)</span>
              </label>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.price}
            className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
            {saving ? "Saving…" : "Save product"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirmation modal ─────────────────────────────────────────────────

function DeleteProductModal({ product, onConfirm, onClose }: {
  product: Product;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try { await onConfirm(); } finally { setDeleting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Delete product</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <span className="font-semibold text-gray-900">{product.name}</span>?
          </p>
          <p className="text-xs text-gray-400 mt-2">
            The product will be deactivated and hidden from the till. Sales history is preserved.
          </p>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-5 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2"
          >
            {deleting ? (
              <><span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" /> Deleting…</>
            ) : (
              <><Trash2 size={14} /> Delete</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Card colour palette (cycles by index) ────────────────────────────────────

const CARD_PALETTES = [
  { bg: "bg-emerald-50",  border: "border-emerald-200",  label: "text-emerald-700",  count: "text-emerald-900"  },
  { bg: "bg-blue-50",     border: "border-blue-200",     label: "text-blue-700",     count: "text-blue-900"     },
  { bg: "bg-amber-50",    border: "border-amber-200",    label: "text-amber-700",    count: "text-amber-900"    },
  { bg: "bg-purple-50",   border: "border-purple-200",   label: "text-purple-700",   count: "text-purple-900"   },
  { bg: "bg-rose-50",     border: "border-rose-200",     label: "text-rose-700",     count: "text-rose-900"     },
  { bg: "bg-cyan-50",     border: "border-cyan-200",     label: "text-cyan-700",     count: "text-cyan-900"     },
  { bg: "bg-orange-50",   border: "border-orange-200",   label: "text-orange-700",   count: "text-orange-900"   },
  { bg: "bg-indigo-50",   border: "border-indigo-200",   label: "text-indigo-700",   count: "text-indigo-900"   },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function POSProductsPage() {
  const { club } = useActiveClub();

  const categories = useQuery(api.pos.listCategories, club ? { clubId: club._id } : "skip");
  const products   = useQuery(api.pos.listProducts,   club ? { clubId: club._id, includeInactive: true } : "skip");
  const locations  = useQuery(api.posLocations.listLocations, club ? { clubId: club._id } : "skip");

  const deleteProduct = useMutation(api.pos.deleteProduct);

  // null = category grid; "" = uncategorised; catId = that category's products
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [search, setSearch]               = useState("");
  const [showCatModal, setShowCatModal]   = useState(false);
  const [editCat, setEditCat]             = useState<Category | undefined>();
  const [showProductModal, setShowProductModal] = useState(false);
  const [editProduct, setEditProduct]     = useState<Product | undefined>();
  const [deleteTarget, setDeleteTarget]   = useState<Product | undefined>();
  const [showImportModal, setShowImportModal] = useState(false);

  if (!club || !categories || !products || !locations) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const catMap = new Map<string, Category>(categories.map(c => [c._id as string, c]));
  const locMap = new Map<string, Location>(locations.map(l => [l._id as string, l]));

  // Group products by category
  const grouped: Record<string, Product[]> = { "": [] };
  for (const cat of categories) grouped[cat._id] = [];
  for (const p of products) {
    const key = p.categoryId ?? "";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  }

  const sortedCats = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const uncategorisedCount = grouped[""]?.length ?? 0;

  function openEditCat(cat: Category, e: React.MouseEvent) {
    e.stopPropagation();
    setEditCat(cat);
    setShowCatModal(true);
  }

  // ── Shared modals ──────────────────────────────────────────────────────────
  const modals = (
    <>
      {showImportModal && (
        <ImportCSVModal
          clubId={club._id}
          currency={club.currency}
          existingCategories={categories}
          locations={locations}
          onClose={() => setShowImportModal(false)}
        />
      )}
      {showCatModal && (
        <CategoryModal
          clubId={club._id}
          locations={locations}
          category={editCat}
          onClose={() => { setShowCatModal(false); setEditCat(undefined); }}
        />
      )}
      {showProductModal && (
        <ProductModal
          clubId={club._id}
          currency={club.currency}
          categories={categories}
          locations={locations}
          product={editProduct}
          defaultCategoryId={selectedCatId ?? undefined}
          onClose={() => { setShowProductModal(false); setEditProduct(undefined); }}
        />
      )}
      {deleteTarget && (
        <DeleteProductModal
          product={deleteTarget}
          onConfirm={async () => {
            await deleteProduct({ productId: deleteTarget._id });
            setDeleteTarget(undefined);
          }}
          onClose={() => setDeleteTarget(undefined)}
        />
      )}
    </>
  );

  // ── Category grid view ─────────────────────────────────────────────────────
  if (selectedCatId === null) {
    return (
      <div className="px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/manage/pos" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Product Catalogue</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {products.length} product{products.length !== 1 ? "s" : ""} · {categories.length} categor{categories.length !== 1 ? "ies" : "y"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50"
            >
              <Upload size={14} /> Import CSV
            </button>
            <button
              onClick={() => { setEditCat(undefined); setShowCatModal(true); }}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50"
            >
              <Tag size={14} /> New category
            </button>
            <button
              onClick={() => { setEditProduct(undefined); setShowProductModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Plus size={15} /> Product
            </button>
          </div>
        </div>

        {/* Category cards */}
        {categories.length === 0 && uncategorisedCount === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
            <Package size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No products yet — add your first item or import from CSV</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sortedCats.map((cat, i) => {
              const palette = CARD_PALETTES[i % CARD_PALETTES.length];
              const count = grouped[cat._id as string]?.length ?? 0;
              const locName = cat.locationId ? locMap.get(cat.locationId as string)?.name : undefined;
              return (
                <div
                  key={cat._id}
                  onClick={() => setSelectedCatId(cat._id as string)}
                  className={`relative cursor-pointer rounded-xl border p-5 hover:shadow-md active:scale-95 transition-all ${palette.bg} ${palette.border}`}
                >
                  {/* Edit pencil */}
                  <button
                    onClick={(e) => openEditCat(cat, e)}
                    className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 p-0.5 rounded"
                  >
                    <Pencil size={13} />
                  </button>

                  <p className={`text-sm font-semibold pr-6 ${palette.label}`}>
                    {cat.icon ? `${cat.icon} ${cat.name}` : cat.name}
                  </p>
                  <p className={`text-4xl font-black mt-3 ${palette.count}`}>{count}</p>
                  <p className="text-xs text-gray-400 mt-0.5">product{count !== 1 ? "s" : ""}</p>
                  {locName && (
                    <span className="inline-block mt-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/70 text-blue-600 border border-blue-100">
                      {locName}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Uncategorised card */}
            {uncategorisedCount > 0 && (
              <div
                onClick={() => setSelectedCatId("")}
                className="relative cursor-pointer rounded-xl border p-5 hover:shadow-md active:scale-95 transition-all bg-gray-50 border-gray-200"
              >
                <p className="text-sm font-semibold text-gray-500">Uncategorised</p>
                <p className="text-4xl font-black mt-3 text-gray-700">{uncategorisedCount}</p>
                <p className="text-xs text-gray-400 mt-0.5">product{uncategorisedCount !== 1 ? "s" : ""}</p>
              </div>
            )}
          </div>
        )}

        {modals}
      </div>
    );
  }

  // ── Product list (drill-down) ──────────────────────────────────────────────
  const selectedCat = catMap.get(selectedCatId);
  const catProducts = grouped[selectedCatId] ?? [];
  const filteredProducts = search.trim()
    ? catProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase()))
    : catProducts;

  return (
    <div className="px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelectedCatId(null); setSearch(""); }}
            className="text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {selectedCat ? `${selectedCat.icon ?? ""} ${selectedCat.name}`.trim() : "Uncategorised"}
              </h1>
              {selectedCat && (
                <button
                  onClick={() => { setEditCat(selectedCat); setShowCatModal(true); }}
                  className="text-gray-300 hover:text-gray-600 transition-colors"
                  title="Edit category"
                >
                  <Pencil size={15} />
                </button>
              )}
            </div>
            <p className="text-gray-500 text-sm mt-0.5">
              {catProducts.length} product{catProducts.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products…"
              className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-52"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <button
            onClick={() => { setEditProduct(undefined); setShowProductModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus size={15} /> Product
          </button>
        </div>
      </div>

      {/* Product list */}
      {catProducts.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
          <Package size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No products in this category yet</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <p className="text-gray-400 text-sm">No products match &ldquo;{search}&rdquo;</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {filteredProducts.map((p, idx) => (
                <tr key={p._id} className={`${idx < filteredProducts.length - 1 ? "border-b border-gray-50" : ""} hover:bg-gray-50/50`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-medium ${p.isActive ? "text-gray-900" : "text-gray-400 line-through"}`}>{p.name}</p>
                      {p.locationId && locMap.get(p.locationId as string) && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                          {locMap.get(p.locationId as string)!.name}
                        </span>
                      )}
                    </div>
                    {p.description && <p className="text-xs text-gray-400 mt-0.5">{p.description}</p>}
                    {p.sku && <p className="text-xs text-gray-400">SKU: {p.sku}</p>}
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {p.trackStock
                      ? <span className={p.stockCount === 0 ? "text-red-500" : p.stockCount != null && p.stockCount <= 5 ? "text-amber-500" : "text-gray-500"}>
                          {p.stockCount ?? 0} in stock
                        </span>
                      : "—"}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-gray-900">
                    {formatCurrency(p.pricePence, p.currency)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => { setEditProduct(p as Product); setShowProductModal(true); }}
                        className="text-gray-300 hover:text-gray-600 transition-colors"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(p as Product)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modals}
    </div>
  );
}
