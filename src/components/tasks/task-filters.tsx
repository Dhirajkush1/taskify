"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type { TaskPriority, TaskStatus } from "@/types/app.types";

interface TaskFiltersProps {
  onFiltersChange: (filters: {
    status?: string;
    priority?: string;
    search?: string;
  }) => void;
}

export function TaskFilters({ onFiltersChange }: TaskFiltersProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [priority, setPriority] = useState<string>("");

  const update = (newFilters: { status?: string; priority?: string; search?: string }) => {
    onFiltersChange({
      status: (newFilters.status ?? status) || undefined,
      priority: (newFilters.priority ?? priority) || undefined,
      search: (newFilters.search ?? search) || undefined,
    });
  };

  const clearAll = () => {
    setSearch("");
    setStatus("");
    setPriority("");
    onFiltersChange({});
  };

  const hasFilters = search || status || priority;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl flex-1 min-w-[200px]"
        style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
      >
        <Search className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
        <input
          id="task-search"
          type="text"
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            update({ search: e.target.value });
          }}
          className="flex-1 text-sm bg-transparent outline-none"
          style={{ color: "var(--text-primary)" }}
        />
      </div>

      {/* Status filter */}
      <select
        id="task-filter-status"
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          update({ status: e.target.value });
        }}
        className="px-3 py-2.5 rounded-xl text-sm"
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
          color: status ? "var(--text-primary)" : "var(--text-muted)",
        }}
      >
        <option value="">All Statuses</option>
        <option value="todo">To Do</option>
        <option value="in_progress">In Progress</option>
        <option value="done">Done</option>
        <option value="archived">Archived</option>
      </select>

      {/* Priority filter */}
      <select
        id="task-filter-priority"
        value={priority}
        onChange={(e) => {
          setPriority(e.target.value);
          update({ priority: e.target.value });
        }}
        className="px-3 py-2.5 rounded-xl text-sm"
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
          color: priority ? "var(--text-primary)" : "var(--text-muted)",
        }}
      >
        <option value="">All Priorities</option>
        <option value="critical">🔴 Critical</option>
        <option value="high">🟠 High</option>
        <option value="medium">🟡 Medium</option>
        <option value="low">🟢 Low</option>
      </select>

      {/* Clear */}
      {hasFilters && (
        <button
          id="task-filter-clear"
          onClick={clearAll}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
          style={{
            background: "var(--danger)/15",
            color: "var(--danger)",
            border: "1px solid var(--danger)/25",
          }}
        >
          <X className="w-3.5 h-3.5" />
          Clear
        </button>
      )}
    </div>
  );
}
