// API composable for making HTTP requests
export const useApi = () => {
  const config = useRuntimeConfig()
  const { token } = useAuth()
  
  // Generic API request function
  const request = async <T>(
    url: string, 
    options: RequestInit & { 
      query?: Record<string, any>
      timeout?: number 
    } = {}
  ): Promise<T> => {
    const { query, timeout = 10000, ...fetchOptions } = options
    
    // Build URL with query parameters
    let fullUrl = url.startsWith('/') ? url : `${config.public.apiBase}/${url}`
    
    if (query) {
      const searchParams = new URLSearchParams()
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value))
        }
      })
      fullUrl += `?${searchParams.toString()}`
    }
    
    // Default headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...fetchOptions.headers
    }
    
    // Add auth token if available
    if (token.value) {
      headers['Authorization'] = `Bearer ${token.value}`
    }
    
    try {
      const response = await $fetch<T>(fullUrl, {
        ...fetchOptions,
        headers,
        timeout
      })
      
      return response
    } catch (error: any) {
      // Handle specific error cases
      if (error.response?.status === 401) {
        const { logout } = useAuth()
        await logout()
        throw new Error('Authentication required')
      }
      
      if (error.response?.status === 403) {
        throw new Error('Access forbidden')
      }
      
      if (error.response?.status >= 500) {
        throw new Error('Server error occurred')
      }
      
      throw error
    }
  }
  
  // Convenience methods
  const get = <T>(url: string, options?: Parameters<typeof request>[1]) => 
    request<T>(url, { ...options, method: 'GET' })
  
  const post = <T>(url: string, data?: any, options?: Parameters<typeof request>[1]) =>
    request<T>(url, { ...options, method: 'POST', body: data })
  
  const put = <T>(url: string, data?: any, options?: Parameters<typeof request>[1]) =>
    request<T>(url, { ...options, method: 'PUT', body: data })
  
  const patch = <T>(url: string, data?: any, options?: Parameters<typeof request>[1]) =>
    request<T>(url, { ...options, method: 'PATCH', body: data })
  
  const del = <T>(url: string, options?: Parameters<typeof request>[1]) =>
    request<T>(url, { ...options, method: 'DELETE' })
  
  return {
    request,
    get,
    post,
    put,
    patch,
    delete: del
  }
}