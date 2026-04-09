"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, BookOpen, LogOut,
  Globe, ChevronRight, Menu, X, Flag, Trophy, Zap, Plus, ListOrdered, Clock, MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";

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
        "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
      )}
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
  const activeMembership = memberships?.find(m => m.status === "active");
  const isAdmin = activeMembership?.role === "admin" || superAdmin === true;
  const club = useQuery(
    api.clubs.get,
    activeMembership ? { clubId: activeMembership.clubId } : "skip"
  );
  const pending = useQuery(
    api.clubMembers.listPending,
    (club && isAdmin) ? { clubId: club._id } : "skip"
  );
  const platformPools = useQuery(
    api.competitions.listPlatform,
    superAdmin === true ? {} : "skip"
  );

  const is = (path: string) => pathname === path;

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Flag size={16} className="text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-tight text-foreground">Play The Pool</p>
          {club && <p className="text-xs text-muted-foreground truncate">{club.name}</p>}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {superAdmin && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 py-2">
              Platform
            </p>
            <NavItem href="/manage/platform" icon={<Globe size={16} />} label="All Clubs" active={is("/manage/platform")} onClick={onNav} />
            <NavItem href="/onboarding" icon={<Plus size={16} />} label="Create Club" active={is("/onboarding")} onClick={onNav} />
            <NavItem
              href="/manage/pools"
              icon={<Trophy size={16} />}
              label={platformPools?.length ? `Tour Pools (${platformPools.length})` : "Tour Pools"}
              active={pathname.startsWith("/manage/pools")}
              onClick={onNav}
            />
            <NavItem href="/games" icon={<Zap size={16} />} label="Quick Games" active={pathname.startsWith("/games")} onClick={onNav} />
            {club && <div className="my-2 border-t border-border" />}
          </>
        )}

        {!superAdmin && (
          <>
            <NavItem href="/pools" icon={<Trophy size={16} />} label="Tour Pools" active={pathname.startsWith("/pools")} onClick={onNav} />
            <NavItem href="/games" icon={<Zap size={16} />} label="My Games" active={pathname.startsWith("/games")} onClick={onNav} />
            {club && <div className="my-2 border-t border-border" />}
          </>
        )}

        {club && (
          <>
            {superAdmin && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 py-2">
                {club.name}
              </p>
            )}
            <NavItem href="/manage" icon={<LayoutDashboard size={16} />} label="Dashboard" active={is("/manage")} onClick={onNav} />
            {isAdmin && (
              <NavItem
                href="/manage/competitions/new"
                icon={<Trophy size={16} />}
                label="New Competition"
                active={is("/manage/competitions/new")}
                onClick={onNav}
              />
            )}
            <NavItem
              href="/manage/members"
              icon={<Users size={16} />}
              label={(isAdmin && pending?.length) ? `Members (${pending.length})` : "Members"}
              active={is("/manage/members")}
              onClick={onNav}
            />
            <NavItem href="/manage/results" icon={<BookOpen size={16} />} label="Game Book" active={is("/manage/results")} onClick={onNav} />
            <NavItem href="/manage/series" icon={<ListOrdered size={16} />} label="Season Series" active={pathname.startsWith("/manage/series")} onClick={onNav} />
            {isAdmin ? (
              <NavItem href="/manage/tee-times" icon={<Clock size={16} />} label="Tee Times" active={pathname.startsWith("/manage/tee-times")} onClick={onNav} />
            ) : (
              <NavItem href={`/${club.slug}/tee-times`} icon={<Clock size={16} />} label="Tee Times" active={pathname.startsWith(`/${club.slug}/tee-times`)} onClick={onNav} />
            )}
            {isAdmin && (
              <NavItem href="/manage/courses" icon={<MapPin size={16} />} label="Course Card" active={pathname.startsWith("/manage/courses")} onClick={onNav} />
            )}
            <div className="my-2 border-t border-border" />
            <NavItem href={`/${club.slug}`} icon={<ChevronRight size={16} />} label="View public page" active={false} onClick={onNav} />
          </>
        )}
      </nav>

      {/* User */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent transition-colors">
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
              {user?.firstName?.[0] ?? "?"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user?.fullName ?? user?.username ?? "You"}</p>
            {superAdmin && <p className="text-[10px] text-primary font-medium">Super admin</p>}
          </div>
          <button
            onClick={() => signOut({ redirectUrl: "/" })}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ManageSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b border-border flex items-center justify-between px-4 h-12">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
            <Flag size={12} className="text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm text-foreground">Play The Pool</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
          <Menu size={20} />
        </Button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 h-full">
            <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-card">
              <span className="font-semibold text-sm text-foreground">Menu</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X size={18} />
              </Button>
            </div>
            <div className="h-[calc(100%-3rem)]">
              <SidebarContent onNav={() => setMobileOpen(false)} />
            </div>
          </div>
          <div className="flex-1 bg-black/30" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  );
}
