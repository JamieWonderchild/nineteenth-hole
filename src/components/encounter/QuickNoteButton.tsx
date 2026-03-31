'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { useUser } from '@clerk/nextjs';
import { toast } from '@/hooks/use-toast';
import { useLanguagePreference } from '@/hooks/useLanguagePreference';
import { CortiClient, CortiEnvironment } from '@corti/sdk';

type State = 'idle' | 'connecting' | 'recording' | 'saving';

interface QuickNoteButtonProps {
  encounterId: Id<'encounters'>;
}

export function QuickNoteButton({ encounterId }: QuickNoteButtonProps) {
  const { user } = useUser();
  const { language } = useLanguagePreference();
  const [state, setState] = useState<State>('idle');
  const [transcript, setTranscript] = useState('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wsRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptRef = useRef<string>('');

  const addAddendum = useMutation(api.encounters.addAddendum);

  const cleanup = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const saveTranscript = useCallback(async () => {
    const text = transcriptRef.current.trim();
    if (!text || !user?.id) {
      setState('idle');
      return;
    }
    setState('saving');
    try {
      await addAddendum({ encounterId, text, providerId: user.id });
      toast({ title: 'Note saved' });
    } catch {
      toast({ title: 'Failed to save note', variant: 'destructive' });
    }
    transcriptRef.current = '';
    setTranscript('');
    setState('idle');
  }, [addAddendum, encounterId, user?.id]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const startAudioCapture = (stream: MediaStream, socket: any) => {
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/mp4';
    const mr = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mr;
    mr.ondataavailable = (e) => {
      if (e.data.size > 0 && socket.readyState === 1 /* OPEN */) socket.sendAudio(e.data);
    };
    mr.start(250);
  };

  const startRecording = async () => {
    transcriptRef.current = '';
    setTranscript('');
    setState('connecting');

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
        configuration: { primaryLanguage: language, automaticPunctuation: true },
        reconnectAttempts: 0,
      });
      wsRef.current = socket;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket.on('message', (msg: any) => {
        if (msg.type === 'CONFIG_ACCEPTED') {
          startAudioCapture(stream, socket);
          setState('recording');
        }

        if (msg.type === 'transcript') {
          const { text, isFinal } = msg.data ?? {};
          if (isFinal && text) {
            transcriptRef.current = (transcriptRef.current + ' ' + text).trim();
            setTranscript(transcriptRef.current);
          }
        }

        if (msg.type === 'ended') {
          cleanup();
          saveTranscript();
        }

        if (msg.type === 'error') {
          cleanup();
          setState('idle');
          toast({ title: (msg as any).message || 'Transcription error', variant: 'destructive' });
        }
      });

      socket.on('error', (err: Error) => {
        cleanup();
        setState('idle');
        toast({ title: err.message || 'Connection error', variant: 'destructive' });
      });
    } catch (err: any) {
      cleanup();
      setState('idle');
      toast({
        title: 'Could not start recording',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (wsRef.current?.readyState === 1 /* OPEN */) {
      wsRef.current.send(JSON.stringify({ type: 'end' }));
    }
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className={`h-8 w-8 ${state === 'recording' ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground hover:text-foreground'}`}
        onClick={state === 'idle' ? startRecording : state === 'recording' ? stopRecording : undefined}
        title={state === 'idle' ? 'Quick note' : state === 'recording' ? 'Stop recording' : undefined}
        disabled={state === 'connecting' || state === 'saving'}
      >
        {state === 'saving' || state === 'connecting' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : state === 'recording' ? (
          <Square className="h-3.5 w-3.5 fill-current" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>

      {state === 'recording' && (
        <div className="absolute right-0 top-10 z-50 w-72 rounded-lg border bg-card shadow-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
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
