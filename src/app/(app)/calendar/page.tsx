"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar as CalendarIcon, Clock, Sparkles, Loader2, RefreshCw, 
  ChevronLeft, ChevronRight, MapPin, Users, Video, Plus, Eye, Grid, List, AlignLeft
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { triggerConfetti } from "@/components/shared/confetti-canvas";
import { toast } from "sonner";
import { 
  format, startOfWeek, endOfWeek, eachDayOfInterval, addDays, subDays, 
  isSameDay, addMonths, subMonths, startOfMonth, endOfMonth, parseISO, 
  addMinutes, differenceInMinutes, setHours, setMinutes
} from "date-fns";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  meeting_link?: string;
  start_time: string;
  end_time: string;
  event_type: "external" | "focus_block" | "travel_buffer" | "meeting_prep" | "task_block";
  status: string;
  visibility: string;
  guests?: Array<{ email: string; responseStatus: string }>;
  task_id?: string;
  ai_analysis?: any;
}

type ViewMode = "month" | "week" | "day" | "agenda" | "timeline";

export default function CalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [useUtc, setUseUtc] = useState(false);
  
  // Drag-and-drop state
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  
  // Resizing state
  const [resizingEvent, setResizingEvent] = useState<{ id: string; originalEnd: Date } | null>(null);
  const resizeStartY = useRef<number>(0);
  const resizeStartHeight = useRef<number>(0);

  const supabase = useMemo(() => createClient(), []);

  // Timezone display helper
  const displayTime = useCallback((isoString: string) => {
    const date = new Date(isoString);
    if (useUtc) {
      return date.toUTCString().replace("GMT", "UTC");
    }
    return format(date, "h:mm a");
  }, [useUtc]);

  // Load calendar events from endpoint
  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch 1 month bounds based on current date
      const startRange = subDays(startOfMonth(currentDate), 7).toISOString();
      const endRange = addDays(endOfMonth(currentDate), 7).toISOString();

      const response = await fetch(`/api/calendar/events?start=${startRange}&end=${endRange}`);
      if (!response.ok) throw new Error("Failed to fetch events");

      const payload = await response.json();
      setEvents(payload.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load calendar events.");
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if input is focused
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }
      
      switch (e.key.toLowerCase()) {
        case "t":
          setCurrentDate(new Date());
          break;
        case "m":
          setViewMode("month");
          break;
        case "w":
          setViewMode("week");
          break;
        case "d":
          setViewMode("day");
          break;
        case "a":
          setViewMode("agenda");
          break;
        case "l":
          setViewMode("timeline");
          break;
        case "arrowleft":
          navigate(-1);
          break;
        case "arrowright":
          navigate(1);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, currentDate]);

  const navigate = (direction: number) => {
    if (viewMode === "month") {
      setCurrentDate(prev => direction > 0 ? addMonths(prev, 1) : subMonths(prev, 1));
    } else if (viewMode === "week") {
      setCurrentDate(prev => addDays(prev, direction * 7));
    } else if (viewMode === "day" || viewMode === "timeline") {
      setCurrentDate(prev => addDays(prev, direction));
    } else {
      setCurrentDate(prev => addDays(prev, direction * 3));
    }
  };

  // Sync with Google Calendar manually
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/calendar/sync", { method: "POST" });
      if (res.ok) {
        toast.success("Google Calendar sync complete!");
        loadEvents();
      } else {
        toast.error("Sync failed.");
      }
    } catch {
      toast.error("Network error triggering sync.");
    } finally {
      setSyncing(false);
    }
  };

  // AI Auto-Schedule calculations
  const handleAutoSchedule = async () => {
    setOptimizing(true);
    toast.info("Clutch AI is block-scheduling pending tasks...");
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "user", content: "Optimize and block-schedule my focus blocks in calendar availability windows for today." }
          ]
        })
      });

      if (res.ok) {
        toast.success("AI calendar optimization successful!");
        triggerConfetti();
        loadEvents();
      } else {
        toast.error("Failed to auto-schedule.");
      }
    } catch {
      toast.error("Auto-scheduling request failed.");
    } finally {
      setViewMode("day");
      setOptimizing(false);
    }
  };

  // Native Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, eventId: string) => {
    setDraggingEventId(eventId);
    e.dataTransfer.setData("text/plain", eventId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetDate: Date, targetHour: number) => {
    e.preventDefault();
    const eventId = e.dataTransfer.getData("text/plain") || draggingEventId;
    if (!eventId) return;

    setDraggingEventId(null);

    // Calculate new start time
    let newStart = setHours(targetDate, targetHour);
    newStart = setMinutes(newStart, 0);

    const originalEvent = events.find(ev => ev.id === eventId);
    if (!originalEvent) return;

    // Preserve duration
    const duration = differenceInMinutes(
      new Date(originalEvent.end_time),
      new Date(originalEvent.start_time)
    );
    const newEnd = addMinutes(newStart, duration);

    // Optimistic UI update
    setEvents(prev => 
      prev.map(ev => 
        ev.id === eventId 
          ? { ...ev, start_time: newStart.toISOString(), end_time: newEnd.toISOString() } 
          : ev
      )
    );

    try {
      const response = await fetch(`/api/calendar/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString()
        })
      });

      if (!response.ok) throw new Error();
      toast.success("Event rescheduled successfully.");
      loadEvents(); // reload to confirm
    } catch {
      toast.error("Failed to reschedule event.");
      loadEvents(); // rollback
    }
  };

  // Event Card styling lookup based on type and status
  const getEventStyle = (event: CalendarEvent) => {
    if (event.status === "completed") {
      return "bg-emerald-500/5 border-emerald-500/20 text-emerald-400 opacity-60";
    }
    
    switch (event.event_type) {
      case "focus_block":
        return "bg-violet-500/10 border-violet-500/30 text-violet-300 shadow-sm shadow-violet-500/5";
      case "travel_buffer":
        return "bg-amber-500/5 border-amber-500/20 text-amber-300 border-dashed";
      case "meeting_prep":
        return "bg-cyan-500/10 border-cyan-500/25 text-cyan-300";
      case "task_block":
        return "bg-red-500/10 border-red-500/30 text-red-300";
      default: // external GCal commitments
        return "bg-neutral-900/90 border-neutral-800 text-neutral-200";
    }
  };

  // Helper arrays for calendar views
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const hours = useMemo(() => {
    const list = [];
    for (let i = 8; i <= 20; i++) {
      list.push(i);
    }
    return list;
  }, []);

  const handleCompleteTask = async (taskId: string, eventId: string) => {
    const { error } = await supabase
      .from("tasks")
      .update({ status: "done", completion_percentage: 100 })
      .eq("id", taskId);

    if (!error) {
      setEvents(prev => 
        prev.map(item => item.id === eventId ? { ...item, status: "completed" } : item)
      );
      triggerConfetti();
      toast.success("Task completed successfully.");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Upper Navigation Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <CalendarIcon className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-neutral-100">
              {viewMode === "month" && format(currentDate, "MMMM yyyy")}
              {viewMode === "week" && `Week of ${format(weekDays[0], "MMM d, yyyy")}`}
              {viewMode === "day" && format(currentDate, "EEEE, MMMM d, yyyy")}
              {viewMode === "timeline" && `Timeline — ${format(currentDate, "MMM d")}`}
              {viewMode === "agenda" && "Agenda Planner"}
            </h1>
            <p className="text-[11px] text-neutral-500 mt-0.5">Clutch Intelligent Calendar OS</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* UTC vs Local timezone */}
          <button
            onClick={() => setUseUtc(!useUtc)}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-white/5 bg-white/5 text-neutral-400 hover:text-white transition-all cursor-pointer"
          >
            {useUtc ? "Time: UTC" : "Time: Local"}
          </button>

          {/* Navigation Arrows */}
          <div className="flex items-center bg-white/5 border border-white/5 rounded-xl overflow-hidden">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/5 text-neutral-400 hover:text-white cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-2 text-xs font-semibold hover:bg-white/5 text-neutral-300 hover:text-white border-x border-neutral-900 cursor-pointer">Today</button>
            <button onClick={() => navigate(1)} className="p-2 hover:bg-white/5 text-neutral-400 hover:text-white cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
          </div>

          {/* View Toggles */}
          <div className="flex items-center bg-white/5 border border-white/5 rounded-xl p-0.5">
            {(["month", "week", "day", "agenda", "timeline"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  viewMode === mode 
                    ? "bg-violet-600 text-white shadow" 
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-neutral-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer disabled:opacity-50"
            title="Force Google Calendar Sync"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleAutoSchedule}
            disabled={optimizing}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-all shadow-md hover:scale-[1.02] cursor-pointer disabled:opacity-50"
            style={{ background: "var(--primary)" }}
          >
            {optimizing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 animate-pulse text-yellow-300" />
                AI Auto-Schedule
              </>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
        </div>
      ) : (
        <div className="bg-neutral-950/40 rounded-3xl border p-4" style={{ borderColor: "var(--border)" }}>
          <AnimatePresence mode="wait">
            {viewMode === "day" && (
              <motion.div
                key="day"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-1"
              >
                <div className="grid grid-cols-12 border-b border-neutral-900 pb-2 mb-2">
                  <div className="col-span-2 text-xs font-bold text-neutral-500 uppercase">Hour</div>
                  <div className="col-span-10 text-xs font-bold text-neutral-400 uppercase">Commitments</div>
                </div>

                {hours.map((hour) => {
                  const dayEvents = events.filter(e => {
                    const eventStart = new Date(e.start_time);
                    return isSameDay(eventStart, currentDate) && eventStart.getHours() === hour;
                  });

                  return (
                    <div 
                      key={hour} 
                      className="grid grid-cols-12 min-h-16 border-b border-neutral-950/40 py-2 relative"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, currentDate, hour)}
                    >
                      <div className="col-span-2 text-xs font-mono font-bold text-neutral-500">
                        {hour === 12 ? "12:00 PM" : hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`}
                      </div>
                      <div className="col-span-10 flex flex-col gap-2 relative">
                        {dayEvents.map((event) => {
                          const start = new Date(event.start_time);
                          const end = new Date(event.end_time);
                          const durationMins = differenceInMinutes(end, start);
                          const cardHeight = Math.max(50, (durationMins / 60) * 60);

                          return (
                            <div
                              key={event.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, event.id)}
                              className={`rounded-xl p-3 border text-xs flex flex-col justify-between cursor-grab active:cursor-grabbing transition-all select-none relative ${getEventStyle(event)}`}
                              style={{ minHeight: `${cardHeight}px` }}
                            >
                              <div>
                                <div className="flex items-center justify-between">
                                  <h4 className="font-bold tracking-tight text-neutral-100">{event.title}</h4>
                                  
                                  {event.task_id && event.status !== "completed" && (
                                    <button
                                      onClick={() => handleCompleteTask(event.task_id!, event.id)}
                                      className="w-4 h-4 rounded bg-white/5 border border-white/10 flex items-center justify-center hover:bg-emerald-500/20 hover:border-emerald-500/30 text-emerald-400 cursor-pointer"
                                    >
                                      ✓
                                    </button>
                                  )}
                                </div>
                                <span className="text-[10px] opacity-60 flex items-center gap-1 mt-1">
                                  <Clock className="w-3 h-3" /> {displayTime(event.start_time)} - {displayTime(event.end_time)}
                                </span>
                              </div>

                              {event.location && (
                                <span className="text-[9px] opacity-50 flex items-center gap-1 mt-2">
                                  <MapPin className="w-2.5 h-2.5" /> {event.location}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}

            {viewMode === "week" && (
              <motion.div
                key="week"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="overflow-x-auto"
              >
                <div className="min-w-[800px]">
                  {/* Grid Header days */}
                  <div className="grid grid-cols-8 border-b border-neutral-900 pb-3 mb-2 text-center">
                    <div className="text-left pl-2 text-xs font-bold text-neutral-500 uppercase">Hour</div>
                    {weekDays.map((day) => {
                      const isToday = isSameDay(day, new Date());
                      return (
                        <div key={day.toISOString()} className="flex flex-col items-center">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? "text-violet-400" : "text-neutral-500"}`}>
                            {format(day, "eee")}
                          </span>
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-1 ${
                            isToday ? "bg-violet-600 text-white" : "text-neutral-300"
                          }`}>
                            {format(day, "d")}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Hourly Grid Rows */}
                  {hours.map((hour) => (
                    <div key={hour} className="grid grid-cols-8 min-h-16 border-b border-neutral-950/40 py-2 relative">
                      <div className="text-xs font-mono font-bold text-neutral-500 pt-0.5">
                        {hour === 12 ? "12:00 PM" : hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`}
                      </div>

                      {weekDays.map((day) => {
                        const dayEvents = events.filter(e => {
                          const start = new Date(e.start_time);
                          return isSameDay(start, day) && start.getHours() === hour;
                        });

                        return (
                          <div 
                            key={day.toISOString()} 
                            className="border-l border-neutral-950/40 min-h-12 relative px-1 flex flex-col gap-1.5"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, day, hour)}
                          >
                            {dayEvents.map((event) => (
                              <div
                                key={event.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, event.id)}
                                className={`rounded-lg p-2 border text-[10px] flex flex-col justify-between cursor-grab active:cursor-grabbing transition-all select-none ${getEventStyle(event)}`}
                              >
                                <div>
                                  <h4 className="font-bold leading-tight truncate text-neutral-200">{event.title}</h4>
                                  <span className="text-[8px] opacity-60 block mt-0.5">
                                    {displayTime(event.start_time)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {viewMode === "month" && (
              <motion.div
                key="month"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="grid grid-cols-7 gap-1"
              >
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} className="text-center py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider border-b border-neutral-900">
                    {d}
                  </div>
                ))}

                {(() => {
                  const startMonth = startOfMonth(currentDate);
                  const endMonth = endOfMonth(currentDate);
                  const startCal = startOfWeek(startMonth, { weekStartsOn: 1 });
                  const endCal = endOfWeek(endMonth, { weekStartsOn: 1 });
                  const days = eachDayOfInterval({ start: startCal, end: endCal });

                  return days.map((day) => {
                    const dayEvents = events.filter(e => isSameDay(new Date(e.start_time), day));
                    const isToday = isSameDay(day, new Date());
                    const isCurrentMonth = day.getMonth() === currentDate.getMonth();

                    return (
                      <div
                        key={day.toISOString()}
                        onClick={() => {
                          setCurrentDate(day);
                          setViewMode("day");
                        }}
                        className={`min-h-24 p-2 rounded-xl border border-neutral-950/65 bg-neutral-900/20 hover:bg-neutral-900/40 transition-all cursor-pointer flex flex-col justify-between ${
                          isCurrentMonth ? "opacity-100" : "opacity-30"
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          isToday ? "bg-violet-600 text-white font-extrabold" : "text-neutral-400"
                        }`}>
                          {format(day, "d")}
                        </span>

                        <div className="space-y-1 mt-2 max-h-16 overflow-hidden">
                          {dayEvents.slice(0, 3).map((event) => (
                            <div
                              key={event.id}
                              className={`text-[8px] px-1 py-0.5 rounded border truncate ${
                                event.event_type === "focus_block" ? "bg-violet-500/10 border-violet-500/20 text-violet-300" :
                                event.event_type === "external" ? "bg-neutral-800 border-neutral-700 text-neutral-200" :
                                "bg-neutral-950 border-neutral-900 text-neutral-400"
                              }`}
                            >
                              {event.title}
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-[7px] text-neutral-500 font-bold text-right pr-1">
                              +{dayEvents.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </motion.div>
            )}

            {viewMode === "agenda" && (
              <motion.div
                key="agenda"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-4 max-h-[500px] overflow-y-auto pr-2"
              >
                {(() => {
                  // Group events by day
                  const grouped: Record<string, CalendarEvent[]> = {};
                  events.forEach(e => {
                    const dateKey = format(new Date(e.start_time), "yyyy-MM-dd");
                    if (!grouped[dateKey]) grouped[dateKey] = [];
                    grouped[dateKey].push(e);
                  });

                  const sortedKeys = Object.keys(grouped).sort();

                  if (sortedKeys.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <List className="w-8 h-8 text-neutral-600 mb-2" />
                        <p className="text-xs text-neutral-500">No scheduled commitments on your agenda.</p>
                      </div>
                    );
                  }

                  return sortedKeys.map(key => {
                    const date = parseISO(key);
                    const dayEvents = grouped[key];
                    return (
                      <div key={key} className="space-y-2 border-b border-neutral-900 pb-3 last:border-0">
                        <h3 className="text-xs font-bold text-violet-400 sticky top-0 bg-neutral-950 py-1 z-10">
                          {format(date, "EEEE, MMMM d, yyyy")}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {dayEvents.map(e => (
                            <div 
                              key={e.id}
                              className={`p-3.5 rounded-xl border flex flex-col justify-between gap-1.5 ${getEventStyle(e)}`}
                            >
                              <div>
                                <div className="flex items-start justify-between gap-3">
                                  <span className="font-bold text-xs text-neutral-100">{e.title}</span>
                                  {e.event_type !== "external" && (
                                    <span className="text-[7px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-widest bg-violet-500/10 text-violet-400">
                                      {e.event_type.replace("_", " ")}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-neutral-400 mt-1 flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> {displayTime(e.start_time)} - {displayTime(e.end_time)}
                                </span>
                                {e.description && (
                                  <p className="text-[10px] text-neutral-500 mt-1">{e.description}</p>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-3 pt-2 text-[9px] text-neutral-500 border-t border-white/5 mt-1">
                                {e.location && <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {e.location}</span>}
                                {e.meeting_link && (
                                  <a href={e.meeting_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-violet-400 hover:text-violet-300">
                                    <Video className="w-2.5 h-2.5" /> Meet Link
                                  </a>
                                )}
                                {e.guests && e.guests.length > 0 && <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5" /> {e.guests.length} guests</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
              </motion.div>
            )}

            {viewMode === "timeline" && (
              <motion.div
                key="timeline"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
                  <span className="text-xs font-bold text-neutral-400">Daily Timeline View</span>
                  <span className="text-[9px] bg-neutral-900 px-2 py-0.5 rounded text-neutral-500 font-mono">24h Track</span>
                </div>

                <div className="relative h-20 bg-neutral-900/30 rounded-2xl border border-neutral-900 overflow-hidden">
                  {/* Hour markers */}
                  <div className="absolute inset-0 flex justify-between pointer-events-none px-4">
                    {[8, 10, 12, 14, 16, 18, 20].map((h) => (
                      <div key={h} className="h-full border-r border-neutral-950 flex flex-col justify-between py-1">
                        <span className="text-[8px] font-mono text-neutral-600 font-bold">{h > 12 ? `${h-12}PM` : `${h}AM`}</span>
                      </div>
                    ))}
                  </div>

                  {/* Absolute positioned events */}
                  {events
                    .filter(e => isSameDay(new Date(e.start_time), currentDate))
                    .map((event) => {
                      const start = new Date(event.start_time);
                      const end = new Date(event.end_time);
                      const startHour = start.getHours() + start.getMinutes() / 60;
                      const endHour = end.getHours() + end.getMinutes() / 60;

                      // Map hours 8-20 to percentage 0-100
                      const leftPercent = Math.max(0, Math.min(100, ((startHour - 8) / 12) * 100));
                      const widthPercent = Math.max(5, Math.min(100 - leftPercent, ((endHour - startHour) / 12) * 100));

                      return (
                        <div
                          key={event.id}
                          className={`absolute top-6 bottom-2 rounded-xl p-1 px-2 text-[9px] border font-semibold flex flex-col justify-center truncate ${getEventStyle(event)}`}
                          style={{
                            left: `${leftPercent}%`,
                            width: `${widthPercent}%`,
                          }}
                          title={`${event.title} (${displayTime(event.start_time)} - ${displayTime(event.end_time)})`}
                        >
                          <span className="truncate">{event.title}</span>
                        </div>
                      );
                    })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
