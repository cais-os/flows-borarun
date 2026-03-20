"use client";

import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFlowStore } from "@/hooks/use-flow-store";
import { NODE_CONFIG } from "@/lib/constants";
import { TriggerEditor } from "./trigger-editor";
import { SendMessageEditor } from "./send-message-editor";
import { TagConversationEditor } from "./tag-conversation-editor";
import { RandomizerEditor } from "./randomizer-editor";
import { WaitForReplyEditor } from "./wait-for-reply-editor";
import { GeneratePdfEditor } from "./generate-pdf-editor";
import { WaitTimerEditor } from "./wait-timer-editor";
import { FinishFlowEditor } from "./finish-flow-editor";
import { AiCollectorEditor } from "./ai-collector-editor";
import { StravaConnectEditor } from "./strava-connect-editor";
import { PaymentEditor } from "./payment-editor";
import { WhatsAppFlowEditor } from "./whatsapp-flow-editor";
import type {
  NodeData,
  TriggerNodeData,
  SendMessageNodeData,
  TagConversationNodeData,
  RandomizerNodeData,
  WaitForReplyNodeData,
  GeneratePdfNodeData,
  WaitTimerNodeData,
  FinishFlowNodeData,
  AiCollectorNodeData,
  StravaConnectNodeData,
  PaymentNodeData,
  WhatsAppFlowNodeData,
} from "@/types/node-data";

export function NodeEditorPanel() {
  const selectedNodeId = useFlowStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useFlowStore((s) => s.setSelectedNodeId);
  const nodes = useFlowStore((s) => s.nodes);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const nodeData = selectedNode?.data as NodeData | undefined;

  if (!selectedNodeId || !nodeData) return null;

  const nodeType = nodeData.type;
  const config = nodeType
    ? NODE_CONFIG[nodeType as keyof typeof NODE_CONFIG]
    : null;

  const close = () => setSelectedNodeId(null);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
        onClick={close}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-[380px] flex-col border-l border-slate-200 bg-white shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            {config && (
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${config.color}15` }}
              >
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                {config?.label || "Editar nó"}
              </h3>
              {config?.description && (
                <p className="text-xs text-slate-400">{config.description}</p>
              )}
            </div>
          </div>
          <button
            onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {nodeData.type === "trigger" && (
            <TriggerEditor
              nodeId={selectedNodeId}
              data={nodeData as TriggerNodeData}
            />
          )}
          {nodeData.type === "sendMessage" && (
            <SendMessageEditor
              nodeId={selectedNodeId}
              data={nodeData as SendMessageNodeData}
            />
          )}
          {nodeData.type === "tagConversation" && (
            <TagConversationEditor
              nodeId={selectedNodeId}
              data={nodeData as TagConversationNodeData}
            />
          )}
          {nodeData.type === "randomizer" && (
            <RandomizerEditor
              nodeId={selectedNodeId}
              data={nodeData as RandomizerNodeData}
            />
          )}
          {nodeData.type === "waitForReply" && (
            <WaitForReplyEditor
              nodeId={selectedNodeId}
              data={nodeData as WaitForReplyNodeData}
            />
          )}
          {nodeData.type === "generatePdf" && (
            <GeneratePdfEditor
              nodeId={selectedNodeId}
              data={nodeData as GeneratePdfNodeData}
            />
          )}
          {nodeData.type === "waitTimer" && (
            <WaitTimerEditor
              nodeId={selectedNodeId}
              data={nodeData as WaitTimerNodeData}
            />
          )}
          {nodeData.type === "finishFlow" && (
            <FinishFlowEditor
              nodeId={selectedNodeId}
              data={nodeData as FinishFlowNodeData}
            />
          )}
          {nodeData.type === "aiCollector" && (
            <AiCollectorEditor
              nodeId={selectedNodeId}
              data={nodeData as AiCollectorNodeData}
            />
          )}
          {nodeData.type === "stravaConnect" && (
            <StravaConnectEditor
              nodeId={selectedNodeId}
              data={nodeData as StravaConnectNodeData}
            />
          )}
          {nodeData.type === "payment" && (
            <PaymentEditor
              nodeId={selectedNodeId}
              data={nodeData as PaymentNodeData}
            />
          )}
          {nodeData.type === "whatsappFlow" && (
            <WhatsAppFlowEditor
              nodeId={selectedNodeId}
              data={nodeData as WhatsAppFlowNodeData}
            />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-5 py-4">
          <Button
            onClick={close}
            className="w-full gap-2 rounded-xl bg-slate-900 hover:bg-slate-800"
          >
            <Check size={16} />
            Concluir
          </Button>
        </div>
      </div>
    </>
  );
}
