"use client";

import { Plus, Megaphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Campaign } from "@/hooks/use-campaigns";

const statusLabels: Record<Campaign["status"], string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  sending: "Enviando",
  sent: "Enviada",
  failed: "Falhou",
};

const statusColors: Record<Campaign["status"], string> = {
  draft: "bg-gray-100 text-gray-600",
  scheduled: "bg-blue-100 text-blue-700",
  sending: "bg-yellow-100 text-yellow-700",
  sent: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

interface CampanhasListProps {
  campaigns: Campaign[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

export function CampanhasList({
  campaigns,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
}: CampanhasListProps) {
  return (
    <div className="flex h-full w-72 flex-col border-r bg-white">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Campanhas</h2>
          <p className="text-xs text-gray-400">{campaigns.length} campanha(s)</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onCreate}>
          <Plus size={16} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <Megaphone size={36} className="mb-3 text-gray-300" />
            <p className="text-sm text-gray-500">Nenhuma campanha criada</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={onCreate}>
              <Plus size={14} className="mr-1" /> Nova campanha
            </Button>
          </div>
        ) : (
          campaigns.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                selectedId === c.id ? "bg-blue-50" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800">
                  {c.name}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="secondary" className={statusColors[c.status]}>
                    {statusLabels[c.status]}
                  </Badge>
                  <span className="text-xs text-gray-400">
                    {c.total_recipients} contato(s)
                  </span>
                </div>
                {c.status === "scheduled" && c.scheduled_at && (
                  <p className="mt-1 text-xs text-blue-500">
                    {new Date(c.scheduled_at).toLocaleString("pt-BR")}
                  </p>
                )}
                {c.status === "sent" && (
                  <p className="mt-1 text-xs text-gray-400">
                    {c.sent_count} enviados, {c.failed_count} falhas
                  </p>
                )}
              </div>
              {c.status === "draft" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(c.id);
                  }}
                  className="mt-1 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
