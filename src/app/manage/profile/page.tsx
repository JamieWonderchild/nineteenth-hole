"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useActiveClub } from "@/lib/club-context";
import { Check, Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/format";

export default function ProfilePage() {
  const { user } = useUser();
  const { activeMembership, club } = useActiveClub();

  const updateProfile = useMutation(api.clubMembers.updateProfile);
  const recentTransactions = useQuery(
    api.memberAccounts.listTransactions,
    activeMembership ? { memberId: activeMembership._id, limit: 8 } : "skip"
  );

  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [membershipCategory, setMembershipCategory] = useState("");
  const [directoryVisible, setDirectoryVisible] = useState(true);
  const [showPhone, setShowPhone] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (activeMembership) {
      setBio(activeMembership.bio ?? "");
      setPhone(activeMembership.phone ?? "");
      setEmail(activeMembership.email ?? "");
      setMembershipCategory(activeMembership.membershipCategory ?? "");
      setDirectoryVisible(activeMembership.directoryVisible !== false);
      setShowPhone(activeMembership.showPhone ?? false);
      setShowEmail(activeMembership.showEmail ?? false);
    }
  }, [activeMembership?._id]);

  if (!activeMembership || !club) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  async function handleSave() {
    if (!activeMembership || !user) return;
    setSaving(true);
    try {
      await updateProfile({
        clubId: activeMembership.clubId,
        userId: user.id,
        bio: bio || undefined,
        phone: phone || undefined,
        email: email || undefined,
        membershipCategory: membershipCategory || undefined,
        directoryVisible,
        showPhone,
        showEmail,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const roleLabel = activeMembership.role === "admin"
    ? "Admin"
    : activeMembership.role === "staff"
    ? "Staff"
    : "Member";

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-500 text-sm mt-0.5">{club.name}</p>
      </div>

      {/* Identity — read-only from Clerk */}
      <div className="bg-white border border-gray-200 rounded-xl px-6 py-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Account</h2>
        <div className="flex items-center gap-4">
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt="" className="w-14 h-14 rounded-full object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-xl font-bold text-green-700">
              {activeMembership.displayName[0]}
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900">{activeMembership.displayName}</p>
            <p className="text-sm text-gray-500">{user?.primaryEmailAddress?.emailAddress}</p>
            <span className="mt-1 inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
              {roleLabel}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-4">
          Name and profile photo are managed through your account settings.
        </p>
      </div>

      {/* Bar account balance */}
      {activeMembership.accountBalance != null && (
        <div className="bg-white border border-gray-200 rounded-xl px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet size={16} className="text-green-600" />
              <h2 className="text-sm font-semibold text-gray-700">Bar Account</h2>
            </div>
            <span className={`text-xl font-bold ${activeMembership.accountBalance < 0 ? "text-red-500" : "text-gray-900"}`}>
              {formatCurrency(activeMembership.accountBalance, club.currency)}
            </span>
          </div>
          {recentTransactions && recentTransactions.length > 0 && (
            <div className="space-y-0 border-t border-gray-100 pt-3">
              {recentTransactions.map(tx => {
                const isCredit = tx.amount > 0;
                return (
                  <div key={tx._id} className="flex items-center gap-3 py-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isCredit ? "bg-green-100" : "bg-red-50"}`}>
                      {isCredit
                        ? <TrendingUp size={11} className="text-green-600" />
                        : <TrendingDown size={11} className="text-red-400" />
                      }
                    </div>
                    <p className="flex-1 text-sm text-gray-700 truncate">{tx.description}</p>
                    <span className={`text-sm font-semibold shrink-0 ${isCredit ? "text-green-600" : "text-red-500"}`}>
                      {isCredit ? "+" : ""}{formatCurrency(tx.amount, club.currency)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {(!recentTransactions || recentTransactions.length === 0) && (
            <p className="text-xs text-gray-400">No transactions yet</p>
          )}
        </div>
      )}

      {/* Stats snapshot */}
      {activeMembership.totalEntered > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Entered", value: activeMembership.totalEntered },
            { label: "Best finish", value: activeMembership.bestFinish ? `${activeMembership.bestFinish}${ordinal(activeMembership.bestFinish)}` : "—" },
            { label: "Handicap", value: activeMembership.handicap != null ? activeMembership.handicap.toFixed(1) : "—" },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <div className="text-xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Directory profile */}
      <div className="bg-white border border-gray-200 rounded-xl px-6 py-5 space-y-5">
        <h2 className="text-sm font-semibold text-gray-700">Directory profile</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Bio</label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            rows={3}
            placeholder="A few words about yourself..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="07700 900000"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Membership category</label>
          <input
            type="text"
            value={membershipCategory}
            onChange={e => setMembershipCategory(e.target.value)}
            placeholder="e.g. Full Member, Social, Junior, Senior"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Privacy */}
      <div className="bg-white border border-gray-200 rounded-xl px-6 py-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Privacy</h2>

        <Toggle
          label="Show me in the member directory"
          description="Other members can find your profile"
          checked={directoryVisible}
          onChange={setDirectoryVisible}
        />
        <Toggle
          label="Show my phone number"
          description="Visible to other members in the directory"
          checked={showPhone}
          onChange={setShowPhone}
          disabled={!directoryVisible}
        />
        <Toggle
          label="Show my email address"
          description="Visible to other members in the directory"
          checked={showEmail}
          onChange={setShowEmail}
          disabled={!directoryVisible}
        />
      </div>

      {/* Save */}
      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
            <Check size={16} /> Saved
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 bg-green-700 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function Toggle({
  label, description, checked, onChange, disabled,
}: {
  label: string; description: string; checked: boolean;
  onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 ${disabled ? "opacity-50" : ""}`}>
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
          checked ? "bg-green-600" : "bg-gray-200"
        } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}
