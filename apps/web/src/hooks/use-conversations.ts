"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
const PAGE_SIZE = 500;

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
  subscription_status: string | null;
  subscription_plan: string | null;
  subscription_expires_at: string | null;
  created_at: string;
  updated_at: string;
  messages: DbMessage[];
  tags: DbConversationTag[];
}

async function fetchAllPages<T>(
  loadPage: (from: number, to: number) => PromiseLike<{ data: T[] | null }>
) {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data } = await loadPage(from, to);

    if (!data || data.length === 0) {
      break;
    }

    rows.push(...data);

    if (data.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

export function useConversations() {
  const [conversations, setConversations] = useState<DbConversation[]>([]);
  const [selectedIdState, setSelectedIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const orgIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  const setSelectedId = useCallback((nextSelectedId: string | null) => {
    selectedIdRef.current = nextSelectedId;
    setSelectedIdState(nextSelectedId);
  }, []);

  const fetchConversationsSnapshot = useCallback(
    async (currentSelectedId: string | null) => {
      // RLS already filters by org, but we fetch orgId for realtime scoping.
      if (!orgIdRef.current) {
        try {
          const res = await fetch("/api/me");
          if (res.ok) {
            const me = (await res.json()) as { organizationId: string };
            orgIdRef.current = me.organizationId;
          }
        } catch {
          // Ignore errors here because the data queries are still protected by RLS.
        }
      }

      const convs = await fetchAllPages<DbConversation>((from, to) =>
        supabase
          .from("conversations")
          .select("*")
          .order("updated_at", { ascending: false })
          .range(from, to)
      );

      if (convs.length === 0) {
        return {
          conversations: [] as DbConversation[],
          nextSelectedId: null as string | null,
        };
      }

      const conversationIds = convs.map((conversation) => conversation.id);

      const msgs = await fetchAllPages<DbMessage>((from, to) =>
        supabase
          .from("messages")
          .select("*")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: true })
          .range(from, to)
      );

      const { data: tagAssignments } = await supabase
        .from("conversation_tag_assignments")
        .select("conversation_id, tag_id")
        .in("conversation_id", conversationIds);

      const tagIds = Array.from(
        new Set((tagAssignments || []).map((assignment) => assignment.tag_id as string))
      );

      const { data: tagRows } =
        tagIds.length > 0
          ? await supabase
              .from("conversation_tags")
              .select("id, name")
              .in("id", tagIds)
          : { data: [] as DbConversationTag[] };

      const messagesByConv = new Map<string, DbMessage[]>();
      for (const msg of msgs) {
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

      const result: DbConversation[] = convs.map((conversation) => ({
        ...(conversation as Omit<DbConversation, "messages" | "tags">),
        messages: messagesByConv.get(conversation.id) || [],
        tags: (tagsByConv.get(conversation.id) || []).sort((left, right) =>
          left.name.localeCompare(right.name, "pt-BR")
        ),
      }));

      const nextSelectedId =
        currentSelectedId &&
        result.some((conversation) => conversation.id === currentSelectedId)
          ? currentSelectedId
          : result[0]?.id || null;

      return {
        conversations: result,
        nextSelectedId,
      };
    },
    []
  );

  const fetchConversations = useCallback(async () => {
    const snapshot = await fetchConversationsSnapshot(selectedIdRef.current);
    if (!snapshot) return;

    setConversations(snapshot.conversations);
    if (snapshot.nextSelectedId !== selectedIdRef.current) {
      setSelectedId(snapshot.nextSelectedId);
    }
    setLoading(false);
  }, [fetchConversationsSnapshot, setSelectedId]);

  useEffect(() => {
    let active = true;

    (async () => {
      const snapshot = await fetchConversationsSnapshot(selectedIdRef.current);
      if (!active || !snapshot) return;

      setConversations(snapshot.conversations);
      if (snapshot.nextSelectedId !== selectedIdRef.current) {
        setSelectedId(snapshot.nextSelectedId);
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [fetchConversationsSnapshot, setSelectedId]);

  // Realtime subscriptions are scoped by organization_id when available.
  useEffect(() => {
    const orgId = orgIdRef.current;
    const convFilter = orgId ? `organization_id=eq.${orgId}` : undefined;

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
          void fetchConversations();
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
            prev.map((conversation) => {
              if (conversation.id !== newMsg.conversation_id) return conversation;
              if (conversation.messages.some((message) => message.id === newMsg.id)) {
                return conversation;
              }

              return {
                ...conversation,
                messages: [...conversation.messages, newMsg],
              };
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
          void fetchConversations();
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
          void fetchConversations();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(convChannel);
      void supabase.removeChannel(msgChannel);
      void supabase.removeChannel(tagsChannel);
      void supabase.removeChannel(tagAssignmentsChannel);
    };
  }, [fetchConversations]);

  const selectedConversation =
    conversations.find((conversation) => conversation.id === selectedIdState) || null;

  return {
    conversations,
    selectedId: selectedIdState,
    setSelectedId,
    selectedConversation,
    loading,
    refetch: fetchConversations,
  };
}
