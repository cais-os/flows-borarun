"use client";

import { MessageCircle, Loader2 } from "lucide-react";
import { useConversations } from "@/hooks/use-conversations";
import { InboxConversationList } from "./inbox-conversation-list";
import { InboxChatPanel } from "./inbox-chat-panel";

export function InboxView() {
  const { conversations, selectedId, setSelectedId, selectedConversation, loading } =
    useConversations();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="w-72 border-r bg-white flex flex-col">
        <div className="px-4 py-3 border-b">
          <h2 className="text-sm font-semibold text-gray-700">Conversas WhatsApp</h2>
          <p className="text-xs text-gray-400">{conversations.length} conversa(s)</p>
        </div>
        <InboxConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {selectedConversation ? (
        <InboxChatPanel conversation={selectedConversation} />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-[#e5ddd5]">
          <div className="text-center text-gray-500">
            <MessageCircle size={48} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm">
              {conversations.length === 0
                ? "Nenhuma conversa recebida ainda"
                : "Selecione uma conversa"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
