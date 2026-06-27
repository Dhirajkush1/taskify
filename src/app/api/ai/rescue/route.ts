import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RescueEngine } from "@/lib/ai/rescue-engine";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: plan } = await supabase
      .from("rescue_plans")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({ plan });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { action, forceTaskTitle, forceReason } = body;

    if (action === "deactivate") {
      await RescueEngine.deactivateRescue(user.id);
      return NextResponse.json({ success: true, message: "Rescue Mode deactivated successfully." });
    }

    // Run emergency detection / trigger
    const plan = await RescueEngine.detectAndRunRescue(user.id, forceTaskTitle, forceReason);
    return NextResponse.json({ success: true, plan });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
