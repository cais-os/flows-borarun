"use client";

import { Megaphone, Loader2 } from "lucide-react";
import { useCampaigns } from "@/hooks/use-campaigns";
import { CampanhasList } from "./campanhas-list";
import { CampanhasEditor } from "./campanhas-editor";

export function CampanhasView() {
  const {
    campaigns,
    selectedId,
    setSelectedId,
    selectedCampaign,
    loading,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    sendCampaign,
  } = useCampaigns();

  const handleCreate = async () => {
    await createCampaign("Nova campanha");
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <CampanhasList
        campaigns={campaigns}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreate={() => void handleCreate()}
        onDelete={(id) => void deleteCampaign(id)}
      />

      {selectedCampaign ? (
        <CampanhasEditor
          key={selectedCampaign.id}
          campaign={selectedCampaign}
          onUpdate={updateCampaign}
          onSend={sendCampaign}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center bg-gray-50">
          <div className="text-center text-gray-500">
            <Megaphone size={48} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm">
              {campaigns.length === 0
                ? "Crie sua primeira campanha"
                : "Selecione uma campanha"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
