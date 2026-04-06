import type { AwsBrokerCredentials } from "@/types";

// ─── SecretsProvider Interface ────────────────────────────────────────────────
//
// The secrets provider abstraction isolates ALL credential-loading logic.
// Swap implementations by changing which concrete class is returned from
// createSecretsProvider() at the bottom of this file.
//
// Production path:
//   HashiCorpVaultSecretsProvider reads credentials via the Vault KV v2 API.
//   Replace DummyVaultSecretsProvider with it and update VAULT_ADDR / VAULT_TOKEN.

export interface SecretsProvider {
  /**
   * Returns the broker's own AWS IAM credentials for a given reference key.
   * These are the long-lived IAM user credentials that the broker uses to
   * call STS (AssumeRole or GetFederationToken).
   *
   * @param credentialRef - Key from AwsResource.brokerCredentialRef, e.g. "aws/broker/default"
   */
  getAwsBrokerCredentials(credentialRef: string): Promise<AwsBrokerCredentials>;
}

// ─── DummyVaultSecretsProvider ────────────────────────────────────────────────
//
// POC / development implementation. All hardcoded values live here ONLY —
// never scattered across business logic.
//
// TODO: Replace this class with HashiCorpVaultSecretsProvider when integrating
//       real HashiCorp Vault. The interface stays the same; only this file changes.
//
// Real Vault integration checklist:
//   1. Set VAULT_ADDR and VAULT_TOKEN in env
//   2. Implement HashiCorpVaultSecretsProvider below (see stub)
//   3. Change createSecretsProvider() to return it
//   4. Delete this class
//
// The dummy credentials below follow the EXACT shape that Vault KV v2 would return,
// so your business logic does not need to change when you swap providers.

// ─── Hardcoded dummy credentials — isolated to this block only ────────────────
// Replace these when integrating with real Vault or environment variables.

const DUMMY_CREDENTIALS: Record<string, AwsBrokerCredentials> = {
  /**
   * Default broker IAM user credentials.
   * In production, this maps to: secret/data/aws/broker/default
   */
  "aws/broker/default": {
    accessKeyId: "dummy",
    secretAccessKey: "dummy",
    // sessionToken omitted — this is a long-lived IAM user key
  },
  /**
   * Example per-account broker credentials for a specific AWS account.
   * In production, this maps to: secret/data/aws/broker/123456789012
   */
  "aws/broker/123456789012": {
    accessKeyId: "dummy",
    secretAccessKey: "dummy",
  },
};

// ─────────────────────────────────────────────────────────────────────────────

class DummyVaultSecretsProvider implements SecretsProvider {
  async getAwsBrokerCredentials(credentialRef: string): Promise<AwsBrokerCredentials> {
    // Simulate Vault read latency
    await new Promise((r) => setTimeout(r, 20));

    const creds = DUMMY_CREDENTIALS[credentialRef];
    if (!creds) {
      // TODO: When switching to real Vault, this error will naturally surface
      //       as a 403/404 from the Vault API. Match the error message shape here.
      throw new Error(
        `[DummyVault] No credentials found for ref '${credentialRef}'. ` +
        `Available refs: ${Object.keys(DUMMY_CREDENTIALS).join(", ")}`
      );
    }

    return { ...creds }; // return a copy; never mutate the store
  }
}

// ─── TODO: Real HashiCorp Vault Implementation (replace DummyVaultSecretsProvider) ──
//
// class HashiCorpVaultSecretsProvider implements SecretsProvider {
//   private readonly addr = process.env.VAULT_ADDR ?? "";
//   private readonly token = process.env.VAULT_TOKEN ?? "";
//
//   async getAwsBrokerCredentials(credentialRef: string): Promise<AwsBrokerCredentials> {
//     const url = `${this.addr}/v1/secret/data/${credentialRef}`;
//     const res = await fetch(url, { headers: { "X-Vault-Token": this.token } });
//     if (!res.ok) throw new Error(`Vault: HTTP ${res.status} reading '${credentialRef}'`);
//     const body = await res.json();
//     const data = body?.data?.data ?? body?.data ?? body;
//     return {
//       accessKeyId: data.access_key_id,
//       secretAccessKey: data.secret_access_key,
//       sessionToken: data.session_token,
//     };
//   }
// }

// ─── Factory ──────────────────────────────────────────────────────────────────
//
// TODO: When integrating real Vault, change this to:
//   if (process.env.VAULT_ADDR && process.env.VAULT_TOKEN) {
//     return new HashiCorpVaultSecretsProvider();
//   }

export function createSecretsProvider(): SecretsProvider {
  // TODO: Swap to HashiCorpVaultSecretsProvider when VAULT_ADDR + VAULT_TOKEN are set
  return new DummyVaultSecretsProvider();
}

/** Singleton — one provider for the process lifetime */
export const secretsProvider: SecretsProvider = createSecretsProvider();
