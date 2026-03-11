"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  CheckCircle2,
  Loader2,
  Play,
  Zap,
  MessageSquare,
  Clock3,
  GitBranch,
  Tag,
  FileText,
  Timer,
  Flag,
  Brain,
  Link2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowAnalyticsSummary, FlowFunnelData } from "@/types/analytics";
import { StatCard } from "./stat-card";
import { DateRangeFilter, type DateRange } from "./date-range-filter";

const NODE_ICONS: Record<string, typeof Zap> = {
  trigger: Zap,
  sendMessage: MessageSquare,
  waitForReply: Clock3,
  randomizer: GitBranch,
  tagConversation: Tag,
  generatePdf: FileText,
  waitTimer: Timer,
  finishFlow: Flag,
  aiCollector: Brain,
  stravaConnect: Link2,
};

function buildQueryString(range: DateRange): string {
  const params = new URLSearchParams();
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function FlowAnalytics() {
  const [flows, setFlows] = useState<FlowAnalyticsSummary[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [funnel, setFunnel] = useState<FlowFunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [funnelLoading, setFunnelLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });

  const fetchFlows = useCallback(async (range: DateRange) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/analytics/flows${buildQueryString(range)}`
      );
      if (res.ok) {
        const data = (await res.json()) as FlowAnalyticsSummary[];
        setFlows(data);
      } else {
        // Fallback: load flows from the existing /api/flows endpoint
        const fallback = await fetch("/api/flows");
        if (fallback.ok) {
          const flowsData = (await fallback.json()) as Array<{
            id: string;
            name: string;
            is_active: boolean;
          }>;
          setFlows(
            flowsData.map((f) => ({
              flowId: f.id,
              flowName: f.name || "Sem nome",
              isActive: Boolean(f.is_active),
              totalExecutions: 0,
              completed: 0,
              abandoned: 0,
              completionRate: 0,
            }))
          );
        }
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFunnel = useCallback(
    async (flowId: string, range: DateRange) => {
      setFunnelLoading(true);
      try {
        const res = await fetch(
          `/api/analytics/flows/${flowId}${buildQueryString(range)}`
        );
        if (res.ok) {
          setFunnel((await res.json()) as FlowFunnelData);
        }
      } catch {
        // silently fail
      } finally {
        setFunnelLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void fetchFlows(dateRange);
  }, [dateRange, fetchFlows]);

  useEffect(() => {
    if (selectedFlowId) {
      void fetchFunnel(selectedFlowId, dateRange);
    } else {
      setFunnel(null);
    }
  }, [selectedFlowId, dateRange, fetchFunnel]);

  const selectedFlow = flows.find((f) => f.flowId === selectedFlowId);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-slate-400"
          value={selectedFlowId || ""}
          onChange={(e) =>
            setSelectedFlowId(e.target.value || null)
          }
        >
          <option value="">Selecionar flow...</option>
          {flows.map((flow) => (
            <option key={flow.flowId} value={flow.flowId}>
              {flow.flowName}
              {flow.isActive ? " (ativo)" : ""}
            </option>
          ))}
        </select>

        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 size={20} className="animate-spin text-slate-400" />
        </div>
      ) : !selectedFlowId ? (
        /* Overview of all flows */
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            Resumo dos flows
          </h3>
          {flows.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum flow encontrado.</p>
          ) : (
            <div className="space-y-2">
              {flows.map((flow) => (
                <button
                  key={flow.flowId}
                  type="button"
                  onClick={() => setSelectedFlowId(flow.flowId)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <Zap size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {flow.flowName}
                    </p>
                    <p className="text-xs text-slate-400">
                      {flow.totalExecutions} execucoes ·{" "}
                      {Math.round(flow.completionRate * 100)}% conclusao
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      flow.isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    )}
                  >
                    {flow.isActive ? "Ativo" : "Inativo"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Selected flow detail */
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              title="Execucoes"
              value={funnel?.totalExecutions ?? 0}
              icon={Play}
            />
            <StatCard
              title="Concluidos"
              value={funnel?.completed ?? 0}
              icon={CheckCircle2}
            />
            <StatCard
              title="Abandonados"
              value={funnel?.abandoned ?? 0}
              icon={XCircle}
            />
            <StatCard
              title="Taxa conclusao"
              value={
                funnel && funnel.totalExecutions > 0
                  ? `${Math.round((funnel.completed / funnel.totalExecutions) * 100)}%`
                  : "0%"
              }
              icon={CheckCircle2}
            />
          </div>

          {/* Funnel */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              Funil — {selectedFlow?.flowName}
            </h3>

            {funnelLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2
                  size={18}
                  className="animate-spin text-slate-400"
                />
              </div>
            ) : !funnel || funnel.nodes.length === 0 ? (
              <p className="text-sm text-slate-400">
                Sem dados de execucao ainda.
              </p>
            ) : (
              <div className="space-y-1">
                {funnel.nodes.map((node, index) => {
                  const Icon =
                    NODE_ICONS[node.nodeType] || Zap;
                  const maxVisits =
                    funnel.nodes[0]?.visits || 1;
                  const barWidth =
                    maxVisits > 0
                      ? Math.max(
                          4,
                          Math.round(
                            (node.visits / maxVisits) * 100
                          )
                        )
                      : 4;

                  return (
                    <div key={node.nodeId}>
                      <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                          <Icon size={14} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="truncate text-sm font-medium text-slate-700">
                              {node.label}
                            </p>
                            <div className="flex shrink-0 items-center gap-2 text-xs">
                              <span className="font-semibold text-slate-800">
                                {node.visits}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full px-1.5 py-0.5 font-medium",
                                  node.percentage >= 80
                                    ? "bg-emerald-50 text-emerald-700"
                                    : node.percentage >= 50
                                      ? "bg-amber-50 text-amber-700"
                                      : "bg-red-50 text-red-700"
                                )}
                              >
                                {node.percentage}%
                              </span>
                            </div>
                          </div>

                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                node.percentage >= 80
                                  ? "bg-emerald-500"
                                  : node.percentage >= 50
                                    ? "bg-amber-500"
                                    : "bg-red-500"
                              )}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Drop-off indicator between nodes */}
                      {index < funnel.nodes.length - 1 &&
                        node.dropOff > 0 && (
                          <div className="flex items-center gap-2 py-0.5 pl-12 text-xs text-slate-400">
                            <ArrowDown size={10} />
                            <span>-{node.dropOff} abandonos</span>
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
