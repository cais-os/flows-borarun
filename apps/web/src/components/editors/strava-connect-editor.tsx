"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFlowStore } from "@/hooks/use-flow-store";
import { MediaUploader } from "./media-uploader";
import type { StravaConnectNodeData } from "@/types/node-data";

interface StravaConnectEditorProps {
  nodeId: string;
  data: StravaConnectNodeData;
}

const DEFAULT_MESSAGE =
  "Para conectar seu Strava e eu ajustar melhor seus treinos, toque neste link:\n\n{{strava_link}}\n\nDepois da autorizacao eu consigo considerar suas corridas recentes, volume e frequencia nas recomendacoes.";

export function StravaConnectEditor({
  nodeId,
  data,
}: StravaConnectEditorProps) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  const update = (partial: Partial<StravaConnectNodeData>) => {
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
            update({ mediaUrl: undefined, mediaFileName: undefined, imageCaption: undefined })
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
          placeholder="Ex: Conectar Strava"
        />
        <p className="text-xs text-slate-400">
          Se preenchido, envia um botao clicavel em vez do link solto.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Mensagem do botao &quot;Seguir sem&quot;</Label>
        <Textarea
          rows={2}
          value={data.skipMessageText || ""}
          onChange={(e) => update({ skipMessageText: e.target.value })}
          placeholder="Depois de conectar o Strava, vou continuar automaticamente. Se preferir, pode seguir sem:"
        />
      </div>

      <div className="space-y-2">
        <Label>Texto do botao &quot;Seguir sem&quot;</Label>
        <Input
          value={data.skipButtonText || ""}
          onChange={(e) => update({ skipButtonText: e.target.value })}
          placeholder="Seguir sem Strava"
        />
      </div>

      <div className="space-y-2">
        <Label>Mensagem personalizada</Label>
        <Textarea
          rows={6}
          placeholder={DEFAULT_MESSAGE}
          value={data.messageText || ""}
          onChange={(e) => update({ messageText: e.target.value })}
        />
        <p className="text-xs text-slate-400">
          Use <code className="text-orange-600">{"{{strava_link}}"}</code> para
          inserir o link de conexao. Se vazio, usa a mensagem padrao.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border border-dashed border-orange-200 bg-orange-50 p-3">
        <p className="text-xs font-medium text-orange-800">O que esse no faz</p>
        <p className="text-xs text-orange-700">
          Gera um link unico de conexao OAuth do Strava para o contato e envia
          via WhatsApp.
        </p>
        <p className="text-xs text-orange-700">
          Quando o usuario clicar, sera redirecionado para autorizar no Strava.
          Apos autorizar, os dados ficam disponiveis para a IA coach.
        </p>
      </div>
    </div>
  );
}
