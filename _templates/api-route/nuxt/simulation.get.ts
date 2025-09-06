---
to: server/api/simulation/[id].get.ts
---
import type { SimulationSessionResponse, ApiError } from '~/types/api'

export default defineEventHandler(async (event): Promise<SimulationSessionResponse | ApiError> => {
  try {
    // Get session ID from route params
    const sessionId = getRouterParam(event, 'id')
    
    if (!sessionId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Session ID required'
      })
    }
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(sessionId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid session ID format'
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
    
    // Get session details
    const session = await getSimulationSessionWithDetails(sessionId)
    
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
    
    // Get session submissions and feedback
    const [submissions, feedback, analytics] = await Promise.all([
      getSessionSubmissions(sessionId),
      getSessionFeedback(sessionId),
      getSessionAnalytics(sessionId)
    ])
    
    return {
      success: true,
      data: {
        session: {
          id: session.id,
          type: session.type,
          difficulty: session.difficulty,
          duration: session.duration,
          status: session.status,
          createdAt: session.createdAt,
          completedAt: session.completedAt,
          skills: session.skills
        },
        submissions: submissions.map(sub => ({
          id: sub.id,
          code: sub.code,
          language: sub.language,
          timeSpent: sub.timeSpent,
          submittedAt: sub.submittedAt,
          analysis: sub.analysis
        })),
        feedback: feedback ? {
          overall: feedback.overall,
          technical: feedback.technical,
          communication: feedback.communication,
          recommendations: feedback.recommendations,
          score: feedback.score
        } : null,
        analytics: {
          timeSpent: analytics.timeSpent,
          codeChanges: analytics.codeChanges,
          testsPassed: analytics.testsPassed,
          efficiency: analytics.efficiency
        }
      }
    }
    
  } catch (error) {
    // Re-throw HTTP errors
    if (error.statusCode) {
      throw error
    }
    
    // Handle unexpected errors
    console.error('Get simulation session error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})

// Helper functions
async function getSimulationSessionWithDetails(sessionId: string) {
  // Database query to get session with user details
  return {
    id: sessionId,
    userId: 'user-123',
    type: 'technical',
    difficulty: 'mid',
    duration: 60,
    status: 'completed',
    createdAt: new Date(),
    completedAt: new Date(),
    skills: ['typescript', 'algorithms']
  }
}

async function getSessionSubmissions(sessionId: string) {
  // Get all code submissions for session
  return []
}

async function getSessionFeedback(sessionId: string) {
  // Get AI feedback for completed session
  return null
}

async function getSessionAnalytics(sessionId: string) {
  // Get performance analytics
  return {
    timeSpent: 3600,
    codeChanges: 45,
    testsPassed: 12,
    efficiency: 0.85
  }
}