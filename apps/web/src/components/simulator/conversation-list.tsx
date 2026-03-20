"use client";

import { Badge } from "@/components/ui/badge";
import { useSimulatorStore } from "@/hooks/use-simulator-store";
import type { Conversation } from "@/types/simulator";

function ConversationItem({ conversation }: { conversation: Conversation }) {
  const selectedId = useSimulatorStore((s) => s.selectedConversationId);
  const setSelected = useSimulatorStore((s) => s.setSelectedConversationId);
  const isSelected = selectedId === conversation.id;
  const lastMessage = conversation.messages[conversation.messages.length - 1];

  const statusColors = {
    running: "bg-green-500",
    paused: "bg-yellow-500",
    completed: "bg-gray-400",
    human: "bg-blue-500",
  };

  return (
    <button
      onClick={() => setSelected(conversation.id)}
      className={`w-full text-left px-3 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
        isSelected ? "bg-gray-100" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white text-xs font-bold">
            {conversation.contactName.charAt(0)}
          </div>
          <span className="text-sm font-medium text-gray-800">
            {conversation.contactName}
          </span>
        </div>
        <div
          className={`w-2 h-2 rounded-full ${statusColors[conversation.status]}`}
        />
      </div>
      {lastMessage && lastMessage.type !== "system" && (
        <p className="text-xs text-gray-500 truncate ml-10">
          {lastMessage.content}
        </p>
      )}
      <div className="flex items-center justify-between ml-10 mt-1">
        <Badge
          variant="outline"
          className="text-[9px] px-1.5 py-0"
        >
          {conversation.status === "human"
            ? "Humano"
            : conversation.status === "completed"
              ? "Finalizado"
              : conversation.status === "paused"
                ? "Aguardando"
                : "Bot"}
        </Badge>
        {lastMessage && (
          <span className="text-[10px] text-gray-400">
            {new Date(lastMessage.timestamp).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
    </button>
  );
}

export function ConversationList() {
  const conversations = useSimulatorStore((s) => s.conversations);

  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400 px-4 text-center">
        Nenhuma conversa carregada
      </div>
    );
  }

  return (
    <div className="overflow-y-auto">
      {conversations.map((conv) => (
        <ConversationItem key={conv.id} conversation={conv} />
      ))}
    </div>
  );
}
