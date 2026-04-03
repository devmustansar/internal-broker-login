"use client";

import type { OpenAppResponse, BrokerSession } from "@/types";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useApp } from "@/lib/app-context";
import { useState } from "react";

interface SessionSuccessModalProps {
  result: OpenAppResponse;
  onClose: () => void;
}

export function SessionSuccessModal({ result, onClose }: SessionSuccessModalProps) {
  const timeLeft = Math.max(
    0,
    Math.floor((new Date(result.expiresAt).getTime() - Date.now()) / 1000 / 60)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 animate-fade-in"
        style={{
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 0 60px rgba(99,102,241,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Success icon */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
            style={{ background: "var(--color-success-dim)", color: "var(--color-success)" }}
          >
            ✓
          </div>
          <div>
            <h2
              className="text-base font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Broker Session Created
            </h2>
            <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
              Access has been brokered successfully
            </p>
          </div>
          <Badge variant="active" className="ml-auto">
            {result.status}
          </Badge>
        </div>

        <div
          className="rounded-xl p-4 space-y-3 mb-5"
          style={{ background: "var(--color-surface-3)" }}
        >
          <DataRow label="Session ID" value={result.brokerSessionId} mono copy />
          <DataRow label="Resource" value={result.resourceKey} />
          <DataRow label="App Host" value={result.appHost} mono />
          <DataRow label="API Host" value={result.apiHost} mono />
          <DataRow
            label="Expires"
            value={`${new Date(result.expiresAt).toLocaleTimeString()} (~${timeLeft}m)`}
          />
        </div>

        <div className="flex gap-3">
          {result.redirectUrl ? (
            <Button
              onClick={() => {
                window.open(result.redirectUrl, "_blank");
                onClose();
              }}
              className="w-full justify-center"
            >
              🚀 Launch App
            </Button>
          ) : result.handoffToken ? (
            // legacy proxy fallback
            <Button
              onClick={() => {
                const host = result.appHost.replace(/^https?:\/\//, "");
                window.open(`https://${host}/_proxy/bootstrap?token=${result.handoffToken}`, "_blank");
                onClose();
              }}
              className="w-full justify-center"
            >
              Open App in New Tab
            </Button>
          ) : null}
          <Button onClick={onClose} variant="ghost" className="w-full justify-center">
            Close
          </Button>
        </div>

      </div>
    </div>
  );
}

// ─── Session List Panel ───────────────────────────────────────────────────────

export function SessionPanel() {
  const { sessions, endSession } = useApp();
  const [ending, setEnding] = useState<string | null>(null);

  if (sessions.length === 0) return null;

  const handleEnd = async (id: string) => {
    setEnding(id);
    try {
      await endSession(id);
    } finally {
      setEnding(null);
    }
  };

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "var(--color-surface-1)",
        border: "1px solid var(--color-border)",
      }}
    >
      <h2
        className="text-sm font-semibold mb-4 flex items-center gap-2"
        style={{ color: "var(--color-text-primary)" }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: "var(--color-success)" }}
        />
        Active Sessions
        <span
          className="ml-auto text-xs font-normal px-2 py-0.5 rounded-full"
          style={{
            background: "var(--color-surface-3)",
            color: "var(--color-text-secondary)",
          }}
        >
          {sessions.length}
        </span>
      </h2>

      <div className="space-y-3">
        {sessions.map((session) => (
          <SessionRow
            key={session.brokerSessionId}
            session={session}
            isEnding={ending === session.brokerSessionId}
            onEnd={() => handleEnd(session.brokerSessionId)}
          />
        ))}
      </div>
    </div>
  );
}

function SessionRow({
  session,
  isEnding,
  onEnd,
}: {
  session: BrokerSession;
  isEnding: boolean;
  onEnd: () => void;
}) {
  const isActive = session.status === "active";
  const expiresAt = new Date(session.expiresAt);
  const timeLeft = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000 / 60));

  return (
    <div
      className="rounded-xl p-3 flex items-center gap-3"
      style={{
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{
          background: isActive
            ? "var(--color-success)"
            : "var(--color-text-muted)",
          boxShadow: isActive ? "0 0 6px var(--color-success)" : "none",
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-medium"
            style={{ color: "var(--color-text-primary)" }}
          >
            {session.resourceKey}
          </span>
          <Badge variant={session.status as "active" | "ended" | "expired" | "failed" | "pending"}>
            {session.status}
          </Badge>
        </div>
        <p className="text-xs mt-0.5 font-mono truncate" style={{ color: "var(--color-text-muted)" }}>
          {session.brokerSessionId.slice(0, 16)}…
        </p>
        {isActive && (
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Expires in {timeLeft}m
          </p>
        )}
      </div>
      {isActive && (
        <Button
          variant="danger"
          size="sm"
          isLoading={isEnding}
          onClick={onEnd}
          className="flex-shrink-0"
        >
          End
        </Button>
      )}
    </div>
  );
}

// ─── Debug Panel ──────────────────────────────────────────────────────────────

export function DebugPanel({ result }: { result: OpenAppResponse | null }) {
  if (!result) return null;

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "var(--color-surface-1)",
        border: "1px solid var(--color-border)",
      }}
    >
      <h2
        className="text-sm font-semibold mb-4 flex items-center gap-2"
        style={{ color: "var(--color-text-primary)" }}
      >
        <span style={{ color: "var(--color-brand-400)" }}>⌥</span> Debug Panel
      </h2>

      <pre
        className="text-xs overflow-auto rounded-xl p-4 font-mono leading-relaxed"
        style={{
          background: "var(--color-surface-3)",
          color: "#a5b4fc",
          maxHeight: "240px",
        }}
      >
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}

// ─── Shared DataRow ───────────────────────────────────────────────────────────

function DataRow({
  label,
  value,
  mono = false,
  copy = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copy?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-3 text-xs">
      <span
        className="w-20 flex-shrink-0"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label}
      </span>
      <span
        className={`flex-1 truncate ${mono ? "font-mono" : ""}`}
        style={{ color: "var(--color-text-secondary)" }}
        title={value}
      >
        {value}
      </span>
      {copy && (
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs flex-shrink-0 transition-colors cursor-pointer"
          style={{ color: copied ? "var(--color-success)" : "var(--color-text-muted)" }}
        >
          {copied ? "✓" : "copy"}
        </button>
      )}
    </div>
  );
}
