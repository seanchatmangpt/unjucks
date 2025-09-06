// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  
  modules: [
    '@nuxt/ui',
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@vueuse/nuxt'
  ],

  // MCP Integration for real-time swarm communication
  nitro: {
    experimental: {
      websocket: true
    },
    plugins: ['~/server/plugins/mcp-websocket.ts']
  },

  // App configuration
  app: {
    head: {
      title: 'Unjucks Enterprise',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Enterprise template generation with MCP swarm orchestration' }
      ]
    }
  },

  // Runtime config for MCP and swarm settings
  runtimeConfig: {
    mcp: {
      serverUrl: process.env.MCP_SERVER_URL || 'ws://localhost:3001',
      apiKey: process.env.MCP_API_KEY || '',
      swarmConfig: {
        maxAgents: 20,
        defaultTopology: 'mesh',
        e2eEnabled: true
      }
    },
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '/api',
      mcpEnabled: true,
      realtimeEnabled: true
    }
  },

  // TypeScript configuration
  typescript: {
    strict: true,
    typeCheck: true
  },

  // Tailwind CSS
  tailwindcss: {
    configPath: 'tailwind.config.ts',
    cssPath: '~/assets/css/main.css'
  },

  // UI configuration
  ui: {
    icons: ['heroicons', 'simple-icons'],
    safelistColors: ['primary', 'green', 'orange', 'red']
  },

  // Build optimization
  build: {
    transpile: ['@modelcontextprotocol/sdk']
  },

  // Development server
  devServer: {
    port: 3000,
    host: '0.0.0.0'
  },

  // Enable SSR for enterprise features
  ssr: true,

  // Compatibility date
  compatibilityDate: '2024-12-01'
})