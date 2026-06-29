"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { 
  Terminal, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  MinusCircle, 
  Clock, 
  MessageSquare,
  FileCode,
  Layers
} from "lucide-react";

interface SyncLog {
  id: string;
  telegram_message: string;
  extracted_json: any;
  task_status: string;
  reminder_status: string;
  calendar_status: string;
  scheduler_status: string;
  telegram_delivery_status: string;
  created_tasks: string[];
  created_reminders: string[];
  created_events: string[];
  execution_time_ms: number;
  created_at: string;
}

export default function AdminRemindersPage() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const supabase = createClient();

  const fetchLogs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("telegram_sync_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    if (!error && data) {
      setLogs(data as any);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
      case "delivered":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <MinusCircle className="w-4 h-4 text-neutral-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    let classes = "px-2 py-0.5 rounded text-[10px] font-bold border ";
    if (status === "success" || status === "delivered") {
      classes += "bg-emerald-500/10 text-emerald-400 border-emerald-500/25";
    } else if (status === "failed") {
      classes += "bg-red-500/10 text-red-400 border-red-500/25";
    } else if (status === "processing") {
      classes += "bg-yellow-500/10 text-yellow-400 border-yellow-500/25 animate-pulse";
    } else {
      classes += "bg-neutral-800 text-neutral-400 border-neutral-700";
    }
    return <span className={classes}>{status.replace("_", " ")}</span>;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-500/10 text-violet-400 border border-violet-500/20">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-100">Telegram Sync Diagnostics</h1>
            <p className="text-xs text-neutral-400">Real-time audit log of the natural language pipeline</p>
          </div>
        </div>

        <button
          onClick={fetchLogs}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh Audits
        </button>
      </div>

      {/* Logs View */}
      {isLoading && logs.length === 0 ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="shimmer h-20 rounded-2xl" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20 bg-neutral-900/20 border border-neutral-800 rounded-2xl">
          <MessageSquare className="w-10 h-10 mx-auto text-neutral-600 mb-3" />
          <h3 className="text-sm font-bold text-neutral-300">No audits recorded yet</h3>
          <p className="text-xs text-neutral-500 mt-1">Send a message to your Telegram bot to test the pipeline.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => {
            const isExpanded = expandedLogId === log.id;
            const relativeTime = formatDistanceToNow(new Date(log.created_at), { addSuffix: true });

            return (
              <div
                key={log.id}
                className="bg-neutral-950/80 border border-neutral-800 rounded-2xl overflow-hidden transition-all hover:border-neutral-700"
              >
                {/* Header Summary */}
                <div
                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                  className="p-4 flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] text-neutral-500 font-mono">{log.id.slice(0, 8)}</span>
                      <span className="text-xs text-neutral-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-neutral-500" />
                        {relativeTime}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-900 text-neutral-400 font-mono border border-neutral-800">
                        {log.execution_time_ms}ms
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-neutral-200 truncate">
                      "{log.telegram_message}"
                    </p>
                  </div>

                  {/* Stage Badges */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-neutral-900 p-1 px-2.5 rounded-xl border border-neutral-800">
                      <span className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold">Task</span>
                      {getStatusIcon(log.task_status)}
                    </div>
                    <div className="flex items-center gap-1.5 bg-neutral-900 p-1 px-2.5 rounded-xl border border-neutral-800">
                      <span className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold">Reminder</span>
                      {getStatusIcon(log.reminder_status)}
                    </div>
                    <div className="flex items-center gap-1.5 bg-neutral-900 p-1 px-2.5 rounded-xl border border-neutral-800">
                      <span className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold">Calendar</span>
                      {getStatusIcon(log.calendar_status)}
                    </div>
                    <div className="flex items-center gap-1.5 bg-neutral-900 p-1 px-2.5 rounded-xl border border-neutral-800">
                      <span className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold">Telegram</span>
                      {getStatusIcon(log.telegram_delivery_status)}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Panel */}
                {isExpanded && (
                  <div className="border-t border-neutral-800 bg-neutral-900/30 p-4 space-y-4">
                    {/* Database Audits Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Status Check card */}
                      <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-xl space-y-2">
                        <h4 className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-violet-400" /> Pipeline Stage Audits
                        </h4>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-500">Task Creation:</span>
                            {getStatusBadge(log.task_status)}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-500">Reminder Creation:</span>
                            {getStatusBadge(log.reminder_status)}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-500">Calendar Creation:</span>
                            {getStatusBadge(log.calendar_status)}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-500">Scheduler State:</span>
                            {getStatusBadge(log.scheduler_status)}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-500">Telegram Dispatch:</span>
                            {getStatusBadge(log.telegram_delivery_status)}
                          </div>
                        </div>
                      </div>

                      {/* Database IDs card */}
                      <div className="p-3 bg-neutral-950 border border-neutral-850 rounded-xl space-y-2 col-span-1 md:col-span-1 lg:col-span-2">
                        <h4 className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-blue-400" /> Created Entity Identifiers
                        </h4>
                        <div className="space-y-1 text-xs font-mono">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-neutral-500 shrink-0">Created Task:</span>
                            <span className="text-neutral-300 text-right truncate">
                              {log.created_tasks.length > 0 ? log.created_tasks.join(", ") : "None"}
                            </span>
                          </div>
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-neutral-500 shrink-0">Created Reminder:</span>
                            <span className="text-neutral-300 text-right truncate">
                              {log.created_reminders.length > 0 ? log.created_reminders.join(", ") : "None"}
                            </span>
                          </div>
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-neutral-500 shrink-0">Created Event:</span>
                            <span className="text-neutral-300 text-right truncate">
                              {log.created_events.length > 0 ? log.created_events.join(", ") : "None"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Extracted JSON response payload */}
                    {log.extracted_json && (
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                          <FileCode className="w-3.5 h-3.5 text-emerald-400" /> Extracted LLM Response JSON
                        </h4>
                        <pre className="p-3.5 bg-neutral-950 border border-neutral-850 rounded-xl text-[10px] text-neutral-300 font-mono overflow-x-auto max-h-60 leading-normal">
                          {JSON.stringify(log.extracted_json, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
