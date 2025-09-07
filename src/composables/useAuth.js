export const useAuth = () => {
  const authState = useState('auth', () => ({
    user: null,
    organization: null,
    isAuthenticated: false,
    isLoading: true
  }))

  const { $fetch } = useNuxtApp()
  const router = useRouter()

  const login = async (email, password) => {
    try {
      authState.value.isLoading = true
      const { user, organization, token } = await $fetch('/api/auth/login', {
        method: 'POST',
        body: { email, password }
      })

      // Store token in cookie
      const tokenCookie = useCookie('auth-token', {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      })
      tokenCookie.value = token

      authState.value.user = user
      authState.value.organization = organization
      authState.value.isAuthenticated = true

      await router.push('/dashboard')
    } catch (error) {
      throw error
    } finally {
      authState.value.isLoading = false
    }
  }

  const logout = async () => {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      // Continue with logout even if API call fails
    }

    const tokenCookie = useCookie('auth-token')
    tokenCookie.value = null

    authState.value.user = null
    authState.value.organization = null
    authState.value.isAuthenticated = false

    await router.push('/auth/login')
  }

  const fetchUser = async () => {
    try {
      authState.value.isLoading = true
      const { user, organization } = await $fetch('/api/auth/me')
      
      authState.value.user = user
      authState.value.organization = organization
      authState.value.isAuthenticated = true
    } catch (error) {
      authState.value.user = null
      authState.value.organization = null
      authState.value.isAuthenticated = false
    } finally {
      authState.value.isLoading = false
    }
  }

  const hasPermission = (resource, action) => {
    if (!authState.value.user) return false
    
    return authState.value.user.permissions.some(
      permission => permission.resource === resource && 
      permission.actions.includes(action)
    )
  }

  const switchOrganization = async (organizationId) => {
    try {
      const { user, organization } = await $fetch('/api/auth/switch-org', {
        method: 'POST',
        body: { organizationId }
      })

      authState.value.user = user
      authState.value.organization = organization
    } catch (error) {
      throw error
    }
  }

  return {
    ...toRefs(authState.value),
    login,
    logout,
    fetchUser,
    hasPermission,
    switchOrganization
  }
}