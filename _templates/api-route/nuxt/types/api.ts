---
to: types/api.ts
---
// Base API Response Types
export interface ApiResponse {
  success: boolean
  message?: string
}

export interface ApiError {
  success: false
  error: string
  statusCode: number
  details?: any
}

// Simulation API Types
export interface SimulationStartRequest {
  userId: string
  interviewType: 'technical' | 'behavioral' | 'system-design'
  difficulty: 'junior' | 'mid' | 'senior'
  duration: number // minutes
  skills?: string[]
}

export interface SimulationStartResponse extends ApiResponse {
  data: {
    sessionId: string
    interviewType: string
    difficulty: string
    duration: number
    aiContext: {
      initialPrompt: string
      suggestedProblems: Array<{
        id: string
        title: string
        description: string
      }>
    }
  }
}

export interface SimulationSubmitRequest {
  sessionId: string
  code: string
  language: 'typescript' | 'javascript' | 'python' | 'java' | 'go'
  timeSpent: number // seconds
  isComplete: boolean
}

export interface SimulationSubmitResponse extends ApiResponse {
  data: {
    submissionId: string
    analysis: {
      score: number
      strengths: string[]
      improvements: string[]
      codeQuality: {
        complexity: string
        maintainability: string
        performance: string
      }
    }
    feedback?: {
      overall: string
      technical: string
      communication: string
      recommendations: string[]
      score: number
    }
    nextStep: string | null
  }
}

export interface SimulationSessionResponse extends ApiResponse {
  data: {
    session: {
      id: string
      type: string
      difficulty: string
      duration: number
      status: string
      createdAt: Date
      completedAt?: Date
      skills: string[]
    }
    submissions: Array<{
      id: string
      code: string
      language: string
      timeSpent: number
      submittedAt: Date
      analysis: any
    }>
    feedback?: {
      overall: string
      technical: string
      communication: string
      recommendations: string[]
      score: number
    }
    analytics: {
      timeSpent: number
      codeChanges: number
      testsPassed: number
      efficiency: number
    }
  }
}

// Feedback API Types
export interface FeedbackAnalyzeCodeRequest {
  sessionId: string
  code: string
  language: string
  context: {
    problemDescription: string
    difficulty: 'junior' | 'mid' | 'senior'
    timeLimit?: number
    requirements?: string[]
  }
}

export interface FeedbackAnalyzeCodeResponse extends ApiResponse {
  data: {
    analysis: {
      correctness: number
      efficiency: number
      codeQuality: number
      bestPractices: number
      suggestions: string[]
    }
    score: number
    breakdown: {
      syntax: number
      logic: number
      structure: number
      optimization: number
    }
  }
}

export interface FeedbackAnalyzeChatRequest {
  sessionId: string
  messages: Array<{
    role: 'user' | 'interviewer'
    content: string
    timestamp: string
  }>
  context: {
    interviewType: 'technical' | 'behavioral' | 'system-design'
    phase: 'introduction' | 'problem-solving' | 'q-and-a' | 'wrap-up'
  }
}

export interface FeedbackAnalyzeChatResponse extends ApiResponse {
  data: {
    communication: {
      clarity: number
      professionalism: number
      technicalExplanation: number
      questionHandling: number
    }
    score: number
    insights: {
      strengths: string[]
      improvements: string[]
      patterns: string[]
    }
  }
}

export interface FeedbackGenerateRequest {
  sessionId: string
  includeCodeAnalysis: boolean
  includeCommunicationAnalysis: boolean
  includeRecommendations: boolean
  format: 'detailed' | 'summary' | 'bullet-points'
}

export interface FeedbackGenerateResponse extends ApiResponse {
  data: {
    feedback: {
      overall: string
      technical: string
      communication: string
      recommendations: string[]
    }
    scores: {
      technical: number
      communication: number
      overall: number
    }
    nextSteps: string[]
  }
}

export interface FeedbackRubricResponse extends ApiResponse {
  data: {
    rubric: {
      technical: {
        weight: number
        criteria: string[]
        scoring: {
          excellent: { min: number; description: string }
          good: { min: number; description: string }
          satisfactory: { min: number; description: string }
          needsImprovement: { min: number; description: string }
        }
      }
      communication: {
        weight: number
        criteria: string[]
        scoring: {
          excellent: { min: number; description: string }
          good: { min: number; description: string }
          satisfactory: { min: number; description: string }
          needsImprovement: { min: number; description: string }
        }
      }
      problemSolving: {
        weight: number
        criteria: string[]
        scoring: {
          excellent: { min: number; description: string }
          good: { min: number; description: string }
          satisfactory: { min: number; description: string }
          needsImprovement: { min: number; description: string }
        }
      }
      overall: {
        passingScore: number
        excellentScore: number
        categories: string[]
      }
    }
    metadata: {
      interviewType: string
      difficulty: string
      version: string
      lastUpdated: string
    }
  }
}

// User Dashboard API Types
export interface UserDashboardResponse extends ApiResponse {
  data: {
    user: {
      id: string
      name: string
      email: string
      avatar: string
      tier: string
      joinedAt: Date
    }
    stats: {
      totalSessions: number
      completedSessions: number
      averageScore: number
      timeSpent: number
      streakDays: number
      skillLevels: Record<string, number>
    }
    recentSessions: Array<{
      id: string
      type: string
      difficulty: string
      score: number
      completedAt: Date
      duration: number
    }>
    achievements: Array<{
      id: string
      name: string
      description: string
      icon: string
      unlockedAt: Date
      rarity: string
    }>
    recommendations: string[]
  }
}

export interface UserHistoryResponse extends ApiResponse {
  data: {
    sessions: Array<{
      id: string
      type: string
      difficulty: string
      status: string
      score: number
      duration: number
      createdAt: Date
      completedAt?: Date
      skills: string[]
      feedback?: {
        overallScore: number
        technicalScore: number
        communicationScore: number
      }
    }>
    pagination: {
      page: number
      limit: number
      total: number
      pages: number
      hasNext: boolean
      hasPrev: boolean
    }
    filters: {
      availableTypes: string[]
      availableStatuses: string[]
      dateRange: {
        earliest: Date
        latest: Date
      }
    }
  }
}

export interface UserAnalyticsResponse extends ApiResponse {
  data: {
    performance: {
      scoreHistory: Array<{ date: Date; score: number }>
      averageScore: number
      improvement: number
      consistency: number
    }
    activity: {
      sessionsPerWeek: number
      timeSpentPerWeek: number
      streakData: Record<string, number>
      busyDays: number[]
    }
    skills: {
      breakdown: Record<string, number>
      strengths: string[]
      improvements: string[]
      progress: Record<string, { current: number; trend: number }>
    }
    comparisons: {
      percentile: number
      similarUsers: any
      industryBenchmark: any
    }
    predictions: {
      nextLevelEstimate: string
      recommendedFocus: string
      careerReadiness: number
    }
  }
}

export interface UserSettingsResponse extends ApiResponse {
  data: {
    settings: {
      profile: {
        name: string
        bio: string
        avatar: string
        timezone: string
        language: string
      }
      preferences: {
        emailNotifications: boolean
        pushNotifications: boolean
        weeklyReports: boolean
        achievementAlerts: boolean
        theme: 'light' | 'dark' | 'auto'
        defaultDifficulty: 'junior' | 'mid' | 'senior'
        preferredLanguages: string[]
      }
      privacy: {
        profilePublic: boolean
        showAchievements: boolean
        shareAnalytics: boolean
        allowDataCollection: boolean
      }
      interview: {
        defaultDuration: number
        autoRecording: boolean
        aiAssistance: boolean
        feedbackDetail: 'minimal' | 'standard' | 'detailed'
      }
    }
    message: string
  }
}

// Mock API Types
export interface CodingDrillsResponse extends ApiResponse {
  data: {
    drills: Array<{
      id: string
      title: string
      description: string
      difficulty: string
      category: string
      estimatedTime: number
      skills: string[]
      languages: string[]
      rating: number
      completionRate: number
      tags: string[]
    }>
    pagination: {
      limit: number
      offset: number
      total: number
      hasMore: boolean
    }
    filters: {
      difficulties: string[]
      categories: string[]
      languages: string[]
    }
  }
}

export interface CodePatternsResponse extends ApiResponse {
  data: {
    patterns: Array<{
      id: string
      name: string
      description: string
      type: string
      complexity: string
      languages: string[]
      example: string
      explanation: string
      useCase: string
      antiPatterns: string[]
      relatedPatterns: string[]
      references: string[]
    }>
    categories: {
      algorithmic: string[]
      structural: string[]
      behavioral: string[]
    }
  }
}

export interface CodeExecutionResponse extends ApiResponse {
  data: {
    execution: {
      success: boolean
      output: string
      error?: string
      executionTime: number
      memoryUsed: number
      exitCode: number
    }
    testResults?: {
      passed: number
      failed: number
      total: number
      details: Array<{
        input: string
        expectedOutput: string
        actualOutput: string
        passed: boolean
        error?: string
        description?: string
      }>
    }
    analysis: {
      codeComplexity: {
        linesOfCode: number
        cyclomaticComplexity: number
        complexity: 'low' | 'medium' | 'high'
      }
      performanceInsights: string[]
      suggestions: string[]
    }
  }
}