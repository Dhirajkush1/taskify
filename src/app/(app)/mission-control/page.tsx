import type { Metadata } from "next";
import { ChatInterface } from "@/components/mission-control/chat-interface";

export const metadata: Metadata = { title: "Mission Control" };

export default function MissionControlPage() {
  return (
    <div className="h-full" style={{ background: "var(--background)" }}>
      <ChatInterface />
    </div>
  );
}
