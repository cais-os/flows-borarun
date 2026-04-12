"use client";

import NextImage from "next/image";
import { Bot, User, Headset, Paperclip } from "lucide-react";
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
      <div className="my-2 flex justify-center">
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
          {message.content}
        </span>
      </div>
    );
  }

  const isHuman = message.sender === "human";
  const isContact = message.sender === "contact";

  return (
    <div
      className={`mb-3 flex gap-2 ${isContact ? "justify-end" : "justify-start"}`}
    >
      {!isContact && (
        <div
          className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
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
              ? "border border-blue-100 bg-blue-50 text-gray-800"
              : "border border-gray-200 bg-white text-gray-800"
        }`}
      >
        {isHuman && (
          <span className="mb-0.5 block text-[10px] font-medium text-blue-600">
            Operador
          </span>
        )}

        {message.templateName && (
          <span className="mb-0.5 block text-[10px] font-medium text-green-700">
            Template: {message.templateName}
          </span>
        )}

        {message.mediaUrl && message.type === "image" && (
          <NextImage
            src={message.mediaUrl}
            alt={
              message.fileName
                ? `Imagem enviada: ${message.fileName}`
                : "Imagem enviada"
            }
            width={320}
            height={240}
            unoptimized
            className="mb-1 h-auto max-h-40 rounded object-cover"
          />
        )}

        {message.type === "audio" && message.mediaUrl && (
          <audio controls className="mb-1 max-w-full" src={message.mediaUrl} />
        )}

        {message.type === "video" && message.mediaUrl && (
          <video
            controls
            className="mb-1 max-w-full rounded"
            src={message.mediaUrl}
          />
        )}

        {message.type === "file" && message.fileName && (
          <div className="mb-1 flex items-center gap-1.5 text-sm text-blue-600">
            <Paperclip size={14} />
            {message.fileName}
          </div>
        )}

        <p className="whitespace-pre-wrap text-sm">{message.content}</p>

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

        <span className="mt-0.5 block text-right text-[10px] text-gray-400">
          {formatTime(message.timestamp)}
        </span>
      </div>

      {isContact && (
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
          <User size={14} />
        </div>
      )}
    </div>
  );
}
