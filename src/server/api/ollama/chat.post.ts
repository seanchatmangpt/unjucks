// Server API route for Ollama chat endpoint
import type { ChatRequest, ChatResponse } from '../../../types/ollama'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<ChatRequest>(event)
    
    // Validate required fields
    if (!body.model || !body.messages || !Array.isArray(body.messages)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: model and messages array'
      })
    }
    
    // Validate message format
    for (const message of body.messages) {
      if (!message.role || !message.content) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid message format: role and content are required'
        })
      }
      
      if (!['system', 'user', 'assistant'].includes(message.role)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid message role: must be system, user, or assistant'
        })
      }
    }
    
    const config = useRuntimeConfig()
    const ollamaBaseURL = config.ollamaBaseURL || 'http://localhost:11434'
    
    // Forward request to Ollama
    const response = await $fetch<ChatResponse>(`${ollamaBaseURL}/api/chat`, {
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
    console.error('Chat API Error:', error)
    
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Internal server error'
    })
  }
})