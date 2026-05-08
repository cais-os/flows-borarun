"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFlowStore } from "@/hooks/use-flow-store";
import { DEFAULT_WEB_APP_MESSAGE } from "@/lib/runner/web-app-message";
import type { WebAppNodeData } from "@/types/node-data";

interface WebAppEditorProps {
  nodeId: string;
  data: WebAppNodeData;
}

export function WebAppEditor({ nodeId, data }: WebAppEditorProps) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  const update = (partial: Partial<WebAppNodeData>) => {
    updateNodeData(nodeId, partial);
  };

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
        <Label>Mensagem com o link</Label>
        <Textarea
          value={data.message || ""}
          onChange={(event) => update({ message: event.target.value })}
          placeholder={DEFAULT_WEB_APP_MESSAGE}
          rows={5}
        />
        <p className="text-xs text-gray-500">
          Use <code className="rounded bg-gray-100 px-1">{"{{web_app_link}}"}</code>{" "}
          para posicionar o link. Se a variavel nao estiver na mensagem, o
          link sera adicionado no final.
        </p>
      </div>
    </div>
  );
}
