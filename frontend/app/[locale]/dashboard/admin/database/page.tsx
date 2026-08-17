"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { 
  Database, Loader2, Shield, Trash2, Download, Upload, AlertTriangle, CheckCircle 
} from "lucide-react";
import { API_URL, cn } from "@/lib/utils";
import { FeatureBadge } from "@/components/shared/FeatureBadge";
import { cardSurfaceClass } from "@/components/ui/stat-card";
import { useAuth } from "@/components/providers/AuthProvider";
import { authHeaders } from "@/lib/auth";
import { Checkbox } from "@/components/ui/checkbox";

interface TableInfo {
  name: string;
  rows: number;
  error?: string;
}

type DialogMode = "clean_manager" | "export" | "import" | null;

interface ImportResult {
  message: string;
  filename: string;
  tablesCount: number;
  totalRows: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DatabaseManagementPage() {
  const t = useTranslations("DatabaseSettings");
  const tDash = useTranslations("Dashboard");
  const { hasPermission } = useAuth();

  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Table selection state
  const [selectedTables, setSelectedTables] = useState<string[]>([]);

  // Dialog / Password validation states
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [password, setPassword] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Protected system tables that cannot be deleted manually
  const protectedTables = ["users", "schema_meta"];

  const loadTables = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/db-admin/tables`, {
        headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to load database tables.");
      }
      const data = await res.json();
      setTables(data.tables || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load database tables.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasPermission("users")) {
      loadTables();
    }
  }, [hasPermission, loadTables]);

  const handleSelectTable = (tableName: string) => {
    if (protectedTables.includes(tableName)) return; // protected
    setSelectedTables(prev => 
      prev.includes(tableName) 
        ? prev.filter(t => t !== tableName) 
        : [...prev, tableName]
    );
  };

  const handleSelectAll = () => {
    const clearable = tables
      .map(t => t.name)
      .filter(name => !protectedTables.includes(name));

    if (selectedTables.length === clearable.length) {
      setSelectedTables([]);
    } else {
      setSelectedTables(clearable);
    }
  };

  const openConfirmation = (mode: DialogMode) => {
    setDialogMode(mode);
    setPassword("");
    setDialogError(null);
    setActionStatus(null);
    setImportResult(null);
  };

  const closeConfirmation = () => {
    setDialogMode(null);
    setPassword("");
    setDialogError(null);
    setActionLoading(false);
    setActionStatus(null);
    setImportResult(null);
  };

  const finishImport = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    closeConfirmation();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleConfirmClean = async () => {
    if (!password) {
      setDialogError("Password is required.");
      return;
    }

    if (selectedTables.length === 0) {
      setDialogError("Select at least one table to clean.");
      return;
    }

    setDialogError(null);
    setActionLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/db-admin/clean`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          password,
          tables: selectedTables,
          clean_all: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || t("error_password"));

      setSuccessMsg(t("success_clean"));
      setSelectedTables([]);
      await loadTables();
      closeConfirmation();
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : "Clean failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setDialogError("Password is required.");
      return;
    }

    setDialogError(null);
    setActionLoading(true);

    try {
      if (dialogMode === "export") {
        const res = await fetch(`${API_URL}/api/db-admin/backup/export`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify({ password }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.detail || t("error_password"));
        }

        const downloadUrl = `${API_URL}${data.download_url}`;
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = data.filename || `pharmatcher_backup_${Date.now()}.db`;
        document.body.appendChild(a);
        a.click();
        a.remove();

        setSuccessMsg("Database backup download started.");
        closeConfirmation();
      } 
      else if (dialogMode === "import") {
        if (!selectedFile) {
          setDialogError("Please select a file to import.");
          setActionLoading(false);
          return;
        }

        setActionStatus(t("import_uploading"));

        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("password", password);

        const res = await fetch(`${API_URL}/api/db-admin/backup/import`, {
          method: "POST",
          headers: authHeaders(),
          body: formData,
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || t("error_password"));

        const result: ImportResult = {
          message: data.message || t("success_import"),
          filename: data.filename || selectedFile.name,
          tablesCount: data.tables_count ?? 0,
          totalRows: data.total_rows ?? 0,
        };

        setImportResult(result);
        setSuccessMsg(
          t("import_success_detail", {
            filename: result.filename,
            tablesCount: result.tablesCount,
            totalRows: result.totalRows.toLocaleString(),
          })
        );
        await loadTables();
      }
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  if (!hasPermission("users")) {
    return (
      <div className={cn(cardSurfaceClass, "p-10 text-center text-muted-foreground flex flex-col items-center justify-center gap-4")}>
        <Shield className="w-12 h-12 text-error animate-pulse" />
        <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">{t("forbidden")}</h3>
      </div>
    );
  }

  const clearableTables = tables.filter(t => !protectedTables.includes(t.name));
  const sortedTables = [...tables].sort((a, b) => {
    const aProtected = protectedTables.includes(a.name);
    const bProtected = protectedTables.includes(b.name);
    if (aProtected !== bProtected) return aProtected ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="w-full min-w-0 space-y-8 pb-12">
      {/* Header */}
      <div className="space-y-4 text-start">
        <FeatureBadge icon={Database} label={t("badge_database")} />
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {t("title")}
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 max-w-2xl">
          {t("description")}
        </p>
      </div>

      {successMsg && (
        <div className="p-4 bg-success/10 border border-success/20 rounded-2xl flex items-center gap-3 text-success text-sm font-semibold animate-fade-in">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
          <button 
            onClick={() => setSuccessMsg(null)}
            className="ml-auto text-xs font-black uppercase hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3 Columns Grid of Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Card 1: Clean Database */}
        <div className={cn(cardSurfaceClass, "p-6 space-y-4 flex flex-col justify-between h-[280px]")}>
          <div className="space-y-3">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <Trash2 className="w-5 h-5 text-error" />
              <h3 className="font-bold text-lg text-zinc-800 dark:text-zinc-200">{t("clean_db")}</h3>
            </div>
            <p className="text-xs font-medium text-zinc-400 leading-relaxed">
              Choose specific database tables to wipe, or perform a system-wide clean (excluding user accounts and meta properties).
            </p>
          </div>
          <button
            onClick={() => openConfirmation("clean_manager")}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-error/10 hover:bg-error hover:text-white border border-error/20 hover:border-transparent text-error font-bold text-sm transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Open Clean Manager
          </button>
        </div>

        {/* Card 2: Export Backup */}
        <div className={cn(cardSurfaceClass, "p-6 space-y-4 flex flex-col justify-between h-[280px]")}>
          <div className="space-y-3">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <Download className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-lg text-zinc-800 dark:text-zinc-200">{t("export_db")}</h3>
            </div>
            <p className="text-xs font-medium text-zinc-400 leading-relaxed">
              Export the current unified SQLite database catalog, normalizer entities, and jobs list as a downloadable backup file (.db).
            </p>
          </div>
          <button
            onClick={() => openConfirmation("export")}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-sm transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-primary" />
            Download Database Backup
          </button>
        </div>

        {/* Card 3: Import Backup */}
        <div className={cn(cardSurfaceClass, "p-6 space-y-4 flex flex-col justify-between min-h-[280px]")}>
          <div className="space-y-3">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <Upload className="w-5 h-5 text-warning" />
              <h3 className="font-bold text-lg text-zinc-800 dark:text-zinc-200">{t("import_db")}</h3>
            </div>
            <p className="text-xs font-medium text-zinc-400 leading-relaxed">
              Upload and restore a database from a previous SQLite backup file. WARNING: This replaces the active database entirely.
            </p>
            <div className="pt-2 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".db"
                onChange={handleFileChange}
                className="block w-full text-[10px] text-zinc-500
                  file:mr-3 file:py-1.5 file:px-3
                  file:rounded-lg file:border-0
                  file:text-[10px] file:font-semibold
                  file:bg-primary/10 file:text-primary
                  hover:file:bg-primary/20
                  file:cursor-pointer cursor-pointer border border-dashed border-border p-1.5 rounded-xl"
              />
              {selectedFile && (
                <p className="text-[11px] font-semibold text-primary">
                  {t("import_file_selected", {
                    filename: selectedFile.name,
                    size: formatFileSize(selectedFile.size),
                  })}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => openConfirmation("import")}
            disabled={!selectedFile}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm transition-all hover:bg-primary-dark shadow-md shadow-primary/15 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Upload & Restore DB
          </button>
        </div>

      </div>

      {/* Confirmation & Clean Dialogs */}
      {dialogMode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            onClick={() => {
              if (actionLoading || (dialogMode === "import" && importResult)) return;
              closeConfirmation();
            }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {dialogMode === "clean_manager" ? (
            /* Clean Manager Dialog */
            <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden z-10 p-6 space-y-6 flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2 text-error">
                  <span className="p-2 bg-error/10 rounded-xl">
                    <Trash2 className="w-5 h-5 text-error" />
                  </span>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                    Clean Database Manager
                  </h2>
                </div>
                {clearableTables.length > 0 && (
                  <button
                    onClick={handleSelectAll}
                    className="text-xs font-bold text-primary hover:underline uppercase tracking-wider"
                  >
                    {selectedTables.length === clearableTables.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <p className="text-sm text-zinc-400 font-medium">Fetching tables status...</p>
                </div>
              ) : tables.length === 0 ? (
                <p className="text-sm text-zinc-500 py-10 text-center">No tables discovered in SQLite database.</p>
              ) : (
                <div className="divide-y divide-border overflow-y-auto pr-2 scrollbar-thin max-h-[300px]">
                  {sortedTables.map((table) => {
                    const isProtected = protectedTables.includes(table.name);
                    const isChecked = selectedTables.includes(table.name);

                    return (
                      <div 
                        key={table.name} 
                        onClick={isProtected ? undefined : () => handleSelectTable(table.name)}
                        className={cn(
                          "flex items-center justify-between py-3.5 px-3 transition-all rounded-xl",
                          isProtected 
                            ? "cursor-default opacity-50 bg-zinc-50/50 dark:bg-black/10" 
                            : "cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {isProtected ? (
                            <Shield className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                          ) : (
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => handleSelectTable(table.name)}
                            />
                          )}
                          <div>
                            <p className="font-medium text-sm text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                              {table.name}
                              {isProtected && (
                                <span className="text-[9px] font-black uppercase bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded border border-border">
                                  PROTECTED
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                            {table.rows.toLocaleString()} {t("rows_count")}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Password authorization form at bottom of manager */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Enter Password to Authorize Clean Action
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("password_placeholder")}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-error/20 focus:border-error outline-none transition-all text-sm font-medium"
                  />
                </div>

                {dialogError && (
                  <div className="p-3.5 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-semibold">
                    {dialogError}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={closeConfirmation}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-3 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-xs font-bold text-zinc-650 dark:text-zinc-300 transition-colors disabled:opacity-50 cursor-pointer outline-none"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={selectedTables.length === 0 || actionLoading}
                    onClick={handleConfirmClean}
                    className="flex-1 px-4 py-3 bg-error hover:bg-error/95 text-white rounded-xl text-xs font-bold shadow-lg shadow-error/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Clean Selected (${selectedTables.length})`}
                  </button>
                </div>
              </div>
            </div>
          ) : importResult && dialogMode === "import" ? (
            <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden z-10 p-6 space-y-6">
              <div className="flex items-center gap-2 text-success">
                <span className="p-2 bg-success/10 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-success" />
                </span>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  {t("import_success_title")}
                </h2>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  {importResult.message}
                </p>
                <div className="p-4 bg-success/5 border border-success/20 rounded-xl space-y-2">
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100 break-all">
                    {importResult.filename}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t("import_success_detail", {
                      filename: importResult.filename,
                      tablesCount: importResult.tablesCount,
                      totalRows: importResult.totalRows.toLocaleString(),
                    })}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={finishImport}
                className="w-full px-4 py-3 bg-primary hover:bg-primary-dark text-primary-foreground rounded-xl text-xs font-bold shadow-lg shadow-primary/20 transition-all cursor-pointer"
              >
                {t("import_done")}
              </button>
            </div>
          ) : actionLoading && dialogMode === "import" ? (
            <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden z-10 p-6 space-y-6">
              <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <div className="space-y-2">
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                    {t("import_db")}
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs">
                    {actionStatus || t("import_uploading")}
                  </p>
                  {selectedFile && (
                    <p className="text-xs font-semibold text-primary break-all">
                      {selectedFile.name} ({formatFileSize(selectedFile.size)})
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Backup Actions Confirmation Modal (Export/Import) */
            <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden z-10 p-6 space-y-6">
              <div className="flex items-center gap-2 text-warning">
                <span className="p-2 bg-warning/10 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                </span>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  {t("confirm_title")}
                </h2>
              </div>

              <div className="space-y-3">
                {dialogMode === "import" && selectedFile && (
                  <div className="p-3.5 bg-warning/5 border border-warning/20 rounded-xl">
                    <p className="text-xs text-warning font-bold">
                      This will replace your current DB file with the uploaded copy ({selectedFile.name}).
                    </p>
                  </div>
                )}
                {dialogMode === "export" && (
                  <p className="text-xs text-zinc-400">
                    You are downloading a complete SQLite copy of the application database.
                  </p>
                )}

                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                  {t("confirm_description")}
                </p>
              </div>

              <form onSubmit={handleConfirmAction} className="space-y-4">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("password_placeholder")}
                  autoFocus
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm font-medium"
                />

                {dialogError && (
                  <div className="p-3.5 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-semibold">
                    {dialogError}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeConfirmation}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-3 border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-xs font-bold text-zinc-650 dark:text-zinc-300 transition-colors disabled:opacity-50 cursor-pointer outline-none"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex-1 px-4 py-3 bg-primary hover:bg-primary-dark text-primary-foreground rounded-xl text-xs font-bold shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {actionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      t("confirm")
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
