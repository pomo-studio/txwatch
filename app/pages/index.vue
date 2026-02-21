<template>
  <div class="min-h-screen bg-canvas">
    <!-- Nav -->
    <nav class="border-b border-ink/10 px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-4">
        <span class="text-xs font-display tracking-widest2 text-ink/40 uppercase">postmodern.</span>
        <span class="text-ink/20">|</span>
        <span class="text-sm font-display text-ink">TxWatch</span>
      </div>
      <div class="flex items-center gap-4">
        <NuxtLink to="/about" class="text-xs text-ink/40 hover:text-ink">Architecture</NuxtLink>
        <button @click="signOut" class="text-xs text-ink/40 hover:text-ink">Sign out</button>
      </div>
    </nav>

    <main class="max-w-5xl mx-auto px-6 py-8">
      <!-- Header + Simulator -->
      <div class="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-display font-medium text-ink">Transaction Feed</h1>
          <p class="text-sm text-ink/40 mt-1">Live — EventBridge → SQS → Lambda → AppSync → WebSocket</p>
        </div>

        <!-- Simulator controls -->
        <div class="flex flex-col gap-3">
          <!-- Category chips -->
          <div class="flex gap-1 flex-wrap">
            <button
              v-for="cat in categories"
              :key="cat.value"
              @click="selectedCategory = cat.value"
              :class="[
                'px-2 py-1 text-xs font-mono border transition-colors',
                selectedCategory === cat.value
                  ? 'bg-ink text-canvas border-ink'
                  : 'bg-canvas text-ink/60 border-ink/20 hover:border-ink/60'
              ]"
            >
              {{ cat.label }}
            </button>
          </div>

          <!-- Controls row -->
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-2 text-xs text-ink/60 cursor-pointer">
              <input type="checkbox" v-model="flagIt" class="accent-rose-600" />
              <span>Flag it</span>
            </label>

            <button
              @click="fireTx"
              :disabled="firing"
              class="px-4 py-2 bg-ink text-canvas text-xs font-display tracking-wide hover:bg-ink/80 disabled:opacity-50 transition-opacity"
            >
              {{ firing ? 'Firing...' : '+ New Transaction' }}
            </button>
          </div>

          <p v-if="txError" class="text-xs text-rose-600">{{ txError }}</p>
        </div>
      </div>

      <!-- Stats panel -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div v-for="stat in statCards" :key="stat.label" class="border border-ink/10 p-4">
          <p class="text-xs font-display tracking-wide text-ink/40 mb-1">{{ stat.label }}</p>
          <p class="text-2xl font-display font-medium text-ink">{{ stat.value }}</p>
        </div>
      </div>

      <!-- Feed -->
      <div class="space-y-0">
        <!-- Empty state -->
        <div v-if="transactions.length === 0" class="border border-ink/10 p-12 text-center">
          <p class="text-sm text-ink/40">Waiting for transactions...</p>
          <p class="text-xs text-ink/30 mt-2">Auto-generator fires every 30 seconds</p>
        </div>

        <!-- Transaction rows -->
        <TransitionGroup name="tx-feed" tag="div">
          <div
            v-for="tx in transactions"
            :key="tx.transactionId"
            class="border-b border-ink/10 py-4 flex items-start justify-between gap-4"
          >
            <!-- Left: merchant + meta -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-sm font-display font-medium text-ink truncate">{{ tx.merchant }}</span>
                <span
                  v-if="tx.fraudFlag"
                  class="px-1.5 py-0.5 text-xs font-mono"
                  :class="tx.riskScore > 90 ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-500'"
                >
                  {{ tx.riskScore > 90 ? 'FLAGGED' : 'HIGH RISK' }}
                </span>
                <span v-if="tx.source === 'auto'" class="px-1.5 py-0.5 text-xs font-mono bg-ink/5 text-ink/40">auto</span>
              </div>
              <div class="flex items-center gap-3 text-xs text-ink/40">
                <span class="font-mono uppercase">{{ tx.category }}</span>
                <span class="font-mono">{{ tx.processingRegion }}</span>
                <span>{{ tx.processingLatencyMs }}ms</span>
                <span>{{ formatTime(tx.createdAt) }}</span>
              </div>
            </div>

            <!-- Right: amount + risk -->
            <div class="flex items-center gap-4 shrink-0">
              <div class="text-right">
                <p class="text-sm font-mono font-medium text-ink">${{ tx.amount.toFixed(2) }}</p>
                <p class="text-xs font-mono text-ink/40">{{ tx.currency }}</p>
              </div>
              <div
                class="w-10 h-10 flex items-center justify-center text-xs font-mono font-medium"
                :class="riskClass(tx.riskScore)"
              >
                {{ tx.riskScore }}
              </div>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </main>

    <!-- Footer -->
    <footer class="border-t border-ink/10 px-6 py-4 mt-8">
      <div class="max-w-5xl mx-auto flex items-center justify-between text-xs text-ink/30 font-mono">
        <span>txwatch-bus</span>
        <span>txwatch.pomo.dev</span>
        <NuxtLink to="/about" class="hover:text-ink/60">Architecture →</NuxtLink>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { signOut as amplifySignOut, getCurrentUser } from 'aws-amplify/auth'
import { Amplify } from 'aws-amplify'
import type { Transaction } from '~/composables/useTransactions'

const config = useRuntimeConfig()

// Configure Amplify on client
if (import.meta.client) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId:       config.public.cognitoRegion + '_' + config.public.cognitoClientId,
        userPoolClientId: config.public.cognitoClientId,
        loginWith: { email: true }
      }
    },
    API: {
      GraphQL: {
        endpoint: config.public.appsyncUrl,
        region:   config.public.cognitoRegion,
        defaultAuthMode: 'userPool'
      }
    }
  })
}

// SSR: load initial transactions from AppSync via API key
const { data: initial } = await useFetch('/api/txfeed')
const initialItems = (initial.value as any)?.items ?? []

// Real-time subscription
const { transactions, riskClass, riskLabel } = useTransactions(initialItems)

// Stats derived from the feed
const statCards = computed(() => {
  const items = transactions.value
  if (!items.length) {
    return [
      { label: 'Transactions', value: '0' },
      { label: 'Volume', value: '$0.00' },
      { label: 'Fraud rate', value: '0%' },
      { label: 'Avg risk', value: '0' }
    ]
  }
  const total = items.length
  const volume = items.reduce((s, t) => s + t.amount, 0)
  const fraud = items.filter(t => t.fraudFlag).length
  const avgRisk = Math.round(items.reduce((s, t) => s + t.riskScore, 0) / total)
  return [
    { label: 'Transactions', value: total.toString() },
    { label: 'Volume', value: `$${volume.toFixed(0)}` },
    { label: 'Fraud rate', value: `${((fraud / total) * 100).toFixed(1)}%` },
    { label: 'Avg risk', value: avgRisk.toString() }
  ]
})

// Simulator
const categories = [
  { value: 'random', label: 'Random' },
  { value: 'grocery', label: 'Grocery' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'gas', label: 'Gas' },
  { value: 'travel', label: 'Travel' },
  { value: 'atm', label: 'ATM' },
  { value: 'online', label: 'Online' }
]

const selectedCategory = ref<string>('random')
const flagIt = ref(false)
const firing = ref(false)
const txError = ref('')

async function fireTx() {
  firing.value = true
  txError.value = ''
  try {
    await $fetch('/api/tx', {
      method: 'POST',
      body: {
        category: selectedCategory.value === 'random' ? undefined : selectedCategory.value,
        flagIt:   flagIt.value
      }
    })
  } catch (e: any) {
    txError.value = e.message || 'Failed to fire transaction'
  } finally {
    firing.value = false
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  })
}

async function signOut() {
  await amplifySignOut()
  await navigateTo('/login')
}
</script>

<style scoped>
.tx-feed-enter-active {
  transition: all 0.3s ease;
}
.tx-feed-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
