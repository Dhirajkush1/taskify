"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Play, 
  RotateCw, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Send, 
  ShieldAlert, 
  Activity 
} from "lucide-react";

interface DiagnosticsData {
  lastRun: string | null;
  pendingCount: number;
  sentCount: number;
  failedCount: number;
  retryingCount: number;
  telegramSuccess: number;
  webSuccess: number;
  retryQueue: any[];
  recentLogs: any[];
}

export default function RemindersDiagnosticsPage() {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerStatus, setTriggerStatus] = useState<string | null>(null);
  const supabase = createClient();

  const fetchDiagnostics = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch last scheduler run from activity_logs
      const { data: logs } = await supabase
        .from("activity_logs")
        .select("created_at")
        .eq("action", "CronReminderRun")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastRun = logs?.created_at ? new Date(logs.created_at).toLocaleString() : "Never";

      // 2. Fetch reminder queues
      const { data: reminders } = await supabase
        .from("reminders")
        .select("*");

      let pending = 0;
      let sent = 0;
      let failed = 0;
      let retrying = 0;
      const retryQueue: any[] = [];

      if (reminders) {
        reminders.forEach((r: any) => {
          const statusStr = r.status as string;
          if (statusStr === "completed" || statusStr === "sent") {
            sent++;
          } else if (statusStr === "failed") {
            failed++;
          } else if (statusStr === "pending" && r.delivery_attempts === 0) {
            pending++;
          }
          
          if (r.delivery_attempts > 0 && statusStr !== "completed" && statusStr !== "cancelled" && statusStr !== "skipped") {
            retrying++;
            retryQueue.push(r);
          }
        });
      }

      // 3. Fetch Telegram notifications logs
      const { data: tgNotifs } = await supabase
        .from("telegram_notifications")
        .select("status");

      let tgSent = 0;
      let tgFailed = 0;
      if (tgNotifs) {
        tgNotifs.forEach((n) => {
          if (n.status === "sent") tgSent++;
          else tgFailed++;
        });
      }
      const telegramSuccess = tgSent + tgFailed > 0 ? Math.round((tgSent / (tgSent + tgFailed)) * 100) : 100;

      // 4. Fetch Web notification read statistics
      const { data: webNotifs } = await supabase
        .from("notifications")
        .select("read");

      let webRead = 0;
      let webTotal = 0;
      if (webNotifs) {
        webTotal = webNotifs.length;
        (webNotifs as any[]).forEach((n: any) => {
          if (n.read) webRead++;
        });
      }
      const webSuccess = webTotal > 0 ? Math.round((webRead / webTotal) * 100) : 100;

      // 5. Fetch recent activity logs related to reminders
      const { data: recentLogs } = await supabase
        .from("activity_logs")
        .select("*")
        .in("action", ["reminder_sent", "reminder_delivery_failed", "reminder_follow_up_triggered", "CronReminderRun"])
        .order("created_at", { ascending: false })
        .limit(10);

      setData({
        lastRun,
        pendingCount: pending,
        sentCount: sent,
        failedCount: failed,
        retryingCount: retrying,
        telegramSuccess,
        webSuccess,
        retryQueue,
        recentLogs: recentLogs || []
      });
    } catch (err) {
      console.error("[Diagnostics] Failed to fetch data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTriggerCron = async () => {
    setIsTriggering(true);
    setTriggerStatus("Triggering cron endpoint...");
    try {
      const res = await fetch("/api/cron/reminders");
      const result = await res.json();
      if (res.ok) {
        setTriggerStatus("Success! Executed cron successfully.");
        await fetchDiagnostics();
      } else {
        setTriggerStatus(`Failed: ${result.error || "Unknown error"}`);
      }
    } catch (err: any) {
      setTriggerStatus(`Error: ${err.message || "Network error"}`);
    } finally {
      setIsTriggering(false);
      setTimeout(() => setTriggerStatus(null), 5000);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <RotateCw className="w-8 h-8 text-violet-500 animate-spin" />
        <p className="text-sm text-neutral-400">Loading Diagnostics Engine...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto overflow-y-auto h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-violet-400 animate-pulse" />
            Reminder Engine Diagnostics
          </h1>
          <p className="text-xs text-neutral-400">
            Realtime debugging statistics, health status, and delivery queue audits.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchDiagnostics}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh Data
          </button>
          <button
            onClick={handleTriggerCron}
            disabled={isTriggering}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-violet-600 hover:bg-violet-500 text-white cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            Trigger Cron Now
          </button>
        </div>
      </div>

      {triggerStatus && (
        <div className={`p-3.5 rounded-xl border text-xs font-semibold ${
          triggerStatus.startsWith("Success")
            ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
            : "bg-amber-500/10 border-amber-500/25 text-amber-400"
        }`}>
          {triggerStatus}
        </div>
      )}

      {/* Diagnostics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Scheduler Card */}
        <div className="p-4 rounded-xl border bg-neutral-900/60 border-neutral-800 flex flex-col justify-between h-32">
          <span className="text-[10px] font-bold uppercase text-neutral-400 tracking-wider flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-violet-400" /> Scheduler Run
          </span>
          <div className="my-2">
            <p className="text-xs font-semibold text-neutral-200">Last Execution:</p>
            <p className="text-sm font-bold text-violet-400 truncate">{data?.lastRun}</p>
          </div>
          <span className="text-[10px] text-neutral-500">Interval: Every 1 minute</span>
        </div>

        {/* Queues breakdown */}
        <div className="p-4 rounded-xl border bg-neutral-900/60 border-neutral-800 flex flex-col justify-between h-32">
          <span className="text-[10px] font-bold uppercase text-neutral-400 tracking-wider flex items-center gap-1">
            <Send className="w-3.5 h-3.5 text-blue-400" /> Pending / Sent
          </span>
          <div className="flex gap-4 items-baseline my-2">
            <div>
              <p className="text-2xl font-black text-white">{data?.pendingCount}</p>
              <p className="text-[9px] text-neutral-500 font-bold uppercase">Pending</p>
            </div>
            <div className="border-r border-neutral-800 h-8 self-center" />
            <div>
              <p className="text-2xl font-black text-white">{data?.sentCount}</p>
              <p className="text-[9px] text-neutral-500 font-bold uppercase">Sent/Done</p>
            </div>
          </div>
          <span className="text-[10px] text-neutral-500">Unprocessed reminders</span>
        </div>

        {/* Failures and Retries */}
        <div className="p-4 rounded-xl border bg-neutral-900/60 border-neutral-800 flex flex-col justify-between h-32">
          <span className="text-[10px] font-bold uppercase text-neutral-400 tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Retries / Failures
          </span>
          <div className="flex gap-4 items-baseline my-2">
            <div>
              <p className="text-2xl font-black text-amber-400">{data?.retryingCount}</p>
              <p className="text-[9px] text-neutral-500 font-bold uppercase">Retrying</p>
            </div>
            <div className="border-r border-neutral-800 h-8 self-center" />
            <div>
              <p className="text-2xl font-black text-red-500">{data?.failedCount}</p>
              <p className="text-[9px] text-neutral-500 font-bold uppercase">Hard Failed</p>
            </div>
          </div>
          <span className="text-[10px] text-neutral-500">Maximum 5 delivery retries</span>
        </div>

        {/* Channel success rates */}
        <div className="p-4 rounded-xl border bg-neutral-900/60 border-neutral-800 flex flex-col justify-between h-32">
          <span className="text-[10px] font-bold uppercase text-neutral-400 tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Success Rate
          </span>
          <div className="flex gap-4 items-baseline my-2">
            <div>
              <p className="text-2xl font-black text-emerald-400">{data?.telegramSuccess}%</p>
              <p className="text-[9px] text-neutral-500 font-bold uppercase">Telegram</p>
            </div>
            <div className="border-r border-neutral-800 h-8 self-center" />
            <div>
              <p className="text-2xl font-black text-violet-400">{data?.webSuccess}%</p>
              <p className="text-[9px] text-neutral-500 font-bold uppercase">Web Reads</p>
            </div>
          </div>
          <span className="text-[10px] text-neutral-500">Channel execution efficacy</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Retry Queue List */}
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-sm font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-500" /> Active Retry Queue ({data?.retryQueue.length})
          </h2>
          <div className="rounded-xl border bg-neutral-900/40 border-neutral-800 overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900/80 text-neutral-400 font-bold">
                  <th className="p-3">Reminder Title</th>
                  <th className="p-3">Attempts</th>
                  <th className="p-3">Next Retry</th>
                  <th className="p-3 text-right">Reason</th>
                </tr>
              </thead>
              <tbody>
                {data?.retryQueue.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center italic text-neutral-500">
                      No reminders currently backlogged in retry queues.
                    </td>
                  </tr>
                ) : (
                  data?.retryQueue.map((r, idx) => (
                    <tr key={idx} className="border-b border-neutral-800/40 hover:bg-neutral-800/20">
                      <td className="p-3 font-semibold text-neutral-200">{r.title}</td>
                      <td className="p-3 text-neutral-300">{r.delivery_attempts} / 5</td>
                      <td className="p-3 text-neutral-400">
                        {r.next_retry_at ? new Date(r.next_retry_at).toLocaleTimeString() : "Pending"}
                      </td>
                      <td className="p-3 text-right text-red-400 truncate max-w-[200px]" title={r.failure_reason}>
                        {r.failure_reason || "None"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Execution Logs */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-violet-400" /> Recent Activity Logs
          </h2>
          <div className="rounded-xl border bg-neutral-900/40 border-neutral-800 p-4 space-y-3.5 max-h-[350px] overflow-y-auto">
            {data?.recentLogs.length === 0 ? (
              <p className="text-xs text-neutral-500 italic text-center py-4">No recent reminder logs.</p>
            ) : (
              data?.recentLogs.map((log, idx) => {
                let badgeColor = "bg-neutral-800 text-neutral-300";
                if (log.action === "reminder_sent") badgeColor = "bg-emerald-950/40 border-emerald-900/30 text-emerald-400";
                if (log.action === "reminder_delivery_failed") badgeColor = "bg-red-950/40 border-red-900/30 text-red-400";
                if (log.action === "reminder_follow_up_triggered") badgeColor = "bg-violet-950/40 border-violet-900/30 text-violet-400";

                return (
                  <div key={idx} className="flex flex-col gap-1 text-xs border-b border-neutral-800/40 pb-2.5 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between w-full">
                      <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold ${badgeColor}`}>
                        {log.action}
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    {log.metadata?.error && (
                      <p className="text-[10px] text-red-400 font-semibold leading-relaxed mt-0.5">
                        Err: {log.metadata.error}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
