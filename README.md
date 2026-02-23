# TxWatch

Real-time transaction monitoring demo at **txwatch.pomo.dev**.

TxWatch is a full-stack fintech reference implementation that exercises every
[pomo-studio](https://registry.terraform.io/namespaces/pomo-studio) Terraform module
in one coherent application.

> Private repository — pomo-studio/txwatch

## What it demonstrates

| Area | Technology |
|------|-----------|
| SSR Frontend | Nuxt 3 on Lambda behind CloudFront (multi-region) |
| Event pipeline | EventBridge custom bus → SQS → Lambda enricher |
| Real-time | AppSync GraphQL subscriptions (WebSocket) |
| Auth | Cognito user pools (browser) + AWS_IAM (Lambda) + API_KEY (SSR) |
| Infrastructure | Terraform Cloud — VCS-driven, OIDC-only, no static keys |

## Event flow

```
User clicks "New Transaction"      Scheduler (every 1m)
              │                          │
              ▼                          ▼
   /api/tx (Nuxt server route) generator Lambda
      events:PutEvents         events:PutEvents
              │                          │
              └──────────────────────────┘
               txwatch-enricher-bus
                           │
                        SQS queue
                          │
                  enricher Lambda
                  ├── enrich + score
                  ├── DynamoDB write
                  └── AppSync notifyTransaction
                              │
                    WebSocket subscription → browser
```

## Modules used

| Module | Version | Role |
|--------|---------|------|
| `pomo-studio/serverless-ssr/aws` | `= 2.4.7` | CloudFront + Lambda SSR frontend |
| `pomo-studio/cognito-auth/aws` | `= 1.1.0` | Cognito user pool + Hosted UI auth flow |
| `pomo-studio/event-bus/aws` | `= 1.0.0` | EventBridge custom bus |
| `pomo-studio/event-consumer/aws` | `= 1.0.0` | SQS + enricher Lambda consumer |
| `pomo-studio/appsync/aws` | `= 1.2.0` | GraphQL API + real-time subscriptions |
| `pomo-studio/workspace/tfe` | `~> 1.0` | TFC workspace (managed in pomo core) |
| `pomo-studio/oidc/aws` | `~> 2.0` | OIDC auth for TFC + GitHub Actions |

## Repository structure

```
txwatch/
├── infra/               Terraform (deployed via TFC workspace txwatch)
│   ├── main.tf          All module instantiations
│   ├── schema.graphql   AppSync GraphQL schema
│   ├── resolvers/       AppSync JS resolvers (primary + DR parity)
│   └── lambda/
│       ├── enricher/    EventBridge → DynamoDB → AppSync
│       └── generator/   Random transaction generator
├── app/                 Nuxt 3 application
│   ├── pages/           index.vue, login.vue, about.vue
│   ├── server/api/      health, tx (GET/POST), txfeed (GET), auth/*
│   ├── composables/     useTransactions (AppSync subscription)
│   └── middleware/      auth.ts (server-side auth guard)
├── config/              infra-outputs.json (committed, synced by CI)
└── scripts/             deploy.sh, smoke-appsync-failover.sh
```

## Development

```bash
# 1. Run terraform via TFC (VCS-driven — never run locally)
# 2. Sync infra outputs
terraform output -json > config/infra-outputs.json

# 3. Set env vars
export APPSYNC_URL=...
export APPSYNC_API_KEY=...
export COGNITO_USER_POOL_ID=...
export COGNITO_CLIENT_ID=...
export EVENT_BUS_NAME=txwatch-enricher-bus

# 4. Run dev server (uses real AWS)
cd app && npm install && npm run dev
```

## Deployment

Automated via GitHub Actions on push to `main`:
- `ci.yml` — lint, typecheck, build
- `deploy.yml` — OIDC deploy to Lambda + CloudFront invalidation
- `sync-infra-config.yml` — commits terraform outputs after TFC apply

See [docs/architecture.md](docs/architecture.md) for full architecture details and current auth/API boundaries.
