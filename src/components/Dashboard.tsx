"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import type { OpenAppResponse } from "@/types";
import TopBar from "@/components/layout/TopBar";
import AppCard from "@/components/AppCard";
import {
  SessionSuccessModal,
  SessionPanel,
  DebugPanel,
} from "@/components/SessionPanel";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

import AdminPanel from "@/components/AdminPanel";

export default function Dashboard() {
  const { user, resources, fetchResources, lastOpenResult, sessions } = useApp();
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [resourceError, setResourceError] = useState<string | null>(null);
  const [modal, setModal] = useState<OpenAppResponse | null>(null);
  const [view, setView] = useState<"apps" | "admin">("apps");

  useEffect(() => {
    const load = async () => {
      setIsLoadingResources(true);
      setResourceError(null);
      try {
        await fetchResources();
      } catch (err) {
        setResourceError(err instanceof Error ? err.message : "Failed to load apps");
      } finally {
        setIsLoadingResources(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSessions = sessions.filter((s) => s.status === "active").length;

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <TopBar />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1
                className="text-2xl font-bold tracking-tight"
                style={{ color: "var(--color-text-primary)" }}
              >
                Welcome back, {user?.name?.split(" ")[0]}
              </h1>
              <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                {view === "apps" ? "Select an application to broker access" : "System administration and provisioning"}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {user?.role === "admin" && (
                <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setView("apps")}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      view === "apps"
                        ? "bg-indigo-600 text-white shadow-lg"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    User Dashboard
                  </button>
                  <button
                    onClick={() => setView("admin")}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      view === "admin"
                        ? "bg-indigo-600 text-white shadow-lg"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Admin Panel
                  </button>
                </div>
              )}
              {activeSessions > 0 && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm animate-pulse-ring"
                style={{
                  background: "var(--color-success-dim)",
                  border: "1px solid rgba(16,185,129,0.2)",
                  color: "var(--color-success)",
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: "var(--color-success)" }}
                />
                {activeSessions} active {activeSessions === 1 ? "session" : "sessions"}
              </div>
            )}
          </div>
          </div>
        </div>

        {view === "apps" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            {/* Apps grid */}
            <div className="lg:col-span-2 space-y-6">
              <div
                className="rounded-2xl p-5"
                style={{
                  background: "var(--color-surface-1)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div className="flex items-center justify-between mb-5">
                  <h2
                    className="text-sm font-semibold flex items-center gap-2"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    Available Applications
                    <Badge variant="info">{resources.length}</Badge>
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsLoadingResources(true);
                      fetchResources().finally(() => setIsLoadingResources(false));
                    }}
                    isLoading={isLoadingResources}
                  >
                    Refresh
                  </Button>
                </div>

                {resourceError && (
                  <div
                    className="text-sm px-4 py-3 rounded-xl mb-4"
                    style={{
                      background: "var(--color-error-dim)",
                      color: "var(--color-error)",
                    }}
                  >
                    {resourceError}
                  </div>
                )}

                {isLoadingResources ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-48 rounded-xl animate-pulse"
                        style={{ background: "var(--color-surface-3)" }}
                      />
                    ))}
                  </div>
                ) : resources.length === 0 ? (
                  <div
                    className="text-center py-12 text-sm"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    No applications available
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {resources.map((r) => (
                      <AppCard
                        key={r.id}
                        resource={r}
                        onOpen={(result) => setModal(result)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Sessions panel */}
              <SessionPanel />
            </div>

            {/* Sidebar */}
            <div className="space-y-5">
              {/* User card */}
              <div
                className="rounded-2xl p-5 animate-fade-in"
                style={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <h3
                  className="text-xs font-semibold uppercase tracking-wider mb-4"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Current User
                </h3>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                    style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
                  >
                    {user?.name?.charAt(0)}
                  </div>
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {user?.name}
                    </p>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {user?.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: "var(--color-text-muted)" }}>Role</span>
                  <Badge variant={user?.role ?? "user"}>{user?.role}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs mt-2">
                  <span style={{ color: "var(--color-text-muted)" }}>Access</span>
                  <span style={{ color: "var(--color-text-secondary)" }}>
                    {user?.allowedResourceKeys.includes("*")
                      ? "All apps"
                      : `${user?.allowedResourceKeys.length} app(s)`}
                  </span>
                </div>
              </div>

              {/* Debug panel */}
              <DebugPanel result={lastOpenResult} />

              {/* Architecture callout */}
              <div
                className="rounded-2xl p-5 text-xs space-y-2"
                style={{
                  background: "rgba(99,102,241,0.05)",
                  border: "1px solid rgba(99,102,241,0.15)",
                }}
              >
                <p className="font-semibold" style={{ color: "var(--color-brand-400)" }}>
                  Broker Flow
                </p>
                {[
                  "1. Validate user ACL",
                  "2. Select managed account",
                  "3. Fetch creds from Vault",
                  "4. POST creds → client backend",
                  "5. Client issues one-time token",
                  "6. Build redirect URL with token",
                  "7. Browser lands on client app",
                  "8. Client validates token → login",
                ].map((step) => (
                  <p key={step} style={{ color: "var(--color-text-secondary)" }}>
                    {step}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-fade-in">
            <AdminPanel />
          </div>
        )}
      </main>

      {/* Modal */}
      {modal && (
        <SessionSuccessModal result={modal} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
