import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoalService } from "@/lib/ai/goal-service";

export const runtime = "nodejs";

interface DecomposeRequestBody {
  goalTitle: string;
  milestoneId: string;
  milestoneTitle: string;
  milestoneDescription?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: DecomposeRequestBody = await request.json();
    const { goalTitle, milestoneId, milestoneTitle, milestoneDescription } = body;

    if (!goalTitle || !milestoneId || !milestoneTitle) {
      return NextResponse.json(
        { error: "goalTitle, milestoneId, and milestoneTitle are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // --- SELF-HEALING DATABASE BLOCK ---
    // Check if the user profile exists in public.users. If it's missing, insert it.
    // This prevents foreign key violations (tasks_user_id_fkey) for users created before migrations were run.
    const { data: publicUser } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!publicUser) {
      console.log(`[Self-Healing] Public profile missing in public.users for ID ${user.id} during goal decomposition. Creating...`);
      const { error: insertUserError } = await supabase
        .from("users")
        .insert({
          id: user.id,
          email: user.email || "",
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
          avatar_url: user.user_metadata?.avatar_url || null,
        });

      if (insertUserError) {
        console.error("[Self-Healing] Failed to create public user profile in goals:", insertUserError.message);
      } else {
        console.log("[Self-Healing] Public user profile self-healed successfully in goals!");
        // Ensure settings record exists
        await supabase.from("settings").insert({ user_id: user.id });
      }
    }
    // -----------------------------------

    // Call GoalService to decompose the milestone and auto-insert tasks
    const generatedTasks = await GoalService.autoDecomposeMilestone(
      user.id,
      goalTitle,
      milestoneId,
      milestoneTitle,
      milestoneDescription
    );

    return NextResponse.json({
      success: true,
      message: `Successfully decomposed milestone into ${generatedTasks.length} tasks.`,
      tasks: generatedTasks,
    });
  } catch (error: any) {
    console.error("[/api/ai/goals] Error decomposing milestone:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
