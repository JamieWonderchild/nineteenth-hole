import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) redirect("/home");

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-950 to-green-900 text-white">
      <div className="max-w-4xl mx-auto px-6 py-24 flex flex-col items-center text-center gap-8">
        <div className="text-6xl">⛳</div>

        <h1 className="text-5xl font-bold tracking-tight">
          Play The Pool
        </h1>
        <p className="text-xl text-green-200 max-w-xl">
          Enter sweepstake pools for the Masters, The Open, and every major. Play quick games with friends. Run your club&apos;s season series.
        </p>

        <div className="flex gap-4 mt-4">
          <Link
            href="/sign-up"
            className="px-6 py-3 bg-white text-green-900 font-semibold rounded-lg hover:bg-green-50 transition-colors"
          >
            Get started free
          </Link>
          <Link
            href="/sign-in"
            className="px-6 py-3 border border-green-400 text-green-100 font-semibold rounded-lg hover:bg-green-800 transition-colors"
          >
            Sign in
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 w-full text-left">
          {[
            {
              icon: "🏆",
              title: "Tour pools",
              desc: "Enter sweepstakes for every major — Masters, US Open, The Open. Draw a pro, best player wins the pot.",
            },
            {
              icon: "⛳",
              title: "Quick games",
              desc: "Stableford, betterball, Nassau, skins. Set a stake, play your round, see who owes who at the bar.",
            },
            {
              icon: "📊",
              title: "Club season",
              desc: "Run a Race to Swinley Forest. Track cumulative points across your club's competitions all season.",
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
