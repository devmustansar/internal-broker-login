"use client";

import { type ReactNode } from "react";

interface BadgeProps {
  variant?: "active" | "ended" | "expired" | "failed" | "pending" | "info" | "admin" | "user" | "readonly";
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  ended: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
  expired: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  failed: "bg-red-500/10 text-red-400 border border-red-500/20",
  pending: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  info: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
  admin: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  user: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
  readonly: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
};

export default function Badge({
  variant = "info",
  children,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        variantStyles[variant],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}
