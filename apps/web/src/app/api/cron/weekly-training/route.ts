import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerClient } from "@/lib/supabase/server";
import {
  getMetaConfigFromSettings,
  sendMetaWhatsAppTextMessage,
} from "@/lib/meta";
import { getOrganizationSettingsById } from "@/lib/organization";
import { buildStravaCoachContext } from "@/lib/strava";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const maxDuration = 60;

const WEEKLY_PROMPT = `Voce e um treinador de corrida. Com base no plano de treino do atleta, no resumo interno de coaching, nos dados do Strava da ultima semana e no historico de conversa, gere os treinos atualizados para esta semana.

Regras:
- Adapte com base no que realmente foi feito na ultima semana (Strava)
- Considere o que foi discutido no chat (fadiga, dor, motivacao)
- Mantenha coerencia com o plano original
- Seja especifico: dia, tipo de treino, distancia, pace, RPE
- Use portugues brasileiro, formato conciso para WhatsApp (max 4 paragrafos)
- Inclua dias de descanso

Responda APENAS com os treinos da semana formatados para WhatsApp.`;

function getNowBrazil(): Date {
  const now = new Date();
  const brStr = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  return new Date(brStr);
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const now = getNowBrazil();
  const todayDayOfWeek = String(now.getDay()); // 0=Sunday, 1=Monday, etc.
  const currentHour = now.getHours();

  // Find conversations with weekly training enabled and matching today's day
  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, contact_phone, phone_number_id, organization_id, flow_variables, subscription_status")
    .eq("subscription_status", "active");

  if (!conversations || conversations.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  let processed = 0;

  for (const conv of conversations) {
    const vars = (conv.flow_variables as Record<string, string>) || {};

    // Check if weekly training is enabled and today is the right day
    if (vars._weekly_training_enabled !== "true") continue;
    if (vars._weekly_training_day !== todayDayOfWeek) continue;

    // Check if we already sent today
    const lastSent = vars._last_weekly_training_sent;
    if (lastSent) {
      const lastDate = new Date(lastSent);
      const diffHours = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
      if (diffHours < 20) continue; // Skip if sent less than 20 hours ago
    }

    // Check preferred hour (allow 1 hour window)
    const preferredHour = parseInt(vars._weekly_training_hour?.split(":")[0] || "8", 10);
    if (Math.abs(currentHour - preferredHour) > 1) continue;

    try {
      const settings = await getOrganizationSettingsById(conv.organization_id);
      const { config: metaConfig } = getMetaConfigFromSettings(settings);

      // Build context for AI
      const stravaContext = await buildStravaCoachContext(supabase, conv.id);
      const trainingPlan = vars._training_plan ? JSON.parse(vars._training_plan) : null;
      const coachingSummary = vars._coaching_summary ? JSON.parse(vars._coaching_summary) : null;

      // Get recent chat messages for context
      const { data: recentMsgs } = await supabase
        .from("messages")
        .select("content, sender, created_at")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(15);

      const chatContext = (recentMsgs || [])
        .reverse()
        .map((m) => `[${m.sender}] ${(m.content || "").substring(0, 100)}`)
        .join("\n");

      // Calculate current week
      const planGeneratedAt = vars._plan_generated_at;
      let weekNumber = 1;
      if (planGeneratedAt) {
        const diffDays = Math.floor((now.getTime() - new Date(planGeneratedAt).getTime()) / (24 * 60 * 60 * 1000));
        weekNumber = Math.floor(diffDays / 7) + 1;
      }

      const userContent = [
        trainingPlan ? `Plano de treino:\n${JSON.stringify(trainingPlan, null, 2).substring(0, 2000)}` : "",
        coachingSummary ? `Resumo de coaching:\n${JSON.stringify(coachingSummary, null, 2)}` : "",
        `Semana atual: ${weekNumber}`,
        stravaContext ? `Dados do Strava:\n${stravaContext}` : "Sem dados do Strava",
        chatContext ? `Chat recente:\n${chatContext}` : "",
      ].filter(Boolean).join("\n\n");

      const completion = await openai.chat.completions.create({
        model: "gpt-5.4-mini",
        messages: [
          { role: "system", content: WEEKLY_PROMPT },
          { role: "user", content: userContent },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      const weeklyTraining = completion.choices[0]?.message?.content;
      if (!weeklyTraining) continue;

      // Send via WhatsApp
      const result = await sendMetaWhatsAppTextMessage(
        { to: conv.contact_phone, body: weeklyTraining },
        metaConfig
      );

      await supabase.from("messages").insert({
        conversation_id: conv.id,
        content: weeklyTraining,
        type: "text",
        sender: "bot",
        wa_message_id: result.messageId,
      });

      // Mark as sent
      vars._last_weekly_training_sent = now.toISOString();
      await supabase
        .from("conversations")
        .update({ flow_variables: vars })
        .eq("id", conv.id);

      processed++;
    } catch (error) {
      console.error(`[weekly-training] Failed for conversation ${conv.id}:`, error);
    }
  }

  return NextResponse.json({ processed });
}
