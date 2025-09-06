// Server API route for Ollama models endpoint
import type { ModelsResponse } from '../../../types/ollama'

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig()
    const ollamaBaseURL = config.ollamaBaseURL || 'http://localhost:11434'
    
    // Forward request to Ollama
    const response = await $fetch<ModelsResponse>(`${ollamaBaseURL}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    return {
      success: true,
      data: response
    }
  } catch (error: any) {
    console.error('Models API Error:', error)
    
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Internal server error'
    })
  }
})