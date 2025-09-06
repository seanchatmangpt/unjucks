// TypeScript types generated from OpenAPI specification
export interface GenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: GenerationOptions;
}

export interface GenerateResponse {
  model?: string;
  response?: string;
  done?: boolean;
  context?: number[];
}

export interface ChatRequest {
  model: string;
  messages: Message[];
  stream?: boolean;
  options?: GenerationOptions;
}

export interface ChatResponse {
  model?: string;
  message?: Message;
  done?: boolean;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelsResponse {
  models?: Model[];
}

export interface Model {
  name?: string;
  modified_at?: string;
  size?: number;
  digest?: string;
}

export interface PullRequest {
  name: string;
  insecure?: boolean;
  stream?: boolean;
}

export interface PullResponse {
  status?: string;
  digest?: string;
  total?: number;
  completed?: number;
}

export interface GenerationOptions {
  num_keep?: number;
  seed?: number;
  num_predict?: number;
  top_k?: number;
  top_p?: number;
  temperature?: number;
  repeat_last_n?: number;
  repeat_penalty?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
}

export interface OllamaError {
  error: string;
  message?: string;
}

export interface StreamingResponse {
  model?: string;
  response?: string;
  done?: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}