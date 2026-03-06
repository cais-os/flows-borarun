"use client";

import { useEffect, useRef, useState } from "react";
import { Headset, RotateCcw, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import type { DbConversation, DbMessage } from "@/hooks/use-conversations";

function MessageBubble({ message }: { message: DbMessage }) {
  const isContact = message.sender === "contact";
  const isSystem = message.sender === "system";

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
}: {
  conversation: DbConversation;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const isHuman = conversation.status === "human";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.messages.length]);

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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {conversation.messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            Nenhuma mensagem ainda
          </div>
        ) : (
          conversation.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 bg-[#f0f0f0] border-t border-gray-200">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isHuman}
            placeholder={
              isHuman
                ? "Digite uma mensagem..."
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
