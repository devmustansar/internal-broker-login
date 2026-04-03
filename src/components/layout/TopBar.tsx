"use client";

import { useApp } from "@/lib/app-context";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

export default function TopBar() {
  const { user, logout } = useApp();

  return (
    <header
      style={{
        background: "rgba(13,17,23,0.8)",
        borderBottom: "1px solid var(--color-border)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
      className="sticky top-0 z-50"
    >
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            ICB
          </div>
          <span
            className="text-sm font-semibold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            Internal Credentials Broker
          </span>
          <span
            className="hidden sm:inline-block text-xs px-1.5 py-0.5 rounded"
            style={{
              background: "var(--color-surface-3)",
              color: "var(--color-text-secondary)",
            }}
          >
            POC
          </span>
        </div>

        {/* Right side */}
        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "var(--color-brand-600)", color: "white" }}
              >
                {user.name.charAt(0)}
              </div>
              <span style={{ color: "var(--color-text-secondary)" }} className="text-sm">
                {user.name}
              </span>
              <Badge variant={user.role}>{user.role}</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={logout}>
              Sign out
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
