import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, format, isPast, isToday, isTomorrow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a deadline date into a human-readable relative string.
 */
export function formatDeadline(deadline: string | null): string {
  if (!deadline) return "No deadline";
  const date = new Date(deadline);

  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  if (isPast(date)) return `Overdue · ${format(date, "MMM d")}`;

  return formatDistanceToNow(date, { addSuffix: true });
}

/**
 * Format a date to a readable short form.
 */
export function formatDate(date: string | null): string {
  if (!date) return "—";
  return format(new Date(date), "MMM d, yyyy");
}

/**
 * Format minutes to a human readable duration.
 */
export function formatDuration(minutes: number | null): string {
  if (!minutes) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Check if a deadline is overdue.
 */
export function isOverdue(deadline: string | null): boolean {
  if (!deadline) return false;
  return isPast(new Date(deadline)) && !isToday(new Date(deadline));
}

/**
 * Get initials from a full name.
 */
export function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Truncate text to a max length.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

/**
 * Sleep for a given number of milliseconds (for simulated streaming).
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random ID (for optimistic updates).
 */
export function generateId(): string {
  return crypto.randomUUID();
}
