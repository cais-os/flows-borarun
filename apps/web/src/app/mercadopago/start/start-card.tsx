"use client";

import { useState, useTransition } from "react";
import { Mail, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type StartCardProps = {
  token: string;
  initialEmail: string;
  requiresEmail: boolean;
};

export function StartCard({
  token,
  initialEmail,
  requiresEmail,
}: StartCardProps) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/mercadopago/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        redirectUrl?: string;
      };

      if (!response.ok || !payload.ok || !payload.redirectUrl) {
        setError(
          payload.error ||
            "Nao foi possivel iniciar o pagamento agora. Tente novamente em instantes."
        );
        return;
      }

      window.location.assign(payload.redirectUrl);
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
            <Mail className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-900">
              {requiresEmail
                ? "Antes de abrir o Mercado Pago, precisamos confirmar o seu e-mail."
                : "Seu pagamento esta pronto para continuar no Mercado Pago."}
            </p>
            <p className="text-sm leading-6 text-slate-600">
              {requiresEmail
                ? "Esse e-mail sera usado pelo Mercado Pago para criar a assinatura recorrente mensal."
                : "Se estiver tudo certo, continue para finalizar a assinatura."}
            </p>
          </div>
        </div>
      </div>

      {requiresEmail ? (
        <div className="space-y-2">
          <label
            htmlFor="payer-email"
            className="text-sm font-medium text-slate-800"
          >
            Seu melhor e-mail
          </label>
          <Input
            id="payer-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="voce@exemplo.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <Button
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full rounded-xl bg-slate-900 hover:bg-slate-800"
      >
        {isPending ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Abrindo Mercado Pago...
          </>
        ) : (
          "Continuar para o pagamento"
        )}
      </Button>
    </div>
  );
}
