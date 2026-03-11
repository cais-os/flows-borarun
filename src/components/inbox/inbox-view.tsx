"use client";

import { useState } from "react";
import { BookOpen, Loader2, MessageCircle, Tags, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConversations } from "@/hooks/use-conversations";
import { InboxConversationList } from "./inbox-conversation-list";
import { InboxChatPanel } from "./inbox-chat-panel";
import { ShortcutsManager } from "./shortcuts-manager";
import { GuidelinesManager } from "./guidelines-manager";
import { TagsManager } from "./tags-manager";

export function InboxView() {
  const {
    conversations,
    selectedId,
    setSelectedId,
    selectedConversation,
    loading,
    refetch,
  } = useConversations();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [tagsVersion, setTagsVersion] = useState(0);

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
        <div className="px-4 py-3 border-b space-y-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Conversas WhatsApp</h2>
            <p className="text-xs text-gray-400">{conversations.length} conversa(s)</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs text-gray-500"
              onClick={() => setShowShortcuts(true)}
            >
              <Zap size={14} />
              Atalhos
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs text-gray-500"
              onClick={() => setShowTags(true)}
            >
              <Tags size={14} />
              Tags
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs text-gray-500"
              onClick={() => setShowGuidelines(true)}
            >
              <BookOpen size={14} />
              Guia
            </Button>
          </div>
        </div>
        <InboxConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {selectedConversation ? (
        <InboxChatPanel
          conversation={selectedConversation}
          onConversationUpdated={refetch}
          tagsVersion={tagsVersion}
        />
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

      {showShortcuts && (
        <ShortcutsManager onClose={() => setShowShortcuts(false)} />
      )}

      {showTags && (
        <TagsManager
          onClose={() => setShowTags(false)}
          onTagsChanged={() => {
            void refetch();
            setTagsVersion((current) => current + 1);
          }}
        />
      )}

      {showGuidelines && (
        <GuidelinesManager onClose={() => setShowGuidelines(false)} />
      )}
    </div>
  );
}
