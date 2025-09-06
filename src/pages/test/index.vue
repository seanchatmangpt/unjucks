<template>
  <div class="container mx-auto p-6">
    <h1 class="text-3xl font-bold mb-6">Ollama API Test Suite</h1>
    
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <!-- Generate Test -->
      <div class="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
        <h2 class="text-xl font-semibold mb-3">Generate Test</h2>
        <p class="text-gray-600 mb-4">
          Test the text generation endpoint with streaming and non-streaming options.
        </p>
        <NuxtLink
          to="/test/generate"
          class="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
        >
          Test Generate API
        </NuxtLink>
      </div>
      
      <!-- Chat Test -->
      <div class="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
        <h2 class="text-xl font-semibold mb-3">Chat Test</h2>
        <p class="text-gray-600 mb-4">
          Interactive chat interface with conversation history and streaming responses.
        </p>
        <NuxtLink
          to="/test/chat"
          class="inline-block bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
        >
          Test Chat API
        </NuxtLink>
      </div>
      
      <!-- Models Test -->
      <div class="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
        <h2 class="text-xl font-semibold mb-3">Models Management</h2>
        <p class="text-gray-600 mb-4">
          View available models and pull new ones from Ollama registry.
        </p>
        <NuxtLink
          to="/test/models"
          class="inline-block bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
        >
          Manage Models
        </NuxtLink>
      </div>
    </div>
    
    <!-- System Status -->
    <div class="mt-8">
      <h2 class="text-2xl font-bold mb-4">System Status</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Connection Status -->
        <div class="bg-white border border-gray-200 rounded-lg p-6">
          <h3 class="text-lg font-semibold mb-3">Ollama Connection</h3>
          
          <div v-if="connectionLoading" class="flex items-center space-x-2">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span class="text-gray-600">Checking connection...</span>
          </div>
          
          <div v-else-if="connectionStatus" class="flex items-center space-x-2">
            <div class="h-3 w-3 bg-green-500 rounded-full"></div>
            <span class="text-green-700 font-medium">Connected</span>
          </div>
          
          <div v-else class="flex items-center space-x-2">
            <div class="h-3 w-3 bg-red-500 rounded-full"></div>
            <span class="text-red-700 font-medium">Disconnected</span>
          </div>
          
          <div v-if="connectionError" class="mt-2 text-sm text-red-600">
            {{ connectionError }}
          </div>
        </div>
        
        <!-- Available Models -->
        <div class="bg-white border border-gray-200 rounded-lg p-6">
          <h3 class="text-lg font-semibold mb-3">Available Models</h3>
          
          <div v-if="modelsLoading" class="flex items-center space-x-2">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span class="text-gray-600">Loading models...</span>
          </div>
          
          <div v-else-if="models.length > 0" class="space-y-2">
            <div
              v-for="model in models.slice(0, 3)"
              :key="model.name"
              class="flex items-center justify-between text-sm"
            >
              <span class="font-medium">{{ model.name }}</span>
              <span class="text-gray-500">
                {{ formatSize(model.size) }}
              </span>
            </div>
            
            <div v-if="models.length > 3" class="text-sm text-gray-500">
              + {{ models.length - 3 }} more models
            </div>
          </div>
          
          <div v-else class="text-gray-500">
            No models found
          </div>
        </div>
      </div>
    </div>
    
    <!-- API Documentation -->
    <div class="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
      <h2 class="text-2xl font-bold mb-4">API Documentation</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 class="text-lg font-semibold mb-2">Endpoints</h3>
          <ul class="space-y-2 text-sm">
            <li><code class="bg-gray-200 px-2 py-1 rounded">POST /api/ollama/generate</code></li>
            <li><code class="bg-gray-200 px-2 py-1 rounded">POST /api/ollama/chat</code></li>
            <li><code class="bg-gray-200 px-2 py-1 rounded">GET /api/ollama/models</code></li>
            <li><code class="bg-gray-200 px-2 py-1 rounded">POST /api/ollama/pull</code></li>
          </ul>
        </div>
        
        <div>
          <h3 class="text-lg font-semibold mb-2">Features</h3>
          <ul class="space-y-2 text-sm">
            <li>✅ Streaming responses</li>
            <li>✅ Chat conversations</li>
            <li>✅ Model management</li>
            <li>✅ Error handling</li>
            <li>✅ TypeScript support</li>
            <li>✅ Authentication middleware</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Model } from '../../types/ollama'

const { listModels } = useOllamaAPI()

const connectionStatus = ref<boolean>(false)
const connectionLoading = ref<boolean>(true)
const connectionError = ref<string>('')

const models = ref<Model[]>([])
const modelsLoading = ref<boolean>(true)

const formatSize = (bytes: number | undefined): string => {
  if (!bytes) return 'Unknown'
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

const checkConnection = async () => {
  try {
    connectionLoading.value = true
    connectionError.value = ''
    
    const response = await listModels()
    connectionStatus.value = true
    models.value = response.models || []
  } catch (error: any) {
    connectionStatus.value = false
    connectionError.value = error.message || 'Failed to connect to Ollama'
    models.value = []
  } finally {
    connectionLoading.value = false
    modelsLoading.value = false
  }
}

// Check connection on mount
onMounted(() => {
  checkConnection()
})

useSeoMeta({
  title: 'Ollama API Test Suite',
  description: 'Complete test suite for Ollama API integration'
})
</script>