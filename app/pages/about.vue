<template>
  <div class="min-h-screen bg-canvas">
    <!-- Nav -->
    <nav class="border-b border-ink/10 px-6 py-4 flex items-center justify-between">
      <NuxtLink to="/" class="text-xs font-display tracking-widest2 text-ink/40 uppercase">
        postmodern.
      </NuxtLink>
      <span class="text-sm font-display text-ink">TxWatch</span>
    </nav>

    <main class="max-w-3xl mx-auto px-6 py-16">
      <p class="text-xs font-display tracking-widest2 text-ink/40 uppercase mb-4">Architecture</p>
      <h1 class="text-3xl font-display font-medium text-ink mb-4">How TxWatch works</h1>
      <p class="text-ink/60 text-sm leading-relaxed mb-12">
        TxWatch is a living reference implementation that exercises every pomo-studio
        Terraform module in one coherent application — a plausible, production-shaped
        fintech demo.
      </p>

      <!-- Event flow -->
      <section class="mb-16">
        <h2 class="text-lg font-display font-medium mb-4">Event flow</h2>
        <div class="bg-ink text-canvas font-mono text-xs p-6 overflow-x-auto">
          <pre>User clicks "New Transaction"      EventBridge Scheduler (every 30s)
          │                                        │
          ▼                                        ▼
  SSR route /api/tx               generator Lambda
  (events:PutEvents)              (events:PutEvents)
          │                                        │
          └──────────────┬─────────────────────────┘
                         │  source = "txwatch.transactions"
                         ▼
             EventBridge custom bus (txwatch-bus)
                         │
                         ▼
                     SQS Queue
                         │
                  enricher Lambda
                  │  enrich → score → write DynamoDB
                  └──► AppSync notifyTransaction (AWS_IAM)
                                   │
                        WebSocket subscription fires
                                   │
                        Browser — transaction prepends to feed</pre>
        </div>
      </section>

      <!-- Modules -->
      <section class="mb-16">
        <h2 class="text-lg font-display font-medium mb-6">Modules used</h2>
        <div class="space-y-4">
          <div v-for="mod in modules" :key="mod.name" class="border border-ink/10 p-5">
            <div class="flex items-start justify-between mb-2">
              <div>
                <p class="text-xs font-mono text-ink/50">{{ mod.registry }}</p>
                <h3 class="text-sm font-display font-medium text-ink">{{ mod.name }}</h3>
              </div>
              <span class="text-xs font-mono text-ink/40">{{ mod.version }}</span>
            </div>
            <p class="text-sm text-ink/60 leading-relaxed">{{ mod.role }}</p>
          </div>
        </div>
      </section>

      <!-- Data model -->
      <section class="mb-16">
        <h2 class="text-lg font-display font-medium mb-4">Transaction schema</h2>
        <div class="bg-ink text-canvas font-mono text-xs p-6">
          <pre>txwatch-transactions (DynamoDB)
PK: TX#&lt;uuid&gt;
SK: &lt;ISO-timestamp&gt;

Fields:
  transactionId       uuid-v4
  amount              USD amount
  currency            "USD"
  merchant            enriched merchant name
  category            grocery | restaurant | gas | travel | atm | online
  status              cleared | flagged
  riskScore           0–100 (rule-based)
  fraudFlag           true if riskScore > 70
  source              manual | auto
  processingRegion    us-east-1 | us-west-2
  processingLatencyMs EventBridge publish → DynamoDB write
  eventId             EventBridge event ID

GSIs:
  AllTransactionsIndex   (entity_type, createdAt) — time-sorted feed
  CategoryTimestampIndex (category, createdAt) — analytics</pre>
        </div>
      </section>

      <!-- Auth model -->
      <section>
        <h2 class="text-lg font-display font-medium mb-4">Auth model</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="border-b border-ink/10">
                <th class="text-left py-2 pr-4 font-display font-medium text-xs text-ink/60">Actor</th>
                <th class="text-left py-2 pr-4 font-display font-medium text-xs text-ink/60">Auth mode</th>
                <th class="text-left py-2 font-display font-medium text-xs text-ink/60">Operations</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in authTable" :key="row.actor" class="border-b border-ink/5">
                <td class="py-3 pr-4 font-mono text-xs text-ink/70">{{ row.actor }}</td>
                <td class="py-3 pr-4 text-xs">{{ row.mode }}</td>
                <td class="py-3 text-xs text-ink/60">{{ row.ops }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
const modules = [
  {
    name: 'serverless-ssr',
    registry: 'pomo-studio/serverless-ssr/aws',
    version: '~> 2.2',
    role: 'SSR frontend — Nuxt 3 on Lambda behind CloudFront with multi-region failover. Serves the dashboard, handles auth cookies, and fires transactions via /api/tx.'
  },
  {
    name: 'event-pipeline',
    registry: 'pomo-studio/event-pipeline/aws',
    version: '~> 1.1',
    role: 'Enrichment pipeline: EventBridge custom bus (txwatch-bus) → SQS with DLQ → enricher Lambda. Handles retry logic, dead-letter queue, and CloudWatch alarms.'
  },
  {
    name: 'appsync',
    registry: 'pomo-studio/appsync/aws',
    version: '~> 1.0',
    role: 'GraphQL API with real-time subscriptions. Three auth modes: Cognito (browser), AWS_IAM (Lambda mutations), API_KEY (SSR server-side queries). Resolvers in APPSYNC_JS runtime.'
  },
  {
    name: 'workspace',
    registry: 'pomo-studio/workspace/tfe',
    version: '~> 1.0',
    role: 'TFC workspace management in the pomo core repo. Provisions the txwatch workspace with OIDC dynamic credentials — no static AWS keys.'
  },
  {
    name: 'oidc',
    registry: 'pomo-studio/oidc/aws',
    version: '~> 2.0',
    role: 'OIDC federation for Terraform Cloud and GitHub Actions. All AWS access is role-based with short-lived credentials scoped to txwatch-* resources.'
  }
]

const authTable = [
  { actor: 'Browser client',   mode: 'Cognito JWT',      ops: 'WebSocket subscriptions (onTransactionAdded)' },
  { actor: 'SSR Lambda',       mode: 'API_KEY',           ops: 'Server-side listTransactions on page load' },
  { actor: 'Enricher Lambda',  mode: 'AWS_IAM (sigv4)',   ops: 'notifyTransaction mutation after DynamoDB write' },
  { actor: 'Generator Lambda', mode: 'IAM execution role', ops: 'EventBridge PutEvents only' }
]
</script>
