"use client";

import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Plus, Globe, ExternalLink } from "lucide-react";
import { formatCurrency } from "@/lib/format";

export default function ManagePoolsPage() {
  const router = useRouter();
  const superAdmin = useQuery(api.clubs.isSuperAdmin);
  const pools = useQuery(
    api.competitions.listPlatform,
    superAdmin === true ? {} : "skip"
  );

  useEffect(() => {
    if (superAdmin === false) router.push("/manage");
  }, [superAdmin, router]);

  if (superAdmin === undefined || pools === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const active = pools.filter(p => p.status === "open" || p.status === "live");
  const draft = pools.filter(p => p.status === "draft");
  const completed = pools.filter(p => p.status === "complete");

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <Globe size={22} className="text-green-700" />
            Tour Pools
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Platform-wide sweepstakes — open to all users</p>
        </div>
        <Link
          href="/manage/pools/new"
          className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
        >
          <Plus size={16} />
          New pool
        </Link>
      </div>

      {pools.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-gray-300 rounded-xl">
          <div className="text-4xl mb-3">🏆</div>
          <p className="text-gray-500 mb-4">No platform pools yet</p>
          <Link href="/manage/pools/new" className="text-green-700 font-medium hover:underline">
            Create the Masters 2026 pool →
          </Link>
        </div>
      ) : (
        <>
          {[
            { label: "Active", items: active },
            { label: "Draft", items: draft },
            { label: "Completed", items: completed },
          ].filter(g => g.items.length > 0).map(group => (
            <section key={group.label}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">{group.label}</h2>
              <div className="space-y-2">
                {group.items.map(pool => {
                  const entries = 0; // would need separate query
                  void entries;
                  return (
                    <div key={pool._id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4">
                      <div>
                        <div className="font-semibold text-gray-900">{pool.name}</div>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {new Date(pool.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – {new Date(pool.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          {pool.entryFee > 0 && ` · ${formatCurrency(pool.entryFee, pool.currency)} entry`}
                          {" · "}
                          <span className={`font-medium ${pool.status === "open" ? "text-blue-600" : pool.status === "live" ? "text-green-600" : "text-gray-500"}`}>
                            {pool.status}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/pools/${pool.slug}`}
                          target="_blank"
                          className="text-gray-400 hover:text-green-700 transition-colors"
                          title="View public page"
                        >
                          <ExternalLink size={16} />
                        </Link>
                        <Link
                          href={`/manage/pools/${pool._id}`}
                          className="px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          Manage
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
