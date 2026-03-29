'use client';

import React from 'react';
import { BookOpen, Clock, Search } from 'lucide-react';
import { AppLink } from '@/components/navigation/AppLink';
import { DOCS, CATEGORY_LABELS, CATEGORY_ORDER } from '@/content/docs';

export default function DocsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 text-primary mb-3">
          <BookOpen className="h-5 w-5" />
          <span className="text-sm font-medium">Documentation</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-3">How to use [PRODUCT_NAME]</h1>
        <p className="text-muted-foreground text-lg">
          Everything you need to know about recording encounters, generating documents, and using AI features.
        </p>

        {/* Search hint */}
        <button
          onClick={() => {
            const event = new KeyboardEvent('keydown', {
              key: 'k',
              metaKey: true,
              bubbles: true,
            });
            document.dispatchEvent(event);
          }}
          className="mt-5 flex items-center gap-3 w-full max-w-sm px-4 py-2.5 rounded-lg border border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50 transition-colors text-left group"
        >
          <Search className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          <span className="text-sm text-muted-foreground flex-1">Ask a question...</span>
          <kbd className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">
            <span>⌘</span><span>K</span>
          </kbd>
        </button>
      </div>

      {/* Article grid by category */}
      <div className="space-y-10">
        {CATEGORY_ORDER.map(category => {
          const articles = DOCS.filter(a => a.category === category);
          return (
            <section key={category}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                {CATEGORY_LABELS[category]}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {articles.map(article => (
                  <AppLink
                    key={article.slug}
                    href={`/docs/${article.slug}`}
                    className="group block p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  >
                    <h3 className="font-medium text-sm mb-1 group-hover:text-primary transition-colors">
                      {article.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {article.description}
                    </p>
                    <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{article.readTime} min read</span>
                    </div>
                  </AppLink>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
