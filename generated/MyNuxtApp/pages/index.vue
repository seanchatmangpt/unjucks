<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-4xl font-bold text-gray-900 mb-6">
      Welcome to MyNuxtApp
    </h1>
    <p class="text-lg text-gray-600 mb-8">
      A Nuxt 4 application generated with Unjucks CLI
    </p>
    
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div class="bg-white p-6 rounded-lg shadow-md">
        <h2 class="text-xl font-semibold mb-3">User Profile</h2>
        <p class="text-gray-600 mb-4">Manage user profiles and authentication</p>
        <NuxtLink to="/users" class="text-blue-600 hover:text-blue-800">
          View Users →
        </NuxtLink>
      </div>
      
      <div class="bg-white p-6 rounded-lg shadow-md">
        <h2 class="text-xl font-semibold mb-3">Dashboard</h2>
        <p class="text-gray-600 mb-4">Application dashboard and analytics</p>
        <NuxtLink to="/dashboard" class="text-blue-600 hover:text-blue-800">
          View Dashboard →
        </NuxtLink>
      </div>
      
      <div class="bg-white p-6 rounded-lg shadow-md">
        <h2 class="text-xl font-semibold mb-3">API Routes</h2>
        <p class="text-gray-600 mb-4">Server-side API endpoints</p>
        <a href="/api/users" class="text-blue-600 hover:text-blue-800">
          API Documentation →
        </a>
      </div>
    </div>
    
    <div class="mt-12">
      <h2 class="text-2xl font-bold mb-4">Nuxt 4 Features</h2>
      <ul class="list-disc list-inside space-y-2 text-gray-700">
        <li>Compatibility Version 4</li>
        <li>TypeScript Strict Mode</li>
        <li>Auto-imported composables</li>
        <li>Server-side rendering</li>
        <li>File-based routing</li>
        <li>Built-in state management</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
// Page metadata
useHead({
  title: 'Home - MyNuxtApp',
  meta: [
    { name: 'description', content: 'Welcome to MyNuxtApp - A Nuxt 4 application' }
  ]
})

// Reactive data
const appInfo = reactive({
  name: 'MyNuxtApp',
  version: '1.0.0',
  framework: 'Nuxt 4'
})
</script>

<style scoped>
.container {
  max-width: 1200px;
}
</style>