// Server API route for Ollama models endpoint

/**
 * @typedef {Object} ModelsResponse
 * @property {Array} models - Array of available models
 */

/**
 * Ollama models endpoint handler
 * @param {Object} event - Nitro event object
 * @returns {Promise<Object>} Response with models data
 */
export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig()
    const ollamaBaseURL = config.ollamaBaseURL || 'http://localhost:11434'
    
    // Forward request to Ollama
    const response = await $fetch(`${ollamaBaseURL}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    return {
      success: true,
      data: response
    }
  } catch (error) {
    console.error('Models API Error:', error)
    
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Internal server error'
    })
  }
})