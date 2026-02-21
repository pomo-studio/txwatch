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
├── module.ssr (serverless-ssr ~> 2.2)
│   ├── CloudFront → txwatch.pomo.dev
│   ├── Lambda SSR (us-east-1 primary, us-west-2 DR)
│   ├── S3 static assets
│   └── DynamoDB txwatch-visits (page visit counter)
│
├── module.api (appsync ~> 1.0)
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
├── module.ingest_pipeline (event-pipeline ~> 1.1)
│   ├── Custom bus: txwatch-bus
│   ├── Rule: source = ["txwatch.transactions"]
│   ├── SQS main queue + DLQ
│   ├── Lambda: txwatch-enricher (enrichment + fraud scoring + AppSync mutation)
│   └── CloudWatch alarms → SNS → alarm_email
│
├── aws_lambda_function.generator
│   ├── Generates random transactions
│   └── Invoked by EventBridge Scheduler every 30s
│
├── aws_scheduler_schedule.generator
│   └── rate(30 seconds) → generator Lambda
│
└── aws_cognito_user_pool.main
    ├── txwatch-users
    └── Self-service signup (email + password, Cognito default email)
```

## Auth model

| Actor | Auth mode | AppSync operations |
|-------|-----------|-------------------|
| Browser (Cognito JWT) | `userPool` | WebSocket subscription (`onTransactionAdded`) |
| SSR Lambda | `apiKey` | `listTransactions` query (server-side page render) |
| Enricher Lambda | `iam` (sigv4) | `notifyTransaction` mutation |
| Generator Lambda | IAM execution role | `events:PutEvents` only (no AppSync) |

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
