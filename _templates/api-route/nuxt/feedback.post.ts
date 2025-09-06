---
to: server/api/feedback/{{ action }}.post.ts
---
import { z } from 'zod'
import type { {{ routeName | pascalCase }}Request, {{ routeName | pascalCase }}Response, ApiError } from '~/types/api'

const {{ routeName | camelCase }}Schema = z.object({
  {% if action === 'analyze-code' -%}
  sessionId: z.string().uuid(),
  code: z.string().min(1),
  language: z.enum(['typescript', 'javascript', 'python', 'java', 'go']),
  context: z.object({
    problemDescription: z.string(),
    difficulty: z.enum(['junior', 'mid', 'senior']),
    timeLimit: z.number().optional(),
    requirements: z.array(z.string()).optional()
  }),
  {% elif action === 'analyze-chat' -%}
  sessionId: z.string().uuid(),
  messages: z.array(z.object({
    role: z.enum(['user', 'interviewer']),
    content: z.string(),
    timestamp: z.string().datetime()
  })),
  context: z.object({
    interviewType: z.enum(['technical', 'behavioral', 'system-design']),
    phase: z.enum(['introduction', 'problem-solving', 'q-and-a', 'wrap-up'])
  }),
  {% elif action === 'generate' -%}
  sessionId: z.string().uuid(),
  includeCodeAnalysis: z.boolean().default(true),
  includeCommunicationAnalysis: z.boolean().default(true),
  includeRecommendations: z.boolean().default(true),
  format: z.enum(['detailed', 'summary', 'bullet-points']).default('detailed'),
  {% endif -%}
})

export default defineEventHandler(async (event): Promise<{{ routeName | pascalCase }}Response | ApiError> => {
  try {
    // Validate request method
    assertMethod(event, 'POST')
    
    // Parse and validate request body
    const body = await readBody(event)
    const validated = {{ routeName | camelCase }}Schema.parse(body)
    
    // Authentication check
    const user = await getUserFromToken(event)
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication required'
      })
    }
    
    // Verify session access
    const session = await getSimulationSession(validated.sessionId)
    if (!session || session.userId !== user.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied'
      })
    }
    
    {% if action === 'analyze-code' -%}
    // Analyze code using AI models
    const analysis = await analyzeCodeWithAI({
      code: validated.code,
      language: validated.language,
      context: validated.context,
      sessionHistory: await getSessionContext(validated.sessionId)
    })
    
    // Store analysis results
    await storeCodeAnalysis({
      sessionId: validated.sessionId,
      analysis,
      timestamp: new Date()
    })
    
    return {
      success: true,
      data: {
        analysis: {
          correctness: analysis.correctness,
          efficiency: analysis.efficiency,
          codeQuality: analysis.codeQuality,
          bestPractices: analysis.bestPractices,
          suggestions: analysis.suggestions
        },
        score: analysis.overallScore,
        breakdown: {
          syntax: analysis.syntaxScore,
          logic: analysis.logicScore,
          structure: analysis.structureScore,
          optimization: analysis.optimizationScore
        }
      }
    }
    
    {% elif action === 'analyze-chat' -%}
    // Analyze communication patterns
    const analysis = await analyzeCommunicationWithAI({
      messages: validated.messages,
      context: validated.context,
      sessionMetadata: await getSessionMetadata(validated.sessionId)
    })
    
    // Store communication analysis
    await storeCommunicationAnalysis({
      sessionId: validated.sessionId,
      analysis,
      timestamp: new Date()
    })
    
    return {
      success: true,
      data: {
        communication: {
          clarity: analysis.clarity,
          professionalism: analysis.professionalism,
          technicalExplanation: analysis.technicalExplanation,
          questionHandling: analysis.questionHandling
        },
        score: analysis.overallScore,
        insights: {
          strengths: analysis.strengths,
          improvements: analysis.improvements,
          patterns: analysis.patterns
        }
      }
    }
    
    {% elif action === 'generate' -%}
    // Generate comprehensive feedback
    const [codeAnalyses, communicationAnalyses, sessionData] = await Promise.all([
      validated.includeCodeAnalysis ? getCodeAnalyses(validated.sessionId) : null,
      validated.includeCommunicationAnalysis ? getCommunicationAnalyses(validated.sessionId) : null,
      getSessionSummary(validated.sessionId)
    ])
    
    const feedback = await generateComprehensiveFeedback({
      sessionId: validated.sessionId,
      codeAnalyses,
      communicationAnalyses,
      sessionData,
      format: validated.format,
      includeRecommendations: validated.includeRecommendations
    })
    
    // Store generated feedback
    await storeFeedback({
      sessionId: validated.sessionId,
      feedback,
      generatedAt: new Date()
    })
    
    return {
      success: true,
      data: {
        feedback: {
          overall: feedback.overall,
          technical: feedback.technical,
          communication: feedback.communication,
          recommendations: feedback.recommendations
        },
        scores: {
          technical: feedback.technicalScore,
          communication: feedback.communicationScore,
          overall: feedback.overallScore
        },
        nextSteps: feedback.nextSteps
      }
    }
    {% endif -%}
    
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation failed',
        data: {
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        }
      })
    }
    
    // Re-throw HTTP errors
    if (error.statusCode) {
      throw error
    }
    
    // Handle unexpected errors
    console.error('{{ routeName | pascalCase }} API error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})

// AI Analysis Functions
async function analyzeCodeWithAI(params: any) {
  // Integration with AI models for code analysis
  return {
    correctness: 85,
    efficiency: 78,
    codeQuality: 92,
    bestPractices: 88,
    suggestions: ['Add error handling', 'Consider edge cases'],
    overallScore: 86,
    syntaxScore: 95,
    logicScore: 82,
    structureScore: 88,
    optimizationScore: 75
  }
}

async function analyzeCommunicationWithAI(params: any) {
  // Integration with AI models for communication analysis
  return {
    clarity: 88,
    professionalism: 92,
    technicalExplanation: 85,
    questionHandling: 80,
    overallScore: 86,
    strengths: ['Clear explanations', 'Professional tone'],
    improvements: ['Ask clarifying questions', 'More detailed reasoning'],
    patterns: ['Consistent communication style']
  }
}

async function generateComprehensiveFeedback(params: any) {
  // Generate detailed feedback combining all analyses
  return {
    overall: 'Strong performance with room for improvement in optimization',
    technical: 'Solid technical skills demonstrated',
    communication: 'Professional communication throughout',
    recommendations: ['Practice algorithm optimization', 'Focus on edge cases'],
    technicalScore: 85,
    communicationScore: 88,
    overallScore: 86,
    nextSteps: ['Advanced algorithms course', 'Mock interviews']
  }
}