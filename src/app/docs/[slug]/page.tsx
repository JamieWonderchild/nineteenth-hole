'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { AppLink } from '@/components/navigation/AppLink';
import { ArticleContent } from '@/components/docs/ArticleContent';
import { DocsSidebar } from '@/components/docs/DocsSidebar';
import { DOCS, CATEGORY_LABELS, getArticleBySlug } from '@/content/docs';

export default function DocArticlePage() {
  const params = useParams();
  const slug = typeof params.slug === 'string' ? params.slug : '';

  const article = getArticleBySlug(slug);

  // Prev / next navigation within all articles
  const currentIndex = DOCS.findIndex(a => a.slug === slug);
  const prevArticle = currentIndex > 0 ? DOCS[currentIndex - 1] : null;
  const nextArticle = currentIndex < DOCS.length - 1 ? DOCS[currentIndex + 1] : null;

  if (!article) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-muted-foreground">Article not found.</p>
        <AppLink href="/docs" className="text-primary hover:underline text-sm mt-2 inline-block">
          ← Back to docs
        </AppLink>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex gap-10">
        {/* Sidebar */}
        <div className="hidden lg:block shrink-0">
          <DocsSidebar currentSlug={slug} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <AppLink href="/docs" className="hover:text-foreground transition-colors">
              Docs
            </AppLink>
            <span>/</span>
            <span>{CATEGORY_LABELS[article.category]}</span>
            <span>/</span>
            <span className="text-foreground">{article.title}</span>
          </div>

          {/* Article header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight mb-3">{article.title}</h1>
            <p className="text-muted-foreground">{article.description}</p>
            <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{article.readTime} min read</span>
            </div>
          </div>

          {/* Article body */}
          <ArticleContent content={article.content} />

          {/* Prev / Next navigation */}
          <div className="mt-12 pt-6 border-t border-border flex items-center justify-between gap-4">
            <div>
              {prevArticle && (
                <AppLink
                  href={`/docs/${prevArticle.slug}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                >
                  <ChevronLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                  <div>
                    <p className="text-xs text-muted-foreground">Previous</p>
                    <p className="text-foreground font-medium group-hover:text-primary transition-colors">
                      {prevArticle.title}
                    </p>
                  </div>
                </AppLink>
              )}
            </div>
            <div className="text-right">
              {nextArticle && (
                <AppLink
                  href={`/docs/${nextArticle.slug}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                >
                  <div>
                    <p className="text-xs text-muted-foreground">Next</p>
                    <p className="text-foreground font-medium group-hover:text-primary transition-colors">
                      {nextArticle.title}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </AppLink>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
