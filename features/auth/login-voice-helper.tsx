"use client";

import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/**
 * Lightweight guest voice helper on the login screen — TTS guidance only.
 * Full conversational assistant remains available after authentication.
 */
export function LoginVoiceHelper() {
  const t = useTranslations("auth");
  const [speaking, setSpeaking] = useState(false);

  const speak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(t("voiceWelcome"));
    utterance.lang = document.documentElement.lang || "en-IN";
    utterance.rate = 0.95;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stop = () => {
    if (typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="min-h-11 gap-2 text-muted-foreground"
      onClick={speaking ? stop : speak}
      aria-label={speaking ? t("voiceStop") : t("voiceStart")}
    >
      {speaking ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      {speaking ? t("voiceStop") : t("voiceAssistant")}
    </Button>
  );
}
