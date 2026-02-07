"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseSpeechDictationOptions = {
  onText: (text: string) => void;
  lang?: string;
};

type UseSpeechDictationResult = {
  isSupported: boolean;
  isListening: boolean;
  start: () => void;
  stop: () => void;
  toggle: () => void;
};

export function useSpeechDictation({
  onText,
  lang = "en-US",
}: UseSpeechDictationOptions): UseSpeechDictationResult {
  const recognitionRef = useRef<any>(null);
  const onTextRef = useRef(onText);
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const Recognition =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = lang;
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result?.isFinal) continue;
        const piece = result[0]?.transcript;
        if (typeof piece === "string") {
          transcript += `${piece} `;
        }
      }

      const trimmed = transcript.trim();
      if (!trimmed) return;
      onTextRef.current(trimmed);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    setIsSupported(true);

    return () => {
      try {
        recognition.stop();
      } catch {
        // Ignore stop errors during cleanup.
      }
      recognitionRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      // Ignore stop errors for unsupported state transitions.
    } finally {
      setIsListening(false);
    }
  }, []);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
      return;
    }
    start();
  }, [isListening, start, stop]);

  return { isSupported, isListening, start, stop, toggle };
}
