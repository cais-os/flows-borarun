"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  Crown,
  Headset,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { ConversationTagsManager } from "./conversation-tags-manager";

const supabase = createClient();
import type { DbConversation, DbMessage } from "@/hooks/use-conversations";

type Shortcut = {
  id: string;
  trigger: string;
  content: string;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
});
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatDateSeparatorLabel(createdAt: string) {
  const messageDate = new Date(createdAt);
  const today = new Date();
  const diffInDays = Math.floor(
    (startOfDay(today).getTime() - startOfDay(messageDate).getTime()) / DAY_IN_MS
  );

  if (diffInDays === 0) {
    return "HOJE";
  }

  if (diffInDays === 1) {
    return "ONTEM";
  }

  if (diffInDays > 1 && diffInDays < 7) {
    return weekdayFormatter.format(messageDate).toUpperCase();
  }

  return dateFormatter.format(messageDate);
}

function DateSeparator({ createdAt }: { createdAt: string }) {
  return (
    <div className="my-3 flex justify-center">
      <span className="rounded-md bg-[#d9eaf4] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.02em] text-slate-600 shadow-sm">
        {formatDateSeparatorLabel(createdAt)}
      </span>
    </div>
  );
}

function MessageBubble({ message }: { message: DbMessage }) {
  const isContact = message.sender === "contact";
  const isSystem = message.sender === "system";
  const metadata =
    message.metadata && typeof message.metadata === "object"
      ? (message.metadata as Record<string, unknown>)
      : null;
  const interactiveKind =
    typeof metadata?.whatsapp_interactive_kind === "string"
      ? metadata.whatsapp_interactive_kind
      : typeof metadata?.whatsapp_message_type === "string"
        ? metadata.whatsapp_message_type
        : null;
  const interactiveButtonText =
    typeof metadata?.whatsapp_button_text === "string"
      ? metadata.whatsapp_button_text
      : null;
  const interactiveLabel =
    interactiveKind === "flow"
      ? "Formulario do WhatsApp"
      : interactiveKind === "list"
        ? "Lista interativa"
        : interactiveKind === "buttons"
          ? "Botoes interativos"
          : interactiveKind === "cta_url"
            ? "Botao com link"
            : interactiveKind === "interactive"
              ? "Mensagem interativa"
              : null;

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-[11px] text-gray-500 bg-white/80 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex mb-2 ${isContact ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[70%] px-3 py-2 rounded-lg text-sm ${
          isContact ? "bg-white text-gray-800" : "bg-[#dcf8c6] text-gray-800"
        }`}
      >
        {!isContact && (
          <p className="text-[10px] font-medium text-green-700 mb-0.5">
            {message.sender === "human" ? "Operador" : "Bot"}
          </p>
        )}
        {!isContact && interactiveLabel && (
          <p className="mb-1 text-[10px] font-medium text-slate-500">
            {interactiveLabel}
            {interactiveButtonText ? ` • ${interactiveButtonText}` : ""}
          </p>
        )}
        {message.type === "video" && message.media_url && (
          <video controls className="mb-2 max-h-64 w-full rounded" src={message.media_url} />
        )}
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p className="text-[10px] text-gray-400 text-right mt-1">
          {new Date(message.created_at).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

export function InboxChatPanel({
  conversation,
  onConversationUpdated,
  tagsVersion,
}: {
  conversation: DbConversation;
  onConversationUpdated: () => Promise<void>;
  tagsVersion: number;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [filteredShortcuts, setFilteredShortcuts] = useState<Shortcut[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const shortcutsRef = useRef<Shortcut[]>([]);

  const isHuman = conversation.status === "human";

  // Load shortcuts once
  useEffect(() => {
    let cancelled = false;
    fetch("/api/shortcuts")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch shortcuts");
        return res.json();
      })
      .then((data: Shortcut[]) => {
        if (!cancelled) {
          shortcutsRef.current = data;
        }
      })
      .catch((err) => console.error("Shortcuts fetch error:", err));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.messages.length]);

  const handleTextChange = (value: string) => {
    setText(value);

    if (value.startsWith("/")) {
      const query = value.slice(1).toLowerCase();
      const matches = shortcutsRef.current.filter((s) =>
        s.trigger.toLowerCase().includes(query)
      );
      setFilteredShortcuts(matches);
      setShowShortcuts(matches.length > 0);
      setSelectedIndex(0);
    } else {
      setShowShortcuts(false);
    }
  };

  const selectShortcut = (shortcut: Shortcut) => {
    setText(shortcut.content);
    setShowShortcuts(false);
  };

  const handleTakeOver = async () => {
    await supabase
      .from("conversations")
      .update({ status: "human", updated_at: new Date().toISOString() })
      .eq("id", conversation.id);

    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      content: "Operador assumiu a conversa",
      type: "system",
      sender: "system",
    });
  };

  const handleClearConversation = async () => {
    if (!confirm("Limpar todas as mensagens desta conversa?")) return;

    await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", conversation.id);

    await supabase
      .from("conversations")
      .delete()
      .eq("id", conversation.id);
  };

  const handleReturnToBot = async () => {
    await supabase
      .from("conversations")
      .update({ status: "ai", ai_enabled: true, updated_at: new Date().toISOString() })
      .eq("id", conversation.id);

    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      content: "IA Coach retomou a conversa",
      type: "system",
      sender: "system",
    });
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setText("");
    setShowShortcuts(false);

    try {
      const res = await fetch("/api/meta/send-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversation.id,
          text: trimmed,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("Failed to send reply:", err);
      }
    } catch (error) {
      console.error("Failed to send reply:", error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showShortcuts) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredShortcuts.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredShortcuts.length - 1
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filteredShortcuts[selectedIndex]) {
          selectShortcut(filteredShortcuts[selectedIndex]);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowShortcuts(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const statusLabels: Record<string, string> = {
    running: "Bot",
    paused: "Aguardando",
    completed: "Finalizado",
    human: "Humano",
    ai: "IA Coach",
  };

  return (
    <div className="flex-1 flex flex-col bg-[#e5ddd5]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#075e54] text-white">
        <div>
          <p className="text-sm font-medium">{conversation.contact_name}</p>
          <p className="text-[10px] opacity-80">{conversation.contact_phone}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={
              isHuman
                ? "bg-blue-500 text-white text-[10px]"
                : conversation.status === "ai"
                  ? "bg-emerald-500 text-white text-[10px]"
                  : "bg-white/20 text-white text-[10px]"
            }
          >
            {statusLabels[conversation.status] || conversation.status}
          </Badge>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-xs text-white hover:bg-white/10"
              >
                <Crown size={12} />
                {conversation.subscription_status === "active"
                  ? "Ativo"
                  : conversation.subscription_status === "trial"
                    ? "Trial"
                    : "Sem plano"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  fetch(`/api/conversations/${conversation.id}/subscription`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "active", plan: "premium", durationDays: 30 }),
                  }).then(() => onConversationUpdated?.());
                }}
              >
                Ativar Premium (30 dias)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  fetch(`/api/conversations/${conversation.id}/subscription`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "trial", durationDays: 1 }),
                  }).then(() => onConversationUpdated?.());
                }}
              >
                Ativar Trial (24h)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  fetch(`/api/conversations/${conversation.id}/subscription`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "none" }),
                  }).then(() => onConversationUpdated?.());
                }}
              >
                Desativar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs text-white hover:bg-white/10"
            onClick={() => void handleClearConversation()}
          >
            <Trash2 size={12} />
            Limpar
          </Button>

          {isHuman ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs text-white hover:bg-white/10"
              onClick={() => void handleReturnToBot()}
            >
              <RotateCcw size={12} />
              Devolver ao bot
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs text-white hover:bg-white/10"
              onClick={() => void handleTakeOver()}
            >
              <Headset size={12} />
              Assumir
            </Button>
          )}
        </div>
      </div>

      <ConversationTagsManager
        conversation={conversation}
        onUpdated={onConversationUpdated}
        refreshKey={tagsVersion}
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {conversation.messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            Nenhuma mensagem ainda
          </div>
        ) : (
          conversation.messages.map((message, index) => {
            const previousMessage = conversation.messages[index - 1];
            const showDateSeparator =
              !previousMessage ||
              !isSameDay(
                new Date(previousMessage.created_at),
                new Date(message.created_at)
              );

            return (
              <Fragment key={message.id}>
                {showDateSeparator && (
                  <DateSeparator createdAt={message.created_at} />
                )}
                <MessageBubble message={message} />
              </Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="relative px-3 py-2 bg-[#f0f0f0] border-t border-gray-200">
        {/* Shortcuts dropdown */}
        {showShortcuts && (
          <div className="absolute bottom-full left-3 right-3 mb-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {filteredShortcuts.map((shortcut, index) => (
              <button
                key={shortcut.id}
                type="button"
                onClick={() => selectShortcut(shortcut)}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  index === selectedIndex ? "bg-gray-100" : "hover:bg-gray-50"
                }`}
              >
                <span className="shrink-0 font-medium text-gray-700">
                  /{shortcut.trigger}
                </span>
                <span className="truncate text-gray-400">
                  {shortcut.content}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isHuman}
            placeholder={
              isHuman
                ? 'Digite "/" para atalhos ou uma mensagem...'
                : "Clique em 'Assumir' para responder"
            }
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#075e54] disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <Button
            size="sm"
            disabled={!isHuman || !text.trim() || sending}
            onClick={() => void handleSend()}
            className="h-9 w-9 shrink-0 rounded-full bg-[#075e54] hover:bg-[#064e46] p-0"
          >
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
