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

      <!-- Login form -->
      <form @submit.prevent="handleSubmit" class="space-y-4">
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
          {{ loading ? 'Signing in...' : 'Sign in' }}
        </button>
      </form>

      <!-- Sign up link -->
      <div class="mt-6 text-center">
        <span class="text-xs text-ink/40">No account? </span>
        <button @click="showSignUp = true" class="text-xs text-ink underline">Create one</button>
      </div>

      <!-- Sign up form -->
      <div v-if="showSignUp" class="mt-8 pt-8 border-t border-ink/10">
        <h2 class="text-sm font-display font-medium mb-4">Create account</h2>
        <form @submit.prevent="handleSignUp" class="space-y-4">
          <div>
            <label class="block text-xs font-display tracking-wide text-ink/60 mb-1">Email</label>
            <input
              v-model="signupEmail"
              type="email"
              required
              class="w-full px-3 py-2 border border-ink/20 bg-white text-ink text-sm focus:outline-none focus:border-ink"
            />
          </div>
          <div>
            <label class="block text-xs font-display tracking-wide text-ink/60 mb-1">Password</label>
            <input
              v-model="signupPassword"
              type="password"
              required
              minlength="8"
              class="w-full px-3 py-2 border border-ink/20 bg-white text-ink text-sm focus:outline-none focus:border-ink"
            />
          </div>
          <button
            type="submit"
            :disabled="loading"
            class="w-full py-2 bg-ink text-canvas text-sm font-display tracking-wide hover:bg-ink/80 disabled:opacity-50"
          >
            {{ loading ? 'Creating...' : 'Create account' }}
          </button>
        </form>

        <!-- Confirmation code -->
        <div v-if="needsConfirmation" class="mt-4">
          <p class="text-xs text-ink/60 mb-2">Check your email for a confirmation code.</p>
          <form @submit.prevent="handleConfirm" class="space-y-3">
            <input
              v-model="confirmCode"
              type="text"
              placeholder="000000"
              class="w-full px-3 py-2 border border-ink/20 bg-white text-ink text-sm focus:outline-none focus:border-ink text-center tracking-widest"
            />
            <button
              type="submit"
              :disabled="loading"
              class="w-full py-2 bg-ink text-canvas text-sm font-display disabled:opacity-50"
            >
              Confirm
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Amplify } from 'aws-amplify'
import { signIn, signUp, confirmSignUp } from 'aws-amplify/auth'

const config = useRuntimeConfig()

// Configure Amplify on client
onMounted(() => {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId:       `${config.public.cognitoRegion}_${config.public.cognitoClientId}`.replace(/_.+$/, '') + '_' + config.public.cognitoClientId,
        userPoolClientId: config.public.cognitoClientId,
        loginWith: { username: false, email: true }
      }
    }
  })
})

const email = ref('')
const password = ref('')
const signupEmail = ref('')
const signupPassword = ref('')
const confirmCode = ref('')
const error = ref('')
const loading = ref(false)
const showSignUp = ref(false)
const needsConfirmation = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    const result = await signIn({ username: email.value, password: password.value })
    if (result.isSignedIn) {
      await navigateTo('/')
    }
  } catch (e: any) {
    error.value = e.message || 'Sign in failed'
  } finally {
    loading.value = false
  }
}

async function handleSignUp() {
  error.value = ''
  loading.value = true
  try {
    const result = await signUp({
      username: signupEmail.value,
      password: signupPassword.value,
      options: { userAttributes: { email: signupEmail.value } }
    })
    if (result.nextStep?.signUpStep === 'CONFIRM_SIGN_UP') {
      needsConfirmation.value = true
    }
  } catch (e: any) {
    error.value = e.message || 'Sign up failed'
  } finally {
    loading.value = false
  }
}

async function handleConfirm() {
  error.value = ''
  loading.value = true
  try {
    await confirmSignUp({ username: signupEmail.value, confirmationCode: confirmCode.value })
    // Auto sign in after confirmation
    const result = await signIn({ username: signupEmail.value, password: signupPassword.value })
    if (result.isSignedIn) {
      await navigateTo('/')
    }
  } catch (e: any) {
    error.value = e.message || 'Confirmation failed'
  } finally {
    loading.value = false
  }
}
</script>
