"use client";

import { useEffect, useState } from "react";
import { Loader2, LogOut, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type SettingsFormValues = {
  fullName: string;
  phone: string;
  email: string;
  subscriptionPlan: "free" | "premium";
  businessName: string;
  businessPhone: string;
  phoneNumberId: string;
  wabaId: string;
  appId: string;
  appSecret: string;
  systemToken: string;
  webhookVerifyToken: string;
  graphApiVersion: string;
  stravaClientId: string;
  stravaClientSecret: string;
  stravaScopes: string;
  mercadoPagoAccessToken: string;
  mercadoPagoPublicKey: string;
  mercadoPagoWebhookSecret: string;
  subscriptionNudgeMessage: string;
};

type SettingsPayload = {
  organizationName: string;
  userEmail: string | null;
  settings: {
    full_name: string | null;
    phone: string | null;
    email: string | null;
    subscription_plan: "free" | "premium";
    business_name: string | null;
    business_phone: string | null;
    meta_phone_number_id: string | null;
    meta_waba_id: string | null;
    meta_app_id: string | null;
    meta_app_secret: string | null;
    meta_system_token: string | null;
    meta_webhook_verify_token: string | null;
    meta_graph_api_version: string | null;
    strava_client_id: string | null;
    strava_client_secret: string | null;
    strava_scopes: string[] | null;
    mercado_pago_access_token: string | null;
    mercado_pago_public_key: string | null;
    mercado_pago_webhook_secret: string | null;
    subscription_nudge_message: string | null;
  } | null;
};

const defaultValues: SettingsFormValues = {
  fullName: "",
  phone: "",
  email: "",
  subscriptionPlan: "free",
  businessName: "",
  businessPhone: "",
  phoneNumberId: "",
  wabaId: "",
  appId: "",
  appSecret: "",
  systemToken: "",
  webhookVerifyToken: "",
  graphApiVersion: "v23.0",
  stravaClientId: "",
  stravaClientSecret: "",
  stravaScopes: "read,activity:read_all",
  mercadoPagoAccessToken: "",
  mercadoPagoPublicKey: "",
  mercadoPagoWebhookSecret: "",
  subscriptionNudgeMessage: "",
};

function mapPayloadToForm(payload: SettingsPayload): SettingsFormValues {
  return {
    fullName: payload.settings?.full_name || "",
    phone: payload.settings?.phone || "",
    email: payload.settings?.email || payload.userEmail || "",
    subscriptionPlan: payload.settings?.subscription_plan || "free",
    businessName: payload.settings?.business_name || payload.organizationName || "",
    businessPhone: payload.settings?.business_phone || "",
    phoneNumberId: payload.settings?.meta_phone_number_id || "",
    wabaId: payload.settings?.meta_waba_id || "",
    appId: payload.settings?.meta_app_id || "",
    appSecret: payload.settings?.meta_app_secret || "",
    systemToken: payload.settings?.meta_system_token || "",
    webhookVerifyToken: payload.settings?.meta_webhook_verify_token || "",
    graphApiVersion: payload.settings?.meta_graph_api_version || "v23.0",
    stravaClientId: payload.settings?.strava_client_id || "",
    stravaClientSecret: payload.settings?.strava_client_secret || "",
    stravaScopes:
      payload.settings?.strava_scopes?.join(",") || "read,activity:read_all",
    mercadoPagoAccessToken: payload.settings?.mercado_pago_access_token || "",
    mercadoPagoPublicKey: payload.settings?.mercado_pago_public_key || "",
    mercadoPagoWebhookSecret:
      payload.settings?.mercado_pago_webhook_secret || "",
    subscriptionNudgeMessage: payload.settings?.subscription_nudge_message || "",
  };
}

export function SettingsView() {
  const [form, setForm] = useState<SettingsFormValues>(defaultValues);
  const [organizationName, setOrganizationName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  };

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const response = await fetch("/api/settings");
        const data = (await response.json()) as SettingsPayload & {
          error?: string;
        };

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error("Somente o dono da assessoria pode acessar essas configuracoes.");
          }
          throw new Error(data.error || "Falha ao carregar configuracoes");
        }

        if (!cancelled) {
          setOrganizationName(data.organizationName || "");
          setForm(mapPayloadToForm(data));
        }
      } catch (error) {
        if (!cancelled) {
          if (
            error instanceof Error &&
            error.message.includes("Somente o dono da assessoria")
          ) {
            setAccessDenied(true);
          }
          console.error("Failed to load settings", error);
          setSaveMessage(
            error instanceof Error
              ? error.message
              : "Falha ao carregar configuracoes"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateField = <K extends keyof SettingsFormValues>(
    field: K,
    value: SettingsFormValues[K]
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setSaveMessage("");
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage("");

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.fullName,
          phone: form.phone,
          email: form.email,
          subscription_plan: form.subscriptionPlan,
          business_name: form.businessName,
          business_phone: form.businessPhone,
          meta_phone_number_id: form.phoneNumberId,
          meta_waba_id: form.wabaId,
          meta_app_id: form.appId,
          meta_app_secret: form.appSecret,
          meta_system_token: form.systemToken,
          meta_webhook_verify_token: form.webhookVerifyToken,
          meta_graph_api_version: form.graphApiVersion,
          strava_client_id: form.stravaClientId,
          strava_client_secret: form.stravaClientSecret,
          strava_scopes: form.stravaScopes
            .split(",")
            .map((scope) => scope.trim())
            .filter(Boolean),
          mercado_pago_access_token: form.mercadoPagoAccessToken,
          mercado_pago_public_key: form.mercadoPagoPublicKey,
          mercado_pago_webhook_secret: form.mercadoPagoWebhookSecret,
          subscription_nudge_message: form.subscriptionNudgeMessage,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Falha ao salvar configuracoes");
      }

      setSaveMessage("Configuracoes salvas para esta assessoria.");
    } catch (error) {
      setSaveMessage(
        error instanceof Error ? error.message : "Falha ao salvar configuracoes"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 size={28} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <Card className="border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)]">
            <CardHeader>
              <CardTitle className="text-xl text-slate-900">
                Acesso restrito
              </CardTitle>
              <CardDescription>
                Integracoes, credenciais e configuracoes da assessoria ficam
                disponiveis apenas para o usuario com papel de dono.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600">
                Se voce precisa alterar WhatsApp, Strava, Mercado Pago ou o
                plano da conta, entre com o usuario proprietario da
                organizacao.
              </p>
              {saveMessage ? (
                <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {saveMessage}
                </div>
              ) : null}
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => void handleSignOut()}
                >
                  <LogOut size={16} />
                  Sair da conta
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-y-auto p-4">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <Card className="border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)]">
          <CardHeader className="flex flex-col gap-3 border-b border-slate-100 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-xl text-slate-900">
                Configuracoes da assessoria
              </CardTitle>
              <CardDescription>
                Login isolado, dados isolados e integracoes proprias para{" "}
                <span className="font-medium text-slate-700">
                  {organizationName || "esta conta"}
                </span>
                .
              </CardDescription>
            </div>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-xl bg-slate-900 hover:bg-slate-800"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Salvar configuracoes
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Responsavel</Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(e) => updateField("fullName", e.target.value)}
                  placeholder="Ex: Ana Rodrigues"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="Ex: +55 11 99999-9999"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="seu@email.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.2)]">
          <CardHeader>
            <CardTitle>Plano</CardTitle>
            <CardDescription>
              Defina o plano dessa assessoria.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => updateField("subscriptionPlan", "free")}
                className={cn(
                  "rounded-2xl border px-4 py-4 text-left transition-colors",
                  form.subscriptionPlan === "free"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                <p className="text-sm font-semibold">Free</p>
                <p className="mt-1 text-xs opacity-80">
                  Plano basico da conta.
                </p>
              </button>

              <button
                type="button"
                onClick={() => updateField("subscriptionPlan", "premium")}
                className={cn(
                  "rounded-2xl border px-4 py-4 text-left transition-colors",
                  form.subscriptionPlan === "premium"
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                <p className="text-sm font-semibold">Premium</p>
                <p className="mt-1 text-xs opacity-80">
                  Conta com recursos avancados.
                </p>
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.2)]">
          <CardHeader>
            <CardTitle>WhatsApp Business</CardTitle>
            <CardDescription>
              Credenciais da Meta usadas apenas por esta assessoria.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="businessName">Nome do negocio</Label>
                <Input
                  id="businessName"
                  value={form.businessName}
                  onChange={(e) => updateField("businessName", e.target.value)}
                  placeholder="Ex: BoraRun Studio"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessPhone">Numero do WhatsApp Business</Label>
                <Input
                  id="businessPhone"
                  value={form.businessPhone}
                  onChange={(e) => updateField("businessPhone", e.target.value)}
                  placeholder="Ex: +55 11 98888-7777"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumberId">Phone Number ID</Label>
                <Input
                  id="phoneNumberId"
                  value={form.phoneNumberId}
                  onChange={(e) => updateField("phoneNumberId", e.target.value)}
                  placeholder="ID do numero conectado na Meta"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wabaId">WhatsApp Business Account ID</Label>
                <Input
                  id="wabaId"
                  value={form.wabaId}
                  onChange={(e) => updateField("wabaId", e.target.value)}
                  placeholder="WABA ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appId">Meta App ID</Label>
                <Input
                  id="appId"
                  value={form.appId}
                  onChange={(e) => updateField("appId", e.target.value)}
                  placeholder="App ID da Meta"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="graphApiVersion">Graph API Version</Label>
                <Input
                  id="graphApiVersion"
                  value={form.graphApiVersion}
                  onChange={(e) => updateField("graphApiVersion", e.target.value)}
                  placeholder="Ex: v23.0"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="appSecret">Meta App Secret</Label>
                <Input
                  id="appSecret"
                  type="password"
                  value={form.appSecret}
                  onChange={(e) => updateField("appSecret", e.target.value)}
                  placeholder="App Secret"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="systemToken">System User Access Token</Label>
                <Textarea
                  id="systemToken"
                  value={form.systemToken}
                  onChange={(e) => updateField("systemToken", e.target.value)}
                  placeholder="Token de acesso do usuario de sistema"
                  className="min-h-24"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="webhookVerifyToken">Webhook Verify Token</Label>
                <Input
                  id="webhookVerifyToken"
                  value={form.webhookVerifyToken}
                  onChange={(e) =>
                    updateField("webhookVerifyToken", e.target.value)
                  }
                  placeholder="Token usado para validar o webhook"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.2)]">
          <CardHeader>
            <CardTitle>Strava</CardTitle>
            <CardDescription>
              Credenciais OAuth do Strava para esta assessoria.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="stravaClientId">Strava Client ID</Label>
              <Input
                id="stravaClientId"
                value={form.stravaClientId}
                onChange={(e) => updateField("stravaClientId", e.target.value)}
                placeholder="Client ID do Strava"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stravaScopes">Scopes</Label>
              <Input
                id="stravaScopes"
                value={form.stravaScopes}
                onChange={(e) => updateField("stravaScopes", e.target.value)}
                placeholder="read,activity:read_all"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="stravaClientSecret">Strava Client Secret</Label>
              <Input
                id="stravaClientSecret"
                type="password"
                value={form.stravaClientSecret}
                onChange={(e) =>
                  updateField("stravaClientSecret", e.target.value)
                }
                placeholder="Client Secret do Strava"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.2)]">
          <CardHeader>
            <CardTitle>Mercado Pago</CardTitle>
            <CardDescription>
              Credenciais de pagamento do Mercado Pago para esta assessoria.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="mercadoPagoAccessToken">Access Token</Label>
              <Input
                id="mercadoPagoAccessToken"
                type="password"
                value={form.mercadoPagoAccessToken}
                onChange={(e) =>
                  updateField("mercadoPagoAccessToken", e.target.value)
                }
                placeholder="APP_USR-..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mercadoPagoPublicKey">Public Key</Label>
              <Input
                id="mercadoPagoPublicKey"
                value={form.mercadoPagoPublicKey}
                onChange={(e) =>
                  updateField("mercadoPagoPublicKey", e.target.value)
                }
                placeholder="APP_USR-..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mercadoPagoWebhookSecret">Webhook Secret</Label>
              <Input
                id="mercadoPagoWebhookSecret"
                type="password"
                value={form.mercadoPagoWebhookSecret}
                onChange={(e) =>
                  updateField("mercadoPagoWebhookSecret", e.target.value)
                }
                placeholder="Segredo de assinatura do webhook"
              />
              <p className="text-xs text-slate-400">
                Use o segredo configurado no painel de notificacoes do Mercado
                Pago para validar a autenticidade dos webhooks.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.2)]">
          <CardHeader>
            <CardTitle>Assinatura</CardTitle>
            <CardDescription>
              Mensagem enviada automaticamente quando um contato sem assinatura premium envia mensagem fora de um flow.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="subscriptionNudgeMessage">Mensagem para nao-assinantes</Label>
              <Textarea
                id="subscriptionNudgeMessage"
                rows={3}
                value={form.subscriptionNudgeMessage}
                onChange={(e) =>
                  updateField("subscriptionNudgeMessage", e.target.value)
                }
                placeholder="Para ter acompanhamento contínuo com a IA, assine o plano Premium! Envie 'assinar' para saber mais."
              />
              <p className="text-xs text-slate-400">
                Se vazio, usa a mensagem padrao.
              </p>
            </div>
          </CardContent>
        </Card>

        {saveMessage && (
          <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {saveMessage}
          </div>
        )}

        <div className="flex justify-end pb-4">
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => void handleSignOut()}
          >
            <LogOut size={16} />
            Sair da conta
          </Button>
        </div>
      </div>
    </div>
  );
}
