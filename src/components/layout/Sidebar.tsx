'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Home, Stethoscope, Users, BarChart, DollarSign, Settings, Shield, BrainCircuit, HelpCircle, Sun, Moon, CalendarDays } from 'lucide-react';
import { UserButton, useUser } from '@clerk/nextjs';
import { isSuperadmin } from '@/lib/superadmin';
import { AppLink } from '@/components/navigation/AppLink';
import { useTheme } from 'next-themes';

const baseNavItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/encounter', label: 'Encounter', icon: Stethoscope },
  { path: '/schedule', label: 'Schedule', icon: CalendarDays },
  { path: '/patient-records', label: 'Patients', icon: Users },
  { path: '/case-reasoning', label: 'Case Reasoning', icon: BrainCircuit },
  { path: '/billing', label: 'Billing', icon: DollarSign },
  { path: '/analytics', label: 'Analytics', icon: BarChart },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export const Sidebar = () => {
  const pathname = usePathname();
  const { user } = useUser();
  const { theme, setTheme } = useTheme();
  const isAdmin = isSuperadmin(user?.primaryEmailAddress?.emailAddress);
  const navItems = isAdmin
    ? [...baseNavItems, { path: '/admin', label: 'Admin', icon: Shield }]
    : baseNavItems;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="group hidden sm:flex fixed inset-y-0 left-0 z-40 w-[60px] hover:w-[240px] transition-[width] duration-200 bg-card border-r border-border flex-col">
        {/* Brand */}
        <div className="h-14 flex items-center px-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Stethoscope className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
              [PRODUCT_NAME]
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-hidden">
          {navItems.map((item) => {
            const isActive = item.path === '/' ? pathname === '/' : pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <AppLink
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-2 h-10 rounded-lg transition-colors relative ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                )}
                <Icon className="h-5 w-5 shrink-0 ml-1" />
                <span className="text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                  {item.label}
                </span>
              </AppLink>
            );
          })}
        </nav>

        {/* Help / Docs */}
        <div className="px-2 pb-1">
          <AppLink
            href="/docs"
            className={`flex items-center gap-3 px-2 h-9 rounded-lg transition-colors relative ${
              pathname.startsWith('/docs')
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <HelpCircle className="h-4 w-4 shrink-0 ml-1" />
            <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
              Help &amp; Docs
            </span>
          </AppLink>
        </div>

        {/* Legal links */}
        <div className="px-2 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex gap-3 px-2">
            <AppLink href="/terms" preserveParams={false} className="text-[11px] text-muted-foreground hover:text-foreground whitespace-nowrap">
              Terms
            </AppLink>
            <AppLink href="/privacy" preserveParams={false} className="text-[11px] text-muted-foreground hover:text-foreground whitespace-nowrap">
              Privacy
            </AppLink>
          </div>
        </div>

        {/* ⌘K voice command hint */}
        <div className="px-2 pb-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-muted-foreground">
            <kbd className="inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium shrink-0">
              ⌘K
            </kbd>
            <span className="text-xs whitespace-nowrap">Voice command</span>
          </div>
        </div>

        {/* Theme toggle */}
        <div className="px-2 pb-2">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center gap-3 px-2 h-9 w-full rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 shrink-0 ml-1" />
            ) : (
              <Moon className="h-4 w-4 shrink-0 ml-1" />
            )}
            <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </span>
          </button>
        </div>

        {/* User */}
        <div className="px-2 py-3 border-t border-border shrink-0">
          <div className="px-2">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-14">
          {navItems.map((item) => {
            const isActive = item.path === '/' ? pathname === '/' : pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <AppLink
                key={item.path}
                href={item.path}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </AppLink>
            );
          })}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-muted-foreground"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>
          <div className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </nav>
    </>
  );
};
