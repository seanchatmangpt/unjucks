// Server API route for Ollama pull endpoint

/**
 * @typedef {Object} PullRequest
 * @property {string} name - Model name to pull
 * @property {boolean} [insecure] - Allow insecure connections
 */

/**
 * @typedef {Object} PullResponse
 * @property {string} status - Pull status
 * @property {number} [total] - Total bytes
 * @property {number} [completed] - Completed bytes
 */

/**
 * Ollama pull endpoint handler
 * @param {Object} event - Nitro event object
 * @returns {Promise<Object>} Response with pull data
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    
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
    const response = await $fetch(`${ollamaBaseURL}/api/pull`, {
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
    console.error('Pull API Error:', error)
    
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Internal server error'
    })
  }
})