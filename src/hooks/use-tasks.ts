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
import type { TaskInsert, TaskUpdate } from "@/types/app.types";
import { toast } from "sonner";
import { useSupabase } from "@/providers/supabase-provider";

export const TASKS_QUERY_KEY = ["tasks"] as const;

export function useTasks(filters?: {
  status?: string;
  priority?: string;
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
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: TASKS_QUERY_KEY });
      const prev = queryClient.getQueryData(TASKS_QUERY_KEY);

      queryClient.setQueryData(TASKS_QUERY_KEY, (old: unknown[]) => [
        ...(old || []),
        { ...newTask, id: "optimistic-" + Date.now(), user_id: user!.id },
      ]);

      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(TASKS_QUERY_KEY, ctx?.prev);
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
    onError: () => {
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
      const prev = queryClient.getQueryData(TASKS_QUERY_KEY);
      queryClient.setQueryData(TASKS_QUERY_KEY, (old: Array<{ id: string }>) =>
        (old || []).filter((t) => t.id !== id)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(TASKS_QUERY_KEY, ctx?.prev);
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
    onSuccess: () => {
      toast.success("🎉 Mission complete!");
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
    onError: () => {
      toast.error("Failed to complete task");
    },
  });
}

export function useArchiveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => archiveTask(id),
    onSuccess: () => {
      toast.success("Task archived");
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
    onError: () => {
      toast.error("Failed to archive task");
    },
  });
}
