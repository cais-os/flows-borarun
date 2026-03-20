"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DbConversation, DbConversationTag } from "@/hooks/use-conversations";

interface ConversationTagsManagerProps {
  conversation: DbConversation;
  onUpdated: () => Promise<void>;
  refreshKey: number;
}

function sortTags(tags: DbConversationTag[]) {
  return [...tags].sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

export function ConversationTagsManager({
  conversation,
  onUpdated,
  refreshKey,
}: ConversationTagsManagerProps) {
  const [availableTags, setAvailableTags] = useState<DbConversationTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [pendingTagId, setPendingTagId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingTags(true);

    (async () => {
      try {
        const response = await fetch("/api/conversation-tags", {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        if (!active) return;

        if (!response.ok) {
          setError(
            payload && typeof payload.error === "string"
              ? payload.error
              : "Nao foi possivel carregar as tags."
          );
          return;
        }

        setAvailableTags(sortTags(Array.isArray(payload) ? payload : []));
      } catch {
        if (!active) return;
        setError("Nao foi possivel carregar as tags.");
      } finally {
        if (active) {
          setLoadingTags(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const assignedTagIds = new Set(conversation.tags.map((tag) => tag.id));
  const suggestedTags = availableTags.filter((tag) => !assignedTagIds.has(tag.id));

  const assignTag = async (tagId: string) => {
    setPendingTagId(tagId);
    setError(null);

    try {
      const response = await fetch(`/api/conversations/${conversation.id}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(
          payload && typeof payload.error === "string"
            ? payload.error
            : "Nao foi possivel vincular a tag."
        );
        return;
      }

      await onUpdated();
    } catch {
      setError("Nao foi possivel vincular a tag.");
    } finally {
      setPendingTagId(null);
    }
  };

  const removeTag = async (tagId: string) => {
    setPendingTagId(tagId);
    setError(null);

    try {
      const response = await fetch(
        `/api/conversations/${conversation.id}/tags/${tagId}`,
        { method: "DELETE" }
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          payload && typeof payload.error === "string"
            ? payload.error
            : "Nao foi possivel remover a tag."
        );
        return;
      }

      await onUpdated();
    } catch {
      setError("Nao foi possivel remover a tag.");
    } finally {
      setPendingTagId(null);
    }
  };

  return (
    <div className="border-b border-gray-200 bg-white px-4 py-3">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Tags do cliente
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs text-[#075e54] hover:bg-[#075e54]/5 hover:text-[#075e54]"
                disabled={loadingTags || suggestedTags.length === 0 || pendingTagId !== null}
              >
                {loadingTags || pendingTagId ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Plus size={12} />
                )}
                +tag
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {suggestedTags.map((tag) => (
                <DropdownMenuItem
                  key={tag.id}
                  onSelect={() => void assignTag(tag.id)}
                >
                  {tag.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {conversation.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {conversation.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
              >
                {tag.name}
                <button
                  type="button"
                  onClick={() => void removeTag(tag.id)}
                  disabled={pendingTagId === tag.id}
                  className="rounded-full p-0.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50"
                  aria-label={`Remover tag ${tag.name}`}
                >
                  {pendingTagId === tag.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <X size={12} />
                  )}
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">Nenhuma tag neste cliente.</p>
        )}

        {!loadingTags && suggestedTags.length === 0 && (
          <p className="text-xs text-gray-400">
            {availableTags.length === 0
              ? "Crie tags no menu Tags."
              : "Todas as tags disponiveis ja estao neste cliente."}
          </p>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
