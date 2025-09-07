// API client plugin (client-side only)
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  
  // Create API client instance
  const api = $fetch.create({
    baseURL: config.public.apiBase,
    
    // Request interceptor
    onRequest({ request, options }) {
      // Add authentication token if available
      const token = useCookie('auth-token')
      if (token.value) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${token.value}`
        }
      }
      
      // Add timestamp for cache busting
      if (typeof request === 'string' && !request.includes('?')) {
        request += `?t=${Date.now()}`
      }
    },
    
    // Response interceptor
    onResponse({ response }) {
      // Log successful responses in development
      if (process.dev) {
        console.log('API Response:', response.status, response._data)
      }
    },
    
    // Error interceptor
    onResponseError({ request, response, options }) {
      // Handle authentication errors
      if (response.status === 401) {
        const token = useCookie('auth-token')
        token.value = null
        
        // Redirect to login if not already there
        if (!window.location.pathname.includes('/login')) {
          navigateTo('/login')
        }
      }
      
      // Log errors in development
      if (process.dev) {
        console.error('API Error:', response.status, response._data)
      }
      
      // Show user-friendly error message
      const message = response._data?.message || 'An error occurred'
      console.error('API Error:', message)
    }
  })
  
  // Provide the API client globally
  return {
    provide: {
      api
    }
  }
})