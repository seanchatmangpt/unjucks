// Nuxt 4 Configuration
export default defineNuxtConfig({
  // Nuxt 4 features
  future: {
    compatibilityVersion: 4,
  },
  
  // Development configuration
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  
  // TypeScript configuration
  typescript: {
    strict: true,
    typeCheck: true
  },
  
  // Modules
  modules: [
    '@pinia/nuxt',
    '@nuxtjs/tailwindcss',
    '@vueuse/nuxt'
  ],
  
  // Server configuration
  nitro: {
    experimental: {
      wasm: true
    }
  },
  
  // Build configuration
  build: {
    transpile: []
  },
  
  // App configuration
  app: {
    head: {
      title: 'MyNuxtApp',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { hid: 'description', name: 'description', content: 'Nuxt 4 Application generated with Unjucks' }
      ]
    }
  },
  
  // Runtime configuration
  runtimeConfig: {
    // Private keys (only available on server-side)
    apiSecret: '123',
    // Public keys (exposed to client-side)
    public: {
      apiBase: '/api'
    }
  }
})