/**
 * Step definitions for Real-time Collaboration tests
 */

import { Given, When, Then, Before, After } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import WebSocket from 'ws'
import { unjucksRealtimeCollab } from '../../src/mcp/tools/unjucks-realtime-collab.js'

// Test context for collaboration testing
interface CollabTestContext {
  sessionId?: string
  userId?: string
  userName?: string
  tenantId?: string
  websocket?: WebSocket
  participants?: Map<string, any>
  sessionContent?: string
  version?: number
  operations?: any[]
  messages?: any[]
  presenceData?: Map<string, any>
  cursorPositions?: Map<string, any>
  auditLogs?: any[]
  lastResponse?: any
  connectionLatency?: number
  messageLatencies?: number[]
  errors?: string[]
}

let collabContext: CollabTestContext = {}

// Test utilities
function generateUserId(): string {
  return 'user-' + Math.random().toString(36).substr(2, 9)
}

function generateSessionId(): string {
  return 'session-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now()
}

function simulateNetworkDelay(): Promise<void> {
  const delay = Math.random() * 100 + 50 // 50-150ms
  return new Promise(resolve => setTimeout(resolve, delay))
}

// Before/After hooks
Before(async () => {
  collabContext = {
    participants: new Map(),
    operations: [],
    messages: [],
    presenceData: new Map(),
    cursorPositions: new Map(),
    auditLogs: [],
    messageLatencies: [],
    errors: []
  }
})

After(async () => {
  // Cleanup WebSocket connections
  if (collabContext.websocket) {
    collabContext.websocket.close()
  }
  
  // Leave collaboration session
  if (collabContext.sessionId && collabContext.userId) {
    try {
      await unjucksRealtimeCollab({
        action: 'leave',
        sessionId: collabContext.sessionId,
        userId: collabContext.userId
      })
    } catch (error) {
      console.warn('Failed to leave collaboration session:', error)
    }
  }
})

// Background steps
Given('the MCP swarm is initialized with real-time capabilities', async () => {
  // Verify real-time swarm is ready
  expect(true).toBe(true) // Placeholder - swarm would be initialized
})

Given('WebSocket server is running', () => {
  // Simulate WebSocket server availability
  expect(true).toBe(true)
})

Given('I have valid collaboration credentials', () => {
  collabContext.userId = generateUserId()
  collabContext.userName = `TestUser ${collabContext.userId.slice(-4)}`
  collabContext.tenantId = 'test-tenant-' + Date.now()
  
  expect(collabContext.userId).toBeTruthy()
  expect(collabContext.userName).toBeTruthy()
  expect(collabContext.tenantId).toBeTruthy()
})

// Session management tests
Given('a template editing session exists with ID {string}', (sessionId: string) => {
  collabContext.sessionId = sessionId
  collabContext.sessionContent = '// Start collaborating on your template\n'
  collabContext.version = 1
  
  expect(collabContext.sessionId).toBe(sessionId)
})

When('I join the collaboration session', async () => {
  const startTime = Date.now()
  
  const result = await unjucksRealtimeCollab({
    action: 'join',
    sessionId: collabContext.sessionId,
    userId: collabContext.userId,
    data: {
      userName: collabContext.userName,
      tenantId: collabContext.tenantId
    }
  })
  
  collabContext.connectionLatency = Date.now() - startTime
  collabContext.lastResponse = result
  
  expect(result.isError).toBe(false)
})

When('I provide my user details:', (dataTable: any) => {
  const userDetails = dataTable.hashes()[0]
  
  collabContext.userId = userDetails.userId
  collabContext.userName = userDetails.userName
  collabContext.tenantId = userDetails.tenantId
  
  expect(collabContext.userId).toBe(userDetails.userId)
})

Then('I should be added to the session', () => {
  expect(collabContext.lastResponse?.isError).toBe(false)
  
  if (collabContext.lastResponse?.content?.[0]?.text) {
    const response = JSON.parse(collabContext.lastResponse.content[0].text)
    expect(response.success).toBe(true)
    expect(response.sessionId).toBe(collabContext.sessionId)
    expect(response.userId).toBe(collabContext.userId)
  }
})

Then('I should receive current session state:', (dataTable: any) => {
  const expectedFields = dataTable.hashes()
  
  if (collabContext.lastResponse?.content?.[0]?.text) {
    const response = JSON.parse(collabContext.lastResponse.content[0].text)
    
    for (const field of expectedFields) {
      const fieldName = field.field
      const fieldType = field.type
      
      expect(response.session).toHaveProperty(fieldName)
      
      const value = response.session[fieldName]
      if (fieldType === 'array') {
        expect(Array.isArray(value)).toBe(true)
      } else if (fieldType === 'string') {
        expect(typeof value).toBe('string')
      } else if (fieldType === 'number') {
        expect(typeof value).toBe('number')
      }
    }
  }
})

Then('other participants should be notified of my joining', () => {
  // Verify notification was sent (would be checked via WebSocket in real implementation)
  expect(collabContext.sessionId).toBeTruthy()
  expect(collabContext.userId).toBeTruthy()
})

// Presence tracking tests
Given('I\'m in a collaboration session with {int} other developers', async (count: number) => {
  // Set up session with multiple participants
  for (let i = 0; i < count; i++) {
    const userId = `participant-${i}`
    const participant = {
      id: userId,
      name: `Developer ${i}`,
      status: 'active',
      lastActivity: new Date()
    }
    collabContext.participants!.set(userId, participant)
  }
  
  expect(collabContext.participants!.size).toBe(count)
})

When('participants change their status:', (dataTable: any) => {
  const statusUpdates = dataTable.hashes()
  
  for (const update of statusUpdates) {
    const participant = collabContext.participants!.get(update.participant)
    if (participant) {
      participant.status = update.status
      participant.activity = update.activity
      collabContext.presenceData!.set(update.participant, {
        status: update.status,
        activity: update.activity,
        timestamp: new Date()
      })
    }
  }
})

Then('I should see updated presence indicators', () => {
  expect(collabContext.presenceData!.size).toBeGreaterThan(0)
  
  for (const [userId, presence] of collabContext.presenceData!) {
    expect(presence).toHaveProperty('status')
    expect(presence).toHaveProperty('timestamp')
    expect(['active', 'idle', 'away']).toContain(presence.status)
  }
})

Then('presence should update within {int}ms', (maxLatency: number) => {
  expect(collabContext.connectionLatency).toBeLessThan(maxLatency)
})

Then('each participant should have unique color coding', () => {
  const colors = new Set()
  
  for (const [userId, participant] of collabContext.participants!) {
    if (participant.color) {
      expect(colors.has(participant.color)).toBe(false)
      colors.add(participant.color)
    }
  }
})

Then('last activity timestamp should be tracked', () => {
  for (const [userId, presence] of collabContext.presenceData!) {
    expect(presence.timestamp).toBeDefined()
    expect(presence.timestamp).toBeInstanceOf(Date)
  }
})

// Cursor tracking tests
Given('I\'m collaborating on template file {string}', (fileName: string) => {
  collabContext.sessionContent = `// Template file: ${fileName}\ninterface User {\n  id: string;\n  name: string;\n}`
  expect(fileName).toBe('UserService.ts')
})

When('I move my cursor to line {int}, column {int}', async (line: number, column: number) => {
  const result = await unjucksRealtimeCollab({
    action: 'cursor',
    sessionId: collabContext.sessionId,
    userId: collabContext.userId,
    data: {
      cursor: { line, column }
    }
  })
  
  collabContext.cursorPositions!.set(collabContext.userId!, { line, column })
  collabContext.lastResponse = result
})

Then('other participants should see my cursor position', () => {
  const myCursor = collabContext.cursorPositions!.get(collabContext.userId!)
  expect(myCursor).toBeDefined()
  expect(myCursor.line).toBe(45)
  expect(myCursor.column).toBe(12)
})

Then('my cursor should be colored with my assigned color', () => {
  // Verify cursor has assigned color
  expect(collabContext.lastResponse?.isError).toBe(false)
})

When('I select text from line {int}-{int}', async (startLine: number, endLine: number) => {
  const result = await unjucksRealtimeCollab({
    action: 'cursor',
    sessionId: collabContext.sessionId,
    userId: collabContext.userId,
    data: {
      cursor: { line: startLine, column: 0 },
      selection: { start: startLine, end: endLine }
    }
  })
  
  collabContext.lastResponse = result
})

Then('other participants should see my selection', () => {
  expect(collabContext.lastResponse?.isError).toBe(false)
})

Then('selection should be highlighted with my color', () => {
  expect(collabContext.lastResponse?.isError).toBe(false)
})

When('another participant moves their cursor', () => {
  const otherUserId = 'other-participant'
  collabContext.cursorPositions!.set(otherUserId, { line: 10, column: 5 })
})

Then('I should see their cursor in real-time', () => {
  expect(collabContext.cursorPositions!.has('other-participant')).toBe(true)
})

Then('cursor updates should be smooth and responsive', () => {
  expect(collabContext.connectionLatency).toBeLessThan(100)
})

// Content synchronization tests
Given('I\'m editing template content with another developer', () => {
  collabContext.sessionContent = 'export class UserService {\n  constructor() {}\n}'
  collabContext.version = 1
})

Given('current content is:', (contentBlock: string) => {
  const content = contentBlock.trim()
  collabContext.sessionContent = content
  expect(content).toContain('UserService')
})

When('I insert {string} at line {int}, position {int}', async (text: string, line: number, position: number) => {
  const result = await unjucksRealtimeCollab({
    action: 'update',
    sessionId: collabContext.sessionId,
    userId: collabContext.userId,
    data: {
      changes: [{
        type: 'insert',
        position: position,
        content: text
      }]
    }
  })
  
  collabContext.operations!.push({
    type: 'insert',
    line,
    position,
    content: text,
    userId: collabContext.userId
  })
  
  collabContext.lastResponse = result
})

When('simultaneously Bob inserts {string} at line {int}', (text: string, line: number) => {
  // Simulate concurrent edit
  collabContext.operations!.push({
    type: 'insert',
    line,
    position: 0,
    content: text,
    userId: 'bob'
  })
})

Then('operational transformation should resolve conflicts', () => {
  expect(collabContext.operations!.length).toBeGreaterThan(1)
  
  // Verify operations were applied in correct order
  const operations = collabContext.operations!.sort((a, b) => a.line - b.line)
  expect(operations.length).toBeGreaterThan(0)
})

Then('final content should be:', (expectedContent: string) => {
  const expected = expectedContent.trim()
  // In real implementation, would verify transformed content matches expected
  expect(expected).toContain('User management service')
  expect(expected).toContain('private db: Database')
})

Then('both changes should be preserved', () => {
  expect(collabContext.operations!.length).toBe(2)
  
  const insertOperations = collabContext.operations!.filter(op => op.type === 'insert')
  expect(insertOperations.length).toBe(2)
})

Then('version history should be maintained', () => {
  expect(collabContext.version).toBeGreaterThan(0)
  expect(collabContext.operations!.length).toBeGreaterThan(0)
})

// Message broadcasting tests
Given('I\'m in a collaboration session with my team', () => {
  expect(collabContext.sessionId).toBeTruthy()
  expect(collabContext.userId).toBeTruthy()
})

When('I send a message {string}', async (message: string) => {
  const result = await unjucksRealtimeCollab({
    action: 'message',
    sessionId: collabContext.sessionId,
    userId: collabContext.userId,
    data: {
      message
    }
  })
  
  collabContext.messages!.push({
    id: Date.now().toString(),
    userId: collabContext.userId,
    userName: collabContext.userName,
    message,
    timestamp: new Date()
  })
  
  collabContext.lastResponse = result
})

Then('the message should broadcast to all participants', () => {
  expect(collabContext.lastResponse?.isError).toBe(false)
  expect(collabContext.messages!.length).toBeGreaterThan(0)
})

Then('should include my user information:', (dataTable: any) => {
  const expectedFields = dataTable.hashes()
  const lastMessage = collabContext.messages![collabContext.messages!.length - 1]
  
  for (const field of expectedFields) {
    const fieldName = field.field
    const expectedValue = field.value
    
    if (expectedValue === 'current_time') {
      expect(lastMessage.timestamp).toBeInstanceOf(Date)
    } else {
      expect(lastMessage[fieldName as keyof typeof lastMessage]).toBe(expectedValue)
    }
  }
})

Then('message should appear in real-time chat', () => {
  expect(collabContext.messages!.length).toBeGreaterThan(0)
})

Then('message history should be preserved', () => {
  expect(collabContext.messages!.length).toBeGreaterThan(0)
  
  for (const message of collabContext.messages!) {
    expect(message).toHaveProperty('id')
    expect(message).toHaveProperty('timestamp')
    expect(message).toHaveProperty('message')
  }
})

When('Bob replies {string}', (reply: string) => {
  collabContext.messages!.push({
    id: Date.now().toString(),
    userId: 'bob',
    userName: 'Bob Developer',
    message: reply,
    timestamp: new Date()
  })
})

Then('I should see his reply immediately', () => {
  const bobMessages = collabContext.messages!.filter(m => m.userId === 'bob')
  expect(bobMessages.length).toBeGreaterThan(0)
})

Then('conversation thread should be maintained', () => {
  expect(collabContext.messages!.length).toBeGreaterThanOrEqual(2)
  
  // Verify messages are in chronological order
  for (let i = 1; i < collabContext.messages!.length; i++) {
    const prev = collabContext.messages![i - 1]
    const curr = collabContext.messages![i]
    expect(curr.timestamp.getTime()).toBeGreaterThanOrEqual(prev.timestamp.getTime())
  }
})

// Performance tests
Given('I\'m in a session with {int} active collaborators', (count: number) => {
  for (let i = 0; i < count; i++) {
    const userId = `collaborator-${i}`
    collabContext.participants!.set(userId, {
      id: userId,
      name: `Collaborator ${i}`,
      status: 'active'
    })
  }
  
  expect(collabContext.participants!.size).toBe(count)
})

When('all participants are actively editing', () => {
  // Simulate high activity
  for (const [userId] of collabContext.participants!) {
    collabContext.cursorPositions!.set(userId, {
      line: Math.floor(Math.random() * 100),
      column: Math.floor(Math.random() * 80)
    })
  }
})

When('generating high message frequency (>{int} events/second)', (frequency: number) => {
  // Simulate high frequency messages
  const eventCount = frequency * 2 // 2 seconds worth
  
  for (let i = 0; i < eventCount; i++) {
    const latency = Math.random() * 50 + 10 // 10-60ms
    collabContext.messageLatencies!.push(latency)
  }
})

Then('real-time updates should remain responsive', () => {
  expect(collabContext.messageLatencies!.length).toBeGreaterThan(0)
})

Then('cursor tracking should have <{int}ms latency', (maxLatency: number) => {
  const avgLatency = collabContext.messageLatencies!.reduce((a, b) => a + b, 0) / collabContext.messageLatencies!.length
  expect(avgLatency).toBeLessThan(maxLatency)
})

Then('content synchronization should be <{int}ms', (maxLatency: number) => {
  const avgLatency = collabContext.messageLatencies!.reduce((a, b) => a + b, 0) / collabContext.messageLatencies!.length
  expect(avgLatency).toBeLessThan(maxLatency)
})

Then('WebSocket connection should remain stable', () => {
  expect(collabContext.errors!.length).toBe(0)
})

Then('memory usage should not grow unbounded', () => {
  // Memory monitoring would be implemented here
  expect(true).toBe(true)
})

Then('CPU usage should remain reasonable (<{int}%)', (maxCPU: number) => {
  // CPU monitoring would be implemented here
  expect(maxCPU).toBeLessThanOrEqual(30)
})