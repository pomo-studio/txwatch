<template>
  <div class="min-h-screen bg-canvas flex items-center justify-center px-4">
    <div class="w-full max-w-sm">

      <!-- Header -->
      <div class="mb-8">
        <p class="text-xs font-display tracking-widest2 text-ink/40 uppercase mb-2">postmodern.</p>
        <h1 class="text-2xl font-display font-medium text-ink">TxWatch</h1>
        <p class="text-sm text-ink/50 mt-1">Real-time transaction monitoring</p>
      </div>

      <!-- Error -->
      <div v-if="error" class="mb-4 px-3 py-2 bg-rose-100 text-rose-600 text-sm">
        {{ error }}
      </div>

      <!-- Success -->
      <div v-if="success" class="mb-4 px-3 py-2 bg-emerald-50 text-emerald-700 text-sm">
        {{ success }}
      </div>

      <!-- Sign in -->
      <template v-if="mode === 'login'">
        <form @submit.prevent="handleSignIn" class="space-y-4">
          <div>
            <label class="block text-xs font-display tracking-wide text-ink/60 mb-1">Email</label>
            <input
              v-model="email"
              type="email"
              required
              autocomplete="email"
              class="w-full px-3 py-2 border border-ink/20 bg-white text-ink text-sm focus:outline-none focus:border-ink"
            />
          </div>
          <div>
            <label class="block text-xs font-display tracking-wide text-ink/60 mb-1">Password</label>
            <input
              v-model="password"
              type="password"
              required
              autocomplete="current-password"
              class="w-full px-3 py-2 border border-ink/20 bg-white text-ink text-sm focus:outline-none focus:border-ink"
            />
          </div>
          <button
            type="submit"
            :disabled="loading"
            class="w-full py-2 bg-ink text-canvas text-sm font-display tracking-wide hover:bg-ink/80 disabled:opacity-50 transition-opacity"
          >
            {{ loading ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>
        <div class="mt-6 text-center">
          <span class="text-xs text-ink/40">No account? </span>
          <button @click="switchTo('signup')" class="text-xs text-ink underline">Create one</button>
        </div>
      </template>

      <!-- Sign up -->
      <template v-else-if="mode === 'signup'">
        <form @submit.prevent="handleSignUp" class="space-y-4">
          <div>
            <label class="block text-xs font-display tracking-wide text-ink/60 mb-1">Email</label>
            <input
              v-model="email"
              type="email"
              required
              autocomplete="email"
              class="w-full px-3 py-2 border border-ink/20 bg-white text-ink text-sm focus:outline-none focus:border-ink"
            />
          </div>
          <div>
            <label class="block text-xs font-display tracking-wide text-ink/60 mb-1">Password</label>
            <input
              v-model="password"
              type="password"
              required
              minlength="8"
              autocomplete="new-password"
              class="w-full px-3 py-2 border border-ink/20 bg-white text-ink text-sm focus:outline-none focus:border-ink"
            />
            <p class="mt-1 text-xs text-ink/40">Min 8 chars · uppercase · number</p>
          </div>
          <button
            type="submit"
            :disabled="loading"
            class="w-full py-2 bg-ink text-canvas text-sm font-display tracking-wide hover:bg-ink/80 disabled:opacity-50 transition-opacity"
          >
            {{ loading ? 'Creating account…' : 'Create account' }}
          </button>
        </form>
        <div class="mt-6 text-center">
          <button @click="switchTo('login')" class="text-xs text-ink/50 hover:text-ink underline">
            Back to sign in
          </button>
        </div>
      </template>

      <!-- Confirm -->
      <template v-else-if="mode === 'confirm'">
        <p class="text-sm text-ink/60 mb-4">
          A verification code was sent to <strong class="text-ink">{{ email }}</strong>.
        </p>
        <form @submit.prevent="handleConfirm" class="space-y-4">
          <div>
            <label class="block text-xs font-display tracking-wide text-ink/60 mb-1">Verification code</label>
            <input
              v-model="code"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              placeholder="000000"
              required
              class="w-full px-3 py-2 border border-ink/20 bg-white text-ink text-sm focus:outline-none focus:border-ink text-center tracking-widest"
            />
          </div>
          <button
            type="submit"
            :disabled="loading"
            class="w-full py-2 bg-ink text-canvas text-sm font-display disabled:opacity-50 transition-opacity"
          >
            {{ loading ? 'Verifying…' : 'Verify & sign in' }}
          </button>
        </form>
        <div class="mt-4 text-center">
          <button @click="switchTo('login')" class="text-xs text-ink/50 hover:text-ink underline">
            Back to sign in
          </button>
        </div>
      </template>

    </div>
  </div>
</template>

<script setup lang="ts">
type Mode = 'login' | 'signup' | 'confirm'

const mode     = ref<Mode>('login')
const email    = ref('')
const password = ref('')
const code     = ref('')
const error    = ref('')
const success  = ref('')
const loading  = ref(false)

function switchTo(next: Mode) {
  error.value   = ''
  success.value = ''
  mode.value    = next
}

async function post(url: string, body: Record<string, string>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message ?? 'Request failed')
  return data
}

async function handleSignIn() {
  error.value   = ''
  loading.value = true
  try {
    await post('/api/auth/signin', { email: email.value, password: password.value })
    await navigateTo('/')
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function handleSignUp() {
  error.value   = ''
  loading.value = true
  try {
    const res = await post('/api/auth/signup', { email: email.value, password: password.value })
    if (res.needsConfirmation) {
      mode.value = 'confirm'
    } else {
      // Auto-confirmed (e.g. admin-created accounts)
      await navigateTo('/')
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function handleConfirm() {
  error.value   = ''
  loading.value = true
  try {
    const res = await post('/api/auth/confirm', {
      email:    email.value,
      password: password.value,
      code:     code.value,
    })
    if (res.signedIn) {
      await navigateTo('/')
    } else {
      success.value = 'Account confirmed! Please sign in.'
      switchTo('login')
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>
