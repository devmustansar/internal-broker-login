"use client";

import { useState } from "react";
import { useApp } from "@/lib/app-context";
import Button from "@/components/ui/Button";

export default function LoginPage() {
  const { login, isLoading } = useApp();
  const [email, setEmail] = useState("alice@company.com");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid var(--color-border)",
    background: "var(--color-surface-3)",
    color: "var(--color-text-primary)",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.2s",
  };

  const DEMO_USERS = [
    { email: "alice@company.com", name: "Alice (Admin — all apps)" },
    { email: "bob@company.com", name: "Bob (User — staging + dashboard)" },
    { email: "carol@company.com", name: "Carol (Readonly — dashboard only)" },
  ];

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--color-bg)" }}
    >
      {/* Background grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 60%)",
        }}
      />

      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white font-bold text-lg"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              boxShadow: "0 0 40px rgba(99,102,241,0.3)",
            }}
          >
            ICB
          </div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            Internal Credentials Broker
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Sign in to access brokered applications
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: "var(--color-surface-1)",
            border: "1px solid var(--color-border)",
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={inputStyle}
                onFocus={(e) =>
                  (e.target.style.borderColor = "var(--color-brand-500)")
                }
                onBlur={(e) =>
                  (e.target.style.borderColor = "var(--color-border)")
                }
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={inputStyle}
                onFocus={(e) =>
                  (e.target.style.borderColor = "var(--color-brand-500)")
                }
                onBlur={(e) =>
                  (e.target.style.borderColor = "var(--color-border)")
                }
              />
            </div>

            {error && (
              <div
                className="text-sm px-3 py-2 rounded-lg"
                style={{
                  background: "var(--color-error-dim)",
                  color: "var(--color-error)",
                  border: "1px solid rgba(239,68,68,0.2)",
                }}
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              isLoading={isLoading}
              className="w-full justify-center mt-2"
              id="login-submit"
            >
              Sign in
            </Button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6">
            <p
              className="text-xs mb-3"
              style={{ color: "var(--color-text-muted)" }}
            >
              Demo accounts (password: <span className="font-mono">password</span>)
            </p>
            <div className="space-y-2">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => {
                    setEmail(u.email);
                    setPassword("password");
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer"
                  style={{
                    background: "var(--color-surface-2)",
                    color: "var(--color-text-secondary)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <span
                    className="font-mono block"
                    style={{ color: "var(--color-brand-400)" }}
                  >
                    {u.email}
                  </span>
                  <span>{u.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center mt-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
          Internal use only · POC environment
        </p>
      </div>
    </div>
  );
}
