"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Search, MessageSquare, X, Edit2, Phone, Mail, User } from "lucide-react";

type Member = {
  _id: Id<"clubMembers">;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role: string;
  membershipCategory?: string;
  bio?: string;
  phone?: string;
  email?: string;
  showPhone?: boolean;
  showEmail?: boolean;
  directoryVisible?: boolean;
  joinedAt: string;
};

function Avatar({ member, size = "md" }: { member: Pick<Member, "displayName" | "avatarUrl">; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "w-9 h-9 text-sm" : size === "lg" ? "w-16 h-16 text-xl" : "w-12 h-12 text-base";
  if (member.avatarUrl) {
    return <img src={member.avatarUrl} alt="" className={`${sz} rounded-full object-cover shrink-0`} />;
  }
  return (
    <div className={`${sz} rounded-full bg-green-100 flex items-center justify-center font-semibold text-green-700 shrink-0`}>
      {member.displayName[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function EditProfileModal({
  member,
  clubId,
  onClose,
}: {
  member: Member;
  clubId: Id<"clubs">;
  onClose: () => void;
}) {
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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Directory visibility */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-900">Appear in member directory</p>
              <p className="text-xs text-gray-500 mt-0.5">Other members can see your profile</p>
            </div>
            <div
              onClick={() => setForm(f => ({ ...f, directoryVisible: !f.directoryVisible }))}
              className={`relative w-10 h-5.5 rounded-full transition-colors cursor-pointer ${form.directoryVisible ? "bg-green-600" : "bg-gray-300"}`}
              style={{ height: "22px", width: "40px" }}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.directoryVisible ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </div>
          </label>

          {/* Bio */}
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

          {/* Phone */}
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
                <input
                  type="checkbox"
                  checked={form.showPhone}
                  onChange={e => setForm(f => ({ ...f, showPhone: e.target.checked }))}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-xs text-gray-600">Show phone number to other members</span>
              </label>
            )}
          </div>

          {/* Email */}
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
                <input
                  type="checkbox"
                  checked={form.showEmail}
                  onChange={e => setForm(f => ({ ...f, showEmail: e.target.checked }))}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-xs text-gray-600">Show email to other members</span>
              </label>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-500 transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberCard({
  member,
  isMe,
  onMessage,
  onEditProfile,
}: {
  member: Member;
  isMe: boolean;
  onMessage: (member: Member) => void;
  onEditProfile: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const hasContactInfo = (member.phone && member.showPhone) || (member.email && member.showEmail);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-colors">
      <div className="flex items-start gap-4">
        <Avatar member={member} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-900 leading-tight">{member.displayName}</p>
              {member.membershipCategory && (
                <span className="inline-block mt-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                  {member.membershipCategory}
                </span>
              )}
            </div>
            {isMe ? (
              <button
                onClick={onEditProfile}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <Edit2 size={12} />
                Edit
              </button>
            ) : (
              <button
                onClick={() => onMessage(member)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-500 rounded-lg transition-colors"
              >
                <MessageSquare size={12} />
                Message
              </button>
            )}
          </div>

          {member.bio && (
            <p className="text-sm text-gray-500 mt-2 leading-relaxed line-clamp-2">{member.bio}</p>
          )}

          {hasContactInfo && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="mt-2 text-xs text-green-700 hover:text-green-600 font-medium"
            >
              {expanded ? "Hide contact info" : "View contact info"}
            </button>
          )}

          {expanded && (
            <div className="mt-3 space-y-1.5">
              {member.phone && member.showPhone && (
                <a
                  href={`tel:${member.phone}`}
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-green-700"
                >
                  <Phone size={13} className="text-gray-400" />
                  {member.phone}
                </a>
              )}
              {member.email && member.showEmail && (
                <a
                  href={`mailto:${member.email}`}
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-green-700"
                >
                  <Mail size={13} className="text-gray-400" />
                  {member.email}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DirectoryPage() {
  const { user } = useUser();
  const router = useRouter();

  const memberships = useQuery(api.clubMembers.listByUser, user ? { userId: user.id } : "skip");
  const activeMembership = memberships?.find(m => m.status === "active");
  const club = useQuery(api.clubs.get, activeMembership ? { clubId: activeMembership.clubId } : "skip");
  const allMembers = useQuery(api.clubMembers.listByClub, club ? { clubId: club._id } : "skip") as Member[] | undefined;

  const getOrCreateDirect = useMutation(api.messaging.getOrCreateDirect);

  const [search, setSearch] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [navigating, setNavigating] = useState<string | null>(null);

  const visibleMembers = (allMembers ?? []).filter(m =>
    m.userId === user?.id || m.directoryVisible !== false
  );

  const filtered = visibleMembers.filter(m =>
    m.displayName.toLowerCase().includes(search.toLowerCase())
  );

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

  const myMember = allMembers?.find(m => m.userId === user?.id);

  if (!club || !allMembers) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Member Directory</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {visibleMembers.length} member{visibleMembers.length !== 1 ? "s" : ""} at {club.name}
          </p>
        </div>
      </div>

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

      {/* My profile hint */}
      {myMember && myMember.directoryVisible === false && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5">
          <User size={16} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            Your profile is hidden from the directory.{" "}
            <button onClick={() => setEditingProfile(true)} className="font-medium underline">
              Edit your profile
            </button>{" "}
            to appear.
          </p>
        </div>
      )}

      {/* Member grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-400 text-sm">
            {search ? `No members match "${search}"` : "No members in the directory yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(member => (
            <MemberCard
              key={member._id}
              member={member}
              isMe={member.userId === user?.id}
              onMessage={m => handleMessage(m)}
              onEditProfile={() => setEditingProfile(true)}
            />
          ))}
        </div>
      )}

      {navigating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
        </div>
      )}

      {editingProfile && myMember && club && (
        <EditProfileModal
          member={myMember}
          clubId={club._id}
          onClose={() => setEditingProfile(false)}
        />
      )}
    </div>
  );
}
