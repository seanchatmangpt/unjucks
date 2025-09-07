import { describe, test, expect, vi, beforeEach } from 'vitest'
// import type { 
  GenerateRequest, 
  GenerateResponse, 
  ChatRequest, 
  ChatResponse,
  ModelsResponse,
  PullRequest,
  PullResponse 
} from '../../src/types/ollama.js'
import { 
  createGenerateRequest,
  createChatRequest,
  createSystemMessage,
  createUserMessage,
  validateMessages,
  formatModelSize,
  formatModelDate,
  calculateProgress,
  validateModelName,
  parseModelName
} from '../../src/utils/ollama-helpers.js'

describe('Ollama API Integration', () => { describe('Type Definitions', () => {
    test('should have proper TypeScript types', () => {
      const generateRequest = {
        model }
      }
      
      expect(generateRequest.model).toBe('llama2')
      expect(generateRequest.prompt).toBe('Hello world')
      expect(generateRequest.options?.temperature).toBe(0.7)
    })
    
    test('should validate chat request structure', () => { const chatRequest = {
        model },
          { role }
        ]
      }
      
      expect(chatRequest.messages).toHaveLength(2)
      expect(chatRequest.messages[0].role).toBe('user')
      expect(chatRequest.messages[1].role).toBe('assistant')
    })
  })
  
  describe('Helper Functions', () => {
    test('createGenerateRequest should create proper request object', () => {
      const request = createGenerateRequest('llama2', 'Test prompt', {
        temperature)
      
      expect(request.model).toBe('llama2')
      expect(request.prompt).toBe('Test prompt')
      expect(request.options?.temperature).toBe(0.5)
      expect(request.options?.top_p).toBe(0.9) // default value
    })
    
    test('createChatRequest should create proper chat request', () => {
      const messages = [createUserMessage('Hello')]
      const request = createChatRequest('llama2', messages)
      
      expect(request.model).toBe('llama2')
      expect(request.messages).toHaveLength(1)
      expect(request.messages[0].role).toBe('user')
    })
    
    test('validateMessages should validate message array', () => { const validMessages = [
        createSystemMessage('You are helpful'),
        createUserMessage('Hello'),
        { role }
      ]
      
      const invalidMessages = [
        { role },
        { role }
      ]
      
      expect(validateMessages(validMessages)).toBe(true)
      expect(validateMessages(invalidMessages)).toBe(false)
      expect(validateMessages([])).toBe(false)
    })
    
    test('formatModelSize should format bytes correctly', () => {
      expect(formatModelSize(1024)).toBe('1.0 KB')
      expect(formatModelSize(1048576)).toBe('1.0 MB')
      expect(formatModelSize(1073741824)).toBe('1.0 GB')
      expect(formatModelSize(undefined)).toBe('Unknown')
    })
    
    test('formatModelDate should format dates correctly', () => { const testDate = '2024-01-01T12 })
    
    test('calculateProgress should calculate percentage correctly', () => {
      expect(calculateProgress(50, 100)).toBe(50)
      expect(calculateProgress(100, 100)).toBe(100)
      expect(calculateProgress(150, 100)).toBe(100) // max 100%
      expect(calculateProgress(0, 100)).toBe(0)
      expect(calculateProgress(50, 0)).toBe(0) // avoid division by zero
    })
    
    test('validateModelName should validate model names', () => { expect(validateModelName('llama2')).toBe(true)
      expect(validateModelName('llama2 })
    
    test('parseModelName should extract name and tag', () => { expect(parseModelName('llama2')).toEqual({ name)
      expect(parseModelName('llama2 })
  })
  
  describe('API Response Validation', () => { test('should validate generate response structure', () => {
      const response = {
        model }
      
      expect(response.model).toBe('llama2')
      expect(response.response).toBeTruthy()
      expect(response.done).toBe(true)
      expect(response.context).toHaveLength(5)
    })
    
    test('should validate chat response structure', () => { const response = {
        model },
        done: true
      }
      
      expect(response.model).toBe('llama2')
      expect(response.message?.role).toBe('assistant')
      expect(response.message?.content).toBeTruthy()
    })
    
    test('should validate models response structure', () => { const response = {
        models }
        ]
      }
      
      expect(response.models).toHaveLength(1)
      expect(response.models![0].name).toBe('llama2')
      expect(response.models![0].size).toBe(1073741824)
    })
    
    test('should validate pull response structure', () => { const response = {
        status }
      
      expect(response.status).toBe('downloading')
      expect(response.total).toBeGreaterThan(0)
      expect(response.completed).toBeLessThanOrEqual(response.total!)
    })
  })
  
  describe('Error Handling', () => { test('should handle API errors gracefully', () => {
      const errorResponse = {
        error }
      
      expect(errorResponse.error).toBeTruthy()
      expect(errorResponse.message).toBeTruthy()
    })
  })
  
  describe('Streaming Support', () => { test('should support streaming responses', () => {
      const streamingResponse = {
        model }
      
      const finalResponse = { model }
      
      expect(streamingResponse.done).toBe(false)
      expect(finalResponse.done).toBe(true)
      expect(finalResponse.context).toBeDefined()
    })
  })
  
  describe('Configuration Validation', () => { test('should validate generation options', () => {
      const options = {
        temperature }
      
      expect(options.temperature).toBeGreaterThanOrEqual(0)
      expect(options.temperature).toBeLessThanOrEqual(2)
      expect(options.top_p).toBeGreaterThanOrEqual(0)
      expect(options.top_p).toBeLessThanOrEqual(1)
      expect(options.top_k).toBeGreaterThan(0)
      expect(options.num_predict).toBeGreaterThan(0)
    })
  })
})