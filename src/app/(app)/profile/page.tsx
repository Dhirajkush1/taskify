import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getInitials } from "@/lib/utils";
import { Mail, Calendar } from "lucide-react";
import { format } from "date-fns";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: recentActivity } = await supabase
    .from("activity_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const initials = getInitials(profile?.full_name ?? null);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      {/* Profile Card */}
      <section
        className="rounded-2xl p-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0"
            style={{
              background: "linear-gradient(135deg, var(--primary), oklch(0.65 0.22 230))",
            }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              {profile?.full_name || "User"}
            </h2>
            <div className="flex items-center gap-1.5 mt-1">
              <Mail className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {profile?.email || user.email}
              </p>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <Calendar className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Joined {profile?.created_at ? format(new Date(profile.created_at), "MMMM yyyy") : "—"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Activity Log */}
      <section
        className="rounded-2xl p-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h2 className="text-base font-semibold mb-4" style={{ color: "var(--text-primary)", fontSize: "1rem" }}>
          Recent Activity
        </h2>

        {!recentActivity || recentActivity.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>
            No activity yet — start completing missions!
          </p>
        ) : (
          <div className="space-y-2">
            {recentActivity.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 py-2.5 px-3 rounded-xl"
                style={{ background: "var(--surface-raised)" }}
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    background:
                      log.action === "task_completed"
                        ? "var(--accent)"
                        : log.action === "task_created"
                          ? "var(--primary)"
                          : "var(--text-muted)",
                  }}
                />
                <p className="flex-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {log.action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {format(new Date(log.created_at), "MMM d, h:mm a")}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
