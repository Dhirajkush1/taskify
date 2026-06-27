// ============================================================
// Supabase Database Types — Generated from Schema
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          content?: string;
          metadata?: Json;
        };
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          parent_task_id: string | null;
          title: string;
          description: string | null;
          deadline: string | null;
          priority: "critical" | "high" | "medium" | "low";
          status: "todo" | "in_progress" | "done" | "archived";
          estimated_duration: number | null;
          completion_percentage: number;
          risk_level: "low" | "medium" | "high" | "critical";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          parent_task_id?: string | null;
          title: string;
          description?: string | null;
          deadline?: string | null;
          priority?: "critical" | "high" | "medium" | "low";
          status?: "todo" | "in_progress" | "done" | "archived";
          estimated_duration?: number | null;
          completion_percentage?: number;
          risk_level?: "low" | "medium" | "high" | "critical";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          parent_task_id?: string | null;
          title?: string;
          description?: string | null;
          deadline?: string | null;
          priority?: "critical" | "high" | "medium" | "low";
          status?: "todo" | "in_progress" | "done" | "archived";
          estimated_duration?: number | null;
          completion_percentage?: number;
          risk_level?: "low" | "medium" | "high" | "critical";
          updated_at?: string;
        };
      };
      subtasks: {
        Row: {
          id: string;
          task_id: string;
          title: string;
          is_completed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          title: string;
          is_completed?: boolean;
          created_at?: string;
        };
        Update: {
          title?: string;
          is_completed?: boolean;
        };
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: never;
      };
      settings: {
        Row: {
          id: string;
          user_id: string;
          theme: string;
          notifications_enabled: boolean;
          ai_suggestions_enabled: boolean;
          daily_summary_time: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          theme?: string;
          notifications_enabled?: boolean;
          ai_suggestions_enabled?: boolean;
          daily_summary_time?: string | null;
          updated_at?: string;
        };
        Update: {
          theme?: string;
          notifications_enabled?: boolean;
          ai_suggestions_enabled?: boolean;
          daily_summary_time?: string | null;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
