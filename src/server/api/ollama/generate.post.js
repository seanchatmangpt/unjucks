// Server API route for Ollama generate endpoint

/**
 * @typedef {Object} GenerateRequest
 * @property {string} model - Model name
 * @property {string} prompt - Generation prompt
 * @property {Object} [options] - Generation options
 */

/**
 * @typedef {Object} GenerateResponse
 * @property {string} response - Generated text
 * @property {boolean} done - Whether generation is complete
 */

/**
 * Ollama generate endpoint handler
 * @param {Object} event - Nitro event object
 * @returns {Promise<Object>} Response with generated data
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    
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
    const response = await $fetch(`${ollamaBaseURL}/api/generate`, {
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
    console.error('Generate API Error:', error)
    
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Internal server error'
    })
  }
})