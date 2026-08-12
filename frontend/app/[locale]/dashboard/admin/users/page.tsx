"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Users, Plus, Loader2, Trash2, Pencil, Shield } from "lucide-react";
import { API_URL, cn } from "@/lib/utils";
import { FeatureBadge } from "@/components/shared/FeatureBadge";
import { cardSurfaceClass } from "@/components/ui/stat-card";
import { useAuth } from "@/components/providers/AuthProvider";
import { authHeaders, AuthUser } from "@/lib/auth";
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  type Permission,
} from "@/lib/permissions";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";

type UserRow = AuthUser;

export default function UserManagementPage() {
  const t = useTranslations("UserManagement");
  const tDash = useTranslations("Dashboard");
  const { user: currentUser, hasPermission } = useAuth();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

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
    if (hasPermission("users")) loadUsers();
  }, [hasPermission, loadUsers]);

  const updateUserPermissions = async (row: UserRow, permissions: Permission[]) => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/users/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ permissions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || t("update_error"));
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("update_error"));
    }
  };

  const toggleUserPermission = async (row: UserRow, perm: Permission) => {
    if (row.role === "admin") return;
    const next = row.permissions.includes(perm)
      ? row.permissions.filter((p) => p !== perm)
      : [...row.permissions, perm];
    await updateUserPermissions(row, next as Permission[]);
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
        body: JSON.stringify({
          role: nextRole,
          permissions: nextRole === "admin" ? ALL_PERMISSIONS : row.permissions,
        }),
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

  if (!hasPermission("users")) {
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
          type="button"
          onClick={() => setCreateOpen(true)}
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

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={loadUsers}
      />

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
                  <th className="text-start p-4 font-semibold">{t("permissions")}</th>
                  <th className="text-start p-4 font-semibold">{t("status")}</th>
                  <th className="text-end p-4 font-semibold">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => {
                  const isSelf = row.id === currentUser?.id;
                  return (
                    <tr key={row.id} className="border-t border-border align-top">
                      <td className="p-4 font-medium">{row.name || "—"}</td>
                      <td className="p-4">{row.email}</td>
                      <td className="p-4 capitalize">{row.role}</td>
                      <td className="p-4">
                        {row.role === "admin" ? (
                          <span className="text-xs text-muted-foreground">{t("all_permissions")}</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-w-md">
                            {ALL_PERMISSIONS.map((perm) => (
                              <button
                                key={perm}
                                type="button"
                                disabled={isSelf && perm === "users"}
                                onClick={() => toggleUserPermission(row, perm)}
                                className={cn(
                                  "px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors disabled:opacity-40",
                                  row.permissions.includes(perm)
                                    ? "bg-primary/15 text-primary border-primary/30"
                                    : "bg-muted/30 text-muted-foreground border-border"
                                )}
                              >
                                {PERMISSION_LABELS[perm]}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
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
