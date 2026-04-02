'use client';

import { useState, useRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { useUser } from '@clerk/nextjs';
import { toast } from '@/hooks/use-toast';
import { useLanguagePreference } from '@/hooks/useLanguagePreference';
import { useDictation } from '@/hooks/useDictation';
import { extractAndSaveNoteFacts } from '@/lib/noteFactsExtraction';
import { useNoteReconciliation } from '@/hooks/useNoteReconciliation';

interface QuickNoteButtonProps {
  encounterId: Id<'encounters'>;
}


export function QuickNoteButton({ encounterId }: QuickNoteButtonProps) {
  const { user } = useUser();
  const { language } = useLanguagePreference();

  const [transcript, setTranscript] = useState('');
  const transcriptRef = useRef('');

  const addAddendum = useMutation(api.encounters.addAddendum);
  const createRecording = useMutation(api.recordings.createRecording);
  const { runReconciliation } = useNoteReconciliation(encounterId);

  const saveTranscript = async () => {
    const text = transcriptRef.current.trim();
    transcriptRef.current = '';
    setTranscript('');
    if (!text || !user?.id) return;
    try {
      await addAddendum({ encounterId, text, providerId: user.id });
      extractAndSaveNoteFacts(encounterId, text, createRecording, runReconciliation);
      toast({ title: 'Note saved' });
    } catch {
      toast({ title: 'Failed to save note', variant: 'destructive' });
    }
  };

  const { state, audioLevel: _audioLevel, start, stop } = useDictation({
    language,
    onFinalSegment: (text) => {
      const next = (transcriptRef.current + ' ' + text).trim();
      transcriptRef.current = next;
      setTranscript(next);
    },
    onEnded: saveTranscript,
    onError: (message) => {
      toast({ title: message, variant: 'destructive' });
    },
  });

  const handleClick = async () => {
    if (state === 'idle') {
      transcriptRef.current = '';
      setTranscript('');
      try {
        await start();
      } catch (err: unknown) {
        toast({
          title: 'Could not start recording',
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        });
      }
    } else if (state === 'recording') {
      stop();
    }
  };

  const isActive = state === 'recording';
  const isBusy = state === 'connecting';

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className={`h-8 w-8 transition-colors ${
          isActive
            ? 'text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        onClick={handleClick}
        title={state === 'idle' ? 'Quick note' : state === 'recording' ? 'Stop recording' : undefined}
        disabled={isBusy}
      >
        {isBusy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isActive ? (
          <Square className="h-3.5 w-3.5 fill-current" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>

      {isActive && (
        <div className="absolute right-0 top-10 z-50 w-72 rounded-lg border bg-card shadow-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
            <span className="text-xs font-medium">Recording — tap to stop</span>
          </div>
          <p className="text-sm min-h-[2.5rem] leading-relaxed">
            {transcript
              ? transcript
              : <span className="text-muted-foreground italic text-xs">Listening…</span>
            }
          </p>
        </div>
      )}
    </div>
  );
}
