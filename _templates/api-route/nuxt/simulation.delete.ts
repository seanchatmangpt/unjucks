---
to: server/api/simulation/[id].delete.ts
---
import type { ApiResponse, ApiError } from '~/types/api'

export default defineEventHandler(async (event): Promise<ApiResponse | ApiError> => {
  try {
    // Validate request method
    assertMethod(event, 'DELETE')
    
    // Get session ID from route params
    const sessionId = getRouterParam(event, 'id')
    
    if (!sessionId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Session ID required'
      })
    }
    
    // Authentication check
    const user = await getUserFromToken(event)
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication required'
      })
    }
    
    // Get session to verify ownership
    const session = await getSimulationSession(sessionId)
    
    if (!session) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Session not found'
      })
    }
    
    // Check user owns this session
    if (session.userId !== user.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied'
      })
    }
    
    // Prevent deletion of completed sessions with valuable data
    if (session.status === 'completed' && session.hasSubmissions) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Cannot delete completed session with submissions'
      })
    }
    
    // Soft delete the session (mark as deleted, keep data for analytics)
    await softDeleteSession(sessionId, user.id)
    
    // Clean up temporary resources
    await cleanupSessionResources(sessionId)
    
    // Log the deletion for audit purposes
    await logSessionDeletion({
      sessionId,
      userId: user.id,
      deletedAt: new Date(),
      reason: 'user_requested'
    })
    
    return {
      success: true,
      message: 'Session deleted successfully'
    }
    
  } catch (error) {
    // Re-throw HTTP errors
    if (error.statusCode) {
      throw error
    }
    
    // Handle unexpected errors
    console.error('Delete simulation session error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})

// Helper functions
async function getSimulationSession(sessionId: string) {
  // Database query to get session
  return {
    id: sessionId,
    userId: 'user-123',
    status: 'active',
    hasSubmissions: false
  }
}

async function softDeleteSession(sessionId: string, userId: string) {
  // Mark session as deleted in database
  // Keep data for analytics and audit purposes
}

async function cleanupSessionResources(sessionId: string) {
  // Clean up any temporary files, cache entries, etc.
  // associated with the session
}

async function logSessionDeletion(data: any) {
  // Log deletion for audit trail
}