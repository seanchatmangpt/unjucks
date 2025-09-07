# AI Assistant Integration Patterns

## Overview

This document analyzes how AI assistants integrate with the Unjucks MCP ecosystem to provide intelligent code generation and development automation. It covers integration patterns for Claude Code, GPT-based systems, and custom AI implementations.

## 🤖 AI Assistant Integration Architecture

### **Universal MCP Interface**

```json
{
  "mcp": {
    "servers": {
      "unjucks": {
        "command": "unjucks",
        "args": ["mcp", "server"],
        "description": "AI-powered code generation with 40+ specialized tools",
        "capabilities": [
          "tools",
          "resources", 
          "memory",
          "workflows"
        ]
      }
    }
  }
}
```

### **Multi-Server Coordination**

```json
{
  "mcp": {
    "servers": {
      "unjucks-core": {
        "command": "unjucks",
        "args": ["mcp", "server"],
        "description": "Template generation and file operations"
      },
      "claude-flow": {
        "command": "npx",
        "args": ["claude-flow@alpha", "mcp", "start"], 
        "description": "Swarm coordination and agent orchestration"
      },
      "ruv-swarm": {
        "command": "npx",
        "args": ["ruv-swarm@latest", "mcp", "server"],
        "description": "Neural processing and autonomous agents"
      },
      "flow-nexus": {
        "command": "npx", 
        "args": ["flow-nexus@latest", "mcp", "serve"],
        "description": "Enterprise workflows and sandboxes"
      }
    }
  }
}
```

## 🎯 Integration Patterns by AI Assistant

### **Claude Code Integration**

#### **Direct Tool Access**
```typescript
// Claude Code can directly call any of the 40+ tools
interface ClaudeCodeMCP {
  // Core generation tools
  unjucks_list(): Promise<{ generators: GeneratorInfo[] }>;
  unjucks_generate(params: GenerateParams): Promise<GenerationResult>;
  unjucks_help(generator: string, template?: string): Promise<HelpInfo>;
  
  // Swarm coordination tools
  swarm_init(topology: 'mesh' | 'hierarchical' | 'ring' | 'star'): Promise<SwarmInfo>;
  agent_spawn(type: AgentType, capabilities?: string[]): Promise<AgentInfo>;
  task_orchestrate(task: string, agents?: string[]): Promise<OrchestrationResult>;
  
  // Neural processing tools  
  neural_train(pattern: 'coordination' | 'optimization' | 'prediction'): Promise<TrainingResult>;
  neural_patterns(action: 'analyze' | 'learn' | 'predict'): Promise<PatternInfo>;
  
  // Enterprise workflow tools
  workflow_create(name: string, steps: WorkflowStep[]): Promise<WorkflowInfo>;
  sandbox_create(template: string, config?: SandboxConfig): Promise<SandboxInfo>;
  github_repo_analyze(repo: string, type: 'security' | 'performance'): Promise<AnalysisResult>;
}
```

#### **Conversation Integration Examples**

**Example 1: Full-Stack Development**
```
Human: "Create a complete e-commerce platform with React frontend, Node.js API, and PostgreSQL database, including user authentication, payment processing, and admin dashboard."

Claude: I'll create a comprehensive e-commerce platform using our MCP ecosystem. Let me orchestrate this across multiple specialized agents:

[Calls: swarm_init({ topology: "hierarchical", agents: 8 })]
[Calls: agent_spawn({ type: "architect", capabilities: ["system-design", "database-modeling"] })]
[Calls: agent_spawn({ type: "frontend-dev", capabilities: ["react", "typescript", "ui-ux"] })]
[Calls: agent_spawn({ type: "backend-dev", capabilities: ["nodejs", "express", "auth"] })]
[Calls: agent_spawn({ type: "database-expert", capabilities: ["postgresql", "migrations"] })]

Now I'll generate the platform components:

[Calls: unjucks_generate({
  generator: "fullstack",
  template: "ecommerce",
  variables: {
    projectName: "ecommerce-platform",
    frontend: "react-typescript",
    backend: "nodejs-express", 
    database: "postgresql",
    auth: "jwt-passport",
    payments: "stripe",
    features: ["user-auth", "product-catalog", "shopping-cart", "checkout", "admin-dashboard"]
  }
})]

Let me also set up the development environment:

[Calls: sandbox_create({
  template: "fullstack-nodejs",
  name: "ecommerce-dev",
  env_vars: {
    DATABASE_URL: "postgresql://localhost:5432/ecommerce_dev",
    JWT_SECRET: "dev-secret-key",
    STRIPE_SECRET_KEY: "sk_test_..."
  },
  install_packages: ["express", "react", "typescript", "prisma", "stripe", "passport"]
})]

Finally, I'll create an enterprise workflow for deployment:

[Calls: workflow_create({
  name: "ecommerce-deployment",
  steps: [
    { action: "security_scan", parameters: { target: "./src", compliance: ["pci-dss"] }},
    { action: "run_tests", parameters: { coverage: 90 }},
    { action: "build_frontend", parameters: { optimize: true }},
    { action: "deploy_backend", parameters: { platform: "aws" }},
    { action: "setup_monitoring", parameters: { alerts: true }}
  ]
})]

✅ Complete e-commerce platform generated with:
• React TypeScript frontend with modern UI components
• Node.js/Express API with JWT authentication
• PostgreSQL database with optimized schema
• Stripe payment integration
• Admin dashboard with analytics
• Security scanning and compliance validation
• Deployment automation workflow

The platform is ready for development in your sandbox environment!
```

**Example 2: AI-Powered Code Refactoring**
```
Human: "This legacy JavaScript codebase needs to be modernized to TypeScript with better architecture and testing."

Claude: I'll analyze your codebase and orchestrate a comprehensive modernization using neural pattern analysis and automated refactoring:

[Calls: neural_train({ 
  pattern_type: "coordination",
  training_data: JSON.stringify({
    codebase: "./legacy-src",
    target: "modern-typescript",
    patterns: ["architecture", "testing", "type-safety"]
  })
})]

[Calls: github_repo_analyze({ repo: "legacy-codebase", type: "code_quality" })]

Based on the analysis, I'll create specialized agents for different aspects of modernization:

[Calls: swarm_init({ topology: "mesh", agents: 6 })]
[Calls: agent_spawn({ type: "typescript-expert", capabilities: ["js-to-ts", "type-inference", "generics"] })]
[Calls: agent_spawn({ type: "architect", capabilities: ["clean-architecture", "dependency-injection"] })]
[Calls: agent_spawn({ type: "test-engineer", capabilities: ["unit-testing", "integration-testing", "mocking"] })]

Now I'll execute the modernization workflow:

[Calls: workflow_create({
  name: "legacy-modernization",
  steps: [
    {
      action: "analyze_dependencies",
      description: "Map dependency graph and identify refactoring opportunities"
    },
    {
      action: "convert_to_typescript", 
      description: "Systematic conversion from JavaScript to TypeScript"
    },
    {
      action: "refactor_architecture",
      description: "Apply clean architecture patterns and SOLID principles"
    },
    {
      action: "add_comprehensive_testing",
      description: "Create unit tests, integration tests, and e2e tests"
    },
    {
      action: "optimize_performance",
      description: "Apply performance optimizations and bundling improvements"
    }
  ]
})]

[Calls: workflow_execute({ workflowId: "legacy-modernization", async: true })]

✅ Modernization complete with:
• 100% TypeScript conversion with strict type checking
• Clean architecture with dependency injection
• 95%+ test coverage with Jest and Testing Library
• Performance improvements (40% faster bundle)
• Modern tooling (ESLint, Prettier, Husky)
• CI/CD pipeline with automated quality gates

Your legacy codebase has been transformed into a modern, maintainable TypeScript application!
```

### **GPT Integration Pattern**

#### **OpenAI Function Calling**
```typescript
// GPT function definitions for MCP tools
const GPT_FUNCTION_DEFINITIONS = [
  {
    name: "unjucks_generate",
    description: "Generate code files from templates",
    parameters: {
      type: "object",
      properties: {
        generator: { type: "string", description: "Generator name" },
        template: { type: "string", description: "Template name" },
        variables: { type: "object", description: "Template variables" },
        dest: { type: "string", description: "Destination path" }
      },
      required: ["generator", "template"]
    }
  },
  {
    name: "swarm_orchestrate",
    description: "Orchestrate complex development tasks across AI agents",
    parameters: {
      type: "object",
      properties: {
        task: { type: "string", description: "Task description" },
        topology: { type: "string", enum: ["mesh", "hierarchical", "ring", "star"] },
        agents: { type: "array", items: { type: "string" }, description: "Required agent types" },
        priority: { type: "string", enum: ["low", "medium", "high", "critical"] }
      },
      required: ["task"]
    }
  },
  {
    name: "enterprise_pipeline",
    description: "Create enterprise development pipeline with compliance",
    parameters: {
      type: "object", 
      properties: {
        projectId: { type: "string", description: "Project identifier" },
        compliance: { type: "array", items: { type: "string" }, description: "Compliance requirements" },
        runtime: { type: "string", description: "Runtime environment" },
        dependencies: { type: "array", items: { type: "string" } }
      },
      required: ["projectId"]
    }
  }
];

// GPT integration wrapper
class GPTMCPBridge {
  async handleFunctionCall(functionName: string, parameters: any) {
    switch (functionName) {
      case 'unjucks_generate':
        return await this.mcpClient.callTool('unjucks_generate', parameters);
        
      case 'swarm_orchestrate': 
        // Multi-step orchestration
        const swarmResult = await this.mcpClient.callTool('swarm_init', {
          topology: parameters.topology || 'mesh'
        });
        
        const agents = await Promise.all(
          (parameters.agents || ['coder', 'tester']).map(type =>
            this.mcpClient.callTool('agent_spawn', { type })
          )
        );
        
        return await this.mcpClient.callTool('task_orchestrate', {
          task: parameters.task,
          swarmId: swarmResult.swarmId,
          agents: agents.map(a => a.agentId),
          priority: parameters.priority || 'medium'
        });
        
      case 'enterprise_pipeline':
        return await this.mcpClient.callTool('enterprise_pipeline', parameters);
        
      default:
        throw new Error(`Unknown function: ${functionName}`);
    }
  }
}
```

### **Custom AI Assistant Integration**

#### **REST API Wrapper**
```typescript
// REST API for custom AI integration
class UnjucksMCPAPI {
  private mcpBridge: MCPBridge;
  
  constructor() {
    this.mcpBridge = new MCPBridge({
      swarmMcpCommand: ['npx', 'claude-flow@alpha', 'mcp', 'start'],
      neuralMcpCommand: ['npx', 'ruv-swarm@latest', 'mcp', 'server'],
      enterpriseMcpCommand: ['npx', 'flow-nexus@latest', 'mcp', 'serve']
    });
  }
  
  // RESTful endpoints for AI assistants
  @POST('/api/mcp/tools/:toolName')
  async callTool(@Param('toolName') tool: string, @Body() params: any) {
    try {
      const result = await this.mcpBridge.callTool(tool, params);
      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  @GET('/api/mcp/tools')
  async listTools() {
    return {
      core: [
        'unjucks_list', 'unjucks_generate', 'unjucks_help', 
        'unjucks_dry_run', 'unjucks_inject'
      ],
      swarm: [
        'swarm_init', 'agent_spawn', 'task_orchestrate', 
        'swarm_status', 'memory_usage'
      ],
      neural: [
        'neural_train', 'neural_patterns', 'neural_predict',
        'daa_agent_create', 'daa_workflow_execute'
      ],
      enterprise: [
        'workflow_create', 'sandbox_create', 'github_repo_analyze',
        'security_scan', 'compliance_validate'
      ]
    };
  }
  
  @POST('/api/mcp/workflows')
  async createWorkflow(@Body() workflow: WorkflowDefinition) {
    // Orchestrate multi-step workflow across MCP servers
    const orchestrationResult = await this.mcpBridge.orchestrateJTBD({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      job: workflow.job,
      steps: workflow.steps.map(step => ({
        action: step.action,
        description: step.description,
        generator: step.generator,
        template: step.template,
        parameters: step.parameters
      }))
    });
    
    return orchestrationResult;
  }
}
```

## 🧠 Intelligent Usage Patterns

### **Context-Aware Tool Selection**

```typescript
class IntelligentMCPRouter {
  async routeRequest(userIntent: string, context: ProjectContext): Promise<MCPToolChain> {
    // Analyze user intent using neural patterns
    const intentAnalysis = await this.mcpBridge.callTool('neural_patterns', {
      action: 'analyze',
      operation: userIntent,
      outcome: context.expectedOutcome || 'code_generation'
    });
    
    // Route to appropriate tool chain based on intent
    if (intentAnalysis.category === 'full-stack-development') {
      return this.createFullStackChain(userIntent, context);
    }
    
    if (intentAnalysis.category === 'refactoring') {
      return this.createRefactoringChain(userIntent, context);
    }
    
    if (intentAnalysis.category === 'enterprise-compliance') {
      return this.createComplianceChain(userIntent, context);
    }
    
    // Default to simple generation
    return this.createSimpleGenerationChain(userIntent, context);
  }
  
  private async createFullStackChain(intent: string, context: ProjectContext): Promise<MCPToolChain> {
    return {
      steps: [
        { tool: 'swarm_init', params: { topology: 'hierarchical', agents: 6 } },
        { tool: 'agent_spawn', params: { type: 'architect', capabilities: ['system-design'] } },
        { tool: 'agent_spawn', params: { type: 'frontend-dev', capabilities: ['react', 'vue', 'angular'] } },
        { tool: 'agent_spawn', params: { type: 'backend-dev', capabilities: ['nodejs', 'python', 'java'] } },
        { tool: 'unjucks_generate', params: { 
          generator: 'fullstack', 
          template: this.selectTemplate(context.techStack),
          variables: this.extractVariables(intent, context)
        }},
        { tool: 'sandbox_create', params: { 
          template: context.runtime || 'nodejs',
          install_packages: this.inferDependencies(intent, context)
        }},
        { tool: 'workflow_create', params: {
          name: 'fullstack-deployment',
          steps: this.generateDeploymentSteps(context)
        }}
      ],
      coordination: {
        memorySync: true,
        errorRecovery: true,
        progressTracking: true
      }
    };
  }
}
```

### **Adaptive Learning Integration**

```typescript
class AdaptiveMCPAssistant {
  private usagePatterns = new Map<string, UsagePattern>();
  
  async executeWithLearning(toolName: string, params: any, context: any): Promise<any> {
    // Record usage pattern
    const pattern = {
      tool: toolName,
      params,
      context,
      timestamp: new Date(),
      userIntent: context.userIntent
    };
    
    // Execute tool
    const startTime = Date.now();
    const result = await this.mcpBridge.callTool(toolName, params);
    const executionTime = Date.now() - startTime;
    
    // Learn from execution
    await this.mcpBridge.callTool('daa_agent_adapt', {
      agent_id: 'usage-learner',
      feedback: `Tool ${toolName} executed in ${executionTime}ms with success: ${!result.error}`,
      performanceScore: result.error ? 0 : Math.max(0, 1 - executionTime / 10000), // Normalize to 0-1
      suggestions: this.generateOptimizationSuggestions(pattern, result)
    });
    
    // Update usage patterns for future optimization
    this.updateUsagePatterns(pattern, result, executionTime);
    
    return result;
  }
  
  async suggestOptimalToolChain(userIntent: string): Promise<MCPToolChain> {
    // Use learned patterns to suggest optimal tool chain
    const similarPatterns = this.findSimilarPatterns(userIntent);
    const successfulPatterns = similarPatterns.filter(p => p.success);
    
    if (successfulPatterns.length === 0) {
      // Fall back to neural pattern analysis
      return await this.routeWithNeuralAnalysis(userIntent);
    }
    
    // Generate optimized chain based on successful patterns
    const optimizedChain = this.synthesizeOptimalChain(successfulPatterns);
    
    // Enhance with current context
    return await this.enhanceChainWithContext(optimizedChain, userIntent);
  }
}
```

## 📊 Performance Optimization for AI Integration

### **Connection Pooling**

```typescript
class MCPConnectionPool {
  private connections = new Map<string, MCPConnection[]>();
  private maxConnections = 10;
  
  async getConnection(serverType: string): Promise<MCPConnection> {
    const pool = this.connections.get(serverType) || [];
    
    // Find available connection
    const available = pool.find(conn => !conn.busy);
    if (available) {
      available.busy = true;
      return available;
    }
    
    // Create new connection if under limit
    if (pool.length < this.maxConnections) {
      const newConnection = await this.createConnection(serverType);
      pool.push(newConnection);
      this.connections.set(serverType, pool);
      newConnection.busy = true;
      return newConnection;
    }
    
    // Wait for connection to become available
    return await this.waitForConnection(serverType);
  }
  
  releaseConnection(serverType: string, connection: MCPConnection) {
    connection.busy = false;
    connection.lastUsed = Date.now();
  }
  
  // Cleanup idle connections
  private startCleanupTimer() {
    setInterval(() => {
      const now = Date.now();
      const maxIdleTime = 300000; // 5 minutes
      
      for (const [serverType, pool] of this.connections) {
        const activeConnections = pool.filter(conn => 
          conn.busy || (now - conn.lastUsed) < maxIdleTime
        );
        
        // Close idle connections
        const idleConnections = pool.filter(conn =>
          !conn.busy && (now - conn.lastUsed) >= maxIdleTime
        );
        
        idleConnections.forEach(conn => conn.close());
        this.connections.set(serverType, activeConnections);
      }
    }, 60000); // Check every minute
  }
}
```

### **Caching Strategies**

```typescript
class MCPResponseCache {
  private cache = new Map<string, CacheEntry>();
  private stats = { hits: 0, misses: 0, evictions: 0 };
  
  async get(toolName: string, params: any): Promise<any | null> {
    const key = this.generateCacheKey(toolName, params);
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.evictions++;
      return null;
    }
    
    this.stats.hits++;
    entry.lastAccessed = Date.now();
    return entry.data;
  }
  
  set(toolName: string, params: any, data: any, ttl = 300000): void {
    const key = this.generateCacheKey(toolName, params);
    const expiresAt = Date.now() + ttl;
    
    this.cache.set(key, {
      data,
      expiresAt,
      lastAccessed: Date.now(),
      toolName,
      size: this.calculateSize(data)
    });
    
    // Evict old entries if cache is too large
    this.evictIfNeeded();
  }
  
  private shouldCache(toolName: string): boolean {
    const cacheable = [
      'unjucks_list',      // Template discovery (rarely changes)
      'unjucks_help',      // Template documentation (static)
      'github_repo_analyze', // Repository analysis (cache for 10 minutes)
      'neural_patterns'    // Pattern analysis (cache for 5 minutes)
    ];
    
    return cacheable.includes(toolName);
  }
  
  getCacheStats() {
    const hitRate = (this.stats.hits / (this.stats.hits + this.stats.misses)) || 0;
    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100),
      totalEntries: this.cache.size,
      memoryUsage: this.calculateTotalSize()
    };
  }
}
```

## 🎯 Best Practices for AI Assistant Integration

### **Error Handling and Resilience**

```typescript
class ResilientMCPClient {
  async callToolWithRetry(
    toolName: string, 
    params: any, 
    options: RetryOptions = {}
  ): Promise<any> {
    const {
      maxRetries = 3,
      backoffMultiplier = 2,
      initialDelay = 1000,
      circuitBreaker = true
    } = options;
    
    let lastError: Error;
    let delay = initialDelay;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Check circuit breaker
        if (circuitBreaker && this.circuitBreaker.isOpen(toolName)) {
          throw new Error(`Circuit breaker open for ${toolName}`);
        }
        
        const result = await this.mcpBridge.callTool(toolName, params);
        
        // Success - reset circuit breaker
        this.circuitBreaker.recordSuccess(toolName);
        
        return result;
        
      } catch (error) {
        lastError = error as Error;
        this.circuitBreaker.recordFailure(toolName);
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          break;
        }
        
        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }
        
        // Wait before retry
        await this.delay(delay);
        delay *= backoffMultiplier;
        
        console.warn(`Retry ${attempt + 1}/${maxRetries} for ${toolName}: ${error.message}`);
      }
    }
    
    // All retries failed
    throw new Error(`Tool ${toolName} failed after ${maxRetries + 1} attempts: ${lastError.message}`);
  }
  
  private isNonRetryableError(error: any): boolean {
    // Don't retry on validation errors, auth errors, etc.
    return error.code === 'VALIDATION_ERROR' || 
           error.code === 'AUTH_ERROR' ||
           error.code === 'NOT_FOUND';
  }
}
```

### **Security and Validation**

```typescript
class SecureMCPValidator {
  validateToolCall(toolName: string, params: any, context: AIContext): ValidationResult {
    // 1. Tool access control
    if (!this.hasPermission(context.userId, toolName)) {
      return { valid: false, error: 'Insufficient permissions' };
    }
    
    // 2. Parameter validation
    const schemaValidation = this.validateParameters(toolName, params);
    if (!schemaValidation.valid) {
      return schemaValidation;
    }
    
    // 3. Path traversal protection
    if (this.hasPathTraversal(params)) {
      return { valid: false, error: 'Path traversal detected' };
    }
    
    // 4. Resource limits
    if (this.exceedsResourceLimits(toolName, params, context)) {
      return { valid: false, error: 'Resource limits exceeded' };
    }
    
    // 5. Rate limiting
    if (this.isRateLimited(context.userId, toolName)) {
      return { valid: false, error: 'Rate limit exceeded' };
    }
    
    return { valid: true };
  }
  
  sanitizeOutput(toolName: string, output: any): any {
    // Remove sensitive information from outputs
    const sanitized = { ...output };
    
    // Remove file system paths outside project
    if (sanitized.files) {
      sanitized.files = sanitized.files.filter(file => 
        this.isWithinProject(file.path)
      );
    }
    
    // Redact environment variables
    if (sanitized.env) {
      sanitized.env = this.redactSensitiveEnvVars(sanitized.env);
    }
    
    // Remove internal error details in production
    if (sanitized.error && process.env.NODE_ENV === 'production') {
      sanitized.error = 'Internal server error';
    }
    
    return sanitized;
  }
}
```

This comprehensive integration pattern enables AI assistants to leverage the full power of the Unjucks MCP ecosystem while maintaining security, performance, and reliability standards for enterprise deployment.