export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  // Basic validation
  if (!body.name || !body.email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Name and email are required'
    })
  }
  
  // Simulate user creation
  const user = {
    id: Math.random().toString(36).substr(2, 9),
    name: body.name,
    email: body.email,
    created: new Date().toISOString()
  }
  
  return {
    success: true,
    user
  }
})