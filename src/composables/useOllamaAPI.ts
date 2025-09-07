import { ref, unref } from 'vue'
import type {
  GenerateRequest,
  GenerateResponse,
  ChatRequest,
  ChatResponse,
  ModelsResponse,
  PullRequest,
  PullResponse,
  OllamaError
} from '../types/ollama'

export const useOllamaAPI = () => {
  const config = useRuntimeConfig()
  const baseURL = config.public.ollamaBaseURL || 'http://localhost:11434'
  
  const loading = ref(false)
  const error = ref<string | null>(null)
  
  const clearError = () => {
    error.value = null
  }
  
  const handleError = (err: any) => {
    console.error('Ollama API Error:', err)
    if (err.data?.error) {
      error.value = err.data.error
    } else if (err.message) {
      error.value = err.message
    } else {
      error.value = 'An unexpected error occurred'
    }
    loading.value = false
    throw err
  }
  
  // Generate completion
  const generate = async (request: GenerateRequest): Promise<GenerateResponse> => {
    try {
      clearError()
      loading.value = true
      
      const { data } = await $fetch<GenerateResponse>('/api/ollama/generate', {
        method: 'POST',
        body: request,
        baseURL: baseURL
      })
      
      return data
    } catch (err) {
      return handleError(err)
    } finally {
      loading.value = false
    }
  }
  
  // Streaming generate
  const generateStream = async (
    request: GenerateRequest,
    onChunk: (chunk: GenerateResponse) => void
  ): Promise<void> => {
    try {
      clearError()
      loading.value = true
      
      const response = await fetch(`${baseURL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...request, stream: true })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      
      if (!reader) {
        throw new Error('Response body is not readable')
      }
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.trim())
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line) as GenerateResponse
            onChunk(data)
            
            if (data.done) {
              return
            }
          } catch (parseErr) {
            console.warn('Failed to parse streaming chunk:', parseErr)
          }
        }
      }
    } catch (err) {
      handleError(err)
    } finally {
      loading.value = false
    }
  }
  
  // Chat completion
  const chat = async (request: ChatRequest): Promise<ChatResponse> => {
    try {
      clearError()
      loading.value = true
      
      const { data } = await $fetch<ChatResponse>('/api/ollama/chat', {
        method: 'POST',
        body: request,
        baseURL: baseURL
      })
      
      return data
    } catch (err) {
      return handleError(err)
    } finally {
      loading.value = false
    }
  }
  
  // Streaming chat
  const chatStream = async (
    request: ChatRequest,
    onChunk: (chunk: ChatResponse) => void
  ): Promise<void> => {
    try {
      clearError()
      loading.value = true
      
      const response = await fetch(`${baseURL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...request, stream: true })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      
      if (!reader) {
        throw new Error('Response body is not readable')
      }
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.trim())
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line) as ChatResponse
            onChunk(data)
            
            if (data.done) {
              return
            }
          } catch (parseErr) {
            console.warn('Failed to parse streaming chunk:', parseErr)
          }
        }
      }
    } catch (err) {
      handleError(err)
    } finally {
      loading.value = false
    }
  }
  
  // List models
  const listModels = async (): Promise<ModelsResponse> => {
    try {
      clearError()
      loading.value = true
      
      const data = await $fetch<ModelsResponse>('/api/ollama/models', {
        method: 'GET',
        baseURL: baseURL
      })
      
      return data
    } catch (err) {
      return handleError(err)
    } finally {
      loading.value = false
    }
  }
  
  // Pull model
  const pullModel = async (request: PullRequest): Promise<PullResponse> => {
    try {
      clearError()
      loading.value = true
      
      const data = await $fetch<PullResponse>('/api/ollama/pull', {
        method: 'POST',
        body: request,
        baseURL: baseURL
      })
      
      return data
    } catch (err) {
      return handleError(err)
    } finally {
      loading.value = false
    }
  }
  
  // Streaming pull
  const pullModelStream = async (
    request: PullRequest,
    onProgress: (progress: PullResponse) => void
  ): Promise<void> => {
    try {
      clearError()
      loading.value = true
      
      const response = await fetch(`${baseURL}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...request, stream: true })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      
      if (!reader) {
        throw new Error('Response body is not readable')
      }
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.trim())
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line) as PullResponse
            onProgress(data)
          } catch (parseErr) {
            console.warn('Failed to parse streaming chunk:', parseErr)
          }
        }
      }
    } catch (err) {
      handleError(err)
    } finally {
      loading.value = false
    }
  }
  
  return {
    loading: readonly(loading),
    error: readonly(error),
    clearError,
    generate,
    generateStream,
    chat,
    chatStream,
    listModels,
    pullModel,
    pullModelStream
  }
}