"use client";

import { MessageCircle } from "lucide-react";
import { ConversationList } from "./conversation-list";
import { ChatPanel } from "./chat-panel";
import { SimulationControls } from "./simulation-controls";
import { useSimulatorStore } from "@/hooks/use-simulator-store";

export function SimulatorView() {
  const conversations = useSimulatorStore((s) => s.conversations);
  const selectedId = useSimulatorStore((s) => s.selectedConversationId);
  const selectedConversation = conversations.find((c) => c.id === selectedId);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left panel: controls + conversation list */}
      <div className="w-72 border-r bg-white flex flex-col">
        <SimulationControls />
        <ConversationList />
      </div>

      {/* Right panel: chat */}
      {selectedConversation ? (
        <ChatPanel conversation={selectedConversation} />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-[#e5ddd5]">
          <div className="text-center text-gray-500">
            <MessageCircle size={48} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm">Selecione uma conversa para acompanhar o flow</p>
          </div>
        </div>
      )}
    </div>
  );
}
