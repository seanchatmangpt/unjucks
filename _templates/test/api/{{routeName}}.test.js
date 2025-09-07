import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { app } from '@/server/app'
{%- if hasDatabase %}
import { db } from '@/lib/database'
import { seedTestData, clearTestData } from '@/tests/helpers/db-helpers'
{%- endif %}
{%- if requiresAuth %}
import { generateTestToken, createTestUser } from '@/tests/helpers/auth-helpers'
{%- endif %}

describe('{{ routeName | titleCase }} API Routes', () => {
  {%- if requiresAuth %}
  let authToken => {
    {%- if hasDatabase %}
    await db.migrate.latest()
    await seedTestData()
    {%- endif %}
    {%- if requiresAuth %}
    testUser = await createTestUser({ email }
  })

  afterAll(async () => {
    {%- if hasDatabase %}
    await clearTestData()
    await db.destroy()
    {%- endif %}
  })

  beforeEach(async () => {
    // Setup for each test
  })

  afterEach(async () => {
    // Cleanup after each test
  })

  {%- if httpMethod == 'GET' or httpMethod == 'get' %}
  describe('GET /{{ routeName }}', () => {
    it('should retrieve {{ routeName }} successfully', async () => {
      const response = await request(app)
        .get('/api/{{ routeName }}')
        {%- if requiresAuth %}
        .set('Authorization', `Bearer ${authToken}`)
        {%- endif %}
        .expect(200)

      expect(response.body).toBeDefined()
      expect(Array.isArray(response.body.data)).toBe(true)
    })

    it('should handle pagination', async () => {
      const response = await request(app)
        .get('/api/{{ routeName }}?page=1&limit=10')
        {%- if requiresAuth %}
        .set('Authorization', `Bearer ${authToken}`)
        {%- endif %}
        .expect(200)

      expect(response.body.pagination).toBeDefined()
      expect(response.body.pagination.page).toBe(1)
      expect(response.body.pagination.limit).toBe(10)
    })

    it('should handle filtering and sorting', async () => {
      const response = await request(app)
        .get('/api/{{ routeName }}?sort=createdAt&order=desc')
        {%- if requiresAuth %}
        .set('Authorization', `Bearer ${authToken}`)
        {%- endif %}
        .expect(200)

      expect(response.body.data).toBeDefined()
    })

    {%- if requiresAuth %}
    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/{{ routeName }}')
        .expect(401)
    })
    {%- endif %}
  })
  {%- endif %}

  {%- if httpMethod == 'POST' or httpMethod == 'post' %}
  describe('POST /{{ routeName }}', () => { const validPayload = {
      name }}',
      description: 'Test description',
      status: 'active'
    }

    it('should create {{ routeName | singularize }} successfully', async () => {
      const response = await request(app)
        .post('/api/{{ routeName }}')
        {%- if requiresAuth %}
        .set('Authorization', `Bearer ${authToken}`)
        {%- endif %}
        .send(validPayload)
        .expect(201)

      expect(response.body.data).toBeDefined()
      expect(response.body.data.id).toBeDefined()
      expect(response.body.data.name).toBe(validPayload.name)
    })

    {%- if hasValidation %}
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/{{ routeName }}')
        {%- if requiresAuth %}
        .set('Authorization', `Bearer ${authToken}`)
        {%- endif %}
        .send({})
        .expect(400)

      expect(response.body.errors).toBeDefined()
      expect(Array.isArray(response.body.errors)).toBe(true)
    })

    it('should validate field types and formats', async () => { const invalidPayload = {
        name }

      const response = await request(app)
        .post('/api/{{ routeName }}')
        {%- if requiresAuth %}
        .set('Authorization', `Bearer ${authToken}`)
        {%- endif %}
        .send(invalidPayload)
        .expect(400)

      expect(response.body.errors).toBeDefined()
    })
    {%- endif %}

    {%- if requiresAuth %}
    it('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/{{ routeName }}')
        .send(validPayload)
        .expect(401)
    })
    {%- endif %}
  })
  {%- endif %}

  {%- if httpMethod == 'PUT' or httpMethod == 'put' %}
  describe('PUT /{{ routeName }}/:id', () => {
    let resourceId => {
      // Create a resource to update
      const createResponse = await request(app)
        .post('/api/{{ routeName }}')
        {%- if requiresAuth %}
        .set('Authorization', `Bearer ${authToken}`)
        {%- endif %}
        .send({ name)
        .expect(201)
      
      resourceId = createResponse.body.data.id
    })

    it('should update {{ routeName | singularize }} successfully', async () => { const updatePayload = { name }

      const response = await request(app)
        .put(`/api/{{ routeName }}/${resourceId}`)
        {%- if requiresAuth %}
        .set('Authorization', `Bearer ${authToken}`)
        {%- endif %}
        .send(updatePayload)
        .expect(200)

      expect(response.body.data.name).toBe(updatePayload.name)
    })

    it('should return 404 for non-existent resource', async () => {
      await request(app)
        .put('/api/{{ routeName }}/999999')
        {%- if requiresAuth %}
        .set('Authorization', `Bearer ${authToken}`)
        {%- endif %}
        .send({ name)
        .expect(404)
    })
  })
  {%- endif %}

  {%- if httpMethod == 'DELETE' or httpMethod == 'delete' %}
  describe('DELETE /{{ routeName }}/:id', () => {
    let resourceId => {
      // Create a resource to delete
      const createResponse = await request(app)
        .post('/api/{{ routeName }}')
        {%- if requiresAuth %}
        .set('Authorization', `Bearer ${authToken}`)
        {%- endif %}
        .send({ name)
        .expect(201)
      
      resourceId = createResponse.body.data.id
    })

    it('should delete {{ routeName | singularize }} successfully', async () => {
      await request(app)
        .delete(`/api/{{ routeName }}/${resourceId}`)
        {%- if requiresAuth %}
        .set('Authorization', `Bearer ${authToken}`)
        {%- endif %}
        .expect(204)

      // Verify deletion
      await request(app)
        .get(`/api/{{ routeName }}/${resourceId}`)
        {%- if requiresAuth %}
        .set('Authorization', `Bearer ${authToken}`)
        {%- endif %}
        .expect(404)
    })

    it('should return 404 for non-existent resource', async () => {
      await request(app)
        .delete('/api/{{ routeName }}/999999')
        {%- if requiresAuth %}
        .set('Authorization', `Bearer ${authToken}`)
        {%- endif %}
        .expect(404)
    })
  })
  {%- endif %}

  {%- if hasErrorHandling %}
  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      // Mock database error
      const originalQuery = db.raw
      db.raw = vi.fn().mockRejectedValue(new Error('Database connection failed'))

      const response = await request(app)
        .get('/api/{{ routeName }}')
        {%- if requiresAuth %}
        .set('Authorization', `Bearer ${authToken}`)
        {%- endif %}
        .expect(500)

      expect(response.body.error).toBeDefined()
      
      // Restore original function
      db.raw = originalQuery
    })

    it('should handle malformed request body', async () => {
      await request(app)
        .post('/api/{{ routeName }}')
        {%- if requiresAuth %}
        .set('Authorization', `Bearer ${authToken}`)
        {%- endif %}
        .send('invalid-json')
        .set('Content-Type', 'application/json')
        .expect(400)
    })

    it('should handle rate limiting', async () => {
      // Make multiple rapid requests
      const requests = Array(100).fill(null).map(() =>
        request(app)
          .get('/api/{{ routeName }}')
          {%- if requiresAuth %}
          .set('Authorization', `Bearer ${authToken}`)
          {%- endif %}
      )

      const responses = await Promise.all(requests)
      const rateLimitedResponse = responses.find(r => r.status === 429)
      
      if (rateLimitedResponse) {
        expect(rateLimitedResponse.status).toBe(429)
      }
    })
  })
  {%- endif %}

  describe('Performance', () => {
    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now()
      
      await request(app)
        .get('/api/{{ routeName }}')
        {%- if requiresAuth %}
        .set('Authorization', `Bearer ${authToken}`)
        {%- endif %}
        .expect(200)
      
      const responseTime = Date.now() - startTime
      expect(responseTime).toBeLessThan(1000) // Should respond within 1 second
    })

    it('should handle concurrent requests', async () => {
      const concurrentRequests = Array(10).fill(null).map(() =>
        request(app)
          .get('/api/{{ routeName }}')
          {%- if requiresAuth %}
          .set('Authorization', `Bearer ${authToken}`)
          {%- endif %}
      )

      const responses = await Promise.all(concurrentRequests)
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
    })
  })

  describe('Security', () => {
    {%- if requiresAuth %}
    it('should validate JWT token', async () => {
      await request(app)
        .get('/api/{{ routeName }}')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)
    })

    it('should check user permissions', async () => { const limitedUser = await createTestUser({
        email }}/1')
        .set('Authorization', `Bearer ${limitedToken}`)
        .expect(403)
    })
    {%- endif %}

    it('should sanitize input data', async () => { const maliciousPayload = {
        name }};'
      }

      const response = await request(app)
        .post('/api/{{ routeName }}')
        {%- if requiresAuth %}
        .set('Authorization', `Bearer ${authToken}`)
        {%- endif %}
        .send(maliciousPayload)

      // Should either reject or sanitize
      if (response.status === 201) {
        expect(response.body.data.name).not.toContain('')
      } else {
        expect(response.status).toBe(400)
      }
    })
  })
})