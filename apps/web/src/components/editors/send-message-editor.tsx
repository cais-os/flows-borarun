"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Loader2, Play, Plus, Trash2, Upload, Sparkles, Library } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { useFlowStore } from "@/hooks/use-flow-store";
import {
  createWhatsAppListItem,
  createWhatsAppReplyButton,
  getSendMessageInteractiveOptions,
  getSendMessageInteractiveType,
  hasWhatsAppListItems,
  hasWhatsAppReplyButtons,
  sanitizeWhatsAppListButtonText,
  sanitizeWhatsAppListItemDescription,
  sanitizeWhatsAppListItemTitle,
  sanitizeWhatsAppListSectionTitle,
  sanitizeWhatsAppReplyButtonTitle,
  WHATSAPP_LIST_BUTTON_TEXT_LIMIT,
  WHATSAPP_LIST_ITEM_DESCRIPTION_LIMIT,
  WHATSAPP_LIST_ITEM_LIMIT,
  WHATSAPP_LIST_ITEM_TITLE_LIMIT,
  WHATSAPP_LIST_SECTION_TITLE_LIMIT,
  WHATSAPP_REPLY_BUTTON_LIMIT,
  WHATSAPP_REPLY_BUTTON_TITLE_LIMIT,
} from "@/lib/whatsapp";
import type {
  AiCollectorNodeData,
  SendMessageNodeData,
  WhatsAppListItem,
  WaitForReplyNodeData,
  WhatsAppReplyButton,
} from "@/types/node-data";
import { MediaUploader } from "./media-uploader";

interface SendMessageEditorProps {
  nodeId: string;
  data: SendMessageNodeData;
}

interface MetaTemplate {
  id: string;
  name: string;
  language?: string;
  status?: string;
  category?: string;
  components?: Array<{
    type?: string;
    text?: string;
  }>;
}

const EMPTY_TEMPLATE_VALUE = "__none__";

function normalizeMetaTemplates(payload: unknown): MetaTemplate[] {
  if (!Array.isArray(payload)) return [];

  return payload
    .filter((item): item is MetaTemplate => {
      if (!item || typeof item !== "object") return false;

      const candidate = item as Record<string, unknown>;
      return typeof candidate.id === "string" && typeof candidate.name === "string";
    })
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

function extractTemplateVariables(template?: MetaTemplate | null): string[] {
  const bodyComponent = template?.components?.find(
    (component) => component.type === "BODY"
  );
  if (!bodyComponent?.text) return [];

  const matches = bodyComponent.text.match(/\{\{\d+\}\}/g);
  return matches ? Array.from(new Set(matches)) : [];
}

function getMetaTemplatesErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "Nao foi possivel carregar os templates da Meta.";
  }

  const error = (payload as { error?: unknown }).error;
  return typeof error === "string"
    ? error
    : "Nao foi possivel carregar os templates da Meta.";
}

export function SendMessageEditor({ nodeId, data }: SendMessageEditorProps) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const edges = useFlowStore((s) => s.edges);
  const nodes = useFlowStore((s) => s.nodes);
  const replyButtons = data.replyButtons || [];
  const listItems = data.listItems || [];
  const interactiveType = getSendMessageInteractiveType(data);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([]);
  const [metaTemplatesRequestState, setMetaTemplatesRequestState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [metaTemplatesError, setMetaTemplatesError] = useState<string | null>(null);

  useEffect(() => {
    if (data.messageType !== "template") return;
    if (
      metaTemplatesRequestState !== "idle" &&
      metaTemplatesRequestState !== "loading"
    ) {
      return;
    }

    let active = true;
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch("/api/meta/templates", {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        if (!active) return;

        if (!response.ok) {
          setMetaTemplatesError(getMetaTemplatesErrorMessage(payload));
          setMetaTemplatesRequestState("error");
          return;
        }

        setMetaTemplates(normalizeMetaTemplates(payload));
        setMetaTemplatesError(null);
        setMetaTemplatesRequestState("ready");
      } catch {
        if (!active || controller.signal.aborted) return;

        setMetaTemplatesError("Nao foi possivel carregar os templates da Meta.");
        setMetaTemplatesRequestState("error");
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [data.messageType, metaTemplatesRequestState]);

  const availableVariables: Array<{
    variableName: string;
    sourceLabel: string;
    description?: string;
  }> = Array.from(
    new Map(
      [
        ...nodes
          .filter((node) => node.data.type === "waitForReply")
          .map((node) => {
            const waitData = node.data as WaitForReplyNodeData;
            const variableName = waitData.variableName?.trim();
            if (!variableName) return null;

            return [
              variableName,
                    {
                      variableName,
                      sourceLabel: waitData.label || "Capturar Resposta",
                      description: waitData.variableDescription?.trim() || undefined,
                    },
                  ] as const;
          })
          .filter(Boolean) as Array<
          readonly [string, {
            variableName: string;
            sourceLabel: string;
            description?: string;
          }]
        >,
        ...nodes
          .filter((node) => node.data.type === "aiCollector")
          .flatMap((node) => {
            const collectorData = node.data as AiCollectorNodeData;
            return (collectorData.fields || [])
              .filter((f) => f.name?.trim())
              .map(
                (f) =>
                  [
                    f.name.trim(),
                    {
                      variableName: f.name.trim(),
                      sourceLabel: collectorData.label || "Coletor IA",
                      description: f.description?.trim() || undefined,
                    },
                  ] as const
              );
          }),
      ]
    ).values()
  );

  const update = (partial: Partial<SendMessageNodeData>) => {
    updateNodeData(nodeId, partial);
  };

  const removeEdgesBySourceHandles = (sourceHandleIds: string[]) => {
    if (sourceHandleIds.length === 0 || edges.length === 0) return;

    const handleIdSet = new Set(sourceHandleIds);
    const store = useFlowStore.getState();
    const nextEdges = store.edges.filter(
      (edge) =>
        edge.source !== nodeId ||
        !edge.sourceHandle ||
        !handleIdSet.has(edge.sourceHandle)
    );

    if (nextEdges.length !== store.edges.length) {
      useFlowStore.setState({ edges: nextEdges, isDirty: true });
    }
  };

  const removeGenericOutgoingEdges = () => {
    if (edges.length === 0) return;

    const store = useFlowStore.getState();
    const nextEdges = store.edges.filter(
      (edge) => !(edge.source === nodeId && !edge.sourceHandle)
    );

    if (nextEdges.length !== store.edges.length) {
      useFlowStore.setState({ edges: nextEdges, isDirty: true });
    }
  };

  const removeCurrentInteractiveEdges = () => {
    removeEdgesBySourceHandles(
      getSendMessageInteractiveOptions(data).map((option) => option.id)
    );
  };

  const updateReplyButtons = (nextButtons: WhatsAppReplyButton[]) => {
    const previousButtons = replyButtons;
    const nextIds = new Set(nextButtons.map((button) => button.id));
    const removedIds = previousButtons
      .filter((button) => !nextIds.has(button.id))
      .map((button) => button.id);

    if (previousButtons.length === 0 && nextButtons.length > 0) {
      removeGenericOutgoingEdges();
    }

    if (removedIds.length > 0) {
      removeEdgesBySourceHandles(removedIds);
    }

    update({ replyButtons: nextButtons });
  };

  const addReplyButton = () => {
    if (replyButtons.length >= WHATSAPP_REPLY_BUTTON_LIMIT) return;

    updateReplyButtons([
      ...replyButtons,
      createWhatsAppReplyButton(replyButtons.length),
    ]);
  };

  const updateReplyButton = (
    buttonId: string,
    partial: Partial<WhatsAppReplyButton>
  ) => {
    updateReplyButtons(
      replyButtons.map((button) =>
        button.id === buttonId ? { ...button, ...partial } : button
      )
    );
  };

  const removeReplyButton = (buttonId: string) => {
    updateReplyButtons(
      replyButtons.filter((button) => button.id !== buttonId)
    );
  };

  const updateListItems = (nextItems: WhatsAppListItem[]) => {
    const previousItems = listItems;
    const nextIds = new Set(nextItems.map((item) => item.id));
    const removedIds = previousItems
      .filter((item) => !nextIds.has(item.id))
      .map((item) => item.id);

    if (previousItems.length === 0 && nextItems.length > 0) {
      removeGenericOutgoingEdges();
    }

    if (removedIds.length > 0) {
      removeEdgesBySourceHandles(removedIds);
    }

    update({ listItems: nextItems });
  };

  const addListItem = () => {
    if (listItems.length >= WHATSAPP_LIST_ITEM_LIMIT) return;

    updateListItems([...listItems, createWhatsAppListItem(listItems.length)]);
  };

  const updateListItem = (
    itemId: string,
    partial: Partial<WhatsAppListItem>
  ) => {
    updateListItems(
      listItems.map((item) =>
        item.id === itemId ? { ...item, ...partial } : item
      )
    );
  };

  const removeListItem = (itemId: string) => {
    updateListItems(listItems.filter((item) => item.id !== itemId));
  };

  const insertVariableIntoText = (variableName: string) => {
    const token = `{{${variableName}}}`;
    const currentValue = data.textContent || "";
    const element = textAreaRef.current;

    if (!element) {
      update({
        textContent: currentValue
          ? `${currentValue}${currentValue.endsWith(" ") ? "" : " "}${token}`
          : token,
      });
      return;
    }

    const start = element.selectionStart ?? currentValue.length;
    const end = element.selectionEnd ?? currentValue.length;
    const nextValue =
      currentValue.slice(0, start) + token + currentValue.slice(end);
    const nextCursor = start + token.length;

    update({ textContent: nextValue });

    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const duplicateReplyTitles = new Set(
    replyButtons
      .map((button) => button.title.trim())
      .filter(Boolean)
      .filter(
        (title, index, titles) =>
          titles.findIndex((value) => value === title) !== index
      )
  );
  const duplicateListTitles = new Set(
    listItems
      .map((item) => item.title.trim())
      .filter(Boolean)
      .filter(
        (title, index, titles) =>
          titles.findIndex((value) => value === title) !== index
      )
  );
  const selectedMetaTemplate = metaTemplates.find(
    (template) =>
      template.id === data.templateId || template.name === data.templateName
  );
  const isMissingSelectedTemplate = Boolean(
    data.templateName && !selectedMetaTemplate
  );
  const templateVariables = extractTemplateVariables(selectedMetaTemplate);
  const isLoadingMetaTemplates =
    data.messageType === "template" &&
    (metaTemplatesRequestState === "idle" || metaTemplatesRequestState === "loading");
  const selectedTemplateValue =
    selectedMetaTemplate?.name || data.templateName || EMPTY_TEMPLATE_VALUE;

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
        <Label>Segundos escrevendo</Label>
        <Input
          type="number"
          min={0}
          max={30}
          value={data.typingSeconds ?? 0}
          onChange={(e) => {
            const val = Math.max(0, Math.min(30, Number(e.target.value) || 0));
            update({ typingSeconds: val });
          }}
          placeholder="0"
        />
        <p className="text-xs text-gray-500">
          Tempo que o indicador &quot;digitando...&quot; aparece antes de enviar
          a mensagem. Maximo 30s.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Tipo de mensagem</Label>
        <Select
          value={data.messageType}
          onValueChange={(value) => {
            if (replyButtons.length > 0) {
              removeEdgesBySourceHandles(
                replyButtons.map((button) => button.id)
              );
            }

            update({
              messageType: value as SendMessageNodeData["messageType"],
              variant:
                value === "ai" && data.variant === "freeAi"
                  ? "freeAi"
                  : undefined,
              textContent: undefined,
              templateId: undefined,
              templateName: undefined,
              templateLanguage: undefined,
              mediaUrl: undefined,
              fileName: undefined,
              audioAssetId: undefined,
              audioVoiceId: undefined,
              audioScript: undefined,
              aiPrompt: undefined,
              imageSource: undefined,
              imagePrompt: undefined,
              imageCaption: undefined,
              videoCaption: undefined,
              interactiveType: "none",
              replyButtons: [],
              listButtonText: undefined,
              listSectionTitle: undefined,
              listItems: [],
            });

            if (
              value === "template" &&
              metaTemplatesRequestState === "idle"
            ) {
              setMetaTemplatesError(null);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Texto livre</SelectItem>
            <SelectItem value="template">Template WhatsApp</SelectItem>
            <SelectItem value="image">Imagem</SelectItem>
            <SelectItem value="file">Arquivo</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="ai">IA</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data.messageType === "text" && (
        <>
          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Textarea
              ref={textAreaRef}
              value={data.textContent || ""}
              onChange={(e) => update({ textContent: e.target.value })}
              placeholder="Digite a mensagem..."
              rows={5}
            />
            <div className="space-y-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3">
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">
                  Variaveis capturadas no flow
                </Label>
                <p className="text-xs text-gray-500">
                  Clique para inserir no texto como{" "}
                  <code className="rounded bg-white px-1">{"{{variavel}}"}</code>.
                </p>
              </div>

              {availableVariables.length === 0 ? (
                <p className="text-xs text-gray-400">
                  Nenhuma variavel encontrada. Configure um no{" "}
                  <span className="font-medium">Capturar Resposta</span> com
                  nome de variavel.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableVariables.map((item) => (
                    <button
                      key={item.variableName}
                      type="button"
                      onClick={() => insertVariableIntoText(item.variableName)}
                      className="rounded-full border border-pink-200 bg-white px-2.5 py-1 text-xs font-medium text-pink-700 transition hover:border-pink-300 hover:bg-pink-50"
                      title={`Inserir ${item.variableName} (${item.sourceLabel}${item.description ? `: ${item.description}` : ""})`}
                    >
                      {`{{${item.variableName}}}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="space-y-1">
              <Label>Resposta interativa</Label>
              <p className="text-xs text-gray-500">
                Use botoes para ate {WHATSAPP_REPLY_BUTTON_LIMIT} opcoes ou
                lista para ate {WHATSAPP_LIST_ITEM_LIMIT} itens.
              </p>
            </div>

            <Select
              value={interactiveType}
              onValueChange={(value) => {
                removeCurrentInteractiveEdges();

                update({
                  interactiveType: value as SendMessageNodeData["interactiveType"],
                  replyButtons: value === "buttons" ? replyButtons : [],
                  listButtonText:
                    value === "list"
                      ? data.listButtonText || "Ver opcoes"
                      : undefined,
                  listSectionTitle:
                    value === "list"
                      ? data.listSectionTitle || "Opcoes"
                      : undefined,
                  listItems: value === "list" ? listItems : [],
                });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem interacao</SelectItem>
                <SelectItem value="buttons">Botoes</SelectItem>
                <SelectItem value="list">Lista</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {interactiveType === "buttons" && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <Label>Botoes de resposta</Label>
                  <p className="text-xs text-gray-500">
                    WhatsApp permite ate {WHATSAPP_REPLY_BUTTON_LIMIT} botoes
                    interativos. Cada botao vira uma saida do card no flow.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addReplyButton}
                  disabled={replyButtons.length >= WHATSAPP_REPLY_BUTTON_LIMIT}
                >
                  <Plus size={14} className="mr-1" />
                  Adicionar
                </Button>
              </div>

              {replyButtons.length === 0 && (
                <p className="text-xs text-gray-400">
                  Sem botoes. Adicione pelo menos um para pausar o flow.
                </p>
              )}

              {replyButtons.map((button, index) => {
                const title = button.title.trim();
                const isDuplicate = duplicateReplyTitles.has(title);

                return (
                  <div key={button.id} className="space-y-2 rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs text-gray-500">
                        Botao {index + 1}
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeReplyButton(button.id)}
                      >
                        <Trash2 size={14} className="text-gray-400" />
                      </Button>
                    </div>
                    <Input
                      value={button.title}
                      onChange={(e) =>
                        updateReplyButton(button.id, {
                          title: sanitizeWhatsAppReplyButtonTitle(
                            e.target.value
                          ),
                        })
                      }
                      placeholder="Texto do botao"
                    />
                    <div className="flex items-center justify-between text-[11px]">
                      <span
                        className={
                          isDuplicate ? "text-destructive" : "text-gray-400"
                        }
                      >
                        {isDuplicate
                          ? "Cada botao precisa ter um texto diferente."
                          : "O clique do usuario segue pela saida desse botao."}
                      </span>
                      <span className="text-gray-400">
                        {button.title.length}/{WHATSAPP_REPLY_BUTTON_TITLE_LIMIT}
                      </span>
                    </div>
                  </div>
                );
              })}

              {hasWhatsAppReplyButtons(data) && !data.textContent?.trim() && (
                <p className="text-xs text-destructive">
                  Mensagens interativas precisam de texto no corpo.
                </p>
              )}
            </div>
          )}

          {interactiveType === "list" && (
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-3 rounded-lg border p-3 w-full">
                <div className="grid gap-3">
                  <div className="space-y-2">
                    <Label>Texto do botao da lista</Label>
                    <Input
                      value={data.listButtonText || "Ver opcoes"}
                      onChange={(e) =>
                        update({
                          listButtonText: sanitizeWhatsAppListButtonText(
                            e.target.value
                          ),
                        })
                      }
                      placeholder="Ver opcoes"
                    />
                    <p className="text-[11px] text-gray-400">
                      {(data.listButtonText || "Ver opcoes").length}/
                      {WHATSAPP_LIST_BUTTON_TEXT_LIMIT}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Titulo da secao</Label>
                    <Input
                      value={data.listSectionTitle || "Opcoes"}
                      onChange={(e) =>
                        update({
                          listSectionTitle: sanitizeWhatsAppListSectionTitle(
                            e.target.value
                          ),
                        })
                      }
                      placeholder="Opcoes"
                    />
                    <p className="text-[11px] text-gray-400">
                      {(data.listSectionTitle || "Opcoes").length}/
                      {WHATSAPP_LIST_SECTION_TITLE_LIMIT}
                    </p>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <Label>Itens da lista</Label>
                    <p className="text-xs text-gray-500">
                      Cada item vira uma saida do card no flow.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={addListItem}
                    disabled={listItems.length >= WHATSAPP_LIST_ITEM_LIMIT}
                  >
                    <Plus size={14} className="mr-1" />
                    Adicionar
                  </Button>
                </div>

                {listItems.length === 0 && (
                  <p className="text-xs text-gray-400">
                    Sem itens. Adicione pelo menos um para enviar a lista.
                  </p>
                )}

                {listItems.map((item, index) => {
                  const title = item.title.trim();
                  const isDuplicate = duplicateListTitles.has(title);

                  return (
                    <div key={item.id} className="space-y-2 rounded-md border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs text-gray-500">
                          Item {index + 1}
                        </Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeListItem(item.id)}
                        >
                          <Trash2 size={14} className="text-gray-400" />
                        </Button>
                      </div>

                      <Input
                        value={item.title}
                        onChange={(e) =>
                          updateListItem(item.id, {
                            title: sanitizeWhatsAppListItemTitle(e.target.value),
                          })
                        }
                        placeholder="Titulo do item"
                      />
                      <div className="flex justify-end text-[11px] text-gray-400">
                        {item.title.length}/{WHATSAPP_LIST_ITEM_TITLE_LIMIT}
                      </div>

                      <Input
                        value={item.description || ""}
                        onChange={(e) =>
                          updateListItem(item.id, {
                            description: sanitizeWhatsAppListItemDescription(
                              e.target.value
                            ),
                          })
                        }
                        placeholder="Descricao opcional"
                      />
                      <div className="flex items-center justify-between text-[11px]">
                        <span
                          className={
                            isDuplicate ? "text-destructive" : "text-gray-400"
                          }
                        >
                          {isDuplicate
                            ? "Cada item precisa ter um titulo diferente."
                            : "O clique do usuario segue pela saida desse item."}
                        </span>
                        <span className="text-gray-400">
                          {(item.description || "").length}/
                          {WHATSAPP_LIST_ITEM_DESCRIPTION_LIMIT}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {hasWhatsAppListItems(data) && !data.textContent?.trim() && (
                  <p className="text-xs text-destructive">
                    Listas interativas precisam de texto no corpo.
                  </p>
                )}

                <p className="text-xs text-gray-500">
                  Limite da Meta: ate {WHATSAPP_LIST_ITEM_LIMIT} itens por
                  lista.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {data.messageType === "template" && (
        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <Label>Template</Label>
              <p className="text-xs text-gray-500">
                Lista carregada da conta Meta vinculada a esta organizacao.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setMetaTemplatesError(null);
                setMetaTemplatesRequestState("loading");
              }}
              disabled={metaTemplatesRequestState === "loading"}
            >
              {metaTemplatesRequestState === "loading" ? (
                <Loader2 size={14} className="mr-1 animate-spin" />
              ) : null}
              Atualizar
            </Button>
          </div>

          <Select
            value={selectedTemplateValue}
            onValueChange={(value) => {
              if (value === EMPTY_TEMPLATE_VALUE) {
                update({
                  templateId: undefined,
                  templateName: undefined,
                  templateLanguage: undefined,
                });
                return;
              }

              const template = metaTemplates.find((item) => item.name === value);
              update({
                templateId: template?.id || data.templateId,
                templateName: value,
                templateLanguage: template?.language,
              });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione um template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_TEMPLATE_VALUE}>
                Selecione um template
              </SelectItem>
              {isMissingSelectedTemplate && data.templateName && (
                <SelectItem value={data.templateName}>
                  {`${data.templateName} (nao encontrado na conta)`}
                </SelectItem>
              )}
              {metaTemplates.map((template) => (
                <SelectItem key={template.id} value={template.name}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isLoadingMetaTemplates && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 size={14} className="animate-spin" />
              Carregando templates da Meta...
            </div>
          )}

          {metaTemplatesError && (
            <p className="text-xs text-destructive">{metaTemplatesError}</p>
          )}

          {!isLoadingMetaTemplates &&
            !metaTemplatesError &&
            metaTemplates.length === 0 && (
              <p className="text-xs text-gray-500">
                Nenhum template encontrado para esta conta Meta.
              </p>
            )}

          {isMissingSelectedTemplate && (
            <p className="text-xs text-amber-600">
              O template salvo neste no nao apareceu na conta atual. Selecione
              outro template para atualizar a configuracao.
            </p>
          )}

          {selectedMetaTemplate && (
            <div className="space-y-2 rounded-md border border-dashed border-gray-200 bg-gray-50 p-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {selectedMetaTemplate.language || "pt_BR"}
                </Badge>
                {selectedMetaTemplate.status && (
                  <Badge variant="outline">{selectedMetaTemplate.status}</Badge>
                )}
                {selectedMetaTemplate.category && (
                  <Badge variant="outline">
                    {selectedMetaTemplate.category}
                  </Badge>
                )}
              </div>

              {templateVariables.length > 0 ? (
                <p className="text-xs text-gray-600">
                  Variaveis do corpo: {templateVariables.join(", ")}
                </p>
              ) : (
                <p className="text-xs text-gray-500">
                  Esse template nao expoe variaveis no corpo.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {data.messageType === "image" && (
        <ImageSection
          data={data}
          update={update}
          availableVariables={availableVariables}
        />
      )}

      {data.messageType === "file" && (
        <div className="space-y-2">
          <Label>Arquivo</Label>
          <MediaUploader
            type="file"
            accept="*/*"
            value={data.mediaUrl}
            fileName={data.fileName}
            onChange={(url, name) => update({ mediaUrl: url, fileName: name })}
            onRemove={() =>
              update({ mediaUrl: undefined, fileName: undefined })
            }
          />
        </div>
      )}

      {data.messageType === "video" && (
        <VideoSection data={data} update={update} />
      )}

      {data.messageType === "audio" && (
        <AudioSection
          data={data}
          update={update}
          availableVariables={availableVariables}
        />
      )}

      {data.messageType === "ai" && (
        <div className="space-y-2">
          <Label>Prompt da IA</Label>
          <Textarea
            ref={textAreaRef}
            value={data.aiPrompt || ""}
            onChange={(e) => update({ aiPrompt: e.target.value })}
            placeholder="Descreva o que a IA deve falar neste ponto do flow...&#10;&#10;Ex: Cumprimente o usuario pelo nome {{nome}} e fale sobre os beneficios de correr {{objetivo}}"
            rows={6}
          />
          <p className="text-xs text-gray-500">
            A IA vai gerar uma resposta personalizada com base nesse prompt. O
            texto gerado sera enviado como mensagem ao usuario.
          </p>

          <div className="space-y-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">
                Variaveis capturadas no flow
              </Label>
              <p className="text-xs text-gray-500">
                Clique para inserir no prompt como{" "}
                <code className="rounded bg-white px-1">{"{{variavel}}"}</code>.
                A IA recebera o valor real da variavel.
              </p>
            </div>

            {availableVariables.length === 0 ? (
              <p className="text-xs text-gray-400">
                Nenhuma variavel encontrada. Configure um no{" "}
                <span className="font-medium">Capturar Resposta</span> com
                nome de variavel.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableVariables.map((item) => (
                  <button
                    key={item.variableName}
                    type="button"
                    onClick={() => {
                      const token = `{{${item.variableName}}}`;
                      const currentValue = data.aiPrompt || "";
                      const element = textAreaRef.current;

                      if (!element) {
                        update({
                          aiPrompt: currentValue
                            ? `${currentValue}${currentValue.endsWith(" ") ? "" : " "}${token}`
                            : token,
                        });
                        return;
                      }

                      const start = element.selectionStart ?? currentValue.length;
                      const end = element.selectionEnd ?? currentValue.length;
                      const nextValue =
                        currentValue.slice(0, start) + token + currentValue.slice(end);
                      const nextCursor = start + token.length;

                      update({ aiPrompt: nextValue });

                      requestAnimationFrame(() => {
                        element.focus();
                        element.setSelectionRange(nextCursor, nextCursor);
                      });
                    }}
                    className="rounded-full border border-purple-200 bg-white px-2.5 py-1 text-xs font-medium text-purple-700 transition hover:border-purple-300 hover:bg-purple-50"
                    title={`Inserir ${item.variableName} (${item.sourceLabel}${item.description ? `: ${item.description}` : ""})`}
                  >
                    {`{{${item.variableName}}}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Audio Section with Upload / ElevenLabs / Library ─── */

function VideoSection({
  data,
  update,
}: {
  data: SendMessageNodeData;
  update: (patch: Partial<SendMessageNodeData>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Video</Label>
        <MediaUploader
          type="video"
          accept="video/*"
          value={data.mediaUrl}
          fileName={data.fileName}
          onChange={(url, name) => update({ mediaUrl: url, fileName: name })}
          onRemove={() =>
            update({
              mediaUrl: undefined,
              fileName: undefined,
              videoCaption: undefined,
            })
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Legenda (opcional)</Label>
        <Textarea
          value={data.videoCaption || ""}
          onChange={(e) => update({ videoCaption: e.target.value })}
          placeholder="Texto enviado junto com o video no WhatsApp"
          rows={3}
        />
        <p className="text-xs text-gray-500">
          O envio usa o tipo nativo de video da Meta, sem cair como arquivo.
        </p>
      </div>
    </div>
  );
}

type AudioAsset = {
  id: string;
  name: string;
  voice_name: string;
  source_text: string;
  audio_url: string;
  created_at: string;
};

const VOICES = [
  { id: "ybT9EL9NMy8gLjKo6TCr", name: "Voz Principal" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah (Feminina)" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam (Masculina)" },
] as const;

function AudioSection({
  data,
  update,
  availableVariables,
}: {
  data: SendMessageNodeData;
  update: (patch: Partial<SendMessageNodeData>) => void;
  availableVariables: Array<{
    variableName: string;
    sourceLabel: string;
    description?: string;
  }>;
}) {
  const source = data.audioSource ?? "upload";
  const [ttsText, setTtsText] = useState("");
  const [voiceId, setVoiceId] = useState<string>(data.audioVoiceId || VOICES[0].id);
  const [audioName, setAudioName] = useState(data.fileName || "");
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [assets, setAssets] = useState<AudioAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const runtimeScriptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setAudioName(data.fileName || "");
  }, [data.fileName]);

  useEffect(() => {
    if (data.audioVoiceId) {
      setVoiceId(data.audioVoiceId);
    }
  }, [data.audioVoiceId]);

  const setSource = (s: "upload" | "elevenlabs" | "library" | "dynamic") => {
    update({
      audioSource: s,
      ...(s === "dynamic"
        ? {
            mediaUrl: undefined,
            audioAssetId: undefined,
          }
        : {}),
      ...(s === "dynamic" ? { audioVoiceId: data.audioVoiceId || voiceId } : {}),
    });
  };

  const loadAssets = useCallback(async () => {
    setLoadingAssets(true);
    try {
      const res = await fetch("/api/audio-assets");
      if (res.ok) {
        const list: AudioAsset[] = await res.json();
        setAssets(list);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingAssets(false);
    }
  }, []);

  useEffect(() => {
    if (source === "library") {
      void loadAssets();
    }
  }, [source, loadAssets]);

  const handleGenerate = async () => {
    if (!ttsText.trim() || generating) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/audio-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: ttsText,
          voiceId,
          name: audioName || `Audio - ${VOICES.find((v) => v.id === voiceId)?.name}`,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Erro ao gerar audio");
        return;
      }
      const asset: AudioAsset = await res.json();
      setPreviewUrl(asset.audio_url);
      update({
        mediaUrl: asset.audio_url,
        fileName: asset.name,
        audioAssetId: asset.id,
        audioVoiceId: voiceId,
        audioSource: "elevenlabs",
      });
    } catch {
      alert("Erro ao gerar audio");
    } finally {
      setGenerating(false);
    }
  };

  const selectAsset = (asset: AudioAsset) => {
    update({
      mediaUrl: asset.audio_url,
      fileName: asset.name,
      audioAssetId: asset.id,
      audioSource: "library",
    });
    setPreviewUrl(asset.audio_url);
  };

  const insertRuntimeVariable = (variableName: string) => {
    const token = `{{${variableName}}}`;
    const currentValue = data.audioScript || "";
    const element = runtimeScriptRef.current;

    if (!element) {
      update({
        audioScript: currentValue
          ? `${currentValue}${currentValue.endsWith(" ") ? "" : " "}${token}`
          : token,
      });
      return;
    }

    const start = element.selectionStart ?? currentValue.length;
    const end = element.selectionEnd ?? currentValue.length;
    const nextValue =
      currentValue.slice(0, start) + token + currentValue.slice(end);
    const nextCursor = start + token.length;

    update({ audioScript: nextValue });

    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(nextCursor, nextCursor);
    });
  };

  return (
    <div className="space-y-3">
      <Label>Audio</Label>

      {/* Source tabs */}
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
        <button
          type="button"
          onClick={() => setSource("upload")}
          className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
            source === "upload"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Upload size={13} />
          Upload
        </button>
        <button
          type="button"
          onClick={() => setSource("elevenlabs")}
          className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
            source === "elevenlabs"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Sparkles size={13} />
          Gerar com IA
        </button>
        <button
          type="button"
          onClick={() => setSource("dynamic")}
          className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
            source === "dynamic"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Sparkles size={13} />
          Gerar no flow
        </button>
        <button
          type="button"
          onClick={() => setSource("library")}
          className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
            source === "library"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Library size={13} />
          Biblioteca
        </button>
      </div>

      {/* Upload mode */}
      {source === "upload" && (
        <>
          <MediaUploader
            type="audio"
            accept="audio/*"
            value={data.mediaUrl}
            fileName={data.fileName}
            onChange={(url, name) => update({ mediaUrl: url, fileName: name })}
            onRemove={() => update({ mediaUrl: undefined, fileName: undefined })}
          />
          <p className="text-xs text-amber-600">
            Para aparecer como audio gravado (voice note) no WhatsApp, use formato <strong>.ogg</strong>. Audios em MP3/WAV aparecem como arquivo encaminhado.
          </p>
        </>
      )}

      {/* ElevenLabs mode */}
      {source === "elevenlabs" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Voz</Label>
            <Select value={voiceId} onValueChange={setVoiceId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICES.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Nome do audio (opcional)</Label>
            <Input
              value={audioName}
              onChange={(e) => setAudioName(e.target.value)}
              placeholder="Ex: Boas vindas corredor"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Texto para gerar</Label>
            <Textarea
              value={ttsText}
              onChange={(e) => setTtsText(e.target.value)}
              placeholder="Digite o texto que sera convertido em audio..."
              rows={4}
            />
          </div>

          <Button
            type="button"
            size="sm"
            disabled={!ttsText.trim() || generating}
            onClick={() => void handleGenerate()}
            className="w-full gap-2"
          >
            {generating ? (
              <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          {generating ? "Gerando audio..." : "Gerar audio"}
        </Button>

          {(previewUrl || data.mediaUrl) && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="mb-2 text-xs font-medium text-gray-600">Preview</p>
              <audio
                controls
                src={previewUrl || data.mediaUrl}
                className="w-full"
              />
            </div>
          )}
        </div>
      )}

      {source === "dynamic" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Voz</Label>
            <Select
              value={data.audioVoiceId || voiceId}
              onValueChange={(value) => {
                setVoiceId(value);
                update({ audioVoiceId: value, audioSource: "dynamic" });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICES.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    {voice.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Nome do audio (opcional)</Label>
            <Input
              value={audioName}
              onChange={(e) => {
                const value = e.target.value;
                setAudioName(value);
                update({ fileName: value });
              }}
              placeholder="Ex: Boas vindas {{nome}}"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Script do audio</Label>
            <Textarea
              ref={runtimeScriptRef}
              value={data.audioScript || ""}
              onChange={(e) => update({ audioScript: e.target.value })}
              placeholder="Escreva o texto que sera transformado em audio quando o no rodar..."
              rows={5}
            />
            <p className="text-xs text-gray-500">
              O audio e gerado em tempo de execucao com as variaveis reais do flow.
            </p>
          </div>

          <div className="space-y-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">
                Variaveis capturadas no flow
              </Label>
              <p className="text-xs text-gray-500">
                Clique para inserir no script como{" "}
                <code className="rounded bg-white px-1">{"{{variavel}}"}</code>.
              </p>
            </div>

            {availableVariables.length === 0 ? (
              <p className="text-xs text-gray-400">
                Nenhuma variavel encontrada. Configure um no{" "}
                <span className="font-medium">Capturar Resposta</span> ou{" "}
                <span className="font-medium">Coletor IA</span> com variaveis.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableVariables.map((item) => (
                  <button
                    key={item.variableName}
                    type="button"
                    onClick={() => insertRuntimeVariable(item.variableName)}
                    className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                    title={`Inserir ${item.variableName} (${item.sourceLabel}${item.description ? `: ${item.description}` : ""})`}
                  >
                    {`{{${item.variableName}}}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Library mode */}
      {source === "library" && (
        <div className="space-y-2">
          {loadingAssets ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={18} className="animate-spin text-gray-400" />
            </div>
          ) : assets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 py-6 text-center text-xs text-gray-400">
              Nenhum audio gerado ainda.
              <br />
              Use &quot;Gerar com IA&quot; para criar seu primeiro audio.
            </div>
          ) : (
            <div className="max-h-56 space-y-1.5 overflow-y-auto">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => selectAsset(asset)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left text-sm transition ${
                    data.audioAssetId === asset.id
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <Play
                    size={14}
                    className={
                      data.audioAssetId === asset.id
                        ? "text-green-600"
                        : "text-gray-400"
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-800">
                      {asset.name}
                    </p>
                    <p className="truncate text-xs text-gray-400">
                      {asset.voice_name} &middot;{" "}
                      {new Date(asset.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {(previewUrl || data.mediaUrl) && source === "library" && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <audio
                controls
                src={previewUrl || data.mediaUrl}
                className="w-full"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ImageSection({
  data,
  update,
  availableVariables,
}: {
  data: SendMessageNodeData;
  update: (patch: Partial<SendMessageNodeData>) => void;
  availableVariables: Array<{
    variableName: string;
    sourceLabel: string;
    description?: string;
  }>;
}) {
  const source = data.imageSource ?? "upload";
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = (variableName: string) => {
    const token = `{{${variableName}}}`;
    const current = data.imagePrompt || "";
    const el = promptRef.current;

    if (!el) {
      update({
        imagePrompt: current
          ? `${current}${current.endsWith(" ") ? "" : " "}${token}`
          : token,
      });
      return;
    }

    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = current.slice(0, start) + token + current.slice(end);
    const cursor = start + token.length;

    update({ imagePrompt: next });

    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <div className="space-y-3">
      <Label>Imagem</Label>

      {/* Source tabs */}
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
        <button
          type="button"
          onClick={() => update({ imageSource: "upload" })}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            source === "upload"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Upload size={13} />
          Upload
        </button>
        <button
          type="button"
          onClick={() => update({ imageSource: "ai_generate" })}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            source === "ai_generate"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Sparkles size={13} />
          Gerar com IA
        </button>
      </div>

      {/* Upload mode */}
      {source === "upload" && (
        <MediaUploader
          type="image"
          accept="image/*"
          value={data.mediaUrl}
          fileName={data.fileName}
          onChange={(url, name) => update({ mediaUrl: url, fileName: name })}
          onRemove={() => update({ mediaUrl: undefined, fileName: undefined })}
        />
      )}

      {/* AI Generate mode */}
      {source === "ai_generate" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Prompt para gerar imagem</Label>
            <Textarea
              ref={promptRef}
              value={data.imagePrompt || ""}
              onChange={(e) => update({ imagePrompt: e.target.value })}
              placeholder={
                "Descreva a imagem que deseja gerar...\n\nEx: Uma ilustracao motivacional de corrida com o nome {{nome}} em destaque"
              }
              rows={5}
            />
            <p className="text-xs text-gray-500">
              A imagem sera gerada com DALL-E 3 durante a execucao do flow.
              Variaveis serao substituidas pelos valores reais.
            </p>
          </div>

          {/* Variable selector */}
          <div className="space-y-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">
                Variaveis capturadas no flow
              </Label>
              <p className="text-xs text-gray-500">
                Clique para inserir no prompt como{" "}
                <code className="rounded bg-white px-1">{"{{variavel}}"}</code>.
              </p>
            </div>
            {availableVariables.length === 0 ? (
              <p className="text-xs text-gray-400">
                Nenhuma variavel encontrada. Configure um no{" "}
                <span className="font-medium">Capturar Resposta</span> ou{" "}
                <span className="font-medium">Coletor IA</span> com variaveis.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableVariables.map((item) => (
                  <button
                    key={item.variableName}
                    type="button"
                    onClick={() => insertVariable(item.variableName)}
                    className="rounded-full border border-purple-200 bg-white px-2.5 py-1 text-xs font-medium text-purple-700 transition hover:border-purple-300 hover:bg-purple-50"
                  >
                    {`{{${item.variableName}}}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Caption — available for both modes */}
      {(source === "ai_generate" || (source === "upload" && data.mediaUrl)) && (
        <div className="space-y-1.5">
          <Label className="text-xs">Legenda (opcional)</Label>
          <Input
            value={data.imageCaption || ""}
            onChange={(e) => update({ imageCaption: e.target.value })}
            placeholder="Texto que aparece junto com a imagem"
          />
        </div>
      )}
    </div>
  );
}
