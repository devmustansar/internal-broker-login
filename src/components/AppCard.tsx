"use client";

import { useState } from "react";
import type { Resource, OpenAppResponse } from "@/types";
import { useApp } from "@/lib/app-context";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

interface AppCardProps {
  resource: Resource;
  onOpen: (result: OpenAppResponse) => void;
}

const ENV_BADGE: Record<string, "active" | "info" | "pending"> = {
  production: "active",
  staging: "info",
  development: "pending",
};

const ADAPTER_LABELS: Record<string, string> = {
  form_login_basic: "Form Login",
  form_login_csrf: "Form + CSRF",
  json_login: "JSON API",
};

export default function AppCard({ resource, onOpen }: AppCardProps) {
  const { openApp } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await openApp(resource.resourceKey);
      // Auto-launch the app in a new tab using the one-time-token redirect URL
      if (result.redirectUrl) {
        window.open(result.redirectUrl, "_blank");
      }
      onOpen(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open app");
    } finally {
      setIsLoading(false);
    }
  };

  // Pick an icon letter from the app name
  const initials = resource.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const gradients = [
    "linear-gradient(135deg, #6366f1, #8b5cf6)",
    "linear-gradient(135deg, #0ea5e9, #6366f1)",
    "linear-gradient(135deg, #10b981, #0ea5e9)",
  ];
  const gradIdx = resource.id.charCodeAt(resource.id.length - 1) % gradients.length;

  return (
    <div
      className="group rounded-2xl p-5 flex flex-col gap-4 transition-all duration-200 hover:scale-[1.01] animate-fade-in"
      style={{
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-border)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.borderColor = "var(--color-border-active)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.borderColor = "var(--color-border)")
      }
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-sm font-bold"
          style={{ background: gradients[gradIdx] }}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className="font-semibold text-sm truncate"
            style={{ color: "var(--color-text-primary)" }}
          >
            {resource.name}
          </h3>
          {resource.description && (
            <p
              className="text-xs mt-0.5 line-clamp-1"
              style={{ color: "var(--color-text-muted)" }}
            >
              {resource.description}
            </p>
          )}
        </div>
        <Badge variant={ENV_BADGE[resource.environment] ?? "info"}>
          {resource.environment}
        </Badge>
      </div>

      {/* Meta */}
      <div className="space-y-1.5">
        <MetaRow label="App Host" value={resource.appHost} mono />
        <MetaRow label="API Host" value={resource.apiHost} mono />
        <MetaRow label="Auth" value={ADAPTER_LABELS[resource.loginAdapter]} />
      </div>

      {/* Error */}
      {error && (
        <div
          className="text-xs px-3 py-2 rounded-lg"
          style={{
            background: "var(--color-error-dim)",
            color: "var(--color-error)",
          }}
        >
          {error}
        </div>
      )}

      {/* Open button */}
      <Button
        id={`open-app-${resource.resourceKey}`}
        size="sm"
        isLoading={isLoading}
        onClick={handleOpen}
        className="mt-auto"
      >
        {isLoading ? "Opening…" : "Open App"}
      </Button>
    </div>
  );
}

function MetaRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className="w-16 flex-shrink-0"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label}
      </span>
      <span
        className={mono ? "font-mono truncate" : "truncate"}
        style={{ color: "var(--color-text-secondary)" }}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}
