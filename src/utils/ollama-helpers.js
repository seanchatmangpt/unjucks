/**
 * @typedef {Object} GenerationOptions
 * @property {number} [temperature] - Temperature for generation
 * @property {number} [top_p] - Top-p for generation
 * @property {number} [top_k] - Top-k for generation
 * @property {number} [num_predict] - Number of tokens to predict
 * @property {number} [repeat_penalty] - Repeat penalty
 */

/**
 * @typedef {Object} GenerateRequest
 * @property {string} model - Model name
 * @property {string} prompt - Input prompt
 * @property {GenerationOptions} [options] - Generation options
 */

/**
 * @typedef {Object} Message
 * @property {'system' | 'user' | 'assistant'} role - Message role
 * @property {string} content - Message content
 */

/**
 * @typedef {Object} ChatRequest
 * @property {string} model - Model name
 * @property {Message[]} messages - Chat messages
 * @property {GenerationOptions} [options] - Generation options
 */

/**
 * Create a standardized generate request
 * @param {string} model - Model name
 * @param {string} prompt - Input prompt
 * @param {Partial<GenerationOptions>} [options] - Generation options
 * @returns {GenerateRequest} Generate request
 */
export function createGenerateRequest(model, prompt, options) {
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
 * @param {string} model - Model name
 * @param {Message[]} messages - Chat messages
 * @param {Partial<GenerationOptions>} [options] - Generation options
 * @returns {ChatRequest} Chat request
 */
export function createChatRequest(model, messages, options) {
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
 * @param {string} content - Message content
 * @returns {Message} System message
 */
export function createSystemMessage(content) {
  return {
    role: 'system',
    content
  }
}

/**
 * Helper to create a user message
 * @param {string} content - Message content
 * @returns {Message} User message
 */
export function createUserMessage(content) {
  return {
    role: 'user',
    content
  }
}

/**
 * Helper to create an assistant message
 * @param {string} content - Message content
 * @returns {Message} Assistant message
 */
export function createAssistantMessage(content) {
  return {
    role: 'assistant',
    content
  }
}

/**
 * Validate a message array for chat requests
 * @param {Message[]} messages - Messages to validate
 * @returns {boolean} Whether messages are valid
 */
export function validateMessages(messages) {
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
 * @param {number | undefined} bytes - Size in bytes
 * @returns {string} Formatted size
 */
export function formatModelSize(bytes) {
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
 * @param {string | undefined} dateString - Date string
 * @returns {string} Formatted date
 */
export function formatModelDate(dateString) {
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
 * @param {number} [completed=0] - Completed amount
 * @param {number} [total=0] - Total amount
 * @returns {number} Progress percentage
 */
export function calculateProgress(completed = 0, total = 0) {
  if (total === 0) return 0
  return Math.min(100, Math.max(0, (completed / total) * 100))
}

/**
 * Format progress display string
 * @param {number} [completed=0] - Completed amount
 * @param {number} [total=0] - Total amount
 * @returns {string} Progress string
 */
export function formatProgress(completed = 0, total = 0) {
  if (total === 0) return completed > 0 ? `${formatModelSize(completed)}` : '0%'
  
  const percentage = calculateProgress(completed, total)
  return `${percentage.toFixed(1)}% (${formatModelSize(completed)} / ${formatModelSize(total)})`
}

/**
 * Truncate digest strings for display
 * @param {string | undefined} digest - Digest string
 * @param {number} [length=12] - Maximum length
 * @returns {string} Truncated digest
 */
export function truncateDigest(digest, length = 12) {
  if (!digest) return 'Unknown'
  return digest.length > length ? `${digest.substring(0, length)}...` : digest
}

/**
 * Validate model name format
 * @param {string} name - Model name
 * @returns {boolean} Whether name is valid
 */
export function validateModelName(name) {
  if (!name || typeof name !== 'string') return false
  
  // Basic validation - model names should be alphanumeric with hyphens, colons for tags
  const modelNameRegex = /^[a-zA-Z0-9][a-zA-Z0-9._-]*(?::[a-zA-Z0-9._-]+)?$/
  return modelNameRegex.test(name)
}

/**
 * Extract model name and tag
 * @param {string} fullName - Full model name with tag
 * @returns {{name: string, tag?: string}} Model name and tag
 */
export function parseModelName(fullName) {
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
}

/**
 * Apply generation preset
 * @param {keyof typeof generationPresets} preset - Preset name
 * @param {Partial<GenerationOptions>} [customOptions] - Custom options
 * @returns {GenerationOptions} Combined options
 */
export function applyGenerationPreset(preset, customOptions) {
  return {
    ...generationPresets[preset],
    ...customOptions
  }
}