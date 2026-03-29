'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Copy, Printer, Pencil, Check, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';

interface DocumentSection {
  key: string;
  title: string;
  content: string;
}

interface DocumentViewerProps {
  title: string;
  sections: DocumentSection[];
  generatedAt: string;
  // For inline editing + autosave
  encounterId?: string;
  docKey?: string; // e.g. 'soapNote', 'afterVisitSummary'
  // Hide the title/timestamp header (when used inside a collapsible that already has a trigger)
  hideHeader?: boolean;
  // Optional extra actions rendered in the header toolbar (e.g. regenerate button)
  headerActions?: React.ReactNode;
}

const AUTOSAVE_DELAY = 1200; // ms after last keystroke

export function DocumentViewer({ title, sections, generatedAt, encounterId, docKey, hideHeader, headerActions }: DocumentViewerProps) {
  const updateSection = useMutation(api.encounters.updateDocumentSection);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedIndex, setSavedIndex] = useState<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canEdit = !!encounterId && !!docKey;

  const fullText = sections.map((s) => `${s.title}\n${s.content}`).join('\n\n');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullText);
    toast({ title: 'Copied to clipboard' });
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>${title}</title>
      <style>body{font-family:system-ui,sans-serif;padding:2rem;max-width:800px;margin:0 auto}
      h1{font-size:1.5rem;margin-bottom:0.5rem}h2{font-size:1.1rem;margin-top:1.5rem;margin-bottom:0.5rem}
      p{line-height:1.6;white-space:pre-wrap}.meta{color:#666;font-size:0.85rem;margin-bottom:2rem}</style>
      </head><body>
      <h1>${title}</h1>
      <p class="meta">Generated: ${new Date(generatedAt).toLocaleString()}</p>
      ${sections.map((s) => `<h2>${s.title}</h2><p>${s.content}</p>`).join('')}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Save section content to DB
  const saveSection = useCallback(async (sectionIndex: number, content: string) => {
    if (!encounterId || !docKey) return;
    setIsSaving(true);
    try {
      await updateSection({
        encounterId: encounterId as Id<'encounters'>,
        docKey,
        sectionIndex,
        content,
      });
      setSavedIndex(sectionIndex);
      setTimeout(() => setSavedIndex(null), 1500);
    } catch (err) {
      console.error('[DocumentViewer] Save failed:', err);
      toast({ title: 'Save failed', description: 'Could not save edit', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [encounterId, docKey, updateSection]);

  // Debounced autosave on content change
  const handleContentChange = useCallback((value: string, sectionIndex: number) => {
    setEditContent(value);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveSection(sectionIndex, value);
    }, AUTOSAVE_DELAY);
  }, [saveSection]);

  // Start editing a section
  const startEditing = (index: number) => {
    if (!canEdit) return;
    // Save any pending edits from previous section
    if (editingIndex !== null && editingIndex !== index && saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveSection(editingIndex, editContent);
    }
    setEditingIndex(index);
    setEditContent(sections[index].content);
  };

  // Finish editing (blur or explicit save)
  const finishEditing = useCallback(() => {
    if (editingIndex === null) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    // Save if content changed
    if (editContent !== sections[editingIndex].content) {
      saveSection(editingIndex, editContent);
    }
    setEditingIndex(null);
  }, [editingIndex, editContent, sections, saveSection]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current && editingIndex !== null) {
      const ta = textareaRef.current;
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
      ta.focus();
    }
  }, [editingIndex, editContent]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return (
    <div className="space-y-3">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-sm">{title}</h4>
            <p className="text-xs text-muted-foreground">
              {new Date(generatedAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {isSaving && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving
              </span>
            )}
            {headerActions}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {hideHeader && isSaving && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving
          </span>
        )}
        {sections.map((section, idx) => (
          <div key={section.key} className="group">
            <div className="flex items-center justify-between mb-1">
              <h5 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {section.title}
              </h5>
              <div className="flex items-center gap-1">
                {savedIndex === idx && (
                  <span className="text-xs text-green-600 flex items-center gap-0.5">
                    <Check className="h-3 w-3" />
                    Saved
                  </span>
                )}
                {canEdit && editingIndex !== idx && (
                  <button
                    onClick={() => startEditing(idx)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                  >
                    <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
                  </button>
                )}
              </div>
            </div>
            {editingIndex === idx ? (
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => handleContentChange(e.target.value, idx)}
                onBlur={finishEditing}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') finishEditing();
                }}
                className="w-full text-sm whitespace-pre-wrap border rounded-md p-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary min-h-[60px]"
              />
            ) : (
              <div
                className={`text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:mt-2 prose-headings:mb-1 prose-strong:font-semibold prose-strong:text-foreground/80 prose-pre:bg-muted prose-pre:text-foreground prose-code:bg-muted prose-code:text-foreground prose-code:before:content-none prose-code:after:content-none dark:prose-invert ${canEdit ? 'cursor-text hover:bg-muted/30 rounded px-1 -mx-1 transition-colors' : ''}`}
                onClick={() => canEdit && startEditing(idx)}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown>
              </div>
            )}
          </div>
        ))}
        {/* Copy/Print — compact bottom-right toolbar */}
        {hideHeader && (
          <div className="flex items-center justify-end gap-1 pt-1 border-t">
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground" onClick={handleCopy}>
              <Copy className="h-3 w-3" />
              Copy
            </Button>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground" onClick={handlePrint}>
              <Printer className="h-3 w-3" />
              Print
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
