import { ref, unref } from 'vue'

/**
 * @typedef {Object} GenerationOptions
 * @property {number} [temperature] - Temperature for generation
 * @property {number} [top_p] - Top-p for generation
 * @property {number} [top_k] - Top-k for generation
 * @property {number} [num_predict] - Number of tokens to predict
 */

/**
 * @typedef {Object} GenerateRequest
 * @property {string} model - Model name
 * @property {string} prompt - Input prompt
 * @property {GenerationOptions} [options] - Generation options
 * @property {boolean} [stream] - Enable streaming
 */

/**
 * @typedef {Object} GenerateResponse
 * @property {string} response - Generated response
 * @property {boolean} done - Whether generation is complete
 * @property {string} [model] - Model used
 * @property {number} [total_duration] - Total duration
 * @property {number} [load_duration] - Load duration
 * @property {number} [prompt_eval_count] - Prompt evaluation count
 * @property {number} [eval_count] - Evaluation count
 */

/**
 * @typedef {Object} Message
 * @property {'system' | 'user' | 'assistant'} role - Message role
 * @property {string} content - Message content
 */

/**
 * @typedef {Object} ChatRequest
 * @property {string} model - Model name
 * @property {Message[]} messages - Chat messages
 * @property {GenerationOptions} [options] - Generation options
 * @property {boolean} [stream] - Enable streaming
 */

/**
 * @typedef {Object} ChatResponse
 * @property {Message} message - Response message
 * @property {boolean} done - Whether generation is complete
 * @property {string} [model] - Model used
 * @property {number} [total_duration] - Total duration
 */

/**
 * @typedef {Object} ModelInfo
 * @property {string} name - Model name
 * @property {string} [digest] - Model digest
 * @property {number} [size] - Model size in bytes
 * @property {string} [modified_at] - Last modified date
 */

/**
 * @typedef {Object} ModelsResponse
 * @property {ModelInfo[]} models - List of models
 */

/**
 * @typedef {Object} PullRequest
 * @property {string} name - Model name to pull
 * @property {boolean} [stream] - Enable streaming
 */

/**
 * @typedef {Object} PullResponse
 * @property {string} status - Pull status
 * @property {string} [digest] - Model digest
 * @property {number} [total] - Total bytes
 * @property {number} [completed] - Completed bytes
 */

/**
 * Ollama API composable
 * @returns {Object} API methods and state
 */
export const useOllamaAPI = () => {
  const config = useRuntimeConfig()
  const baseURL = config.public.ollamaBaseURL || 'http://localhost:11434'
  
  const loading = ref(false)
  const error = ref(null)
  
  const clearError = () => {
    error.value = null
  }
  
  /**
   * Handle API errors
   * @param {Error} err - Error object
   * @throws {Error} Throws the handled error
   */
  const handleError = (err) => {
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
  
  /**
   * Generate completion
   * @param {GenerateRequest} request - Generate request
   * @returns {Promise<GenerateResponse>} Generate response
   */
  const generate = async (request) => {
    try {
      clearError()
      loading.value = true
      
      const { data } = await $fetch('/api/ollama/generate', {
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
  
  /**
   * Streaming generate
   * @param {GenerateRequest} request - Generate request
   * @param {(chunk: GenerateResponse) => void} onChunk - Chunk callback
   * @returns {Promise<void>}
   */
  const generateStream = async (request, onChunk) => {
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
            /** @type {GenerateResponse} */
            const data = JSON.parse(line)
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
  
  /**
   * Chat completion
   * @param {ChatRequest} request - Chat request
   * @returns {Promise<ChatResponse>} Chat response
   */
  const chat = async (request) => {
    try {
      clearError()
      loading.value = true
      
      const { data } = await $fetch('/api/ollama/chat', {
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
  
  /**
   * Streaming chat
   * @param {ChatRequest} request - Chat request
   * @param {(chunk: ChatResponse) => void} onChunk - Chunk callback
   * @returns {Promise<void>}
   */
  const chatStream = async (request, onChunk) => {
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
            /** @type {ChatResponse} */
            const data = JSON.parse(line)
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
  
  /**
   * List models
   * @returns {Promise<ModelsResponse>} Models response
   */
  const listModels = async () => {
    try {
      clearError()
      loading.value = true
      
      const data = await $fetch('/api/ollama/models', {
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
  
  /**
   * Pull model
   * @param {PullRequest} request - Pull request
   * @returns {Promise<PullResponse>} Pull response
   */
  const pullModel = async (request) => {
    try {
      clearError()
      loading.value = true
      
      const data = await $fetch('/api/ollama/pull', {
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
  
  /**
   * Streaming pull
   * @param {PullRequest} request - Pull request
   * @param {(progress: PullResponse) => void} onProgress - Progress callback
   * @returns {Promise<void>}
   */
  const pullModelStream = async (request, onProgress) => {
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
            /** @type {PullResponse} */
            const data = JSON.parse(line)
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