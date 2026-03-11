"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { useUpdateNodeInternals } from "@xyflow/react";
import {
  MessageSquare,
  ImageIcon,
  FileText,
  Mic,
  Video,
  LayoutTemplate,
  Sparkles,
} from "lucide-react";
import { NodeWrapper } from "./node-wrapper";
import { NODE_CONFIG } from "@/lib/constants";
import {
  getSendMessageInteractiveOptions,
  getSendMessageInteractiveType,
} from "@/lib/whatsapp";
import { NODE_TYPES } from "@/types/flow";
import type { SendMessageNodeData } from "@/types/node-data";

const messageIcons = {
  text: <MessageSquare size={14} />,
  template: <LayoutTemplate size={14} />,
  image: <ImageIcon size={14} />,
  file: <FileText size={14} />,
  audio: <Mic size={14} />,
  video: <Video size={14} />,
  ai: <Sparkles size={14} />,
};

const messageLabels = {
  text: "Texto",
  template: "Template",
  image: "Imagem",
  file: "Arquivo",
  audio: "Audio",
  video: "Video",
  ai: "IA",
};

export function SendMessageNode({ id, data, selected }: NodeProps) {
  const nodeData = data as SendMessageNodeData;
  const config = NODE_CONFIG[NODE_TYPES.SEND_MESSAGE];
  const updateNodeInternals = useUpdateNodeInternals();
  const containerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [measuredPositions, setMeasuredPositions] = useState<Record<string, number>>(
    {}
  );
  const interactiveType = getSendMessageInteractiveType(nodeData);
  const interactiveOptions = getSendMessageInteractiveOptions(nodeData);
  const optionsSignature = useMemo(
    () =>
      interactiveOptions
        .map((option) => `${option.id}:${option.title}:${option.description || ""}`)
        .join("|"),
    [interactiveOptions]
  );
  const fallbackPositions = useMemo(() => {
    if (interactiveOptions.length <= 0) return {};

    const start = interactiveOptions.length <= 3 ? 68 : 60;
    const end = interactiveOptions.length <= 3 ? 84 : 92;
    const step =
      interactiveOptions.length > 1
        ? (end - start) / (interactiveOptions.length - 1)
        : 0;

    return interactiveOptions.reduce<Record<string, string>>((acc, option, index) => {
      acc[option.id] = interactiveOptions.length === 1
        ? "77%"
        : `${start + step * index}%`;
      return acc;
    }, {});
  }, [interactiveOptions]);
  const sourceHandles = interactiveType !== "none"
    ? interactiveOptions.map((option, index) => ({
        id: option.id,
        label: option.title,
        position: measuredPositions[option.id] ?? fallbackPositions[option.id] ?? index,
      }))
    : undefined;
  const handleSignature =
    sourceHandles?.map((handle) => `${handle.id}:${handle.position}`).join("|") ||
    "default";

  useLayoutEffect(() => {
    if (interactiveType === "none" || interactiveOptions.length === 0) {
      return;
    }

    const measure = () => {
      const nextPositions = interactiveOptions.reduce<Record<string, number>>(
        (acc, option) => {
          const optionElement = optionRefs.current[option.id];

          if (!optionElement) return acc;

          acc[option.id] = optionElement.offsetTop + optionElement.offsetHeight / 2;
          return acc;
        },
        {}
      );

      setMeasuredPositions((current) => {
        const currentKeys = Object.keys(current);
        const nextKeys = Object.keys(nextPositions);

        if (
          currentKeys.length === nextKeys.length &&
          nextKeys.every((key) => current[key] === nextPositions[key])
        ) {
          return current;
        }

        return nextPositions;
      });
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      measure();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    interactiveOptions.forEach((option) => {
      const element = optionRefs.current[option.id];

      if (element) {
        resizeObserver.observe(element);
      }
    });

    return () => {
      resizeObserver.disconnect();
    };
  }, [interactiveOptions, interactiveType, optionsSignature]);

  useEffect(() => {
    updateNodeInternals(id);
  }, [handleSignature, id, updateNodeInternals]);

  return (
    <NodeWrapper
      id={id}
      label={nodeData.label || config.label}
      icon={messageIcons[nodeData.messageType] || <MessageSquare size={14} />}
      color={config.color}
      selected={selected}
      sourceHandles={sourceHandles}
      containerRef={containerRef}
    >
      <div className="mb-1 flex items-center gap-1">
        <span className="text-gray-500">Tipo:</span>
        <span className="font-medium">
          {messageLabels[nodeData.messageType]}
        </span>
      </div>

      {nodeData.messageType === "text" && nodeData.textContent && (
        <p className="line-clamp-2 whitespace-pre-wrap text-gray-700">
          {nodeData.textContent}
        </p>
      )}

      {nodeData.messageType === "ai" && nodeData.aiPrompt && (
        <p className="line-clamp-2 whitespace-pre-wrap text-purple-700 italic">
          {nodeData.aiPrompt}
        </p>
      )}

      {nodeData.messageType === "audio" &&
        nodeData.audioSource === "dynamic" &&
        nodeData.audioScript && (
          <>
            <div className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">
              Audio dinamico
            </div>
            <p className="line-clamp-2 whitespace-pre-wrap text-emerald-700 italic text-[10px]">
              {nodeData.audioScript}
            </p>
          </>
        )}

      {interactiveType !== "none" && (
        <div className="mt-1.5 space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
            {interactiveType === "list"
              ? `Lista: ${nodeData.listButtonText || "Ver opcoes"}`
              : "Botoes de resposta"}
          </p>
          {interactiveOptions.map((option) => (
            <div
              key={option.id}
              ref={(element) => {
                optionRefs.current[option.id] = element;
              }}
              className="rounded border border-[#8bb7f0] bg-[#ebf3ff] px-1.5 py-0.5 text-center text-[10px] font-medium text-[#3977d8]"
              title={option.description}
            >
              {option.title}
            </div>
          ))}
        </div>
      )}

      {nodeData.messageType === "template" && nodeData.templateName && (
        <div className="rounded bg-green-50 px-1.5 py-0.5 text-green-700 truncate">
          {nodeData.templateName}
        </div>
      )}

      {nodeData.messageType === "image" &&
        nodeData.imageSource === "ai_generate" &&
        nodeData.imagePrompt && (
          <p className="line-clamp-2 whitespace-pre-wrap text-purple-700 italic text-[10px]">
            {nodeData.imagePrompt}
          </p>
        )}

      {(nodeData.messageType === "file" ||
        nodeData.messageType === "audio" ||
        nodeData.messageType === "video" ||
        (nodeData.messageType === "image" &&
          nodeData.imageSource !== "ai_generate")) &&
        nodeData.mediaUrl && (
          <div className="rounded bg-gray-50 px-1.5 py-0.5 text-gray-600 truncate">
            {nodeData.fileName || "Arquivo anexado"}
          </div>
        )}

      {!nodeData.textContent &&
        !nodeData.templateName &&
        !nodeData.mediaUrl &&
        !nodeData.aiPrompt &&
        !nodeData.imagePrompt && (
          <p className="text-gray-400 italic">Clique para configurar</p>
        )}
    </NodeWrapper>
  );
}
