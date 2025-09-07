// POST /api/auth/login - User authentication
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  const { email, password } = body
  
  // Validate required fields
  if (!email || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email and password are required'
    })
  }
  
  // Simulate authentication delay
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Mock authentication logic
  const validCredentials = [
    { email: 'john@example.com', password: 'password123' },
    { email: 'jane@example.com', password: 'securepass' },
    { email: 'admin@example.com', password: 'admin123' }
  ]
  
  const user = validCredentials.find(cred => 
    cred.email === email.toLowerCase() && cred.password === password
  )
  
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid credentials'
    })
  }
  
  // Generate mock JWT token
  const token = btoa(JSON.stringify({
    email: user.email,
    iat: Date.now(),
    exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  }))
  
  // Set secure cookie
  setCookie(event, 'auth-token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 // 24 hours
  })
  
  return {
    data: {
      user: {
        email: user.email,
        name: email.split('@')[0], // Extract name from email
        role: email.includes('admin') ? 'admin' : 'user'
      },
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    },
    message: 'Login successful',
    timestamp: new Date().toISOString()
  }
})