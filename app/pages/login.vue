<template>
  <div class="min-h-screen bg-canvas flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <div class="mb-8">
        <p class="text-xs font-display tracking-widest2 text-ink/40 uppercase mb-2">postmodern.</p>
        <h1 class="text-2xl font-display font-medium text-ink">TxWatch</h1>
        <p class="text-sm text-ink/50 mt-1">Real-time transaction monitoring</p>
      </div>

      <a
        href="/api/auth/redirect"
        class="w-full block py-2 bg-ink text-canvas text-sm font-display tracking-wide text-center hover:bg-ink/80 transition-opacity"
      >
        Continue with Cognito
      </a>
      <p class="mt-4 text-xs text-ink/40 text-center">
        Sign in and sign up are handled by Cognito Hosted UI.
      </p>
    </div>
  </div>
</template>
