"use client";

import { type ReactNode, type Ref } from "react";
import { Handle, Position } from "@xyflow/react";
import { X } from "lucide-react";
import { useFlowStore } from "@/hooks/use-flow-store";

interface NodeWrapperProps {
  id: string;
  label: string;
  icon: ReactNode;
  color: string;
  children: ReactNode;
  showTargetHandle?: boolean;
  showSourceHandle?: boolean;
  sourceHandles?: { id: string; label: string; position?: string | number }[];
  selected?: boolean;
  containerRef?: Ref<HTMLDivElement>;
}

export function NodeWrapper({
  id,
  label,
  icon,
  color,
  children,
  showTargetHandle = true,
  showSourceHandle = true,
  sourceHandles,
  selected,
  containerRef,
}: NodeWrapperProps) {
  const deleteNode = useFlowStore((s) => s.deleteNode);

  return (
    <div
      ref={containerRef}
      className={`group relative min-w-[176px] max-w-[220px] rounded-md border bg-white shadow-sm transition-shadow ${
        selected ? "shadow-md ring-2 ring-primary/20" : ""
      }`}
      style={{ borderLeftColor: color, borderLeftWidth: 4 }}
    >
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5 !border-2 !border-white !bg-gray-400"
        />
      )}

      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span style={{ color }}>{icon}</span>
          <span className="truncate text-[13px] font-medium text-gray-800">
            {label}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteNode(id);
          }}
          className="rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100 focus:opacity-100"
        >
          <X size={12} />
        </button>
      </div>

      <div className="px-2.5 py-1.5 text-[11px] leading-4 text-gray-600">
        {children}
      </div>

      {sourceHandles
        ? sourceHandles.map((handle, index) => (
            <Handle
              key={handle.id}
              type="source"
              position={Position.Right}
              id={handle.id}
              className="!h-2.5 !w-2.5 !border-2 !border-white"
              style={{
                backgroundColor: color,
                top:
                  handle.position ??
                  `${((index + 1) / (sourceHandles.length + 1)) * 100}%`,
              }}
            />
          ))
        : showSourceHandle && (
            <Handle
              type="source"
              position={Position.Right}
              className="!h-2.5 !w-2.5 !border-2 !border-white"
              style={{ backgroundColor: color }}
            />
          )}
    </div>
  );
}
