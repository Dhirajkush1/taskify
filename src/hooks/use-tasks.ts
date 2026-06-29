"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchTasks,
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  archiveTask,
} from "@/lib/api/tasks";
import type { TaskInsert, TaskUpdate, TaskStatus, TaskPriority } from "@/types/app.types";
import { toast } from "sonner";
import { useSupabase } from "@/providers/supabase-provider";

export const TASKS_QUERY_KEY = ["tasks"] as const;

export function useTasks(filters?: {
  status?: TaskStatus;
  priority?: TaskPriority;
  search?: string;
}) {
  const { user } = useSupabase();

  return useQuery({
    queryKey: [...TASKS_QUERY_KEY, filters],
    queryFn: () => fetchTasks(user!.id, filters),
    enabled: !!user,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { user } = useSupabase();

  return useMutation({
    mutationFn: (task: Omit<TaskInsert, "user_id">) =>
      createTask({ ...task, user_id: user!.id }),
    onMutate: async (newTask) => {
      await queryClient.cancelQueries({ queryKey: TASKS_QUERY_KEY });
      const queries = queryClient.getQueriesData({ queryKey: TASKS_QUERY_KEY });

      queries.forEach(([queryKey]) => {
        queryClient.setQueryData(queryKey, (old: any) => [
          ...(old || []),
          { ...newTask, id: "optimistic-" + Date.now(), user_id: user!.id },
        ]);
      });

      return { queries };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.queries) {
        ctx.queries.forEach(([queryKey, oldData]) => {
          queryClient.setQueryData(queryKey, oldData);
        });
      }
      toast.error("Failed to create task");
    },
    onSuccess: () => {
      toast.success("Task created!");
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: TaskUpdate }) =>
      updateTask(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: TASKS_QUERY_KEY });
      const queries = queryClient.getQueriesData({ queryKey: TASKS_QUERY_KEY });

      queries.forEach(([queryKey]) => {
        queryClient.setQueryData(queryKey, (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((t) => (t.id === id ? { ...t, ...updates } : t));
        });
      });

      return { queries };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.queries) {
        ctx.queries.forEach(([queryKey, oldData]) => {
          queryClient.setQueryData(queryKey, oldData);
        });
      }
      toast.error("Failed to update task");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: TASKS_QUERY_KEY });
      const queries = queryClient.getQueriesData({ queryKey: TASKS_QUERY_KEY });

      queries.forEach(([queryKey]) => {
        queryClient.setQueryData(queryKey, (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.filter((t) => t.id !== id);
        });
      });

      return { queries };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.queries) {
        ctx.queries.forEach(([queryKey, oldData]) => {
          queryClient.setQueryData(queryKey, oldData);
        });
      }
      toast.error("Failed to delete task");
    },
    onSuccess: () => {
      toast.success("Task deleted");
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => completeTask(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: TASKS_QUERY_KEY });
      const queries = queryClient.getQueriesData({ queryKey: TASKS_QUERY_KEY });

      queries.forEach(([queryKey]) => {
        queryClient.setQueryData(queryKey, (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((t) => t.id === id ? { ...t, status: "done", completion_percentage: 100 } : t);
        });
      });

      return { queries };
    },
    onSuccess: () => {
      toast.success("🎉 Mission complete!");
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.queries) {
        ctx.queries.forEach(([queryKey, oldData]) => {
          queryClient.setQueryData(queryKey, oldData);
        });
      }
      toast.error("Failed to complete task");
    },
  });
}

export function useArchiveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => archiveTask(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: TASKS_QUERY_KEY });
      const queries = queryClient.getQueriesData({ queryKey: TASKS_QUERY_KEY });

      queries.forEach(([queryKey]) => {
        queryClient.setQueryData(queryKey, (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((t) => t.id === id ? { ...t, status: "archived" } : t);
        });
      });

      return { queries };
    },
    onSuccess: () => {
      toast.success("Task archived");
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.queries) {
        ctx.queries.forEach(([queryKey, oldData]) => {
          queryClient.setQueryData(queryKey, oldData);
        });
      }
      toast.error("Failed to archive task");
    },
  });
}
