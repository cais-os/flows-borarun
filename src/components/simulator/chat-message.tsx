"use client";

import { Bot, User, Headset } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WhatsAppReplyButton } from "@/types/node-data";
import type { ChatMessage as ChatMessageType } from "@/types/simulator";

interface ChatMessageProps {
  message: ChatMessageType;
  onReplyButtonClick?: (button: WhatsAppReplyButton) => void;
  replyButtonsDisabled?: boolean;
}

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatMessage({
  message,
  onReplyButtonClick,
  replyButtonsDisabled = true,
}: ChatMessageProps) {
  if (message.type === "system") {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  const isHuman = message.sender === "human";
  const isContact = message.sender === "contact";

  return (
    <div
      className={`flex gap-2 mb-3 ${isContact ? "justify-end" : "justify-start"}`}
    >
      {!isContact && (
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
            isHuman ? "bg-blue-100 text-blue-600" : "bg-gray-200 text-gray-600"
          }`}
        >
          {isHuman ? <Headset size={14} /> : <Bot size={14} />}
        </div>
      )}

      <div
        className={`max-w-[75%] rounded-lg px-3 py-2 ${
          isContact
            ? "bg-[#dcf8c6] text-gray-800"
            : isHuman
              ? "bg-blue-50 text-gray-800 border border-blue-100"
              : "bg-white text-gray-800 border border-gray-200"
        }`}
      >
        {isHuman && (
          <span className="text-[10px] font-medium text-blue-600 block mb-0.5">
            Operador
          </span>
        )}

        {message.templateName && (
          <span className="text-[10px] font-medium text-green-700 block mb-0.5">
            Template: {message.templateName}
          </span>
        )}

        {message.mediaUrl && message.type === "image" && (
          <img
            src={message.mediaUrl}
            alt="Imagem"
            className="rounded mb-1 max-h-40 object-cover"
          />
        )}

        {message.type === "audio" && message.mediaUrl && (
          <audio controls className="mb-1 max-w-full" src={message.mediaUrl} />
        )}

        {message.type === "file" && message.fileName && (
          <div className="flex items-center gap-1.5 mb-1 text-sm text-blue-600">
            📎 {message.fileName}
          </div>
        )}

        <p className="text-sm whitespace-pre-wrap">{message.content}</p>

        {message.replyButtons && message.replyButtons.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {message.interactiveType === "list" && (
              <div className="rounded-md border border-purple-200 bg-purple-50 px-2 py-1 text-[10px] font-medium text-purple-700">
                Lista interativa
              </div>
            )}
            {message.replyButtons.map((button) => (
              <Button
                key={button.id}
                type="button"
                size="sm"
                variant="outline"
                className="w-full justify-center border-[#8bb7f0] bg-[#ebf3ff] text-[#3977d8] hover:bg-[#dfeeff]"
                disabled={replyButtonsDisabled}
                onClick={() => onReplyButtonClick?.(button)}
              >
                {button.title}
              </Button>
            ))}
          </div>
        )}

        <span className="text-[10px] text-gray-400 block text-right mt-0.5">
          {formatTime(message.timestamp)}
        </span>
      </div>

      {isContact && (
        <div className="w-7 h-7 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
          <User size={14} />
        </div>
      )}
    </div>
  );
}
