import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/manage");

  return (
    <main className="min-h-screen bg-[#0a1f10] text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-green-500 flex items-center justify-center text-sm font-black text-white">
            19
          </div>
          <span className="font-bold text-white text-lg">The 19th Hole</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/sign-in" className="text-sm text-green-300 hover:text-white transition-colors font-medium">
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="px-4 py-2 bg-green-500 hover:bg-green-400 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-8 pt-16 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-900/60 border border-green-700/50 text-green-300 text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Live at Finchley Golf Club
        </div>
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-[1.05] mb-6">
          One platform for<br />
          <span className="text-green-400">every part of your club.</span>
        </h1>
        <p className="text-xl text-green-200 leading-relaxed mb-10">
          Competitions, interclub, tee times, bar POS, member communications — all connected, all real-time, at a fraction of what Intelligentgolf charges.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/sign-up"
            className="px-7 py-3.5 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl transition-colors text-base"
          >
            Set up your club →
          </Link>
          <Link
            href="/sign-in"
            className="px-7 py-3.5 border border-green-700 text-green-200 hover:bg-green-900/40 font-semibold rounded-xl transition-colors text-base"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Feature showcase */}
      <section className="px-8 pb-20">
        <p className="text-center text-xs font-bold uppercase tracking-widest text-green-600 mb-10">Everything your club needs</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: "🏆",
              title: "Competition Management",
              desc: "Entries, draws, live scoring, RTSF leaderboard, and full results history. No more Excel. No more scraping.",
            },
            {
              icon: "🤝",
              title: "Interclub Leagues",
              desc: "Full county league management — fixtures, hole-by-hole match results, live team standings for every team.",
            },
            {
              icon: "🕐",
              title: "Tee Time Booking",
              desc: "Member and visitor bookings in one place. Admins see full utilisation data to recover lost green fee revenue.",
            },
            {
              icon: "🛒",
              title: "Bar & Pro Shop POS",
              desc: "Full point-of-sale with product management, tabs, and daily sales reporting. Spot stock variances immediately.",
            },
            {
              icon: "🤖",
              title: "AI Tools",
              desc: "Automatic competition result summaries published instantly. AI team selection suggestions for interclub fixtures.",
            },
            {
              icon: "📣",
              title: "Communications",
              desc: "Email the whole membership in one click. WhatsApp-ready broadcasts. No more mailing list faff.",
            },
            {
              icon: "👥",
              title: "Member Directory",
              desc: "Searchable directory with contact details, handicap, and competition history — with privacy controls for each member.",
            },
            {
              icon: "💬",
              title: "In-App Messaging",
              desc: "Members message each other directly. Threaded conversations, unread counts, no WhatsApp group chaos.",
            },
            {
              icon: "📊",
              title: "Analytics Dashboard",
              desc: "Revenue trends, member growth, tee time utilisation, and POS performance — all in one place, updated live.",
            },
          ].map(f => (
            <div
              key={f.title}
              className="rounded-xl bg-green-900/20 border border-green-800/40 p-6 hover:bg-green-900/30 transition-colors"
            >
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="font-bold text-white mb-2">{f.title}</h3>
              <p className="text-green-300 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Two audiences */}
      <section className="px-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* For Clubs */}
          <div className="rounded-2xl bg-green-900/30 border border-green-800/60 p-8">
            <div className="text-xs font-bold uppercase tracking-widest text-green-400 mb-4">For Golf Clubs</div>
            <h2 className="text-2xl font-bold mb-3">Replace every fragmented tool. Cut your software bill by 80%.</h2>
            <p className="text-green-300 text-sm leading-relaxed mb-6">
              Clubs currently paying £7,000–10,000/year to Intelligentgolf, BRS, and ClubV1 get everything we offer for less than £1,200 a year — and it actually works properly.
            </p>
            <ul className="space-y-2 mb-8">
              {[
                "Competition management, draws, and live scoring",
                "Interclub fixtures with AI team suggestions",
                "Member directory with messaging",
                "Tee times with full utilisation reporting",
                "Bar & pro shop POS with daily revenue summary",
                "Bulk email communications to full membership",
                "Visitor management and green fee tracking",
                "Analytics dashboard — members, revenue, activity",
              ].map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-green-200">
                  <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="flex items-baseline gap-1.5 mb-4">
              <span className="text-3xl font-black text-green-400">£100</span>
              <span className="text-green-400 text-sm">/month</span>
              <span className="text-green-600 text-sm ml-1">· all features included</span>
            </div>
            <Link
              href="/sign-up"
              className="inline-block px-5 py-2.5 bg-green-500 hover:bg-green-400 text-white font-semibold rounded-lg transition-colors text-sm"
            >
              Set up your club →
            </Link>
          </div>

          {/* For Golfers */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-8">
            <div className="text-xs font-bold uppercase tracking-widest text-green-300 mb-4">For Individual Golfers</div>
            <h2 className="text-2xl font-bold mb-3">Play, compete, and track your game — no club account needed.</h2>
            <p className="text-green-300 text-sm leading-relaxed mb-6">
              Sign up and start playing immediately. Record rounds, run casual games with friends, enter major sweepstakes, and track your handicap over time.
            </p>
            <ul className="space-y-2 mb-8">
              {[
                "Quick Games — stableford, betterball, nassau, skins with stakes",
                "Per-hole scoring with auto stableford and net calculation",
                "See who owes who at the end of every round",
                "Challenge friends and share live scorecards",
                "Tour pools — Masters, The Open, Ryder Cup sweepstakes",
                "Handicap index tracking over time",
                "Full round history with stats",
                "Connect to your club if it's already on the platform",
              ].map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-white/80">
                  <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="flex items-baseline gap-1.5 mb-4">
              <span className="text-3xl font-black text-white">Free</span>
              <span className="text-green-400 text-sm ml-1">to get started</span>
            </div>
            <Link
              href="/sign-up"
              className="inline-block px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-lg transition-colors text-sm"
            >
              Sign up free →
            </Link>
          </div>
        </div>
      </section>

      {/* Competitor comparison callout */}
      <section className="px-8 pb-20">
        <div className="rounded-2xl bg-[#0c1a0e] border border-green-900/60 p-8 sm:p-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-3">What clubs are currently paying</p>
              <div className="space-y-2 text-sm">
                {[
                  ["Intelligentgolf base licence", "£3,500–4,500/yr"],
                  ["WHS handicap integration", "£149/yr"],
                  ["igMember app (500 members)", "£1,500/yr"],
                  ["EPOS / website", "£2,000–4,000/yr"],
                ].map(([label, price]) => (
                  <div key={label} className="flex items-center justify-between gap-4">
                    <span className="text-white/60">{label}</span>
                    <span className="font-bold text-red-400 whitespace-nowrap">{price}</span>
                  </div>
                ))}
                <div className="border-t border-white/10 mt-3 pt-3 flex items-center justify-between">
                  <span className="font-bold text-white">Total</span>
                  <span className="font-black text-red-400">£7,000–10,000+/yr</span>
                </div>
              </div>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-xs font-bold uppercase tracking-widest text-green-400 mb-3">What we charge</p>
              <div className="text-5xl font-black text-green-400 leading-none mb-2">&lt; £1,200/yr</div>
              <p className="text-green-300 text-sm leading-relaxed">Everything included. No per-member charges. No module add-ons. No annual price hike.</p>
              <Link
                href="/sign-up"
                className="inline-block mt-6 px-6 py-3 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl transition-colors text-sm"
              >
                Start the switch →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="px-8 pb-20">
        <div className="rounded-2xl bg-green-950/80 border border-green-800/40 px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-8">
          <div>
            <p className="text-green-400 text-xs font-bold uppercase tracking-widest mb-2">Live today</p>
            <h3 className="text-xl font-bold mb-1">Already running at Finchley Golf Club</h3>
            <p className="text-green-300 text-sm">Competitions, interclub (Sabres, Tigers, Foxes), bar POS, tee times, member app, and AI summaries — in production.</p>
          </div>
          <div className="shrink-0 grid grid-cols-2 gap-3 text-center">
            {[
              { label: "Competition management", value: "Live" },
              { label: "Interclub leagues", value: "Live" },
              { label: "Bar & pro shop POS", value: "Live" },
              { label: "AI result summaries", value: "Live" },
            ].map(s => (
              <div key={s.label} className="bg-green-900/40 rounded-xl px-5 py-3 border border-green-800/30">
                <div className="text-green-400 font-bold text-sm">{s.value}</div>
                <div className="text-green-600 text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-green-900/50 px-8 py-6 flex items-center justify-between text-green-700 text-xs">
        <span>© 2026 The 19th Hole</span>
        <div className="flex gap-6">
          <Link href="/privacy" className="hover:text-green-400 transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-green-400 transition-colors">Terms</Link>
          <a href="mailto:hello@the19thhole.golf" className="hover:text-green-400 transition-colors">Contact</a>
        </div>
      </footer>
    </main>
  );
}
