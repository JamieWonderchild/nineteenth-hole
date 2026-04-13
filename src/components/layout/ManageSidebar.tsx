"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, LogOut,
  Globe, ChevronRight, ChevronDown, Menu, X, Flag, Trophy, Zap, Plus, ListOrdered, Clock, MapPin,
  MessageSquare, Mail, Swords, UserCheck, ShoppingCart, Shield, CreditCard, UserCircle, BarChart2, Wallet, Check, Monitor
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useClubContext, useActiveClub } from "@/lib/club-context";

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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const superAdmin = useQuery(api.clubs.isSuperAdmin);
  const { activeMembership, club, myClubs, selectedClubId } = useActiveClub();
  const { setSelectedClubId } = useClubContext();

  // Close dropdown on outside click
  useEffect(() => {
    if (!switcherOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [switcherOpen]);

  const isAdmin = activeMembership?.role === "admin" || superAdmin === true;
  const isStaff = activeMembership?.role === "staff" || isAdmin;

  const pending = useQuery(
    api.clubMembers.listPending,
    (club && isAdmin) ? { clubId: club._id } : "skip"
  );
  const platformPools = useQuery(
    api.competitions.listPlatform,
    superAdmin === true ? {} : "skip"
  );
  const unreadCount = useQuery(
    api.messaging.totalUnread,
    user ? { userId: user.id } : "skip"
  );

  const is = (path: string) => pathname === path;

  const multiClub = myClubs.length > 1;

  function selectClub(clubId: typeof myClubs[0]["club"]["_id"]) {
    setSelectedClubId(clubId);
    setSwitcherOpen(false);
  }

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Logo / Club Switcher */}
      <div ref={dropdownRef} className="relative border-b border-border">
        <button
          onClick={() => multiClub && setSwitcherOpen(o => !o)}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-4 text-left",
            multiClub && "hover:bg-accent transition-colors cursor-pointer"
          )}
        >
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Flag size={16} className="text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm leading-tight text-foreground">The 19th Hole</p>
            {club && <p className="text-xs text-muted-foreground truncate">{club.name}</p>}
          </div>
          {multiClub && (
            <ChevronDown size={14} className={cn("text-muted-foreground shrink-0 transition-transform", switcherOpen && "rotate-180")} />
          )}
        </button>

        {switcherOpen && multiClub && (
          <div className="absolute top-full left-0 right-0 z-50 bg-card border border-border rounded-b-lg shadow-lg overflow-hidden">
            {myClubs.map(({ membership, club: c }) => (
              <button
                key={c._id}
                onClick={() => selectClub(c._id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors text-sm"
              >
                <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
                  <Flag size={11} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{membership.role}</p>
                </div>
                {c._id === club?._id && <Check size={13} className="text-primary shrink-0" />}
              </button>
            ))}
          </div>
        )}
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

            {/* Competitions */}
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 pt-4 pb-1">Competitions</p>
            <NavItem href="/manage/results" icon={<Trophy size={16} />} label="Competitions" active={pathname.startsWith("/manage/results") || pathname.startsWith("/manage/competitions")} onClick={onNav} />
            <NavItem href="/manage/series" icon={<ListOrdered size={16} />} label="Season Series" active={pathname.startsWith("/manage/series")} onClick={onNav} />
            <NavItem href="/manage/knockouts" icon={<Swords size={16} />} label="Knockouts" active={pathname.startsWith("/manage/knockouts")} onClick={onNav} />
            <NavItem href="/manage/interclub" icon={<Shield size={16} />} label="Interclub" active={pathname.startsWith("/manage/interclub")} onClick={onNav} />

            {/* Club */}
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 pt-4 pb-1">Club</p>
            <NavItem
              href="/manage/members"
              icon={<Users size={16} />}
              label={isAdmin && pending?.length ? `Members (${pending.length})` : "Members"}
              active={is("/manage/members")}
              onClick={onNav}
            />
            {isAdmin ? (
              <NavItem href="/manage/tee-times" icon={<Clock size={16} />} label="Tee Times" active={pathname.startsWith("/manage/tee-times")} onClick={onNav} />
            ) : (
              <NavItem href={`/${club.slug}/tee-times`} icon={<Clock size={16} />} label="Tee Times" active={pathname.startsWith(`/${club.slug}/tee-times`)} onClick={onNav} />
            )}
            {isStaff && (
              <NavItem href="/manage/visitors" icon={<UserCheck size={16} />} label="Visitors" active={pathname.startsWith("/manage/visitors")} onClick={onNav} />
            )}
            {isStaff && (
              <NavItem href="/manage/pos" icon={<ShoppingCart size={16} />} label="Point of Sale" active={pathname === "/manage/pos"} onClick={onNav} />
            )}
            {isStaff && (
              <NavItem href="/manage/pos/shifts" icon={<Clock size={16} />} label="Shifts &amp; Reports" active={pathname.startsWith("/manage/pos/shifts")} onClick={onNav} />
            )}
            {isStaff && (
              <NavItem href="/manage/accounts" icon={<Wallet size={16} />} label="Member Accounts" active={pathname.startsWith("/manage/accounts")} onClick={onNav} />
            )}

            {/* Admin tools */}
            {isAdmin && (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 pt-4 pb-1">Admin</p>
                <NavItem href="/manage/analytics" icon={<BarChart2 size={16} />} label="Analytics" active={pathname.startsWith("/manage/analytics")} onClick={onNav} />
                <NavItem href="/manage/comms" icon={<Mail size={16} />} label="Communications" active={pathname.startsWith("/manage/comms")} onClick={onNav} />
                <NavItem href="/manage/courses" icon={<MapPin size={16} />} label="Course Card" active={pathname.startsWith("/manage/courses")} onClick={onNav} />
                <NavItem href="/manage/pos/locations" icon={<Monitor size={16} />} label="Locations &amp; Kiosks" active={pathname.startsWith("/manage/pos/locations")} onClick={onNav} />
              </>
            )}

            {/* Account */}
            <div className="my-2 border-t border-border" />
            <NavItem
              href="/messages"
              icon={<MessageSquare size={16} />}
              label={unreadCount ? `Messages (${unreadCount})` : "Messages"}
              active={pathname.startsWith("/messages")}
              onClick={onNav}
            />
            <NavItem href="/manage/profile" icon={<UserCircle size={16} />} label="My Profile" active={is("/manage/profile")} onClick={onNav} />
            {isAdmin && (
              <NavItem href="/manage/billing" icon={<CreditCard size={16} />} label="Billing" active={is("/manage/billing")} onClick={onNav} />
            )}
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
          <span className="font-semibold text-sm text-foreground">The 19th Hole</span>
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
