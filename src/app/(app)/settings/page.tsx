"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import { 
  Bell, Brain, Moon, Shield, Loader2, Sparkles, 
  Send, Check, Copy, ExternalLink, RefreshCw, AlertCircle, Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  
  const supabase = useMemo(() => createClient(), []);

  // Telegram Integration State
  const [telegramStatus, setTelegramStatus] = useState<{
    connected: boolean;
    telegramUserId: string | null;
    chatId: string | null;
    linkingCode: string | null;
    expiresAt: string | null;
    botUsername: string;
    preferences: {
      telegram_enabled: boolean;
      daily_debrief_enabled: boolean;
      weekly_reflection_enabled: boolean;
      reminders_enabled: boolean;
      emergency_alerts_enabled: boolean;
      focus_session_alerts_enabled: boolean;
    };
  }>({
    connected: false,
    telegramUserId: null,
    chatId: null,
    linkingCode: null,
    expiresAt: null,
    botUsername: "TaskifyAI_bot",
    preferences: {
      telegram_enabled: true,
      daily_debrief_enabled: true,
      weekly_reflection_enabled: true,
      reminders_enabled: true,
      emergency_alerts_enabled: true,
      focus_session_alerts_enabled: true
    }
  });

  const [copied, setCopied] = useState(false);
  const [refreshingCode, setRefreshingCode] = useState(false);

  // Load standard settings & Telegram link status
  const loadTelegramStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/telegram/link");
      if (res.ok) {
        const data = await res.json();
        if (data.connected) {
          setTelegramStatus(prev => ({
            ...prev,
            connected: true,
            telegramUserId: data.telegramUserId,
            chatId: data.chatId,
            preferences: data.preferences
          }));
        } else {
          setTelegramStatus(prev => ({
            ...prev,
            connected: false,
            linkingCode: data.linkingCode,
            expiresAt: data.expiresAt,
            botUsername: data.botUsername || "TaskifyAI_bot"
          }));
        }
      }
    } catch (err) {
      console.error("Failed to load Telegram link state:", err);
    }
  }, []);

  useEffect(() => {
    let channel: any;
    async function loadSettings() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Fetch web settings
        const { data } = await supabase
          .from("settings")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        setSettings(data);

        // Fetch Telegram status
        await loadTelegramStatus();

        // Subscribe to real-time changes on telegram_accounts to auto-detect handshake completion!
        channel = supabase
          .channel("telegram-link-sync")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "telegram_accounts",
              filter: `user_id=eq.${user.id}`
            },
            (payload: any) => {
              console.log("[Settings] Telegram account table change detected:", payload);
              if (payload.new && payload.new.is_active) {
                setTelegramStatus(prev => ({
                  ...prev,
                  connected: true,
                  telegramUserId: payload.new.telegram_user_id,
                  chatId: payload.new.chat_id
                }));
                loadTelegramStatus(); // Reload everything to capture preferences as well
              } else if (payload.eventType === "DELETE" || (payload.new && !payload.new.is_active)) {
                setTelegramStatus(prev => ({
                  ...prev,
                  connected: false,
                  linkingCode: null
                }));
              }
            }
          )
          .subscribe();
      }
      setLoading(false);
    }
    
    loadSettings();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase, loadTelegramStatus]);

  const updateSetting = async (key: string, value: any) => {
    if (!settings) return;
    setSaving(key);
    
    const updated = { ...settings, [key]: value };
    setSettings(updated);

    const updatePayload: Database["public"]["Tables"]["settings"]["Update"] = {};
    if (key === "theme") {
      updatePayload.theme = value;
    } else if (key === "notifications_enabled") {
      updatePayload.notifications_enabled = value;
    } else if (key === "ai_suggestions_enabled") {
      updatePayload.ai_suggestions_enabled = value;
    } else if (key === "daily_summary_time") {
      updatePayload.daily_summary_time = value;
    } else if (key === "ai_personality") {
      updatePayload.ai_personality = value;
    } else if (key === "timezone") {
      updatePayload.timezone = value;
    } else if (key === "locale") {
      updatePayload.locale = value;
    } else if (key === "working_hours_start") {
      updatePayload.working_hours_start = value;
    } else if (key === "working_hours_end") {
      updatePayload.working_hours_end = value;
    } else if (key === "updated_at") {
      updatePayload.updated_at = value;
    }

    const { error } = await supabase
      .from("settings")
      .update(updatePayload)
      .eq("user_id", settings.user_id);

    if (error) {
      console.error("Error updating setting:", error.message);
      setSettings(settings); // rollback
    }
    setSaving(null);
  };

  // Update granular Telegram notification preference
  const updateNotificationPreference = async (key: string, value: boolean) => {
    setSaving(key);
    const updatedPreferences = { ...telegramStatus.preferences, [key]: value };
    setTelegramStatus(prev => ({ ...prev, preferences: updatedPreferences }));

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const updatePayload: Database["public"]["Tables"]["notification_preferences"]["Update"] = {};
      if (key === "telegram_enabled") {
        updatePayload.telegram_enabled = value;
      } else if (key === "daily_debrief_enabled") {
        updatePayload.daily_debrief_enabled = value;
      } else if (key === "weekly_reflection_enabled") {
        updatePayload.weekly_reflection_enabled = value;
      } else if (key === "reminders_enabled") {
        updatePayload.reminders_enabled = value;
      } else if (key === "emergency_alerts_enabled") {
        updatePayload.emergency_alerts_enabled = value;
      } else if (key === "focus_session_alerts_enabled") {
        updatePayload.focus_session_alerts_enabled = value;
      }

      const { error } = await supabase
        .from("notification_preferences")
        .update(updatePayload)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error updating notification preference:", error.message);
        // Rollback
        setTelegramStatus(prev => ({ ...prev, preferences: telegramStatus.preferences }));
      }
    }
    setSaving(null);
  };

  // Disconnect Telegram bot integration
  const disconnectTelegram = async () => {
    setSaving("disconnect_telegram");
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" });
      if (res.ok) {
        setTelegramStatus(prev => ({
          ...prev,
          connected: false,
          telegramUserId: null,
          chatId: null,
          linkingCode: null
        }));
        await loadTelegramStatus(); // Generate a new code immediately
      }
    } catch (err) {
      console.error("Failed to disconnect Telegram:", err);
    }
    setSaving(null);
  };

  // Force-regenerate a fresh linking code
  const regenerateLinkingCode = async () => {
    setRefreshingCode(true);
    // Delete local cache first to force route to make a new one
    await supabase.from("telegram_accounts").delete().eq("user_id", settings?.user_id);
    await loadTelegramStatus();
    setRefreshingCode(false);
  };

  const copyCode = () => {
    if (telegramStatus.linkingCode) {
      navigator.clipboard.writeText(telegramStatus.linkingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
      </div>
    );
  }

  const personalities = [
    { value: "friendly_coach", label: "Friendly Coach 🤝", desc: "Warm, empathetic, encouraging, and habit-focused" },
    { value: "strict_coach", label: "Strict Coach 🔴", desc: "Direct, firm, high-discipline, and sports-trainer style" },
    { value: "minimal_assistant", label: "Minimal Assistant ⚪", desc: "Ultra-brief, objective, quiet, and highly professional" },
    { value: "student_mentor", label: "Student Mentor 🎓", desc: "Peer-to-peer, collaborative, exam-focused, and stress-relieving" },
    { value: "professional_planner", label: "Professional Planner 💼", desc: "Strategic, analytical, structured, and sprint-oriented" }
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Greeting Header */}
      <div className="mb-2">
        <h1 className="text-xl font-extrabold" style={{ color: "var(--text-primary)" }}>
          System Settings
        </h1>
        <p className="text-xs" style={{ color: "var(--text-muted)", marginTop: "4px" }}>
          Configure your autonomous companion and system preferences.
        </p>
      </div>

      {/* 1. Appearance */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 border"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Moon className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
            Appearance
          </h2>
        </div>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Theme</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Clutch runs in premium Dark Mode first</p>
          </div>
          <div
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "var(--primary-muted)", color: "var(--primary)" }}
          >
            Dark First
          </div>
        </div>
      </motion.section>

      {/* 2. AI Personality System */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl p-6 border"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
            AI Personality Core
          </h2>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Active Personality</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Switching personalities alters Clutch AI&apos;s tone, scheduling focus, and coaching style.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {personalities.map((p) => {
              const isActive = (settings?.ai_personality || "friendly_coach") === p.value;
              return (
                <button
                  key={p.value}
                  onClick={() => updateSetting("ai_personality", p.value)}
                  className={`flex flex-col text-left p-3 rounded-xl border transition-all relative ${
                    isActive
                      ? "border-violet-500 bg-violet-500/5 shadow-sm"
                      : "border-neutral-800 hover:border-neutral-700 bg-neutral-900/40"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold text-neutral-200">{p.label}</span>
                    {saving === "ai_personality" && isActive && (
                      <Loader2 className="w-3 h-3 animate-spin text-violet-400" />
                    )}
                  </div>
                  <span className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                    {p.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </motion.section>

      {/* 2.5. Timezone & Timeline Config */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className="rounded-2xl p-6 border"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
            Locale & Time Zone Settings
          </h2>
        </div>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-neutral-400 block mb-1.5">IANA Time Zone</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={settings?.timezone || "UTC"}
                  onChange={(e) => updateSetting("timezone", e.target.value)}
                  className="w-full bg-neutral-950 text-xs px-3 py-2 rounded-xl border border-neutral-805 focus:border-violet-500 outline-none text-neutral-200"
                />
                {saving === "timezone" && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                )}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-neutral-400 block mb-1.5">User Locale</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={settings?.locale || "en-US"}
                  onChange={(e) => updateSetting("locale", e.target.value)}
                  className="w-full bg-neutral-950 text-xs px-3 py-2 rounded-xl border border-neutral-805 focus:border-violet-500 outline-none text-neutral-200"
                />
                {saving === "locale" && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                )}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-neutral-400 block mb-1.5">Working Hours Start</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="09:00"
                  value={settings?.working_hours_start || "09:00"}
                  onChange={(e) => updateSetting("working_hours_start", e.target.value)}
                  className="w-full bg-neutral-950 text-xs px-3 py-2 rounded-xl border border-neutral-805 focus:border-violet-500 outline-none text-neutral-200"
                />
                {saving === "working_hours_start" && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                )}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-neutral-400 block mb-1.5">Working Hours End</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="17:00"
                  value={settings?.working_hours_end || "17:00"}
                  onChange={(e) => updateSetting("working_hours_end", e.target.value)}
                  className="w-full bg-neutral-950 text-xs px-3 py-2 rounded-xl border border-neutral-805 focus:border-violet-500 outline-none text-neutral-200"
                />
                {saving === "working_hours_end" && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 3. Telegram Bot Integration (Real-time Handshake Panel) */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="rounded-2xl p-6 border relative overflow-hidden"
        style={{ 
          background: "var(--surface)", 
          borderColor: telegramStatus.connected ? "rgba(16, 185, 129, 0.2)" : "rgba(59, 130, 246, 0.15)"
        }}
      >
        {/* Subtle decorative brand glow */}
        <div 
          className="absolute -top-12 -right-12 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-20"
          style={{ background: telegramStatus.connected ? "var(--success)" : "#3b82f6" }}
        />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
              Telegram Bot Integration
            </h2>
          </div>
          <span 
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 ${
              telegramStatus.connected 
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse"
            }`}
          >
            {telegramStatus.connected ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Connected
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" /> Waiting Handshake
              </>
            )}
          </span>
        </div>

        <AnimatePresence mode="wait">
          {telegramStatus.connected ? (
            <motion.div
              key="connected"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-5"
            >
              {/* Success Banner */}
              <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-xs text-neutral-300 flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-neutral-200">Autonomous Linking Active</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Your Telegram account is linked. Messages, voice notes, and actions are synchronized.
                  </p>
                </div>
              </div>

              {/* Preferences Toggles */}
              <div className="space-y-2 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                <h3 className="text-xs font-bold uppercase tracking-widest text-violet-400 mb-2">
                  Telegram Notifications
                </h3>

                {[
                  { key: "reminders_enabled", label: "Smart Task Reminders", desc: "Receive focus timer alerts and quick action buttons" },
                  { key: "emergency_alerts_enabled", label: "Rescue Mode Alerts", desc: "Proactive emergency action plans when deadlines are at risk" },
                  { key: "daily_debrief_enabled", label: "Daily Debriefs", desc: "Every evening, receive a summary of today's progress & tomorrow's plan" },
                  { key: "weekly_reflection_enabled", label: "Weekly Reflections", desc: "Sunday morning productivity wins and coaching suggestions" }
                ].map(({ key, label, desc }) => {
                  const val = telegramStatus.preferences[key as keyof typeof telegramStatus.preferences] !== false;
                  return (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-neutral-900/40 last:border-0">
                      <div>
                        <p className="text-xs font-medium text-neutral-200">{label}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{desc}</p>
                      </div>
                      <button
                        onClick={() => updateNotificationPreference(key, !val)}
                        disabled={saving === key}
                        className="w-8 h-5 rounded-full relative cursor-pointer transition-all shrink-0"
                        style={{ background: val ? "var(--primary)" : "var(--surface-overlay)" }}
                        type="button"
                      >
                        <div
                          className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                          style={{ left: val ? "calc(100% - 18px)" : "2px" }}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Disconnect Button */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={disconnectTelegram}
                  disabled={saving === "disconnect_telegram"}
                  className="px-3 py-1.5 rounded-xl border border-rose-500/20 hover:bg-rose-500/5 text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  {saving === "disconnect_telegram" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  Disconnect Telegram
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="disconnected"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-4"
            >
              <div className="text-xs text-neutral-300 space-y-2">
                <p>
                  Link your account to interact with your AI companion, upload voice notes, or receive notifications on the go.
                </p>
                <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl space-y-2.5">
                  <p className="font-bold text-neutral-200 text-[11px] uppercase tracking-widest text-violet-400">
                    Connection Steps:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-neutral-400 leading-relaxed">
                    <li>Open our Telegram Bot: <span className="text-blue-400 font-semibold">@{telegramStatus.botUsername}</span></li>
                    <li>Send your secure one-time linking code displayed below.</li>
                  </ol>
                </div>
              </div>

              {/* Linking Code Display */}
              <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-neutral-950 border border-neutral-900 gap-3 relative">
                <span className="text-[10px] uppercase tracking-widest font-bold text-neutral-500">
                  Your One-Time Linking Code
                </span>

                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black font-mono tracking-widest text-blue-400 filter drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]">
                    {telegramStatus.linkingCode || "CL-XXXXX"}
                  </span>
                  <button
                    onClick={copyCode}
                    className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-neutral-200 transition-all"
                    title="Copy Code"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {telegramStatus.expiresAt && (
                  <span className="text-[9px] text-neutral-500">
                    Expires in: {Math.max(0, Math.round((new Date(telegramStatus.expiresAt).getTime() - Date.now()) / 60000))} minutes
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={regenerateLinkingCode}
                  disabled={refreshingCode}
                  className="text-xs text-neutral-500 hover:text-neutral-300 flex items-center gap-1 transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingCode ? "animate-spin" : ""}`} />
                  Regenerate Code
                </button>

                <a
                  href={`https://t.me/${telegramStatus.botUsername}?start=${telegramStatus.linkingCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/10 transition-all hover:scale-102"
                >
                  Open in Telegram
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* 4. AI Preferences */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-2xl p-6 border"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
            AI Preferences
          </h2>
        </div>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>AI Suggestions</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Let Clutch proactively calculate risk factors & priorities</p>
          </div>
          <button
            onClick={() => updateSetting("ai_suggestions_enabled", settings?.ai_suggestions_enabled !== false ? false : true)}
            disabled={saving === "ai_suggestions_enabled"}
            className="w-10 h-6 rounded-full relative cursor-pointer transition-all shrink-0"
            style={{ background: settings?.ai_suggestions_enabled !== false ? "var(--primary)" : "var(--surface-overlay)" }}
            type="button"
          >
            <div
              className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
              style={{ left: settings?.ai_suggestions_enabled !== false ? "calc(100% - 20px)" : "4px" }}
            />
          </button>
        </div>
      </motion.section>
    </div>
  );
}
