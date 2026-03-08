"use client";

import { useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
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

export function SendMessageEditor({ nodeId, data }: SendMessageEditorProps) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const edges = useFlowStore((s) => s.edges);
  const nodes = useFlowStore((s) => s.nodes);
  const replyButtons = data.replyButtons || [];
  const listItems = data.listItems || [];
  const interactiveType = getSendMessageInteractiveType(data);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const availableVariables = Array.from(
    new Map(
      nodes
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
            },
          ] as const;
        })
        .filter(Boolean) as Array<
        readonly [string, { variableName: string; sourceLabel: string }]
      >
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
              textContent: undefined,
              templateId: undefined,
              templateName: undefined,
              mediaUrl: undefined,
              fileName: undefined,
              interactiveType: "none",
              replyButtons: [],
              listButtonText: undefined,
              listSectionTitle: undefined,
              listItems: [],
            });
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
                      title={`Inserir ${item.variableName} (${item.sourceLabel})`}
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
        <div className="space-y-2">
          <Label>Template</Label>
          <Input
            value={data.templateName || ""}
            onChange={(e) =>
              update({
                templateName: e.target.value,
                templateId: e.target.value,
              })
            }
            placeholder="Nome do template..."
          />
          <p className="text-xs text-gray-500">
            Os templates serao carregados da sua conta Meta Cloud API
          </p>
        </div>
      )}

      {data.messageType === "image" && (
        <div className="space-y-2">
          <Label>Imagem</Label>
          <MediaUploader
            type="image"
            accept="image/*"
            value={data.mediaUrl}
            fileName={data.fileName}
            onChange={(url, name) => update({ mediaUrl: url, fileName: name })}
            onRemove={() =>
              update({ mediaUrl: undefined, fileName: undefined })
            }
          />
        </div>
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

      {data.messageType === "audio" && (
        <div className="space-y-2">
          <Label>Audio</Label>
          <MediaUploader
            type="audio"
            accept="audio/*"
            value={data.mediaUrl}
            fileName={data.fileName}
            onChange={(url, name) => update({ mediaUrl: url, fileName: name })}
            onRemove={() =>
              update({ mediaUrl: undefined, fileName: undefined })
            }
          />
        </div>
      )}
    </div>
  );
}
