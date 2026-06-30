// ============================================================
// Supabase Database Types — Generated from Schema & Migrations
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
        Relationships: [];
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
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          metadata: Json;
          source: "web" | "telegram" | "whatsapp" | "discord";
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          metadata?: Json;
          source?: "web" | "telegram" | "whatsapp" | "discord";
          created_at?: string;
        };
        Update: {
          content?: string;
          metadata?: Json;
          source?: "web" | "telegram" | "whatsapp" | "discord";
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          parent_task_id: string | null;
          milestone_id: string | null;
          title: string;
          description: string | null;
          deadline: string | null;
          priority: "critical" | "high" | "medium" | "low";
          status: "todo" | "in_progress" | "done" | "archived";
          estimated_duration: number | null;
          completion_percentage: number;
          risk_level: "low" | "medium" | "high" | "critical";
          priority_score: number | null;
          completion_probability: number | null;
          dependencies: Json | null;
          missing_information: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          parent_task_id?: string | null;
          milestone_id?: string | null;
          title: string;
          description?: string | null;
          deadline?: string | null;
          priority?: "critical" | "high" | "medium" | "low";
          status?: "todo" | "in_progress" | "done" | "archived";
          estimated_duration?: number | null;
          completion_percentage?: number;
          risk_level?: "low" | "medium" | "high" | "critical";
          priority_score?: number | null;
          completion_probability?: number | null;
          dependencies?: Json | null;
          missing_information?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          parent_task_id?: string | null;
          milestone_id?: string | null;
          title?: string;
          description?: string | null;
          deadline?: string | null;
          priority?: "critical" | "high" | "medium" | "low";
          status?: "todo" | "in_progress" | "done" | "archived";
          estimated_duration?: number | null;
          completion_percentage?: number;
          risk_level?: "low" | "medium" | "high" | "critical";
          priority_score?: number | null;
          completion_probability?: number | null;
          dependencies?: Json | null;
          missing_information?: string | null;
          updated_at?: string;
        };
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      settings: {
        Row: {
          id: string;
          user_id: string;
          theme: string;
          notifications_enabled: boolean;
          ai_suggestions_enabled: boolean;
          daily_summary_time: string | null;
          ai_personality: "friendly_coach" | "strict_coach" | "minimal_assistant" | "student_mentor" | "professional_planner";
          timezone: string;
          locale: string;
          country: string;
          working_hours_start: string;
          working_hours_end: string;
          week_start: number;
          preferred_focus_hours_start: string;
          preferred_focus_hours_end: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          theme?: string;
          notifications_enabled?: boolean;
          ai_suggestions_enabled?: boolean;
          daily_summary_time?: string | null;
          ai_personality?: "friendly_coach" | "strict_coach" | "minimal_assistant" | "student_mentor" | "professional_planner";
          timezone?: string;
          locale?: string;
          country?: string;
          working_hours_start?: string;
          working_hours_end?: string;
          week_start?: number;
          preferred_focus_hours_start?: string;
          preferred_focus_hours_end?: string;
          updated_at?: string;
        };
        Update: {
          theme?: string;
          notifications_enabled?: boolean;
          ai_suggestions_enabled?: boolean;
          daily_summary_time?: string | null;
          ai_personality?: "friendly_coach" | "strict_coach" | "minimal_assistant" | "student_mentor" | "professional_planner";
          timezone?: string;
          locale?: string;
          country?: string;
          working_hours_start?: string;
          working_hours_end?: string;
          week_start?: number;
          preferred_focus_hours_start?: string;
          preferred_focus_hours_end?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_memories: {
        Row: {
          id: string;
          user_id: string;
          memory_key: string;
          memory_value: string;
          importance: number;
          created_at: string;
          updated_at: string;
          last_used_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          memory_key: string;
          memory_value: string;
          importance?: number;
          created_at?: string;
          updated_at?: string;
          last_used_at?: string;
        };
        Update: {
          memory_key?: string;
          memory_value?: string;
          importance?: number;
          updated_at?: string;
          last_used_at?: string;
        };
        Relationships: [];
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          target_date: string | null;
          status: "active" | "completed" | "paused" | "cancelled";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          target_date?: string | null;
          status?: "active" | "completed" | "paused" | "cancelled";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          target_date?: string | null;
          status?: "active" | "completed" | "paused" | "cancelled";
          updated_at?: string;
        };
        Relationships: [];
      };
      milestones: {
        Row: {
          id: string;
          goal_id: string;
          title: string;
          description: string | null;
          target_date: string | null;
          status: "todo" | "in_progress" | "done" | "cancelled";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          goal_id: string;
          title: string;
          description?: string | null;
          target_date?: string | null;
          status?: "todo" | "in_progress" | "done" | "cancelled";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          goal_id?: string;
          title?: string;
          description?: string | null;
          target_date?: string | null;
          status?: "todo" | "in_progress" | "done" | "cancelled";
          updated_at?: string;
        };
        Relationships: [];
      };
      focus_sessions: {
        Row: {
          id: string;
          user_id: string;
          task_id: string | null;
          duration_minutes: number;
          completed_minutes: number;
          status: "active" | "paused" | "completed" | "cancelled";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id?: string | null;
          duration_minutes: number;
          completed_minutes?: number;
          status?: "active" | "paused" | "completed" | "cancelled";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          task_id?: string | null;
          duration_minutes?: number;
          completed_minutes?: number;
          status?: "active" | "paused" | "completed" | "cancelled";
          updated_at?: string;
        };
        Relationships: [];
      };
      productivity_analytics_history: {
        Row: {
          id: string;
          user_id: string;
          recorded_date: string;
          focus_time_minutes: number | null;
          tasks_completed_count: number | null;
          average_completion_minutes: number | null;
          completion_probability_average: number | null;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          recorded_date?: string;
          focus_time_minutes?: number | null;
          tasks_completed_count?: number | null;
          average_completion_minutes?: number | null;
          completion_probability_average?: number | null;
          details?: Json;
          created_at?: string;
        };
        Update: {
          recorded_date?: string;
          focus_time_minutes?: number | null;
          tasks_completed_count?: number | null;
          average_completion_minutes?: number | null;
          completion_probability_average?: number | null;
          details?: Json;
        };
        Relationships: [];
      };
      reminders: {
        Row: {
          id: string;
          user_id: string;
          task_id: string | null;
          title: string;
          reminder_time: string;
          reminder_type: "specific_time" | "relative_time" | "recurring" | "deadline" | "smart";
          recurrence_pattern: string | null;
          status: "pending" | "scheduled" | "triggered" | "completed" | "expired" | "cancelled" | "archived";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id?: string | null;
          title: string;
          reminder_time: string;
          reminder_type?: "specific_time" | "relative_time" | "recurring" | "deadline" | "smart";
          recurrence_pattern?: string | null;
          status?: "pending" | "scheduled" | "triggered" | "completed" | "expired" | "cancelled" | "archived";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          task_id?: string | null;
          title?: string;
          reminder_time?: string;
          reminder_type?: "specific_time" | "relative_time" | "recurring" | "deadline" | "smart";
          recurrence_pattern?: string | null;
          status?: "pending" | "scheduled" | "triggered" | "completed" | "expired" | "cancelled" | "archived";
          updated_at?: string;
        };
        Relationships: [];
      };
      rescue_plans: {
        Row: {
          id: string;
          user_id: string;
          is_active: boolean;
          emergency_task_id: string | null;
          hours_remaining: number | null;
          completion_probability: number | null;
          recovery_probability: number | null;
          current_risk: string | null;
          estimated_finish_time: string | null;
          emergency_action_plan: Json;
          remaining_focus_sessions: number | null;
          activated_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          is_active?: boolean;
          emergency_task_id?: string | null;
          hours_remaining?: number | null;
          completion_probability?: number | null;
          recovery_probability?: number | null;
          current_risk?: string | null;
          estimated_finish_time?: string | null;
          emergency_action_plan?: Json;
          remaining_focus_sessions?: number | null;
          activated_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          is_active?: boolean;
          emergency_task_id?: string | null;
          hours_remaining?: number | null;
          completion_probability?: number | null;
          recovery_probability?: number | null;
          current_risk?: string | null;
          estimated_finish_time?: string | null;
          emergency_action_plan?: Json;
          remaining_focus_sessions?: number | null;
          activated_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      daily_debriefs: {
        Row: {
          id: string;
          user_id: string;
          debrief_date: string;
          summary: string;
          metrics: Json;
          completed_tasks: Json;
          delayed_tasks: Json;
          improvements: Json;
          tomorrow_priorities: Json;
          tomorrow_probability: number | null;
          best_achievement: string | null;
          missed_opportunities: Json;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          debrief_date?: string;
          summary: string;
          metrics?: Json;
          completed_tasks?: Json;
          delayed_tasks?: Json;
          improvements?: Json;
          tomorrow_priorities?: Json;
          tomorrow_probability?: number | null;
          best_achievement?: string | null;
          missed_opportunities?: Json;
          created_at?: string | null;
        };
        Update: {
          debrief_date?: string;
          summary?: string;
          metrics?: Json;
          completed_tasks?: Json;
          delayed_tasks?: Json;
          improvements?: Json;
          tomorrow_priorities?: Json;
          tomorrow_probability?: number | null;
          best_achievement?: string | null;
          missed_opportunities?: Json;
        };
        Relationships: [];
      };
      weekly_reflections: {
        Row: {
          id: string;
          user_id: string;
          start_date: string;
          end_date: string;
          reflection_text: string;
          metrics: Json;
          weekly_wins: Json;
          focus_trends: Json;
          burnout_trend: Json;
          coaching_advice: string | null;
          suggested_changes: Json;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          start_date: string;
          end_date: string;
          reflection_text: string;
          metrics?: Json;
          weekly_wins?: Json;
          focus_trends?: Json;
          burnout_trend?: Json;
          coaching_advice?: string | null;
          suggested_changes?: Json;
          created_at?: string | null;
        };
        Update: {
          start_date?: string;
          end_date?: string;
          reflection_text?: string;
          metrics?: Json;
          weekly_wins?: Json;
          focus_trends?: Json;
          burnout_trend?: Json;
          coaching_advice?: string | null;
          suggested_changes?: Json;
        };
        Relationships: [];
      };
      telegram_accounts: {
        Row: {
          id: string;
          user_id: string | null;
          telegram_user_id: number | null;
          chat_id: number | null;
          linking_code: string | null;
          linking_code_expires_at: string | null;
          linked_at: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          telegram_user_id?: number | null;
          chat_id?: number | null;
          linking_code?: string | null;
          linking_code_expires_at?: string | null;
          linked_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string | null;
          telegram_user_id?: number | null;
          chat_id?: number | null;
          linking_code?: string | null;
          linking_code_expires_at?: string | null;
          linked_at?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          id: string;
          user_id: string | null;
          telegram_enabled: boolean;
          daily_debrief_enabled: boolean;
          weekly_reflection_enabled: boolean;
          reminders_enabled: boolean;
          emergency_alerts_enabled: boolean;
          focus_session_alerts_enabled: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          telegram_enabled?: boolean;
          daily_debrief_enabled?: boolean;
          weekly_reflection_enabled?: boolean;
          reminders_enabled?: boolean;
          emergency_alerts_enabled?: boolean;
          focus_session_alerts_enabled?: boolean;
          updated_at?: string;
        };
        Update: {
          telegram_enabled?: boolean;
          daily_debrief_enabled?: boolean;
          weekly_reflection_enabled?: boolean;
          reminders_enabled?: boolean;
          emergency_alerts_enabled?: boolean;
          focus_session_alerts_enabled?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      telegram_notifications: {
        Row: {
          id: string;
          user_id: string;
          telegram_account_id: string | null;
          notification_type: string;
          title: string;
          body: string;
          sent_at: string;
          status: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          telegram_account_id?: string | null;
          notification_type: string;
          title: string;
          body: string;
          sent_at?: string;
          status?: string;
        };
        Update: {
          telegram_account_id?: string | null;
          notification_type?: string;
          title?: string;
          body?: string;
          status?: string;
        };
        Relationships: [];
      };
      execution_plans: {
        Row: {
          id: string;
          user_id: string;
          plan_type: "daily" | "weekly";
          plan_data: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_type: "daily" | "weekly";
          plan_data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          plan_type?: "daily" | "weekly";
          plan_data?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      habits: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          frequency: "daily" | "weekly" | "weekdays" | "weekends";
          streak: number;
          last_completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          frequency?: "daily" | "weekly" | "weekdays" | "weekends";
          streak?: number;
          last_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          frequency?: "daily" | "weekly" | "weekdays" | "weekends";
          streak?: number;
          last_completed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      productivity_scores: {
        Row: {
          id: string;
          user_id: string;
          score: number;
          calculated_date: string;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          score: number;
          calculated_date?: string;
          details?: Json;
          created_at?: string;
        };
        Update: {
          score?: number;
          calculated_date?: string;
          details?: Json;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
