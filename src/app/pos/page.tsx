"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useActiveClub } from "@/lib/club-context";
import type { Id } from "convex/_generated/dataModel";
import { formatCurrency } from "@/lib/format";
import {
  Minus, Plus, X, CreditCard, Banknote, User, Terminal,
  Gift, Search, Settings, StickyNote, CheckCircle, AlertCircle,
  PenLine, MapPin, Maximize2,
} from "lucide-react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  productId: Id<"posProducts"> | "custom";
  productName: string;
  quantity: number;
  unitPricePence: number;
  subtotalPence: number;
};

type MemberRow = {
  _id: Id<"clubMembers">;
  displayName: string;
  accountBalance?: number;
  userId: string;
};

type SaleDone = {
  total: number;
  method: string;
  memberName?: string;
};

// ── Payment methods ───────────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { id: "cash",          label: "Cash",     icon: Banknote,  colour: "bg-amber-50  border-amber-200  text-amber-800"  },
  { id: "card",          label: "Card",     icon: CreditCard, colour: "bg-blue-50   border-blue-200   text-blue-800"   },
  { id: "account",       label: "Account",  icon: User,      colour: "bg-purple-50 border-purple-200 text-purple-800" },
  { id: "terminal",      label: "Terminal", icon: Terminal,  colour: "bg-green-50  border-green-200  text-green-800"  },
  { id: "complimentary", label: "Comp",     icon: Gift,      colour: "bg-gray-50   border-gray-200   text-gray-600"   },
] as const;

// ── Custom item modal ─────────────────────────────────────────────────────────

function CustomItemModal({
  currency,
  onAdd,
  onClose,
}: {
  currency: string;
  onAdd: (name: string, pricePence: number) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  function handleAdd() {
    const pence = Math.round(parseFloat(price) * 100);
    if (!name.trim() || !pence || pence <= 0) return;
    onAdd(name.trim(), pence);
  }

  const valid = name.trim().length > 0 && parseFloat(price) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-gray-900 text-lg">Custom item</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-3">
          <input
            ref={nameRef}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Item name (e.g. Green fee)"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-base font-medium">£</span>
            <input
              value={price}
              onChange={e => setPrice(e.target.value)}
              onKeyDown={e => e.key === "Enter" && valid && handleAdd()}
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={!valid}
            className="w-full py-3.5 bg-green-600 text-white font-bold rounded-xl text-base hover:bg-green-500 disabled:opacity-40 transition-colors"
          >
            Add to basket
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Terminal picker modal ─────────────────────────────────────────────────────

function TerminalPickerModal({
  terminals,
  selected,
  onSelect,
  onClose,
}: {
  terminals: { _id: Id<"posTerminals">; terminalId: string; name: string; provider: string }[];
  selected: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-gray-900 text-lg">Select terminal</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        {terminals.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-500 text-sm mb-3">No terminals registered.</p>
            <Link href="/manage/pos/terminals" className="text-green-600 font-medium underline text-sm">
              Add a terminal →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {terminals.map(t => (
              <button
                key={t._id}
                onClick={() => { onSelect(t.terminalId); onClose(); }}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 transition-all text-left ${
                  selected === t.terminalId
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <Terminal size={20} className={selected === t.terminalId ? "text-green-600" : "text-gray-400"} />
                <div>
                  <p className="font-semibold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-400 capitalize">{t.provider}</p>
                </div>
                {selected === t.terminalId && (
                  <CheckCircle size={18} className="ml-auto text-green-500" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sale complete overlay ─────────────────────────────────────────────────────

function SaleCompleteOverlay({ sale, currency, onDismiss }: {
  sale: SaleDone;
  currency: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const methodLabel = PAYMENT_METHODS.find(m => m.id === sale.method)?.label ?? sale.method;

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-green-600 rounded-none cursor-pointer select-none"
      onClick={onDismiss}
    >
      <div className="flex flex-col items-center gap-4 text-white px-8 text-center">
        <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
          <CheckCircle size={44} className="text-white" strokeWidth={1.5} />
        </div>
        {sale.method !== "terminal" ? (
          <p className="text-4xl font-black tracking-tight">
            {formatCurrency(sale.total, currency)}
          </p>
        ) : (
          <p className="text-2xl font-bold">Sent to terminal</p>
        )}
        <p className="text-green-200 text-sm font-medium">
          {methodLabel}
          {sale.memberName ? ` · ${sale.memberName}` : ""}
        </p>
        <p className="text-green-300 text-xs mt-2">Tap to dismiss</p>
      </div>
    </div>
  );
}

// ── Main POS ──────────────────────────────────────────────────────────────────

export default function POSPage() {
  const { club } = useActiveClub();

  // Location & shift context — declared first so it can be used in the products query
  const [selectedLocationId, setSelectedLocationId] = useState<Id<"posLocations"> | null>(null);

  const categories  = useQuery(
    api.pos.listCategories,
    club
      ? { clubId: club._id, ...(selectedLocationId ? { locationId: selectedLocationId } : {}) }
      : "skip"
  );
  const products    = useQuery(
    api.pos.listProducts,
    club
      ? { clubId: club._id, ...(selectedLocationId ? { locationId: selectedLocationId } : {}) }
      : "skip"
  );
  const terminals   = useQuery(api.posTerminals.listByClub, club ? { clubId: club._id } : "skip");
  const members     = useQuery(api.clubMembers.listByClub, club ? { clubId: club._id } : "skip") as MemberRow[] | undefined;
  const locations   = useQuery(api.posLocations.listLocations, club ? { clubId: club._id } : "skip");
  const recordSale  = useMutation(api.pos.recordSale);
  const openShift = useQuery(
    api.posShifts.getOpenShift,
    club && selectedLocationId ? { clubId: club._id, locationId: selectedLocationId } : "skip"
  );

  // Category + product filter
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  // Basket
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [selectedTerminalId, setSelectedTerminalId] = useState<string>("");
  const [showTerminalPicker, setShowTerminalPicker] = useState(false);

  // Customer (member)
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<Id<"clubMembers"> | null>(null);
  const [showMemberSearch, setShowMemberSearch] = useState(false);

  // Modals / state
  const [showCustomItem, setShowCustomItem] = useState(false);
  const [saleDone, setSaleDone] = useState<SaleDone | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-clear error
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeTerminals = useMemo(() => (terminals ?? []).filter(t => t.isActive), [terminals]);

  const selectedMember = useMemo(
    () => members?.find(m => m._id === selectedMemberId) ?? null,
    [members, selectedMemberId]
  );

  const filteredMembers = useMemo(() => {
    if (!members) return [];
    const q = memberSearch.toLowerCase();
    return (q ? members.filter(m => m.displayName.toLowerCase().includes(q)) : members).slice(0, 8);
  }, [members, memberSearch]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!selectedCat) return products;
    return products.filter(p => (p.categoryId ?? "uncategorised") === selectedCat);
  }, [products, selectedCat]);

  const total = basket.reduce((s, i) => s + i.subtotalPence, 0);
  const currency = club?.currency ?? "GBP";
  const itemCount = basket.reduce((s, i) => s + i.quantity, 0);

  // ── Category tabs ──────────────────────────────────────────────────────────

  const hasUncategorised = (products ?? []).some(p => !p.categoryId);
  const catTabs = useMemo(() => [
    { id: null,             label: "All",   icon: "⊞"  },
    ...(categories ?? []).sort((a, b) => a.sortOrder - b.sortOrder)
      .map(c => ({ id: c._id as string, label: c.name, icon: c.icon ?? "●" })),
    ...(hasUncategorised ? [{ id: "uncategorised", label: "Other", icon: "…" }] : []),
  ], [categories, hasUncategorised]);

  // ── Basket helpers ─────────────────────────────────────────────────────────

  function addToBasket(item: { id: Id<"posProducts"> | "custom"; name: string; pricePence: number }) {
    setBasket(prev => {
      const existing = prev.find(i => i.productId === item.id && item.id !== "custom");
      if (existing) {
        return prev.map(i => i.productId === item.id
          ? { ...i, quantity: i.quantity + 1, subtotalPence: (i.quantity + 1) * i.unitPricePence }
          : i
        );
      }
      return [...prev, {
        productId: item.id,
        productName: item.name,
        quantity: 1,
        unitPricePence: item.pricePence,
        subtotalPence: item.pricePence,
      }];
    });
  }

  function changeQty(productId: Id<"posProducts"> | "custom", delta: number, unique?: boolean) {
    setBasket(prev => {
      if (unique) {
        // custom items can have multiple rows, find the right one by position
        return prev.map((i, idx) =>
          idx === (prev.findLastIndex(x => x.productId === productId))
            ? { ...i, quantity: i.quantity + delta, subtotalPence: (i.quantity + delta) * i.unitPricePence }
            : i
        ).filter(i => i.quantity > 0);
      }
      return prev
        .map(i => i.productId === productId
          ? { ...i, quantity: i.quantity + delta, subtotalPence: (i.quantity + delta) * i.unitPricePence }
          : i
        )
        .filter(i => i.quantity > 0);
    });
  }

  function removeItem(index: number) {
    setBasket(prev => prev.filter((_, i) => i !== index));
  }

  function clearAll() {
    setBasket([]);
    setNote("");
    setShowNote(false);
    setSelectedMemberId(null);
    setMemberSearch("");
    setSaleDone(null);
  }

  // ── Charge ─────────────────────────────────────────────────────────────────

  async function handleCharge() {
    if (!club || basket.length === 0 || saving) return;

    if (paymentMethod === "terminal" && !selectedTerminalId) {
      setShowTerminalPicker(true);
      return;
    }
    if (paymentMethod === "account" && !selectedMemberId) {
      setError("Select a member to charge their account");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const items = basket.map(i => ({
        productId: i.productId !== "custom" ? i.productId : undefined,
        productName: i.productName,
        quantity: i.quantity,
        unitPricePence: i.unitPricePence,
        subtotalPence: i.subtotalPence,
      }));

      if (paymentMethod === "terminal") {
        const res = await fetch("/api/payments/terminal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clubId: club._id,
            terminalId: selectedTerminalId,
            amount: total,
            currency,
            purpose: "pos_sale",
            description: basket.map(i => `${i.quantity}× ${i.productName}`).join(", "),
            ...(selectedMemberId ? { memberId: selectedMemberId } : {}),
          }),
        });
        if (!res.ok) {
          const err = await res.json() as { error?: string };
          throw new Error(err.error ?? "Failed to reach terminal");
        }
        await recordSale({
          clubId: club._id,
          memberId: selectedMember?.userId,
          memberName: selectedMember?.displayName,
          items,
          currency,
          paymentMethod: "terminal",
          notes: note || undefined,
          shiftId:    openShift?._id,
          locationId: selectedLocationId ?? undefined,
          isGuest:    !selectedMember,
        });
      } else if (paymentMethod === "account") {
        await recordSale({
          clubId: club._id,
          chargeAccountMemberId: selectedMemberId!,
          items,
          currency,
          paymentMethod: "account",
          notes: note || undefined,
          shiftId:    openShift?._id,
          locationId: selectedLocationId ?? undefined,
          isGuest:    false,
        });
      } else {
        await recordSale({
          clubId: club._id,
          memberId: selectedMember?.userId,
          memberName: selectedMember?.displayName,
          items,
          currency,
          paymentMethod,
          notes: note || undefined,
          shiftId:    openShift?._id,
          locationId: selectedLocationId ?? undefined,
          isGuest:    !selectedMember,
        });
      }

      setSaleDone({
        total,
        method: paymentMethod,
        memberName: selectedMember?.displayName,
      });
      setBasket([]);
      setNote("");
      setShowNote(false);
      setSelectedMemberId(null);
      setMemberSearch("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (!club || !products || !categories) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin h-10 w-10 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-3rem)] md:h-screen overflow-hidden bg-gray-100 select-none">

      {/* ── Col 1: Category sidebar ──────────────────────────────────────── */}
      <div className="w-[72px] shrink-0 flex flex-col bg-white border-r border-gray-200 overflow-y-auto py-2 gap-1">
        {catTabs.map(cat => {
          const active = selectedCat === cat.id;
          return (
            <button
              key={String(cat.id)}
              onClick={() => setSelectedCat(cat.id)}
              className={`mx-1.5 flex flex-col items-center gap-1 py-3 px-1 rounded-xl text-center transition-all ${
                active
                  ? "bg-green-600 text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              <span className="text-xl leading-none">{cat.icon}</span>
              <span className={`text-[10px] font-medium leading-tight line-clamp-2 ${active ? "text-white" : "text-gray-500"}`}>
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Col 2: Product grid ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Minimal header — admin links tucked away */}
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div>
              <span className="font-bold text-gray-900 text-sm">{club.name}</span>
              <span className="text-gray-400 text-xs ml-2">Point of Sale</span>
            </div>
            {/* Location selector */}
            {locations && locations.length > 0 && (
              <div className="flex items-center gap-1.5">
                <MapPin size={12} className="text-gray-400 shrink-0" />
                <select
                  value={selectedLocationId ?? ""}
                  onChange={e => setSelectedLocationId(e.target.value ? e.target.value as Id<"posLocations"> : null)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-500 text-gray-600"
                >
                  <option value="">No location</option>
                  {locations.filter(l => l.isActive).map(l => (
                    <option key={l._id} value={l._id}>{l.name}</option>
                  ))}
                </select>
                {/* Shift indicator */}
                {selectedLocationId && (
                  openShift
                    ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">Shift open</span>
                    : <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">No shift</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/manage/pos/shifts"
              className="text-xs px-2.5 py-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Shifts
            </Link>
            <Link
              href="/manage/pos/sales"
              className="text-xs px-2.5 py-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Sales log
            </Link>
            <Link
              href="/manage/pos/products"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Manage products"
            >
              <Settings size={16} />
            </Link>
            <Link
              href="/kiosk/pos"
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-gray-900 text-white hover:bg-gray-700 rounded-lg transition-colors font-medium ml-1"
              title="Enter fullscreen kiosk mode"
            >
              <Maximize2 size={12} /> Fullscreen
            </Link>
          </div>
        </div>

        {/* Products */}
        <div className="flex-1 overflow-y-auto p-3">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-gray-400 text-sm mb-2">No products in this category</p>
              <Link href="/manage/pos/products" className="text-sm text-green-600 hover:underline font-medium">
                Add products →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
              {filteredProducts.map(product => {
                const outOfStock = product.trackStock && (product.stockCount ?? 0) <= 0;
                const inBasket = basket.find(i => i.productId === product._id);
                return (
                  <button
                    key={product._id}
                    onClick={() => !outOfStock && addToBasket({ id: product._id, name: product.name, pricePence: product.pricePence })}
                    disabled={outOfStock}
                    className={`relative flex flex-col justify-between p-3.5 rounded-2xl border-2 min-h-[90px] text-left transition-all active:scale-95 ${
                      outOfStock
                        ? "border-gray-100 bg-white opacity-40 cursor-not-allowed"
                        : inBasket
                          ? "border-green-500 bg-green-50 shadow-sm"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                    }`}
                  >
                    {inBasket && (
                      <span className="absolute top-2 right-2 w-5 h-5 bg-green-600 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                        {inBasket.quantity}
                      </span>
                    )}
                    <p className={`text-sm font-semibold leading-tight pr-4 ${inBasket ? "text-green-900" : "text-gray-900"}`}>
                      {product.name}
                    </p>
                    <div className="mt-2">
                      {product.trackStock && product.stockCount != null && !outOfStock && product.stockCount <= 5 && (
                        <p className="text-[10px] text-amber-500 font-medium mb-0.5">{product.stockCount} left</p>
                      )}
                      <p className={`text-base font-black ${inBasket ? "text-green-700" : "text-gray-800"}`}>
                        {formatCurrency(product.pricePence, product.currency)}
                      </p>
                    </div>
                  </button>
                );
              })}

              {/* Custom item tile */}
              <button
                onClick={() => setShowCustomItem(true)}
                className="flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-2xl border-2 border-dashed border-gray-300 min-h-[90px] text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-all active:scale-95 bg-white"
              >
                <PenLine size={20} />
                <span className="text-xs font-medium">Custom</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Col 3: Basket / checkout ──────────────────────────────────────── */}
      <div className="w-80 shrink-0 flex flex-col bg-white border-l border-gray-200 relative">

        {/* Sale complete overlay */}
        {saleDone && (
          <SaleCompleteOverlay
            sale={saleDone}
            currency={currency}
            onDismiss={clearAll}
          />
        )}

        {/* Error banner */}
        {error && (
          <div className="absolute top-0 left-0 right-0 z-30 flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-medium">
            <AlertCircle size={15} className="shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)}><X size={14} /></button>
          </div>
        )}

        {/* ── Customer chip ── */}
        <div className="px-4 pt-4 pb-2 border-b border-gray-100">
          {selectedMember ? (
            <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-xl px-3.5 py-2.5">
              <div>
                <p className="text-sm font-semibold text-purple-900 leading-tight">{selectedMember.displayName}</p>
                <p className="text-xs text-purple-600 mt-0.5">
                  Balance: {formatCurrency(selectedMember.accountBalance ?? 0, currency)}
                  {paymentMethod === "account" && (selectedMember.accountBalance ?? 0) < total && total > 0 && (
                    <span className="text-red-500 font-semibold ml-1">· insufficient</span>
                  )}
                </p>
              </div>
              <button onClick={() => { setSelectedMemberId(null); setMemberSearch(""); }} className="ml-2 text-purple-400 hover:text-red-500 transition-colors">
                <X size={15} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowMemberSearch(s => !s)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-gray-200 text-left hover:border-gray-300 transition-colors"
              >
                <User size={15} className="text-gray-400 shrink-0" />
                <span className="text-sm text-gray-400 flex-1">Walk-in customer</span>
                <Search size={13} className="text-gray-300" />
              </button>

              {showMemberSearch && (
                <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
                    <Search size={13} className="text-gray-400 shrink-0" />
                    <input
                      autoFocus
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      placeholder="Search member…"
                      className="flex-1 text-sm outline-none"
                    />
                    <button onClick={() => { setShowMemberSearch(false); setMemberSearch(""); }}><X size={14} className="text-gray-400" /></button>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredMembers.map(m => (
                      <button
                        key={m._id}
                        onClick={() => { setSelectedMemberId(m._id); setShowMemberSearch(false); setMemberSearch(""); }}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 text-left"
                      >
                        <span className="text-sm font-medium text-gray-800">{m.displayName}</span>
                        <span className="text-xs text-gray-400 ml-2">{formatCurrency(m.accountBalance ?? 0, currency)}</span>
                      </button>
                    ))}
                    {filteredMembers.length === 0 && (
                      <p className="px-4 py-3 text-sm text-gray-400">No members found</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Basket items ── */}
        <div className="flex-1 overflow-y-auto">
          {basket.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-300 text-sm">Add items from the left</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {basket.map((item, idx) => (
                <div key={`${item.productId}-${idx}`} className="flex items-center gap-2 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                    <p className="text-xs text-gray-400">{formatCurrency(item.unitPricePence, currency)} each</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => changeQty(item.productId, -1)}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500 active:scale-90 transition-all"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-sm font-bold text-gray-900 w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => changeQty(item.productId, 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-600 active:scale-90 transition-all"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <span className="text-sm font-bold text-gray-900 w-14 text-right shrink-0">
                    {formatCurrency(item.subtotalPence, currency)}
                  </span>
                  <button onClick={() => removeItem(idx)} className="text-gray-200 hover:text-red-400 transition-colors ml-1">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Note toggle ── */}
        {basket.length > 0 && (
          <div className="px-4 pb-1">
            {showNote ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Add a note…"
                  className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
                <button onClick={() => { setShowNote(false); setNote(""); }} className="text-gray-300 hover:text-gray-500"><X size={13} /></button>
              </div>
            ) : (
              <button
                onClick={() => setShowNote(true)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
              >
                <StickyNote size={12} /> Add note
              </button>
            )}
          </div>
        )}

        {/* ── Checkout footer ── */}
        <div className="border-t border-gray-100 p-4 space-y-3">

          {/* Total */}
          <div className="flex items-baseline justify-between px-1">
            <span className="text-sm text-gray-500">
              {itemCount > 0 ? `${itemCount} item${itemCount !== 1 ? "s" : ""}` : "Total"}
            </span>
            <span className="text-4xl font-black text-gray-900 tracking-tight">
              {formatCurrency(total, currency)}
            </span>
          </div>

          {/* Payment methods — 2×2 + 1 */}
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.slice(0, 4).map(m => {
              const Icon = m.icon;
              const active = paymentMethod === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setPaymentMethod(m.id);
                    if (m.id === "terminal" && activeTerminals.length > 0 && !selectedTerminalId) {
                      setShowTerminalPicker(true);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 font-semibold text-sm transition-all active:scale-95 ${
                    active
                      ? `${m.colour} border-current`
                      : "border-gray-200 text-gray-600 bg-white hover:border-gray-300"
                  }`}
                >
                  <Icon size={16} />
                  {m.id === "terminal" && selectedTerminalId && active
                    ? activeTerminals.find(t => t.terminalId === selectedTerminalId)?.name ?? m.label
                    : m.label
                  }
                  {m.id === "terminal" && active && selectedTerminalId && (
                    <button
                      onClick={e => { e.stopPropagation(); setShowTerminalPicker(true); }}
                      className="ml-auto text-current opacity-60 hover:opacity-100"
                    >
                      <Settings size={12} />
                    </button>
                  )}
                </button>
              );
            })}
          </div>
          {/* Comp — full width, subtle */}
          <button
            onClick={() => setPaymentMethod("complimentary")}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl border text-sm font-medium transition-all ${
              paymentMethod === "complimentary"
                ? "border-gray-400 bg-gray-100 text-gray-700"
                : "border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300"
            }`}
          >
            <Gift size={14} /> Complimentary
          </button>

          {/* Charge button */}
          <button
            onClick={handleCharge}
            disabled={saving || basket.length === 0 || (paymentMethod === "account" && !selectedMemberId)}
            className={`w-full py-4 font-black text-lg rounded-2xl transition-all active:scale-[0.98] disabled:opacity-40 text-white shadow-lg ${
              paymentMethod === "account" && selectedMember && (selectedMember.accountBalance ?? 0) < total
                ? "bg-red-500 shadow-red-200"
                : "bg-green-600 hover:bg-green-500 shadow-green-200"
            }`}
          >
            {saving
              ? "Processing…"
              : paymentMethod === "terminal" && !selectedTerminalId
                ? "Select terminal →"
                : paymentMethod === "account" && !selectedMemberId
                  ? "Select member →"
                  : paymentMethod === "terminal"
                    ? "Send to terminal"
                    : `Charge ${formatCurrency(total, currency)}`
            }
          </button>

          {/* Clear */}
          {basket.length > 0 && (
            <button
              onClick={clearAll}
              className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Clear basket
            </button>
          )}
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {showCustomItem && (
        <CustomItemModal
          currency={currency}
          onAdd={(name, pricePence) => {
            addToBasket({ id: "custom", name, pricePence });
            setShowCustomItem(false);
          }}
          onClose={() => setShowCustomItem(false)}
        />
      )}

      {showTerminalPicker && (
        <TerminalPickerModal
          terminals={activeTerminals}
          selected={selectedTerminalId}
          onSelect={id => { setSelectedTerminalId(id); setPaymentMethod("terminal"); }}
          onClose={() => setShowTerminalPicker(false)}
        />
      )}
    </div>
  );
}
