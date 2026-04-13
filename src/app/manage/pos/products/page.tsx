"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useActiveClub } from "@/lib/club-context";
import type { Id } from "convex/_generated/dataModel";
import { formatCurrency } from "@/lib/format";
import { Plus, X, Pencil, ArrowLeft, Package, Tag } from "lucide-react";
import Link from "next/link";

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

function ProductModal({
  clubId, currency, categories, locations, product, onClose,
}: {
  clubId: Id<"clubs">;
  currency: string;
  categories: Category[];
  locations: Location[];
  product?: Product;
  onClose: () => void;
}) {
  const saveProduct = useMutation(api.pos.saveProduct);
  const [form, setForm] = useState({
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    description: product?.description ?? "",
    price: product ? (product.pricePence / 100).toFixed(2) : "",
    categoryId: product?.categoryId ?? "" as string,
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

export default function POSProductsPage() {
  const { club } = useActiveClub();

  const categories = useQuery(api.pos.listCategories, club ? { clubId: club._id } : "skip");
  const products   = useQuery(api.pos.listProducts,   club ? { clubId: club._id, includeInactive: true } : "skip");
  const locations  = useQuery(api.posLocations.listLocations, club ? { clubId: club._id } : "skip");

  const [showCatModal, setShowCatModal] = useState(false);
  const [editCat, setEditCat] = useState<Category | undefined>();
  const [showProductModal, setShowProductModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | undefined>();

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

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/manage/pos" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Product Catalogue</h1>
            <p className="text-gray-500 text-sm mt-0.5">Manage pro shop and bar items</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEditCat(undefined); setShowCatModal(true); }}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50">
            <Tag size={14} /> Category
          </button>
          <button onClick={() => { setEditProduct(undefined); setShowProductModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus size={15} /> Product
          </button>
        </div>
      </div>

      {/* Categories row */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.sort((a, b) => a.sortOrder - b.sortOrder).map(cat => (
            <button key={cat._id} onClick={() => { setEditCat(cat); setShowCatModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-full text-sm text-gray-600 hover:bg-gray-50">
              {cat.icon} {cat.name}
              {cat.locationId && locMap.get(cat.locationId as string) && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                  {locMap.get(cat.locationId as string)!.name}
                </span>
              )}
              <Pencil size={11} className="text-gray-300" />
            </button>
          ))}
        </div>
      )}

      {/* Products grouped by category */}
      {products.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
          <Package size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No products yet — add your first item</p>
        </div>
      ) : (
        Object.entries(grouped).map(([catId, catProducts]) => {
          if (catProducts.length === 0) return null;
          const cat = catMap.get(catId);
          return (
            <div key={catId}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {cat ? `${cat.icon ?? ""} ${cat.name}`.trim() : "Uncategorised"}
              </h2>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {catProducts.map((p, idx) => (
                      <tr key={p._id} className={`${idx < catProducts.length - 1 ? "border-b border-gray-50" : ""} hover:bg-gray-50/50`}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`font-medium ${p.isActive ? "text-gray-900" : "text-gray-400 line-through"}`}>{p.name}</p>
                            {p.locationId && locMap.get(p.locationId as string) && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                                {locMap.get(p.locationId as string)!.name}
                              </span>
                            )}
                          </div>
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
                          <button onClick={() => { setEditProduct(p as Product); setShowProductModal(true); }}
                            className="text-gray-300 hover:text-gray-600 transition-colors">
                            <Pencil size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
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
          onClose={() => { setShowProductModal(false); setEditProduct(undefined); }}
        />
      )}
    </div>
  );
}
