// Utility functions for Ollama API integration
import type { GenerateRequest, ChatRequest, Message, GenerationOptions } from '../types/ollama'

/**
 * Create a standardized generate request
 */
export function createGenerateRequest(
  model: string,
  prompt: string,
  options?: Partial<GenerationOptions>
): GenerateRequest {
  return {
    model,
    prompt,
    options: {
      temperature: 0.7,
      top_p: 0.9,
      top_k: 40,
      num_predict: 100,
      ...options
    }
  }
}

/**
 * Create a standardized chat request
 */
export function createChatRequest(
  model: string,
  messages: Message[],
  options?: Partial<GenerationOptions>
): ChatRequest {
  return {
    model,
    messages,
    options: {
      temperature: 0.7,
      top_p: 0.9,
      num_predict: 200,
      ...options
    }
  }
}

/**
 * Helper to create a system message
 */
export function createSystemMessage(content: string): Message {
  return {
    role: 'system',
    content
  }
}

/**
 * Helper to create a user message
 */
export function createUserMessage(content: string): Message {
  return {
    role: 'user',
    content
  }
}

/**
 * Helper to create an assistant message
 */
export function createAssistantMessage(content: string): Message {
  return {
    role: 'assistant',
    content
  }
}

/**
 * Validate a message array for chat requests
 */
export function validateMessages(messages: Message[]): boolean {
  if (!Array.isArray(messages) || messages.length === 0) {
    return false
  }
  
  return messages.every(message => {
    return (
      message &&
      typeof message.role === 'string' &&
      ['system', 'user', 'assistant'].includes(message.role) &&
      typeof message.content === 'string' &&
      message.content.trim().length > 0
    )
  })
}

/**
 * Format model size in human-readable format
 */
export function formatModelSize(bytes: number | undefined): string {
  if (!bytes || bytes === 0) return 'Unknown'
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

/**
 * Format date strings consistently
 */
export function formatModelDate(dateString: string | undefined): string {
  if (!dateString) return 'Unknown'
  
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return 'Invalid Date'
  }
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(completed: number = 0, total: number = 0): number {
  if (total === 0) return 0
  return Math.min(100, Math.max(0, (completed / total) * 100))
}

/**
 * Format progress display string
 */
export function formatProgress(completed: number = 0, total: number = 0): string {
  if (total === 0) return completed > 0 ? `${formatModelSize(completed)}` : '0%'
  
  const percentage = calculateProgress(completed, total)
  return `${percentage.toFixed(1)}% (${formatModelSize(completed)} / ${formatModelSize(total)})`
}

/**
 * Truncate digest strings for display
 */
export function truncateDigest(digest: string | undefined, length: number = 12): string {
  if (!digest) return 'Unknown'
  return digest.length > length ? `${digest.substring(0, length)}...` : digest
}

/**
 * Validate model name format
 */
export function validateModelName(name: string): boolean {
  if (!name || typeof name !== 'string') return false
  
  // Basic validation - model names should be alphanumeric with hyphens, colons for tags
  const modelNameRegex = /^[a-zA-Z0-9][a-zA-Z0-9._-]*(?::[a-zA-Z0-9._-]+)?$/
  return modelNameRegex.test(name)
}

/**
 * Extract model name and tag
 */
export function parseModelName(fullName: string): { name: string; tag?: string } {
  const parts = fullName.split(':')
  return {
    name: parts[0],
    tag: parts.length > 1 ? parts[1] : undefined
  }
}

/**
 * Common generation options presets
 */
export const generationPresets = {
  creative: {
    temperature: 1.2,
    top_p: 0.95,
    top_k: 50,
    repeat_penalty: 1.1
  },
  balanced: {
    temperature: 0.7,
    top_p: 0.9,
    top_k: 40,
    repeat_penalty: 1.05
  },
  precise: {
    temperature: 0.3,
    top_p: 0.7,
    top_k: 20,
    repeat_penalty: 1.0
  },
  coding: {
    temperature: 0.1,
    top_p: 0.5,
    top_k: 10,
    repeat_penalty: 1.0
  }
} as const

/**
 * Apply generation preset
 */
export function applyGenerationPreset(
  preset: keyof typeof generationPresets,
  customOptions?: Partial<GenerationOptions>
): GenerationOptions {
  return {
    ...generationPresets[preset],
    ...customOptions
  }
}