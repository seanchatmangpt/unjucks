---
to: server/utils/validation.ts
---
import { z } from 'zod'

/**
 * Common validation schemas for API routes
 */

// UUID validation
export const uuidSchema = z.string().uuid('Invalid UUID format')

// Email validation
export const emailSchema = z.string().email('Invalid email format')

// Password validation
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')

// Programming languages
export const programmingLanguageSchema = z.enum([
  'typescript',
  'javascript',
  'python',
  'java',
  'go',
  'rust',
  'cpp',
  'csharp'
])

// Interview types
export const interviewTypeSchema = z.enum([
  'technical',
  'behavioral',
  'system-design'
])

// Difficulty levels
export const difficultySchema = z.enum([
  'junior',
  'mid',
  'senior',
  'expert'
])

// Pagination parameters
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).optional()
})

// Date range validation
export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional()
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate
    }
    return true
  },
  {
    message: 'Start date must be before or equal to end date',
    path: ['dateRange']
  }
)

// File upload validation
export const fileUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimetype: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_.]*$/),
  size: z.number().max(10 * 1024 * 1024) // 10MB max
})

// User profile validation
export const userProfileSchema = z.object({
  name: z.string().min(2).max(50),
  bio: z.string().max(200).optional(),
  avatar: z.string().url().optional(),
  timezone: z.string().optional(),
  language: z.enum(['en', 'es', 'fr', 'de', 'zh']).default('en')
})

// Code submission validation
export const codeSubmissionSchema = z.object({
  code: z.string().min(1).max(50000), // 50KB max
  language: programmingLanguageSchema,
  timeSpent: z.number().min(0),
  testCases: z.array(z.object({
    input: z.string(),
    expectedOutput: z.string(),
    description: z.string().optional()
  })).optional()
})

// Session creation validation
export const sessionCreationSchema = z.object({
  userId: uuidSchema,
  interviewType: interviewTypeSchema,
  difficulty: difficultySchema,
  duration: z.number().min(15).max(180), // 15 minutes to 3 hours
  skills: z.array(z.string()).optional(),
  settings: z.object({
    autoRecording: z.boolean().default(false),
    aiAssistance: z.boolean().default(true),
    strictMode: z.boolean().default(false)
  }).optional()
})

// Feedback validation
export const feedbackSchema = z.object({
  sessionId: uuidSchema,
  scores: z.object({
    technical: z.number().min(0).max(100),
    communication: z.number().min(0).max(100),
    problemSolving: z.number().min(0).max(100),
    overall: z.number().min(0).max(100)
  }),
  feedback: z.object({
    strengths: z.array(z.string()).min(1),
    improvements: z.array(z.string()).min(1),
    recommendations: z.array(z.string()).optional(),
    comments: z.string().max(2000).optional()
  }),
  rubricVersion: z.string().default('1.0.0')
})

// Settings validation
export const userSettingsSchema = z.object({
  profile: userProfileSchema.partial().optional(),
  preferences: z.object({
    emailNotifications: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
    weeklyReports: z.boolean().optional(),
    achievementAlerts: z.boolean().optional(),
    theme: z.enum(['light', 'dark', 'auto']).optional(),
    defaultDifficulty: difficultySchema.optional(),
    preferredLanguages: z.array(programmingLanguageSchema).optional()
  }).optional(),
  privacy: z.object({
    profilePublic: z.boolean().optional(),
    showAchievements: z.boolean().optional(),
    shareAnalytics: z.boolean().optional(),
    allowDataCollection: z.boolean().optional()
  }).optional(),
  interview: z.object({
    defaultDuration: z.number().min(15).max(180).optional(),
    autoRecording: z.boolean().optional(),
    aiAssistance: z.boolean().optional(),
    feedbackDetail: z.enum(['minimal', 'standard', 'detailed']).optional()
  }).optional()
})

// Analytics query validation
export const analyticsQuerySchema = z.object({
  timeRange: z.enum(['24h', '7d', '30d', '90d', '1y']).default('30d'),
  skills: z.string().transform((str) => str.split(',')).optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
  metrics: z.array(z.enum([
    'sessions',
    'scores',
    'time_spent',
    'completion_rate'
  ])).default(['sessions', 'scores'])
})

/**
 * Custom validation functions
 */

export function validateJSON(value: string): boolean {
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

export function validateCodeSafety(code: string, language: string): {
  safe: boolean
  violations: string[]
} {
  const violations: string[] = []
  
  // Basic security patterns to avoid
  const dangerousPatterns = {
    javascript: [
      /eval\s*\(/,
      /Function\s*\(/,
      /require\s*\(['"][^'"]*fs['"]\)/,
      /process\.exit/,
      /child_process/,
      /exec\s*\(/,
      /execSync\s*\(/
    ],
    typescript: [
      /eval\s*\(/,
      /Function\s*\(/,
      /require\s*\(['"][^'"]*fs['"]\)/,
      /process\.exit/,
      /child_process/,
      /exec\s*\(/,
      /execSync\s*\(/
    ],
    python: [
      /import\s+os/,
      /import\s+subprocess/,
      /import\s+sys/,
      /exec\s*\(/,
      /eval\s*\(/,
      /__import__/,
      /open\s*\(/
    ]
  }
  
  const patterns = dangerousPatterns[language as keyof typeof dangerousPatterns] || []
  
  for (const pattern of patterns) {
    if (pattern.test(code)) {
      violations.push(`Potentially unsafe operation: ${pattern.source}`)
    }
  }
  
  return {
    safe: violations.length === 0,
    violations
  }
}

export function validateFileExtension(filename: string, allowedExtensions: string[]): boolean {
  const extension = filename.split('.').pop()?.toLowerCase()
  return extension ? allowedExtensions.includes(extension) : false
}

export function sanitizeFilename(filename: string): string {
  // Remove or replace dangerous characters
  return filename
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 255)
}

export function validateURL(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export function validateIPAddress(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  const ipv6Regex = /^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip)
}

/**
 * Validation middleware helper
 */
export function createValidator<T>(schema: z.ZodSchema<T>) {
  return async (data: unknown): Promise<T> => {
    try {
      return await schema.parseAsync(data)
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Validation failed',
          data: {
            errors: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code
            }))
          }
        })
      }
      throw error
    }
  }
}

/**
 * Request body validator
 */
export async function validateBody<T>(event: any, schema: z.ZodSchema<T>): Promise<T> {
  const body = await readBody(event)
  const validator = createValidator(schema)
  return validator(body)
}

/**
 * Query parameters validator
 */
export function validateQuery<T>(event: any, schema: z.ZodSchema<T>): T {
  const query = getQuery(event)
  const validator = createValidator(schema)
  return validator(query) as T
}

/**
 * Route parameters validator
 */
export function validateParams<T>(event: any, schema: z.ZodSchema<T>): T {
  const params = getRouterParams(event)
  const validator = createValidator(schema)
  return validator(params) as T
}