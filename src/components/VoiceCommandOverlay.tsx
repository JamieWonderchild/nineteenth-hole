'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { CortiClient, CortiEnvironment } from '@corti/sdk';
import Fuse from 'fuse.js';
import { Mic, Loader2 } from 'lucide-react';
import { useOrgCtx } from '@/app/providers/org-context-provider';
import type { VoiceCommandIntent, VoiceOverlayState } from '@/types/voiceCommand';
import type { Id } from 'convex/_generated/dataModel';

const SILENCE_THRESHOLD = 0.04;
const SILENCE_DURATION_MS = 1500;
const MAX_LISTEN_MS = 8000;

interface EncounterStub {
  _id: Id<'encounters'>;
  patientName: string | null;
}

export function VoiceCommandOverlay() {
  const router = useRouter();
  const { orgContext } = useOrgCtx();
  const [overlayState, setOverlayState] = useState<VoiceOverlayState>('idle');
  const [interimText, setInterimText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [statusLabel, setStatusLabel] = useState('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wsRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxListenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSpeechRef = useRef(false);
  const finalTextRef = useRef('');
  const isCancelledRef = useRef(false);

  const orgId = orgContext?.orgId as Id<'organizations'> | undefined;
  const encounters = useQuery(
    api.encounters.getDraftConsultations,
    orgId ? { orgId } : 'skip'
  ) as EncounterStub[] | undefined;

  // ── Cleanup ────────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (maxListenTimerRef.current) { clearTimeout(maxListenTimerRef.current); maxListenTimerRef.current = null; }
    audioContextRef.current?.close().catch(() => null);
    audioContextRef.current = null;
    analyserRef.current = null;
    wsRef.current?.close?.();
    wsRef.current = null;
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    hasSpeechRef.current = false;
    finalTextRef.current = '';
    isCancelledRef.current = false;
  }, []);

  // ── Silence detection ──────────────────────────────────────────────────────

  const startSilenceDetection = useCallback((stream: MediaStream, onSilence: () => void) => {
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioContextRef.current = ctx;
      analyserRef.current = analyser;

      const buf = new Float32Array(analyser.fftSize);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);

        if (rms > SILENCE_THRESHOLD) {
          hasSpeechRef.current = true;
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else if (hasSpeechRef.current && !silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            onSilence();
          }, SILENCE_DURATION_MS);
        }

        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // AudioContext unavailable
    }
  }, []);

  // ── Stop recording + classify ──────────────────────────────────────────────

  const stopAndClassify = useCallback(async () => {
    if (isCancelledRef.current) return;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (maxListenTimerRef.current) { clearTimeout(maxListenTimerRef.current); maxListenTimerRef.current = null; }

    wsRef.current?.send?.(JSON.stringify({ type: 'end' }));
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();

    const transcript = finalTextRef.current.trim();
    if (!transcript) {
      setStatusLabel("Didn't catch that");
      setOverlayState('error');
      setTimeout(() => { cleanup(); setOverlayState('idle'); }, 1500);
      return;
    }

    setOverlayState('processing');
    setStatusLabel('Processing…');
    setInterimText('');

    try {
      const res = await fetch('/api/corti/voice-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });
      const { intent } = await res.json() as { intent: VoiceCommandIntent };

      if (isCancelledRef.current) return;

      setOverlayState('executing');
      await executeIntent(intent, transcript);
    } catch {
      setStatusLabel('Error processing command');
      setOverlayState('error');
      setTimeout(() => { cleanup(); setOverlayState('idle'); }, 1500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanup]);

  // ── Intent execution ───────────────────────────────────────────────────────

  const executeIntent = useCallback(async (intent: VoiceCommandIntent, rawTranscript: string) => {
    const destinationLabels: Record<string, string> = {
      dashboard: 'Dashboard', encounters: 'Encounters',
      billing: 'Billing', catalog: 'Catalog', settings: 'Settings',
    };
    const destinationPaths: Record<string, string> = {
      dashboard: '/', encounters: '/encounters',
      billing: '/billing', catalog: '/billing?tab=catalog', settings: '/settings',
    };

    const matchPatient = (name: string): EncounterStub | null => {
      if (!encounters?.length) return null;
      const named = encounters.filter(e => e.patientName);
      if (!named.length) return null;
      const fuse = new Fuse(named, { keys: ['patientName'], threshold: 0.4 });
      const results = fuse.search(name);
      return results[0]?.item ?? null;
    };

    switch (intent.action) {
      case 'navigate': {
        const label = destinationLabels[intent.destination] ?? intent.destination;
        setStatusLabel(`Going to ${label}…`);
        await shortDelay();
        router.push(destinationPaths[intent.destination] ?? '/');
        break;
      }
      case 'open_patient': {
        const match = matchPatient(intent.patientName);
        if (match) {
          setStatusLabel(`Opening ${match.patientName}…`);
          await shortDelay();
          router.push(`/encounter/${match._id}`);
        } else {
          setStatusLabel(`Patient "${intent.patientName}" not found`);
          setOverlayState('error');
          setTimeout(() => { cleanup(); setOverlayState('idle'); }, 2000);
          return;
        }
        break;
      }
      case 'start_note': {
        if (intent.patientName) {
          const match = matchPatient(intent.patientName);
          if (match) {
            setStatusLabel(`Opening ${match.patientName} for note…`);
            await shortDelay();
            router.push(`/encounter/${match._id}?startNote=1`);
          } else {
            setStatusLabel(`Patient "${intent.patientName}" not found`);
            setOverlayState('error');
            setTimeout(() => { cleanup(); setOverlayState('idle'); }, 2000);
            return;
          }
        } else {
          setStatusLabel('Starting note…');
          await shortDelay();
          window.dispatchEvent(new CustomEvent('voice:start-note'));
        }
        break;
      }
      case 'create_invoice': {
        if (intent.patientName) {
          const match = matchPatient(intent.patientName);
          if (match) {
            setStatusLabel(`Creating invoice for ${match.patientName}…`);
            await shortDelay();
            router.push(`/encounter/${match._id}?createInvoice=1`);
          } else {
            setStatusLabel(`Patient "${intent.patientName}" not found`);
            setOverlayState('error');
            setTimeout(() => { cleanup(); setOverlayState('idle'); }, 2000);
            return;
          }
        } else {
          setStatusLabel('Opening billing…');
          await shortDelay();
          router.push('/billing');
        }
        break;
      }
      default: {
        setStatusLabel(`Didn't understand: "${rawTranscript}"`);
        setOverlayState('error');
        setTimeout(() => { cleanup(); setOverlayState('idle'); }, 2000);
        return;
      }
    }

    setOverlayState('idle');
    cleanup();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounters, router, cleanup]);

  // ── Start listening ────────────────────────────────────────────────────────

  const startListening = useCallback(async () => {
    isCancelledRef.current = false;
    finalTextRef.current = '';
    setFinalText('');
    setInterimText('');
    setOverlayState('connecting');
    setStatusLabel('Connecting…');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });
      streamRef.current = stream;

      const res = await fetch('/api/corti/transcribe', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to connect');
      const { accessToken, tenantName, environment } = await res.json();

      const client = new CortiClient({
        tenantName,
        environment: environment === 'us' ? CortiEnvironment.Us : CortiEnvironment.Eu,
        auth: { accessToken },
      });

      const socket = await client.transcribe.connect({
        configuration: { primaryLanguage: 'en', automaticPunctuation: true, interimResults: true },
        reconnectAttempts: 0,
      });
      wsRef.current = socket;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket.on('message', (msg: any) => {
        if (msg.type === 'CONFIG_ACCEPTED') {
          if (isCancelledRef.current) return;
          setOverlayState('listening');
          setStatusLabel('Listening…');

          const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus' : 'audio/mp4';
          const mr = new MediaRecorder(stream, { mimeType });
          mediaRecorderRef.current = mr;
          mr.ondataavailable = (e) => {
            if (e.data.size > 0 && socket.readyState === 1) socket.sendAudio(e.data);
          };
          mr.start(200);

          startSilenceDetection(stream, stopAndClassify);

          maxListenTimerRef.current = setTimeout(() => {
            stopAndClassify();
          }, MAX_LISTEN_MS);
        }

        if (msg.type === 'transcript') {
          const { text, isFinal } = msg.data ?? {};
          if (isFinal && text) {
            finalTextRef.current = (finalTextRef.current + ' ' + text).trim();
            setFinalText(finalTextRef.current);
            setInterimText('');
          } else if (!isFinal && text) {
            setInterimText(text);
          }
        }

        if (msg.type === 'ended') {
          if (!isCancelledRef.current) stopAndClassify();
        }

        if (msg.type === 'error') {
          if (!isCancelledRef.current) {
            setStatusLabel('Transcription error');
            setOverlayState('error');
            setTimeout(() => { cleanup(); setOverlayState('idle'); }, 1500);
          }
        }
      });

      socket.on('error', () => {
        if (!isCancelledRef.current) {
          setStatusLabel('Connection error');
          setOverlayState('error');
          setTimeout(() => { cleanup(); setOverlayState('idle'); }, 1500);
        }
      });
    } catch {
      setStatusLabel('Microphone unavailable');
      setOverlayState('error');
      setTimeout(() => { cleanup(); setOverlayState('idle'); }, 1500);
    }
  }, [cleanup, startSilenceDetection, stopAndClassify]);

  const cancel = useCallback(() => {
    isCancelledRef.current = true;
    cleanup();
    setOverlayState('idle');
    setInterimText('');
    setFinalText('');
  }, [cleanup]);

  // ── Cmd+K listener ─────────────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (overlayState === 'idle') {
          startListening();
        } else {
          cancel();
        }
      }
      if (e.key === 'Escape' && overlayState !== 'idle') {
        cancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [overlayState, startListening, cancel]);

  // Cleanup on unmount
  useEffect(() => () => cleanup(), [cleanup]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (overlayState === 'idle') return null;

  const isListening = overlayState === 'listening';
  const isError = overlayState === 'error';
  const displayText = finalText || interimText;

  return (
    <div
      className="fixed inset-0 z-[9999] pointer-events-none"
      aria-hidden="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/30 backdrop-blur-[1px]" />

      {/* Animated border — 4 edges */}
      <div
        className={`absolute inset-0 ${isListening ? 'voice-border-pulse' : ''} ${isError ? 'voice-border-error' : ''}`}
        style={{
          boxShadow: isError
            ? 'inset 0 0 0 2px rgba(239,68,68,0.8), inset 0 0 40px rgba(239,68,68,0.1)'
            : 'inset 0 0 0 2px rgba(59,130,246,0.8), inset 0 0 40px rgba(59,130,246,0.1)',
        }}
      />

      {/* Status pill — bottom center, pointer-events-auto */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto">
        <div className="flex flex-col items-center gap-2">
          {/* Live transcript */}
          {displayText && (
            <div className="max-w-sm px-4 py-2 rounded-xl bg-card/90 border text-sm text-center leading-snug backdrop-blur-sm">
              <span>{finalText}</span>
              {interimText && (
                <span className="text-muted-foreground opacity-60 italic">
                  {finalText ? ' ' : ''}{interimText}
                </span>
              )}
            </div>
          )}

          {/* Status badge */}
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm border shadow-lg
              ${isError
                ? 'bg-destructive/90 text-destructive-foreground border-destructive/50'
                : 'bg-card/90 text-foreground border-border'
              }`}
          >
            {overlayState === 'connecting' && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />}
            {overlayState === 'listening' && (
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
            )}
            {overlayState === 'processing' && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />}
            {overlayState === 'executing' && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />}
            {overlayState === 'error' && <span className="h-2 w-2 rounded-full bg-destructive flex-shrink-0" />}

            <span>{statusLabel}</span>

            {overlayState === 'listening' && (
              <span className="text-xs text-muted-foreground ml-1">— press ⌘K or Esc to cancel</span>
            )}
          </div>

          {/* Hint */}
          {!displayText && overlayState === 'listening' && (
            <p className="text-xs text-muted-foreground/70">
              Try: "Open Jamie" · "Go to billing" · "New note"
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function shortDelay() {
  return new Promise(r => setTimeout(r, 400));
}
