"use client";

import { useState, useMemo, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { formatCurrency } from "@/lib/format";
import { X, ChevronLeft, Search, UserCircle, Check, Lock, ArrowLeft, Maximize, Minimize, Plus, Pencil, ChevronDown } from "lucide-react";

import { PinPad } from "@/components/kiosk/PinLock";
import { KioskShiftModal } from "@/components/kiosk/ShiftModal";
import { TerminalPickerModal } from "@/components/pos/TerminalPickerModal";
import Link from "next/link";
import type { PosProduct, BasketItem } from "@/lib/pos/types";
import { applyNumpadKey } from "@/lib/pos/numpad";

// ── Types ─────────────────────────────────────────────────────────────────────

// PosProduct and BasketItem imported from @/lib/pos/types
type Product = PosProduct;

type MemberResult = {
  _id: Id<"clubMembers">;
  displayName: string;
  fgcMemberId?: string;
  accountBalance: number;
  avatarUrl?: string;
};

// ── New tab modal ─────────────────────────────────────────────────────────────

function NewTabModal({ onOpen, onClose }: { onOpen: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl p-8">
        <h2 className="text-xl font-bold text-white mb-5">New tab</h2>
        <input
          ref={ref}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onOpen(name)}
          placeholder="Tab name — Table 4, Jamie… (optional)"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 mb-5"
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl font-semibold text-gray-200 text-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => onOpen(name)}
            className="flex-1 py-4 bg-green-600 hover:bg-green-500 rounded-xl font-bold text-white text-lg transition-colors"
          >
            Open tab
          </button>
        </div>
      </div>
    </div>
  );
}

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
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
          <h2 className="text-xl font-bold">Find member</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition-colors">
            <X size={22} />
          </button>
        </div>

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
  method, total, currency, member, onConfirm, onCancel, saving,
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

function SaleCompleteOverlay({ total, currency, member, tabName, onDismiss }: {
  total: number; currency: string; member: MemberResult | null; tabName?: string; onDismiss: () => void;
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
        {tabName && <p className="text-gray-500 text-sm">Tab: {tabName}</p>}
        <p className="text-gray-500 text-sm mt-4">Tap anywhere to continue</p>
      </div>
    </div>
  );
}

// ── Main kiosk POS ────────────────────────────────────────────────────────────

function useKioskId(): Id<"posKiosks"> | null {
  const params = useSearchParams();
  const id = params.get("kiosk");
  return id ? (id as Id<"posKiosks">) : null;
}

function KioskPOS() {
  const kioskId = useKioskId();
  const kioskData = useQuery(
    api.posLocations.getKioskById,
    kioskId ? { kioskId } : "skip"
  );

  const { user } = useUser();
  const memberships = useQuery(
    api.clubMembers.listByUser,
    !kioskId && user ? { userId: user.id } : "skip"
  );
  const activeMembership = memberships?.find(m => m.status === "active");

  const clubId: Id<"clubs"> | null =
    kioskData?.clubId ?? activeMembership?.clubId ?? null;

  const club = useQuery(api.clubs.get, clubId ? { clubId } : "skip");
  const categories = useQuery(
    api.pos.listCategories,
    clubId
      ? { clubId, ...(kioskData?.locationId ? { locationId: kioskData.locationId } : {}) }
      : "skip"
  );
  const products = useQuery(
    api.pos.listProducts,
    clubId
      ? { clubId, ...(kioskData?.locationId ? { locationId: kioskData.locationId } : {}) }
      : "skip"
  );
  const recordSale = useMutation(api.pos.recordSale);
  const terminals  = useQuery(api.posTerminals.listByClub, clubId ? { clubId } : "skip");

  // ── Tab mutations ──────────────────────────────────────────────────────────
  const openTabMut    = useMutation(api.posTabs.openTab);
  const addItemMut    = useMutation(api.posTabs.addItem);
  const updateItemMut = useMutation(api.posTabs.updateItem);
  const removeItemMut = useMutation(api.posTabs.removeItem);
  const closeTabMut   = useMutation(api.posTabs.closeTab);
  const voidTabMut    = useMutation(api.posTabs.voidTab);
  const renameTabMut  = useMutation(api.posTabs.renameTab);

  const openTabs = useQuery(
    api.posTabs.listOpenTabs,
    clubId
      ? { clubId, ...(kioskData?.locationId ? { locationId: kioskData.locationId } : {}) }
      : "skip"
  );

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTabId, setActiveTabId]       = useState<Id<"posTabs"> | null>(null);
  const [showNewTabModal, setShowNewTabModal] = useState(false);
  const [editingTabName, setEditingTabName]  = useState(false);
  const [tabNameInput, setTabNameInput]      = useState("");

  const activeTab = useQuery(
    api.posTabs.getTab,
    activeTabId ? { tabId: activeTabId } : "skip"
  );

  // ── Kiosk lock / fullscreen state ─────────────────────────────────────────
  const [isLocked, setIsLocked]             = useState(false);
  const [showPinPad, setShowPinPad]         = useState(false);
  const [pinMode, setPinMode]               = useState<"lock" | "unlock">("unlock");
  const [managerUnlocked, setManagerUnlocked] = useState(false);
  const [isFullscreen, setIsFullscreen]     = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement) {
        setIsLocked(false);
        setManagerUnlocked(false);
      }
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function enterFullscreen() { document.documentElement.requestFullscreen().catch(() => {}); }
  function exitFullscreen()  { document.exitFullscreen().catch(() => {}); }

  function handleLockAndFullscreen() {
    enterFullscreen();
    setPinMode("lock");
    setShowPinPad(true);
  }

  function handleManagerRequest() {
    setPinMode("unlock");
    setShowPinPad(true);
  }

  const handlePinVerified = useCallback(() => {
    setShowPinPad(false);
    if (pinMode === "lock") {
      setIsLocked(true);
      setManagerUnlocked(false);
    } else {
      setManagerUnlocked(true);
      setIsLocked(false);
    }
  }, [pinMode]);

  const handleRelock = useCallback(() => {
    setManagerUnlocked(false);
    setIsLocked(true);
  }, []);

  // Auto-relock after 5 minutes of manager mode
  useEffect(() => {
    if (!managerUnlocked) return;
    const t = setTimeout(() => {
      setManagerUnlocked(false);
      setIsLocked(true);
    }, 5 * 60 * 1000);
    return () => clearTimeout(t);
  }, [managerUnlocked]);

  // ── Shift ──────────────────────────────────────────────────────────────────
  const openShift = useQuery(
    api.posShifts.getOpenShift,
    club && kioskData?.locationId
      ? { clubId: club._id, locationId: kioskData.locationId }
      : "skip"
  );

  // ── POS state ──────────────────────────────────────────────────────────────
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [basket, setBasket]           = useState<BasketItem[]>([]);
  const [showBasket, setShowBasket]   = useState(false);

  // Derived basket — tab mode uses Convex items; quick-sale uses local state
  const displayBasket: BasketItem[] = activeTabId && activeTab
    ? activeTab.items.map(i => ({
        productId:      (i.productId ?? ("custom" as unknown as Id<"posProducts">)),
        productName:    i.productName,
        quantity:       i.quantity,
        unitPricePence: i.unitPricePence,
        subtotalPence:  i.subtotalPence,
      }))
    : basket;

  const [stage, setStage]                   = useState<"grid" | "memberSearch" | "confirm" | "done">("grid");
  const [paymentMethod, setPaymentMethod]   = useState<string>("cash");
  const [selectedMember, setSelectedMember] = useState<MemberResult | null>(null);
  const [saving, setSaving]                 = useState(false);
  const [lastTotal, setLastTotal]           = useState(0);
  const [lastTabName, setLastTabName]       = useState<string | undefined>(undefined);

  // Partial payments
  const [partialPayments, setPartialPayments] = useState<Array<{ method: string; amountPence: number }>>([]);
  const [numpadValue, setNumpadValue]         = useState("");
  const [showNumpad, setShowNumpad]           = useState(false);
  const [splitPeople, setSplitPeople]         = useState(1);
  const [pendingAmount, setPendingAmount]     = useState(0);

  // Terminal
  const [selectedTerminalId, setSelectedTerminalId] = useState<string>("");
  const [showTerminalPicker, setShowTerminalPicker] = useState(false);

  const currency  = club?.currency ?? "GBP";
  const total     = displayBasket.reduce((s, i) => s + i.subtotalPence, 0);
  const itemCount = displayBasket.reduce((s, i) => s + i.quantity, 0);

  const paidSoFar         = partialPayments.reduce((s, p) => s + p.amountPence, 0);
  const remainingPence    = total - paidSoFar;
  const perPersonPence    = splitPeople > 1 ? Math.ceil(remainingPence / splitPeople) : null;
  const numpadPence       = numpadValue ? Math.round(parseFloat(numpadValue) * 100) : (perPersonPence ?? remainingPence);
  const chargeAmountPence = Math.min(Math.max(numpadPence, 0), remainingPence);
  const activeTerminals   = useMemo(() => (terminals ?? []).filter(t => t.isActive), [terminals]);

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

  // ── Basket helpers ─────────────────────────────────────────────────────────

  async function addToBasket(product: Product) {
    if (activeTabId) {
      await addItemMut({
        tabId:          activeTabId,
        productId:      product._id,
        productName:    product.name,
        unitPricePence: product.pricePence,
        quantity:       1,
      });
    } else {
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
  }

  async function changeQty(productId: Id<"posProducts">, delta: number) {
    if (activeTabId && activeTab) {
      const idx = activeTab.items.findIndex(i => i.productId === productId);
      if (idx === -1) return;
      const newQty = activeTab.items[idx].quantity + delta;
      await updateItemMut({ tabId: activeTabId, itemIndex: idx, quantity: newQty });
    } else {
      setBasket(prev =>
        prev.map(i => i.productId === productId
          ? { ...i, quantity: i.quantity + delta, subtotalPence: (i.quantity + delta) * i.unitPricePence }
          : i
        ).filter(i => i.quantity > 0)
      );
    }
  }

  async function removeBasketItem(index: number) {
    if (activeTabId) {
      await removeItemMut({ tabId: activeTabId, itemIndex: index });
    } else {
      setBasket(prev => prev.filter((_, i) => i !== index));
    }
  }

  // ── Numpad ─────────────────────────────────────────────────────────────────

  function handleNumpad(key: string) {
    setNumpadValue(prev => applyNumpadKey(prev, key));
  }

  // ── Checkout ───────────────────────────────────────────────────────────────

  function startCheckout(method: string) {
    const amount = chargeAmountPence;
    setPendingAmount(amount);
    setPaymentMethod(method);
    if (method === "account") {
      setStage("memberSearch");
    } else {
      setSelectedMember(null);
      setStage("confirm");
    }
  }

  async function completeSale(payments: Array<{ method: string; amountPence: number }>) {
    if (!club) return;
    setSaving(true);
    const uniqueMethods = [...new Set(payments.map(p => p.method))];
    const effectiveMethod = uniqueMethods.length === 1 ? uniqueMethods[0] : "split";
    const splits = uniqueMethods.length > 1 ? payments : undefined;
    const accountPayment = payments.find(p => p.method === "account");
    try {
      if (activeTabId) {
        // TODO: when terminal integration is complete, fire /api/payments/terminal
        // here for card payments where selectedTerminalId is set, and wait for
        // payment confirmation before proceeding.
        await closeTabMut({
          tabId:                 activeTabId,
          paymentMethod:         effectiveMethod,
          currency,
          chargeAccountMemberId: accountPayment && selectedMember ? selectedMember._id : undefined,
          memberName:            selectedMember?.displayName,
          isGuest:               !selectedMember,
          kioskId:               kioskId ?? undefined,
          splits,
        });
        setLastTotal(total);
        setLastTabName(activeTab?.name ?? undefined);
        setActiveTabId(null);
      } else {
        // TODO: terminal API call stub — see tab path above
        await recordSale({
          clubId:                club._id,
          items:                 basket.map(i => ({
            ...i,
            productId: i.productId !== "custom" ? i.productId as Id<"posProducts"> : undefined,
          })),
          currency,
          paymentMethod:         effectiveMethod,
          chargeAccountMemberId: accountPayment && selectedMember ? selectedMember._id : undefined,
          memberId:              accountPayment && selectedMember ? selectedMember._id as unknown as string : undefined,
          memberName:            selectedMember?.displayName,
          shiftId:               openShift?._id,
          locationId:            kioskData?.locationId,
          isGuest:               !selectedMember,
          kioskId:               kioskId ?? undefined,
          splits,
        });
        setLastTotal(total);
        setLastTabName(undefined);
        setBasket([]);
      }
      setPartialPayments([]);
      setNumpadValue("");
      setShowNumpad(false);
      setSplitPeople(1);
      setSelectedMember(null);
      setSelectedTerminalId("");
      setStage("done");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Sale failed");
      setStage("grid");
    } finally {
      setSaving(false);
    }
  }

  async function confirmPartialCharge() {
    const newPayments = [...partialPayments, { method: paymentMethod, amountPence: pendingAmount }];
    const newRemaining = total - newPayments.reduce((s, p) => s + p.amountPence, 0);
    if (newRemaining <= 0) {
      await completeSale(newPayments);
    } else {
      setPartialPayments(newPayments);
      setNumpadValue("");
      setShowNumpad(false);
      if (splitPeople > 1) setSplitPeople(p => Math.max(1, p - 1));
      setStage("grid");
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

      {/* ── PIN pad overlay ───────────────────────────────────────────── */}
      {kioskId && (
        <PinPad
          kioskId={kioskId}
          visible={showPinPad}
          onUnlocked={handlePinVerified}
          onDismiss={() => {
            setShowPinPad(false);
            if (pinMode === "lock") exitFullscreen();
          }}
        />
      )}

      {/* ── Left: product grid ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900 shrink-0">
          <div className="flex items-center gap-4">
            {!isLocked && !managerUnlocked && (
              <Link
                href="/manage/pos"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors border border-gray-700"
              >
                <ArrowLeft size={13} /> Back
              </Link>
            )}
            <div>
              <p className="font-bold text-white text-lg">{club.name}</p>
              <p className="text-xs text-gray-500">
                {kioskData ? kioskData.name : "Point of Sale"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
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

            {kioskId && !isLocked && !managerUnlocked && (
              <button
                onClick={handleLockAndFullscreen}
                className="flex items-center gap-1.5 text-xs px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold transition-colors"
              >
                <Lock size={13} /> Lock &amp; Go Fullscreen
              </button>
            )}

            {!kioskId && (
              <button
                onClick={isFullscreen ? exitFullscreen : enterFullscreen}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors border border-gray-700"
              >
                {isFullscreen ? <Minimize size={12} /> : <Maximize size={12} />}
                {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              </button>
            )}

            {isLocked && !managerUnlocked && (
              <button
                onClick={handleManagerRequest}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 rounded-lg font-medium transition-colors border border-gray-700"
              >
                <Lock size={12} /> Manager
              </button>
            )}

            {managerUnlocked && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowShiftModal(true)}
                  className="text-xs px-3 py-1.5 bg-green-700 hover:bg-green-600 text-green-100 rounded-lg font-medium transition-colors"
                >
                  Shifts &amp; Reports
                </button>
                <button
                  onClick={isFullscreen ? exitFullscreen : enterFullscreen}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors border border-gray-700"
                >
                  {isFullscreen ? <Minimize size={12} /> : <Maximize size={12} />}
                  {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                </button>
                <button
                  onClick={handleRelock}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold transition-colors"
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
              {activeTabId
                ? <>Tab {itemCount > 0 && <span className="bg-white text-green-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">{itemCount}</span>}</>
                : <>Basket {itemCount > 0 && <span className="bg-white text-green-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">{itemCount}</span>}</>
              }
            </button>
          </div>
        </div>

        {/* ── Tab switcher bar ──────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-950 border-b border-gray-800 overflow-x-auto shrink-0 min-h-[48px]">
          {/* Quick sale chip */}
          <button
            onClick={() => setActiveTabId(null)}
            className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
              activeTabId === null
                ? "bg-white text-gray-900 border-white"
                : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500 hover:text-gray-200"
            }`}
          >
            Quick sale
            {activeTabId === null && basket.length > 0 && (
              <span className="w-5 h-5 bg-green-600 rounded-full text-[10px] flex items-center justify-center font-black text-white">
                {basket.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </button>

          {(openTabs ?? []).length > 0 && (
            <span className="text-gray-700 text-xs select-none shrink-0">|</span>
          )}

          {/* Per-tab chips */}
          {(openTabs ?? []).map(tab => (
            <div
              key={tab._id}
              role="button"
              onClick={() => setActiveTabId(tab._id)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all cursor-pointer ${
                activeTabId === tab._id
                  ? "bg-green-500 text-white border-green-500"
                  : "bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-500"
              }`}
            >
              {tab.name ?? "Tab"}
              {tab.items.length > 0 && (
                <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-black ${
                  activeTabId === tab._id ? "bg-white/25 text-white" : "bg-gray-700 text-gray-300"
                }`}>
                  {tab.items.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
              {activeTabId === tab._id && !isLocked && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setTabNameInput(tab.name ?? "");
                    setEditingTabName(true);
                  }}
                  className="ml-0.5 opacity-60 hover:opacity-100"
                  title="Rename tab"
                >
                  <Pencil size={11} />
                </button>
              )}
            </div>
          ))}

          {/* New tab button — hidden in locked mode */}
          {!isLocked && (
            <button
              onClick={() => setShowNewTabModal(true)}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-gray-500 border border-dashed border-gray-700 hover:border-gray-500 hover:text-gray-300 bg-transparent transition-all"
            >
              <Plus size={12} /> New tab
            </button>
          )}
        </div>

        {/* Rename tab inline bar */}
        {editingTabName && activeTabId && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 border-b border-gray-800 shrink-0">
            <input
              autoFocus
              value={tabNameInput}
              onChange={e => setTabNameInput(e.target.value)}
              onKeyDown={async e => {
                if (e.key === "Enter") {
                  await renameTabMut({ tabId: activeTabId, name: tabNameInput });
                  setEditingTabName(false);
                } else if (e.key === "Escape") {
                  setEditingTabName(false);
                }
              }}
              placeholder="Tab name…"
              className="flex-1 bg-gray-800 text-white text-sm border border-gray-700 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={async () => {
                await renameTabMut({ tabId: activeTabId, name: tabNameInput });
                setEditingTabName(false);
              }}
              className="text-sm px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl font-semibold"
            >
              Save
            </button>
            <button onClick={() => setEditingTabName(false)} className="text-gray-500 hover:text-gray-300">
              <X size={16} />
            </button>
          </div>
        )}

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
                const inBasket = displayBasket.find(i => i.productId === product._id)?.quantity ?? 0;
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
          <div className="min-w-0">
            <h2 className="font-bold text-white text-lg flex items-center gap-2">
              {activeTabId
                ? <span className="text-green-400 truncate max-w-[140px]">
                    {activeTab?.name ?? "Tab"}
                  </span>
                : "Basket"
              }
              {itemCount > 0 && (
                <span className="text-sm bg-green-600/30 text-green-400 px-2 py-0.5 rounded-full font-bold shrink-0">
                  {itemCount}
                </span>
              )}
            </h2>
            {activeTabId && (
              <p className="text-[11px] text-gray-600 mt-0.5">Open tab</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!activeTabId && basket.length > 0 && (
              <button
                onClick={() => setBasket([])}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-gray-800"
              >
                Clear
              </button>
            )}
            {activeTabId && !isLocked && (
              <button
                onClick={async () => {
                  if (!confirm("Void this tab? All items will be discarded.")) return;
                  await voidTabMut({ tabId: activeTabId, kioskId: kioskId ?? undefined });
                  setActiveTabId(null);
                }}
                className="text-xs text-red-500 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-gray-800"
              >
                Void
              </button>
            )}
            <button onClick={() => setShowBasket(false)} className="lg:hidden text-gray-500 hover:text-white p-1">
              <ChevronLeft size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable body: basket items + checkout */}
        <div className="flex-1 overflow-y-auto">

          {/* Basket items */}
          <div className="px-4 py-3 space-y-2">
            {displayBasket.length === 0 ? (
              <p className="text-gray-600 text-sm text-center pt-10">
                {activeTabId ? "Tab is empty — tap a product" : "Tap a product to add it"}
              </p>
            ) : (
              displayBasket.map((item, idx) => (
                <div key={`${item.productId}-${idx}`} className="flex flex-col gap-1 bg-gray-800 rounded-xl px-4 py-3">
                  <p className="font-semibold text-white text-sm leading-snug">{item.productName}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-500 flex-1">{formatCurrency(item.unitPricePence, currency)} each</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => item.productId !== "custom" && changeQty(item.productId, -1)} className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 active:bg-gray-500 flex items-center justify-center text-white font-bold transition-colors text-lg">−</button>
                      <span className="text-white font-bold w-5 text-center">{item.quantity}</span>
                      <button onClick={() => item.productId !== "custom" && changeQty(item.productId, 1)} className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 active:bg-gray-500 flex items-center justify-center text-white font-bold transition-colors text-lg">+</button>
                    </div>
                    <span className="text-white font-bold text-sm w-14 text-right shrink-0">{formatCurrency(item.subtotalPence, currency)}</span>
                    <button onClick={() => removeBasketItem(idx)} className="text-gray-600 hover:text-red-400 transition-colors ml-1"><X size={14} /></button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Payment */}
          {displayBasket.length > 0 && (
            <div className="border-t border-gray-800 px-4 pt-4 pb-5 space-y-3">

              {/* Payment history */}
              {partialPayments.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Payment history</p>
                  {partialPayments.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400 flex-1 capitalize">{p.method}</span>
                      <span className="font-semibold text-blue-400">{formatCurrency(p.amountPence, currency)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Remaining balance */}
              <div className={`rounded-2xl px-4 py-3 text-center ${partialPayments.length > 0 ? "bg-green-900/40" : "bg-gray-800"}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">
                  {partialPayments.length > 0 ? "Remaining Balance" : "Order Total"}
                </p>
                <p className="text-3xl font-black text-white">{formatCurrency(remainingPence, currency)}</p>
              </div>

              {/* Equal split */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Split equally</span>
                <button onClick={() => setSplitPeople(p => Math.max(1, p - 1))} className="w-7 h-7 rounded-full bg-gray-700 text-white flex items-center justify-center font-bold hover:bg-gray-600">−</button>
                <span className="text-sm font-semibold text-white w-4 text-center">{splitPeople}</span>
                <button onClick={() => setSplitPeople(p => p + 1)} className="w-7 h-7 rounded-full bg-gray-700 text-white flex items-center justify-center font-bold hover:bg-gray-600">+</button>
                {splitPeople > 1 && perPersonPence && (
                  <span className="text-xs text-green-400 font-semibold ml-1">{formatCurrency(perPersonPence, currency)} each</span>
                )}
              </div>

              {/* Method buttons */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "cash",          label: "Cash",    cls: "bg-amber-600 hover:bg-amber-500" },
                  { id: "card",          label: "Card",    cls: "bg-blue-600  hover:bg-blue-500"  },
                  { id: "account",       label: "Account", cls: "bg-purple-600 hover:bg-purple-500" },
                  { id: "complimentary", label: "Comp",    cls: "bg-gray-700  hover:bg-gray-600"  },
                ].map(m => {
                  const terminalName = m.id === "card" && selectedTerminalId
                    ? activeTerminals.find(t => t.terminalId === selectedTerminalId)?.name
                    : undefined;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        if (m.id === "card" && activeTerminals.length > 0) {
                          setShowTerminalPicker(true);
                        } else {
                          startCheckout(m.id);
                        }
                      }}
                      disabled={chargeAmountPence <= 0}
                      className={`py-3 ${m.cls} disabled:opacity-30 rounded-2xl font-bold text-white text-sm transition-colors active:scale-95`}
                    >
                      {terminalName
                        ? <span className="flex items-center justify-center gap-1">{terminalName} <ChevronDown size={12} /></span>
                        : m.label}
                    </button>
                  );
                })}
              </div>

              {/* Numpad display */}
              <button
                onClick={() => setShowNumpad(s => !s)}
                className="w-full bg-gray-800 hover:bg-gray-750 rounded-xl px-4 py-2 flex items-center justify-between transition-colors border border-gray-700"
              >
                <span className="text-xs text-gray-500">{showNumpad ? "hide keypad" : "tap to enter amount"}</span>
                <span className={`text-xl font-black ${numpadValue ? "text-white" : "text-gray-500"}`}>
                  {numpadValue ? `£${numpadValue}` : formatCurrency(chargeAmountPence, currency)}
                </span>
              </button>
              <button
                onClick={() => setNumpadValue("")}
                className={`text-xs px-1 transition-colors ${numpadValue ? "text-gray-500 hover:text-gray-300" : "invisible pointer-events-none"}`}
              >
                clear entry
              </button>

              {/* Numpad grid */}
              {showNumpad && (
                <div className="grid grid-cols-3 gap-1.5">
                  {["7","8","9","4","5","6","1","2","3",".","0","⌫"].map(key => (
                    <button
                      key={key}
                      onClick={() => handleNumpad(key)}
                      className="h-12 bg-gray-800 border border-gray-700 rounded-xl text-white font-semibold text-lg hover:bg-gray-700 active:bg-gray-600 transition-colors"
                    >
                      {key}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>{/* end scrollable body */}
      </div>

      {/* ── Shift modal ────────────────────────────────────────────── */}
      {showShiftModal && club && kioskId && kioskData?.locationId && (
        <KioskShiftModal
          clubId={club._id}
          locationId={kioskData.locationId}
          locationName={kioskData.name}
          currency={currency}
          kioskId={kioskId}
          onClose={() => setShowShiftModal(false)}
        />
      )}

      {/* ── Overlays ───────────────────────────────────────────────── */}

      {stage === "memberSearch" && (
        <MemberSearchOverlay
          clubId={club._id}
          currency={currency}
          total={pendingAmount}
          onSelect={member => { setSelectedMember(member); setStage("confirm"); }}
          onClose={() => setStage("grid")}
        />
      )}

      {stage === "confirm" && (
        <ConfirmOverlay
          method={paymentMethod as "cash" | "card" | "account"}
          total={pendingAmount}
          currency={currency}
          member={selectedMember}
          onConfirm={confirmPartialCharge}
          onCancel={() => setStage("grid")}
          saving={saving}
        />
      )}

      {stage === "done" && (
        <SaleCompleteOverlay
          total={lastTotal}
          currency={currency}
          member={selectedMember}
          tabName={lastTabName}
          onDismiss={() => { setStage("grid"); setSelectedMember(null); }}
        />
      )}

      {showTerminalPicker && (
        <TerminalPickerModal
          terminals={activeTerminals}
          selected={selectedTerminalId}
          onSelect={id => { setSelectedTerminalId(id); setPaymentMethod("card"); }}
          onClose={() => setShowTerminalPicker(false)}
          theme="dark"
        />
      )}

      {/* ── New tab modal ───────────────────────────────────────────── */}
      {showNewTabModal && club && (
        <NewTabModal
          onOpen={async (name) => {
            const tabId = await openTabMut({
              clubId:     club._id,
              locationId: kioskData?.locationId,
              shiftId:    openShift?._id,
              name:       name.trim() || undefined,
              kioskId:    kioskId ?? undefined,
            });
            setActiveTabId(tabId as Id<"posTabs">);
            setShowNewTabModal(false);
          }}
          onClose={() => setShowNewTabModal(false)}
        />
      )}
    </div>
  );
}

// useSearchParams() requires a Suspense boundary in Next.js App Router
export default function KioskPOSPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-10 w-10 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    }>
      <KioskPOS />
    </Suspense>
  );
}
