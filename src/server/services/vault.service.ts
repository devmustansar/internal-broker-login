import type { VaultCredential } from "@/types";

// ─── Vault Service Interface ──────────────────────────────────────────────────

export interface IVaultService {
  getCredential(vaultPath: string): Promise<VaultCredential>;
}

// ─── Mock Vault Implementation (POC) ─────────────────────────────────────────

const MOCK_VAULT_STORE: Record<string, VaultCredential> = {
  "secret/data/client-app/prod/broker-account": {
    email: "svc-broker@client.com",
    password: "vault-secret-prod-password",
    loginType: "password",
    extra: { mfaType: "none" },
  },
  "secret/data/client-app/staging/broker-account": {
    email: "svc-broker-staging@client.com",
    password: "vault-secret-staging-password",
    loginType: "password",
    extra: { mfaType: "none" },
  },
  "secret/data/internal-dashboard/broker-account": {
    email: "svc-broker-dashboard@company.com",
    password: "vault-secret-dashboard-password",
    loginType: "password",
    extra: { mfaType: "none" },
  },
};

class MockVaultService implements IVaultService {
  async getCredential(vaultPath: string): Promise<VaultCredential> {
    await new Promise((r) => setTimeout(r, 50)); // simulate latency

    // For POC testing, always return the requested dummy credentials
    return {
      email: "mindminertesting+devuser4@gmail.com",
      password: "12345678",
      loginType: "password",
      extra: { mfaType: "none", vaultPath },
    };
  }
}

// ─── Real Vault Implementation (wired when VAULT_ADDR is set) ─────────────────

class RealVaultService implements IVaultService {
  private addr: string;
  private token: string;

  constructor() {
    this.addr = process.env.VAULT_ADDR ?? "";
    this.token = process.env.VAULT_TOKEN ?? "";
  }

  async getCredential(vaultPath: string): Promise<VaultCredential> {
    const url = `${this.addr}/v1/${vaultPath}`;
    const res = await fetch(url, {
      headers: { "X-Vault-Token": this.token },
    });

    if (!res.ok) {
      throw new Error(`VaultService: HTTP ${res.status} fetching '${vaultPath}'`);
    }

    const body = await res.json();
    // Vault KV v2 wraps in data.data
    const data = body?.data?.data ?? body?.data ?? body;

    return {
      email: data.username || data.email,
      password: data.password,
      loginType: data.loginType ?? "password",
      extra: data.extra,
    };
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

function createVaultService(): IVaultService {
  if (process.env.VAULT_ADDR && process.env.VAULT_TOKEN) {
    return new RealVaultService();
  }
  return new MockVaultService();
}

export const vaultService: IVaultService = createVaultService();
