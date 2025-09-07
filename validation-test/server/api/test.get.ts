export default defineEventHandler(async (event) => {
  // Simulate some async work
  await new Promise(resolve => setTimeout(resolve, 100))
  
  return {
    success: true,
    data: {
      message: 'API route is working correctly!',
      timestamp: new Date().toISOString(),
      method: event.node.req.method,
      path: event.node.req.url
    }
  }
})