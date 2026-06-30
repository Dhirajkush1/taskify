import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { inboxItemId, targetType, targetData } = body;

    if (!inboxItemId || !targetType || !targetData) {
      return NextResponse.json({ error: "Missing parameters: inboxItemId, targetType, targetData" }, { status: 400 });
    }

    // 1. Transactionally Insert into the targeted table
    let insertResult;
    switch (targetType) {
      case "project_task": {
        const { project_id, title, description, priority, due_date } = targetData;
        if (!project_id || !title) {
          return NextResponse.json({ error: "Missing required fields for project_task conversion" }, { status: 400 });
        }
        insertResult = await supabase
          .from("project_tasks")
          .insert({
            user_id: user.id,
            project_id,
            title,
            description,
            status: "todo",
            priority: priority || "medium",
            due_date: due_date || null
          })
          .select()
          .single();
        break;
      }
      case "goal_task": {
        const { objective_id, title, description, priority, deadline } = targetData;
        if (!objective_id || !title) {
          return NextResponse.json({ error: "Missing required fields for goal_task conversion" }, { status: 400 });
        }
        insertResult = await supabase
          .from("goal_tasks")
          .insert({
            user_id: user.id,
            objective_id,
            title,
            description,
            status: "todo",
            priority: priority || "medium",
            deadline: deadline || null
          })
          .select()
          .single();
        break;
      }
      case "reminder": {
        const { title, description, reminder_time } = targetData;
        if (!title || !reminder_time) {
          return NextResponse.json({ error: "Missing required fields for reminder conversion" }, { status: 400 });
        }
        insertResult = await supabase
          .from("reminders")
          .insert({
            user_id: user.id,
            title,
            description,
            reminder_time,
            status: "pending"
          })
          .select()
          .single();
        break;
      }
      case "habit": {
        const { title, description, frequency, goal_id } = targetData;
        if (!title || !frequency) {
          return NextResponse.json({ error: "Missing required fields for habit conversion" }, { status: 400 });
        }
        insertResult = await supabase
          .from("habits")
          .insert({
            user_id: user.id,
            goal_id: goal_id || null,
            title,
            description,
            frequency,
            streak: 0
          })
          .select()
          .single();
        break;
      }
      case "task": {
        const { title, description, priority, deadline } = targetData;
        if (!title) {
          return NextResponse.json({ error: "Missing required title for task conversion" }, { status: 400 });
        }
        insertResult = await supabase
          .from("tasks")
          .insert({
            user_id: user.id,
            title,
            description,
            status: "todo",
            priority: priority || "medium",
            deadline: deadline || null
          })
          .select()
          .single();
        break;
      }
      default:
        return NextResponse.json({ error: `Invalid targetType: ${targetType}` }, { status: 400 });
    }

    if (insertResult.error) {
      return NextResponse.json({ error: `Conversion insertion failed: ${insertResult.error.message}` }, { status: 500 });
    }

    // 2. Delete the inbox item now that conversion succeeded
    const { error: deleteError } = await supabase
      .from("inbox_items")
      .delete()
      .eq("id", inboxItemId)
      .eq("user_id", user.id);

    if (deleteError) {
      console.warn(`[InboxConvert] Non-blocking warn: inbox item delete failed: ${deleteError.message}`);
    }

    return NextResponse.json({ success: true, item: insertResult.data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
