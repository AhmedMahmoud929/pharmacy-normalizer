"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Users, Plus, Loader2, Shield, Trash2, Pencil } from "lucide-react";
import { motion } from "framer-motion";
import { API_URL, cn } from "@/lib/utils";
import { FeatureBadge } from "@/components/shared/FeatureBadge";
import { cardSurfaceClass } from "@/components/ui/stat-card";
import { useAuth } from "@/components/providers/AuthProvider";
import { authHeaders, AuthUser } from "@/lib/auth";

type UserRow = AuthUser;

export default function UserManagementPage() {
  const t = useTranslations("UserManagement");
  const tDash = useTranslations("Dashboard");
  const { user: currentUser, isAdmin } = useAuth();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    role: "user" as "admin" | "user",
  });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/users`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || t("load_error"));
      setUsers(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("load_error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin, loadUsers]);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || t("create_error"));
      setShowCreate(false);
      setForm({ email: "", password: "", name: "", role: "user" });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("create_error"));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: UserRow) => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/users/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ is_active: !row.is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || t("update_error"));
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("update_error"));
    }
  };

  const toggleRole = async (row: UserRow) => {
    setError(null);
    const nextRole = row.role === "admin" ? "user" : "admin";
    try {
      const res = await fetch(`${API_URL}/api/auth/users/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ role: nextRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || t("update_error"));
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("update_error"));
    }
  };

  const deleteUser = async (row: UserRow) => {
    if (!confirm(t("delete_confirm", { email: row.email }))) return;
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/users/${row.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || t("delete_error"));
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("delete_error"));
    }
  };

  if (!isAdmin) {
    return (
      <div className={cn(cardSurfaceClass, "p-10 text-center text-muted-foreground")}>
        {t("forbidden")}
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-4 text-start">
          <FeatureBadge icon={Users} label={tDash("badge_users")} />
          <h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground max-w-2xl">{t("description")}</p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
        >
          <Plus className="w-4 h-4" />
          {t("add_user")}
        </button>
      </div>

      {error ? (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
          {error}
        </p>
      ) : null}

      {showCreate ? (
        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={createUser}
          className={cn(cardSurfaceClass, "p-6 grid grid-cols-1 md:grid-cols-2 gap-4")}
        >
          <input
            required
            type="email"
            placeholder={t("email")}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
          />
          <input
            required
            type="password"
            placeholder={t("password")}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
          />
          <input
            type="text"
            placeholder={t("name")}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "user" })}
            className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
          >
            <option value="user">{t("role_user")}</option>
            <option value="admin">{t("role_admin")}</option>
          </select>
          <div className="md:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-xl border border-border text-sm"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {t("create_user")}
            </button>
          </div>
        </motion.form>
      ) : null}

      <div className={cn(cardSurfaceClass, "overflow-hidden")}>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-start p-4 font-semibold">{t("name")}</th>
                  <th className="text-start p-4 font-semibold">{t("email")}</th>
                  <th className="text-start p-4 font-semibold">{t("role")}</th>
                  <th className="text-start p-4 font-semibold">{t("status")}</th>
                  <th className="text-end p-4 font-semibold">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => {
                  const isSelf = row.id === currentUser?.id;
                  return (
                    <tr key={row.id} className="border-t border-border">
                      <td className="p-4 font-medium">{row.name || "—"}</td>
                      <td className="p-4">{row.email}</td>
                      <td className="p-4 capitalize">{row.role}</td>
                      <td className="p-4">
                        <span
                          className={cn(
                            "inline-flex px-2 py-0.5 rounded-full text-xs font-semibold",
                            row.is_active
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {row.is_active ? t("active") : t("inactive")}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => toggleRole(row)}
                            className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40"
                            title={t("toggle_role")}
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => toggleActive(row)}
                            className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40"
                            title={t("toggle_active")}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => deleteUser(row)}
                            className="p-2 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-40"
                            title={t("delete_user")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
