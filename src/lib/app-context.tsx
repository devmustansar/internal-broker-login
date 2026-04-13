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
import { useSession, signOut } from "next-auth/react";

interface AuthState {
  user: any | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface BrokerState {
  resources: any[];
  sessions: BrokerSession[];
  lastOpenResult: OpenAppResponse | null;
}

interface AppContextValue extends AuthState, BrokerState {
  login: (email: string, password: string) => Promise<void>; // Deprecated
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
  const { data: session, status } = useSession();
  const user = session?.user || null;
  const isAuthenticated = status === "authenticated";
  const isLoading = status === "loading";

  const [resources, setResources] = useState<any[]>([]);
  const [sessions, setSessions] = useState<BrokerSession[]>([]);
  const [lastOpenResult, setLastOpenResult] = useState<OpenAppResponse | null>(null);

  const apiFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
      };

      const res = await fetch(path, { ...options, headers, credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    []
  );

  const login = useCallback(async (email: string, password: string) => {
    // Deprecated. Handled by NextAuth signIn now.
    console.warn("login is deprecated. Use signIn from next-auth/react directly.");
  }, []);

  const logout = useCallback(async () => {
    await signOut({ callbackUrl: "/" });
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
            internalUserId: (user as any)?.id ?? "",
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

  return (
    <AppContext.Provider
      value={{
        user,
        isAuthenticated,
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
