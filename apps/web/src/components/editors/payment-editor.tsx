"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFlowStore } from "@/hooks/use-flow-store";
import { MediaUploader } from "./media-uploader";
import type { PaymentNodeData } from "@/types/node-data";

interface PaymentEditorProps {
  nodeId: string;
  data: PaymentNodeData;
}

const DEFAULT_MESSAGE =
  "Para assinar o plano, clique no link abaixo:\n\n{{payment_link}}\n\nApos o pagamento, sua assinatura sera ativada automaticamente.";

export function PaymentEditor({ nodeId, data }: PaymentEditorProps) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const billingMode = data.billingMode || "recurring";

  const update = (partial: Partial<PaymentNodeData>) => {
    updateNodeData(nodeId, partial);
  };

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
        <Label>Nome do plano</Label>
        <Input
          value={data.planName || ""}
          onChange={(e) => update({ planName: e.target.value })}
          placeholder="Ex: Premium Mensal"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Tipo de cobranca</Label>
          <Select
            value={billingMode}
            onValueChange={(value) =>
              update({ billingMode: value as PaymentNodeData["billingMode"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recurring">Assinatura recorrente mensal</SelectItem>
              <SelectItem value="one_time">Pagamento avulso</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Valor (R$)</Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={data.amount || ""}
            onChange={(e) =>
              update({ amount: parseFloat(e.target.value) || 0 })
            }
            placeholder="49.90"
          />
        </div>
        <div className="space-y-2">
          <Label>
            {billingMode === "recurring"
              ? "Validade por ciclo (dias)"
              : "Duracao (dias)"}
          </Label>
          <Input
            type="number"
            min={1}
            value={data.durationDays || 30}
            onChange={(e) =>
              update({ durationDays: parseInt(e.target.value) || 30 })
            }
            placeholder="30"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Variavel do e-mail do pagador (opcional)</Label>
        <Input
          value={data.payerEmailVariable || ""}
          onChange={(e) => update({ payerEmailVariable: e.target.value })}
          placeholder="Ex: email ou lead_email"
        />
        <p className="text-xs text-slate-400">
          Para assinatura recorrente, o Mercado Pago precisa do e-mail do
          pagador. Se vazio, o sistema tenta detectar automaticamente
          variaveis comuns como <code className="text-sky-600">email</code> e{" "}
          <code className="text-sky-600">lead_email</code>. Quando nao
          encontrar, ele abre uma pagina segura para o usuario informar o
          e-mail antes de entrar no checkout.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Imagem (opcional)</Label>
        <MediaUploader
          accept="image/*"
          type="image"
          value={data.mediaUrl}
          fileName={data.mediaFileName}
          onChange={(url, name) =>
            update({ mediaUrl: url, mediaFileName: name })
          }
          onRemove={() =>
            update({ mediaUrl: undefined, mediaFileName: undefined })
          }
        />
        {data.mediaUrl && (
          <p className="text-xs text-slate-400">
            A mensagem abaixo sera enviada como legenda da imagem.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Texto do botao (opcional)</Label>
        <Input
          value={data.ctaButtonText || ""}
          onChange={(e) => update({ ctaButtonText: e.target.value })}
          placeholder="Ex: Pagar agora"
        />
        <p className="text-xs text-slate-400">
          Se preenchido, envia um botao clicavel em vez do link solto. O usuario clica e abre o checkout.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Mensagem personalizada</Label>
        <Textarea
          rows={5}
          placeholder={DEFAULT_MESSAGE}
          value={data.messageText || ""}
          onChange={(e) => update({ messageText: e.target.value })}
        />
        <p className="text-xs text-slate-400">
          Use{" "}
          <code className="text-sky-600">{"{{payment_link}}"}</code>{" "}
          para inserir o link de pagamento. Se vazio, usa a mensagem padrao.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border border-dashed border-sky-200 bg-sky-50 p-3">
        <p className="text-xs font-medium text-sky-800">O que esse no faz</p>
        <p className="text-xs text-sky-700">
          {billingMode === "recurring"
            ? "Cria um link de assinatura recorrente mensal no Mercado Pago e envia ao contato via WhatsApp. Se faltar e-mail, o sistema abre uma etapa rapida para captura antes do checkout. Quando o pagamento inicial for confirmado, a assinatura Premium e ativada automaticamente."
            : "Cria um link de pagamento no Mercado Pago e envia ao contato via WhatsApp. Quando o pagamento for confirmado, a assinatura e ativada automaticamente."}
        </p>
        <p className="text-xs text-sky-700">
          Configure as credenciais do Mercado Pago na pagina de Configuracoes.
        </p>
      </div>
    </div>
  );
}
