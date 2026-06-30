import type { Metadata } from "next";
import { ChatInterface } from "@/components/taskify-buddy/chat-interface";

export const metadata: Metadata = { title: "Taskify Buddy" };

export default function TaskifyBuddyPage() {
  return (
    <div className="h-full" style={{ background: "var(--background)" }}>
      <ChatInterface />
    </div>
  );
}
