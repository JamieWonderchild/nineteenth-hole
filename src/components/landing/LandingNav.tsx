'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Stethoscope, ChevronDown, Menu, X } from 'lucide-react';

type DropdownItem = { label: string; href: string; description?: string };
type NavItem =
  | { label: string; href: string; dropdown?: never }
  | { label: string; href?: never; dropdown: DropdownItem[] };

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Product',
    dropdown: [
      { label: 'Features', href: '#features', description: 'Voice-to-docs, AI reasoning, patient companion' },
      { label: 'How It Works', href: '#how-it-works', description: 'Record → Review → Generate in minutes' },
    ],
  },
  { label: 'Compare', href: '#compare' },
  { label: 'Pricing', href: '#pricing' },
];

function DropdownMenu({ items, onClose }: { items: DropdownItem[]; onClose: () => void }) {
  return (
    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-background border rounded-xl shadow-lg p-2 z-50">
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          onClick={onClose}
          className="block px-3 py-2.5 rounded-lg hover:bg-muted transition-colors group"
        >
          <div className="text-sm font-medium group-hover:text-primary transition-colors">{item.label}</div>
          {item.description && (
            <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
          )}
        </a>
      ))}
    </div>
  );
}

export function LandingNav() {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close mobile menu on resize
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 768) setMobileOpen(false);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <nav
      ref={navRef}
      className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2 shrink-0">
          <Stethoscope className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">[PRODUCT_NAME]</span>
        </a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <div key={item.label} className="relative">
              {item.dropdown ? (
                <>
                  <button
                    onClick={() => setOpenDropdown(openDropdown === item.label ? null : item.label)}
                    className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                  >
                    {item.label}
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${
                        openDropdown === item.label ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {openDropdown === item.label && (
                    <DropdownMenu
                      items={item.dropdown}
                      onClose={() => setOpenDropdown(null)}
                    />
                  )}
                </>
              ) : (
                <a
                  href={item.href}
                  className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors block"
                >
                  {item.label}
                </a>
              )}
            </div>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/sign-in">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button size="sm">Get Started</Button>
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t bg-background px-4 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <div key={item.label}>
              {item.dropdown ? (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {item.label}
                  </div>
                  {item.dropdown.map((sub) => (
                    <a
                      key={sub.href}
                      href={sub.href}
                      onClick={() => setMobileOpen(false)}
                      className="block px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                    >
                      {sub.label}
                    </a>
                  ))}
                </div>
              ) : (
                <a
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                >
                  {item.label}
                </a>
              )}
            </div>
          ))}
          <div className="pt-3 border-t flex flex-col gap-2">
            <Link href="/sign-in" onClick={() => setMobileOpen(false)}>
              <Button variant="ghost" className="w-full justify-center">Sign In</Button>
            </Link>
            <Link href="/sign-up" onClick={() => setMobileOpen(false)}>
              <Button className="w-full justify-center">Get Started</Button>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
