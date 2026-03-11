"use client";

import { Badge } from "@/components/ui/badge";
import type { DbConversation } from "@/hooks/use-conversations";

interface InboxConversationListProps {
  conversations: DbConversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function ConversationItem({
  conversation,
  isSelected,
  onSelect,
}: {
  conversation: DbConversation;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const lastMessage = conversation.messages[conversation.messages.length - 1];

  const statusColors = {
    running: "bg-green-500",
    paused: "bg-yellow-500",
    completed: "bg-gray-400",
    human: "bg-blue-500",
    ai: "bg-emerald-500",
  };

  const statusLabels = {
    running: "Bot",
    paused: "Aguardando",
    completed: "Finalizado",
    human: "Humano",
    ai: "IA Coach",
  };

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
        isSelected ? "bg-gray-100" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white text-xs font-bold">
            {conversation.contact_name.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-gray-800">
            {conversation.contact_name}
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
      {conversation.tags.length > 0 && (
        <div className="ml-10 mt-1 flex flex-wrap gap-1">
          {conversation.tags.slice(0, 2).map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="px-1.5 py-0 text-[9px] font-medium"
            >
              {tag.name}
            </Badge>
          ))}
          {conversation.tags.length > 2 && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[9px] font-medium">
              +{conversation.tags.length - 2}
            </Badge>
          )}
        </div>
      )}
      <div className="flex items-center justify-between ml-10 mt-1">
        <Badge variant="outline" className="text-[9px] px-1.5 py-0">
          {statusLabels[conversation.status]}
        </Badge>
        {lastMessage && (
          <span className="text-[10px] text-gray-400">
            {new Date(lastMessage.created_at).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
    </button>
  );
}

export function InboxConversationList({
  conversations,
  selectedId,
  onSelect,
}: InboxConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400 px-4 text-center">
        Nenhuma conversa recebida
      </div>
    );
  }

  return (
    <div className="overflow-y-auto flex-1">
      {conversations.map((conv) => (
        <ConversationItem
          key={conv.id}
          conversation={conv}
          isSelected={selectedId === conv.id}
          onSelect={() => onSelect(conv.id)}
        />
      ))}
    </div>
  );
}
