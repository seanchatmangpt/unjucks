<template>
  <div class="container mx-auto p-6">
    <h1 class="text-3xl font-bold mb-6">Ollama Models Management</h1>
    
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Available Models -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold">Available Models</h2>
          <button
            :disabled="loading"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:bg-gray-400"
            @click="refreshModels"
          >
            {{ loading ? 'Loading...' : 'Refresh' }}
          </button>
        </div>
        
        <div v-if="loading" class="flex justify-center p-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
        
        <div
          v-else-if="models.length > 0"
          class="space-y-3 max-h-96 overflow-y-auto"
        >
          <div
            v-for="model in models"
            :key="model.name"
            class="bg-white border border-gray-200 rounded-lg p-4"
          >
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-semibold">{{ model.name }}</h3>
                <p class="text-sm text-gray-600">
                  Size: {{ formatSize(model.size) }}
                </p>
                <p class="text-xs text-gray-500">
                  Modified: {{ formatDate(model.modified_at) }}
                </p>
              </div>
              
              <div class="text-right">
                <div class="text-xs text-gray-500 mb-2">
                  {{ model.digest?.substring(0, 12) }}...
                </div>
                <button
                  class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded font-semibold transition-colors"
                  @click="selectModel(model.name || '')"
                >
                  Use Model
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div v-else class="text-center p-8 text-gray-500">
          <p>No models found</p>
          <p class="text-sm">Try pulling a model to get started</p>
        </div>
        
        <div v-if="error" class="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-red-700 font-medium">Error:</p>
          <p class="text-red-600">{{ error }}</p>
        </div>
      </div>
      
      <!-- Pull New Model -->
      <div class="space-y-4">
        <h2 class="text-xl font-semibold">Pull New Model</h2>
        
        <div class="space-y-4">
          <div>
            <label for="modelName" class="block text-sm font-medium mb-2">
              Model Name
            </label>
            <input
              id="modelName"
              v-model="pullForm.name"
              type="text"
              placeholder="e.g., llama2, codellama, mistral"
              class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
            <p class="text-xs text-gray-500 mt-1">
              Enter the model name from Ollama registry
            </p>
          </div>
          
          <div class="space-y-2">
            <h3 class="font-semibold">Popular Models</h3>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="model in popularModels"
                :key="model"
                class="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm transition-colors"
                @click="pullForm.name = model"
              >
                {{ model }}
              </button>
            </div>
          </div>
          
          <div class="flex items-center space-x-4">
            <label class="flex items-center">
              <input
                v-model="pullForm.stream"
                type="checkbox"
                class="mr-2"
              >
              Show Progress
            </label>
            
            <label class="flex items-center">
              <input
                v-model="pullForm.insecure"
                type="checkbox"
                class="mr-2"
              >
              Allow Insecure
            </label>
          </div>
          
          <button
            :disabled="!pullForm.name.trim() || pullLoading"
            :class="[
              'w-full px-4 py-3 rounded-lg font-semibold transition-colors',
              !pullForm.name.trim() || pullLoading
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            ]"
            @click="handlePullModel"
          >
            {{ pullLoading ? 'Pulling...' : 'Pull Model' }}
          </button>
        </div>
        
        <!-- Pull Progress -->
        <div
          v-if="pullProgress"
          class="space-y-3"
        >
          <h3 class="font-semibold">Pull Progress</h3>
          
          <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium">{{ pullProgress.status }}</span>
              <span class="text-sm text-gray-600">
                {{ formatProgress(pullProgress.completed, pullProgress.total) }}
              </span>
            </div>
            
            <div
              v-if="pullProgress.total && pullProgress.completed"
              class="w-full bg-gray-200 rounded-full h-2"
            >
              <div
                class="bg-green-600 h-2 rounded-full transition-all duration-300"
                :style="{
                  width: `${Math.min(100, (pullProgress.completed / pullProgress.total) * 100)}%`
                }"
              />
            </div>
          </div>
        </div>
        
        <!-- Quick Test -->
        <div
          v-if="selectedModel"
          class="bg-blue-50 border border-blue-200 rounded-lg p-4"
        >
          <h3 class="font-semibold mb-2">Quick Test: {{ selectedModel }}</h3>
          
          <div class="space-y-2">
            <input
              v-model="testPrompt"
              type="text"
              placeholder="Enter a test prompt..."
              class="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              @keyup.enter="runQuickTest"
            >
            
            <div class="flex space-x-2">
              <button
                :disabled="!testPrompt.trim() || testLoading"
                :class="[
                  'px-4 py-2 rounded-lg font-semibold transition-colors',
                  !testPrompt.trim() || testLoading
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                ]"
                @click="runQuickTest"
              >
                {{ testLoading ? 'Testing...' : 'Test' }}
              </button>
              
              <NuxtLink
                :to="`/test/generate?model=${selectedModel}&prompt=${encodeURIComponent(testPrompt)}`"
                class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
              >
                Full Test
              </NuxtLink>
            </div>
            
            <div
              v-if="testResponse"
              class="p-3 bg-white border border-gray-200 rounded text-sm"
            >
              {{ testResponse }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Model, PullRequest, PullResponse, GenerateRequest } from '../../types/ollama'

const { listModels, pullModel, pullModelStream, generate, loading, error, clearError } = useOllamaAPI()

const models = ref<Model[]>([])
const selectedModel = ref<string>('')
const testPrompt = ref<string>('Hello, how are you?')
const testResponse = ref<string>('')
const testLoading = ref<boolean>(false)

const pullForm = ref<PullRequest>({
  name: '',
  stream: true,
  insecure: false
})

const pullLoading = ref<boolean>(false)
const pullProgress = ref<PullResponse | null>(null)

const popularModels = [
  'llama2',
  'llama2:13b',
  'codellama',
  'mistral',
  'phi',
  'neural-chat',
  'starling-lm',
  'orca-mini'
]

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

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'Unknown'
  
  try {
    return new Date(dateString).toLocaleDateString()
  } catch {
    return 'Invalid date'
  }
}

const formatProgress = (completed: number | undefined, total: number | undefined): string => {
  if (!completed && !total) return ''
  if (!total) return `${completed || 0} bytes`
  
  const percentage = Math.min(100, ((completed || 0) / total) * 100)
  return `${percentage.toFixed(1)}% (${formatSize(completed)} / ${formatSize(total)})`
}

const refreshModels = async () => {
  try {
    clearError()
    const response = await listModels()
    models.value = response.models || []
  } catch (err) {
    console.error('Failed to refresh models:', err)
  }
}

const selectModel = (modelName: string) => {
  selectedModel.value = modelName
  testResponse.value = ''
}

const handlePullModel = async () => {
  if (!pullForm.value.name.trim()) return
  
  try {
    pullLoading.value = true
    pullProgress.value = null
    clearError()
    
    if (pullForm.value.stream) {
      await pullModelStream(pullForm.value, (progress) => {
        pullProgress.value = progress
      })
    } else {
      const result = await pullModel(pullForm.value)
      pullProgress.value = result
    }
    
    // Refresh models after pull
    await refreshModels()
    pullForm.value.name = ''
  } catch (err) {
    console.error('Failed to pull model:', err)
  } finally {
    pullLoading.value = false
  }
}

const runQuickTest = async () => {
  if (!testPrompt.value.trim() || !selectedModel.value) return
  
  try {
    testLoading.value = true
    testResponse.value = ''
    
    const request: GenerateRequest = {
      model: selectedModel.value,
      prompt: testPrompt.value.trim(),
      options: {
        num_predict: 50,
        temperature: 0.7
      }
    }
    
    const result = await generate(request)
    testResponse.value = result.response || 'No response'
  } catch (err) {
    console.error('Quick test failed:', err)
    testResponse.value = 'Test failed: ' + (err as Error).message
  } finally {
    testLoading.value = false
  }
}

// Load models on mount
onMounted(() => {
  refreshModels()
})

useSeoMeta({
  title: 'Ollama Models Management',
  description: 'Manage and test Ollama AI models'
})
</script>