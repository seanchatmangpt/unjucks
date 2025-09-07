/**
 * @fileoverview TypeScript types generated from OpenAPI specification - converted to JSDoc
 * @module types/ollama
 */

/**
 * @typedef {Object} GenerateRequest
 * @property {string} model - Model name to use
 * @property {string} prompt - Input prompt text
 * @property {boolean} [stream] - Enable streaming response
 * @property {GenerationOptions} [options] - Generation configuration options
 */

/**
 * @typedef {Object} GenerateResponse
 * @property {string} [model] - Model name that was used
 * @property {string} [response] - Generated response text
 * @property {boolean} [done] - Whether generation is complete
 * @property {number[]} [context] - Context tokens for continuation
 */

/**
 * @typedef {Object} ChatRequest
 * @property {string} model - Model name to use
 * @property {Message[]} messages - Conversation messages
 * @property {boolean} [stream] - Enable streaming response
 * @property {GenerationOptions} [options] - Generation configuration options
 */

/**
 * @typedef {Object} ChatResponse
 * @property {string} [model] - Model name that was used
 * @property {Message} [message] - Response message
 * @property {boolean} [done] - Whether chat is complete
 */

/**
 * @typedef {Object} Message
 * @property {'system'|'user'|'assistant'} role - Message role
 * @property {string} content - Message content
 */

/**
 * @typedef {Object} ModelsResponse
 * @property {Model[]} [models] - Available models
 */

/**
 * @typedef {Object} Model
 * @property {string} [name] - Model name
 * @property {string} [modified_at] - Last modification date
 * @property {number} [size] - Model size in bytes
 * @property {string} [digest] - Model digest hash
 */

/**
 * @typedef {Object} PullRequest
 * @property {string} name - Model name to pull
 * @property {boolean} [insecure] - Allow insecure connections
 * @property {boolean} [stream] - Enable streaming response
 */

/**
 * @typedef {Object} PullResponse
 * @property {string} [status] - Pull status message
 * @property {string} [digest] - Content digest
 * @property {number} [total] - Total bytes to download
 * @property {number} [completed] - Bytes completed
 */

/**
 * @typedef {Object} GenerationOptions
 * @property {number} [num_keep] - Number of tokens to keep from prompt
 * @property {number} [seed] - Random seed for generation
 * @property {number} [num_predict] - Maximum tokens to generate
 * @property {number} [top_k] - Top-k sampling parameter
 * @property {number} [top_p] - Top-p sampling parameter
 * @property {number} [temperature] - Generation temperature
 * @property {number} [repeat_last_n] - Last n tokens to consider for repetition
 * @property {number} [repeat_penalty] - Repetition penalty factor
 * @property {number} [presence_penalty] - Presence penalty factor
 * @property {number} [frequency_penalty] - Frequency penalty factor
 */

/**
 * @typedef {Object} OllamaError
 * @property {string} error - Error message
 * @property {string} [message] - Additional error details
 */

/**
 * @typedef {Object} StreamingResponse
 * @property {string} [model] - Model name that was used
 * @property {string} [response] - Partial response text
 * @property {boolean} [done] - Whether streaming is complete
 * @property {number[]} [context] - Context tokens
 * @property {number} [total_duration] - Total generation time in nanoseconds
 * @property {number} [load_duration] - Model load time in nanoseconds
 * @property {number} [prompt_eval_count] - Number of tokens in prompt
 * @property {number} [prompt_eval_duration] - Prompt evaluation time in nanoseconds
 * @property {number} [eval_count] - Number of tokens generated
 * @property {number} [eval_duration] - Token generation time in nanoseconds
 */

export default {};