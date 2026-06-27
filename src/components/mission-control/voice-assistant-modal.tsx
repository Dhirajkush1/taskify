"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, X, Sparkles, Volume2, VolumeX, Loader2 } from "lucide-react";

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VoiceAssistantModal({ isOpen, onClose }: VoiceAssistantModalProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);

  const recognitionRef = useRef<any>(null);
  const speechUttRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = "en-US";

        rec.onstart = () => {
          setIsListening(true);
          setTranscript("Listening...");
        };

        rec.onresult = (event: any) => {
          const text = event.results[0][0].transcript;
          setTranscript(text);
          handleVoiceSubmit(text);
        };

        rec.onerror = (err: any) => {
          console.error("Speech recognition error:", err);
          setIsListening(false);
          setTranscript("Failed to recognize speech. Tap Mic to try again.");
        };

        rec.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = rec;
      }
    }

    return () => {
      stopSpeaking();
    };
  }, []);

  const startListening = () => {
    stopSpeaking();
    setAiResponse("");
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Already started
      }
    } else {
      setTranscript("Speech recognition not supported in this browser.");
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const speakText = (text: string) => {
    if (muted || typeof window === "undefined" || !window.speechSynthesis) return;
    
    stopSpeaking();
    
    // Clean JSON structures or brackets from text in case AI responds with them
    const cleanText = text
      .replace(/\{.*\}/gs, "") // Remove json blocks
      .replace(/[\[\]\{\}\*]/g, "") // Remove brackets
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Choose a high quality English voice if available
    const voices = window.speechSynthesis.getVoices();
    const premiumVoice = voices.find(
      (v) => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural"))
    ) || voices[0];
    
    if (premiumVoice) {
      utterance.voice = premiumVoice;
    }
    
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    speechUttRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handleVoiceSubmit = async (queryText: string) => {
    if (!queryText || queryText === "Listening...") return;
    setLoading(true);
    setAiResponse("");

    try {
      // Direct request to chat endpoint requesting a concise voice brief
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `${queryText} (Keep your response extremely brief, conversational, highly motivating, and under 3 sentences for speaking out loud. Do not return code or JSON format, speak directly.)`,
            },
          ],
          provider: "gemini",
        }),
      });

      if (!res.ok) throw new Error("API call failed");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        
        // Hide json strings if returned
        const cleaned = accumulated
          .replace(/\{.*\}/gs, "")
          .replace(/[\[\]\{\}\"\:]/g, "")
          .trim();
        setAiResponse(cleaned);
      }

      // Speak response aloud
      speakText(accumulated);
    } catch (err) {
      console.error(err);
      setAiResponse("Sorry, I couldn't connect to my core. Let's try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Auto trigger listening on open
      setTimeout(() => startListening(), 500);
    } else {
      stopListening();
      stopSpeaking();
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
        >
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full bg-white/5 border border-white/10 text-neutral-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="max-w-lg w-full flex flex-col items-center text-center gap-6">
            {/* Visual Wave Animator */}
            <div className="relative flex items-center justify-center h-48 w-48">
              {/* Outer pulsing rings */}
              <AnimatePresence>
                {(isListening || isSpeaking) && (
                  <>
                    <motion.div
                      className="absolute inset-0 rounded-full bg-violet-500/10 border border-violet-500/20"
                      animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.div
                      className="absolute inset-4 rounded-full bg-violet-500/15 border border-violet-500/30"
                      animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0, 0.8] }}
                      transition={{ duration: 2, delay: 0.5, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </>
                )}
              </AnimatePresence>

              {/* Core button */}
              <button
                onClick={isListening ? stopListening : startListening}
                className={`h-24 w-24 rounded-full flex items-center justify-center border transition-all ${
                  isListening
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                    : "bg-violet-500 text-white shadow-lg border-violet-400/20 hover:scale-105"
                }`}
              >
                {isListening ? (
                  <MicOff className="w-8 h-8 animate-pulse" />
                ) : (
                  <Mic className="w-8 h-8" />
                )}
              </button>
            </div>

            {/* Transcript & Response Area */}
            <div className="space-y-4 w-full">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400 flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Conversational AI Coach
                </span>
                <p className="text-sm font-semibold text-neutral-300 min-h-6 italic">
                  &quot;{transcript || "Tap mic and speak..."}&quot;
                </p>
              </div>

              {/* Response block */}
              {(loading || aiResponse) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-neutral-900/50 border border-neutral-800 p-4 rounded-2xl max-h-[160px] overflow-y-auto w-full text-left leading-relaxed text-xs text-neutral-200 relative"
                >
                  {loading && !aiResponse ? (
                    <div className="flex items-center gap-2 text-violet-400 font-bold">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Clutch is formulating response...
                    </div>
                  ) : (
                    <p>{aiResponse}</p>
                  )}

                  {isSpeaking && (
                    <span className="absolute bottom-3 right-3 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                    </span>
                  )}
                </motion.div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={() => setMuted(!muted)}
                className="p-2 rounded-xl bg-white/5 border border-white/5 text-neutral-400 hover:text-white transition-all text-xs flex items-center gap-1.5"
              >
                {muted ? (
                  <>
                    <VolumeX className="w-4 h-4" /> Unmute Voice
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" /> Mute Voice
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
