{%- if helperType == 'authentication' %}
import { sign, verify } from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { Page } from '@playwright/test'

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
const SALT_ROUNDS = 10

export interface TestUser {
  id: string
  email: string
  password?: string
  role: string
  name?: string
}

export async function createTestUser(userData: Partial<TestUser>): Promise<TestUser> {
  const hashedPassword = await bcrypt.hash(userData.password || 'defaultPassword123!', SALT_ROUNDS)
  
  const user: TestUser = {
    id: `test-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    email: userData.email || `test-${Date.now()}@example.com`,
    password: hashedPassword,
    role: userData.role || 'user',
    name: userData.name || 'Test User'
  }

  // Store in test database
  // await db('users').insert(user)
  
  return user
}

export function generateTestToken(user: TestUser): string {
  return sign(
    { 
      userId: user.id, 
      email: user.email, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  )
}

export async function verifyTestToken(token: string): Promise<any> {
  return verify(token, JWT_SECRET)
}

export async function loginUser(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.fill('[data-testid="email-input"]', email)
  await page.fill('[data-testid="password-input"]', password)
  await page.click('[data-testid="login-button"]')
  
  // Wait for login to complete
  await page.waitForURL('/dashboard', { timeout: 10000 })
}

export async function logoutUser(page: Page): Promise<void> {
  await page.click('[data-testid="user-menu"]')
  await page.click('[data-testid="logout-button"]')
  await page.waitForURL('/login')
}

export async function impersonateUser(page: Page, user: TestUser): Promise<void> {
  const token = generateTestToken(user)
  
  // Set token in localStorage
  await page.addInitScript((token) => {
    localStorage.setItem('authToken', token)
  }, token)
  
  await page.goto('/dashboard')
}

{%- elif helperType == 'database' %}
import { Knex } from 'knex'

// Mock database connection for tests
const mockDb = {
  migrate: {
    latest: async () => console.log('Mock migration completed'),
    rollback: async () => console.log('Mock rollback completed')
  },
  seed: {
    run: async () => console.log('Mock seed completed')
  },
  destroy: async () => console.log('Mock db destroyed'),
  raw: async (query: string) => ({ rows: [] }),
  select: () => mockDb,
  insert: () => mockDb,
  update: () => mockDb,
  delete: () => mockDb,
  where: () => mockDb,
  first: async () => ({}),
  then: async (callback: Function) => callback([])
}

export async function setupTestDatabase(): Promise<any> {
  // Initialize test database
  await mockDb.migrate.latest()
  return mockDb
}

export async function seedTestData(): Promise<void> {
  // Clear existing data
  await clearTestData()
  
  // Insert test data
  const testUsers = [
    {
      id: 'user-1',
      email: 'test1@example.com',
      name: 'Test User 1',
      role: 'user',
      createdAt: new Date()
    },
    {
      id: 'user-2',
      email: 'test2@example.com',
      name: 'Test User 2',
      role: 'admin',
      createdAt: new Date()
    }
  ]

  // await db('users').insert(testUsers)
  console.log('Test data seeded:', testUsers)
}

export async function clearTestData(): Promise<void> {
  // Clear test data in reverse order of dependencies
  const tables = ['user_sessions', 'user_profiles', 'users']
  
  for (const table of tables) {
    // await db(table).del()
    console.log(`Cleared table: ${table}`)
  }
}

export async function createTestRecord(table: string, data: any): Promise<any> {
  const record = {
    id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...data,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  
  // await db(table).insert(record)
  return record
}

export async function findTestRecord(table: string, criteria: any): Promise<any> {
  // return await db(table).where(criteria).first()
  return { id: 'mock-record', ...criteria }
}

export async function updateTestRecord(table: string, id: string, updates: any): Promise<any> {
  const updated = {
    ...updates,
    updatedAt: new Date()
  }
  
  // await db(table).where({ id }).update(updated)
  return updated
}

export async function deleteTestRecord(table: string, id: string): Promise<void> {
  // await db(table).where({ id }).del()
  console.log(`Deleted record ${id} from ${table}`)
}

{%- elif helperType == 'test-data' %}
export interface TestDataOptions {
  count?: number
  overrides?: any
  relationships?: boolean
}

export function generateUser(overrides: any = {}): any {
  return {
    id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    email: `test-${Date.now()}-${Math.random().toString(36).substr(2, 5)}@example.com`,
    name: `Test User ${Math.random().toString(36).substr(2, 5)}`,
    role: 'user',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

export function generateUsers(count: number = 5, overrides: any = {}): any[] {
  return Array.from({ length: count }, () => generateUser(overrides))
}

export function generatePost(overrides: any = {}): any {
  return {
    id: `post-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: `Test Post ${Math.random().toString(36).substr(2, 8)}`,
    content: `This is test content for post ${Date.now()}`,
    status: 'published',
    authorId: `user-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

export function generatePosts(count: number = 10, overrides: any = {}): any[] {
  return Array.from({ length: count }, () => generatePost(overrides))
}

export function generateInterview(overrides: any = {}): any {
  return {
    id: `interview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: `Test Interview ${Math.random().toString(36).substr(2, 8)}`,
    description: 'This is a test interview description',
    status: 'active',
    duration: 30,
    questions: generateQuestions(5),
    candidateId: `user-${Math.random().toString(36).substr(2, 9)}`,
    interviewerId: `user-${Math.random().toString(36).substr(2, 9)}`,
    scheduledAt: new Date(Date.now() + 86400000), // Tomorrow
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

export function generateQuestions(count: number = 5): any[] {
  const questionTypes = ['technical', 'behavioral', 'problem-solving', 'cultural-fit']
  
  return Array.from({ length: count }, (_, index) => ({
    id: `question-${Date.now()}-${index}`,
    text: `Test question ${index + 1}: What is your experience with...?`,
    type: questionTypes[Math.floor(Math.random() * questionTypes.length)],
    difficulty: ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)],
    expectedDuration: Math.floor(Math.random() * 10) + 5, // 5-15 minutes
    order: index
  }))
}

export function generateApiResponse(data: any, success: boolean = true): any {
  return {
    success,
    data: success ? data : null,
    error: success ? null : 'Test error message',
    timestamp: new Date().toISOString(),
    requestId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

export function generatePaginatedResponse(items: any[], page: number = 1, limit: number = 10): any {
  const startIndex = (page - 1) * limit
  const endIndex = startIndex + limit
  const paginatedItems = items.slice(startIndex, endIndex)
  
  return {
    data: paginatedItems,
    pagination: {
      page,
      limit,
      total: items.length,
      totalPages: Math.ceil(items.length / limit),
      hasNext: endIndex < items.length,
      hasPrevious: page > 1
    }
  }
}

export function generateFormData(fields: string[]): any {
  const data: any = {}
  
  fields.forEach(field => {
    switch (field) {
      case 'email':
        data[field] = `test-${Date.now()}@example.com`
        break
      case 'name':
      case 'firstName':
      case 'lastName':
        data[field] = `Test ${field} ${Math.random().toString(36).substr(2, 5)}`
        break
      case 'password':
        data[field] = 'TestPassword123!'
        break
      case 'phone':
        data[field] = `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`
        break
      case 'age':
        data[field] = Math.floor(Math.random() * 50) + 18
        break
      case 'isActive':
      case 'isVerified':
        data[field] = Math.random() > 0.5
        break
      default:
        data[field] = `test-${field}-${Date.now()}`
    }
  })
  
  return data
}

{%- elif helperType == 'mocking' %}
import { vi } from 'vitest'

export const mockService = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  patch: vi.fn()
}

export const mockDatabase = {
  find: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn()
}

export const mockAuth = {
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  verify: vi.fn(),
  refreshToken: vi.fn()
}

export const mockNotifications = {
  send: vi.fn(),
  sendEmail: vi.fn(),
  sendSMS: vi.fn(),
  push: vi.fn()
}

export const mockFileUpload = {
  upload: vi.fn(),
  delete: vi.fn(),
  getUrl: vi.fn(),
  resize: vi.fn()
}

export function createMockRepository() {
  return {
    save: vi.fn(),
    find: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    exists: vi.fn()
  }
}

export function createMockApiClient() {
  return {
    get: vi.fn().mockResolvedValue({ data: {}, status: 200 }),
    post: vi.fn().mockResolvedValue({ data: {}, status: 201 }),
    put: vi.fn().mockResolvedValue({ data: {}, status: 200 }),
    delete: vi.fn().mockResolvedValue({ status: 204 }),
    patch: vi.fn().mockResolvedValue({ data: {}, status: 200 })
  }
}

export function mockConsole() {
  const originalConsole = { ...console }
  
  beforeEach(() => {
    console.log = vi.fn()
    console.error = vi.fn()
    console.warn = vi.fn()
    console.info = vi.fn()
  })
  
  afterEach(() => {
    Object.assign(console, originalConsole)
  })
}

export function mockLocalStorage() {
  const mockStorage: any = {}
  
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: vi.fn((key) => mockStorage[key] || null),
      setItem: vi.fn((key, value) => { mockStorage[key] = value }),
      removeItem: vi.fn((key) => { delete mockStorage[key] }),
      clear: vi.fn(() => { Object.keys(mockStorage).forEach(key => delete mockStorage[key]) })
    },
    writable: true
  })
}

export function mockSessionStorage() {
  const mockStorage: any = {}
  
  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: vi.fn((key) => mockStorage[key] || null),
      setItem: vi.fn((key, value) => { mockStorage[key] = value }),
      removeItem: vi.fn((key) => { delete mockStorage[key] }),
      clear: vi.fn(() => { Object.keys(mockStorage).forEach(key => delete mockStorage[key]) })
    },
    writable: true
  })
}

export function mockEnvironment(env: Record<string, string>) {
  const originalEnv = process.env
  
  beforeEach(() => {
    process.env = { ...originalEnv, ...env }
  })
  
  afterEach(() => {
    process.env = originalEnv
  })
}

{%- elif helperType == 'api-client' %}
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'

export class TestApiClient {
  private client: AxiosInstance
  private baseURL: string
  private authToken?: string

  constructor(baseURL: string = 'http://localhost:3000') {
    this.baseURL = baseURL
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    this.setupInterceptors()
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.response?.data || error.message)
        return Promise.reject(error)
      }
    )
  }

  public setAuthToken(token: string): void {
    this.authToken = token
  }

  public clearAuthToken(): void {
    this.authToken = undefined
  }

  public async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get(url, config)
  }

  public async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.post(url, data, config)
  }

  public async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.put(url, data, config)
  }

  public async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.patch(url, data, config)
  }

  public async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete(url, config)
  }

  public async uploadFile(url: string, file: File | Buffer, fieldName: string = 'file'): Promise<AxiosResponse> {
    const formData = new FormData()
    formData.append(fieldName, file)

    return this.client.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const response = await this.get('/health')
      return response.status === 200
    } catch {
      return false
    }
  }

  public async waitForServer(maxAttempts: number = 30, intervalMs: number = 1000): Promise<boolean> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (await this.healthCheck()) {
        return true
      }
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, intervalMs))
      }
    }
    
    return false
  }
}

export const testApiClient = new TestApiClient()

// Helper functions for common API operations
export async function authenticateTestUser(email: string, password: string): Promise<string> {
  const response = await testApiClient.post('/auth/login', { email, password })
  const token = response.data.token
  testApiClient.setAuthToken(token)
  return token
}

export async function createTestResource(endpoint: string, data: any): Promise<any> {
  const response = await testApiClient.post(endpoint, data)
  return response.data
}

export async function getTestResource(endpoint: string, id: string): Promise<any> {
  const response = await testApiClient.get(`${endpoint}/${id}`)
  return response.data
}

export async function updateTestResource(endpoint: string, id: string, updates: any): Promise<any> {
  const response = await testApiClient.put(`${endpoint}/${id}`, updates)
  return response.data
}

export async function deleteTestResource(endpoint: string, id: string): Promise<void> {
  await testApiClient.delete(`${endpoint}/${id}`)
}

export async function searchTestResources(endpoint: string, query: any): Promise<any> {
  const response = await testApiClient.get(endpoint, { params: query })
  return response.data
}
{%- endif %}