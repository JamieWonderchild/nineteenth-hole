'use client';

import React from 'react';
import { AppLink } from '@/components/navigation/AppLink';
import { DOCS, CATEGORY_LABELS, CATEGORY_ORDER } from '@/content/docs';
import type { DocArticle } from '@/content/docs';

interface DocsSidebarProps {
  currentSlug: string;
}

export function DocsSidebar({ currentSlug }: DocsSidebarProps) {
  const grouped = CATEGORY_ORDER.map(category => ({
    category,
    label: CATEGORY_LABELS[category],
    articles: DOCS.filter(a => a.category === category),
  }));

  return (
    <nav className="w-[220px] shrink-0 space-y-6">
      {grouped.map(({ category, label, articles }) => (
        <div key={category}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-2">
            {label}
          </p>
          <ul className="space-y-0.5">
            {articles.map((article: DocArticle) => {
              const isActive = article.slug === currentSlug;
              return (
                <li key={article.slug}>
                  <AppLink
                    href={`/docs/${article.slug}`}
                    className={`block px-2 py-1.5 rounded-md text-sm transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    {article.title}
                  </AppLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
