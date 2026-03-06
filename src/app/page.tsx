"use client";

import { useCallback, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { FlowCanvas } from "@/components/canvas/flow-canvas";
import { FlowWorkspaceHeader } from "@/components/canvas/flow-workspace-header";
import { FlowListPanel } from "@/components/layout/flow-list-panel";
import { FlowSidebar } from "@/components/layout/flow-sidebar";
import { FlowToolbar } from "@/components/canvas/flow-toolbar";
import { NodeEditorPanel } from "@/components/editors/node-editor-panel";
import { InboxView } from "@/components/inbox/inbox-view";
import { useFlowStore } from "@/hooks/use-flow-store";
import { useAutoSave } from "@/hooks/use-auto-save";
import { useSimulatorStore } from "@/hooks/use-simulator-store";
import type { ActiveTab } from "@/types/simulator";
import { PenTool } from "lucide-react";

type FlowScreen = "list" | "editor";

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
  const [flowScreen, setFlowScreen] = useState<FlowScreen>("list");
  const {
    save,
    flushPendingSave,
    isSaving,
    saveStatus,
    saveTarget,
    saveError,
    lastSavedAt,
  } = useAutoSave();
  const flowId = useFlowStore((s) => s.flowId);
  const activeTab = useSimulatorStore((s) => s.activeTab);
  const setActiveTab = useSimulatorStore((s) => s.setActiveTab);

  const openFlowList = useCallback(async () => {
    await flushPendingSave();
    setFlowScreen("list");
  }, [flushPendingSave]);

  const openFlowEditor = useCallback(() => {
    setFlowScreen("editor");
  }, []);

  const handleTabSelect = useCallback(
    async (tab: ActiveTab) => {
      if (activeTab === "flows") {
        await flushPendingSave();
      }

      if (tab === "flows") {
        setFlowScreen("list");
      }

      setActiveTab(tab);
    },
    [activeTab, flushPendingSave, setActiveTab]
  );

  return (
    <div className="flex h-screen bg-[#eef2f7] text-slate-900">
      <FlowToolbar onSelectTab={(tab) => void handleTabSelect(tab)} />

      {activeTab === "flows" ? (
        flowScreen === "list" ? (
          <FlowListPanel
            onBeforeFlowChange={flushPendingSave}
            onOpenFlow={openFlowEditor}
          />
        ) : (
          <>
            <FlowSidebar />

            <div className="flex min-w-0 flex-1 flex-col">
              {flowId ? (
                <>
                  <FlowWorkspaceHeader
                    onSave={save}
                    isSaving={isSaving}
                    saveStatus={saveStatus}
                    saveTarget={saveTarget}
                    saveError={saveError}
                    lastSavedAt={lastSavedAt}
                    onBackToList={() => void openFlowList()}
                  />
                  <div className="min-h-0 flex-1 p-4 pt-0">
                    <div className="h-full overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)]">
                      <FlowCanvas />
                    </div>
                  </div>
                </>
              ) : (
                <EmptyEditor />
              )}
            </div>
          </>
        )
      ) : (
        <InboxView />
      )}

      {activeTab === "flows" && flowScreen === "editor" && flowId && (
        <NodeEditorPanel />
      )}
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
