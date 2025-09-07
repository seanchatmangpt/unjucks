// GET /api/users - Fetch all users
export default defineEventHandler(async (event) => {
  // Simulate database query delay
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // Mock user data
  const users = [
    {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      status: 'active',
      createdAt: '2024-01-15T10:30:00Z'
    },
    {
      id: '2', 
      name: 'Jane Smith',
      email: 'jane@example.com',
      status: 'active',
      createdAt: '2024-01-20T14:15:00Z'
    },
    {
      id: '3',
      name: 'Bob Wilson', 
      email: 'bob@example.com',
      status: 'inactive',
      createdAt: '2024-01-25T09:45:00Z'
    },
    {
      id: '4',
      name: 'Alice Johnson',
      email: 'alice@example.com', 
      status: 'active',
      createdAt: '2024-02-01T16:20:00Z'
    }
  ]
  
  // Check for query parameters
  const query = getQuery(event)
  const { status, limit } = query
  
  let filteredUsers = users
  
  // Filter by status if provided
  if (status) {
    filteredUsers = users.filter(user => user.status === status)
  }
  
  // Limit results if provided
  if (limit) {
    filteredUsers = filteredUsers.slice(0, parseInt(limit as string))
  }
  
  return {
    data: filteredUsers,
    total: filteredUsers.length,
    timestamp: new Date().toISOString()
  }
})