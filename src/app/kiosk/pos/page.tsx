"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { formatCurrency } from "@/lib/format";
import { X, ChevronLeft, Search, UserCircle, Check, Lock } from "lucide-react";
import { PinPad, HiddenManagerTrigger } from "@/components/kiosk/PinLock";
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
  productId: Id<"posProducts">;
  productName: string;
  quantity: number;
  unitPricePence: number;
  subtotalPence: number;
};

type MemberResult = {
  _id: Id<"clubMembers">;
  displayName: string;
  fgcMemberId?: string;
  accountBalance: number;
  avatarUrl?: string;
};

// ── Member search overlay ─────────────────────────────────────────────────────

function MemberSearchOverlay({
  clubId,
  currency,
  total,
  onSelect,
  onClose,
}: {
  clubId: Id<"clubs">;
  currency: string;
  total: number;
  onSelect: (member: MemberResult) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const results = useQuery(
    api.memberAccounts.searchMembers,
    query.trim().length >= 1 ? { clubId, search: query } : "skip"
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
          <h2 className="text-xl font-bold">Find member</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition-colors">
            <X size={22} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
            <Search size={20} className="text-gray-400 shrink-0" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Name or membership number…"
              className="flex-1 bg-transparent text-white text-lg placeholder-gray-500 focus:outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-gray-500 hover:text-white">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="px-4 pb-5 space-y-2 max-h-80 overflow-y-auto">
          {results === undefined && query.trim() && (
            <p className="text-center text-gray-500 py-6 text-sm">Searching…</p>
          )}
          {results?.length === 0 && query.trim() && (
            <p className="text-center text-gray-500 py-6 text-sm">No members found</p>
          )}
          {!query.trim() && (
            <p className="text-center text-gray-600 py-6 text-sm">Type a name or membership number</p>
          )}
          {results?.map(member => {
            const canAfford = member.accountBalance >= total;
            return (
              <button
                key={member._id}
                onClick={() => canAfford && onSelect(member)}
                disabled={!canAfford}
                className={[
                  "w-full flex items-center gap-4 px-4 py-4 rounded-xl text-left transition-colors",
                  canAfford
                    ? "bg-gray-800 hover:bg-gray-700 active:bg-gray-600"
                    : "bg-gray-800/50 opacity-50 cursor-not-allowed",
                ].join(" ")}
              >
                <div className="w-11 h-11 rounded-full bg-gray-700 flex items-center justify-center shrink-0 text-lg font-bold">
                  {member.avatarUrl
                    ? <img src={member.avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover" />
                    : member.displayName[0]
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white">{member.displayName}</p>
                  {member.fgcMemberId && (
                    <p className="text-xs text-gray-400 mt-0.5">#{member.fgcMemberId}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-bold text-lg ${canAfford ? "text-green-400" : "text-red-400"}`}>
                    {formatCurrency(member.accountBalance, currency)}
                  </p>
                  {!canAfford && (
                    <p className="text-xs text-red-400 mt-0.5">Insufficient</p>
                  )}
                  {canAfford && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      → {formatCurrency(member.accountBalance - total, currency)}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Checkout confirm overlay ──────────────────────────────────────────────────

function ConfirmOverlay({
  method,
  total,
  currency,
  member,
  onConfirm,
  onCancel,
  saving,
}: {
  method: "cash" | "card" | "account";
  total: number;
  currency: string;
  member: MemberResult | null;
  onConfirm: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl text-center p-8">
        {method === "account" && member ? (
          <>
            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              {member.avatarUrl
                ? <img src={member.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
                : member.displayName[0]
              }
            </div>
            <p className="text-xl font-bold mb-1">{member.displayName}</p>
            <p className="text-gray-400 text-sm mb-6">
              Charge {formatCurrency(total, currency)} to account<br />
              <span className="text-gray-500">
                Balance: {formatCurrency(member.accountBalance, currency)} → {formatCurrency(member.accountBalance - total, currency)}
              </span>
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <UserCircle size={32} className="text-gray-400" />
            </div>
            <p className="text-xl font-bold mb-1">{method === "cash" ? "Cash payment" : "Card payment"}</p>
            <p className="text-4xl font-black text-white mt-4 mb-6">{formatCurrency(total, currency)}</p>
          </>
        )}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl font-semibold text-gray-200 transition-colors text-lg"
          >
            Back
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="flex-1 py-4 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-xl font-bold text-white transition-colors text-lg"
          >
            {saving ? "…" : <span className="flex items-center justify-center gap-2"><Check size={20} /> Confirm</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sale complete overlay ─────────────────────────────────────────────────────

function SaleCompleteOverlay({ total, currency, member, onDismiss }: {
  total: number; currency: string; member: MemberResult | null; onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
      <div className="text-center">
        <div className="w-24 h-24 rounded-full bg-green-600 flex items-center justify-center mx-auto mb-6">
          <Check size={48} className="text-white" />
        </div>
        <p className="text-4xl font-black text-white mb-2">{formatCurrency(total, currency)}</p>
        {member && <p className="text-xl text-gray-300 mb-1">Charged to {member.displayName}</p>}
        <p className="text-gray-500 text-sm mt-4">Tap anywhere to continue</p>
      </div>
    </div>
  );
}

// ── Main kiosk POS ────────────────────────────────────────────────────────────

// Read kioskId from URL: /kiosk/pos?kiosk=<kioskId>
function useKioskId(): Id<"posKiosks"> | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const id = params.get("kiosk");
  return id ? (id as Id<"posKiosks">) : null;
}

export default function KioskPOS() {
  const { user } = useUser();
  const memberships = useQuery(api.clubMembers.listByUser, user ? { userId: user.id } : "skip");
  const activeMembership = memberships?.find(m => m.status === "active");
  const club = useQuery(api.clubs.get, activeMembership ? { clubId: activeMembership.clubId } : "skip");
  const categories = useQuery(api.pos.listCategories, club ? { clubId: club._id } : "skip");
  const products = useQuery(api.pos.listProducts, club ? { clubId: club._id } : "skip");
  const recordSale = useMutation(api.pos.recordSale);

  // ── PIN lock & kiosk identity ───────────────────────────────────────────────
  const kioskId = useKioskId();
  const kioskData = useQuery(
    api.posLocations.getKioskById,
    kioskId ? { kioskId } : "skip"
  );
  const [showPinPad, setShowPinPad] = useState(false);
  const [managerUnlocked, setManagerUnlocked] = useState(false);

  // Auto-relock after 5 minutes of manager mode
  useEffect(() => {
    if (!managerUnlocked) return;
    const t = setTimeout(() => setManagerUnlocked(false), 5 * 60 * 1000);
    return () => clearTimeout(t);
  }, [managerUnlocked]);

  const handleUnlocked = useCallback(() => {
    setManagerUnlocked(true);
    setShowPinPad(false);
  }, []);

  const handleLock = useCallback(() => {
    setManagerUnlocked(false);
  }, []);

  // ── Active shift for this kiosk's location ──────────────────────────────────
  // Looks up the open shift for the location this kiosk is assigned to.
  // Every sale is stamped with shiftId + locationId so shift reports work.
  const openShift = useQuery(
    api.posShifts.getOpenShift,
    club && kioskData?.locationId
      ? { clubId: club._id, locationId: kioskData.locationId }
      : "skip"
  );

  // ── POS state ───────────────────────────────────────────────────────────────
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [showBasket, setShowBasket] = useState(false);

  // Checkout flow state
  const [stage, setStage] = useState<"grid" | "memberSearch" | "confirm" | "done">("grid");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "account">("cash");
  const [selectedMember, setSelectedMember] = useState<MemberResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastTotal, setLastTotal] = useState(0);

  const currency = club?.currency ?? "GBP";
  const total = basket.reduce((s, i) => s + i.subtotalPence, 0);
  const itemCount = basket.reduce((s, i) => s + i.quantity, 0);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    const active = products.filter(p => p.isActive);
    if (!selectedCat) return active;
    return active.filter(p => (p.categoryId ?? "uncategorised") === selectedCat);
  }, [products, selectedCat]);

  const catTabs = useMemo(() => {
    if (!categories || !products) return [];
    const hasUncategorised = products.some(p => !p.categoryId && p.isActive);
    return [
      { id: null, label: "All" },
      ...categories.sort((a, b) => a.sortOrder - b.sortOrder).map(c => ({
        id: c._id as string,
        label: `${c.icon ?? ""} ${c.name}`.trim(),
      })),
      ...(hasUncategorised ? [{ id: "uncategorised", label: "Other" }] : []),
    ];
  }, [categories, products]);

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
    setBasket(prev =>
      prev.map(i => i.productId === productId
        ? { ...i, quantity: i.quantity + delta, subtotalPence: (i.quantity + delta) * i.unitPricePence }
        : i
      ).filter(i => i.quantity > 0)
    );
  }

  function startCheckout(method: "cash" | "card" | "account") {
    setPaymentMethod(method);
    if (method === "account") {
      setStage("memberSearch");
    } else {
      setSelectedMember(null);
      setStage("confirm");
    }
  }

  async function confirmSale() {
    if (!club) return;
    setSaving(true);
    try {
      await recordSale({
        clubId: club._id,
        items: basket,
        currency,
        paymentMethod,
        chargeAccountMemberId: paymentMethod === "account" && selectedMember ? selectedMember._id : undefined,
        memberId: paymentMethod === "account" && selectedMember ? selectedMember._id as unknown as string : undefined,
        memberName: selectedMember?.displayName,
        // Stamp shift & location context so this sale appears in shift reports
        shiftId:    openShift?._id,
        locationId: kioskData?.locationId,
        isGuest:    !selectedMember, // no member selected = walk-in / guest
      });
      setLastTotal(total);
      setBasket([]);
      setSelectedMember(null);
      setStage("done");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Sale failed");
      setStage("grid");
    } finally {
      setSaving(false);
    }
  }

  if (!club || !products || !categories) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-10 w-10 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden relative">

      {/* ── Hidden triple-tap trigger (top-right corner) ─────────────── */}
      {kioskId && !managerUnlocked && (
        <HiddenManagerTrigger onTripleTap={() => setShowPinPad(true)} />
      )}

      {/* ── PIN pad overlay ───────────────────────────────────────────── */}
      {kioskId && (
        <PinPad
          kioskId={kioskId}
          visible={showPinPad}
          onUnlocked={handleUnlocked}
          onDismiss={() => setShowPinPad(false)}
        />
      )}

      {/* ── Left: product grid ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900 shrink-0">
          <div>
            <p className="font-bold text-white text-lg">{club.name}</p>
            <p className="text-xs text-gray-500">Bar &amp; Pro Shop</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Shift status indicator — only shown when kiosk is registered */}
            {kioskData && (
              openShift
                ? <span className="text-[11px] text-green-500 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                    Shift open
                  </span>
                : <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                    No shift
                  </span>
            )}
            {/* Manager mode chip — shown when unlocked */}
            {managerUnlocked && (
              <div className="flex items-center gap-2">
                <Link
                  href="/manage/pos/shifts"
                  className="text-xs px-3 py-1.5 bg-green-700 hover:bg-green-600 text-green-100 rounded-lg font-medium transition-colors"
                >
                  Shifts &amp; Reports
                </Link>
                <button
                  onClick={handleLock}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors border border-gray-700"
                  title="Lock kiosk"
                >
                  <Lock size={12} /> Lock
                </button>
              </div>
            )}
            {/* Mobile basket toggle */}
            <button
              onClick={() => setShowBasket(v => !v)}
              className="lg:hidden flex items-center gap-2 px-4 py-2.5 bg-green-600 rounded-xl font-semibold text-sm"
            >
              Basket {itemCount > 0 && <span className="bg-white text-green-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">{itemCount}</span>}
            </button>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 px-4 py-3 overflow-x-auto shrink-0 border-b border-gray-800 bg-gray-900">
          {catTabs.map(cat => (
            <button
              key={String(cat.id)}
              onClick={() => setSelectedCat(cat.id as string | null)}
              className={[
                "px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors",
                selectedCat === cat.id
                  ? "bg-green-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700 active:bg-gray-600",
              ].join(" ")}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Products */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredProducts.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-600">No products in this category</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map(product => {
                const outOfStock = product.trackStock && (product.stockCount ?? 0) <= 0;
                const inBasket = basket.find(i => i.productId === product._id)?.quantity ?? 0;
                return (
                  <button
                    key={product._id}
                    onClick={() => !outOfStock && addToBasket(product)}
                    disabled={outOfStock}
                    className={[
                      "relative text-left p-5 rounded-2xl border transition-all active:scale-95",
                      outOfStock
                        ? "border-gray-800 bg-gray-800/30 opacity-40 cursor-not-allowed"
                        : inBasket > 0
                        ? "border-green-500 bg-green-900/30 shadow-lg shadow-green-900/20"
                        : "border-gray-700 bg-gray-800 hover:border-gray-500 hover:bg-gray-750",
                    ].join(" ")}
                  >
                    {inBasket > 0 && (
                      <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center">
                        {inBasket}
                      </span>
                    )}
                    <p className="font-bold text-white text-base leading-tight pr-6">{product.name}</p>
                    {product.trackStock && product.stockCount != null && !outOfStock && product.stockCount <= 5 && (
                      <p className="text-xs text-amber-400 mt-1">{product.stockCount} left</p>
                    )}
                    <p className="text-green-400 font-black text-xl mt-3">
                      {formatCurrency(product.pricePence, currency)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: basket ──────────────────────────────────────────── */}
      <div className={[
        "w-80 shrink-0 flex flex-col border-l border-gray-800 bg-gray-900",
        "fixed inset-y-0 right-0 z-40 lg:static",
        showBasket || "hidden lg:flex",
      ].join(" ")}>

        {/* Basket header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <h2 className="font-bold text-white text-lg">
            Basket
            {itemCount > 0 && (
              <span className="ml-2 text-sm bg-green-600/30 text-green-400 px-2 py-0.5 rounded-full font-bold">
                {itemCount}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            {basket.length > 0 && (
              <button
                onClick={() => setBasket([])}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-gray-800"
              >
                Clear
              </button>
            )}
            <button onClick={() => setShowBasket(false)} className="lg:hidden text-gray-500 hover:text-white p-1">
              <ChevronLeft size={20} />
            </button>
          </div>
        </div>

        {/* Basket items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {basket.length === 0 ? (
            <p className="text-gray-600 text-sm text-center pt-10">Tap a product to add it</p>
          ) : (
            basket.map(item => (
              <div key={item.productId} className="flex items-center gap-3 bg-gray-800 rounded-xl px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">{item.productName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{formatCurrency(item.unitPricePence, currency)} each</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => changeQty(item.productId, -1)}
                    className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 active:bg-gray-500 flex items-center justify-center text-white font-bold transition-colors text-lg"
                  >−</button>
                  <span className="text-white font-bold w-5 text-center">{item.quantity}</span>
                  <button
                    onClick={() => changeQty(item.productId, 1)}
                    className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 active:bg-gray-500 flex items-center justify-center text-white font-bold transition-colors text-lg"
                  >+</button>
                </div>
                <span className="text-white font-bold text-sm w-14 text-right shrink-0">
                  {formatCurrency(item.subtotalPence, currency)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Payment */}
        <div className="border-t border-gray-800 px-4 py-5 space-y-3 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-400 text-sm">Total</span>
            <span className="text-3xl font-black text-white">{formatCurrency(total, currency)}</span>
          </div>

          <button
            onClick={() => startCheckout("account")}
            disabled={basket.length === 0}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl font-bold text-white text-base transition-colors"
          >
            Charge to Account
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => startCheckout("cash")}
              disabled={basket.length === 0}
              className="py-4 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl font-bold text-white transition-colors"
            >
              Cash
            </button>
            <button
              onClick={() => startCheckout("card")}
              disabled={basket.length === 0}
              className="py-4 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl font-bold text-white transition-colors"
            >
              Card
            </button>
          </div>
        </div>
      </div>

      {/* ── Overlays ───────────────────────────────────────────────── */}

      {stage === "memberSearch" && (
        <MemberSearchOverlay
          clubId={club._id}
          currency={currency}
          total={total}
          onSelect={member => { setSelectedMember(member); setStage("confirm"); }}
          onClose={() => setStage("grid")}
        />
      )}

      {stage === "confirm" && (
        <ConfirmOverlay
          method={paymentMethod}
          total={total}
          currency={currency}
          member={selectedMember}
          onConfirm={confirmSale}
          onCancel={() => setStage("grid")}
          saving={saving}
        />
      )}

      {stage === "done" && (
        <SaleCompleteOverlay
          total={lastTotal}
          currency={currency}
          member={selectedMember}
          onDismiss={() => { setStage("grid"); setSelectedMember(null); }}
        />
      )}
    </div>
  );
}
