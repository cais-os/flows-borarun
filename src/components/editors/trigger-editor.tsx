"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFlowStore } from "@/hooks/use-flow-store";
import type { TriggerNodeData } from "@/types/node-data";

type ConversationTagOption = {
  id: string;
  name: string;
};

const EMPTY_TAG_VALUE = "__empty_tag__";

function sortTags(tags: ConversationTagOption[]) {
  return [...tags].sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

interface TriggerEditorProps {
  nodeId: string;
  data: TriggerNodeData;
}

export function TriggerEditor({ nodeId, data }: TriggerEditorProps) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const [tags, setTags] = useState<ConversationTagOption[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [refreshingTags, setRefreshingTags] = useState(false);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const audienceScope = data.audienceScope || "all";

  const update = (partial: Partial<TriggerNodeData>) => {
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
    if (data.triggerType !== "tag" || loadingTags || tags.length > 0) return;
    void fetchTags();
  }, [data.triggerType, fetchTags, loadingTags, tags.length]);

  const selectedTag = tags.find((tag) => tag.id === data.tagId);
  const isMissingSelectedTag = Boolean(data.tagId && data.tagName && !selectedTag);
  const selectedTagValue = data.tagId || EMPTY_TAG_VALUE;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nome do no</Label>
        <Input
          value={data.label}
          onChange={(e) => update({ label: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Tipo de trigger</Label>
        <Select
          value={data.triggerType}
          onValueChange={(value) =>
            update({
              triggerType: value as TriggerNodeData["triggerType"],
              keyword: undefined,
              keywordMatch: undefined,
              tagId: undefined,
              tagName: undefined,
              subscriptionPlan: undefined,
              audienceScope: undefined,
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="keyword">Palavra-chave</SelectItem>
            <SelectItem value="newContact">Novo contato</SelectItem>
            <SelectItem value="tag">Cliente com tag</SelectItem>
            <SelectItem value="subscriptionPlan">Subscription</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data.triggerType === "keyword" && (
        <>
          <div className="space-y-2">
            <Label>Correspondencia</Label>
            <Select
              value={data.keywordMatch || "contains"}
              onValueChange={(value) =>
                update({
                  keywordMatch: value as TriggerNodeData["keywordMatch"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contem</SelectItem>
                <SelectItem value="notContains">Nao contem</SelectItem>
                <SelectItem value="exact">Exatamente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Palavra-chave</Label>
            <Input
              value={data.keyword || ""}
              onChange={(e) => update({ keyword: e.target.value })}
              placeholder="Ex: oi, promo, oferta..."
            />
          </div>
        </>
      )}

      {data.triggerType === "tag" && (
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
            value={selectedTagValue}
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
              Nenhuma tag criada ainda. Crie tags no inbox para usar este trigger.
            </p>
          )}
          {isMissingSelectedTag && (
            <p className="text-xs text-amber-600">
              A tag salva neste trigger nao existe mais. Selecione outra para atualizar.
            </p>
          )}

          <div className="space-y-2">
            <Label>Quando aplicar</Label>
            <Select
              value={audienceScope}
              onValueChange={(value) =>
                update({
                  audienceScope: value as TriggerNodeData["audienceScope"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos com essa tag</SelectItem>
                <SelectItem value="newOnly">Somente clientes novos com essa tag</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {data.triggerType === "subscriptionPlan" && (
        <div className="space-y-2">
          <Label>Plano de subscription</Label>
          <Select
            value={data.subscriptionPlan || "free"}
            onValueChange={(value) =>
              update({
                subscriptionPlan: value as TriggerNodeData["subscriptionPlan"],
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">
            Usa o plano configurado em Settings para decidir se este flow dispara.
          </p>

          <div className="space-y-2">
            <Label>Quando aplicar</Label>
            <Select
              value={audienceScope}
              onValueChange={(value) =>
                update({
                  audienceScope: value as TriggerNodeData["audienceScope"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos com esse plano</SelectItem>
                <SelectItem value="newOnly">Somente clientes novos desse plano</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
