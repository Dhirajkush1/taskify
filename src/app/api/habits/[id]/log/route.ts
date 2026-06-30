import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { completed } = body; // boolean

    // Fetch the habit
    const { data: habit, error: fetchError } = await supabase
      .from("habits")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !habit) {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 });
    }

    let newStreak = habit.streak;
    let newLastCompleted = habit.last_completed_at;

    if (completed) {
      // If already completed today, do nothing
      const isAlreadyCompletedToday = habit.last_completed_at && 
        new Date(habit.last_completed_at).toDateString() === new Date().toDateString();
      
      if (!isAlreadyCompletedToday) {
        newStreak = habit.streak + 1;
        newLastCompleted = new Date().toISOString();
      }
    } else {
      // Un-complete
      if (newStreak > 0) {
        newStreak = habit.streak - 1;
      }
      newLastCompleted = null;
    }

    const { data: updatedHabit, error: updateError } = await supabase
      .from("habits")
      .update({
        streak: newStreak,
        last_completed_at: newLastCompleted,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, habit: updatedHabit });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
