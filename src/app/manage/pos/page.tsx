"use client";

import { useState, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { formatCurrency } from "@/lib/format";
import { ShoppingCart, Minus, Plus, X, Check, CreditCard, Banknote, Trash2 } from "lucide-react";
import Link from "next/link";

type Product = {
  _id: Id<"posProducts">;
  name: string;
  pricePence: number;
  currency: string;
  categoryId?: Id<"posCategories">;
  stockCount?: number;
  trackStock?: boolean;
  isActive: boolean;
};

type BasketItem = {
  productId: Id<"posProducts">;
  productName: string;
  quantity: number;
  unitPricePence: number;
  subtotalPence: number;
};

const PAYMENT_METHODS = [
  { id: "cash", label: "Cash", icon: <Banknote size={16} /> },
  { id: "card", label: "Card", icon: <CreditCard size={16} /> },
  { id: "tab", label: "Tab", icon: <Check size={16} /> },
  { id: "complimentary", label: "Comp", icon: <Check size={16} /> },
];

export default function POSPage() {
  const { user } = useUser();
  const memberships = useQuery(api.clubMembers.listByUser, user ? { userId: user.id } : "skip");
  const activeMembership = memberships?.find(m => m.status === "active");
  const club = useQuery(api.clubs.get, activeMembership ? { clubId: activeMembership.clubId } : "skip");

  const categories = useQuery(api.pos.listCategories, club ? { clubId: club._id } : "skip");
  const products = useQuery(api.pos.listProducts, club ? { clubId: club._id } : "skip");
  const recordSale = useMutation(api.pos.recordSale);

  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSale, setLastSale] = useState<number | null>(null); // total of last sale

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!selectedCat) return products;
    return products.filter(p => (p.categoryId ?? "uncategorised") === selectedCat);
  }, [products, selectedCat]);

  function addToBasket(product: Product) {
    setBasket(prev => {
      const existing = prev.find(i => i.productId === product._id);
      if (existing) {
        return prev.map(i => i.productId === product._id
          ? { ...i, quantity: i.quantity + 1, subtotalPence: (i.quantity + 1) * i.unitPricePence }
          : i
        );
      }
      return [...prev, {
        productId: product._id,
        productName: product.name,
        quantity: 1,
        unitPricePence: product.pricePence,
        subtotalPence: product.pricePence,
      }];
    });
  }

  function changeQty(productId: Id<"posProducts">, delta: number) {
    setBasket(prev => prev
      .map(i => i.productId === productId
        ? { ...i, quantity: i.quantity + delta, subtotalPence: (i.quantity + delta) * i.unitPricePence }
        : i
      )
      .filter(i => i.quantity > 0)
    );
  }

  function clearBasket() {
    setBasket([]);
    setNotes("");
    setLastSale(null);
  }

  const total = basket.reduce((s, i) => s + i.subtotalPence, 0);
  const currency = club?.currency ?? "GBP";

  async function handleCharge() {
    if (!club || basket.length === 0) return;
    setSaving(true);
    try {
      await recordSale({
        clubId: club._id,
        items: basket,
        currency,
        paymentMethod,
        notes: notes || undefined,
      });
      setLastSale(total);
      setBasket([]);
      setNotes("");
    } finally {
      setSaving(false);
    }
  }

  if (!club || !products || !categories) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Build category list (include "All" + "Uncategorised" if products exist without a category)
  const hasUncategorised = products.some(p => !p.categoryId);
  const catTabs = [
    { id: null, label: "All" },
    ...categories.sort((a, b) => a.sortOrder - b.sortOrder).map(c => ({ id: c._id as string, label: `${c.icon ?? ""} ${c.name}`.trim() })),
    ...(hasUncategorised ? [{ id: "uncategorised", label: "Other" }] : []),
  ];

  return (
    <div className="flex h-[calc(100vh-3rem)] md:h-screen overflow-hidden">
      {/* Left — product grid */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white shrink-0">
          <div>
            <h1 className="font-bold text-gray-900">Point of Sale</h1>
            <p className="text-xs text-gray-400">Pro Shop & Bar</p>
          </div>
          <div className="flex gap-2">
            <Link href="/manage/pos/products" className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
              Products
            </Link>
            <Link href="/manage/pos/sales" className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
              Sales log
            </Link>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 px-5 py-3 overflow-x-auto shrink-0 border-b border-gray-100 bg-white">
          {catTabs.map(cat => (
            <button
              key={String(cat.id)}
              onClick={() => setSelectedCat(cat.id as string | null)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCat === cat.id
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShoppingCart size={32} className="text-gray-200 mb-3" />
              <p className="text-gray-400 text-sm">No products yet</p>
              <Link href="/manage/pos/products" className="mt-2 text-sm text-green-600 hover:underline">
                Add products
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredProducts.map(product => {
                const outOfStock = product.trackStock && (product.stockCount ?? 0) <= 0;
                return (
                  <button
                    key={product._id}
                    onClick={() => !outOfStock && addToBasket(product)}
                    disabled={outOfStock}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      outOfStock
                        ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                        : "border-gray-200 bg-white hover:border-green-400 hover:shadow-sm active:scale-95"
                    }`}
                  >
                    <p className="font-semibold text-gray-900 text-sm leading-tight">{product.name}</p>
                    {product.trackStock && product.stockCount != null && (
                      <p className={`text-xs mt-0.5 ${product.stockCount <= 5 ? "text-amber-500" : "text-gray-400"}`}>
                        {outOfStock ? "Out of stock" : `${product.stockCount} in stock`}
                      </p>
                    )}
                    <p className="text-green-700 font-bold mt-2 text-sm">
                      {formatCurrency(product.pricePence, product.currency)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right — basket */}
      <div className="w-72 shrink-0 flex flex-col border-l border-gray-200 bg-white">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <ShoppingCart size={16} />
              Basket
              {basket.length > 0 && (
                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">
                  {basket.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </h2>
            {basket.length > 0 && (
              <button onClick={clearBasket} className="text-gray-300 hover:text-red-400 transition-colors">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Last sale confirmation */}
        {lastSale !== null && basket.length === 0 && (
          <div className="mx-4 mt-4 p-3 bg-green-50 border border-green-200 rounded-xl">
            <p className="text-green-700 text-sm font-semibold text-center">
              Sale complete — {formatCurrency(lastSale, currency)}
            </p>
            <button onClick={() => setLastSale(null)} className="w-full text-xs text-green-600 mt-1 hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Basket items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {basket.length === 0 && lastSale === null && (
            <p className="text-gray-300 text-sm text-center pt-8">Tap a product to add it</p>
          )}
          {basket.map(item => (
            <div key={item.productId} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                <p className="text-xs text-gray-400">{formatCurrency(item.unitPricePence, currency)} each</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => changeQty(item.productId, -1)} className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-400">
                  <Minus size={11} />
                </button>
                <span className="text-sm font-semibold text-gray-900 w-5 text-center">{item.quantity}</span>
                <button onClick={() => changeQty(item.productId, 1)} className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:border-green-400 hover:text-green-600">
                  <Plus size={11} />
                </button>
              </div>
              <span className="text-sm font-bold text-gray-900 w-14 text-right shrink-0">
                {formatCurrency(item.subtotalPence, currency)}
              </span>
              <button onClick={() => changeQty(item.productId, -item.quantity)} className="text-gray-200 hover:text-red-400 transition-colors">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>

        {/* Bottom — totals + charge */}
        <div className="border-t border-gray-100 px-4 py-4 space-y-3">
          {/* Payment method */}
          <div className="grid grid-cols-2 gap-1.5">
            {PAYMENT_METHODS.map(m => (
              <button
                key={m.id}
                onClick={() => setPaymentMethod(m.id)}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  paymentMethod === m.id
                    ? "bg-green-600 border-green-600 text-white"
                    : "border-gray-200 text-gray-600 hover:border-green-300"
                }`}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          {/* Notes */}
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
          />

          {/* Total */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Total</span>
            <span className="text-xl font-bold text-gray-900">{formatCurrency(total, currency)}</span>
          </div>

          <button
            onClick={handleCharge}
            disabled={saving || basket.length === 0}
            className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-bold rounded-xl transition-colors text-sm"
          >
            {saving ? "Processing…" : `Charge ${formatCurrency(total, currency)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
