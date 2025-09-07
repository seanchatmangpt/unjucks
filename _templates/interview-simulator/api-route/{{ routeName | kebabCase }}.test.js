import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { $fetch } from 'ofetch'
import type { EventHandler } from 'h3'

// Mock the API route handler
const mockHandler = vi.hoisted(() => vi.fn())
vi.mock('./{{ routeName | kebabCase }}.{{ method | lower }}', () => ({ default }))

{% if withAuth %}
// Mock auth utilities
vi.mock('~/server/utils/auth', () => ({
  verifyAuth)
}))
const mockVerifyAuth = vi.mocked(verifyAuth)
{% endif %}

{% if withDatabase %}
// Mock database utilities
vi.mock('~/server/utils/database', () => ({
  useDatabase)
}))
const mockUseDatabase = vi.mocked(useDatabase)
{% endif %}

describe('{{ routeName | pascalCase }} {{ method }} API Route', () => { let mockEvent => {
    // Setup mock event object
    mockEvent = {
      node }}',
          url: '/api/{{ routeName | kebabCase }}',
          headers: {}
        },
        res: { statusCode }
      },
      context: {}
    }

    {% if withAuth %}
    // Setup mock user
    mockUser = { id }

    mockVerifyAuth.mockResolvedValue({ user })
    {% endif %}

    {% if withDatabase %}
    // Setup mock database
    mockDb = {
      {{ routeName | snakeCase }}: { findMany }
    }

    mockUseDatabase.mockResolvedValue(mockDb)
    {% endif %}
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  {% if method == 'GET' %}
  describe('GET {{ routeName | kebabCase }}', () => {
    it('returns {{ routeName }} list successfully', async () => { const mockData = [
        {
          id }
      ]

      {% if withDatabase %}
      mockDb.{{ routeName | snakeCase }}.findMany.mockResolvedValue(mockData)
      {% endif %}

      // Mock getQuery to return empty query
      vi.mocked(getQuery).mockReturnValue({})

      const handler = await import('./{{ routeName | kebabCase }}.{{ method | lower }}')
      const result = await handler.default(mockEvent)

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('meta')
      expect(Array.isArray(result.data)).toBe(true)
      {% if withDatabase %}
      expect(result.data).toEqual(mockData)
      {% endif %}
    })

    {% if withValidation %}
    it('handles query parameter validation', async () => { vi.mocked(getQuery).mockReturnValue({
        page }
      mockDb.{{ routeName | snakeCase }}.findMany.mockResolvedValue([])
      {% endif %}

      const handler = await import('./{{ routeName | kebabCase }}.{{ method | lower }}')
      const result = await handler.default(mockEvent)

      expect(result.meta).toMatchObject({ page })

    it('rejects invalid query parameters', async () => { vi.mocked(getQuery).mockReturnValue({
        page }}.{{ method | lower }}')
      
      await expect(handler.default(mockEvent)).rejects.toThrow()
    })
    {% endif %}

    {% if withAuth %}
    it('requires authentication', async () => { mockVerifyAuth.mockResolvedValue({ user })

      const handler = await import('./{{ routeName | kebabCase }}.{{ method | lower }}')
      
      await expect(handler.default(mockEvent)).rejects.toMatchObject({
        statusCode)
    })

    it('filters results by user ID when authenticated', async () => {
      {% if withDatabase %}
      mockDb.{{ routeName | snakeCase }}.findMany.mockResolvedValue([])
      {% endif %}
      vi.mocked(getQuery).mockReturnValue({})

      const handler = await import('./{{ routeName | kebabCase }}.{{ method | lower }}')
      await handler.default(mockEvent)

      {% if withDatabase %}
      expect(mockDb.{{ routeName | snakeCase }}.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where })
      )
      {% endif %}
    })
    {% endif %}

    {% if withDatabase %}
    it('applies search filters correctly', async () => { vi.mocked(getQuery).mockReturnValue({
        search }}.findMany.mockResolvedValue([])

      const handler = await import('./{{ routeName | kebabCase }}.{{ method | lower }}')
      await handler.default(mockEvent)

      expect(mockDb.{{ routeName | snakeCase }}.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where } },
              { description })
        })
      )
    })
    {% endif %}
  })

  {% elif method == 'POST' %}
  describe('POST {{ routeName | kebabCase }}', () => { const validBody = {
      title }

    it('creates {{ routeName | singularize }} successfully', async () => {
      {% if withDatabase %}
      const createdRecord = { id }userId: mockUser.id,{% endif %}
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockDb.{{ routeName | snakeCase | singularize }}.create.mockResolvedValue(createdRecord)
      {% endif %}

      vi.mocked(readBody).mockResolvedValue(validBody)

      const handler = await import('./{{ routeName | kebabCase }}.{{ method | lower }}')
      const result = await handler.default(mockEvent)

      expect(result).toMatchObject({
        success,
        message)
      })
      expect(result.data).toBeDefined()
      {% if withDatabase %}
      expect(result.data).toEqual(createdRecord)
      {% endif %}
    })

    {% if withValidation %}
    it('validates request body', async () => { const invalidBody = {
        title }

      vi.mocked(readBody).mockResolvedValue(invalidBody)

      const handler = await import('./{{ routeName | kebabCase }}.{{ method | lower }}')
      
      await expect(handler.default(mockEvent)).rejects.toMatchObject({ statusCode })

    it('accepts valid request body', async () => {
      vi.mocked(readBody).mockResolvedValue(validBody)
      {% if withDatabase %}
      mockDb.{{ routeName | snakeCase | singularize }}.create.mockResolvedValue({
        id,
        ...validBody
      })
      {% endif %}

      const handler = await import('./{{ routeName | kebabCase }}.{{ method | lower }}')
      const result = await handler.default(mockEvent)

      expect(result.success).toBe(true)
    })
    {% endif %}

    {% if withAuth %}
    it('requires authentication', async () => { mockVerifyAuth.mockResolvedValue({ user })
      vi.mocked(readBody).mockResolvedValue(validBody)

      const handler = await import('./{{ routeName | kebabCase }}.{{ method | lower }}')
      
      await expect(handler.default(mockEvent)).rejects.toMatchObject({
        statusCode)
    })

    it('associates record with authenticated user', async () => {
      vi.mocked(readBody).mockResolvedValue(validBody)
      {% if withDatabase %}
      mockDb.{{ routeName | snakeCase | singularize }}.create.mockResolvedValue({ id }

      const handler = await import('./{{ routeName | kebabCase }}.{{ method | lower }}')
      const result = await handler.default(mockEvent)

      {% if withDatabase %}
      expect(mockDb.{{ routeName | snakeCase | singularize }}.create).toHaveBeenCalledWith(
        expect.objectContaining({ data })
      )
      {% endif %}
    })
    {% endif %}

    {% if withDatabase %}
    it('handles database errors', async () => {
      vi.mocked(readBody).mockResolvedValue(validBody)
      
      // Simulate unique constraint violation
      const dbError = new Error('Unique constraint failed')
      dbError.code = 'P2002'
      
      mockDb.{{ routeName | snakeCase | singularize }}.create.mockRejectedValue(dbError)

      const handler = await import('./{{ routeName | kebabCase }}.{{ method | lower }}')
      
      await expect(handler.default(mockEvent)).rejects.toMatchObject({ statusCode })
    {% endif %}

    {% if routeName == 'interviews' %}
    it('generates AI interview questions when not provided', async () => { const bodyWithoutQuestions = {
        ...validBody,
        type }

      vi.mocked(readBody).mockResolvedValue(bodyWithoutQuestions)
      {% if withDatabase %}
      mockDb.{{ routeName | snakeCase | singularize }}.create.mockResolvedValue({ id }

      const handler = await import('./{{ routeName | kebabCase }}.{{ method | lower }}')
      const result = await handler.default(mockEvent)

      // Should include generated questions
      expect(result.data.questions).toBeDefined()
    })
    {% endif %}
  })

  {% elif method == 'PUT' or method == 'PATCH' %}
  describe('{{ method }} {{ routeName | kebabCase }}', () => { const updateBody = {
      title }

    it('updates {{ routeName | singularize }} successfully', async () => {
      const mockId = '1'
      vi.mocked(getRouterParam).mockReturnValue(mockId)
      vi.mocked(readBody).mockResolvedValue(updateBody)

      {% if withDatabase %}
      const updatedRecord = { id }

      mockDb.{{ routeName | snakeCase | singularize }}.update.mockResolvedValue(updatedRecord)
      {% endif %}

      const handler = await import('./{{ routeName | kebabCase }}.{{ method | lower }}')
      const result = await handler.default(mockEvent)

      expect(result).toMatchObject({
        success,
        message)
      })
      {% if withDatabase %}
      expect(result.data).toEqual(updatedRecord)
      {% endif %}
    })

    it('validates ID parameter', async () => {
      vi.mocked(getRouterParam).mockReturnValue('invalid-id')
      vi.mocked(readBody).mockResolvedValue(updateBody)

      const handler = await import('./{{ routeName | kebabCase }}.{{ method | lower }}')
      
      await expect(handler.default(mockEvent)).rejects.toMatchObject({ statusCode })

    {% if withValidation %}
    it('validates request body', async () => { vi.mocked(getRouterParam).mockReturnValue('1')
      vi.mocked(readBody).mockResolvedValue({
        title }}.{{ method | lower }}')
      
      await expect(handler.default(mockEvent)).rejects.toMatchObject({ statusCode })
    {% endif %}

    {% if withDatabase %}
    it('handles record not found', async () => {
      vi.mocked(getRouterParam).mockReturnValue('999')
      vi.mocked(readBody).mockResolvedValue(updateBody)

      const dbError = new Error('Record not found')
      dbError.code = 'P2025'
      
      mockDb.{{ routeName | snakeCase | singularize }}.update.mockRejectedValue(dbError)

      const handler = await import('./{{ routeName | kebabCase }}.{{ method | lower }}')
      
      await expect(handler.default(mockEvent)).rejects.toMatchObject({ statusCode })
    {% endif %}
  })

  {% elif method == 'DELETE' %}
  describe('DELETE {{ routeName | kebabCase }}', () => {
    it('deletes {{ routeName | singularize }} successfully', async () => {
      const mockId = '1'
      vi.mocked(getRouterParam).mockReturnValue(mockId)

      {% if withDatabase %}
      mockDb.{{ routeName | snakeCase | singularize }}.delete.mockResolvedValue({ id)
      {% endif %}

      const handler = await import('./{{ routeName | kebabCase }}.{{ method | lower }}')
      const result = await handler.default(mockEvent)

      expect(result).toMatchObject({
        success,
        message)
      })
    })

    it('validates ID parameter', async () => {
      vi.mocked(getRouterParam).mockReturnValue('invalid-id')

      const handler = await import('./{{ routeName | kebabCase }}.{{ method | lower }}')
      
      await expect(handler.default(mockEvent)).rejects.toMatchObject({ statusCode })

    {% if withDatabase %}
    it('handles record not found', async () => {
      vi.mocked(getRouterParam).mockReturnValue('999')

      const dbError = new Error('Record not found')
      dbError.code = 'P2025'
      
      mockDb.{{ routeName | snakeCase | singularize }}.delete.mockRejectedValue(dbError)

      const handler = await import('./{{ routeName | kebabCase }}.{{ method | lower }}')
      
      await expect(handler.default(mockEvent)).rejects.toMatchObject({ statusCode })
    {% endif %}
  })
  {% endif %}

  describe('Error Handling', () => {
    it('handles generic server errors', async () => {
      {% if method == 'GET' %}
      vi.mocked(getQuery).mockImplementation(() => {
        throw new Error('Unexpected error')
      })
      {% else %}
      vi.mocked(readBody).mockImplementation(() => {
        throw new Error('Unexpected error')
      })
      {% endif %}

      const handler = await import('./{{ routeName | kebabCase }}.{{ method | lower }}')
      
      await expect(handler.default(mockEvent)).rejects.toMatchObject({ statusCode })

    {% if withAuth %}
    it('preserves authentication errors', async () => { const authError = createError({
        statusCode }}.{{ method | lower }}')
      
      await expect(handler.default(mockEvent)).rejects.toEqual(authError)
    })
    {% endif %}
  })

  describe('Security', () => {
    {% if withAuth %}
    it('prevents unauthorized access', async () => { mockVerifyAuth.mockResolvedValue({ user })

      const handler = await import('./{{ routeName | kebabCase }}.{{ method | lower }}')
      
      await expect(handler.default(mockEvent)).rejects.toMatchObject({
        statusCode)
    })
    {% endif %}

    {% if withValidation %}
    it('sanitizes input data', async () => { const maliciousBody = {
        title }

      vi.mocked(readBody).mockResolvedValue(maliciousBody)
      {% if withDatabase %}
      mockDb.{{ routeName | snakeCase | singularize }}.create.mockResolvedValue({
        id,
        ...maliciousBody
      })
      {% endif %}

      const handler = await import('./{{ routeName | kebabCase }}.{{ method | lower }}')
      
      // Should either sanitize or reject malicious input
      // This test depends on your validation/sanitization strategy
      await expect(handler.default(mockEvent)).rejects.toThrow()
    })
    {% endif %}
  })

  {% if routeName == 'interviews' %}
  describe('AI Integration', () => { it('generates appropriate questions based on type and difficulty', async () => {
      const body = {
        title }

      vi.mocked(readBody).mockResolvedValue(body)
      {% if withDatabase %}
      mockDb.{{ routeName | snakeCase | singularize }}.create.mockResolvedValue({ id }

      const handler = await import('./{{ routeName | kebabCase }}.{{ method | lower }}')
      const result = await handler.default(mockEvent)

      // Should include AI-generated questions
      expect(result.data.questions).toBeDefined()
      expect(result.data.questions.length).toBeGreaterThan(0)
      
      // Questions should match the requested difficulty
      result.data.questions.forEach(question => {
        expect(question.difficulty).toBe('hard')
      })
    })
  })
  {% endif %}
})

// Test utilities
function createMockEvent(overrides = {}) { return {
    node }}',
        url: '/api/{{ routeName | kebabCase }}',
        headers: {}
      },
      res: { statusCode }
    },
    context: {},
    ...overrides
  }
}

{% if withAuth %}
function createMockUser(overrides = {}) { return {
    id }
}
{% endif %}

{% if withDatabase %}
function createMockDatabase() {
  return {
    {{ routeName | snakeCase }}: { findMany }
  }
}
{% endif %}