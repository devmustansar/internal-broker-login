"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { InternalUser, OpenAppResponse, BrokerSession, Resource } from "@/types";

interface AuthState {
  user: InternalUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface BrokerState {
  resources: any[];
  sessions: BrokerSession[];
  lastOpenResult: OpenAppResponse | null;
}

interface AppContextValue extends AuthState, BrokerState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchResources: () => Promise<void>;
  openApp: (resourceKey: string) => Promise<OpenAppResponse>;
  endSession: (sessionId: string) => Promise<void>;
  refreshSession: (sessionId: string) => Promise<BrokerSession | null>;
  /** AWS Console federation launch — returns the full console login URL */
  launchAwsConsole: (resourceKey: string) => Promise<{ loginUrl: string; expiresAt: string; awsAccountId: string; roleArn: string }>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<InternalUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resources, setResources] = useState<any[]>([]);
  const [sessions, setSessions] = useState<BrokerSession[]>([]);
  const [lastOpenResult, setLastOpenResult] = useState<OpenAppResponse | null>(null);

  const apiFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(path, { ...options, headers, credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    [token]
  );

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await fetch("/api/auth/mock-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Login failed");
        return r.json();
      });

      setToken(data.token);
      setUser(data.user);
      // Persist token in sessionStorage for page refreshes
      sessionStorage.setItem("__broker_token", data.token);
      sessionStorage.setItem("__broker_user", JSON.stringify(data.user));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {}
    setToken(null);
    setUser(null);
    setResources([]);
    setSessions([]);
    setLastOpenResult(null);
    sessionStorage.removeItem("__broker_token");
    sessionStorage.removeItem("__broker_user");
  }, []);

  const fetchResources = useCallback(async () => {
    const data = await apiFetch("/api/apps");
    setResources(data);
  }, [apiFetch]);

  const openApp = useCallback(
    async (resourceKey: string): Promise<OpenAppResponse> => {
      const result = await apiFetch("/api/apps/open", {
        method: "POST",
        body: JSON.stringify({ resourceKey }),
      });
      setLastOpenResult(result);
      // Refresh sessions list
      setSessions((prev) => {
        const exists = prev.find((s) => s.brokerSessionId === result.brokerSessionId);
        if (exists) return prev;
        return [
          {
            brokerSessionId: result.brokerSessionId,
            internalUserId: user?.id ?? "",
            resourceKey: result.resourceKey,
            managedAccountKey: "",
            upstreamCookies: {},
            expiresAt: result.expiresAt,
            createdAt: new Date().toISOString(),
            status: result.status,
            appHost: result.appHost,
            apiHost: result.apiHost,
          },
          ...prev,
        ];
      });
      return result;
    },
    [apiFetch, user]
  );

  const endSession = useCallback(
    async (sessionId: string) => {
      await apiFetch(`/api/sessions/${sessionId}/end`, { method: "POST" });
      setSessions((prev) =>
        prev.map((s) =>
          s.brokerSessionId === sessionId ? { ...s, status: "ended" } : s
        )
      );
    },
    [apiFetch]
  );

  const refreshSession = useCallback(
    async (sessionId: string): Promise<BrokerSession | null> => {
      const data = await apiFetch(`/api/sessions/${sessionId}`);
      setSessions((prev) =>
        prev.map((s) => (s.brokerSessionId === sessionId ? data : s))
      );
      return data;
    },
    [apiFetch]
  );

  const launchAwsConsole = useCallback(
    async (resourceKey: string) => {
      return apiFetch(`/api/aws/launch/${encodeURIComponent(resourceKey)}`, {
        method: "POST",
      });
    },
    [apiFetch]
  );

  // Restore session from sessionStorage on mount
  useEffect(() => {
    const savedToken = sessionStorage.getItem("__broker_token");
    const savedUser = sessionStorage.getItem("__broker_user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  return (
    <AppContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        resources,
        sessions,
        lastOpenResult,
        login,
        logout,
        fetchResources,
        openApp,
        endSession,
        refreshSession,
        launchAwsConsole,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
