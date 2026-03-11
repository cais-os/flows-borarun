import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getCurrentOrganizationContext } from "@/lib/organization";
import type { GeneralAnalytics } from "@/types/analytics";

export async function GET(request: Request) {
  try {
    const context = await getCurrentOrganizationContext();
    const supabase = await createSupabaseServer();
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    // --- Conversations ---
    let convQuery = supabase
      .from("conversations")
      .select("id, subscription_status, subscription_renewed_count, created_at", {
        count: "exact",
      })
      .eq("organization_id", context.organizationId);

    if (from) convQuery = convQuery.gte("created_at", from);
    if (to) convQuery = convQuery.lte("created_at", to);

    const { data: conversations, count: totalConversations } = await convQuery;

    // For "new" conversations in period, count those created within the range
    const newConversations = totalConversations || 0;

    // Total conversations (all time, no date filter)
    const { count: allTimeTotal } = await supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", context.organizationId);

    // --- Subscriptions (from all conversations, not just date-filtered) ---
    const { data: allConversations } = await supabase
      .from("conversations")
      .select("subscription_status, subscription_renewed_count")
      .eq("organization_id", context.organizationId);

    let active = 0;
    let expired = 0;
    let cancelled = 0;
    let renewed = 0;
    let notRenewed = 0;

    for (const conv of allConversations || []) {
      const status = conv.subscription_status as string;
      const renewCount = (conv.subscription_renewed_count as number) || 0;

      if (status === "active") active++;
      if (status === "expired") {
        expired++;
        if (renewCount > 0) {
          // Was renewed before but expired now
          notRenewed++;
        } else {
          notRenewed++;
        }
      }
      if (status === "cancelled") cancelled++;
      if (renewCount > 0) renewed += renewCount;
    }

    // --- Tags ---
    const { data: tagCounts } = await supabase
      .from("conversation_tag_assignments")
      .select("tag_id, conversation_tags(name)")
      .eq("conversation_tags.organization_id", context.organizationId);

    const tagMap = new Map<string, { name: string; count: number }>();
    for (const assignment of tagCounts || []) {
      const tag = assignment.conversation_tags as unknown as {
        name: string;
      } | null;
      if (!tag?.name) continue;
      const tagId = assignment.tag_id as string;
      const entry = tagMap.get(tagId) || { name: tag.name, count: 0 };
      entry.count++;
      tagMap.set(tagId, entry);
    }

    const tags = Array.from(tagMap.values()).sort(
      (a, b) => b.count - a.count
    );

    // --- Messages ---
    let msgQuery = supabase
      .from("messages")
      .select("sender")
      .in(
        "conversation_id",
        (conversations || []).map((c) => c.id)
      );

    // If no conversations in range, query all messages for the org
    if (!from && !to) {
      const { data: orgConvIds } = await supabase
        .from("conversations")
        .select("id")
        .eq("organization_id", context.organizationId);

      msgQuery = supabase
        .from("messages")
        .select("sender")
        .in(
          "conversation_id",
          (orgConvIds || []).map((c) => c.id as string)
        );
    }

    if (from) msgQuery = msgQuery.gte("created_at", from);
    if (to) msgQuery = msgQuery.lte("created_at", to);

    const { data: messages } = await msgQuery;

    let fromBot = 0;
    let fromContact = 0;
    let fromHuman = 0;

    for (const msg of messages || []) {
      if (msg.sender === "bot") fromBot++;
      else if (msg.sender === "contact") fromContact++;
      else if (msg.sender === "human") fromHuman++;
    }

    const result: GeneralAnalytics = {
      conversations: {
        total: allTimeTotal || 0,
        new: newConversations,
      },
      subscriptions: {
        active,
        expired,
        cancelled,
        renewed,
        notRenewed,
      },
      tags,
      messages: {
        total: fromBot + fromContact + fromHuman,
        fromBot,
        fromContact,
        fromHuman,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
