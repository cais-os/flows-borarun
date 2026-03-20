"use client";

import { useCallback, useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { FlowCanvas } from "@/components/canvas/flow-canvas";
import { FlowNodeToolbar } from "@/components/canvas/flow-node-toolbar";
import { FlowWorkspaceHeader } from "@/components/canvas/flow-workspace-header";
import { FlowListSidebar } from "@/components/layout/flow-list-sidebar";
import { FlowToolbar } from "@/components/canvas/flow-toolbar";
import { NodeEditorPanel } from "@/components/editors/node-editor-panel";
import { InboxView } from "@/components/inbox/inbox-view";
import { CampanhasView } from "@/components/campanhas/campanhas-view";
import { IntegrationsView } from "@/components/integrations/integrations-view";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { SettingsView } from "@/components/settings/settings-view";
import { useFlowStore } from "@/hooks/use-flow-store";
import { useAutoSave } from "@/hooks/use-auto-save";
import { useSimulatorStore } from "@/hooks/use-simulator-store";
import type { ActiveTab } from "@/types/simulator";
import { PenTool } from "lucide-react";

function EmptyEditor() {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="flex h-full w-full items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white/75">
        <div className="text-center text-slate-400">
          <PenTool size={52} className="mx-auto mb-4 text-slate-300" />
          <p className="text-base font-medium text-slate-600">
            Selecione ou crie um flow para editar
          </p>
          <p className="mt-1 text-sm text-slate-400">
            A biblioteca fica no painel esquerdo.
          </p>
        </div>
      </div>
    </div>
  );
}

function FlowBuilderContent() {
  const {
    save,
    flushPendingSave,
    isSaving,
  } = useAutoSave();
  const flowId = useFlowStore((s) => s.flowId);
  const activeTab = useSimulatorStore((s) => s.activeTab);
  const setActiveTab = useSimulatorStore((s) => s.setActiveTab);

  const isDirty = useFlowStore((s) => s.isDirty);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handleTabSelect = useCallback(
    async (tab: ActiveTab) => {
      if (activeTab === "flows") {
        await flushPendingSave();
      }
      setActiveTab(tab);
    },
    [activeTab, flushPendingSave, setActiveTab]
  );

  return (
    <div className="flex h-screen bg-[#eef2f7] text-slate-900">
      <FlowToolbar onSelectTab={(tab) => void handleTabSelect(tab)} />

      {activeTab === "flows" ? (
        <>
          <FlowListSidebar onBeforeFlowChange={flushPendingSave} />

          <div className="flex min-w-0 flex-1 flex-col">
            {flowId ? (
              <div className="relative min-h-0 flex-1 p-4">
                <div className="relative h-full overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)]">
                  <FlowWorkspaceHeader
                    onSave={save}
                    isSaving={isSaving}
                  />
                  <FlowNodeToolbar />
                  <FlowCanvas />
                </div>
              </div>
            ) : (
              <EmptyEditor />
            )}
          </div>

          {flowId && <NodeEditorPanel />}
        </>
      ) : activeTab === "conversations" ? (
        <InboxView />
      ) : activeTab === "campanhas" ? (
        <CampanhasView />
      ) : activeTab === "integrations" ? (
        <IntegrationsView />
      ) : activeTab === "analytics" ? (
        <AnalyticsView />
      ) : activeTab === "settings" ? (
        <SettingsView />
      ) : null}
    </div>
  );
}

export default function FlowBuilderPage() {
  return (
    <ReactFlowProvider>
      <FlowBuilderContent />
    </ReactFlowProvider>
  );
}
