export const useApi = () => {
  const baseURL = '/api'
  
  const get = async <T>(endpoint: string): Promise<T> => {
    const response = await $fetch(`${baseURL}${endpoint}`)
    return response as T
  }
  
  const post = async <T>(endpoint: string, data: any): Promise<T> => {
    const response = await $fetch(`${baseURL}${endpoint}`, {
      method: 'POST',
      body: data
    })
    return response as T
  }
  
  const testConnection = async () => {
    try {
      const result = await get('/test')
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }
  
  return {
    get,
    post,
    testConnection
  }
}