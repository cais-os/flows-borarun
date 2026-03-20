"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  MessageSquare,
  Users,
  CreditCard,
  RefreshCw,
  XCircle,
  Tag,
  Bot,
  User,
  Headphones,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GeneralAnalytics as GeneralAnalyticsData } from "@/types/analytics";
import { StatCard } from "./stat-card";
import { DateRangeFilter, type DateRange } from "./date-range-filter";

function buildQueryString(range: DateRange): string {
  const params = new URLSearchParams();
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function GeneralAnalytics() {
  const [data, setData] = useState<GeneralAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });

  const fetchData = useCallback(async (range: DateRange) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/analytics/general${buildQueryString(range)}`
      );
      if (res.ok) {
        setData((await res.json()) as GeneralAnalyticsData);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(dateRange);
  }, [dateRange, fetchData]);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 size={20} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-slate-400">
        Nao foi possivel carregar os dados.
      </p>
    );
  }

  const totalMessages = data.messages.total || 1;

  return (
    <div className="space-y-6">
      {/* Date filter */}
      <DateRangeFilter value={dateRange} onChange={setDateRange} />

      {/* Conversations */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">
          Conversas
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            title="Total de conversas"
            value={data.conversations.total}
            icon={Users}
          />
          <StatCard
            title="Novas no periodo"
            value={data.conversations.new}
            icon={Users}
          />
        </div>
      </div>

      {/* Subscriptions */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">
          Assinaturas
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            title="Ativas"
            value={data.subscriptions.active}
            icon={CreditCard}
          />
          <StatCard
            title="Expiradas"
            value={data.subscriptions.expired}
            icon={XCircle}
          />
          <StatCard
            title="Renovadas"
            value={data.subscriptions.renewed}
            icon={RefreshCw}
          />
          <StatCard
            title="Nao renovadas"
            value={data.subscriptions.notRenewed}
            icon={XCircle}
          />
        </div>
      </div>

      {/* Tags */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Tags</h3>
        {data.tags.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma tag ainda.</p>
        ) : (
          <div className="space-y-2">
            {data.tags.map((tag) => (
              <div
                key={tag.name}
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-2.5 shadow-sm"
              >
                <Tag size={14} className="shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                  {tag.name}
                </span>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {tag.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">
          Mensagens
        </h3>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs text-slate-500">
            Total: <span className="font-semibold">{data.messages.total}</span>
          </p>
          <div className="space-y-2">
            {[
              {
                label: "Bot",
                value: data.messages.fromBot,
                icon: Bot,
                color: "bg-emerald-500",
              },
              {
                label: "Contato",
                value: data.messages.fromContact,
                icon: User,
                color: "bg-sky-500",
              },
              {
                label: "Humano",
                value: data.messages.fromHuman,
                icon: Headphones,
                color: "bg-amber-500",
              },
            ].map((item) => {
              const pct = Math.round((item.value / totalMessages) * 100);
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <item.icon
                    size={14}
                    className="shrink-0 text-slate-400"
                  />
                  <span className="w-16 text-xs text-slate-600">
                    {item.label}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn("h-full rounded-full", item.color)}
                      style={{
                        width: `${Math.max(2, pct)}%`,
                      }}
                    />
                  </div>
                  <span className="w-12 text-right text-xs font-medium text-slate-700">
                    {item.value}
                  </span>
                  <span className="w-10 text-right text-xs text-slate-400">
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
