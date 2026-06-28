import { createClient } from "@/lib/supabase/server";

export interface UserMemory {
  id: string;
  user_id: string;
  memory_key: string;
  memory_value: string;
  importance: number;
  created_at: string;
  updated_at: string;
  last_used_at: string;
}

export class MemoryService {
  /**
   * Automatically extracts and saves memories from user natural language statements.
   * Runs in the background during chats.
   */
  static async extractAndSaveMemory(userId: string, userMessage: string, supabaseClient?: any): Promise<void> {
    const patterns = [
      { key: "work_hours", keywords: ["work from", "work between", "working hours", "work hours"], regex: /work (?:from|between|hours are) (.*)/i },
      { key: "study_time", keywords: ["study after", "study at", "study between", "study time"], regex: /study (?:after|at|between|time is) (.*)/i },
      { key: "work_duration", keywords: ["work for", "study for", "typical session"], regex: /(?:work|study) (?:for|session is) (.*)/i },
      { key: "productivity_habits", keywords: ["habit", "usually", "prefer to", "i tend to"], regex: /(?:usually|prefer to|tend to) (.*)/i },
      { key: "working_style", keywords: ["working style", "focus block", "pomodoro"], regex: /(?:working style|focus block|prefer) (.*)/i }
    ];

    const supabase = supabaseClient || (await createClient());

    for (const pattern of patterns) {
      const match = userMessage.match(pattern.regex);
      if (match && match[1]) {
        const val = match[1].trim().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");
        console.log(`[MemoryService] Auto-extracted memory: ${pattern.key} -> ${val}`);
        
        await supabase.from("user_memories").upsert(
          {
            user_id: userId,
            memory_key: pattern.key,
            memory_value: val,
            importance: 3,
            updated_at: new Date().toISOString(),
            last_used_at: new Date().toISOString()
          },
          { onConflict: "user_id, memory_key" }
        );
      }
    }
  }

  /**
   * Fetches all memories for a user.
   */
  static async getUserMemories(userId: string, supabaseClient?: any): Promise<UserMemory[]> {
    const supabase = supabaseClient || (await createClient());
    const { data, error } = await supabase
      .from("user_memories")
      .select("*")
      .eq("user_id", userId)
      .order("importance", { ascending: false });
    
    if (error) {
      console.error("[MemoryService] Error fetching memories:", error.message);
      return [];
    }
    return data || [];
  }

  /**
   * Fetches memories relevant to a specific text query (keyword overlap).
   */
  static async getRelevantMemories(userId: string, queryText: string, supabaseClient?: any): Promise<UserMemory[]> {
    const memories = await this.getUserMemories(userId, supabaseClient);
    const queryTokens = queryText.toLowerCase().split(/\s+/);

    // Filter memories where keys or values match query keywords
    return memories.filter((mem) => {
      const keyMatch = queryTokens.some(token => mem.memory_key.toLowerCase().includes(token));
      const valMatch = queryTokens.some(token => mem.memory_value.toLowerCase().includes(token));
      return keyMatch || valMatch;
    });
  }

  /**
   * Adds or updates a memory.
   */
  static async saveMemory(userId: string, key: string, value: string, importance = 3, supabaseClient?: any): Promise<void> {
    const supabase = supabaseClient || (await createClient());
    await supabase.from("user_memories").upsert(
      {
        user_id: userId,
        memory_key: key,
        memory_value: value,
        importance,
        updated_at: new Date().toISOString(),
        last_used_at: new Date().toISOString()
      },
      { onConflict: "user_id, memory_key" }
    );
  }
}
