"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Trophy, Users, BookOpen,
  Plus, LogOut, Globe, ChevronRight, Menu, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

function NavItem({
  href, icon, label, active, onClick
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
        active
          ? "bg-green-800 text-white font-medium"
          : "text-green-300 hover:bg-green-900/60 hover:text-white"
      )}
    >
      <span className="shrink-0">{icon}</span>
      {label}
    </Link>
  );
}

function SidebarContent({ onNav }: { onNav?: () => void }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const pathname = usePathname();

  const superAdmin = useQuery(api.clubs.isSuperAdmin);
  const memberships = useQuery(
    api.clubMembers.listByUser,
    user ? { userId: user.id } : "skip"
  );
  const adminMembership = memberships?.find(m => m.role === "admin");
  const club = useQuery(
    api.clubs.get,
    adminMembership ? { clubId: adminMembership.clubId } : "skip"
  );

  const is = (path: string) => pathname === path;
  const starts = (path: string) => pathname.startsWith(path);

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-green-900/60">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="text-2xl">⛳</span>
          <span className="font-bold text-white text-sm leading-tight">Play The Pool</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {superAdmin && (
          <>
            <p className="text-green-500 text-[10px] font-semibold uppercase tracking-widest px-3 pt-1 pb-2">
              Platform
            </p>
            <NavItem
              href="/manage/platform"
              icon={<Globe size={15} />}
              label="All Clubs"
              active={is("/manage/platform")}
              onClick={onNav}
            />
            <NavItem
              href="/onboarding"
              icon={<Plus size={15} />}
              label="Create Club"
              active={is("/onboarding")}
              onClick={onNav}
            />
            {club && <div className="border-t border-green-900/60 my-3" />}
          </>
        )}

        {club && (
          <>
            <p className="text-green-500 text-[10px] font-semibold uppercase tracking-widest px-3 pt-1 pb-2">
              {club.name}
            </p>
            <NavItem
              href="/manage"
              icon={<LayoutDashboard size={15} />}
              label="Dashboard"
              active={is("/manage")}
              onClick={onNav}
            />
            <NavItem
              href="/manage/competitions/new"
              icon={<Plus size={15} />}
              label="New Competition"
              active={is("/manage/competitions/new")}
              onClick={onNav}
            />
            <NavItem
              href="/manage/members"
              icon={<Users size={15} />}
              label="Members"
              active={is("/manage/members")}
              onClick={onNav}
            />
            <NavItem
              href="/manage/results"
              icon={<BookOpen size={15} />}
              label="Game Book"
              active={is("/manage/results")}
              onClick={onNav}
            />

            {/* Active competitions quick-links */}
            <div className="border-t border-green-900/60 my-3" />
            <p className="text-green-500 text-[10px] font-semibold uppercase tracking-widest px-3 pt-1 pb-2">
              Club Page
            </p>
            <NavItem
              href={`/${club.slug}`}
              icon={<ChevronRight size={15} />}
              label="View public page"
              active={false}
              onClick={onNav}
            />
          </>
        )}

        {/* Signed in but no club and not super admin */}
        {superAdmin === false && !club && memberships !== undefined && (
          <p className="text-green-500 text-xs px-3 py-2">No club assigned yet.</p>
        )}
      </nav>

      {/* User */}
      <div className="border-t border-green-900/60 px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-green-700 flex items-center justify-center text-xs font-bold">
              {user?.firstName?.[0] ?? "?"}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.fullName ?? user?.username ?? "You"}
            </p>
            {superAdmin && (
              <p className="text-[10px] text-green-400 font-medium">Super admin</p>
            )}
          </div>
        </div>
        <button
          onClick={() => signOut({ redirectUrl: "/" })}
          className="flex items-center gap-2 text-green-400 hover:text-white text-xs transition-colors"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </div>
  );
}

export function ManageSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-green-950 flex-col shrink-0 h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-green-950 text-white flex items-center justify-between px-4 py-3 border-b border-green-900">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg">⛳</span>
          <span className="font-bold text-sm">Play The Pool</span>
        </Link>
        <button onClick={() => setMobileOpen(true)}>
          <Menu size={22} />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-green-950 h-full flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-green-900/60">
              <span className="font-bold text-white text-sm">Menu</span>
              <button onClick={() => setMobileOpen(false)}>
                <X size={20} className="text-green-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarContent onNav={() => setMobileOpen(false)} />
            </div>
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  );
}
