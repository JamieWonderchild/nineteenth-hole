import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-green-950 to-green-900 text-white">
      <div className="max-w-4xl mx-auto px-6 py-24 flex flex-col items-center text-center gap-8">
        {/* Logo / mark */}
        <div className="text-6xl">⛳</div>

        <h1 className="text-5xl font-bold tracking-tight">
          The 19th Hole
        </h1>
        <p className="text-xl text-green-200 max-w-xl">
          Run sweepstake pools for any golf competition — the Masters, The Open, your club medal.
          Everyone draws a player. Best player wins the pot.
        </p>

        <div className="flex gap-4 mt-4">
          <Link
            href="/onboarding"
            className="px-6 py-3 bg-white text-green-900 font-semibold rounded-lg hover:bg-green-50 transition-colors"
          >
            Create your club
          </Link>
          <Link
            href="/sign-in"
            className="px-6 py-3 border border-green-400 text-green-100 font-semibold rounded-lg hover:bg-green-800 transition-colors"
          >
            Sign in
          </Link>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 w-full text-left">
          {[
            {
              icon: "🎰",
              title: "Tiered draw",
              desc: "Everyone gets a top contender, a mid-field player, and a long shot. Fair and exciting.",
            },
            {
              icon: "🏆",
              title: "Live leaderboard",
              desc: "Scores update automatically from the tour leaderboard. Watch your player climb.",
            },
            {
              icon: "📊",
              title: "Club history",
              desc: "Track wins, total earnings, and all-time leaderboards across every competition your club runs.",
            },
          ].map(f => (
            <div key={f.title} className="bg-green-800/50 rounded-xl p-6 border border-green-700">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
              <p className="text-green-300 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
