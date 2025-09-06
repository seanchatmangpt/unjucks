// Server API route for Ollama generate endpoint
import type { GenerateRequest, GenerateResponse } from '../../../types/ollama'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<GenerateRequest>(event)
    
    // Validate required fields
    if (!body.model || !body.prompt) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: model and prompt'
      })
    }
    
    const config = useRuntimeConfig()
    const ollamaBaseURL = config.ollamaBaseURL || 'http://localhost:11434'
    
    // Forward request to Ollama
    const response = await $fetch<GenerateResponse>(`${ollamaBaseURL}/api/generate`, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    return {
      success: true,
      data: response
    }
  } catch (error: any) {
    console.error('Generate API Error:', error)
    
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Internal server error'
    })
  }
})