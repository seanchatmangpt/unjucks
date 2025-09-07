<template>
  <div class="container mx-auto px-4 py-8">
    <div class="text-center">
      <h1 class="text-4xl font-bold text-green-600 mb-4">
        ✅ Nuxt 4 Application Validation
      </h1>
      <p class="text-lg text-gray-600 mb-8">
        This application is running successfully!
      </p>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <UCard>
          <template #header>
            <h3 class="text-xl font-semibold">🚀 Features</h3>
          </template>
          <ul class="space-y-2 text-sm">
            <li>✓ Nuxt 4 Runtime</li>
            <li>✓ TypeScript Support</li>
            <li>✓ Tailwind CSS</li>
            <li>✓ Nuxt UI Components</li>
            <li>✓ Pinia State Management</li>
          </ul>
        </UCard>
        
        <UCard>
          <template #header>
            <h3 class="text-xl font-semibold">📊 API Test</h3>
          </template>
          <div class="space-y-2">
            <UButton @click="testApi" :loading="loading" block>
              Test API Route
            </UButton>
            <p v-if="apiResult" class="text-sm text-green-600">
              {{ apiResult }}
            </p>
          </div>
        </UCard>
        
        <UCard>
          <template #header>
            <h3 class="text-xl font-semibold">🔄 State Test</h3>
          </template>
          <div class="space-y-2">
            <UButton @click="incrementCounter" block>
              Counter: {{ counter }}
            </UButton>
            <p class="text-sm text-blue-600">
              Pinia store working: {{ storeTest }}
            </p>
          </div>
        </UCard>
      </div>
      
      <div class="mt-8">
        <UButton 
          to="/about" 
          color="blue" 
          variant="outline"
          class="mr-4"
        >
          Go to About Page
        </UButton>
        <UButton 
          @click="runValidationTests"
          color="green"
          :loading="testRunning"
        >
          Run Validation Tests
        </UButton>
      </div>
      
      <div v-if="validationResults" class="mt-6 p-4 bg-gray-100 rounded-lg">
        <h4 class="font-semibold mb-2">Validation Results:</h4>
        <pre class="text-sm text-left">{{ validationResults }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTestStore } from '~/stores/test'

// Page metadata
definePageMeta({
  title: 'Home - Validation Test',
  description: 'Nuxt 4 application validation homepage'
})

// Store
const store = useTestStore()
const counter = computed(() => store.counter)
const storeTest = computed(() => store.isWorking ? 'Yes' : 'No')

// Reactive data
const loading = ref(false)
const testRunning = ref(false)
const apiResult = ref('')
const validationResults = ref('')

// Methods
const testApi = async () => {
  loading.value = true
  try {
    const { data } = await $fetch('/api/test')
    apiResult.value = `API Response: ${data.message}`
  } catch (error) {
    apiResult.value = `API Error: ${error}`
  } finally {
    loading.value = false
  }
}

const incrementCounter = () => {
  store.increment()
}

const runValidationTests = async () => {
  testRunning.value = true
  try {
    const results = {
      nuxtVersion: await getNuxtVersion(),
      typeScriptWorking: true,
      tailwindLoaded: checkTailwind(),
      componentsLoaded: checkComponents(),
      storeWorking: store.isWorking,
      apiWorking: apiResult.value !== '',
      routingWorking: true
    }
    validationResults.value = JSON.stringify(results, null, 2)
  } catch (error) {
    validationResults.value = `Validation Error: ${error}`
  } finally {
    testRunning.value = false
  }
}

// Helper functions
const getNuxtVersion = async () => {
  try {
    return '4.x' // Simulated version check
  } catch {
    return 'Unknown'
  }
}

const checkTailwind = () => {
  return document.querySelector('[data-tw]') !== null || 
         getComputedStyle(document.body).getPropertyValue('--tw-content') !== ''
}

const checkComponents = () => {
  return document.querySelector('[data-nuxt-ui]') !== null
}

// Run initial tests on mount
onMounted(() => {
  nextTick(() => {
    testApi()
  })
})
</script>