# Internal Credentials Broker — POC

A local proof-of-concept **credential broker** for internal teams to securely access password-based client applications without sharing raw credentials.

---

## What it does

1. **Internal user signs in** → receives a short-lived JWT
2. **User selects an app** → broker validates ACL
3. **Backend fetches credentials** from HashiCorp Vault (mock in POC mode)
4. **Login adapter performs server-side login** to the target app
5. **Session cookies / auth state are captured**
6. **Broker session stored** in Redis (falls back to memory in dev)
7. **Session metadata returned** to the frontend (no raw credentials exposed)

---

## Tech stack

| Layer          | Tech                                  |
| -------------- | ------------------------------------- |
| Frontend       | Next.js 15 App Router, React, Tailwind CSS |
| Backend        | Next.js Route Handlers (Node.js runtime) |
| Auth           | JWT via `jose` — httpOnly cookie      |
| Session store  | Redis (`ioredis`) with in-memory fallback |
| Secret store   | HashiCorp Vault (mock implementation for POC) |
| Language       | TypeScript                            |

---

## Quick start

```bash
# 1. Clone / enter the project
cd internal-login-broker

# 2. Copy env config
cp .env.example .env.local

# 3. Install dependencies
npm install

# 4. Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Demo accounts

All accounts use password `password`.

| Email                    | Role     | Access                            |
| ------------------------ | -------- | --------------------------------- |
| alice@company.com        | admin    | All apps                          |
| bob@company.com          | user     | Staging + Dashboard               |
| carol@company.com        | readonly | Dashboard only                    |

---

## API reference

| Method | Endpoint                    | Description                              |
| ------ | --------------------------- | ---------------------------------------- |
| POST   | `/api/auth/mock-login`      | Authenticate internal user, set cookie   |
| POST   | `/api/auth/logout`          | Clear session cookie                     |
| GET    | `/api/apps`                 | List accessible resources for user       |
| POST   | `/api/apps/open`            | Trigger full broker open-app flow        |
| GET    | `/api/sessions/:id`         | Get broker session by ID                 |
| POST   | `/api/sessions/:id/end`     | Terminate a broker session               |

### POST `/api/apps/open`

**Request body:**
```json
{ "resourceKey": "client-app-prod" }
```

**Response:**
```json
{
  "brokerSessionId": "uuid",
  "resourceKey": "client-app-prod",
  "appHost": "https://app.client.com",
  "apiHost": "https://api.client.com",
  "expiresAt": "2024-01-01T10:00:00.000Z",
  "status": "active"
}
```

---

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── mock-login/route.ts    # POST /api/auth/mock-login
│   │   │   └── logout/route.ts        # POST /api/auth/logout
│   │   ├── apps/
│   │   │   ├── route.ts               # GET /api/apps
│   │   │   └── open/route.ts          # POST /api/apps/open
│   │   └── sessions/[id]/
│   │       ├── route.ts               # GET /api/sessions/:id
│   │       └── end/route.ts           # POST /api/sessions/:id/end
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── ui/                            # Button, Badge
│   ├── layout/                        # TopBar
│   ├── LoginPage.tsx
│   ├── Dashboard.tsx
│   ├── AppCard.tsx
│   └── SessionPanel.tsx
│
├── lib/
│   ├── app-context.tsx                # React context / state
│   ├── api-helpers.ts                 # Auth extraction, error responses
│   ├── constants.ts                   # TTL, key prefixes, etc.
│   └── seed-data.ts                   # Sample apps, accounts, users
│
├── server/
│   ├── adapters/
│   │   └── login.adapter.ts           # form_login_basic / csrf / json_login
│   ├── repositories/
│   │   └── session.repository.ts      # Redis + in-memory session store
│   └── services/
│       ├── auth.service.ts            # JWT sign/verify
│       ├── vault.service.ts           # Vault credential fetch
│       ├── app-access.service.ts      # ACL + resource resolution
│       ├── broker-session.service.ts  # Core broker orchestrator
│       └── audit.service.ts           # Structured audit logging
│
└── types/
    └── index.ts                       # All domain types/interfaces
```

---

## Configuration

| Variable               | Default                   | Description                              |
| ---------------------- | ------------------------- | ---------------------------------------- |
| `JWT_SECRET`           | dev-secret (change!)      | JWT signing secret                       |
| `VAULT_ADDR`           | _(empty — mock mode)_     | HashiCorp Vault address                  |
| `VAULT_TOKEN`          | _(empty — mock mode)_     | Vault access token                       |
| `REDIS_HOST`           | _(empty — in-memory)_     | Redis host                               |
| `REDIS_PORT`           | 6379                      | Redis port                               |
| `USE_MOCK_LOGIN_ADAPTERS` | true                   | Set false to use real HTTP adapters      |

---

## Adding a new app

1. Add a `Resource` entry to `src/lib/seed-data.ts`
2. Add a `ManagedAccount` entry pointing to a Vault path
3. Add the Vault credential to the mock store in `src/server/services/vault.service.ts`
4. Restart dev server

---

## Next steps (proxy layer — not yet built)

- Add a local proxy that intercepts browser traffic to target apps
- The proxy reads broker sessions from Redis and injects upstream cookies
- No changes required to client apps

---

## Non-goals for this phase

- Proxy layer
- FleetDM / MDM integration
- Teleport
- Real SSO / SAML / OIDC
- WebSocket proxying
- Multi-tenant production auth
