import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { 
  GenerateRequest, 
  GenerateResponse, 
  ChatRequest, 
  ChatResponse,
  ModelsResponse,
  PullRequest,
  PullResponse 
} from '../../src/types/ollama'
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
} from '../../src/utils/ollama-helpers'

describe('Ollama API Integration', () => {
  describe('Type Definitions', () => {
    test('should have proper TypeScript types', () => {
      const generateRequest: GenerateRequest = {
        model: 'llama2',
        prompt: 'Hello world',
        options: {
          temperature: 0.7,
          top_p: 0.9
        }
      }
      
      expect(generateRequest.model).toBe('llama2')
      expect(generateRequest.prompt).toBe('Hello world')
      expect(generateRequest.options?.temperature).toBe(0.7)
    })
    
    test('should validate chat request structure', () => {
      const chatRequest: ChatRequest = {
        model: 'llama2',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' }
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
        temperature: 0.5
      })
      
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
    
    test('validateMessages should validate message array', () => {
      const validMessages = [
        createSystemMessage('You are helpful'),
        createUserMessage('Hello'),
        { role: 'assistant' as const, content: 'Hi!' }
      ]
      
      const invalidMessages = [
        { role: 'invalid' as any, content: 'test' },
        { role: 'user', content: '' }
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
    
    test('formatModelDate should format dates correctly', () => {
      const testDate = '2024-01-01T12:00:00Z'
      const formatted = formatModelDate(testDate)
      
      expect(formatted).toContain('2024')
      expect(formatModelDate(undefined)).toBe('Unknown')
      expect(formatModelDate('invalid')).toBe('Invalid Date')
    })
    
    test('calculateProgress should calculate percentage correctly', () => {
      expect(calculateProgress(50, 100)).toBe(50)
      expect(calculateProgress(100, 100)).toBe(100)
      expect(calculateProgress(150, 100)).toBe(100) // max 100%
      expect(calculateProgress(0, 100)).toBe(0)
      expect(calculateProgress(50, 0)).toBe(0) // avoid division by zero
    })
    
    test('validateModelName should validate model names', () => {
      expect(validateModelName('llama2')).toBe(true)
      expect(validateModelName('llama2:7b')).toBe(true)
      expect(validateModelName('code-llama')).toBe(true)
      expect(validateModelName('model_v1.0')).toBe(true)
      
      expect(validateModelName('')).toBe(false)
      expect(validateModelName('invalid name')).toBe(false) // spaces not allowed
      expect(validateModelName(':invalid')).toBe(false) // can't start with colon
    })
    
    test('parseModelName should extract name and tag', () => {
      expect(parseModelName('llama2')).toEqual({ name: 'llama2' })
      expect(parseModelName('llama2:7b')).toEqual({ name: 'llama2', tag: '7b' })
      expect(parseModelName('model:latest')).toEqual({ name: 'model', tag: 'latest' })
    })
  })
  
  describe('API Response Validation', () => {
    test('should validate generate response structure', () => {
      const response: GenerateResponse = {
        model: 'llama2',
        response: 'Hello! How can I help you?',
        done: true,
        context: [1, 2, 3, 4, 5]
      }
      
      expect(response.model).toBe('llama2')
      expect(response.response).toBeTruthy()
      expect(response.done).toBe(true)
      expect(response.context).toHaveLength(5)
    })
    
    test('should validate chat response structure', () => {
      const response: ChatResponse = {
        model: 'llama2',
        message: {
          role: 'assistant',
          content: 'Hello! How can I help you?'
        },
        done: true
      }
      
      expect(response.model).toBe('llama2')
      expect(response.message?.role).toBe('assistant')
      expect(response.message?.content).toBeTruthy()
    })
    
    test('should validate models response structure', () => {
      const response: ModelsResponse = {
        models: [
          {
            name: 'llama2',
            modified_at: '2024-01-01T12:00:00Z',
            size: 1073741824,
            digest: 'sha256:abc123'
          }
        ]
      }
      
      expect(response.models).toHaveLength(1)
      expect(response.models![0].name).toBe('llama2')
      expect(response.models![0].size).toBe(1073741824)
    })
    
    test('should validate pull response structure', () => {
      const response: PullResponse = {
        status: 'downloading',
        digest: 'sha256:abc123',
        total: 1073741824,
        completed: 536870912
      }
      
      expect(response.status).toBe('downloading')
      expect(response.total).toBeGreaterThan(0)
      expect(response.completed).toBeLessThanOrEqual(response.total!)
    })
  })
  
  describe('Error Handling', () => {
    test('should handle API errors gracefully', () => {
      const errorResponse = {
        error: 'Model not found',
        message: 'The requested model does not exist'
      }
      
      expect(errorResponse.error).toBeTruthy()
      expect(errorResponse.message).toBeTruthy()
    })
  })
  
  describe('Streaming Support', () => {
    test('should support streaming responses', () => {
      const streamingResponse: GenerateResponse = {
        model: 'llama2',
        response: 'Hello',
        done: false
      }
      
      const finalResponse: GenerateResponse = {
        model: 'llama2',
        response: '',
        done: true,
        context: [1, 2, 3]
      }
      
      expect(streamingResponse.done).toBe(false)
      expect(finalResponse.done).toBe(true)
      expect(finalResponse.context).toBeDefined()
    })
  })
  
  describe('Configuration Validation', () => {
    test('should validate generation options', () => {
      const options = {
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40,
        num_predict: 100,
        repeat_penalty: 1.1
      }
      
      expect(options.temperature).toBeGreaterThanOrEqual(0)
      expect(options.temperature).toBeLessThanOrEqual(2)
      expect(options.top_p).toBeGreaterThanOrEqual(0)
      expect(options.top_p).toBeLessThanOrEqual(1)
      expect(options.top_k).toBeGreaterThan(0)
      expect(options.num_predict).toBeGreaterThan(0)
    })
  })
})