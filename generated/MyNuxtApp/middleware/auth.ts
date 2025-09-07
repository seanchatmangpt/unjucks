// Authentication middleware
export default defineNuxtRouteMiddleware((to, from) => {
  // Check if user is authenticated
  const token = useCookie('auth-token')
  
  // Routes that don't require authentication
  const publicRoutes = ['/', '/login', '/register']
  
  // If trying to access protected route without authentication
  if (!token.value && !publicRoutes.includes(to.path)) {
    return navigateTo('/login')
  }
  
  // If authenticated and trying to access login/register, redirect to dashboard
  if (token.value && ['/login', '/register'].includes(to.path)) {
    return navigateTo('/dashboard')
  }
})