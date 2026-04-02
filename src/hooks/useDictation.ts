'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { CortiClient, CortiEnvironment } from '@corti/sdk';

export type DictationHookState = 'idle' | 'connecting' | 'recording';

interface UseDictationOptions {
  language: string;
  /** Called for each final (committed) transcript segment */
  onFinalSegment: (text: string) => void;
  /** Called for each interim (non-final) transcript preview */
  onInterimSegment?: (text: string) => void;
  /** Called when Corti signals the session has fully ended */
  onEnded: () => void;
  /** Called on any error; component is responsible for showing a toast */
  onError: (message: string) => void;
}

interface UseDictationReturn {
  state: DictationHookState;
  /** RMS audio level 0–1, updated ~30fps while recording */
  audioLevel: number;
  start: () => Promise<void>;
  /** Send the end signal to Corti; onEnded fires once final audio is processed */
  stop: () => void;
}

export function useDictation({
  language,
  onFinalSegment,
  onInterimSegment,
  onEnded,
  onError,
}: UseDictationOptions): UseDictationReturn {
  const [state, setState] = useState<DictationHookState>('idle');
  const [audioLevel, setAudioLevel] = useState(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wsRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  // Keep callback refs stable so the WebSocket closure always calls the latest version
  const onFinalSegmentRef = useRef(onFinalSegment);
  const onInterimSegmentRef = useRef(onInterimSegment);
  const onEndedRef = useRef(onEnded);
  const onErrorRef = useRef(onError);
  useEffect(() => { onFinalSegmentRef.current = onFinalSegment; }, [onFinalSegment]);
  useEffect(() => { onInterimSegmentRef.current = onInterimSegment; }, [onInterimSegment]);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    audioContextRef.current?.close().catch(() => null);
    audioContextRef.current = null;
    analyserRef.current = null;
    wsRef.current?.close?.();
    wsRef.current = null;
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
    mediaRecorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setAudioLevel(0);
  }, []);

  // Clean up on unmount
  useEffect(() => () => cleanup(), [cleanup]);

  const startAudioLevelLoop = useCallback((stream: MediaStream) => {
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
        setAudioLevel(Math.min(1, rms * 6)); // scale up for visual clarity
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // AudioContext unavailable (e.g. SSR guard) — silently skip
    }
  }, []);

  const startAudioCapture = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (stream: MediaStream, socket: any) => {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/mp4';
      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0 && socket.readyState === 1) socket.sendAudio(e.data);
      };
      mr.start(200);
      startAudioLevelLoop(stream);
    },
    [startAudioLevelLoop],
  );

  const start = useCallback(async () => {
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
        configuration: { primaryLanguage: language, automaticPunctuation: true, interimResults: true },
        reconnectAttempts: 0,
      });
      wsRef.current = socket;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket.on('message', (msg: any) => {
        console.log('[useDictation] message:', msg.type, msg);
        if (msg.type === 'CONFIG_ACCEPTED') {
          startAudioCapture(stream, socket);
          setState('recording');
        }
        if (msg.type === 'transcript') {
          const { text, isFinal } = msg.data ?? {};
          console.log('[useDictation] transcript isFinal=%s text=%o rawMsg=%o', isFinal, text, msg);
          if (isFinal && text) {
            onFinalSegmentRef.current(text);
          } else if (!isFinal && text) {
            console.log('[useDictation] calling onInterimSegment, handler present:', !!onInterimSegmentRef.current);
            onInterimSegmentRef.current?.(text);
          }
        }
        if (msg.type === 'ended') {
          cleanup();
          setState('idle');
          onEndedRef.current();
        }
        if (msg.type === 'error') {
          cleanup();
          setState('idle');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onErrorRef.current((msg as any).message || 'Transcription error');
        }
      });

      socket.on('error', (err: Error) => {
        cleanup();
        setState('idle');
        onErrorRef.current(err.message || 'Connection error');
      });
    } catch (err) {
      cleanup();
      setState('idle');
      throw err; // re-throw so callers can show a toast with the message
    }
  }, [language, cleanup, startAudioCapture]);

  const stop = useCallback(() => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'end' }));
    }
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
  }, []);

  return { state, audioLevel, start, stop };
}
