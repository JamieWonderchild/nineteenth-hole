'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Loader2, Pencil, AlignLeft, List, ListOrdered, X } from 'lucide-react';
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
import { CortiClient, CortiEnvironment } from '@corti/sdk';
import {
  createDictationState,
  processSegment,
  finalizeState,
  stateToMarkdown,
  getRenderedContent,
  type DictationState,
  type DictationMode,
} from '@/lib/dictationCommands';

type Stage = 'idle' | 'connecting' | 'recording' | 'reviewing' | 'saving';

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
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const [dictationState, setDictationState] = useState<DictationState>(createDictationState());
  const [editableText, setEditableText] = useState('');

  const wsRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dictStateRef = useRef<DictationState>(createDictationState());

  const addAddendum = useMutation(api.encounters.addAddendum);

  const cleanup = useCallback(() => {
    wsRef.current?.close?.();
    wsRef.current = null;
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  // Reset everything when modal closes
  useEffect(() => {
    if (!open) {
      cleanup();
      setStage('idle');
      const fresh = createDictationState();
      setDictationState(fresh);
      dictStateRef.current = fresh;
      setEditableText('');
    }
  }, [open, cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  const startAudioCapture = useCallback((stream: MediaStream, socket: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/mp4';
    const mr = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mr;
    mr.ondataavailable = (e) => {
      if (e.data.size > 0 && socket.readyState === 1) socket.sendAudio(e.data);
    };
    mr.start(200);
  }, []);

  const enterReview = useCallback(() => {
    const finalized = finalizeState(dictStateRef.current);
    const md = stateToMarkdown(finalized);
    setEditableText(md || '');
    setDictationState(finalized);
    setStage('reviewing');
  }, []);

  const startRecording = async () => {
    const fresh = createDictationState();
    setDictationState(fresh);
    dictStateRef.current = fresh;
    setOpen(true);
    setStage('connecting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });
      streamRef.current = stream;

      const res = await fetch('/api/corti/transcribe', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to connect to transcription service');
      const { accessToken, tenantName, environment } = await res.json();

      const client = new CortiClient({
        tenantName,
        environment: environment === 'us' ? CortiEnvironment.Us : CortiEnvironment.Eu,
        auth: { accessToken },
      });

      const socket = await client.transcribe.connect({
        configuration: { primaryLanguage: 'en', automaticPunctuation: true },
        reconnectAttempts: 0,
      });
      wsRef.current = socket;

      socket.on('message', (msg: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (msg.type === 'CONFIG_ACCEPTED') {
          startAudioCapture(stream, socket);
          setStage('recording');
        }

        if (msg.type === 'transcript') {
          const { text, isFinal } = msg.data ?? {};
          if (isFinal && text) {
            const next = processSegment(text, dictStateRef.current);
            dictStateRef.current = next;
            setDictationState({ ...next });
          }
        }

        if (msg.type === 'ended') {
          cleanup();
          enterReview();
        }

        if (msg.type === 'error') {
          cleanup();
          setStage('idle');
          setOpen(false);
          toast({ title: (msg as any).message || 'Transcription error', variant: 'destructive' }); // eslint-disable-line @typescript-eslint/no-explicit-any
        }
      });

      socket.on('error', (err: Error) => {
        cleanup();
        setStage('idle');
        setOpen(false);
        toast({ title: err.message || 'Connection error', variant: 'destructive' });
      });
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      cleanup();
      setStage('idle');
      setOpen(false);
      toast({ title: 'Could not start recording', description: err.message, variant: 'destructive' });
    }
  };

  const stopRecording = useCallback(() => {
    if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: 'end' }));
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
  }, []);

  const saveNote = async () => {
    const text = editableText.trim();
    if (!text || !user?.id) return;
    setStage('saving');
    try {
      await addAddendum({ encounterId, text, providerId: user.id });
      toast({ title: 'Note saved' });
      setOpen(false);
    } catch {
      toast({ title: 'Failed to save note', variant: 'destructive' });
      setStage('reviewing');
    }
  };

  const rendered = getRenderedContent(dictationState);
  const modeInfo = MODE_LABELS[rendered.mode];
  const hasContent = rendered.blocks.length > 0 || rendered.pendingText.length > 0;

  return (
    <>
      {/* Trigger button */}
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={startRecording}
        disabled={stage !== 'idle'}
      >
        <Pencil className="h-4 w-4" />
        Dictate Note
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v && stage !== 'recording' && stage !== 'connecting') setOpen(false); }}>
        <DialogContent className="max-w-2xl w-full p-0 gap-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="px-6 pt-5 pb-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Pencil className="h-4 w-4 text-muted-foreground" />
                Dictate Note
              </DialogTitle>
              <div className="flex items-center gap-3">
                {/* Mode indicator */}
                {stage === 'recording' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {modeInfo.icon}
                    {modeInfo.label}
                  </span>
                )}
                {/* Recording indicator */}
                {(stage === 'recording' || stage === 'connecting') && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500">
                    {stage === 'connecting' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                    {stage === 'connecting' ? 'Connecting…' : 'Recording'}
                  </span>
                )}
                {stage === 'reviewing' && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    Review &amp; edit
                  </span>
                )}
                {/* Close — only when not actively recording */}
                {stage !== 'recording' && stage !== 'connecting' && (
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
            {/* Live transcript view — during recording */}
            {(stage === 'recording' || stage === 'connecting') && (
              <div className="p-6 space-y-1">
                {stage === 'connecting' && !hasContent && (
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
                        <span className={block.type !== 'paragraph' ? '' : 'pl-0'}>
                          {block.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {/* In-progress (pending) text */}
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
                      <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 align-middle animate-pulse" />
                    </span>
                  </div>
                )}
                {/* Empty state — connected but no speech yet */}
                {stage === 'recording' && !hasContent && !rendered.pendingText && (
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

            {stage === 'saving' && (
              <div className="flex items-center justify-center h-[280px] gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Saving…</span>
              </div>
            )}
          </div>

          {/* Hint bar — only during recording */}
          {stage === 'recording' && (
            <div className="px-6 py-2 bg-muted/40 border-t border-b text-[11px] text-muted-foreground flex items-center gap-4">
              <span><strong>"bullet point"</strong> — start bullet</span>
              <span><strong>"next number"</strong> — numbered list</span>
              <span><strong>"new line"</strong> — new paragraph</span>
              <span><strong>"period"</strong> — full stop</span>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-4 flex items-center justify-between gap-3">
            {stage === 'recording' && (
              <>
                <p className="text-xs text-muted-foreground">
                  {rendered.blocks.length + (rendered.pendingText ? 1 : 0)} block
                  {rendered.blocks.length !== 1 ? 's' : ''} captured
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                  onClick={stopRecording}
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                  Stop &amp; Review
                </Button>
              </>
            )}

            {stage === 'connecting' && (
              <div className="ml-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { cleanup(); setOpen(false); }}
                >
                  Cancel
                </Button>
              </div>
            )}

            {stage === 'reviewing' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                >
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
