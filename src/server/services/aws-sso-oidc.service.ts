import {
  SSOOIDCClient,
  RegisterClientCommand,
  StartDeviceAuthorizationCommand,
  CreateTokenCommand,
} from "@aws-sdk/client-sso-oidc";
import { SSOClient, GetRoleCredentialsCommand } from "@aws-sdk/client-sso";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SsoOidcRegistration {
  clientId: string;
  clientSecret: string;
  clientSecretExpiresAt: number;
}

export interface DeviceAuthSession {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
}

export interface SsoOidcTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SsoRoleCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const awsSsoOidcService = {
  /**
   * Step 1 — Register broker as a public OIDC client with the SSO instance.
   * This is a public endpoint — no IAM credentials needed.
   * Returns clientId + clientSecret which are stored per-resource.
   */
  async registerClient(ssoRegion: string): Promise<SsoOidcRegistration> {
    const client = new SSOOIDCClient({ region: ssoRegion });
    const res = await client.send(
      new RegisterClientCommand({
        clientName: "internal-login-broker",
        clientType: "public",
        // Request offline_access so AWS issues a refresh token on device_code exchange
        scopes: ["sso:account:access", "openid", "profile"],
        grantTypes: ["urn:ietf:params:oauth:grant-type:device_code", "refresh_token"],
      })
    );

    if (!res.clientId || !res.clientSecret) {
      throw new Error("SSO OIDC RegisterClient returned incomplete response");
    }

    return {
      clientId: res.clientId,
      clientSecret: res.clientSecret,
      clientSecretExpiresAt: res.clientSecretExpiresAt ?? 0,
    };
  },

  /**
   * Step 2 — Start device authorization.
   * Returns the URL + code the user visits to approve access.
   */
  async startDeviceAuthorization(
    ssoRegion: string,
    ssoStartUrl: string,
    clientId: string,
    clientSecret: string
  ): Promise<DeviceAuthSession> {
    const client = new SSOOIDCClient({ region: ssoRegion });
    const res = await client.send(
      new StartDeviceAuthorizationCommand({
        clientId,
        clientSecret,
        startUrl: ssoStartUrl,
      })
    );

    if (!res.deviceCode || !res.userCode || !res.verificationUri) {
      throw new Error("SSO OIDC StartDeviceAuthorization returned incomplete response");
    }

    return {
      deviceCode: res.deviceCode,
      userCode: res.userCode,
      verificationUri: res.verificationUri,
      verificationUriComplete: res.verificationUriComplete ?? res.verificationUri,
      expiresIn: res.expiresIn ?? 600,
      interval: res.interval ?? 5,
    };
  },

  /**
   * Step 3 — Exchange device code for tokens after the user approves.
   * Called by the poll endpoint. Returns accessToken + refreshToken.
   */
  async createTokenFromDeviceCode(
    ssoRegion: string,
    clientId: string,
    clientSecret: string,
    deviceCode: string
  ): Promise<SsoOidcTokens> {
    const client = new SSOOIDCClient({ region: ssoRegion });
    const res = await client.send(
      new CreateTokenCommand({
        clientId,
        clientSecret,
        grantType: "urn:ietf:params:oauth:grant-type:device_code",
        deviceCode,
      })
    );

    if (!res.accessToken) {
      throw new Error("SSO OIDC CreateToken returned no access token");
    }

    return {
      accessToken: res.accessToken,
      // refreshToken is absent on some Identity Center configurations — stored as empty
      // string so the activate route can still succeed; runtime will fall back to
      // re-doing device auth if the access token expires without a refresh token.
      refreshToken: res.refreshToken ?? "",
      expiresIn: res.expiresIn ?? 3600,
    };
  },

  /**
   * Refresh — exchange a stored refreshToken for a new accessToken.
   * Called at runtime on every tile click.
   */
  async refreshAccessToken(
    ssoRegion: string,
    clientId: string,
    clientSecret: string,
    refreshToken: string
  ): Promise<SsoOidcTokens> {
    const client = new SSOOIDCClient({ region: ssoRegion });
    const res = await client.send(
      new CreateTokenCommand({
        clientId,
        clientSecret,
        grantType: "refresh_token",
        refreshToken,
      })
    );

    if (!res.accessToken) {
      throw new Error("SSO OIDC token refresh returned no accessToken");
    }

    return {
      accessToken: res.accessToken,
      // AWS may or may not rotate the refresh token — use the new one if provided
      refreshToken: res.refreshToken ?? refreshToken,
      expiresIn: res.expiresIn ?? 3600,
    };
  },

  /**
   * Get temporary AWS credentials for a specific account + permission set
   * using a valid SSO access token.
   */
  async getRoleCredentials(
    ssoRegion: string,
    accessToken: string,
    accountId: string,
    permissionSetName: string
  ): Promise<SsoRoleCredentials> {
    const client = new SSOClient({ region: ssoRegion });
    const res = await client.send(
      new GetRoleCredentialsCommand({
        accessToken,
        accountId,
        roleName: permissionSetName,
      })
    );

    const creds = res.roleCredentials;
    if (!creds?.accessKeyId || !creds?.secretAccessKey || !creds?.sessionToken) {
      throw new Error("SSO GetRoleCredentials returned incomplete credentials");
    }

    return {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
      expiration: creds.expiration ?? Date.now() + 3600 * 1000,
    };
  },
};
