"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "convex/_generated/api";
import { useActiveClub } from "@/lib/club-context";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clubMembersApi = api.clubMembers as any;
import type { Id } from "convex/_generated/dataModel";
import { Pencil, Check, X, Search, MessageSquare, Edit2, Phone, Mail, User, Tag, Plus, Trash2, ChevronDown, Wallet, ArrowUpCircle } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { AIAssistant } from "@/components/AIAssistant";
import type { CapabilityId } from "@/lib/ai-capabilities";

type Category = {
  _id: Id<"membershipCategories">;
  name: string;
  colour: string;
  advanceBookingDays?: number;
  canBookWeekends?: boolean;
  bookingStartTime?: string;
  competitionEligible?: boolean;
};

const COLOURS = ["green", "blue", "amber", "purple", "gray", "red"] as const;
type Colour = typeof COLOURS[number];

function categoryColourClasses(colour: string) {
  const map: Record<string, string> = {
    green: "bg-green-100 text-green-700",
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    purple: "bg-purple-100 text-purple-700",
    gray: "bg-gray-100 text-gray-600",
    red: "bg-red-100 text-red-600",
  };
  return map[colour] ?? map.gray;
}

function CategoryBadge({ name, colour }: { name: string; colour: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${categoryColourClasses(colour)}`}>
      <Tag size={9} /> {name}
    </span>
  );
}

function CategoryManager({ clubId, categories }: { clubId: Id<"clubs">; categories: Category[] }) {
  const createCategory = useMutation(api.membershipCategories.create);
  const updateCategory = useMutation(api.membershipCategories.update);
  const removeCategory = useMutation(api.membershipCategories.remove);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<Id<"membershipCategories"> | null>(null);
  const [form, setForm] = useState({ name: "", colour: "green" as Colour, advanceBookingDays: "", canBookWeekends: true, bookingStartTime: "", competitionEligible: true });
  const [saving, setSaving] = useState(false);

  function startNew() {
    setForm({ name: "", colour: "green", advanceBookingDays: "", canBookWeekends: true, bookingStartTime: "", competitionEligible: true });
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(cat: Category) {
    setForm({
      name: cat.name,
      colour: cat.colour as Colour,
      advanceBookingDays: cat.advanceBookingDays?.toString() ?? "",
      canBookWeekends: cat.canBookWeekends !== false,
      bookingStartTime: cat.bookingStartTime ?? "",
      competitionEligible: cat.competitionEligible !== false,
    });
    setEditingId(cat._id);
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        colour: form.colour,
        advanceBookingDays: form.advanceBookingDays ? parseInt(form.advanceBookingDays) : undefined,
        canBookWeekends: form.canBookWeekends,
        bookingStartTime: form.bookingStartTime || undefined,
        competitionEligible: form.competitionEligible,
      };
      if (editingId) {
        await updateCategory({ categoryId: editingId, ...payload });
      } else {
        await createCategory({ clubId, ...payload, sortOrder: categories.length });
      }
      setShowForm(false); setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button key={cat._id} onClick={() => startEdit(cat)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border hover:opacity-80 transition-opacity ${categoryColourClasses(cat.colour)}`}>
              {cat.name}
              {cat.canBookWeekends === false && <span className="opacity-60">· weekday</span>}
              {cat.advanceBookingDays && <span className="opacity-60">· {cat.advanceBookingDays}d</span>}
            </button>
          ))}
          {categories.length === 0 && <p className="text-xs text-gray-400">No categories yet</p>}
        </div>
        <button onClick={startNew} className="flex items-center gap-1 text-xs text-green-700 font-medium hover:underline shrink-0 ml-3">
          <Plus size={13} /> New
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">{editingId ? "Edit category" : "New category"}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Full Member"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Colour</label>
              <div className="flex gap-1.5 flex-wrap">
                {COLOURS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, colour: c }))}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${form.colour === c ? "border-gray-900 scale-110" : "border-transparent"} ${categoryColourClasses(c).split(" ")[0]}`} />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Advance booking (days)</label>
              <input type="number" value={form.advanceBookingDays} onChange={e => setForm(f => ({ ...f, advanceBookingDays: e.target.value }))}
                placeholder="Leave blank to use club default" min={1} max={60}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Earliest tee time</label>
              <input type="time" value={form.bookingStartTime} onChange={e => setForm(f => ({ ...f, bookingStartTime: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.canBookWeekends} onChange={e => setForm(f => ({ ...f, canBookWeekends: e.target.checked }))}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
              <span className="text-xs text-gray-700">Can book weekends</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.competitionEligible} onChange={e => setForm(f => ({ ...f, competitionEligible: e.target.checked }))}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
              <span className="text-xs text-gray-700">Competition eligible</span>
            </label>
          </div>
          <div className="flex items-center gap-2 justify-between">
            {editingId && (
              <button onClick={async () => { if (confirm("Delete this category?")) { await removeCategory({ categoryId: editingId }); setShowForm(false); setEditingId(null); } }}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                <Trash2 size={12} /> Delete
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()}
                className="px-4 py-1.5 text-sm bg-green-700 text-white font-medium rounded-lg hover:bg-green-600 disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type Member = {
  _id: Id<"clubMembers">;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role: string;
  handicap?: number;
  membershipCategory?: string;
  membershipCategoryId?: Id<"membershipCategories">;
  clubRoles?: string[];
  accountBalance?: number;
  bio?: string;
  phone?: string;
  email?: string;
  showPhone?: boolean;
  showEmail?: boolean;
  directoryVisible?: boolean;
  joinedAt: string;
};

// Predefined club roles — cosmetic titles separate from system access roles
const CLUB_ROLES: { value: string; label: string; colour: string }[] = [
  { value: "captain",               label: "Club Captain",          colour: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  { value: "vice_captain",          label: "Vice Captain",          colour: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { value: "secretary",             label: "Secretary",             colour: "bg-blue-100 text-blue-800 border-blue-300" },
  { value: "treasurer",             label: "Treasurer",             colour: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { value: "committee",             label: "Committee",             colour: "bg-purple-100 text-purple-800 border-purple-300" },
  { value: "competition_secretary", label: "Competition Secretary", colour: "bg-orange-100 text-orange-800 border-orange-300" },
  { value: "junior_organiser",      label: "Junior Organiser",      colour: "bg-sky-100 text-sky-800 border-sky-300" },
  { value: "professional",          label: "Club Professional",     colour: "bg-gray-100 text-gray-800 border-gray-300" },
  { value: "team_captain",          label: "Team Captain",          colour: "bg-green-100 text-green-800 border-green-300" },
];

function ClubRoleBadge({ value }: { value: string }) {
  const def = CLUB_ROLES.find(r => r.value === value);
  if (!def) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-gray-100 text-gray-700 border-gray-300">{value}</span>;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${def.colour}`}>
      {def.label}
    </span>
  );
}

function ClubRolePicker({
  current,
  onChange,
}: {
  current: string[];
  onChange: (roles: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  function toggle(value: string) {
    const next = current.includes(value)
      ? current.filter(r => r !== value)
      : [...current, value];
    onChange(next);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-2 py-0.5 transition-colors"
      >
        <Tag size={10} />
        Roles
        <ChevronDown size={10} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-2 min-w-[200px] space-y-0.5">
          {CLUB_ROLES.map(r => (
            <button
              key={r.value}
              onClick={() => toggle(r.value)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${
                current.includes(r.value) ? "bg-green-50 text-green-800" : "hover:bg-gray-50 text-gray-700"
              }`}
            >
              {r.label}
              {current.includes(r.value) && <Check size={11} className="text-green-600 shrink-0" />}
            </button>
          ))}
          {current.length > 0 && (
            <>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={() => onChange([])}
                className="w-full text-left px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg"
              >
                Clear all roles
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Avatar({ member, size = "md" }: { member: Pick<Member, "displayName" | "avatarUrl">; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "w-9 h-9 text-sm" : size === "lg" ? "w-14 h-14 text-xl" : "w-12 h-12 text-base";
  if (member.avatarUrl) {
    return <img src={member.avatarUrl} alt="" className={`${sz} rounded-full object-cover shrink-0`} />;
  }
  return (
    <div className={`${sz} rounded-full bg-green-100 flex items-center justify-center font-semibold text-green-700 shrink-0`}>
      {member.displayName[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function EditProfileModal({ member, clubId, onClose }: { member: Member; clubId: Id<"clubs">; onClose: () => void }) {
  const updateProfile = useMutation(api.clubMembers.updateProfile);
  const [form, setForm] = useState({
    phone: member.phone ?? "",
    email: member.email ?? "",
    bio: member.bio ?? "",
    directoryVisible: member.directoryVisible !== false,
    showPhone: member.showPhone ?? false,
    showEmail: member.showEmail ?? false,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateProfile({
        clubId,
        userId: member.userId,
        phone: form.phone || undefined,
        email: form.email || undefined,
        bio: form.bio || undefined,
        directoryVisible: form.directoryVisible,
        showPhone: form.showPhone,
        showEmail: form.showEmail,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Edit my profile</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-900">Appear in member directory</p>
              <p className="text-xs text-gray-500 mt-0.5">Other members can see your profile</p>
            </div>
            <div
              onClick={() => setForm(f => ({ ...f, directoryVisible: !f.directoryVisible }))}
              className={`relative rounded-full transition-colors cursor-pointer ${form.directoryVisible ? "bg-green-600" : "bg-gray-300"}`}
              style={{ height: "22px", width: "40px" }}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.directoryVisible ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
          </label>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">About me</label>
            <textarea
              value={form.bio}
              onChange={e => setForm(f => ({ ...f, bio: e.target.value.slice(0, 200) }))}
              placeholder="A short bio visible to other members..."
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
            <p className="text-right text-xs text-gray-400 mt-1">{form.bio.length}/200</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone number</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="e.g. 07700 900000"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {form.phone && (
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input type="checkbox" checked={form.showPhone} onChange={e => setForm(f => ({ ...f, showPhone: e.target.checked }))} className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                <span className="text-xs text-gray-600">Show phone number to other members</span>
              </label>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="Optional — separate from your login email"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {form.email && (
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input type="checkbox" checked={form.showEmail} onChange={e => setForm(f => ({ ...f, showEmail: e.target.checked }))} className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                <span className="text-xs text-gray-600">Show email to other members</span>
              </label>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-500 disabled:opacity-60">
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Wallet Modal ──────────────────────────────────────────────────────────────

function WalletModal({ member, clubId, currency, onClose }: {
  member: Member;
  clubId: Id<"clubs">;
  currency: string;
  onClose: () => void;
}) {
  const adminTopUp = useMutation(api.wallet.adminTopUp);
  const transactions = useQuery(api.wallet.listTransactions, { memberId: member._id });
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleTopUp() {
    const pence = Math.round(parseFloat(amount) * 100);
    if (!pence || pence <= 0) return;
    setSaving(true);
    try {
      await adminTopUp({
        clubId,
        memberId: member._id,
        amount: pence,
        description: description || "Manual top-up",
      });
      setAmount("");
      setDescription("");
    } finally {
      setSaving(false);
    }
  }

  const PRESETS = [500, 1000, 2000, 5000]; // pence

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Wallet size={16} /> {member.displayName}&apos;s Account
            </h2>
            <p className="text-2xl font-bold text-green-600 mt-0.5">
              {formatCurrency(member.accountBalance ?? 0, currency)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Top-up section */}
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Manual Top-Up</p>
          <div className="flex gap-2 mb-3">
            {PRESETS.map(p => (
              <button
                key={p}
                onClick={() => setAmount((p / 100).toFixed(2))}
                className="flex-1 py-1.5 text-xs border border-gray-200 rounded-lg hover:border-green-400 hover:text-green-700 font-medium"
              >
                {formatCurrency(p, currency)}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mb-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
              <input
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                type="number"
                min="0"
                step="0.01"
                className="w-full pl-7 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Reason (optional)"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleTopUp}
            disabled={saving || !amount || parseFloat(amount) <= 0}
            className="w-full py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-500 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <ArrowUpCircle size={14} /> {saving ? "Adding…" : "Add credit"}
          </button>
        </div>

        {/* Transaction history */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Transaction History</p>
          {!transactions ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-5 w-5 border-2 border-green-600 border-t-transparent rounded-full" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No transactions yet</p>
          ) : (
            <div className="space-y-2">
              {transactions.map(tx => (
                <div key={tx._id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{tx.description}</p>
                    <p className="text-xs text-gray-400">{new Date(tx.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <span className={`text-sm font-bold ml-3 shrink-0 ${tx.amount > 0 ? "text-green-600" : "text-red-500"}`}>
                    {tx.amount > 0 ? "+" : ""}{formatCurrency(tx.amount, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MemberCard({
  member,
  isMe,
  isAdmin,
  isSuperAdmin,
  clubId,
  categories,
  handicapEdit,
  onSetHandicapEdit,
  onSaveHandicap,
  onSetRole,
  onSetCategory,
  onSetClubRoles,
  onDelete,
  onMessage,
  onEditProfile,
  onWallet,
  currency,
}: {
  member: Member;
  isMe: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  clubId: Id<"clubs">;
  categories: Category[];
  handicapEdit: { id: Id<"clubMembers">; value: string } | null;
  onSetHandicapEdit: (v: { id: Id<"clubMembers">; value: string } | null) => void;
  onSaveHandicap: (id: Id<"clubMembers">, value: string) => void;
  onSetRole: (id: Id<"clubMembers">, role: string) => void;
  onSetCategory: (id: Id<"clubMembers">, categoryId: Id<"membershipCategories"> | undefined) => void;
  onSetClubRoles: (id: Id<"clubMembers">, roles: string[]) => void;
  onDelete: (member: Member) => void;
  onMessage: (member: Member) => void;
  onEditProfile: () => void;
  onWallet: (member: Member) => void;
  currency: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasContactInfo = (member.phone && member.showPhone) || (member.email && member.showEmail);
  const editingHcp = handicapEdit?.id === member._id;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-colors">
      <div className="flex items-start gap-4">
        <Avatar member={member} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-900 leading-tight">{member.displayName}</p>
              {member.membershipCategoryId ? (
                (() => {
                  const cat = categories.find(c => c._id === member.membershipCategoryId);
                  return cat ? <CategoryBadge name={cat.name} colour={cat.colour} /> : null;
                })()
              ) : member.membershipCategory ? (
                <span className="inline-block mt-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full">{member.membershipCategory}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isMe ? (
                <button onClick={onEditProfile} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                  <Edit2 size={12} /> Edit
                </button>
              ) : (
                <button onClick={() => onMessage(member)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-500 rounded-lg transition-colors">
                  <MessageSquare size={12} /> Message
                </button>
              )}
              {isSuperAdmin && !isMe && (
                <button
                  onClick={() => onDelete(member)}
                  className="text-gray-300 hover:text-red-500 transition-colors"
                  title="Remove member"
                ><X size={14} /></button>
              )}
            </div>
          </div>

          {/* Club role badges */}
          {member.clubRoles && member.clubRoles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {member.clubRoles.map(r => <ClubRoleBadge key={r} value={r} />)}
            </div>
          )}

          {member.bio && <p className="text-sm text-gray-500 mt-2 leading-relaxed line-clamp-2">{member.bio}</p>}

          {hasContactInfo && (
            <button onClick={() => setExpanded(e => !e)} className="mt-2 text-xs text-green-700 hover:text-green-600 font-medium">
              {expanded ? "Hide contact info" : "View contact info"}
            </button>
          )}
          {expanded && (
            <div className="mt-2 space-y-1">
              {member.phone && member.showPhone && (
                <a href={`tel:${member.phone}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-green-700">
                  <Phone size={13} className="text-gray-400" />{member.phone}
                </a>
              )}
              {member.email && member.showEmail && (
                <a href={`mailto:${member.email}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-green-700">
                  <Mail size={13} className="text-gray-400" />{member.email}
                </a>
              )}
            </div>
          )}

          {/* Admin controls */}
          {isAdmin && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3 flex-wrap">
              {/* Handicap */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">Hcp</span>
                {editingHcp ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={handicapEdit!.value}
                      onChange={e => onSetHandicapEdit({ id: member._id, value: e.target.value })}
                      step="0.1" min="-5" max="54"
                      className="w-14 border border-gray-300 rounded px-1.5 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-green-500"
                      autoFocus
                    />
                    <button onClick={() => onSaveHandicap(member._id, handicapEdit!.value)} className="text-green-600 hover:text-green-700"><Check size={13} /></button>
                    <button onClick={() => onSetHandicapEdit(null)} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
                  </div>
                ) : (
                  <button onClick={() => onSetHandicapEdit({ id: member._id, value: member.handicap?.toString() ?? "" })} className="flex items-center gap-1 text-gray-600 hover:text-gray-900">
                    <span className="text-xs font-medium">{member.handicap != null ? member.handicap : "—"}</span>
                    <Pencil size={10} className="text-gray-300" />
                  </button>
                )}
              </div>
              {/* Role */}
              <select
                value={member.role}
                onChange={e => onSetRole(member._id, e.target.value)}
                className="text-xs font-medium border border-gray-200 rounded-lg px-2 py-0.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-green-500"
              >
                <option value="member">member</option>
                <option value="staff">staff</option>
                <option value="admin">admin</option>
              </select>
              {/* Category */}
              {categories.length > 0 && (
                <select
                  value={member.membershipCategoryId ?? ""}
                  onChange={e => onSetCategory(member._id, e.target.value ? e.target.value as Id<"membershipCategories"> : undefined)}
                  className="text-xs font-medium border border-gray-200 rounded-lg px-2 py-0.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                  <option value="">No category</option>
                  {categories.map(cat => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
                </select>
              )}
              {/* Club roles */}
              <ClubRolePicker
                current={member.clubRoles ?? []}
                onChange={roles => onSetClubRoles(member._id, roles)}
              />
              {/* Wallet */}
              <button
                onClick={() => onWallet(member)}
                className="ml-auto flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:border-green-400 hover:text-green-700 transition-colors"
              >
                <Wallet size={11} />
                {formatCurrency(member.accountBalance ?? 0, currency)}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MembersPage() {
  const { user } = useUser();
  const router = useRouter();

  const superAdmin = useQuery(api.clubs.isSuperAdmin);
  const { activeMembership, club } = useActiveClub();
  const isAdmin = activeMembership?.role === "admin" || superAdmin === true;
  const isSuperAdmin = superAdmin === true;
  const members = useQuery(api.clubMembers.listByClub, club ? { clubId: club._id } : "skip") as Member[] | undefined;
  const pending = useQuery(api.clubMembers.listPending, (club && isAdmin) ? { clubId: club._id } : "skip");
  const categories = (useQuery(api.membershipCategories.listByClub, club ? { clubId: club._id } : "skip") ?? []) as Category[];

  const bulkPreRegister = useMutation(api.clubMembers.bulkPreRegister);
  const approveMember = useMutation(api.clubMembers.approveMember);
  const rejectMember = useMutation(api.clubMembers.rejectMember);
  const deleteMember = useMutation(api.clubMembers.deleteMember);
  const setHandicap = useMutation(api.scoring.setHandicap);
  const setRole = useMutation(api.clubMembers.setRole);
  const setCategoryId = useMutation(api.clubMembers.setMembershipCategoryId);
  const setClubRoles = useMutation(api.clubMembers.setClubRoles);
  const getOrCreateDirect = useMutation(api.messaging.getOrCreateDirect);
  const listNonMembers = useAction(clubMembersApi.listNonMembers);
  const addMemberById = useAction(clubMembersApi.addMemberById);

  const [search, setSearch] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [walletMember, setWalletMember] = useState<Member | null>(null);
  const [handicapEdit, setHandicapEdit] = useState<{ id: Id<"clubMembers">; value: string } | null>(null);
  const [nonMembers, setNonMembers] = useState<Array<{ userId: string; displayName: string; email: string }> | null>(null);
  const [nonMembersLoading, setNonMembersLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [navigating, setNavigating] = useState<string | null>(null);

  async function handleSaveHandicap(id: Id<"clubMembers">, value: string) {
    const hcp = parseFloat(value);
    await setHandicap({ memberId: id, handicap: isNaN(hcp) ? undefined : hcp });
    setHandicapEdit(null);
  }

  async function handleMessage(member: Member) {
    if (!user || !activeMembership) return;
    setNavigating(member.userId);
    try {
      const convId = await getOrCreateDirect({
        myUserId: user.id,
        otherUserId: member.userId,
        myDisplayName: activeMembership.displayName,
        myAvatarUrl: activeMembership.avatarUrl,
        otherDisplayName: member.displayName,
        otherAvatarUrl: member.avatarUrl,
      });
      router.push(`/messages?c=${convId}`);
    } finally {
      setNavigating(null);
    }
  }

  async function handleLoadNonMembers() {
    if (!club) return;
    setNonMembersLoading(true);
    try {
      const result = await listNonMembers({ clubId: club._id });
      setNonMembers(result as Array<{ userId: string; displayName: string; email: string }>);
    } finally {
      setNonMembersLoading(false);
    }
  }

  async function handleAddMember(userId: string, displayName: string, role: "member" | "admin" = "member") {
    if (!club) return;
    setAddingId(userId);
    try {
      await addMemberById({ userId, clubId: club._id as Id<"clubs">, displayName, role });
      setNonMembers(prev => prev?.filter(u => u.userId !== userId) ?? null);
    } finally {
      setAddingId(null);
    }
  }

  if (!club || !members) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const visibleMembers = members.filter(m => m.userId === user?.id || m.directoryVisible !== false);
  const filtered = visibleMembers
    .filter(m => m.displayName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const myMember = members.find(m => m.userId === user?.id);

  return (
    <div className="px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Members</h1>
        <p className="text-gray-500 text-sm mt-0.5">{members.length} active member{members.length !== 1 ? "s" : ""} at {club.name}</p>
      </div>

      {/* Membership categories — admin only */}
      {isAdmin && (
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Membership categories</h2>
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
            <CategoryManager clubId={club._id} categories={categories} />
          </div>
        </section>
      )}

      {/* Pending requests — admin only */}
      {isAdmin && pending && pending.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            Pending requests
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">{pending.length}</span>
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {pending.map(m => (
              <div key={m._id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-gray-900">{m.displayName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Requested {new Date(m.joinedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approveMember({ memberId: m._id })} className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-500 transition-colors">Approve</button>
                  <button onClick={() => rejectMember({ memberId: m._id })} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Super admin: add registered users */}
      {isSuperAdmin && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">Add registered users</h2>
            {nonMembers === null ? (
              <button onClick={handleLoadNonMembers} disabled={nonMembersLoading} className="text-sm text-green-700 font-medium hover:underline disabled:opacity-60">
                {nonMembersLoading ? "Loading…" : "Show users not in club →"}
              </button>
            ) : (
              <button onClick={() => setNonMembers(null)} className="text-sm text-gray-400 hover:text-gray-600">Hide</button>
            )}
          </div>
          {nonMembers !== null && (
            nonMembers.length === 0 ? (
              <p className="text-sm text-gray-400 bg-white border border-gray-200 rounded-xl px-5 py-4">All registered users are already members of this club.</p>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {nonMembers.map(u => (
                  <div key={u.userId} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{u.displayName}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleAddMember(u.userId, u.displayName, "member")} disabled={addingId === u.userId} className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-500 disabled:opacity-60">
                        {addingId === u.userId ? "Adding…" : "Add as member"}
                      </button>
                      <button onClick={() => handleAddMember(u.userId, u.displayName, "admin")} disabled={addingId === u.userId} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 disabled:opacity-60">
                        Add as admin
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </section>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search members…"
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
        />
      </div>

      {/* Hidden from directory notice */}
      {myMember && myMember.directoryVisible === false && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5">
          <User size={16} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            Your profile is hidden from other members.{" "}
            <button onClick={() => setEditingProfile(true)} className="font-medium underline">Edit your profile</button>{" "}
            to appear.
          </p>
        </div>
      )}

      {/* Member grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-400 text-sm">{search ? `No members match "${search}"` : "No active members yet."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(member => (
            <MemberCard
              key={member._id}
              member={member}
              isMe={member.userId === user?.id}
              isAdmin={isAdmin}
              isSuperAdmin={isSuperAdmin}
              clubId={club._id}
              categories={categories}
              handicapEdit={handicapEdit}
              onSetHandicapEdit={setHandicapEdit}
              onSaveHandicap={handleSaveHandicap}
              onSetRole={(id, role) => setRole({ memberId: id, role })}
              onSetCategory={(id, categoryId) => setCategoryId({ memberId: id, categoryId })}
              onSetClubRoles={(id, clubRoles) => setClubRoles({ memberId: id, clubRoles })}
              onDelete={m => { if (confirm(`Remove ${m.displayName} from the club?`)) deleteMember({ memberId: m._id }); }}
              onMessage={handleMessage}
              onEditProfile={() => setEditingProfile(true)}
              onWallet={m => setWalletMember(m)}
              currency={club.currency}
            />
          ))}
        </div>
      )}

      {navigating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
        </div>
      )}

      {editingProfile && myMember && (
        <EditProfileModal member={myMember} clubId={club._id} onClose={() => setEditingProfile(false)} />
      )}

      {walletMember && (
        <WalletModal
          member={walletMember}
          clubId={club._id}
          currency={club.currency}
          onClose={() => setWalletMember(null)}
        />
      )}

      {isAdmin && club && (
        <AIAssistant
          allowedCapabilities={["member-import"]}
          context={{
            clubName: club.name,
            existingMemberCount: members?.length ?? 0,
          }}
          onConfirm={async (_capabilityId: CapabilityId, data: Record<string, unknown>) => {
            const importedMembers = (data as { members?: Array<{ firstName: string; lastName: string; email?: string; handicap?: number; membershipCategory?: string; phone?: string }> }).members ?? [];
            if (!importedMembers.length) return;
            try {
              const result = await bulkPreRegister({
                clubId: club._id,
                members: importedMembers.map(m => ({
                  displayName: `${m.firstName} ${m.lastName}`.trim(),
                  email: m.email ?? undefined,
                  handicap: m.handicap ?? undefined,
                  membershipCategory: m.membershipCategory ?? undefined,
                  phone: m.phone ?? undefined,
                })),
              });
              alert(`Imported ${result.created} member${result.created === 1 ? "" : "s"}${result.skipped ? `, skipped ${result.skipped} duplicates` : ""}`);
            } catch (e) {
              alert("Import failed: " + (e instanceof Error ? e.message : "Unknown error"));
            }
          }}
        />
      )}
    </div>
  );
}
