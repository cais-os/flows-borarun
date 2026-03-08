"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Shortcut = {
  id: string;
  trigger: string;
  content: string;
  created_at: string;
  updated_at: string;
};

interface ShortcutsManagerProps {
  onClose: () => void;
}

export function ShortcutsManager({ onClose }: ShortcutsManagerProps) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [trigger, setTrigger] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchShortcuts = useCallback(async () => {
    try {
      const res = await fetch("/api/shortcuts");
      if (res.ok) {
        setShortcuts(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchShortcuts();
  }, [fetchShortcuts]);

  const handleSave = async () => {
    const trimmedTrigger = trigger.trim().toLowerCase().replace(/^\//, "");
    const trimmedContent = content.trim();
    if (!trimmedTrigger || !trimmedContent) return;

    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/shortcuts/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trigger: trimmedTrigger, content: trimmedContent }),
        });
        if (res.ok) {
          const updated = await res.json();
          setShortcuts((prev) =>
            prev.map((s) => (s.id === editingId ? updated : s))
          );
        }
      } else {
        const res = await fetch("/api/shortcuts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trigger: trimmedTrigger, content: trimmedContent }),
        });
        if (res.ok) {
          const created = await res.json();
          setShortcuts((prev) => [...prev, created].sort((a, b) => a.trigger.localeCompare(b.trigger)));
        }
      }
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (shortcut: Shortcut) => {
    setEditingId(shortcut.id);
    setTrigger(shortcut.trigger);
    setContent(shortcut.content);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/shortcuts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setShortcuts((prev) => prev.filter((s) => s.id !== id));
        if (editingId === id) resetForm();
      }
    } finally {
      setDeletingId(null);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setTrigger("");
    setContent("");
    setShowForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-base font-semibold text-gray-800">Atalhos de resposta</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : shortcuts.length === 0 && !showForm ? (
            <div className="py-12 text-center text-sm text-gray-400">
              Nenhum atalho criado ainda
            </div>
          ) : (
            <div className="space-y-2">
              {shortcuts.map((shortcut) => (
                <div
                  key={shortcut.id}
                  className="flex items-start gap-3 rounded-lg border border-gray-100 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800">
                      /{shortcut.trigger}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-400">
                      {shortcut.content}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => handleEdit(shortcut)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => void handleDelete(shortcut.id)}
                      disabled={deletingId === shortcut.id}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    >
                      {deletingId === shortcut.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Form */}
          {showForm && (
            <div className="mt-3 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">/</span>
                <Input
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value.replace(/\s/g, ""))}
                  placeholder="comando"
                  className="h-8 text-sm"
                />
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Conteúdo da resposta..."
                rows={3}
                className="w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
              />
              <div className="flex items-center justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={() => void handleSave()}
                  disabled={saving || !trigger.trim() || !content.trim()}
                >
                  {saving ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : null}
                  {editingId ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showForm && (
          <div className="border-t px-5 py-3">
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
            >
              <Plus size={14} className="mr-1" />
              Novo atalho
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
