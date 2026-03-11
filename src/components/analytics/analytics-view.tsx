"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlowAnalytics } from "./flow-analytics";
import { GeneralAnalytics } from "./general-analytics";

export function AnalyticsView() {
  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-slate-200 bg-white/80 px-6 py-6 backdrop-blur">
        <div className="mx-auto w-full max-w-5xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-500">
            Analytics
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            Painel de metricas
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Acompanhe o desempenho dos flows e as metricas gerais da sua
            operacao.
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto w-full max-w-5xl">
          <Tabs defaultValue="flows">
            <TabsList className="mb-6">
              <TabsTrigger value="flows">Flows</TabsTrigger>
              <TabsTrigger value="geral">Geral</TabsTrigger>
            </TabsList>

            <TabsContent value="flows">
              <FlowAnalytics />
            </TabsContent>

            <TabsContent value="geral">
              <GeneralAnalytics />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </section>
  );
}
