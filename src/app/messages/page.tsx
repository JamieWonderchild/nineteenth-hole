"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { useSearchParams } from "next/navigation";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { MessageSquare, Plus, Send, Users, X, ChevronLeft, Check, Trash2 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ConversationItem = {
  _id: Id<"conversations">;
  type: string;
  name?: string;
  avatarUrl?: string;
  members: Array<{ userId: string; displayName: string; avatarUrl?: string }>;
  lastMessage: { body: string; senderName: string; createdAt: string } | null;
  unreadCount: number;
  lastMessageAt: string;
};

type Message = {
  _id: Id<"messages">;
  conversationId: Id<"conversations">;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  body: string;
  createdAt: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Avatar({
  name,
  url,
  size = "md",
}: {
  name: string;
  url?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sz =
    size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-10 h-10 text-sm" : "w-9 h-9 text-sm";
  if (url) return <img src={url} alt="" className={`${sz} rounded-full object-cover shrink-0`} />;
  return (
    <div
      className={`${sz} rounded-full bg-green-100 text-green-700 font-semibold flex items-center justify-center shrink-0`}
    >
      {name[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString("en-GB", { weekday: "short" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ─── New Group Modal ──────────────────────────────────────────────────────────

function NewGroupModal({
  clubMembers,
  myUserId,
  myDisplayName,
  myAvatarUrl,
  clubId,
  onClose,
  onCreated,
}: {
  clubMembers: Array<{ userId: string; displayName: string; avatarUrl?: string }>;
  myUserId: string;
  myDisplayName: string;
  myAvatarUrl?: string;
  clubId: Id<"clubs">;
  onClose: () => void;
  onCreated: (id: Id<"conversations">) => void;
}) {
  const createGroup = useMutation(api.messaging.createGroup);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const others = clubMembers.filter(m => m.userId !== myUserId);

  function toggle(userId: string) {
    setSelected(s => {
      const next = new Set(s);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleCreate() {
    if (!name.trim() || selected.size === 0) return;
    setCreating(true);
    try {
      const members = others.filter(m => selected.has(m.userId));
      const id = await createGroup({
        name: name.trim(),
        clubId,
        members,
        createdByUserId: myUserId,
        createdByDisplayName: myDisplayName,
        createdByAvatarUrl: myAvatarUrl,
      });
      onCreated(id);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-semibold text-gray-900">New group</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 shrink-0">
          <input
            autoFocus
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Group name…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Add members
          </p>
          {others.map(m => (
            <button
              key={m.userId}
              onClick={() => toggle(m.userId)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Avatar name={m.displayName} url={m.avatarUrl} size="sm" />
              <span className="flex-1 text-left text-sm font-medium text-gray-900">
                {m.displayName}
              </span>
              {selected.has(m.userId) && <Check size={15} className="text-green-600" />}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim() || selected.size === 0}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-500 transition-colors disabled:opacity-50"
          >
            {creating ? "Creating…" : `Create group (${selected.size + 1})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Conversation list item ───────────────────────────────────────────────────

function ConversationRow({
  conv,
  active,
  onClick,
  onHide,
}: {
  conv: ConversationItem;
  active: boolean;
  onClick: () => void;
  onHide: () => void;
}) {
  return (
    <div className={`group relative flex items-center transition-colors ${active ? "bg-green-50" : "hover:bg-gray-50"}`}>
      <button
        onClick={onClick}
        className="flex-1 flex items-center gap-3 px-4 py-3.5 text-left min-w-0"
      >
        {conv.type === "group" ? (
          <div className="w-9 h-9 rounded-full bg-green-700 flex items-center justify-center shrink-0">
            <Users size={16} className="text-white" />
          </div>
        ) : (
          <Avatar name={conv.name ?? "?"} url={conv.avatarUrl} size="sm" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className={`text-sm font-medium truncate ${active ? "text-green-900" : "text-gray-900"}`}>
              {conv.name ?? "Unknown"}
            </span>
            {conv.lastMessage && (
              <span className="text-xs text-gray-400 shrink-0">
                {timeLabel(conv.lastMessage.createdAt)}
              </span>
            )}
          </div>
          {conv.lastMessage && (
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {conv.lastMessage.body}
            </p>
          )}
        </div>
        {conv.unreadCount > 0 && (
          <span className="shrink-0 min-w-[20px] h-5 px-1.5 bg-green-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
          </span>
        )}
      </button>

      {/* Delete button — revealed on row hover */}
      <button
        onClick={e => { e.stopPropagation(); onHide(); }}
        title="Delete conversation"
        className="opacity-0 group-hover:opacity-100 shrink-0 mr-3 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ─── Chat panel ──────────────────────────────────────────────────────────────

function ChatPanel({
  conv,
  userId,
  userDisplayName,
  userAvatarUrl,
  onBack,
}: {
  conv: ConversationItem;
  userId: string;
  userDisplayName: string;
  userAvatarUrl?: string;
  onBack: () => void;
}) {
  const messages = useQuery(api.messaging.listMessages, {
    conversationId: conv._id,
    userId,
  }) as Message[] | undefined;

  const sendMessage = useMutation(api.messaging.sendMessage);
  const markRead = useMutation(api.messaging.markRead);

  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Mark read when opening
  useEffect(() => {
    markRead({ conversationId: conv._id, userId });
  }, [conv._id, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  async function handleSend() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setBody("");
    try {
      await sendMessage({
        conversationId: conv._id,
        senderId: userId,
        senderName: userDisplayName,
        senderAvatar: userAvatarUrl,
        body: text,
      });
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const otherMembers = conv.members.filter(m => m.userId !== userId);
  const subtitle =
    conv.type === "group"
      ? `${conv.members.length} members`
      : otherMembers[0]?.displayName ?? "";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white shrink-0">
        <button
          onClick={onBack}
          className="md:hidden text-gray-500 hover:text-gray-900 mr-1"
        >
          <ChevronLeft size={20} />
        </button>
        {conv.type === "group" ? (
          <div className="w-9 h-9 rounded-full bg-green-700 flex items-center justify-center">
            <Users size={16} className="text-white" />
          </div>
        ) : (
          <Avatar name={conv.name ?? "?"} url={conv.avatarUrl} />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-tight">{conv.name}</p>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages === undefined && (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-6 w-6 border-4 border-green-600 border-t-transparent rounded-full" />
          </div>
        )}
        {messages?.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <MessageSquare size={32} className="text-gray-300 mb-3" />
            <p className="text-gray-400 text-sm">No messages yet. Say hello!</p>
          </div>
        )}
        {messages?.map((msg, i) => {
          const isMe = msg.senderId === userId;
          const prev = messages[i - 1];
          const showSender = !isMe && (!prev || prev.senderId !== msg.senderId);

          return (
            <div key={msg._id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
              {!isMe && (
                <Avatar
                  name={msg.senderName}
                  url={msg.senderAvatar}
                  size="sm"
                />
              )}
              <div className={`max-w-[72%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                {showSender && (
                  <p className="text-xs text-gray-400 mb-1 px-1">{msg.senderName}</p>
                )}
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMe
                      ? "bg-green-600 text-white rounded-br-md"
                      : "bg-white border border-gray-200 text-gray-900 rounded-bl-md"
                  }`}
                >
                  {msg.body}
                </div>
                <p className="text-[10px] text-gray-400 mt-1 px-1">
                  {new Date(msg.createdAt).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3 flex items-end gap-3">
        <textarea
          ref={inputRef}
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send)"
          rows={1}
          className="flex-1 resize-none border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 max-h-32 overflow-y-auto"
          style={{ minHeight: "42px" }}
        />
        <button
          onClick={handleSend}
          disabled={!body.trim() || sending}
          className="shrink-0 w-10 h-10 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <MessageSquare size={40} className="text-gray-300 mb-4" />
      <h2 className="text-base font-semibold text-gray-900 mb-1">No conversation selected</h2>
      <p className="text-sm text-gray-500">
        Choose a conversation from the list, or start a new one from the Member Directory.
      </p>
    </div>
  );
}

// ─── Main page (inner, reads search params) ──────────────────────────────────

function MessagesInner() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const initialConvId = searchParams.get("c") as Id<"conversations"> | null;

  const memberships = useQuery(
    api.clubMembers.listByUser,
    user ? { userId: user.id } : "skip"
  );
  const activeMembership = memberships?.find(m => m.status === "active");
  const club = useQuery(
    api.clubs.get,
    activeMembership ? { clubId: activeMembership.clubId } : "skip"
  );
  const clubMembers = useQuery(
    api.clubMembers.listByClub,
    club ? { clubId: club._id } : "skip"
  );

  const conversations = useQuery(
    api.messaging.listMyConversations,
    user ? { userId: user.id } : "skip"
  ) as ConversationItem[] | undefined;

  const hideConversation = useMutation(api.messaging.hideConversation);

  const [activeConvId, setActiveConvId] = useState<Id<"conversations"> | null>(initialConvId);
  const [showGroup, setShowGroup] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(!!initialConvId);

  // When URL param arrives (e.g. from directory), select that conversation
  useEffect(() => {
    if (initialConvId) {
      setActiveConvId(initialConvId);
      setMobileShowChat(true);
    }
  }, [initialConvId]);

  const activeConv = conversations?.find(c => c._id === activeConvId);

  function selectConv(id: Id<"conversations">) {
    setActiveConvId(id);
    setMobileShowChat(true);
  }

  function handleHide(convId: Id<"conversations">) {
    hideConversation({ conversationId: convId, userId: user!.id });
    // Deselect if the hidden conversation was open
    if (activeConvId === convId) {
      setActiveConvId(null);
      setMobileShowChat(false);
    }
  }

  if (!user) return null;

  const userDisplayName =
    activeMembership?.displayName ??
    user.fullName ??
    user.username ??
    "Me";
  const userAvatarUrl = activeMembership?.avatarUrl ?? user.imageUrl ?? undefined;

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Conversation list — hidden on mobile when chat is open */}
      <div
        className={`w-full md:w-80 shrink-0 flex flex-col border-r border-gray-200 bg-white ${
          mobileShowChat ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 shrink-0">
          <h1 className="font-semibold text-gray-900">Messages</h1>
          <button
            onClick={() => setShowGroup(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Plus size={13} />
            New group
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {conversations === undefined && (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-6 w-6 border-4 border-green-600 border-t-transparent rounded-full" />
            </div>
          )}
          {conversations?.length === 0 && (
            <div className="text-center py-12 px-6">
              <MessageSquare size={28} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No conversations yet.</p>
              <p className="text-xs text-gray-400 mt-1">
                Message a member from the Directory to get started.
              </p>
            </div>
          )}
          {conversations?.map(conv => (
            <ConversationRow
              key={conv._id}
              conv={conv}
              active={conv._id === activeConvId}
              onClick={() => selectConv(conv._id)}
              onHide={() => handleHide(conv._id)}
            />
          ))}
        </div>
      </div>

      {/* Chat panel — hidden on mobile when list is shown */}
      <div
        className={`flex-1 min-w-0 bg-gray-50 ${
          mobileShowChat ? "flex flex-col" : "hidden md:flex md:flex-col"
        }`}
      >
        {activeConv ? (
          <ChatPanel
            conv={activeConv}
            userId={user.id}
            userDisplayName={userDisplayName}
            userAvatarUrl={userAvatarUrl}
            onBack={() => setMobileShowChat(false)}
          />
        ) : (
          <EmptyState />
        )}
      </div>

      {/* New group modal */}
      {showGroup && club && (
        <NewGroupModal
          clubMembers={(clubMembers ?? []) as Array<{ userId: string; displayName: string; avatarUrl?: string }>}
          myUserId={user.id}
          myDisplayName={userDisplayName}
          myAvatarUrl={userAvatarUrl}
          clubId={club._id}
          onClose={() => setShowGroup(false)}
          onCreated={id => {
            setShowGroup(false);
            selectConv(id);
          }}
        />
      )}
    </div>
  );
}

// ─── Page (wraps inner in Suspense for useSearchParams) ──────────────────────

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
        </div>
      }
    >
      <MessagesInner />
    </Suspense>
  );
}
