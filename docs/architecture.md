# TxWatch Architecture

## Overview

TxWatch is a real-time transaction monitoring dashboard that serves two purposes:

1. **Fintech showcase**: A plausible, production-shaped demo of event-driven financial
   infrastructure — transactions ingested, enriched, fraud-scored, and surfaced to
   authenticated users in real time.

2. **Module integration showcase**: A living reference that exercises every
   pomo-studio Terraform module in one coherent application.

## Infrastructure diagram

```
txwatch infra/main.tf
│
├── module.ssr (serverless-ssr = 2.4.7)
│   ├── CloudFront → txwatch.pomo.dev
│   ├── Lambda SSR (us-east-1 primary, us-west-2 DR)
│   ├── S3 static assets
│   └── DynamoDB txwatch-visits (page visit counter)
│
├── module.auth (pomo-studio/cognito-auth/aws = 1.1.0)
│   ├── User pool + app client
│   └── Hosted UI domain + oauth callback/logout wiring
│
├── module.api (terraform-aws-appsync pinned commit)
│   ├── AppSync API: txwatch-api
│   ├── Auth: Cognito (primary) + AWS_IAM + API_KEY
│   ├── Data source: txwatch-transactions (DynamoDB)
│   └── Resolvers: listTransactions, getStats, notifyTransaction, onTransactionAdded
│
├── aws_dynamodb_table.transactions
│   ├── PK: TX#<uuid>, SK: <ISO-timestamp>
│   ├── GSI: AllTransactionsIndex (entity_type, createdAt)
│   └── GSI: CategoryTimestampIndex (category, createdAt)
│
├── module.ingest_bus + module.ingest_consumer (pomo-studio registry modules = 1.0.0)
│   ├── Custom bus: txwatch-enricher-bus
│   ├── Rule: source = ["txwatch.transactions"]
│   ├── SQS main queue + DLQ
│   ├── Lambda: txwatch-enricher (enrichment + fraud scoring + AppSync mutation)
│   └── CloudWatch alarms → SNS → alarm_email
│
├── aws_lambda_function.generator
│   ├── Generates random transactions
│   └── Invoked by EventBridge Scheduler every 1 minute
│
├── aws_scheduler_schedule.generator
│   └── rate(1 minute) → generator Lambda
│
└── Cognito Hosted UI flow
    ├── /api/auth/redirect -> Cognito login
    ├── /api/auth/callback -> app session cookie
    └── /api/auth/signout -> Cognito logout + cookie clear
```

## Auth model

| Actor | Auth mode | AppSync operations |
|-------|-----------|-------------------|
| Browser (Cognito JWT) | `userPool` | WebSocket subscription (`onTransactionAdded`) |
| Nuxt server route | `apiKey` | `listTransactions` query (server-side feed query) |
| Enricher Lambda | `iam` (sigv4) | `notifyTransaction` mutation |
| Generator Lambda | IAM execution role | `events:PutEvents` only (no AppSync) |

## Route ownership

| Route | Method | Owner | Purpose |
|-------|--------|-------|---------|
| `/api/auth/redirect` | GET | Nuxt server | Start Cognito Hosted UI login |
| `/api/auth/callback` | GET | Nuxt server | Exchange code and set session cookie |
| `/api/auth/signout` | GET | Nuxt server | Clear session + redirect to Cognito logout |
| `/api/tx` | GET/POST | Nuxt server | Publish manual transaction event to EventBridge |
| `/api/txfeed` | GET | Nuxt server | Query initial transaction feed from AppSync |
| `onTransactionAdded` | WebSocket | AppSync | Push realtime transaction updates to browser |

## Data model

### txwatch-transactions

```
PK: TX#<uuid-v4>
SK: <ISO-8601-timestamp>

Attributes:
  transactionId     String   uuid-v4
  amount            Number   e.g. 142.50
  currency          String   USD
  merchant          String   e.g. "Whole Foods Market"
  category          String   grocery | restaurant | gas | travel | atm | online
  status            String   cleared | flagged
  riskScore         Number   0–100 (rule-based)
  fraudFlag         Boolean  true if riskScore > 70
  source            String   manual | auto
  processingRegion  String   us-east-1 | us-west-2
  processingLatencyMs Number EventBridge publish → DynamoDB write
  eventId           String   EventBridge event ID
  entity_type       String   "TRANSACTION" (for AllTransactionsIndex)
  createdAt         String   ISO timestamp

GSI: AllTransactionsIndex
  PK: entity_type  SK: createdAt  (time-sorted feed)

GSI: CategoryTimestampIndex
  PK: category  SK: createdAt  (category analytics)
```

## Risk scoring (enricher Lambda)

Rule-based, explainable, no ML dependency:

| Condition | Score delta |
|-----------|-------------|
| Base randomness | 0–29 |
| Amount > $500 | +10 |
| Amount > $1000 | +20 (replaces +10) |
| Amount > $5000 | +40 (replaces +20) |
| Suspicious merchant | +30 |
| ATM category | +15 |
| After-hours (10pm–6am UTC) | +10 |
| **Maximum** | 100 |

`fraudFlag = riskScore > 70`
`status = "flagged"` if fraudFlag, otherwise `"cleared"`

## OIDC / security

- **No static AWS keys anywhere** — all auth via OIDC federation
- TFC workspace → AWS via `terraform-cloud-txwatch` role (scoped to `workspace:txwatch`)
- GitHub Actions → AWS via `github-actions-txwatch` role (deploy-only)
- AppSync API key lives in Lambda environment only — never sent to browser
- Cognito JWT stored in httpOnly cookie (server-side auth via AWS SDK — no Amplify)
- AppSync token fetched from `/api/auth/me` on mount, held in memory only — never in localStorage or readable cookies
