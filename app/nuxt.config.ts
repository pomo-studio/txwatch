// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: ['@nuxtjs/tailwindcss'],

  nitro: {
    preset: 'aws-lambda',
    awsLambda: {
      streaming: false
    },
    routeRules: {
      // Dashboard is auth-gated and real-time — never cache
      '/':        { headers: { 'Cache-Control': 'no-store, private' } },
      '/login':   { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } },
      '/about':   { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } },
      // API routes
      '/api/health': { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30' } },
      '/api/tx':     { headers: { 'Cache-Control': 'no-store, no-cache' } }
    }
  },

  runtimeConfig: {
    // Private (server-only) — never exposed to the browser
    appsyncApiKey:      process.env.APPSYNC_API_KEY      || '',
    cognitoUserPoolId:  process.env.COGNITO_USER_POOL_ID || '',
    cognitoClientId:    process.env.COGNITO_CLIENT_ID    || '',
    cognitoRegion:      process.env.COGNITO_REGION       || 'us-east-1',
    eventBusName:       process.env.EVENT_BUS_NAME       || '',
    primaryRegion:      process.env.PRIMARY_REGION       || 'us-east-1',
    dynamodbTable:      process.env.DYNAMODB_TABLE        || 'txwatch-transactions',

    // Public (exposed to client) — AppSync endpoints only; no Cognito config client-side
    public: {
      appName:            'TxWatch',
      appsyncUrl:         process.env.APPSYNC_URL          || '',
      appsyncRealtimeUrl: process.env.APPSYNC_REALTIME_URL  || '',
    }
  },

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      title: 'TxWatch — Real-time Transaction Monitor',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Real-time fintech transaction monitoring powered by EventBridge, AppSync, and Nuxt SSR' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'dns-prefetch', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500&family=Inter:wght@300;400&display=swap'
        }
      ]
    }
  }
})
