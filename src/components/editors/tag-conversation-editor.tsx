"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFlowStore } from "@/hooks/use-flow-store";
import type { TagConversationNodeData } from "@/types/node-data";

type ConversationTagOption = {
  id: string;
  name: string;
};

const EMPTY_TAG_VALUE = "__empty_tag__";

function sortTags(tags: ConversationTagOption[]) {
  return [...tags].sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

interface TagConversationEditorProps {
  nodeId: string;
  data: TagConversationNodeData;
}

export function TagConversationEditor({
  nodeId,
  data,
}: TagConversationEditorProps) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const [tags, setTags] = useState<ConversationTagOption[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [refreshingTags, setRefreshingTags] = useState(false);
  const [tagsError, setTagsError] = useState<string | null>(null);

  const update = (partial: Partial<TagConversationNodeData>) => {
    updateNodeData(nodeId, partial);
  };

  const fetchTags = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") {
      setLoadingTags(true);
    } else {
      setRefreshingTags(true);
    }

    try {
      const response = await fetch("/api/conversation-tags", {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setTagsError(
          payload && typeof payload.error === "string"
            ? payload.error
            : "Nao foi possivel carregar as tags."
        );
        return;
      }

      setTags(sortTags(Array.isArray(payload) ? payload : []));
      setTagsError(null);
    } catch {
      setTagsError("Nao foi possivel carregar as tags.");
    } finally {
      setLoadingTags(false);
      setRefreshingTags(false);
    }
  }, []);

  useEffect(() => {
    void fetchTags();
  }, [fetchTags]);

  const selectedTag = tags.find((tag) => tag.id === data.tagId);
  const isMissingSelectedTag = Boolean(data.tagId && data.tagName && !selectedTag);
  const selectedValue = data.tagId || EMPTY_TAG_VALUE;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nome do no</Label>
        <Input
          value={data.label}
          onChange={(event) => update({ label: event.target.value })}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Tag do cliente</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1 px-2 text-xs"
            onClick={() => void fetchTags("refresh")}
            disabled={loadingTags || refreshingTags}
          >
            {refreshingTags ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RotateCcw size={12} />
            )}
            Atualizar
          </Button>
        </div>

        <Select
          value={selectedValue}
          onValueChange={(value) => {
            if (value === EMPTY_TAG_VALUE) {
              update({ tagId: undefined, tagName: undefined });
              return;
            }

            const tag = tags.find((item) => item.id === value);
            update({
              tagId: value,
              tagName: tag?.name || data.tagName,
            });
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione uma tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY_TAG_VALUE}>Nenhuma tag</SelectItem>
            {isMissingSelectedTag && data.tagId && (
              <SelectItem value={data.tagId}>
                {`${data.tagName} (nao encontrada)`}
              </SelectItem>
            )}
            {tags.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                {tag.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {loadingTags && (
          <p className="text-xs text-gray-500">Carregando tags disponiveis...</p>
        )}
        {tagsError && <p className="text-xs text-destructive">{tagsError}</p>}
        {!loadingTags && !tagsError && tags.length === 0 && (
          <p className="text-xs text-gray-500">
            Nenhuma tag criada ainda. Crie tags no inbox para usar este no.
          </p>
        )}
        {isMissingSelectedTag && (
          <p className="text-xs text-amber-600">
            A tag salva neste no nao existe mais. Selecione outra para atualizar.
          </p>
        )}
      </div>

      <div className="space-y-2 rounded-lg border border-dashed border-sky-200 bg-sky-50 p-3">
        <p className="text-xs font-medium text-sky-800">O que esse no faz</p>
        <p className="text-xs text-sky-700">
          Quando o flow chega aqui, a tag escolhida e vinculada ao cliente atual
          sem interromper a execucao.
        </p>
      </div>
    </div>
  );
}
