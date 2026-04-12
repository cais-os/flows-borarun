"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { CloseButton } from "@/app/strava/connected/close-button";

type CancelCardProps = {
  token: string;
  validUntil: string | null;
  alreadyCancelled: boolean;
};

export function CancelCard({
  token,
  validUntil,
  alreadyCancelled,
}: CancelCardProps) {
  const [isPending, startTransition] = useTransition();
  const [cancelled, setCancelled] = useState(alreadyCancelled);
  const [error, setError] = useState<string | null>(null);

  function handleCancel() {
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        setError(payload.error || "Nao foi possivel cancelar a assinatura.");
        return;
      }

      setCancelled(true);
    });
  }

  if (cancelled) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-base text-slate-700">
          A renovacao automatica foi cancelada com sucesso.
          {validUntil ? ` Seu acesso continua ativo ate ${validUntil}.` : ""}
        </p>
        <div className="flex justify-center">
          <CloseButton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-center">
      <p className="text-base text-slate-700">
        Isso vai interromper as proximas cobrancas automaticas.
        {validUntil ? ` Seu acesso atual continua ate ${validUntil}.` : ""}
      </p>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="flex justify-center gap-3">
        <Button
          onClick={handleCancel}
          disabled={isPending}
          className="rounded-xl bg-rose-600 hover:bg-rose-700"
        >
          {isPending ? "Cancelando..." : "Confirmar cancelamento"}
        </Button>
        <CloseButton />
      </div>
    </div>
  );
}
