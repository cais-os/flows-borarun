"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Tags, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DbConversationTag } from "@/hooks/use-conversations";
import {
  MAX_CONVERSATION_TAG_NAME_LENGTH,
  normalizeConversationTagName,
} from "@/lib/conversation-tags";

interface TagsManagerProps {
  onClose: () => void;
  onTagsChanged: () => void;
}

function sortTags(tags: DbConversationTag[]) {
  return [...tags].sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

export function TagsManager({ onClose, onTagsChanged }: TagsManagerProps) {
  const [tags, setTags] = useState<DbConversationTag[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    try {
      const response = await fetch("/api/conversation-tags", {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          payload && typeof payload.error === "string"
            ? payload.error
            : "Nao foi possivel carregar as tags."
        );
        return;
      }

      setTags(sortTags(Array.isArray(payload) ? payload : []));
      setError(null);
    } catch {
      setError("Nao foi possivel carregar as tags.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTags();
  }, [fetchTags]);

  const handleCreate = async () => {
    const normalizedName = normalizeConversationTagName(name);
    if (!normalizedName || saving) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/conversation-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalizedName }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.id || !payload?.name) {
        setError(
          payload && typeof payload.error === "string"
            ? payload.error
            : "Nao foi possivel criar a tag."
        );
        return;
      }

      setTags((current) => {
        const next = current.filter((tag) => tag.id !== payload.id);
        next.push({
          id: payload.id as string,
          name: payload.name as string,
        });
        return sortTags(next);
      });
      setName("");
      onTagsChanged();
    } catch {
      setError("Nao foi possivel criar a tag.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tag: DbConversationTag) => {
    if (deletingId || !confirm(`Excluir a tag "${tag.name}"?`)) return;

    setDeletingId(tag.id);
    setError(null);

    try {
      const response = await fetch(`/api/conversation-tags/${tag.id}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          payload && typeof payload.error === "string"
            ? payload.error
            : "Nao foi possivel excluir a tag."
        );
        return;
      }

      setTags((current) => current.filter((currentTag) => currentTag.id !== tag.id));
      onTagsChanged();
    } catch {
      setError("Nao foi possivel excluir a tag.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Tags</h2>
            <p className="text-xs text-gray-400">
              Crie as tags que ficam disponiveis para marcar clientes.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreate();
            }}
          >
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nova tag"
              maxLength={MAX_CONVERSATION_TAG_NAME_LENGTH}
              className="h-9"
            />
            <Button
              type="submit"
              size="sm"
              className="h-9 gap-1"
              disabled={!normalizeConversationTagName(name) || saving}
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              Criar
            </Button>
          </form>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex-1 overflow-y-auto border-t px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : tags.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-gray-400">
              <Tags size={20} className="text-gray-300" />
              Nenhuma tag criada ainda
            </div>
          ) : (
            <div className="space-y-2">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <span className="text-sm font-medium text-slate-700">{tag.name}</span>
                  <button
                    type="button"
                    onClick={() => void handleDelete(tag)}
                    disabled={deletingId === tag.id || saving}
                    className="rounded p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                    aria-label={`Excluir tag ${tag.name}`}
                  >
                    {deletingId === tag.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
