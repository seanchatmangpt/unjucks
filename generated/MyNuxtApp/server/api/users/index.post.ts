// POST /api/users - Create new user
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  // Validate required fields
  const { name, email } = body
  
  if (!name || !email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Name and email are required'
    })
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid email format'
    })
  }
  
  // Simulate database operation delay
  await new Promise(resolve => setTimeout(resolve, 800))
  
  // Create new user (mock)
  const newUser = {
    id: String(Math.floor(Math.random() * 10000) + 1000),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    status: 'active',
    profile: {
      bio: body.bio || '',
      location: body.location || '',
      website: body.website || null
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  
  // Set response status
  setResponseStatus(event, 201)
  
  return {
    data: newUser,
    message: 'User created successfully',
    timestamp: new Date().toISOString()
  }
})