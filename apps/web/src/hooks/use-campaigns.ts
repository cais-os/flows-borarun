"use client";

import { useEffect, useState, useCallback } from "react";

export interface Campaign {
  id: string;
  name: string;
  template_name: string | null;
  template_id: string | null;
  template_language: string;
  body_variables: string[];
  header_variables: string[];
  recipients: Array<{
    phone: string;
    name?: string;
    variables?: Record<string, string>;
  }>;
  status: "draft" | "scheduled" | "sending" | "sent" | "failed";
  scheduled_at: string | null;
  sent_at: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
}

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    const res = await fetch("/api/campanhas");
    if (res.ok) {
      const data = await res.json();
      setCampaigns(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const createCampaign = useCallback(
    async (name: string) => {
      const res = await fetch("/api/campanhas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const campaign = await res.json();
        setCampaigns((prev) => [campaign, ...prev]);
        setSelectedId(campaign.id);
        return campaign as Campaign;
      }
      return null;
    },
    []
  );

  const updateCampaign = useCallback(
    async (id: string, updates: Partial<Campaign>) => {
      const res = await fetch(`/api/campanhas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        setCampaigns((prev) =>
          prev.map((c) => (c.id === id ? updated : c))
        );
        return updated as Campaign;
      }
      return null;
    },
    []
  );

  const deleteCampaign = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/campanhas/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCampaigns((prev) => prev.filter((c) => c.id !== id));
        if (selectedId === id) setSelectedId(null);
      }
    },
    [selectedId]
  );

  const sendCampaign = useCallback(async (id: string) => {
    const res = await fetch(`/api/campanhas/${id}/send`, { method: "POST" });
    if (res.ok) {
      const result = await res.json();
      await fetchCampaigns();
      return result as { sent: number; failed: number };
    }
    return null;
  }, [fetchCampaigns]);

  const selectedCampaign = campaigns.find((c) => c.id === selectedId) || null;

  return {
    campaigns,
    selectedId,
    setSelectedId,
    selectedCampaign,
    loading,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    sendCampaign,
    refetch: fetchCampaigns,
  };
}
