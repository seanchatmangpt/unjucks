---
to: server/api/feedback/rubric.get.ts
---
import type { FeedbackRubricResponse, ApiError } from '~/types/api'

export default defineEventHandler(async (event): Promise<FeedbackRubricResponse | ApiError> => {
  try {
    // Optional query parameters for customization
    const query = getQuery(event)
    const interviewType = query.type as string || 'technical'
    const difficulty = query.difficulty as string || 'mid'
    
    // Get appropriate rubric based on parameters
    const rubric = await getFeedbackRubric(interviewType, difficulty)
    
    return {
      success: true,
      data: {
        rubric: {
          technical: {
            weight: rubric.technical.weight,
            criteria: rubric.technical.criteria,
            scoring: rubric.technical.scoring
          },
          communication: {
            weight: rubric.communication.weight,
            criteria: rubric.communication.criteria,
            scoring: rubric.communication.scoring
          },
          problemSolving: {
            weight: rubric.problemSolving.weight,
            criteria: rubric.problemSolving.criteria,
            scoring: rubric.problemSolving.scoring
          },
          overall: {
            passingScore: rubric.overall.passingScore,
            excellentScore: rubric.overall.excellentScore,
            categories: rubric.overall.categories
          }
        },
        metadata: {
          interviewType,
          difficulty,
          version: rubric.version,
          lastUpdated: rubric.lastUpdated
        }
      }
    }
    
  } catch (error) {
    console.error('Get feedback rubric error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})

// Helper function
async function getFeedbackRubric(type: string, difficulty: string) {
  // Return appropriate rubric configuration
  const baseRubric = {
    technical: {
      weight: 0.6,
      criteria: [
        'Code correctness',
        'Algorithm efficiency',
        'Code quality and style',
        'Error handling',
        'Best practices'
      ],
      scoring: {
        excellent: { min: 90, description: 'Exceptional technical implementation' },
        good: { min: 75, description: 'Solid technical skills demonstrated' },
        satisfactory: { min: 60, description: 'Basic technical requirements met' },
        needsImprovement: { min: 0, description: 'Technical skills need development' }
      }
    },
    communication: {
      weight: 0.3,
      criteria: [
        'Clarity of explanation',
        'Professional communication',
        'Question handling',
        'Technical terminology usage',
        'Active listening'
      ],
      scoring: {
        excellent: { min: 90, description: 'Outstanding communication skills' },
        good: { min: 75, description: 'Clear and professional communication' },
        satisfactory: { min: 60, description: 'Adequate communication' },
        needsImprovement: { min: 0, description: 'Communication needs improvement' }
      }
    },
    problemSolving: {
      weight: 0.1,
      criteria: [
        'Problem understanding',
        'Solution approach',
        'Edge case consideration',
        'Debugging ability',
        'Adaptability'
      ],
      scoring: {
        excellent: { min: 90, description: 'Exceptional problem-solving approach' },
        good: { min: 75, description: 'Good analytical thinking' },
        satisfactory: { min: 60, description: 'Basic problem-solving skills' },
        needsImprovement: { min: 0, description: 'Problem-solving needs work' }
      }
    },
    overall: {
      passingScore: 70,
      excellentScore: 85,
      categories: ['Technical Skills', 'Communication', 'Problem Solving']
    },
    version: '1.0.0',
    lastUpdated: new Date().toISOString()
  }
  
  // Adjust weights based on interview type
  if (type === 'behavioral') {
    baseRubric.communication.weight = 0.7
    baseRubric.technical.weight = 0.2
    baseRubric.problemSolving.weight = 0.1
  } else if (type === 'system-design') {
    baseRubric.technical.weight = 0.5
    baseRubric.communication.weight = 0.3
    baseRubric.problemSolving.weight = 0.2
  }
  
  return baseRubric
}