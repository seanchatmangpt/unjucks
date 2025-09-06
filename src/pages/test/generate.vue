<template>
  <div class="container mx-auto p-6">
    <h1 class="text-3xl font-bold mb-6">Ollama Generate Test</h1>
    
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Input Form -->
      <div class="space-y-4">
        <div>
          <label for="model" class="block text-sm font-medium mb-2">Model</label>
          <select 
            id="model" 
            v-model="form.model" 
            class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select a model</option>
            <option v-for="model in availableModels" :key="model.name" :value="model.name">
              {{ model.name }}
            </option>
          </select>
        </div>
        
        <div>
          <label for="prompt" class="block text-sm font-medium mb-2">Prompt</label>
          <textarea
            id="prompt"
            v-model="form.prompt"
            rows="6"
            class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter your prompt here..."
          />
        </div>
        
        <!-- Options -->
        <div class="space-y-3">
          <h3 class="text-lg font-semibold">Generation Options</h3>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="temperature" class="block text-sm font-medium mb-1">Temperature</label>
              <input
                id="temperature"
                v-model.number="form.options.temperature"
                type="number"
                step="0.1"
                min="0"
                max="2"
                class="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
            </div>
            
            <div>
              <label for="top_p" class="block text-sm font-medium mb-1">Top P</label>
              <input
                id="top_p"
                v-model.number="form.options.top_p"
                type="number"
                step="0.1"
                min="0"
                max="1"
                class="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
            </div>
            
            <div>
              <label for="top_k" class="block text-sm font-medium mb-1">Top K</label>
              <input
                id="top_k"
                v-model.number="form.options.top_k"
                type="number"
                min="1"
                class="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
            </div>
            
            <div>
              <label for="num_predict" class="block text-sm font-medium mb-1">Max Tokens</label>
              <input
                id="num_predict"
                v-model.number="form.options.num_predict"
                type="number"
                min="1"
                class="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
            </div>
          </div>
        </div>
        
        <div class="flex items-center space-x-4">
          <label class="flex items-center">
            <input
              v-model="form.stream"
              type="checkbox"
              class="mr-2"
            >
            Enable Streaming
          </label>
        </div>
        
        <div class="flex space-x-3">
          <button
            :disabled="!form.model || !form.prompt || loading"
            :class="[
              'px-6 py-3 rounded-lg font-semibold transition-colors',
              !form.model || !form.prompt || loading
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            ]"
            @click="handleGenerate"
          >
            {{ loading ? 'Generating...' : 'Generate' }}
          </button>
          
          <button
            :disabled="loading"
            class="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
            @click="clearResponse"
          >
            Clear
          </button>
        </div>
      </div>
      
      <!-- Response -->
      <div class="space-y-4">
        <h3 class="text-lg font-semibold">Response</h3>
        
        <div
          v-if="error"
          class="p-4 bg-red-50 border border-red-200 rounded-lg"
        >
          <p class="text-red-700 font-medium">Error:</p>
          <p class="text-red-600">{{ error }}</p>
        </div>
        
        <div
          v-if="response || streamingText"
          class="p-4 bg-gray-50 border border-gray-200 rounded-lg min-h-[200px]"
        >
          <pre class="whitespace-pre-wrap font-mono text-sm">{{ displayText }}</pre>
        </div>
        
        <div v-if="loading" class="flex items-center justify-center p-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
        
        <div
          v-if="metadata"
          class="p-4 bg-blue-50 border border-blue-200 rounded-lg"
        >
          <h4 class="font-semibold mb-2">Generation Metadata</h4>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div><strong>Model:</strong> {{ metadata.model }}</div>
            <div><strong>Done:</strong> {{ metadata.done ? 'Yes' : 'No' }}</div>
            <div v-if="metadata.total_duration">
              <strong>Duration:</strong> {{ Math.round(metadata.total_duration / 1000000) }}ms
            </div>
            <div v-if="metadata.eval_count">
              <strong>Tokens:</strong> {{ metadata.eval_count }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GenerateRequest, GenerateResponse, Model } from '../../types/ollama'

const { generate, generateStream, listModels, loading, error, clearError } = useOllamaAPI()

const form = ref<GenerateRequest & { stream: boolean }>({
  model: '',
  prompt: '',
  stream: false,
  options: {
    temperature: 0.7,
    top_p: 0.9,
    top_k: 40,
    num_predict: 100
  }
})

const response = ref<string>('')
const streamingText = ref<string>('')
const metadata = ref<GenerateResponse | null>(null)
const availableModels = ref<Model[]>([])

const displayText = computed(() => {
  return form.value.stream ? streamingText.value : response.value
})

const handleGenerate = async () => {
  try {
    clearError()
    response.value = ''
    streamingText.value = ''
    metadata.value = null
    
    if (form.value.stream) {
      await generateStream(
        {
          model: form.value.model,
          prompt: form.value.prompt,
          options: form.value.options
        },
        (chunk) => {
          if (chunk.response) {
            streamingText.value += chunk.response
          }
          if (chunk.done) {
            metadata.value = chunk
          }
        }
      )
    } else {
      const result = await generate({
        model: form.value.model,
        prompt: form.value.prompt,
        options: form.value.options
      })
      
      response.value = result.response || ''
      metadata.value = result
    }
  } catch (err) {
    console.error('Generation failed:', err)
  }
}

const clearResponse = () => {
  response.value = ''
  streamingText.value = ''
  metadata.value = null
  clearError()
}

// Load available models on mount
onMounted(async () => {
  try {
    const modelsData = await listModels()
    availableModels.value = modelsData.models || []
    
    // Select first model if available
    if (availableModels.value.length > 0) {
      form.value.model = availableModels.value[0].name || ''
    }
  } catch (err) {
    console.error('Failed to load models:', err)
  }
})

useSeoMeta({
  title: 'Ollama Generate Test',
  description: 'Test page for Ollama generate API endpoint'
})
</script>