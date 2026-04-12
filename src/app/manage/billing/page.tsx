"use client";

import { useActiveClub } from "@/lib/club-context";
import { CheckCircle, AlertTriangle, XCircle, CreditCard, Mail } from "lucide-react";

const PLAN_FEATURES: Record<string, string[]> = {
  free: [
    "Up to 50 members",
    "Competition management",
    "Basic leaderboard",
    "Tee time booking",
  ],
  club: [
    "Unlimited members",
    "Competition management + draws",
    "Live leaderboard & scoring",
    "Interclub league management",
    "Bar & pro shop POS",
    "Member directory & messaging",
    "AI results summaries",
    "Bulk communications",
    "Visitor management",
    "Advanced analytics",
    "Priority support",
  ],
};

function planLabel(plan: string) {
  return plan === "club" ? "Club Plan" : "Free Plan";
}

function statusInfo(status: string) {
  switch (status) {
    case "trialing":
      return { icon: <CheckCircle size={18} className="text-blue-600" />, label: "Trial active", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" };
    case "active":
      return { icon: <CheckCircle size={18} className="text-green-600" />, label: "Active", color: "text-green-700", bg: "bg-green-50", border: "border-green-200" };
    case "past_due":
      return { icon: <AlertTriangle size={18} className="text-yellow-600" />, label: "Payment overdue", color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200" };
    case "canceled":
      return { icon: <XCircle size={18} className="text-red-600" />, label: "Cancelled", color: "text-red-700", bg: "bg-red-50", border: "border-red-200" };
    default:
      return { icon: <CheckCircle size={18} className="text-gray-400" />, label: status, color: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200" };
  }
}

export default function BillingPage() {
  const { club } = useActiveClub();

  if (!club) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const plan = club.plan ?? "free";
  const status = club.billingStatus ?? "trialing";
  const info = statusInfo(status);
  const features = PLAN_FEATURES[plan] ?? PLAN_FEATURES.free;

  const trialEnd = club.trialEndsAt
    ? new Date(club.trialEndsAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const daysLeft = club.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(club.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage your club's subscription.</p>
      </div>

      {/* Current plan */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Current plan</p>
              <h2 className="text-xl font-bold text-gray-900">{planLabel(plan)}</h2>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${info.bg} ${info.border}`}>
              {info.icon}
              <span className={`text-sm font-medium ${info.color}`}>{info.label}</span>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          {status === "trialing" && trialEnd && (
            <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-800">
                Your trial {daysLeft !== null && daysLeft > 0 ? `ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}` : "has ended"} — {trialEnd}
              </p>
              <p className="text-sm text-blue-600 mt-1">
                Subscribe before then to keep full access to all features.
              </p>
            </div>
          )}

          <p className="text-sm font-medium text-gray-700 mb-3">Included in your plan:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {features.map(f => (
              <div key={f} className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle size={14} className="text-green-500 shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upgrade / manage */}
      {plan === "free" || status === "trialing" ? (
        <div className="bg-gray-900 rounded-xl p-6 text-white">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h3 className="text-lg font-bold mb-1">Upgrade to Club Plan</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">
                Full access to every feature — competitions, interclub, POS, AI tools, unlimited members — for less than your club spends on printer paper.
              </p>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-black text-green-400">£100</span>
                <span className="text-gray-400 text-sm">/month · billed annually at £1,200/yr</span>
              </div>
              <p className="text-xs text-gray-500">
                Intelligentgolf charges £3,500–10,000/year for a comparable setup. We charge less and do more.
              </p>
            </div>
            <CreditCard size={48} className="text-gray-700 shrink-0" />
          </div>
          <div className="mt-6 flex gap-3">
            <a
              href="mailto:hello@the19thhole.golf?subject=Club Plan subscription — {club.name}"
              className="px-5 py-2.5 bg-green-500 hover:bg-green-400 text-white font-semibold text-sm rounded-lg transition-colors"
            >
              Get started →
            </a>
            <a
              href="mailto:hello@the19thhole.golf"
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium text-sm rounded-lg transition-colors"
            >
              Talk to us
            </a>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl px-6 py-5">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Manage subscription</h3>
          <p className="text-sm text-gray-500 mb-4">
            To update your payment details, change your plan, or cancel, get in touch with us directly.
          </p>
          <a
            href="mailto:hello@the19thhole.golf?subject=Billing enquiry — {club.name}"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
          >
            <Mail size={15} />
            Contact billing support
          </a>
        </div>
      )}

      {/* Pricing context */}
      <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-5">
        <h3 className="text-sm font-semibold text-green-900 mb-2">Why The 19th Hole is different</h3>
        <p className="text-sm text-green-800 leading-relaxed">
          Legacy systems like Intelligentgolf charge clubs your size £3,500–4,500/year for the base licence, then add WHS integration (£149/yr), a member app (£2.99/member/year), EPOS software, and a bespoke website on top. The 19th Hole includes everything — competitions, interclub, POS, AI, messaging — in a single subscription at a fraction of the cost.
        </p>
      </div>
    </div>
  );
}
