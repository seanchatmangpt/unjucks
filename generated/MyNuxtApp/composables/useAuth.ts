// Authentication composable
export const useAuth = () => {
  const token = useCookie('auth-token', {
    default: () => null,
    httpOnly: true,
    secure: true,
    sameSite: 'strict'
  })
  
  const user = ref(null)
  const isLoggedIn = computed(() => !!token.value)
  
  // Login function
  const login = async (email: string, password: string) => {
    try {
      const response = await $fetch('/api/auth/login', {
        method: 'POST',
        body: { email, password }
      })
      
      token.value = response.data.token
      user.value = response.data.user
      
      return { success: true, user: response.data.user }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, error: error.data?.message || 'Login failed' }
    }
  }
  
  // Logout function
  const logout = async () => {
    try {
      token.value = null
      user.value = null
      
      // Clear all auth-related cookies
      const cookies = ['auth-token', 'user-data']
      cookies.forEach(cookieName => {
        const cookie = useCookie(cookieName)
        cookie.value = null
      })
      
      await navigateTo('/')
      return { success: true }
    } catch (error) {
      console.error('Logout error:', error)
      return { success: false, error: 'Logout failed' }
    }
  }
  
  // Get current user
  const getCurrentUser = async () => {
    if (!token.value) return null
    
    try {
      // Decode token to get user info (mock implementation)
      const decoded = JSON.parse(atob(token.value))
      user.value = decoded
      return user.value
    } catch (error) {
      console.error('Token decode error:', error)
      token.value = null
      return null
    }
  }
  
  // Check if token is expired
  const isTokenExpired = () => {
    if (!token.value) return true
    
    try {
      const decoded = JSON.parse(atob(token.value))
      return decoded.exp < Date.now()
    } catch {
      return true
    }
  }
  
  // Refresh token if needed
  const refreshToken = async () => {
    if (isTokenExpired()) {
      await logout()
      return false
    }
    return true
  }
  
  return {
    token: readonly(token),
    user: readonly(user),
    isLoggedIn,
    login,
    logout,
    getCurrentUser,
    isTokenExpired,
    refreshToken
  }
}