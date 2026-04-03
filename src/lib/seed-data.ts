import type { InternalUser, ManagedAccount, Resource } from "@/types";

// ─── Seed Resources ──────────────────────────────────────────────────────────

export const SEED_RESOURCES: Resource[] = [
  {
    id: "res-001",
    resourceKey: "client-app-prod",
    name: "Client App (Production)",
    appHost: "https://app.client.com",
    apiHost: "https://api.client.com",
    loginUrl: "https://app.client.com/auth/login",
    loginMethod: "POST",
    loginAdapter: "json_login",
    environment: "production",
    isActive: true,
    description: "Main client-facing application — production environment",
  },
  {
    id: "res-002",
    resourceKey: "client-app-staging",
    name: "Client App (Staging)",
    appHost: "https://staging.app.client.com",
    apiHost: "https://staging.api.client.com",
    loginUrl: "https://staging.app.client.com/auth/login",
    loginMethod: "POST",
    loginAdapter: "form_login_csrf",
    environment: "staging",
    isActive: true,
    description: "Client application — staging / QA environment",
  },
  {
    id: "res-003",
    resourceKey: "internal-dashboard",
    name: "Internal Dashboard",
    appHost: "https://dashboard.internal.company.com",
    apiHost: "https://api.dashboard.internal.company.com",
    loginUrl: "https://dashboard.internal.company.com/login",
    loginMethod: "POST",
    loginAdapter: "form_login_basic",
    environment: "production",
    isActive: true,
    description: "Internal operations and analytics dashboard",
  },
];

// ─── Seed Managed Accounts ───────────────────────────────────────────────────

export const SEED_MANAGED_ACCOUNTS: ManagedAccount[] = [
  {
    id: "ma-001",
    resourceId: "res-001",
    accountKey: "svc-broker-prod",
    vaultPath: "secret/data/client-app/prod/broker-account",
    label: "Broker Service Account (Prod)",
    role: "service",
    isActive: true,
  },
  {
    id: "ma-002",
    resourceId: "res-002",
    accountKey: "svc-broker-staging",
    vaultPath: "secret/data/client-app/staging/broker-account",
    label: "Broker Service Account (Staging)",
    role: "service",
    isActive: true,
  },
  {
    id: "ma-003",
    resourceId: "res-003",
    accountKey: "svc-broker-dashboard",
    vaultPath: "secret/data/internal-dashboard/broker-account",
    label: "Broker Service Account (Dashboard)",
    role: "admin",
    isActive: true,
  },
];

// ─── Seed Internal Users ─────────────────────────────────────────────────────

export const SEED_USERS: InternalUser[] = [
  {
    id: "user-001",
    email: "alice@company.com",
    name: "Alice Admin",
    role: "admin",
    allowedResourceKeys: ["*"],
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "user-002",
    email: "bob@company.com",
    name: "Bob Dev",
    role: "user",
    allowedResourceKeys: ["client-app-staging", "internal-dashboard"],
    createdAt: "2024-01-15T00:00:00Z",
  },
  {
    id: "user-003",
    email: "carol@company.com",
    name: "Carol Readonly",
    role: "readonly",
    allowedResourceKeys: ["internal-dashboard"],
    createdAt: "2024-02-01T00:00:00Z",
  },
];

// Mock credentials for mock users (for POC login only)
export const MOCK_USER_PASSWORDS: Record<string, string> = {
  "alice@company.com": "password",
  "bob@company.com": "password",
  "carol@company.com": "password",
};
