"use client";

import { useMemo, useState } from "react";
import { BookOpen, Loader2, MessageCircle, Search, Tags, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConversations } from "@/hooks/use-conversations";
import { InboxConversationList } from "./inbox-conversation-list";
import { InboxChatPanel } from "./inbox-chat-panel";
import { ShortcutsManager } from "./shortcuts-manager";
import { GuidelinesManager } from "./guidelines-manager";
import { TagsManager } from "./tags-manager";

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizePhoneSearch(value: string) {
  return value.replace(/\D/g, "");
}

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
  const [searchQuery, setSearchQuery] = useState("");

  const trimmedSearchQuery = searchQuery.trim();
  const filteredConversations = useMemo(() => {
    if (!trimmedSearchQuery) return conversations;

    const textQuery = normalizeSearchText(trimmedSearchQuery);
    const phoneQuery = normalizePhoneSearch(trimmedSearchQuery);

    return conversations.filter((conversation) => {
      const contactName = normalizeSearchText(conversation.contact_name || "");
      const contactPhone = normalizePhoneSearch(conversation.contact_phone || "");

      return (
        contactName.includes(textQuery) ||
        Boolean(phoneQuery && contactPhone.includes(phoneQuery))
      );
    });
  }, [conversations, trimmedSearchQuery]);

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
            <p className="text-xs text-gray-400">
              {trimmedSearchQuery
                ? `${filteredConversations.length} de ${conversations.length} conversa(s)`
                : `${conversations.length} conversa(s)`}
            </p>
          </div>
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar por nome ou numero"
              className="h-9 rounded-lg border-gray-200 bg-gray-50 pl-8 pr-8 text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
                aria-label="Limpar busca"
              >
                <X size={13} />
              </button>
            )}
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
          conversations={filteredConversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
          emptyMessage={
            trimmedSearchQuery
              ? "Nenhuma conversa encontrada para essa busca"
              : "Nenhuma conversa recebida"
          }
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
