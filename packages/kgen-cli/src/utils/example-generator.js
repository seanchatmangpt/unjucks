/**
 * Example Generator Utility
 * 
 * Generates code examples for different languages and use cases.
 */

export class ExampleGenerator {
  constructor() {
    this.languages = ['javascript', 'python', 'java', 'go', 'rust', 'typescript'];
    this.categories = ['authentication', 'data-processing', 'api-usage', 'templates', 'utilities'];
  }

  async generateCodeExamples(filter = null) {
    const examples = await this.createExamples();
    
    let filtered = examples;
    if (filter) {
      filtered = examples.filter(example => 
        example.category.includes(filter) ||
        example.language.includes(filter) ||
        example.title.toLowerCase().includes(filter.toLowerCase())
      );
    }
    
    return {
      totalExamples: filtered.length,
      byCategory: this.groupByCategory(filtered),
      byLanguage: this.groupByLanguage(filtered),
      featured: filtered.filter(ex => ex.featured).slice(0, 10),
      interactive: filtered.filter(ex => ex.interactive),
      repositories: this.generateRepositoryLinks(filtered)
    };
  }

  async createExamples() {
    const examples = [];
    
    // Authentication examples
    examples.push(...this.createAuthExamples());
    
    // Data processing examples
    examples.push(...this.createDataExamples());
    
    // API usage examples
    examples.push(...this.createAPIExamples());
    
    // Template examples
    examples.push(...this.createTemplateExamples());
    
    // Utility examples
    examples.push(...this.createUtilityExamples());
    
    return examples;
  }

  createAuthExamples() {
    return [
      {
        id: 'auth-jwt-js',
        title: 'JWT Authentication with JavaScript',
        language: 'javascript',
        category: 'authentication',
        difficulty: 'beginner',
        featured: true,
        interactive: true,
        description: 'Basic JWT authentication implementation',
        code: `
// JWT Authentication Example
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

class AuthService {
  constructor(secretKey) {
    this.secretKey = secretKey;
  }

  async login(email, password) {
    // Verify user credentials (replace with actual user lookup)
    const user = await this.findUserByEmail(email);
    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      throw new Error('Invalid credentials');
    }

    // Generate JWT token
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(payload, this.secretKey, { 
      expiresIn: '1h',
      issuer: 'kgen-app'
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    };
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, this.secretKey);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async findUserByEmail(email) {
    // Mock user lookup - replace with database query
    return {
      id: 1,
      email: 'user@example.com',
      passwordHash: '$2b$10$...',
      name: 'John Doe',
      role: 'user'
    };
  }
}

// Usage
const auth = new AuthService('your-secret-key');
const result = await auth.login('user@example.com', 'password');
console.log('Login successful:', result);
        `.trim(),
        dependencies: ['jsonwebtoken', 'bcrypt'],
        tags: ['jwt', 'authentication', 'security'],
        lastUpdated: '2024-01-15'
      },
      {
        id: 'auth-oauth2-python',
        title: 'OAuth2 Integration with Python',
        language: 'python',
        category: 'authentication',
        difficulty: 'intermediate',
        featured: true,
        interactive: false,
        description: 'OAuth2 flow implementation for third-party authentication',
        code: `
import requests
from urllib.parse import urlencode
import secrets

class OAuth2Client:
    def __init__(self, client_id, client_secret, redirect_uri):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.auth_url = "https://provider.com/oauth/authorize"
        self.token_url = "https://provider.com/oauth/token"
    
    def get_authorization_url(self):
        """Generate authorization URL for user redirect"""
        state = secrets.token_urlsafe(32)
        params = {
            'client_id': self.client_id,
            'redirect_uri': self.redirect_uri,
            'response_type': 'code',
            'scope': 'read write',
            'state': state
        }
        return f"{self.auth_url}?{urlencode(params)}", state
    
    def exchange_code_for_token(self, code, state):
        """Exchange authorization code for access token"""
        data = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': self.redirect_uri
        }
        
        response = requests.post(self.token_url, data=data)
        response.raise_for_status()
        
        return response.json()
    
    def refresh_token(self, refresh_token):
        """Refresh access token using refresh token"""
        data = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'refresh_token': refresh_token,
            'grant_type': 'refresh_token'
        }
        
        response = requests.post(self.token_url, data=data)
        response.raise_for_status()
        
        return response.json()

# Usage
client = OAuth2Client('your-client-id', 'your-secret', 'http://localhost:8000/callback')
auth_url, state = client.get_authorization_url()
print(f"Visit: {auth_url}")

# After user authorization and callback
# token_data = client.exchange_code_for_token(auth_code, state)
        `.trim(),
        dependencies: ['requests'],
        tags: ['oauth2', 'authentication', 'third-party'],
        lastUpdated: '2024-01-12'
      }
    ];
  }

  createDataExamples() {
    return [
      {
        id: 'data-transform-js',
        title: 'Data Transformation Pipeline',
        language: 'javascript',
        category: 'data-processing',
        difficulty: 'intermediate',
        featured: true,
        interactive: true,
        description: 'Transform and validate data using functional programming',
        code: `
// Data Transformation Pipeline
class DataPipeline {
  constructor() {
    this.transformers = [];
  }

  addTransformer(transformer) {
    this.transformers.push(transformer);
    return this;
  }

  async process(data) {
    let result = data;
    
    for (const transformer of this.transformers) {
      result = await transformer(result);
    }
    
    return result;
  }
}

// Built-in transformers
const transformers = {
  validate: (schema) => (data) => {
    // Simple validation - use joi or similar in production
    for (const [key, rules] of Object.entries(schema)) {
      if (rules.required && !data[key]) {
        throw new Error(\`Missing required field: \${key}\`);
      }
      if (rules.type && typeof data[key] !== rules.type) {
        throw new Error(\`Invalid type for \${key}: expected \${rules.type}\`);
      }
    }
    return data;
  },

  normalize: (fields) => (data) => {
    const normalized = { ...data };
    
    fields.forEach(field => {
      if (normalized[field] && typeof normalized[field] === 'string') {
        normalized[field] = normalized[field].toLowerCase().trim();
      }
    });
    
    return normalized;
  },

  enrich: (enricher) => async (data) => {
    const enrichedData = await enricher(data);
    return { ...data, ...enrichedData };
  },

  filter: (predicate) => (data) => {
    return Array.isArray(data) ? data.filter(predicate) : data;
  },

  map: (mapper) => (data) => {
    return Array.isArray(data) ? data.map(mapper) : mapper(data);
  }
};

// Usage example
const userSchema = {
  email: { required: true, type: 'string' },
  name: { required: true, type: 'string' },
  age: { required: false, type: 'number' }
};

const pipeline = new DataPipeline()
  .addTransformer(transformers.validate(userSchema))
  .addTransformer(transformers.normalize(['email', 'name']))
  .addTransformer(transformers.enrich(async (user) => ({
    id: Math.random().toString(36),
    createdAt: new Date().toISOString(),
    isActive: true
  })));

// Process single user
const userData = {
  email: '  USER@EXAMPLE.COM  ',
  name: '  John Doe  ',
  age: 30
};

const processedUser = await pipeline.process(userData);
console.log('Processed user:', processedUser);

// Process array of users
const usersData = [userData, { email: 'jane@test.com', name: 'Jane Smith' }];
const batchPipeline = new DataPipeline()
  .addTransformer(transformers.map(user => 
    transformers.validate(userSchema)(user)
  ));
        `.trim(),
        dependencies: [],
        tags: ['data', 'transformation', 'validation', 'pipeline'],
        lastUpdated: '2024-01-18'
      }
    ];
  }

  createAPIExamples() {
    return [
      {
        id: 'api-client-ts',
        title: 'Type-Safe API Client',
        language: 'typescript',
        category: 'api-usage',
        difficulty: 'advanced',
        featured: true,
        interactive: false,
        description: 'Build a type-safe HTTP client with error handling',
        code: `
// Type-safe API Client
interface APIResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  metadata?: {
    page: number;
    limit: number;
    total: number;
  };
}

interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

class APIClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;

  constructor(baseURL: string, token?: string) {
    this.baseURL = baseURL.replace(/\\/+$/, '');
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: \`Bearer \${token}\` })
    };
    this.timeout = 30000;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<APIResponse<T>> {
    const url = \`\${this.baseURL}\${endpoint}\`;
    const headers = { ...this.defaultHeaders, ...options.headers };
    
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeout || this.timeout
    );

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          errorData.message || \`HTTP \${response.status}\`,
          response.status,
          errorData
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof APIError) {
        throw error;
      }
      
      if (error.name === 'AbortError') {
        throw new APIError('Request timeout', 408);
      }
      
      throw new APIError('Network error', 0, error);
    }
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<APIResponse<T>> {
    return this.request<T>('GET', endpoint, undefined, options);
  }

  async post<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<APIResponse<T>> {
    return this.request<T>('POST', endpoint, data, options);
  }

  async put<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<APIResponse<T>> {
    return this.request<T>('PUT', endpoint, data, options);
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<APIResponse<T>> {
    return this.request<T>('DELETE', endpoint, undefined, options);
  }

  setToken(token: string) {
    this.defaultHeaders.Authorization = \`Bearer \${token}\`;
  }

  removeToken() {
    delete this.defaultHeaders.Authorization;
  }
}

// Usage
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

const api = new APIClient('https://api.example.com', 'your-token');

// Type-safe API calls
try {
  const usersResponse = await api.get<User[]>('/users');
  console.log('Users:', usersResponse.data);

  const newUser = await api.post<User>('/users', {
    name: 'John Doe',
    email: 'john@example.com'
  });
  console.log('Created user:', newUser.data);

} catch (error) {
  if (error instanceof APIError) {
    console.error(\`API Error (\${error.status}): \${error.message}\`);
  } else {
    console.error('Unexpected error:', error);
  }
}
        `.trim(),
        dependencies: [],
        tags: ['api', 'typescript', 'http-client', 'error-handling'],
        lastUpdated: '2024-01-20'
      }
    ];
  }

  createTemplateExamples() {
    return [
      {
        id: 'template-engine-js',
        title: 'Custom Template Engine',
        language: 'javascript',
        category: 'templates',
        difficulty: 'advanced',
        featured: true,
        interactive: true,
        description: 'Build a simple template engine with variable interpolation',
        code: `
// Simple Template Engine
class TemplateEngine {
  constructor() {
    this.filters = new Map();
    this.registerDefaultFilters();
  }

  registerFilter(name, fn) {
    this.filters.set(name, fn);
  }

  render(template, data = {}) {
    // Handle variable interpolation: {{ variable }}
    let output = template.replace(/\\{\\{\\s*([^}]+)\\s*\\}\\}/g, (match, expression) => {
      return this.evaluateExpression(expression.trim(), data);
    });

    // Handle conditionals: {% if condition %}...{% endif %}
    output = output.replace(
      /\\{%\\s*if\\s+([^%]+)\\s*%\\}([\\s\\S]*?)\\{%\\s*endif\\s*%\\}/g,
      (match, condition, content) => {
        return this.evaluateCondition(condition.trim(), data) ? content : '';
      }
    );

    // Handle loops: {% for item in items %}...{% endfor %}
    output = output.replace(
      /\\{%\\s*for\\s+(\\w+)\\s+in\\s+(\\w+)\\s*%\\}([\\s\\S]*?)\\{%\\s*endfor\\s*%\\}/g,
      (match, itemName, arrayName, content) => {
        return this.renderLoop(itemName, arrayName, content, data);
      }
    );

    return output;
  }

  evaluateExpression(expression, data) {
    // Handle filters: variable | filter
    const parts = expression.split('|').map(p => p.trim());
    const varName = parts[0];
    const filters = parts.slice(1);

    let value = this.getValue(varName, data);

    // Apply filters
    for (const filterName of filters) {
      const filter = this.filters.get(filterName);
      if (filter) {
        value = filter(value);
      }
    }

    return value !== undefined ? value : '';
  }

  evaluateCondition(condition, data) {
    // Simple condition evaluation (extend as needed)
    if (condition.includes('==')) {
      const [left, right] = condition.split('==').map(s => s.trim());
      return this.getValue(left, data) == this.getValue(right, data);
    }
    
    if (condition.includes('!=')) {
      const [left, right] = condition.split('!=').map(s => s.trim());
      return this.getValue(left, data) != this.getValue(right, data);
    }

    // Simple truthy check
    return !!this.getValue(condition, data);
  }

  renderLoop(itemName, arrayName, content, data) {
    const array = this.getValue(arrayName, data);
    if (!Array.isArray(array)) return '';

    return array.map((item, index) => {
      const loopData = {
        ...data,
        [itemName]: item,
        loop: { index, first: index === 0, last: index === array.length - 1 }
      };
      return this.render(content, loopData);
    }).join('');
  }

  getValue(path, data) {
    // Handle nested object access: user.name
    return path.split('.').reduce((obj, key) => {
      // Remove quotes if present
      key = key.replace(/['"\`]/g, '');
      return obj && obj[key];
    }, data);
  }

  registerDefaultFilters() {
    this.registerFilter('upper', (value) => 
      typeof value === 'string' ? value.toUpperCase() : value
    );
    
    this.registerFilter('lower', (value) => 
      typeof value === 'string' ? value.toLowerCase() : value
    );
    
    this.registerFilter('capitalize', (value) => 
      typeof value === 'string' ? 
        value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : value
    );
    
    this.registerFilter('default', (value, defaultValue = '') => 
      value !== undefined && value !== null && value !== '' ? value : defaultValue
    );
    
    this.registerFilter('json', (value) => JSON.stringify(value, null, 2));
    
    this.registerFilter('length', (value) => 
      value && (value.length !== undefined) ? value.length : 0
    );
  }
}

// Usage example
const engine = new TemplateEngine();

const template = \`
<div class="user-profile">
  <h1>{{ user.name | capitalize }}</h1>
  <p>Email: {{ user.email | lower }}</p>
  
  {% if user.isActive %}
    <span class="status active">Active User</span>
  {% endif %}
  
  <h3>Recent Posts ({{ posts | length }})</h3>
  {% for post in posts %}
    <article>
      <h4>{{ post.title }}</h4>
      <p>{{ post.excerpt }}</p>
      <small>Published: {{ post.publishedAt }}</small>
    </article>
  {% endfor %}
</div>
\`;

const data = {
  user: {
    name: 'john doe',
    email: 'JOHN@EXAMPLE.COM',
    isActive: true
  },
  posts: [
    {
      title: 'Introduction to Templates',
      excerpt: 'Learn how to use our template engine',
      publishedAt: '2024-01-15'
    },
    {
      title: 'Advanced Features',
      excerpt: 'Explore filters and conditionals',
      publishedAt: '2024-01-18'
    }
  ]
};

const rendered = engine.render(template, data);
console.log(rendered);
        `.trim(),
        dependencies: [],
        tags: ['templates', 'engine', 'interpolation', 'filters'],
        lastUpdated: '2024-01-16'
      }
    ];
  }

  createUtilityExamples() {
    return [
      {
        id: 'retry-utility-js',
        title: 'Retry Utility with Exponential Backoff',
        language: 'javascript',
        category: 'utilities',
        difficulty: 'intermediate',
        featured: false,
        interactive: true,
        description: 'Resilient retry mechanism for network requests',
        code: `
// Retry Utility with Exponential Backoff
class RetryError extends Error {
  constructor(message, attempts, lastError) {
    super(message);
    this.name = 'RetryError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

async function retry(fn, options = {}) {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    jitter = true,
    retryCondition = (error) => true
  } = options;

  let attempt = 1;
  let delay = initialDelay;

  while (attempt <= maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts || !retryCondition(error)) {
        throw new RetryError(
          \`Failed after \${attempt} attempts\`,
          attempt,
          error
        );
      }

      console.warn(\`Attempt \${attempt} failed, retrying in \${delay}ms...\`, error.message);

      // Wait with exponential backoff
      await sleep(jitter ? addJitter(delay) : delay);

      // Calculate next delay
      delay = Math.min(delay * backoffFactor, maxDelay);
      attempt++;
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function addJitter(delay, jitterFactor = 0.1) {
  const jitter = delay * jitterFactor * Math.random();
  return delay + jitter;
}

// Specialized retry functions
const retryHTTP = (fn, options = {}) => retry(fn, {
  ...options,
  retryCondition: (error) => {
    // Retry on network errors and 5xx status codes
    return !error.response || 
           error.response.status >= 500 || 
           error.code === 'NETWORK_ERROR';
  }
});

const retryDatabase = (fn, options = {}) => retry(fn, {
  maxAttempts: 5,
  initialDelay: 500,
  maxDelay: 10000,
  ...options,
  retryCondition: (error) => {
    // Retry on connection errors, timeouts, and deadlocks
    return error.code === 'ECONNRESET' ||
           error.code === 'ETIMEDOUT' ||
           error.code === 'DEADLOCK_DETECTED';
  }
});

// Usage examples
async function unreliableAPICall() {
  const response = await fetch('https://api.example.com/data');
  if (!response.ok) {
    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
  }
  return response.json();
}

async function flakyCacheOperation() {
  // Simulate a cache operation that fails 70% of the time
  if (Math.random() < 0.7) {
    throw new Error('Cache miss');
  }
  return { data: 'cached_value' };
}

// Example 1: Retry HTTP request
try {
  const data = await retryHTTP(unreliableAPICall, {
    maxAttempts: 5,
    initialDelay: 1000
  });
  console.log('API data:', data);
} catch (error) {
  if (error instanceof RetryError) {
    console.error(\`All retry attempts failed: \${error.message}\`);
  } else {
    console.error('Unexpected error:', error);
  }
}

// Example 2: Retry with custom condition
try {
  const result = await retry(flakyCacheOperation, {
    maxAttempts: 10,
    initialDelay: 100,
    maxDelay: 2000,
    retryCondition: (error) => error.message === 'Cache miss'
  });
  console.log('Cache result:', result);
} catch (error) {
  console.error('Cache operation failed:', error);
}
        `.trim(),
        dependencies: [],
        tags: ['utility', 'retry', 'backoff', 'resilience'],
        lastUpdated: '2024-01-14'
      }
    ];
  }

  groupByCategory(examples) {
    return examples.reduce((groups, example) => {
      if (!groups[example.category]) {
        groups[example.category] = [];
      }
      groups[example.category].push(example);
      return groups;
    }, {});
  }

  groupByLanguage(examples) {
    return examples.reduce((groups, example) => {
      if (!groups[example.language]) {
        groups[example.language] = [];
      }
      groups[example.language].push(example);
      return groups;
    }, {});
  }

  generateRepositoryLinks(examples) {
    const languages = [...new Set(examples.map(ex => ex.language))];
    
    return languages.map(language => ({
      language,
      repository: `https://github.com/kgen-io/examples-${language}`,
      examples: examples.filter(ex => ex.language === language).length,
      lastUpdated: '2024-01-20'
    }));
  }

  async getAdvancedExamples() {
    // Return more complex examples for comprehensive view
    return {
      microservices: [
        'Service Discovery Pattern',
        'Circuit Breaker Implementation',
        'Distributed Tracing Setup'
      ],
      performance: [
        'Caching Strategies',
        'Connection Pooling',
        'Async Processing Patterns'
      ],
      security: [
        'Rate Limiting Middleware',
        'Input Validation Framework',
        'Secure Session Management'
      ]
    };
  }
}