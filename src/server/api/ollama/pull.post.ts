// Server API route for Ollama pull endpoint
import type { PullRequest, PullResponse } from '../../../types/ollama'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<PullRequest>(event)
    
    // Validate required fields
    if (!body.name) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: name'
      })
    }
    
    const config = useRuntimeConfig()
    const ollamaBaseURL = config.ollamaBaseURL || 'http://localhost:11434'
    
    // Forward request to Ollama
    const response = await $fetch<PullResponse>(`${ollamaBaseURL}/api/pull`, {
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
    console.error('Pull API Error:', error)
    
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Internal server error'
    })
  }
})