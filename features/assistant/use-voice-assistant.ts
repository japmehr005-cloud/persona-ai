"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
  }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type VoicePermissionState = "unknown" | "granted" | "denied" | "unsupported";

export function useVoiceAssistant(options: {
  onFinalTranscript: (text: string) => void;
  /** BCP-47 language for STT/TTS (e.g. en-IN, hi-IN, pa-IN). */
  lang?: string;
  /** Slightly slower speech for Senior Mode. */
  seniorMode?: boolean;
}) {
  const lang = options.lang ?? "en-IN";
  const seniorMode = options.seniorMode ?? false;
  const [recognitionSupported, setRecognitionSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [permission, setPermission] = useState<VoicePermissionState>("unknown");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [lastSpoken, setLastSpoken] = useState("");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef = useRef({ final: "", interim: "" });
  const onFinalRef = useRef(options.onFinalTranscript);
  onFinalRef.current = options.onFinalTranscript;

  useEffect(() => {
    setRecognitionSupported(Boolean(getSpeechRecognitionCtor()));
    setTtsSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    if (typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia) {
      setPermission("unsupported");
    }
  }, []);

  const stopMeter = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    analyserRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setLevel(0);
  }, []);

  const stopListening = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    setListening(false);
    stopMeter();
  }, [stopMeter]);

  useEffect(() => {
    return () => {
      stopListening();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, [stopListening]);

  async function ensureMicrophone(): Promise<boolean> {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission("unsupported");
      setError("Microphone access is not available in this browser. Use text mode instead.");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setPermission("granted");

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setLevel(Math.min(1, rms * 4));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      return true;
    } catch {
      setPermission("denied");
      setError("Microphone permission was denied. You can continue in text mode.");
      return false;
    }
  }

  async function startListening() {
    setError(null);
    setInterimTranscript("");
    setFinalTranscript("");
    transcriptRef.current = { final: "", interim: "" };

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setPermission("unsupported");
      setError("Speech recognition is not supported here. Please type your question instead.");
      return;
    }

    const micOk = await ensureMicrophone();
    if (!micOk) return;

    // Stop any TTS so we don't capture the assistant voice
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setSpeaking(false);

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => {
      let interim = "";
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i]?.[0]?.transcript ?? "";
        if (event.results[i]?.isFinal) finalChunk += `${piece} `;
        else interim += piece;
      }
      if (interim) {
        transcriptRef.current.interim = interim.trim();
        setInterimTranscript(interim.trim());
      }
      if (finalChunk.trim()) {
        transcriptRef.current.final = `${transcriptRef.current.final} ${finalChunk}`.trim();
        transcriptRef.current.interim = "";
        setFinalTranscript(transcriptRef.current.final);
        setInterimTranscript("");
      }
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        setPermission("denied");
        setError("Microphone permission was denied.");
      } else if (event.error !== "aborted") {
        setError("Voice capture hit a problem. You can retry or type instead.");
      }
      stopListening();
    };
    recognition.onend = () => {
      setListening(false);
      stopMeter();
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);

    // Auto-timeout after 20s
    timeoutRef.current = setTimeout(() => {
      finishListening();
    }, 20000);
  }

  function finishListening() {
    const text = (transcriptRef.current.final || transcriptRef.current.interim).trim();
    stopListening();
    if (text) {
      setFinalTranscript(text);
      onFinalRef.current(text);
    }
  }

  function cancelListening() {
    transcriptRef.current = { final: "", interim: "" };
    setInterimTranscript("");
    setFinalTranscript("");
    try {
      recognitionRef.current?.abort();
    } catch {
      /* ignore */
    }
    stopListening();
  }

  function speak(text: string) {
    if (muted || !ttsSupported || typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/[#*_`|>-]/g, " ").replace(/\s+/g, " ").trim();
    if (!clean) return;
    setLastSpoken(clean);
    const utterance = new SpeechSynthesisUtterance(clean.slice(0, 1200));
    utterance.lang = lang;
    utterance.rate = seniorMode ? 0.88 : 0.96;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if (typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  function replayLast() {
    if (lastSpoken) speak(lastSpoken);
  }

  function toggleMute() {
    setMuted((prev) => {
      if (!prev) stopSpeaking();
      return !prev;
    });
  }

  return {
    recognitionSupported,
    ttsSupported,
    supported: recognitionSupported,
    permission,
    listening,
    speaking,
    muted,
    interimTranscript,
    finalTranscript,
    error,
    level,
    lastSpoken,
    startListening,
    finishListening,
    cancelListening,
    stopListening,
    speak,
    stopSpeaking,
    replayLast,
    toggleMute,
  };
}
