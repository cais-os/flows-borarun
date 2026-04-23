"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFlowStore } from "@/hooks/use-flow-store";
import type {
  AgenticLoopPaymentToolConfig,
  AgenticLoopNodeData,
} from "@/types/node-data";

interface AgenticLoopEditorProps {
  nodeId: string;
  data: AgenticLoopNodeData;
}

export function AgenticLoopEditor({
  nodeId,
  data,
}: AgenticLoopEditorProps) {
  const updateNodeData = useFlowStore((state) => state.updateNodeData);

  function patch(partial: Partial<AgenticLoopNodeData>) {
    updateNodeData(nodeId, partial);
  }

  function patchPaymentTool(partial: Partial<AgenticLoopPaymentToolConfig>) {
    patch({
      paymentTool: {
        enabled: false,
        planName: "",
        amount: 0,
        durationDays: 30,
        billingMode: "recurring",
        currency: "BRL",
        ...(data.paymentTool || {}),
        ...partial,
      },
    });
  }

  const paymentTool = {
    enabled: false,
    planName: "",
    amount: 0,
    durationDays: 30,
    billingMode: "recurring" as const,
    currency: "BRL",
    ...(data.paymentTool || {}),
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs text-violet-800">
        Este agente pode conversar com o usuario e disparar a tool de
        pagamento configurada abaixo. Nao e mais necessario adicionar um no{" "}
        <strong>Pagamento</strong> depois dele para o caso principal.
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Nome do no</Label>
        <Input
          value={data.label ?? ""}
          onChange={(event) => patch({ label: event.target.value })}
          placeholder="Ex: Tirar duvidas sobre planos"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>System prompt</Label>
        <Textarea
          value={data.systemPrompt ?? ""}
          onChange={(event) => patch({ systemPrompt: event.target.value })}
          placeholder="Instrucoes para o modelo. Pode usar {{variaveis}} do flow."
          rows={6}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Modelo</Label>
          <Input
            value={data.model ?? "gpt-4o"}
            onChange={(event) => patch({ model: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Max turnos</Label>
          <Input
            type="number"
            min={1}
            value={data.maxTurns ?? 10}
            onChange={(event) =>
              patch({
                maxTurns: Math.max(1, Number(event.target.value) || 0),
              })
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Historico (msgs)</Label>
          <Input
            type="number"
            min={1}
            value={data.historyWindowMessages ?? 20}
            onChange={(event) =>
              patch({
                historyWindowMessages: Math.max(
                  1,
                  Number(event.target.value) || 0
                ),
              })
            }
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <Label>Tool de pagamento</Label>
            <p className="text-xs text-slate-500">
              Quando ativa, o agente pode enviar o link de assinatura sem
              depender de um no separado.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={paymentTool.enabled}
              onChange={(event) =>
                patchPaymentTool({ enabled: event.target.checked })
              }
              className="rounded border-gray-300"
            />
            Ativa
          </label>
        </div>

        {paymentTool.enabled ? (
          <div className="mt-4 flex flex-col gap-4">
            <div className="space-y-2">
              <Label>Nome do plano</Label>
              <Input
                value={paymentTool.planName}
                onChange={(event) =>
                  patchPaymentTool({ planName: event.target.value })
                }
                placeholder="Ex: Premium Mensal"
              />
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Tipo de cobranca</Label>
                <Select
                  value={paymentTool.billingMode || "recurring"}
                  onValueChange={(value) =>
                    patchPaymentTool({
                      billingMode:
                        value as AgenticLoopPaymentToolConfig["billingMode"],
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recurring">
                      Assinatura recorrente mensal
                    </SelectItem>
                    <SelectItem value="one_time">Pagamento avulso</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={paymentTool.amount || ""}
                    onChange={(event) =>
                      patchPaymentTool({
                        amount: parseFloat(event.target.value) || 0,
                      })
                    }
                    placeholder="49.90"
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>
                    {paymentTool.billingMode === "one_time"
                      ? "Duracao (dias)"
                      : "Validade por ciclo (dias)"}
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={paymentTool.durationDays || 30}
                    onChange={(event) =>
                      patchPaymentTool({
                        durationDays: parseInt(event.target.value) || 30,
                      })
                    }
                    placeholder="30"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Variavel do e-mail do pagador (opcional)</Label>
              <Input
                value={paymentTool.payerEmailVariable || ""}
                onChange={(event) =>
                  patchPaymentTool({
                    payerEmailVariable: event.target.value,
                  })
                }
                placeholder="Ex: email ou lead_email"
              />
            </div>

            <div className="space-y-2">
              <Label>Texto do botao (opcional)</Label>
              <Input
                value={paymentTool.ctaButtonText || ""}
                onChange={(event) =>
                  patchPaymentTool({ ctaButtonText: event.target.value })
                }
                placeholder="Ex: Pagar agora"
              />
            </div>

            <div className="space-y-2">
              <Label>Mensagem personalizada do pagamento (opcional)</Label>
              <Textarea
                rows={4}
                value={paymentTool.messageText || ""}
                onChange={(event) =>
                  patchPaymentTool({ messageText: event.target.value })
                }
                placeholder={"Para assinar o plano, clique no link abaixo:\n\n{{payment_link}}"}
              />
              <p className="text-xs text-slate-500">
                Use <code>{"{{payment_link}}"}</code> para inserir o checkout.
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-400">
            Se essa tool ficar desligada, o agente so vai conversar. Flows
            antigos ainda podem usar um no Pagamento conectado como fallback.
          </p>
        )}
      </div>
    </div>
  );
}
