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
  PenLine, MapPin, Maximize2, ArrowLeft, Pencil, ChevronDown,
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
  { id: "cash",          label: "Cash",    icon: Banknote,   colour: "bg-amber-50  border-amber-200  text-amber-800"  },
  { id: "card",          label: "Card",    icon: CreditCard, colour: "bg-blue-50   border-blue-200   text-blue-800"   },
  { id: "account",       label: "Account", icon: User,       colour: "bg-purple-50 border-purple-200 text-purple-800" },
  { id: "complimentary", label: "Comp",    icon: Gift,       colour: "bg-gray-50   border-gray-200   text-gray-600"   },
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
        <p className="text-4xl font-black tracking-tight">
          {formatCurrency(sale.total, currency)}
        </p>
        <p className="text-green-200 text-sm font-medium">
          {methodLabel}
          {sale.memberName ? ` · ${sale.memberName}` : ""}
        </p>
        <p className="text-green-300 text-xs mt-2">Tap to dismiss</p>
      </div>
    </div>
  );
}

// ── New tab modal ─────────────────────────────────────────────────────────────

function NewTabModal({
  onOpen,
  onClose,
}: {
  onOpen: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white w-full sm:max-w-xs rounded-t-2xl sm:rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">New tab</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <input
          ref={nameRef}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onOpen(name)}
          placeholder="Tab name — Table 4, Jamie… (optional)"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onOpen(name)}
            className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-colors"
          >
            Open tab
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main POS ──────────────────────────────────────────────────────────────────

export default function POSPage() {
  const { club, activeMembership } = useActiveClub();
  const superAdmin = useQuery(api.clubs.isSuperAdmin);
  const isAdmin =
    activeMembership?.role === "admin" ||
    activeMembership?.role === "manager" ||
    superAdmin === true;

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

  // ── Open tabs ───────────────────────────────────────────────────────────────
  const openTabMut    = useMutation(api.posTabs.openTab);
  const addItemMut    = useMutation(api.posTabs.addItem);
  const updateItemMut = useMutation(api.posTabs.updateItem);
  const removeItemMut = useMutation(api.posTabs.removeItem);
  const closeTabMut   = useMutation(api.posTabs.closeTab);
  const voidTabMut    = useMutation(api.posTabs.voidTab);
  const renameTabMut  = useMutation(api.posTabs.renameTab);

  const openTabs = useQuery(
    api.posTabs.listOpenTabs,
    club ? { clubId: club._id, ...(selectedLocationId ? { locationId: selectedLocationId } : {}) } : "skip"
  );
  const [activeTabId, setActiveTabId] = useState<Id<"posTabs"> | null>(null);
  const [showNewTabModal, setShowNewTabModal] = useState(false);
  const [editingTabName, setEditingTabName] = useState(false);
  const [tabNameInput, setTabNameInput] = useState("");

  const activeTab = useQuery(
    api.posTabs.getTab,
    activeTabId ? { tabId: activeTabId } : "skip"
  );

  // Category + product filter
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  // Basket (quick sale mode — local state)
  const [basket, setBasket] = useState<BasketItem[]>([]);

  // Derived basket — in tab mode, items come from Convex; in quick sale mode, from local state
  const displayBasket: BasketItem[] = activeTabId && activeTab
    ? activeTab.items.map(i => ({
        productId:      (i.productId ?? "custom") as Id<"posProducts"> | "custom",
        productName:    i.productName,
        quantity:       i.quantity,
        unitPricePence: i.unitPricePence,
        subtotalPence:  i.subtotalPence,
      }))
    : basket;
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [selectedTerminalId, setSelectedTerminalId] = useState<string>("");
  const [showTerminalPicker, setShowTerminalPicker] = useState(false);

  // Partial payments (cash/card/etc collected so far for this sale)
  const [partialPayments, setPartialPayments] = useState<Array<{ method: string; amountPence: number }>>([]);

  // Numpad — "" means "use remaining balance"
  const [numpadValue, setNumpadValue] = useState("");
  const [showNumpad, setShowNumpad] = useState(false);

  // Equal split
  const [splitPeople, setSplitPeople] = useState(1);

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

  const total = displayBasket.reduce((s, i) => s + i.subtotalPence, 0);
  const currency = club?.currency ?? "GBP";
  const itemCount = displayBasket.reduce((s, i) => s + i.quantity, 0);

  // Partial payment derived values
  const paidSoFar    = partialPayments.reduce((s, p) => s + p.amountPence, 0);
  const remainingPence = total - paidSoFar;
  const perPersonPence = splitPeople > 1 ? Math.ceil(remainingPence / splitPeople) : null;
  const numpadPence    = numpadValue ? Math.round(parseFloat(numpadValue) * 100) : (perPersonPence ?? remainingPence);
  const chargeAmountPence = Math.min(Math.max(numpadPence, 0), remainingPence);

  // ── Category tabs ──────────────────────────────────────────────────────────

  const hasUncategorised = (products ?? []).some(p => !p.categoryId);
  const catTabs = useMemo(() => [
    { id: null,             label: "All",   icon: "⊞"  },
    ...(categories ?? []).sort((a, b) => a.sortOrder - b.sortOrder)
      .map(c => ({ id: c._id as string, label: c.name, icon: c.icon ?? "●" })),
    ...(hasUncategorised ? [{ id: "uncategorised", label: "Other", icon: "…" }] : []),
  ], [categories, hasUncategorised]);

  // ── Basket helpers ─────────────────────────────────────────────────────────

  async function addToBasket(item: { id: Id<"posProducts"> | "custom"; name: string; pricePence: number }) {
    if (activeTabId) {
      await addItemMut({
        tabId:          activeTabId,
        productId:      item.id !== "custom" ? item.id as Id<"posProducts"> : undefined,
        productName:    item.name,
        unitPricePence: item.pricePence,
        quantity:       1,
      });
    } else {
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
  }

  async function changeQty(productId: Id<"posProducts"> | "custom", delta: number, unique?: boolean) {
    if (activeTabId && activeTab) {
      // Find index in the Convex tab items
      const items = activeTab.items;
      let idx: number;
      if (unique) {
        idx = items.reduce((found, item, i) =>
          (item.productId ?? "custom") === productId ? i : found, -1);
      } else {
        idx = items.findIndex(i => (i.productId ?? "custom") === productId);
      }
      if (idx === -1) return;
      const newQty = items[idx].quantity + delta;
      await updateItemMut({ tabId: activeTabId, itemIndex: idx, quantity: newQty });
    } else {
      setBasket(prev => {
        if (unique) {
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
  }

  async function removeItem(index: number) {
    if (activeTabId) {
      await removeItemMut({ tabId: activeTabId, itemIndex: index });
    } else {
      setBasket(prev => prev.filter((_, i) => i !== index));
    }
  }

  function clearAll() {
    setBasket([]);
    setNote("");
    setShowNote(false);
    setSelectedMemberId(null);
    setMemberSearch("");
    setSaleDone(null);
    setPartialPayments([]);
    setNumpadValue("");
    setShowNumpad(false);
    setSplitPeople(1);
  }

  // ── Numpad ─────────────────────────────────────────────────────────────────

  function handleNumpad(key: string) {
    setNumpadValue(prev => {
      if (key === "⌫") return prev.slice(0, -1);
      if (key === ".") {
        if (prev.includes(".")) return prev;
        return (prev || "0") + ".";
      }
      // Max 2 decimal places
      const dot = prev.indexOf(".");
      if (dot !== -1 && prev.length - dot > 2) return prev;
      // No leading zeros before decimal
      if (prev === "0") return key;
      return prev + key;
    });
  }

  // ── Complete sale (all payments collected) ─────────────────────────────────

  async function completeSale(payments: Array<{ method: string; amountPence: number }>) {
    if (!club) return;
    const uniqueMethods = [...new Set(payments.map(p => p.method))];
    const effectiveMethod = uniqueMethods.length === 1 ? uniqueMethods[0] : "split";
    const splits = uniqueMethods.length > 1 ? payments : undefined;
    const accountPayment = payments.find(p => p.method === "account");

    setSaving(true);
    setError(null);
    try {
      if (activeTabId) {
        // TODO: when terminal integration is complete, fire /api/payments/terminal
        // here for card payments where selectedTerminalId is set, and wait for
        // payment confirmation before proceeding.
        await closeTabMut({
          tabId: activeTabId,
          paymentMethod: effectiveMethod,
          currency,
          chargeAccountMemberId: accountPayment ? selectedMemberId! : undefined,
          memberId:  selectedMember?.userId,
          memberName: selectedMember?.displayName,
          notes: note || undefined,
          isGuest: !selectedMember,
          splits,
        });
        setActiveTabId(null);
      } else {
        const items = basket.map(i => ({
          productId:      i.productId !== "custom" ? i.productId as Id<"posProducts"> : undefined,
          productName:    i.productName,
          quantity:       i.quantity,
          unitPricePence: i.unitPricePence,
          subtotalPence:  i.subtotalPence,
        }));
        // TODO: terminal API call stub — see tab path above
        await recordSale({
          clubId: club._id,
          memberId:              selectedMember?.userId,
          memberName:            selectedMember?.displayName,
          chargeAccountMemberId: accountPayment ? selectedMemberId! : undefined,
          items,
          currency,
          paymentMethod: effectiveMethod,
          splits,
          notes: note || undefined,
          shiftId:    openShift?._id,
          locationId: selectedLocationId ?? undefined,
          isGuest:    !selectedMember,
        });
      }
      setSaleDone({ total, method: effectiveMethod, memberName: selectedMember?.displayName });
      setBasket([]);
      setNote("");
      setShowNote(false);
      setSelectedMemberId(null);
      setMemberSearch("");
      setPartialPayments([]);
      setNumpadValue("");
      setSplitPeople(1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  // ── Partial charge ──────────────────────────────────────────────────────────

  async function handlePartialCharge() {
    if (!club || displayBasket.length === 0 || saving) return;
    if (chargeAmountPence <= 0) return;

    if (paymentMethod === "account" && !selectedMemberId) { setError("Select a member to charge their account"); return; }

    const newPayment = { method: paymentMethod, amountPence: chargeAmountPence };
    const newPayments = [...partialPayments, newPayment];
    const newRemaining = total - newPayments.reduce((s, p) => s + p.amountPence, 0);

    if (newRemaining <= 0) {
      await completeSale(newPayments);
    } else {
      setPartialPayments(newPayments);
      setNumpadValue("");
      setShowNumpad(false);
      if (splitPeople > 1) setSplitPeople(p => Math.max(1, p - 1));
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
            {isAdmin && (
              <Link
                href="/manage/pos"
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors mr-1"
                title="Back to dashboard"
              >
                <ArrowLeft size={12} /> Dashboard
              </Link>
            )}
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

        {/* ── Tab switcher bar ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 overflow-x-auto shrink-0 min-h-[44px]">
          {/* Quick sale chip */}
          <button
            onClick={() => setActiveTabId(null)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              activeTabId === null
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-500 border-gray-300 hover:border-gray-400"
            }`}
          >
            Quick sale
            {activeTabId === null && basket.length > 0 && (
              <span className="w-4 h-4 bg-white/20 rounded-full text-[9px] flex items-center justify-center font-black">
                {basket.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </button>

          {(openTabs ?? []).length > 0 && (
            <span className="text-gray-300 text-xs select-none shrink-0">|</span>
          )}

          {/* One chip per open tab */}
          {(openTabs ?? []).map(tab => (
            <div
              key={tab._id}
              role="button"
              onClick={() => setActiveTabId(tab._id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                activeTabId === tab._id
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
              }`}
            >
              {tab.name ?? "Tab"}
              {tab.items.length > 0 && (
                <span className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-black ${
                  activeTabId === tab._id ? "bg-white/20 text-white" : "bg-gray-200 text-gray-700"
                }`}>
                  {tab.items.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
              {activeTabId === tab._id && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setTabNameInput(tab.name ?? "");
                    setEditingTabName(true);
                  }}
                  className="ml-0.5 opacity-60 hover:opacity-100"
                  title="Rename tab"
                >
                  <Pencil size={10} />
                </button>
              )}
            </div>
          ))}

          {/* New tab button */}
          <button
            onClick={() => setShowNewTabModal(true)}
            className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-gray-500 border border-dashed border-gray-300 hover:border-gray-400 hover:text-gray-700 bg-white transition-all"
          >
            <Plus size={11} /> New tab
          </button>
        </div>

        {/* Rename tab inline modal */}
        {editingTabName && activeTabId && (
          <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 shrink-0">
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
              className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <button
              onClick={async () => {
                await renameTabMut({ tabId: activeTabId, name: tabNameInput });
                setEditingTabName(false);
              }}
              className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg font-medium"
            >
              Save
            </button>
            <button onClick={() => setEditingTabName(false)} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>
        )}

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
                const inBasket = displayBasket.find(i => i.productId === product._id);
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
      <div className="w-80 shrink-0 flex flex-col bg-white border-l border-gray-200 relative min-w-0">

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

        {/* ── Customer chip — sticky at top ── */}
        <div className="shrink-0 px-4 pt-4 pb-2 border-b border-gray-100">
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

        {/* ── Scrollable body: basket + checkout ── */}
        <div className="flex-1 overflow-y-auto">

        {/* Basket items */}
        <div>
          {displayBasket.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-300 text-sm">
                {activeTabId ? "Tab is empty — add items" : "Add items from the left"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {displayBasket.map((item, idx) => (
                <div key={`${item.productId}-${idx}`} className="flex flex-col gap-1 px-4 py-3">
                  <p className="text-sm font-medium text-gray-900 leading-snug">{item.productName}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-400 flex-1">{formatCurrency(item.unitPricePence, currency)} each</p>
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
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Note toggle ── */}
        {displayBasket.length > 0 && (
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
        {displayBasket.length > 0 && (
        <div className="border-t border-gray-100">

          {/* Payment history */}
          {partialPayments.length > 0 && (
            <div className="px-4 pt-3 pb-1 space-y-1.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Payment history</p>
              {partialPayments.map((p, i) => {
                const m = PAYMENT_METHODS.find(x => x.id === p.method);
                const Icon = m?.icon ?? Banknote;
                return (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Icon size={13} className="text-blue-500 shrink-0" />
                    <span className="text-gray-600 flex-1">{m?.label ?? p.method}</span>
                    <span className="font-semibold text-blue-600">{formatCurrency(p.amountPence, currency)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Remaining balance */}
          <div className={`mx-4 my-2 rounded-2xl px-4 py-3 text-center ${partialPayments.length > 0 ? "bg-green-50" : "bg-gray-50"}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">
              {partialPayments.length > 0 ? "Remaining Balance" : "Order Total"}
            </p>
            <p className="text-3xl font-black text-gray-900 tracking-tight">
              {formatCurrency(remainingPence, currency)}
            </p>
          </div>

          {/* Split equally */}
          <div className="px-4 pb-2 flex items-center gap-2">
            <span className="text-xs text-gray-400">Split equally</span>
            <button onClick={() => setSplitPeople(p => Math.max(1, p - 1))} className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-sm font-bold hover:bg-gray-200">−</button>
            <span className="text-sm font-semibold w-4 text-center">{splitPeople}</span>
            <button onClick={() => setSplitPeople(p => p + 1)} className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-sm font-bold hover:bg-gray-200">+</button>
            {splitPeople > 1 && perPersonPence && (
              <span className="text-xs text-green-600 font-semibold ml-1">{formatCurrency(perPersonPence, currency)} each</span>
            )}
          </div>

          {/* Method selector */}
          <div className="px-4 pb-2 flex gap-1.5">
            {PAYMENT_METHODS.map(m => {
              const Icon = m.icon;
              const active = paymentMethod === m.id;
              const terminalName = m.id === "card" && selectedTerminalId
                ? activeTerminals.find(t => t.terminalId === selectedTerminalId)?.name
                : undefined;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setPaymentMethod(m.id);
                    if (m.id === "card" && activeTerminals.length > 0) setShowTerminalPicker(true);
                  }}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl border-2 text-[10px] font-bold transition-all active:scale-95 ${
                    active ? `${m.colour} border-current` : "border-gray-200 text-gray-500 bg-white hover:border-gray-300"
                  }`}
                >
                  <Icon size={15} />
                  {terminalName && active
                    ? <span className="flex items-center gap-0.5">{terminalName} <ChevronDown size={9} /></span>
                    : m.label}
                </button>
              );
            })}
          </div>

          {/* Numpad display — tap to reveal/hide numpad */}
          <div className="px-4 pb-1">
            <button
              onClick={() => { setShowNumpad(s => !s); }}
              className="w-full bg-gray-50 hover:bg-gray-100 rounded-xl px-4 py-2 flex items-center justify-between transition-colors"
            >
              <span className="text-xs text-gray-400">{showNumpad ? "hide keypad" : "tap to enter amount"}</span>
              <span className={`text-2xl font-black ${numpadValue ? "text-gray-900" : "text-gray-400"}`}>
                {numpadValue ? `£${numpadValue}` : formatCurrency(chargeAmountPence, currency)}
              </span>
            </button>
            <button
              onClick={() => setNumpadValue("")}
              className={`text-xs px-1 mt-1 transition-colors ${numpadValue ? "text-gray-400 hover:text-gray-600" : "invisible pointer-events-none"}`}
            >
              clear entry
            </button>
          </div>

          {/* Numpad grid — only when open */}
          {showNumpad && (
            <div className="px-4 pb-3 grid grid-cols-3 gap-1.5">
              {["7","8","9","4","5","6","1","2","3",".","0","⌫"].map(key => (
                <button
                  key={key}
                  onClick={() => handleNumpad(key)}
                  className="h-11 bg-white border border-gray-200 rounded-xl text-gray-800 font-semibold text-lg hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  {key}
                </button>
              ))}
            </div>
          )}

          {/* Charge + void/clear */}
          <div className="px-4 pb-4 space-y-2">
            <button
              onClick={handlePartialCharge}
              disabled={saving || chargeAmountPence <= 0 || (paymentMethod === "account" && !selectedMemberId)}
              className="w-full py-4 font-black text-lg rounded-2xl transition-all active:scale-[0.98] disabled:opacity-40 text-white bg-green-600 hover:bg-green-500 shadow-lg shadow-green-200"
            >
              {saving ? "Processing…"
                : paymentMethod === "account" && !selectedMemberId ? "Select member →"
                : `Charge ${formatCurrency(chargeAmountPence, currency)}`}
            </button>

            {activeTabId ? (
              <button
                onClick={async () => {
                  if (!confirm("Void this tab? All items will be discarded.")) return;
                  await voidTabMut({ tabId: activeTabId });
                  setActiveTabId(null); setNote(""); setShowNote(false);
                  setSelectedMemberId(null); setMemberSearch("");
                  setPartialPayments([]); setNumpadValue(""); setSplitPeople(1);
                }}
                className="w-full py-1.5 text-xs text-red-400 hover:text-red-600 transition-colors"
              >Void tab</button>
            ) : (
              <button
                onClick={() => { if (confirm("Clear basket?")) clearAll(); }}
                className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >Clear basket</button>
            )}
          </div>
        </div>
        )}

        {/* end scrollable body */}
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {showNewTabModal && (
        <NewTabModal
          onOpen={async (name) => {
            if (!club) return;
            const tabId = await openTabMut({
              clubId:     club._id,
              locationId: selectedLocationId ?? undefined,
              shiftId:    openShift?._id,
              name:       name.trim() || undefined,
            });
            setActiveTabId(tabId as Id<"posTabs">);
            setShowNewTabModal(false);
          }}
          onClose={() => setShowNewTabModal(false)}
        />
      )}

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
          onSelect={id => { setSelectedTerminalId(id); setPaymentMethod("card"); }}
          onClose={() => setShowTerminalPicker(false)}
        />
      )}
    </div>
  );
}
