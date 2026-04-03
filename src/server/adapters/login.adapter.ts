import type { AdapterLoginResult, VaultCredential } from "@/types";

// ─── Adapter Interface ────────────────────────────────────────────────────────

export interface ILoginAdapter {
  login(
    loginUrl: string,
    credential: VaultCredential,
    options?: Record<string, unknown>
  ): Promise<AdapterLoginResult>;
}

// ─── Helper: parse Set-Cookie headers ────────────────────────────────────────

function parseCookies(headers: Headers): Record<string, string> {
  const cookies: Record<string, string> = {};
  const raw = headers.get("set-cookie");
  if (!raw) return cookies;

  // Handle multiple Set-Cookie headers (joined by comma by fetch API)
  raw.split(/,(?=[^ ])/).forEach((part) => {
    const nameVal = part.split(";")[0].trim();
    const eqIdx = nameVal.indexOf("=");
    if (eqIdx !== -1) {
      const name = nameVal.slice(0, eqIdx).trim();
      const value = nameVal.slice(eqIdx + 1).trim();
      cookies[name] = value;
    }
  });
  return cookies;
}

// ─── Adapter: form_login_basic ────────────────────────────────────────────────
// Standard HTML form POST with username/password fields

class FormLoginBasicAdapter implements ILoginAdapter {
  async login(
    loginUrl: string,
    credential: VaultCredential,
    options?: Record<string, unknown>
  ): Promise<AdapterLoginResult> {
    try {
      const usernameKey = (options?.usernameField as string) || "username";
      const passwordKey = (options?.passwordField as string) || "password";

      const bodyParams: Record<string, string> = {
        [usernameKey]: credential.email,
        [passwordKey]: credential.password,
      };
      const body = new URLSearchParams(bodyParams);

      console.log(`[FormLoginBasicAdapter] Attempting POST to ${loginUrl}`);
      const res = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        redirect: "manual",
      });

      console.log(`[FormLoginBasicAdapter] Response status: ${res.status}`);
      const upstreamCookies = parseCookies(res.headers);
      console.log(`[FormLoginBasicAdapter] Found cookies:`, upstreamCookies);

      const success = res.status === 200 || res.status === 302;

      return {
        success,
        upstreamCookies,
        statusCode: res.status,
        errorMessage: success ? undefined : `Upstream returned ${res.status}`,
      };
    } catch (err) {
      return {
        success: false,
        upstreamCookies: {},
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
}

// ─── Adapter: form_login_csrf ─────────────────────────────────────────────────
// Two-phase: GET to fetch CSRF token, then POST with credentials

class FormLoginCsrfAdapter implements ILoginAdapter {
  async login(
    loginUrl: string,
    credential: VaultCredential,
    options?: Record<string, unknown>
  ): Promise<AdapterLoginResult> {
    try {
      // Phase 1: GET login page to obtain CSRF token
      console.log(`[FormLoginCsrfAdapter] Attempting GET to extract CSRF token from ${loginUrl}`);
      const getRes = await fetch(loginUrl, { redirect: "manual" });

      let csrfToken = "";
      const initCookies = parseCookies(getRes.headers);
      console.log(`[FormLoginCsrfAdapter] Initial GET status: ${getRes.status}, cookies:`, Object.keys(initCookies));

      const html = await getRes.text();
      const csrfMatch = html.match(
        /name=["']?_csrf["']?\s+(?:type=["']hidden["']\s+)?value=["']([^"']+)["']/i
      );
      if (csrfMatch) {
        csrfToken = csrfMatch[1];
        console.log(`[FormLoginCsrfAdapter] Successfully extracted CSRF token`);
      } else {
        console.warn(`[FormLoginCsrfAdapter] Failed to extract CSRF token from HTML response`);
      }

      // Phase 2: POST credentials + CSRF token
      const cookieHeader = Object.entries(initCookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");

      const usernameKey = (options?.usernameField as string) || "username";
      const passwordKey = (options?.passwordField as string) || "password";

      const bodyParams: Record<string, string> = {
        [usernameKey]: credential.email,
        [passwordKey]: credential.password,
        _csrf: csrfToken,
      };
      const body = new URLSearchParams(bodyParams);

      console.log(`[FormLoginCsrfAdapter] Attempting POST to ${loginUrl} with CSRF token`);
      const postRes = await fetch(loginUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: cookieHeader,
        },
        body: body.toString(),
        redirect: "manual",
      });

      console.log(`[FormLoginCsrfAdapter] POST Response status: ${postRes.status}`);
      const upstreamCookies = {
        ...initCookies,
        ...parseCookies(postRes.headers),
      };

      console.log(`[FormLoginCsrfAdapter] Final combined cookies:`, Object.keys(upstreamCookies));
      const success = postRes.status === 200 || postRes.status === 302;

      return {
        success,
        upstreamCookies,
        statusCode: postRes.status,
        metadata: { csrfTokenObtained: !!csrfToken },
        errorMessage: success
          ? undefined
          : `Upstream CSRF login returned ${postRes.status}`,
      };
    } catch (err) {
      return {
        success: false,
        upstreamCookies: {},
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
}

// ─── Adapter: json_login ──────────────────────────────────────────────────────
// JSON body POST — common for SPA APIs

class JsonLoginAdapter implements ILoginAdapter {
  async login(
    loginUrl: string,
    credential: VaultCredential,
    options?: Record<string, unknown>
  ): Promise<AdapterLoginResult> {
    try {
      const usernameKey = (options?.usernameField as string) || "email"; // Since json APIs often use email
      const passwordKey = (options?.passwordField as string) || "password";

      console.log(`[JsonLoginAdapter] Attempting POST to ${loginUrl}`);
      const payload: Record<string, string> = {
        [usernameKey]: credential.email,
        [passwordKey]: credential.password,
      };

      const res = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        redirect: "manual",
      });

      console.log(`[JsonLoginAdapter] Response status: ${res.status}`);

      const upstreamCookies = parseCookies(res.headers);
      console.log(`[JsonLoginAdapter] Parsed remote cookies:`, upstreamCookies);

      let token: string | undefined;
      try {
        const text = await res.text();
        // console.log(`[JsonLoginAdapter] JSON Response Body:`, text);
        const json = JSON.parse(text);

        const extractionPath = options?.tokenExtractionPath as string | undefined;

        if (extractionPath) {
          console.log(`[JsonLoginAdapter] Extracting token via custom path: ${extractionPath}`);
          token = extractionPath.split(".").reduce((acc, curr) => acc?.[curr], json);
        } else {
          token = json?.token ?? json?.access_token ?? json?.data?.token ?? json?.data?.accessToken ?? json?.info?.token;
        }

        console.log(`[JsonLoginAdapter] Extracted token:`, token);

        if (token) {
          console.log(`[JsonLoginAdapter] Extracted bearer token from body`);
          // Save it as "token" so the proxy can inject it as a cookie with the correct name
          upstreamCookies["token"] = token;
        }
      } catch (err) {
        // Response may not be JSON on redirect-based flows
        console.log(`[JsonLoginAdapter] Could not parse JSON body`);
      }

      const success = res.status >= 200 && res.status < 400;

      return {
        success,
        upstreamCookies,
        statusCode: res.status,
        metadata: { bearerToken: !!token },
        errorMessage: success
          ? undefined
          : `Upstream JSON login returned ${res.status}`,
      };
    } catch (err) {
      return {
        success: false,
        upstreamCookies: {},
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
}

// ─── Mock adapter for POC (safe to use when real target not available) ────────

class MockLoginAdapter implements ILoginAdapter {
  private adapterType: string;

  constructor(adapterType: string) {
    this.adapterType = adapterType;
  }

  async login(
    loginUrl: string,
    credential: VaultCredential
  ): Promise<AdapterLoginResult> {
    await new Promise((r) => setTimeout(r, 150)); // Simulate network round-trip

    // Simulate the client backend responding with a one-time token
    // (mirrors what a real json_login adapter would extract from the response body)
    const mockOneTimeToken = `ott_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    return {
      success: true,
      // "token" key is what broker-session.service reads as the one-time token
      upstreamCookies: {
        token: mockOneTimeToken,
      },
      statusCode: 200,
      metadata: {
        mockAdapter: this.adapterType,
        loginUrl,
        accountUsed: credential.email,
        flow: "one_time_token",
      },
    };
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

const USE_MOCK_ADAPTERS = process.env.USE_MOCK_LOGIN_ADAPTERS === "true";

export function getLoginAdapter(
  adapterType: "form_login_basic" | "form_login_csrf" | "json_login"
): ILoginAdapter {
  if (USE_MOCK_ADAPTERS) {
    return new MockLoginAdapter(adapterType);
  }

  switch (adapterType) {
    case "form_login_basic":
      return new FormLoginBasicAdapter();
    case "form_login_csrf":
      return new FormLoginCsrfAdapter();
    case "json_login":
      return new JsonLoginAdapter();
    default:
      throw new Error(`Unknown login adapter: ${adapterType}`);
  }
}
