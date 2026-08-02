"use client";

import { Mic, MicOff, RotateCcw, Square, Volume2, VolumeX, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function VoicePanel({
  open,
  listening,
  speaking,
  muted,
  level,
  interimTranscript,
  finalTranscript,
  error,
  recognitionSupported,
  permission,
  onStart,
  onFinish,
  onCancel,
  onStopSpeaking,
  onReplay,
  onToggleMute,
  onClose,
}: {
  open: boolean;
  listening: boolean;
  speaking: boolean;
  muted: boolean;
  level: number;
  interimTranscript: string;
  finalTranscript: string;
  error: string | null;
  recognitionSupported: boolean;
  permission: string;
  onStart: () => void;
  onFinish: () => void;
  onCancel: () => void;
  onStopSpeaking: () => void;
  onReplay: () => void;
  onToggleMute: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  const bars = Array.from({ length: 16 }, (_, i) => {
    const wave = Math.max(0.15, Math.sin((i / 16) * Math.PI + level * 8) * level + level * 0.6);
    return wave;
  });

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl backdrop-blur-md sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[380px] sm:rounded-2xl sm:border">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold">Voice assistant</p>
          <p className="text-sm text-muted-foreground">
            {!recognitionSupported
              ? "Speech recognition is unavailable — use text mode."
              : permission === "denied"
                ? "Microphone blocked. Enable it in browser settings."
                : listening
                  ? "Listening… speak clearly"
                  : speaking
                    ? "Speaking response"
                    : "Tap the mic to ask Persona AI"}
          </p>
        </div>
        <Button type="button" size="icon" variant="ghost" className="size-11" onClick={onClose} aria-label="Close voice panel">
          <X className="size-5" />
        </Button>
      </div>

      <div
        className={cn(
          "mb-4 flex h-20 items-end justify-center gap-1.5 rounded-xl border bg-muted/40 px-3 py-3",
          listening && "border-primary/40"
        )}
        aria-hidden
      >
        {bars.map((height, index) => (
          <span
            key={index}
            className={cn(
              "w-1.5 rounded-full bg-primary/70 transition-all duration-75",
              !listening && !speaking && "bg-muted-foreground/30"
            )}
            style={{ height: `${Math.max(12, height * 48)}px` }}
          />
        ))}
      </div>

      {(interimTranscript || finalTranscript) && (
        <div className="mb-3 rounded-xl border bg-card px-3 py-2 text-base">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Transcript</p>
          <p className="mt-1 leading-relaxed">
            {finalTranscript}
            {interimTranscript ? (
              <span className="text-muted-foreground"> {interimTranscript}</span>
            ) : null}
          </p>
        </div>
      )}

      {error ? (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!listening ? (
          <Button
            type="button"
            className="min-h-12 flex-1 text-base"
            disabled={!recognitionSupported || permission === "denied"}
            onClick={onStart}
          >
            <Mic className="size-5" aria-hidden />
            {permission === "unknown" || permission === "granted" ? "Start listening" : "Unavailable"}
          </Button>
        ) : (
          <>
            <Button type="button" className="min-h-12 flex-1 text-base" onClick={onFinish}>
              <MicOff className="size-5" aria-hidden />
              Send
            </Button>
            <Button type="button" variant="outline" className="min-h-12 px-4" onClick={onCancel}>
              Cancel
            </Button>
          </>
        )}
        {speaking ? (
          <Button type="button" variant="secondary" className="min-h-12 px-4" onClick={onStopSpeaking}>
            <Square className="size-4" aria-hidden />
            Stop
          </Button>
        ) : (
          <Button type="button" variant="outline" className="min-h-12 min-w-12" onClick={onReplay} aria-label="Replay last response">
            <RotateCcw className="size-4" aria-hidden />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          className="min-h-12 min-w-12"
          onClick={onToggleMute}
          aria-label={muted ? "Unmute voice replies" : "Mute voice replies"}
        >
          {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
        </Button>
      </div>
    </div>
  );
}
