"use client";

import React, { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { API_URL, cn } from "@/lib/utils";
import { authHeaders } from "@/lib/auth";
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  type Permission,
} from "@/lib/permissions";

const EMPTY_FORM = {
  email: "",
  password: "",
  name: "",
  role: "user" as "admin" | "user",
  permissions: [] as Permission[],
};

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateUserDialogProps) {
  const t = useTranslations("UserManagement");
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setError(null);
      setSaving(false);
    }
  }, [open]);

  const toggleFormPermission = (perm: Permission) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          ...form,
          permissions: form.role === "admin" ? ALL_PERMISSIONS : form.permissions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || t("create_error"));
      onCreated();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("create_error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !saving && onOpenChange(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label={t("cancel")}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
            className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-user-title"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <h2 id="create-user-title" className="text-lg font-bold tracking-tight">
                  {t("create_user")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("create_user_desc")}</p>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={saving}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                aria-label={t("cancel")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
              <div className="overflow-y-auto px-6 py-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label htmlFor="create-email" className="text-sm font-medium">
                    {t("email")}
                  </label>
                  <input
                    id="create-email"
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label htmlFor="create-password" className="text-sm font-medium">
                    {t("password")}
                  </label>
                  <input
                    id="create-password"
                    required
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="create-name" className="text-sm font-medium">
                    {t("name")}
                  </label>
                  <input
                    id="create-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="create-role" className="text-sm font-medium">
                    {t("role")}
                  </label>
                  <select
                    id="create-role"
                    value={form.role}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        role: e.target.value as "admin" | "user",
                        permissions:
                          e.target.value === "admin" ? [...ALL_PERMISSIONS] : form.permissions,
                      })
                    }
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="user">{t("role_user")}</option>
                    <option value="admin">{t("role_admin")}</option>
                  </select>
                </div>
              </div>

              {form.role !== "admin" ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t("permissions")}</p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_PERMISSIONS.filter((p) => p !== "users").map((perm) => (
                      <button
                        key={perm}
                        type="button"
                        onClick={() => toggleFormPermission(perm)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
                          form.permissions.includes(perm)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                        )}
                      >
                        {PERMISSION_LABELS[perm]}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("admin_all_permissions")}</p>
              )}

              {error ? (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">
                  {error}
                </p>
              ) : null}
              </div>

              <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {t("create_user")}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
