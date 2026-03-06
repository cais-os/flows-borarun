"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

export interface DbMessage {
  id: string;
  conversation_id: string;
  content: string;
  type: "text" | "image" | "file" | "audio" | "template" | "system";
  sender: "bot" | "contact" | "human" | "system";
  media_url: string | null;
  file_name: string | null;
  template_name: string | null;
  node_id: string | null;
  wa_message_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
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
}

export function useConversations() {
  const [conversations, setConversations] = useState<DbConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    const { data: convs } = await supabase
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false });

    if (!convs) return;

    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .in(
        "conversation_id",
        convs.map((c) => c.id)
      )
      .order("created_at", { ascending: true });

    const messagesByConv = new Map<string, DbMessage[]>();
    for (const msg of msgs || []) {
      const list = messagesByConv.get(msg.conversation_id) || [];
      list.push(msg as DbMessage);
      messagesByConv.set(msg.conversation_id, list);
    }

    const result: DbConversation[] = convs.map((c) => ({
      ...(c as Omit<DbConversation, "messages">),
      messages: messagesByConv.get(c.id) || [],
    }));

    setConversations(result);
    if (!selectedId && result.length > 0) {
      setSelectedId(result[0].id);
    }
    setLoading(false);
  }, [selectedId]);

  useEffect(() => {
    fetchConversations();

    // Realtime subscription for new conversations
    const convChannel = supabase
      .channel("conversations-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    // Realtime subscription for new messages
    const msgChannel = supabase
      .channel("messages-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new as DbMessage;
          setConversations((prev) =>
            prev.map((c) =>
              c.id === newMsg.conversation_id
                ? { ...c, messages: [...c.messages, newMsg] }
                : c
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(convChannel);
      supabase.removeChannel(msgChannel);
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
