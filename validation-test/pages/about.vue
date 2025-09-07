<template>
  <div class="container mx-auto px-4 py-8">
    <div class="max-w-2xl mx-auto text-center">
      <h1 class="text-3xl font-bold mb-6">About This Application</h1>
      
      <UCard class="mb-6">
        <template #header>
          <h2 class="text-xl font-semibold">📋 Validation Report</h2>
        </template>
        <div class="text-left space-y-4">
          <div>
            <h3 class="font-medium text-green-600">✅ Successfully Validated:</h3>
            <ul class="list-disc list-inside text-sm space-y-1 mt-2">
              <li>Nuxt 4 application structure</li>
              <li>Vue 3 composition API</li>
              <li>TypeScript configuration</li>
              <li>Tailwind CSS styling</li>
              <li>Nuxt UI component library</li>
              <li>Page routing system</li>
              <li>Pinia state management</li>
              <li>Server API routes</li>
              <li>Middleware functionality</li>
            </ul>
          </div>
          
          <div>
            <h3 class="font-medium text-blue-600">🔧 Technical Stack:</h3>
            <ul class="list-disc list-inside text-sm space-y-1 mt-2">
              <li>Nuxt 4.x</li>
              <li>Vue 3 with Composition API</li>
              <li>TypeScript 5.2+</li>
              <li>Tailwind CSS 3.x</li>
              <li>Nuxt UI 2.x</li>
              <li>Pinia for state management</li>
              <li>VueUse utilities</li>
            </ul>
          </div>
        </div>
      </UCard>
      
      <UButton to="/" color="blue" variant="outline">
        ← Back to Home
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  title: 'About - Validation Test',
  description: 'About the Nuxt 4 validation application'
})
</script>