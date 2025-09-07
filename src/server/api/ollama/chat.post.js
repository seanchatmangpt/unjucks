// Server API route for Ollama chat endpoint

/**
 * @typedef {Object} ChatMessage
 * @property {'system'|'user'|'assistant'} role - Message role
 * @property {string} content - Message content
 */

/**
 * @typedef {Object} ChatRequest
 * @property {string} model - Model name
 * @property {ChatMessage[]} messages - Chat messages
 * @property {Object} [options] - Chat options
 */

/**
 * @typedef {Object} ChatResponse
 * @property {ChatMessage} message - Response message
 * @property {boolean} done - Whether chat is complete
 */

/**
 * Ollama chat endpoint handler
 * @param {Object} event - Nitro event object
 * @returns {Promise<Object>} Response with chat data
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    
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
    const response = await $fetch(`${ollamaBaseURL}/api/chat`, {
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
  } catch (error) {
    console.error('Chat API Error:', error)
    
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Internal server error'
    })
  }
})