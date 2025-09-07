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
    plugins: ['~/server/plugins/mcp-websocket.js']
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

  // Runtime config for MCP and swarm settings + Ollama API
  runtimeConfig: {
    // Private keys (only available on server-side)
    ollamaBaseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    ollamaApiKey: process.env.OLLAMA_API_KEY || '',
    ollamaAuthToken: process.env.OLLAMA_AUTH_TOKEN || '',
    
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
      // Ollama API configuration (exposed to client-side)
      ollamaBaseURL: process.env.NUXT_PUBLIC_OLLAMA_BASE_URL || 'http://localhost:11434',
      ollamaRequireAuth: process.env.NUXT_PUBLIC_OLLAMA_REQUIRE_AUTH === 'true',
      
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '/api',
      mcpEnabled: true,
      realtimeEnabled: true
    }
  },

  // TypeScript configuration - keeping type checking enabled
  typescript: {
    strict: true,
    typeCheck: false // Disabled for JavaScript conversion
  },

  // Tailwind CSS
  tailwindcss: {
    configPath: 'tailwind.config.js',
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
});
