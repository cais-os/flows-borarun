"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export interface DbMessage {
  id: string;
  conversation_id: string;
  content: string;
  type: "text" | "image" | "file" | "audio" | "video" | "template" | "system";
  sender: "bot" | "contact" | "human" | "system";
  media_url: string | null;
  file_name: string | null;
  template_name: string | null;
  node_id: string | null;
  wa_message_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface DbConversationTag {
  id: string;
  name: string;
}

export interface DbConversation {
  id: string;
  contact_name: string;
  contact_phone: string;
  phone_number_id: string | null;
  status: "running" | "paused" | "completed" | "human" | "ai";
  current_node_id: string | null;
  created_at: string;
  updated_at: string;
  messages: DbMessage[];
  tags: DbConversationTag[];
}

export function useConversations() {
  const [conversations, setConversations] = useState<DbConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const orgIdRef = useRef<string | null>(null);

  const fetchConversationsSnapshot = useCallback(async (currentSelectedId: string | null) => {
    // RLS already filters by org, but we fetch orgId for realtime scoping
    if (!orgIdRef.current) {
      try {
        const res = await fetch("/api/me");
        if (res.ok) {
          const me = (await res.json()) as { organizationId: string };
          orgIdRef.current = me.organizationId;
        }
      } catch {
        // ignore — RLS still protects the queries below
      }
    }

    const { data: convs } = await supabase
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false });

    if (!convs) return null;

    if (convs.length === 0) {
      return {
        conversations: [] as DbConversation[],
        nextSelectedId: null as string | null,
      };
    }

    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .in(
        "conversation_id",
        convs.map((c) => c.id)
      )
      .order("created_at", { ascending: true });

    const { data: tagAssignments } = await supabase
      .from("conversation_tag_assignments")
      .select("conversation_id, tag_id")
      .in(
        "conversation_id",
        convs.map((c) => c.id)
      );

    const tagIds = Array.from(
      new Set((tagAssignments || []).map((assignment) => assignment.tag_id as string))
    );

    const { data: tagRows } = tagIds.length > 0
      ? await supabase
          .from("conversation_tags")
          .select("id, name")
          .in("id", tagIds)
      : { data: [] as DbConversationTag[] };

    const messagesByConv = new Map<string, DbMessage[]>();
    for (const msg of msgs || []) {
      const list = messagesByConv.get(msg.conversation_id) || [];
      list.push(msg as DbMessage);
      messagesByConv.set(msg.conversation_id, list);
    }

    const tagsById = new Map<string, DbConversationTag>();
    for (const tag of tagRows || []) {
      tagsById.set(tag.id as string, tag as DbConversationTag);
    }

    const tagsByConv = new Map<string, DbConversationTag[]>();
    for (const assignment of tagAssignments || []) {
      const tag = tagsById.get(assignment.tag_id as string);
      if (!tag) continue;

      const list = tagsByConv.get(assignment.conversation_id as string) || [];
      list.push(tag);
      tagsByConv.set(assignment.conversation_id as string, list);
    }

    const result: DbConversation[] = convs.map((c) => ({
      ...(c as Omit<DbConversation, "messages" | "tags">),
      messages: messagesByConv.get(c.id) || [],
      tags: (tagsByConv.get(c.id) || []).sort((left, right) =>
        left.name.localeCompare(right.name, "pt-BR")
      ),
    }));

    const nextSelectedId =
      currentSelectedId && result.some((conversation) => conversation.id === currentSelectedId)
        ? currentSelectedId
        : result[0]?.id || null;

    return {
      conversations: result,
      nextSelectedId,
    };
  }, []);

  const fetchConversations = useCallback(async () => {
    const snapshot = await fetchConversationsSnapshot(selectedId);
    if (!snapshot) return;

    setConversations(snapshot.conversations);
    if (snapshot.nextSelectedId !== selectedId) {
      setSelectedId(snapshot.nextSelectedId);
    }
    setLoading(false);
  }, [fetchConversationsSnapshot, selectedId]);

  useEffect(() => {
    let active = true;

    (async () => {
      const snapshot = await fetchConversationsSnapshot(selectedId);
      if (!active || !snapshot) return;

      setConversations(snapshot.conversations);
      if (snapshot.nextSelectedId !== selectedId) {
        setSelectedId(snapshot.nextSelectedId);
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [fetchConversationsSnapshot, selectedId]);

  // Realtime subscriptions — scoped by organization_id when available
  useEffect(() => {
    const orgId = orgIdRef.current;
    const convFilter = orgId
      ? `organization_id=eq.${orgId}`
      : undefined;

    const convChannel = supabase
      .channel("conversations-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          ...(convFilter ? { filter: convFilter } : {}),
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    const msgChannel = supabase
      .channel("messages-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          ...(convFilter ? { filter: convFilter } : {}),
        },
        (payload) => {
          const newMsg = payload.new as DbMessage;
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== newMsg.conversation_id) return c;
              // Deduplicate — avoid adding if already present
              if (c.messages.some((m) => m.id === newMsg.id)) return c;
              return { ...c, messages: [...c.messages, newMsg] };
            })
          );
        }
      )
      .subscribe();

    const tagsChannel = supabase
      .channel("conversation-tags-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_tags",
          ...(convFilter ? { filter: convFilter } : {}),
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    const tagAssignmentsChannel = supabase
      .channel("conversation-tag-assignments-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_tag_assignments",
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(convChannel);
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(tagsChannel);
      supabase.removeChannel(tagAssignmentsChannel);
    };
  }, [fetchConversations]);

  const selectedConversation = conversations.find((c) => c.id === selectedId) || null;

  return {
    conversations,
    selectedId,
    setSelectedId,
    selectedConversation,
    loading,
    refetch: fetchConversations,
  };
}
