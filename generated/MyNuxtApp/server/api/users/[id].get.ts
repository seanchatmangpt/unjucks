// GET /api/users/[id] - Fetch user by ID
export default defineEventHandler(async (event) => {
  const userId = getRouterParam(event, 'id')
  
  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User ID is required'
    })
  }
  
  // Simulate database query delay
  await new Promise(resolve => setTimeout(resolve, 300))
  
  // Mock user data
  const users = [
    {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      status: 'active',
      profile: {
        bio: 'Software Developer',
        location: 'San Francisco, CA',
        website: 'https://johndoe.dev'
      },
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-02-10T15:45:00Z'
    },
    {
      id: '2',
      name: 'Jane Smith', 
      email: 'jane@example.com',
      status: 'active',
      profile: {
        bio: 'Product Manager',
        location: 'New York, NY',
        website: 'https://janesmith.com'
      },
      createdAt: '2024-01-20T14:15:00Z',
      updatedAt: '2024-02-08T11:30:00Z'
    },
    {
      id: '3',
      name: 'Bob Wilson',
      email: 'bob@example.com',
      status: 'inactive', 
      profile: {
        bio: 'Designer',
        location: 'Austin, TX',
        website: null
      },
      createdAt: '2024-01-25T09:45:00Z',
      updatedAt: '2024-01-30T16:20:00Z'
    }
  ]
  
  const user = users.find(u => u.id === userId)
  
  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found'
    })
  }
  
  return {
    data: user,
    timestamp: new Date().toISOString()
  }
})