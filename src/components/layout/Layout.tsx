'use client';

import React, { Suspense } from 'react';
import { Sidebar } from './Sidebar';
import { AssumeModeBanner } from '@/components/admin/AssumeModeBanner';
import { DocsSearchModal } from '@/components/docs/DocsSearchModal';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const [docsSearchOpen, setDocsSearchOpen] = React.useState(false);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setDocsSearchOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Suspense>
        <AssumeModeBanner />
      </Suspense>
      <Sidebar />
      <main className="sm:ml-[60px] pb-16 sm:pb-0">{children}</main>
      <DocsSearchModal open={docsSearchOpen} onClose={() => setDocsSearchOpen(false)} />
    </div>
  );
};
