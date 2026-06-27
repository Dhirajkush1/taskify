"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useSupabase } from "@/providers/supabase-provider";

export function RealtimeSyncProvider({ children }: { children: ReactNode }) {
  const { user } = useSupabase();
  const router = useRouter();
  const queryClient = useQueryClient();

  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;

    console.log("[RealtimeSync] Initializing database realtime subscription for user:", userId);
    const supabase = createClient();

    // Subscribe to all public postgres database changes.
    // RLS filters the broadcast messages so the user only receives updates for their own rows.
    const channel = supabase
      .channel("public-db-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
        },
        (payload) => {
          console.log("[RealtimeSync] Database change payload received:", payload);
          
          // 1. Invalidate TanStack Query caches
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          queryClient.invalidateQueries({ queryKey: ["reminders"] });
          queryClient.invalidateQueries({ queryKey: ["goals"] });
          queryClient.invalidateQueries({ queryKey: ["focus_sessions"] });
          queryClient.invalidateQueries({ queryKey: ["user_memories"] });

          // 2. Refresh Next.js Server Components to re-fetch database rows on the server
          router.refresh();
        }
      )
      .subscribe((status) => {
        console.log(`[RealtimeSync] Subscription status: ${status}`);
      });

    return () => {
      console.log("[RealtimeSync] Unsubscribing from realtime changes...");
      supabase.removeChannel(channel);
    };
  }, [userId, router, queryClient]);

  return <>{children}</>;
}
