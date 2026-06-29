import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DashboardService } from "@/lib/ai/dashboard-service";
import { QuickStats } from "@/components/dashboard/quick-stats";
import { TodayMissions } from "@/components/dashboard/today-missions";
import { UpcomingDeadlines } from "@/components/dashboard/upcoming-deadlines";
import { AutonomousWidgets } from "@/components/dashboard/autonomous-widgets";
import CalendarIntelligenceCard from "@/components/dashboard/calendar-intelligence";

export const metadata: Metadata = { title: "Dashboard" };

// Force dynamic rendering to bypass Next.js route caching.
// This ensures that when the client triggers a router.refresh() on realtime events,
// the server fetches the absolute latest database state.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Retrieve the single, unified database dashboard state
  const dashboardData = await DashboardService.getDashboardData(user.id);

  // Fetch all tasks to pass to the heatmap and sub-widgets (requires full array)
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .neq("status", "archived")
    .order("deadline", { ascending: true, nullsFirst: false });

  const taskList = tasks ?? [];

  const { data: profile } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const firstName = profile?.full_name?.split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-7">
      {/* Header Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5" style={{ borderColor: "var(--border)" }}>
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            {greeting}, {firstName} 👋
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Your autonomous productivity overview. Clutch AI is active and tracking your missions.
          </p>
        </div>
      </div>

      {/* Quick Metrics Cards */}
      <QuickStats stats={dashboardData.stats} />

      {/* Autonomous Intelligence Widgets Section */}
      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-violet-400 pl-1">
          Autonomous Command Center
        </h2>
        <AutonomousWidgets
          dashboardData={dashboardData}
          tasks={taskList}
          userId={user.id}
        />
      </div>

      {/* Core Task Board Overview Grid */}
      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-400 pl-1">
          Active Mission Queue
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Today's Missions — wide */}
          <div className="lg:col-span-2">
            <TodayMissions tasks={taskList} />
          </div>

          {/* Upcoming Deadlines & Calendar Insights */}
          <div className="space-y-6">
            <CalendarIntelligenceCard />
            <UpcomingDeadlines tasks={taskList} />
          </div>
        </div>
      </div>
    </div>
  );
}
