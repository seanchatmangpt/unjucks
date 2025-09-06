// Client-side plugin for Ollama API integration
export default defineNuxtPlugin(() => {
  // Provide global Ollama API utilities
  const ollamaAPI = useOllamaAPI()
  
  // Global error handler for Ollama API
  const handleOllamaError = (error: any) => {
    console.error('Ollama API Error:', error)
    
    // Show user-friendly error messages
    if (error.statusCode === 404) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Ollama service not found. Please ensure Ollama is running.'
      })
    }
    
    if (error.statusCode === 401) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication failed. Please check your API credentials.'
      })
    }
    
    if (error.statusCode === 500) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Ollama service error. Please try again later.'
      })
    }
    
    throw error
  }
  
  // Provide utilities globally
  return {
    provide: {
      ollama: {
        ...ollamaAPI,
        handleError: handleOllamaError
      }
    }
  }
})