export default defineNuxtRouteMiddleware((to, from) => {
  // Simple middleware for validation testing
  console.log('Auth middleware executed for route:', to.path)
  
  // Example: redirect to login if accessing protected routes
  if (to.path.startsWith('/admin') && !process.client) {
    return navigateTo('/login')
  }
})