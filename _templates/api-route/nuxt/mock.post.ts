---
to: server/api/mock/execute.post.ts
---
import { z } from 'zod'
import type { CodeExecutionResponse, ApiError } from '~/types/api'

const codeExecutionSchema = z.object({
  code: z.string().min(1),
  language: z.enum(['typescript', 'javascript', 'python', 'java', 'go']),
  input: z.string().optional(),
  testCases: z.array(z.object({
    input: z.string(),
    expectedOutput: z.string(),
    description: z.string().optional()
  })).optional(),
  timeout: z.number().min(1).max(30).default(10), // seconds
  memoryLimit: z.number().min(16).max(512).default(128) // MB
})

export default defineEventHandler(async (event): Promise<CodeExecutionResponse | ApiError> => {
  try {
    // Validate request method
    assertMethod(event, 'POST')
    
    // Parse and validate request body
    const body = await readBody(event)
    const validated = codeExecutionSchema.parse(body)
    
    // Optional: Check rate limiting
    const clientIP = getClientIP(event)
    const canExecute = await checkRateLimit(clientIP, 'code-execution', 10, 60) // 10 requests per minute
    
    if (!canExecute) {
      throw createError({
        statusCode: 429,
        statusMessage: 'Rate limit exceeded. Please try again later.'
      })
    }
    
    // Validate code for security (basic checks)
    const securityCheck = await validateCodeSecurity(validated.code, validated.language)
    if (!securityCheck.safe) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Code contains potentially unsafe operations',
        data: {
          violations: securityCheck.violations
        }
      })
    }
    
    // Execute code in sandboxed environment
    const executionResult = await executeCodeSafely({
      code: validated.code,
      language: validated.language,
      input: validated.input || '',
      timeout: validated.timeout,
      memoryLimit: validated.memoryLimit
    })
    
    // Run test cases if provided
    let testResults = null
    if (validated.testCases && validated.testCases.length > 0) {
      testResults = await runTestCases({
        code: validated.code,
        language: validated.language,
        testCases: validated.testCases,
        timeout: validated.timeout,
        memoryLimit: validated.memoryLimit
      })
    }
    
    // Log execution for analytics
    await logCodeExecution({
      language: validated.language,
      codeLength: validated.code.length,
      executionTime: executionResult.executionTime,
      memoryUsed: executionResult.memoryUsed,
      success: executionResult.success,
      timestamp: new Date(),
      clientIP
    })
    
    return {
      success: true,
      data: {
        execution: {
          success: executionResult.success,
          output: executionResult.output,
          error: executionResult.error,
          executionTime: executionResult.executionTime,
          memoryUsed: executionResult.memoryUsed,
          exitCode: executionResult.exitCode
        },
        testResults: testResults ? {
          passed: testResults.passed,
          failed: testResults.failed,
          total: testResults.total,
          details: testResults.details
        } : null,
        analysis: {
          codeComplexity: await analyzeCodeComplexity(validated.code, validated.language),
          performanceInsights: await generatePerformanceInsights(executionResult),
          suggestions: await generateCodeSuggestions(validated.code, validated.language)
        }
      }
    }
    
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
    console.error('Code execution API error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})

// Security validation
async function validateCodeSecurity(code: string, language: string) {
  const violations: string[] = []
  
  // Basic security checks (expand based on requirements)
  const dangerousPatterns = {
    javascript: [
      /eval\s*\(/,
      /Function\s*\(/,
      /require\s*\(/,
      /import\s+.*\bfs\b/,
      /process\.exit/,
      /child_process/
    ],
    python: [
      /import\s+os/,
      /import\s+subprocess/,
      /import\s+sys/,
      /exec\s*\(/,
      /eval\s*\(/,
      /__import__/
    ]
  }
  
  const patterns = dangerousPatterns[language as keyof typeof dangerousPatterns] || []
  
  for (const pattern of patterns) {
    if (pattern.test(code)) {
      violations.push(`Potentially unsafe operation detected: ${pattern.source}`)
    }
  }
  
  return {
    safe: violations.length === 0,
    violations
  }
}

// Code execution in sandboxed environment
async function executeCodeSafely(params: any) {
  const startTime = Date.now()
  
  try {
    // Mock execution - in production, this would use Docker containers or similar
    // sandbox environment
    const result = await mockCodeExecution(params)
    
    const executionTime = Date.now() - startTime
    
    return {
      success: true,
      output: result.output,
      error: null,
      executionTime,
      memoryUsed: result.memoryUsed || 0,
      exitCode: 0
    }
  } catch (error) {
    const executionTime = Date.now() - startTime
    
    return {
      success: false,
      output: '',
      error: error.message,
      executionTime,
      memoryUsed: 0,
      exitCode: 1
    }
  }
}

// Mock code execution function
async function mockCodeExecution(params: any) {
  // Simulate different scenarios based on code content
  if (params.code.includes('console.log') || params.code.includes('print')) {
    const matches = params.code.match(/(?:console\.log|print)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/)
    const output = matches ? matches[1] : 'Hello, World!'
    return { output, memoryUsed: 1024 } // 1KB
  }
  
  if (params.code.includes('function') || params.code.includes('def ')) {
    return { output: 'Function defined successfully', memoryUsed: 2048 }
  }
  
  if (params.code.includes('for') || params.code.includes('while')) {
    return { output: 'Loop executed successfully', memoryUsed: 4096 }
  }
  
  // Simulate timeout for infinite loops
  if (params.code.includes('while(true)') || params.code.includes('while True:')) {
    throw new Error('Execution timeout: infinite loop detected')
  }
  
  return { output: 'Code executed successfully', memoryUsed: 1024 }
}

// Test case execution
async function runTestCases(params: any) {
  const results = {
    passed: 0,
    failed: 0,
    total: params.testCases.length,
    details: [] as any[]
  }
  
  for (const testCase of params.testCases) {
    try {
      // Execute code with test input
      const execution = await executeCodeSafely({
        ...params,
        input: testCase.input
      })
      
      const passed = execution.success && execution.output.trim() === testCase.expectedOutput.trim()
      
      if (passed) {
        results.passed++
      } else {
        results.failed++
      }
      
      results.details.push({
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: execution.output,
        passed,
        error: execution.error,
        description: testCase.description
      })
    } catch (error) {
      results.failed++
      results.details.push({
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: '',
        passed: false,
        error: error.message,
        description: testCase.description
      })
    }
  }
  
  return results
}

// Code analysis functions
async function analyzeCodeComplexity(code: string, language: string) {
  // Simple complexity analysis
  const lines = code.split('\n').length
  const cyclomaticComplexity = (code.match(/if|for|while|switch|catch/g) || []).length + 1
  
  return {
    linesOfCode: lines,
    cyclomaticComplexity,
    complexity: cyclomaticComplexity <= 5 ? 'low' : cyclomaticComplexity <= 10 ? 'medium' : 'high'
  }
}

async function generatePerformanceInsights(executionResult: any) {
  const insights = []
  
  if (executionResult.executionTime > 5000) {
    insights.push('Consider optimizing for better performance - execution took over 5 seconds')
  }
  
  if (executionResult.memoryUsed > 50 * 1024 * 1024) {
    insights.push('High memory usage detected - consider memory optimization')
  }
  
  return insights
}

async function generateCodeSuggestions(code: string, language: string) {
  const suggestions = []
  
  if (!code.includes('try') && !code.includes('catch')) {
    suggestions.push('Consider adding error handling with try-catch blocks')
  }
  
  if (language === 'javascript' || language === 'typescript') {
    if (!code.includes('const') && !code.includes('let')) {
      suggestions.push('Use const or let instead of var for better scoping')
    }
  }
  
  return suggestions
}

// Helper functions
async function checkRateLimit(identifier: string, key: string, limit: number, window: number): Promise<boolean> {
  // Mock rate limiting - implement with Redis or similar in production
  return true
}

async function logCodeExecution(data: any) {
  // Log execution for analytics
}