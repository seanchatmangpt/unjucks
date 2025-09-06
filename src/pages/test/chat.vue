<template>
  <div class="container mx-auto p-6">
    <h1 class="text-3xl font-bold mb-6">Ollama Chat Test</h1>
    
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Configuration Panel -->
      <div class="space-y-4">
        <h3 class="text-lg font-semibold">Configuration</h3>
        
        <div>
          <label for="model" class="block text-sm font-medium mb-2">Model</label>
          <select 
            id="model" 
            v-model="selectedModel" 
            class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select a model</option>
            <option v-for="model in availableModels" :key="model.name" :value="model.name">
              {{ model.name }}
            </option>
          </select>
        </div>
        
        <div>
          <label for="system" class="block text-sm font-medium mb-2">System Message</label>
          <textarea
            id="system"
            v-model="systemMessage"
            rows="3"
            class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="You are a helpful assistant..."
          />
        </div>
        
        <div class="space-y-3">
          <h4 class="font-semibold">Options</h4>
          
          <div>
            <label for="temperature" class="block text-sm font-medium mb-1">Temperature</label>
            <input
              id="temperature"
              v-model.number="options.temperature"
              type="number"
              step="0.1"
              min="0"
              max="2"
              class="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
          </div>
          
          <div>
            <label for="max_tokens" class="block text-sm font-medium mb-1">Max Tokens</label>
            <input
              id="max_tokens"
              v-model.number="options.num_predict"
              type="number"
              min="1"
              class="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
          </div>
          
          <label class="flex items-center">
            <input
              v-model="streamEnabled"
              type="checkbox"
              class="mr-2"
            >
            Enable Streaming
          </label>
        </div>
        
        <button
          class="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors"
          @click="clearChat"
        >
          Clear Chat
        </button>
      </div>
      
      <!-- Chat Messages -->
      <div class="lg:col-span-2 space-y-4">
        <div class="h-96 bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-y-auto">
          <div
            v-for="(message, index) in messages"
            :key="index"
            :class="[
              'mb-4 p-3 rounded-lg max-w-[80%]',
              message.role === 'user'
                ? 'bg-blue-100 ml-auto'
                : message.role === 'assistant'
                ? 'bg-green-100'
                : 'bg-gray-100'
            ]"
          >
            <div class="flex items-center mb-1">
              <span class="text-xs font-semibold uppercase tracking-wide text-gray-600">
                {{ message.role }}
              </span>
            </div>
            <div class="whitespace-pre-wrap">{{ message.content }}</div>
          </div>
          
          <!-- Streaming message -->
          <div
            v-if="streamingMessage"
            class="mb-4 p-3 rounded-lg max-w-[80%] bg-green-100"
          >
            <div class="flex items-center mb-1">
              <span class="text-xs font-semibold uppercase tracking-wide text-gray-600">
                assistant
              </span>
              <div class="ml-2 animate-pulse">●</div>
            </div>
            <div class="whitespace-pre-wrap">{{ streamingMessage }}</div>
          </div>
          
          <div v-if="loading && !streamingMessage" class="flex justify-center p-4">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        </div>
        
        <!-- Input -->
        <div class="flex space-x-2">
          <input
            v-model="currentInput"
            type="text"
            placeholder="Type your message..."
            class="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            @keyup.enter="sendMessage"
            @keydown.prevent.ctrl.enter="sendMessage"
            :disabled="loading || !selectedModel"
          >
          <button
            :disabled="!currentInput.trim() || loading || !selectedModel"
            :class="[
              'px-6 py-3 rounded-lg font-semibold transition-colors',
              !currentInput.trim() || loading || !selectedModel
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            ]"
            @click="sendMessage"
          >
            {{ loading ? '...' : 'Send' }}
          </button>
        </div>
        
        <div v-if="error" class="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-red-700 font-medium">Error:</p>
          <p class="text-red-600">{{ error }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChatRequest, Message, Model, GenerationOptions } from '../../types/ollama'

const { chat, chatStream, listModels, loading, error, clearError } = useOllamaAPI()

const selectedModel = ref<string>('')
const systemMessage = ref<string>('You are a helpful assistant.')
const streamEnabled = ref<boolean>(true)
const currentInput = ref<string>('')
const messages = ref<Message[]>([])
const streamingMessage = ref<string>('')
const availableModels = ref<Model[]>([])

const options = ref<GenerationOptions>({
  temperature: 0.7,
  top_p: 0.9,
  num_predict: 200
})

const sendMessage = async () => {
  if (!currentInput.value.trim() || loading.value || !selectedModel.value) {
    return
  }
  
  const userMessage: Message = {
    role: 'user',
    content: currentInput.value.trim()
  }
  
  messages.value.push(userMessage)
  currentInput.value = ''
  clearError()
  streamingMessage.value = ''
  
  try {
    const chatMessages: Message[] = []
    
    // Add system message if provided
    if (systemMessage.value.trim()) {
      chatMessages.push({
        role: 'system',
        content: systemMessage.value.trim()
      })
    }
    
    // Add conversation history
    chatMessages.push(...messages.value)
    
    const request: ChatRequest = {
      model: selectedModel.value,
      messages: chatMessages,
      options: options.value
    }
    
    if (streamEnabled.value) {
      await chatStream(request, (chunk) => {
        if (chunk.message?.content) {
          streamingMessage.value += chunk.message.content
        }
        
        if (chunk.done && streamingMessage.value) {
          messages.value.push({
            role: 'assistant',
            content: streamingMessage.value
          })
          streamingMessage.value = ''
        }
      })
    } else {
      const response = await chat(request)
      
      if (response.message) {
        messages.value.push(response.message)
      }
    }
  } catch (err) {
    console.error('Chat failed:', err)
  }
}

const clearChat = () => {
  messages.value = []
  streamingMessage.value = ''
  clearError()
}

// Load available models on mount
onMounted(async () => {
  try {
    const modelsData = await listModels()
    availableModels.value = modelsData.models || []
    
    // Select first model if available
    if (availableModels.value.length > 0) {
      selectedModel.value = availableModels.value[0].name || ''
    }
  } catch (err) {
    console.error('Failed to load models:', err)
  }
})

useSeoMeta({
  title: 'Ollama Chat Test',
  description: 'Test page for Ollama chat API endpoint'
})
</script>