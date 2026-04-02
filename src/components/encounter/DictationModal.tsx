'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Loader2, AlignLeft, List, ListOrdered, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { useUser } from '@clerk/nextjs';
import { toast } from '@/hooks/use-toast';
import { useLanguagePreference } from '@/hooks/useLanguagePreference';
import { useDictation } from '@/hooks/useDictation';
import { AudioLevelIndicator } from './AudioLevelIndicator';
import { extractAndSaveNoteFacts } from '@/lib/noteFactsExtraction';
import { useNoteReconciliation } from '@/hooks/useNoteReconciliation';
import {
  createDictationState,
  processSegment,
  finalizeState,
  stateToMarkdown,
  getRenderedContent,
  type DictationState,
  type DictationMode,
} from '@/lib/dictationCommands';

type Stage = 'idle' | 'recording' | 'processing' | 'reviewing' | 'saving';

interface DictationModalProps {
  encounterId: Id<'encounters'>;
}

const MODE_LABELS: Record<DictationMode, { label: string; icon: React.ReactNode }> = {
  paragraph: { label: 'Paragraph', icon: <AlignLeft className="h-3 w-3" /> },
  bullet: { label: 'Bullet list', icon: <List className="h-3 w-3" /> },
  numbered: { label: 'Numbered list', icon: <ListOrdered className="h-3 w-3" /> },
};


export function DictationModal({ encounterId }: DictationModalProps) {
  const { user } = useUser();
  const { language } = useLanguagePreference();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const [dictationState, setDictationState] = useState<DictationState>(createDictationState());
  const [editableText, setEditableText] = useState('');
  const [interimText, setInterimText] = useState('');

  const dictStateRef = useRef<DictationState>(createDictationState());

  const addAddendum = useMutation(api.encounters.addAddendum);
  const createRecording = useMutation(api.recordings.createRecording);
  const setAddendumFactCount = useMutation(api.encounters.setAddendumFactCount);
  const { runReconciliation } = useNoteReconciliation(encounterId);

  const enterReview = useCallback(() => {
    const finalized = finalizeState(dictStateRef.current);
    const md = stateToMarkdown(finalized);
    setEditableText(md || '');
    setDictationState(finalized);
    setStage('reviewing');
  }, []);

  const { state: dictState, audioLevel, start, stop } = useDictation({
    language,
    onFinalSegment: (text) => {
      const next = processSegment(text, dictStateRef.current);
      dictStateRef.current = next;
      setDictationState({ ...next });
      setInterimText('');
    },
    onInterimSegment: (text) => {
      console.log('[DictationModal] onInterimSegment:', text);
      setInterimText(text);
    },
    onEnded: () => {
      setInterimText('');
      enterReview();
    },
    onError: (message) => {
      setInterimText('');
      setStage('idle');
      setOpen(false);
      toast({ title: message, variant: 'destructive' });
    },
  });

  // Sync hook connecting state → modal stage
  useEffect(() => {
    if (dictState === 'connecting') setStage('recording'); // show "connecting" via dictState check
    if (dictState === 'recording') setStage('recording');
  }, [dictState]);

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      const fresh = createDictationState();
      setDictationState(fresh);
      dictStateRef.current = fresh;
      setEditableText('');
      setInterimText('');
      setStage('idle');
    }
  }, [open]);

  const startRecording = async () => {
    const fresh = createDictationState();
    setDictationState(fresh);
    dictStateRef.current = fresh;
    setOpen(true);
    try {
      await start();
    } catch (err: unknown) {
      setOpen(false);
      toast({
        title: 'Could not start recording',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const stopRecording = useCallback(() => {
    setStage('processing');
    stop();
  }, [stop]);

  const saveNote = async () => {
    const text = editableText.trim();
    if (!text || !user?.id) return;
    setStage('saving');
    try {
      const result = await addAddendum({ encounterId, text, providerId: user.id });
      const noteIndex = result?.noteIndex ?? -1;
      // Fire-and-forget: extract clinical facts, save as a note recording, and reconcile
      extractAndSaveNoteFacts(
        encounterId, text, createRecording, runReconciliation,
        noteIndex >= 0 ? (count) => setAddendumFactCount({ encounterId, index: noteIndex, factCount: count }) : undefined,
        language,
      );
      toast({ title: 'Note saved' });
      setOpen(false);
    } catch {
      toast({ title: 'Failed to save note', variant: 'destructive' });
      setStage('reviewing');
    }
  };

  const isConnecting = dictState === 'connecting';
  const isRecording = stage === 'recording';
  const rendered = getRenderedContent(dictationState);
  const modeInfo = MODE_LABELS[rendered.mode];

  return (
    <>
      {/* Trigger button */}
      <Button
        variant="outline"
        className="gap-2"
        onClick={startRecording}
        disabled={stage !== 'idle'}
      >
        <Mic className="h-4 w-4" />
        Dictate Note
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v && stage !== 'recording' && stage !== 'processing') setOpen(false);
        }}
      >
        <DialogContent className="max-w-2xl w-full p-0 gap-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="px-6 pt-5 pb-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Mic className="h-4 w-4 text-muted-foreground" />
                Dictate Note
              </DialogTitle>
              <div className="flex items-center gap-3">
                {/* Mode indicator */}
                {isRecording && !isConnecting && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {modeInfo.icon}
                    {modeInfo.label}
                  </span>
                )}
                {/* Recording state indicator */}
                {(isRecording || isConnecting) && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                    {isConnecting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        <AudioLevelIndicator level={audioLevel} />
                      </>
                    )}
                    {isConnecting ? 'Connecting…' : 'Recording'}
                  </span>
                )}
                {stage === 'processing' && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processing…
                  </span>
                )}
                {stage === 'reviewing' && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    Review &amp; edit
                  </span>
                )}
                {/* Close — only when not actively recording or processing */}
                {stage !== 'recording' && stage !== 'processing' && (
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-sm opacity-70 hover:opacity-100 transition-opacity"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Body */}
          <div className="min-h-[280px] max-h-[420px] overflow-y-auto">
            {/* Live transcript — during recording */}
            {isRecording && (
              <div className="p-6 space-y-1">
                {isConnecting && rendered.blocks.length === 0 && (
                  <p className="text-muted-foreground italic text-sm animate-pulse">
                    Listening…
                  </p>
                )}
                {/* Finalized blocks */}
                {rendered.blocks.length > 0 && (
                  <div className="space-y-1.5 mb-2">
                    {rendered.blocks.map((block, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                        {block.type === 'bullet' && (
                          <span className="mt-0.5 text-primary font-bold flex-shrink-0">•</span>
                        )}
                        {block.type === 'numbered' && (
                          <span className="mt-0.5 text-primary font-medium flex-shrink-0 min-w-[1.5rem]">
                            {block.number}.
                          </span>
                        )}
                        <span>{block.text}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Pending text — final segments not yet block-committed */}
                {rendered.pendingText && (
                  <div className="flex items-start gap-2 text-sm leading-relaxed">
                    {rendered.mode === 'bullet' && (
                      <span className="mt-0.5 text-primary font-bold flex-shrink-0 opacity-60">•</span>
                    )}
                    {rendered.mode === 'numbered' && (
                      <span className="mt-0.5 text-primary font-medium flex-shrink-0 min-w-[1.5rem] opacity-60">
                        {dictationState.numberedCounter + 1}.
                      </span>
                    )}
                    <span className="opacity-80">
                      {rendered.pendingText}
                      {!interimText && (
                        <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 align-middle animate-pulse" />
                      )}
                    </span>
                  </div>
                )}
                {/* Interim text — live preview, greyed out, replaced by next interim */}
                {interimText && (
                  <div className="flex items-start gap-2 text-sm leading-relaxed">
                    {rendered.mode === 'bullet' && (
                      <span className="mt-0.5 text-primary font-bold flex-shrink-0 opacity-30">•</span>
                    )}
                    {rendered.mode === 'numbered' && (
                      <span className="mt-0.5 text-primary font-medium flex-shrink-0 min-w-[1.5rem] opacity-30">
                        {dictationState.numberedCounter + 1}.
                      </span>
                    )}
                    <span className="text-muted-foreground opacity-60 italic">
                      {interimText}
                      <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 align-middle animate-pulse" />
                    </span>
                  </div>
                )}
                {/* Empty — connected but no speech yet */}
                {!isConnecting && rendered.blocks.length === 0 && !rendered.pendingText && (
                  <p className="text-muted-foreground italic text-sm">
                    Speak now… say "bullet point" to start a list
                  </p>
                )}
              </div>
            )}

            {/* Review / edit view */}
            {stage === 'reviewing' && (
              <div className="p-6">
                <textarea
                  className="w-full min-h-[240px] text-sm leading-relaxed bg-transparent resize-none outline-none focus:outline-none font-mono"
                  value={editableText}
                  onChange={(e) => setEditableText(e.target.value)}
                  placeholder="Your dictated note will appear here…"
                  autoFocus
                />
              </div>
            )}

            {stage === 'processing' && (
              <div className="p-6 relative">
                <div className="space-y-1.5 opacity-40">
                  {rendered.blocks.map((block, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                      {block.type === 'bullet' && (
                        <span className="mt-0.5 text-primary font-bold flex-shrink-0">•</span>
                      )}
                      {block.type === 'numbered' && (
                        <span className="mt-0.5 text-primary font-medium flex-shrink-0 min-w-[1.5rem]">
                          {block.number}.
                        </span>
                      )}
                      <span>{block.text}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing final audio…
                </div>
              </div>
            )}

            {stage === 'saving' && (
              <div className="flex items-center justify-center h-[280px] gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Saving…</span>
              </div>
            )}
          </div>

          {/* Voice command hint bar */}
          {isRecording && !isConnecting && (
            <div className="px-6 py-2 bg-muted/40 border-t border-b text-[11px] text-muted-foreground flex items-center gap-4">
              <span><strong>"bullet point"</strong> — start bullet</span>
              <span><strong>"next number"</strong> — numbered list</span>
              <span><strong>"new line"</strong> — new paragraph</span>
              <span><strong>"period"</strong> — full stop</span>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-4 flex items-center justify-between gap-3">
            {isRecording && (
              <>
                <p className="text-xs text-muted-foreground">
                  {rendered.blocks.length + (rendered.pendingText ? 1 : 0)} block
                  {rendered.blocks.length + (rendered.pendingText ? 1 : 0) !== 1 ? 's' : ''} captured
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                  onClick={stopRecording}
                  disabled={isConnecting}
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                  Stop &amp; Review
                </Button>
              </>
            )}

            {stage === 'processing' && (
              <p className="text-xs text-muted-foreground">Finalising transcript…</p>
            )}

            {stage === 'reviewing' && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  Discard
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={startRecording}
                  >
                    <Mic className="h-3.5 w-3.5" />
                    Re-record
                  </Button>
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={saveNote}
                    disabled={!editableText.trim()}
                  >
                    Save Note
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
