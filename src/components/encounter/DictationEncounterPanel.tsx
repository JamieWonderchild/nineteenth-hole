'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useLanguagePreference } from '@/hooks/useLanguagePreference';
import { useDictation } from '@/hooks/useDictation';
import { AudioLevelIndicator } from './AudioLevelIndicator';
import {
  createDictationState,
  processSegment,
  finalizeState,
  stateToMarkdown,
  type DictationState,
} from '@/lib/dictationCommands';
import type { EncounterSession } from '@/types/corti';

interface DictationEncounterPanelProps {
  onSessionComplete: (session: EncounterSession) => void;
  encounterId?: string;
}

type Stage = 'idle' | 'recording' | 'done';

export function DictationEncounterPanel({ onSessionComplete, encounterId }: DictationEncounterPanelProps) {
  const { language } = useLanguagePreference();
  const [stage, setStage] = useState<Stage>('idle');
  const [dictationState, setDictationState] = useState<DictationState>(createDictationState());
  const [interimText, setInterimText] = useState('');
  const [transcript, setTranscript] = useState('');
  const startTimeRef = useRef<number | null>(null);
  const dictStateRef = useRef<DictationState>(createDictationState());

  const enterDone = useCallback(() => {
    const finalized = finalizeState(dictStateRef.current);
    const md = stateToMarkdown(finalized) || '';
    setTranscript(md);
    setDictationState(finalized);
    setInterimText('');
    setStage('done');
  }, []);

  const { state: dictState, audioLevel, start, stop } = useDictation({
    language,
    onFinalSegment: (text) => {
      const next = processSegment(text, dictStateRef.current);
      dictStateRef.current = next;
      setDictationState({ ...next });
      setInterimText('');
    },
    onInterimSegment: (text) => setInterimText(text),
    onEnded: enterDone,
    onError: (message) => {
      setStage('idle');
      toast({ title: message, variant: 'destructive' });
    },
  });

  // Auto-start on mount
  useEffect(() => {
    const autoStart = async () => {
      const fresh = createDictationState();
      setDictationState(fresh);
      dictStateRef.current = fresh;
      startTimeRef.current = Date.now();
      try {
        await start();
      } catch (err) {
        toast({
          title: 'Could not start recording',
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        });
      }
    };
    autoStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (dictState === 'recording') setStage('recording');
  }, [dictState]);

  const handleStop = () => {
    stop();
  };

  const handleDone = () => {
    const duration = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : 0;
    onSessionComplete({
      interactionId: `dictation-${Date.now()}`,
      transcript: [],
      transcriptText: transcript,
      facts: [],
      duration,
      createdAt: new Date().toISOString(),
      encounterId,
    });
  };

  const renderedText = (() => {
    if (stage === 'done') return transcript;
    const lines = dictationState.blocks.map((b) => {
      if (b.type === 'bullet') return `• ${b.text}`;
      if (b.type === 'numbered') return `${b.number ?? ''}. ${b.text}`;
      return b.text;
    });
    if (dictationState.pendingText) lines.push(dictationState.pendingText);
    return lines.join('\n');
  })();

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Dictate Note</span>
        </div>
        <div className="flex items-center gap-3">
          {stage === 'recording' && (
            <AudioLevelIndicator level={audioLevel} className="w-16" />
          )}
          {(stage === 'idle' || dictState === 'connecting') && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Connecting…
            </div>
          )}
        </div>
      </div>

      {/* Transcript area */}
      <div className="px-5 py-4 min-h-[200px]">
        {renderedText ? (
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{renderedText}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            {stage === 'recording' ? 'Listening…' : 'Starting microphone…'}
          </p>
        )}
        {interimText && (
          <span className="text-sm text-muted-foreground italic"> {interimText}</span>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-5 py-3 border-t border-border bg-muted/40 flex justify-end gap-2">
        {stage === 'recording' && (
          <Button variant="destructive" size="sm" onClick={handleStop} className="gap-1.5">
            <Square className="h-3.5 w-3.5 fill-current" />
            Stop
          </Button>
        )}
        {stage === 'done' && (
          <Button size="sm" onClick={handleDone} disabled={!transcript.trim()}>
            Save &amp; Continue
          </Button>
        )}
      </div>
    </div>
  );
}
