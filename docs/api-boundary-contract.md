# TxWatch API Boundary Contract (Issue #2)

Primary tracker: https://github.com/pomo-studio/txwatch/issues/2  
Parent: https://github.com/pomo-studio/txwatch/issues/1

## Purpose

Define the application boundary so SSR remains focused on web delivery while API POST workflows are owned by the AppSync/API layer.

## Scope

- In scope:
  - Auth and transaction POST flow ownership and interfaces
  - Route ownership mapping (current vs target)
  - Session/token model and error contract
- Out of scope:
  - Terraform module releases
  - Temporary client-side signing workarounds

## Principles

- No client-side request-signing hacks.
- SSR web path stability is protected by GET-only integration gate.
- API POST behavior must be testable independently from SSR routing behavior.

## Current Route Ownership

| Route | Method | Current Owner | Notes |
|------|--------|---------------|-------|
| `/api/auth/signin` | POST | SSR server route | Cognito initiation + cookie set |
| `/api/auth/signup` | POST | SSR server route | Cognito signup |
| `/api/auth/confirm` | POST | SSR server route | Cognito confirm + optional signin |
| `/api/auth/signout` | POST | SSR server route | Cookie clear |
| `/api/auth/me` | GET | SSR server route | Cookie -> in-memory token bridge |
| `/api/tx` | POST | SSR server route | EventBridge `PutEvents` |
| `/api/txfeed` | GET | SSR server route | AppSync query via API key |
| `/api/health` | GET | SSR server route | Health probe |

## Target Route Ownership

| Capability | Target Owner | Transport |
|-----------|--------------|-----------|
| Auth POST flows | AppSync/API boundary | API layer endpoint(s) behind txwatch backend |
| Transaction ingest POST | AppSync/API boundary | API layer endpoint(s), then event pipeline |
| Feed read model | AppSync/API boundary | GraphQL query/subscription |
| SSR page render and static web delivery | SSR module | CloudFront -> Lambda (GET paths) |
| Health endpoint | SSR server route (or dedicated API health) | GET |

## Contract Requirements

## 1) Auth/session contract

- Server sets and clears httpOnly cookies.
- Browser never stores long-lived tokens in localStorage.
- `/api/auth/me` equivalent remains the only cookie -> memory bridge for realtime client auth token use.
- Error format is stable:
  - `{ "message": "<human-readable>", "code": "<machine-code>" }`

## 2) POST command contract

- API boundary accepts typed command payloads for transaction creation and auth operations.
- SSR route handlers are not required for POST command execution after migration.
- Idempotency strategy documented where needed (for retries/replays).

## 3) Realtime read contract

- Subscription and query behavior remains AppSync-owned.
- Frontend composables consume boundary outputs without depending on SSR POST routes.

## Migration Mapping

| Current | Target | Status |
|--------|--------|--------|
| `/api/auth/signin` | API boundary auth command | TODO |
| `/api/auth/signup` | API boundary auth command | TODO |
| `/api/auth/confirm` | API boundary auth command | TODO |
| `/api/auth/signout` | API boundary signout command | TODO |
| `/api/tx` | API boundary transaction command | TODO |
| `/api/txfeed` | Keep or fold into AppSync direct query adapter | TODO |

## Acceptance Criteria (Issue #2)

- Contract doc is complete and reviewed.
- Every current POST route has an explicit target owner.
- Security posture is explicit and excludes client-side signing workarounds.
- Ready to start implementation issue: https://github.com/pomo-studio/txwatch/issues/3
