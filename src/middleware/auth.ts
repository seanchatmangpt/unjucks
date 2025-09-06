// Authentication middleware for Ollama API routes
export default defineNuxtRouteMiddleware((to, from) => {
  // Skip auth for non-API routes
  if (!to.path.startsWith('/api/ollama')) {
    return
  }
  
  const config = useRuntimeConfig()
  
  // Skip auth if not required
  if (!config.public.ollamaRequireAuth) {
    return
  }
  
  // Check for API key in headers
  const headers = useRequestHeaders(['authorization', 'x-api-key'])
  const authHeader = headers.authorization
  const apiKey = headers['x-api-key']
  
  // Extract token from Authorization header
  let token: string | undefined
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7)
  }
  
  // Verify API key or token
  const validApiKey = config.ollamaApiKey
  const validToken = config.ollamaAuthToken
  
  if (validApiKey && apiKey !== validApiKey) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid API key'
    })
  }
  
  if (validToken && token !== validToken) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid authentication token'
    })
  }
  
  // If neither key nor token is provided but required
  if (validApiKey && !apiKey && validToken && !token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required'
    })
  }
})