# OpenAPI 3.0 Specification

## Complete API Specification

```yaml
openapi: 3.0.3
info:
  title: Unjucks API
  version: 2025.09.06
  description: |
    Comprehensive API for the Unjucks template generation and semantic processing system.
    
    ## Features
    - Template generation and scaffolding
    - Semantic web processing (RDF, OWL, SPARQL)
    - MCP server integration
    - Agent coordination and swarm intelligence
    - Performance monitoring and analytics
    
    ## Authentication
    Most endpoints require API key authentication via header or query parameter.
    
  contact:
    name: Unjucks Team
    url: https://unjucks.dev
    email: support@unjucks.dev
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.unjucks.dev/v1
    description: Production server
  - url: https://staging-api.unjucks.dev/v1  
    description: Staging server
  - url: http://localhost:3000/api/v1
    description: Local development server

security:
  - ApiKeyAuth: []
  - BearerAuth: []

tags:
  - name: Templates
    description: Template generation and management operations
  - name: Semantic
    description: Semantic web processing and RDF operations
  - name: MCP
    description: Model Context Protocol server integration
  - name: Agents
    description: Agent coordination and swarm management
  - name: Performance
    description: Performance monitoring and optimization
  - name: Configuration
    description: System configuration management
  - name: Hooks
    description: Automation hooks and workflow management

paths:
  # Template Generation APIs
  /templates:
    get:
      tags: [Templates]
      summary: List available templates
      description: Retrieve a list of all available template generators and their templates
      parameters:
        - name: generator
          in: query
          description: Filter by specific generator
          schema:
            type: string
            example: component
        - name: category
          in: query
          description: Filter by template category
          schema:
            type: string
            enum: [frontend, backend, fullstack, mobile, data, infrastructure]
        - name: limit
          in: query
          description: Maximum number of results
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
      responses:
        '200':
          description: List of available templates
          content:
            application/json:
              schema:
                type: object
                properties:
                  generators:
                    type: array
                    items:
                      $ref: '#/components/schemas/Generator'
                  total:
                    type: integer
                    example: 25
                  page:
                    type: integer
                    example: 1
              example:
                generators:
                  - name: component
                    description: Frontend component generators
                    templates:
                      - name: react
                        description: React component with TypeScript
                        variables: [name, props, withTests]
                      - name: vue
                        description: Vue 3 component with Composition API
                        variables: [name, props, withScript, withStyle]
                total: 25
                page: 1
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '500':
          $ref: '#/components/responses/InternalError'

  /templates/generate:
    post:
      tags: [Templates]
      summary: Generate files from template
      description: Generate files using specified template and variables
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/GenerateRequest'
            example:
              generator: component
              template: react
              variables:
                name: UserProfile
                props: [id, name, email, avatar]
                withTests: true
                withStories: true
              destination: ./src/components
              options:
                force: false
                dry: false
                backup: true
      responses:
        '200':
          description: Files generated successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GenerateResponse'
              example:
                success: true
                files:
                  - path: ./src/components/UserProfile.tsx
                    size: 2048
                    checksum: abc123def456
                  - path: ./src/components/UserProfile.test.tsx
                    size: 1536
                    checksum: def456ghi789
                duration: 145
                warnings: []
        '400':
          $ref: '#/components/responses/BadRequest'
        '422':
          description: Validation error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ValidationError'

  /templates/{generator}/{template}/variables:
    get:
      tags: [Templates]
      summary: Get template variables
      description: Retrieve variable definitions for a specific template
      parameters:
        - name: generator
          in: path
          required: true
          schema:
            type: string
          example: component
        - name: template
          in: path
          required: true
          schema:
            type: string
          example: react
      responses:
        '200':
          description: Template variable definitions
          content:
            application/json:
              schema:
                type: object
                properties:
                  variables:
                    type: array
                    items:
                      $ref: '#/components/schemas/TemplateVariable'
              example:
                variables:
                  - name: name
                    type: string
                    required: true
                    description: Component name in PascalCase
                    validation: "^[A-Z][a-zA-Z0-9]*$"
                  - name: props
                    type: array
                    required: false
                    description: Component props
                    default: []

  # Semantic Web APIs
  /semantic/validate:
    post:
      tags: [Semantic]
      summary: Validate RDF data
      description: Validate RDF/Turtle data against ontologies and compliance frameworks
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SemanticValidateRequest'
      responses:
        '200':
          description: Validation results
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ValidationResult'

  /semantic/query:
    post:
      tags: [Semantic]
      summary: Execute SPARQL query
      description: Execute SPARQL queries on loaded knowledge graphs
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                query:
                  oneOf:
                    - type: string
                      description: SPARQL query string
                    - type: object
                      description: Simple triple pattern
                      properties:
                        subject:
                          type: string
                        predicate:
                          type: string
                        object:
                          type: string
                knowledgeBase:
                  type: array
                  items:
                    type: string
                  description: Knowledge base file paths
                options:
                  type: object
                  properties:
                    reasoning:
                      type: boolean
                      default: false
                    limit:
                      type: integer
                      default: 100
                    format:
                      type: string
                      enum: [json, table, csv, turtle]
                      default: json
      responses:
        '200':
          description: Query results
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/QueryResult'

  /semantic/reasoning:
    post:
      tags: [Semantic]
      summary: Apply reasoning rules
      description: Apply N3 reasoning rules to enhance template context
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                templateVars:
                  type: object
                  description: Template variables to enhance
                rules:
                  type: array
                  items:
                    type: string
                  description: N3 rule file paths or inline rules
                premises:
                  type: array
                  items:
                    type: string
                  description: Premise file paths
                options:
                  type: object
                  properties:
                    depth:
                      type: integer
                      minimum: 1
                      maximum: 10
                      default: 3
                    mode:
                      type: string
                      enum: [forward, backward, hybrid]
                      default: forward
              required: [templateVars, rules]
      responses:
        '200':
          description: Enhanced template context
          content:
            application/json:
              schema:
                type: object
                properties:
                  enhancedContext:
                    type: object
                    description: Enhanced template variables
                  inferences:
                    type: array
                    items:
                      $ref: '#/components/schemas/Inference'
                  insights:
                    type: object
                    properties:
                      recommendations:
                        type: array
                        items:
                          type: object
                          properties:
                            type:
                              type: string
                            message:
                              type: string

  # MCP Server Integration APIs
  /mcp/servers:
    get:
      tags: [MCP]
      summary: List MCP servers
      description: List all configured MCP servers and their status
      responses:
        '200':
          description: MCP server information
          content:
            application/json:
              schema:
                type: object
                properties:
                  servers:
                    type: array
                    items:
                      $ref: '#/components/schemas/MCPServer'
              example:
                servers:
                  - name: claude-flow
                    status: connected
                    url: npx claude-flow@alpha mcp start
                    capabilities: [agent_management, task_orchestration, memory_management]
                    lastHealthCheck: "2025-01-07T02:32:26.932Z"
                  - name: ruv-swarm
                    status: connected
                    url: npx ruv-swarm@latest mcp
                    capabilities: [neural_processing, swarm_intelligence, daa]
                  - name: flow-nexus
                    status: connected
                    url: npx @ruv/flow-nexus mcp start
                    capabilities: [enterprise_deployment, sandbox_management, user_management]

  /mcp/servers/{serverName}/health:
    get:
      tags: [MCP]
      summary: Check MCP server health
      description: Check the health status of a specific MCP server
      parameters:
        - name: serverName
          in: path
          required: true
          schema:
            type: string
          example: claude-flow
      responses:
        '200':
          description: Server health status
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    enum: [healthy, degraded, unhealthy]
                  latency:
                    type: integer
                    description: Response latency in milliseconds
                  capabilities:
                    type: array
                    items:
                      type: string
                  lastCheck:
                    type: string
                    format: date-time

  # Agent Management APIs
  /agents/swarm:
    post:
      tags: [Agents]
      summary: Initialize agent swarm
      description: Initialize a new agent swarm with specified topology
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                topology:
                  type: string
                  enum: [hierarchical, mesh, ring, star]
                  description: Swarm topology type
                maxAgents:
                  type: integer
                  minimum: 1
                  maximum: 100
                  default: 8
                strategy:
                  type: string
                  enum: [balanced, specialized, adaptive]
                  default: balanced
              required: [topology]
      responses:
        '201':
          description: Swarm initialized successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  swarmId:
                    type: string
                    example: swarm-1757212346928
                  topology:
                    type: string
                  agents:
                    type: array
                    items:
                      $ref: '#/components/schemas/Agent'
                  status:
                    type: string
                    enum: [initializing, active, scaling, terminated]

  /agents/swarm/{swarmId}:
    get:
      tags: [Agents]
      summary: Get swarm status
      description: Retrieve current status and details of a swarm
      parameters:
        - name: swarmId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Swarm status information
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SwarmStatus'

    delete:
      tags: [Agents]
      summary: Destroy swarm
      description: Terminate a swarm and clean up resources
      parameters:
        - name: swarmId
          in: path
          required: true
          schema:
            type: string
      responses:
        '204':
          description: Swarm destroyed successfully

  /agents:
    get:
      tags: [Agents]
      summary: List agents
      description: List all active agents across swarms
      parameters:
        - name: swarmId
          in: query
          description: Filter by swarm ID
          schema:
            type: string
        - name: type
          in: query
          description: Filter by agent type
          schema:
            type: string
            enum: [researcher, coder, tester, reviewer, analyst, optimizer]
        - name: status
          in: query
          description: Filter by agent status
          schema:
            type: string
            enum: [idle, busy, error, offline]
      responses:
        '200':
          description: List of agents
          content:
            application/json:
              schema:
                type: object
                properties:
                  agents:
                    type: array
                    items:
                      $ref: '#/components/schemas/Agent'

    post:
      tags: [Agents]
      summary: Spawn new agent
      description: Create a new agent with specified capabilities
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                type:
                  type: string
                  enum: [researcher, coder, tester, reviewer, analyst, optimizer, coordinator, specialist]
                capabilities:
                  type: array
                  items:
                    type: string
                name:
                  type: string
                swarmId:
                  type: string
              required: [type]
      responses:
        '201':
          description: Agent spawned successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Agent'

  /agents/{agentId}/tasks:
    post:
      tags: [Agents]
      summary: Assign task to agent
      description: Assign a specific task to an agent
      parameters:
        - name: agentId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                task:
                  type: string
                  description: Task description
                priority:
                  type: string
                  enum: [low, medium, high, critical]
                  default: medium
                dependencies:
                  type: array
                  items:
                    type: string
                  description: Task dependencies
                timeout:
                  type: integer
                  description: Task timeout in milliseconds
              required: [task]
      responses:
        '201':
          description: Task assigned successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Task'

  # Performance Monitoring APIs
  /performance/metrics:
    get:
      tags: [Performance]
      summary: Get performance metrics
      description: Retrieve current performance metrics and statistics
      parameters:
        - name: component
          in: query
          description: Filter by system component
          schema:
            type: string
            enum: [template, semantic, mcp, agents, system]
        - name: timeframe
          in: query
          description: Metrics timeframe
          schema:
            type: string
            enum: [1m, 5m, 15m, 1h, 24h, 7d]
            default: 1h
        - name: format
          in: query
          description: Output format
          schema:
            type: string
            enum: [json, prometheus, csv]
            default: json
      responses:
        '200':
          description: Performance metrics
          content:
            application/json:
              schema:
                type: object
                properties:
                  timestamp:
                    type: string
                    format: date-time
                  metrics:
                    type: object
                    properties:
                      cpu:
                        $ref: '#/components/schemas/CPUMetrics'
                      memory:
                        $ref: '#/components/schemas/MemoryMetrics'
                      disk:
                        $ref: '#/components/schemas/DiskMetrics'
                      network:
                        $ref: '#/components/schemas/NetworkMetrics'
                      application:
                        $ref: '#/components/schemas/ApplicationMetrics'

  /performance/benchmark:
    post:
      tags: [Performance]
      summary: Run performance benchmark
      description: Execute performance benchmarks on specified operations
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                suite:
                  type: string
                  enum: [all, template, semantic, agents, system]
                  default: all
                iterations:
                  type: integer
                  minimum: 1
                  maximum: 1000
                  default: 10
                warmup:
                  type: integer
                  minimum: 0
                  maximum: 100
                  default: 3
                dataset:
                  type: string
                  description: Test dataset path
              required: [suite]
      responses:
        '200':
          description: Benchmark results
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BenchmarkResult'

  # Configuration APIs
  /config:
    get:
      tags: [Configuration]
      summary: Get system configuration
      description: Retrieve current system configuration
      parameters:
        - name: section
          in: query
          description: Configuration section
          schema:
            type: string
            enum: [templates, semantic, mcp, performance, development, build]
      responses:
        '200':
          description: System configuration
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemConfiguration'

    put:
      tags: [Configuration]
      summary: Update configuration
      description: Update system configuration settings
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ConfigurationUpdate'
      responses:
        '200':
          description: Configuration updated successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  updated:
                    type: array
                    items:
                      type: string
                  warnings:
                    type: array
                    items:
                      type: string

  # Hooks and Automation APIs
  /hooks:
    get:
      tags: [Hooks]
      summary: List configured hooks
      description: List all configured automation hooks
      parameters:
        - name: type
          in: query
          description: Filter by hook type
          schema:
            type: string
            enum: [pre-task, post-task, pre-edit, post-edit, agent-assign, notify]
      responses:
        '200':
          description: List of configured hooks
          content:
            application/json:
              schema:
                type: object
                properties:
                  hooks:
                    type: array
                    items:
                      $ref: '#/components/schemas/Hook'

  /hooks/execute:
    post:
      tags: [Hooks]
      summary: Execute hook
      description: Manually execute a specific hook
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                hookName:
                  type: string
                  example: pre-task
                parameters:
                  type: object
                  description: Hook-specific parameters
                context:
                  type: object
                  description: Execution context
              required: [hookName]
      responses:
        '200':
          description: Hook executed successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  result:
                    type: object
                  executionTime:
                    type: integer
                    description: Execution time in milliseconds

components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
      description: API key for authentication
    
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT bearer token authentication

  schemas:
    Generator:
      type: object
      properties:
        name:
          type: string
          example: component
        description:
          type: string
          example: Frontend component generators
        category:
          type: string
          enum: [frontend, backend, fullstack, mobile, data, infrastructure]
        templates:
          type: array
          items:
            $ref: '#/components/schemas/Template'
        metadata:
          type: object

    Template:
      type: object
      properties:
        name:
          type: string
          example: react
        description:
          type: string
          example: React component with TypeScript
        variables:
          type: array
          items:
            type: string
        metadata:
          type: object
        examples:
          type: array
          items:
            type: object

    TemplateVariable:
      type: object
      properties:
        name:
          type: string
        type:
          type: string
          enum: [string, number, boolean, array, object]
        required:
          type: boolean
          default: false
        description:
          type: string
        default:
          description: Default value
        validation:
          type: string
          description: Validation regex or rule
        examples:
          type: array
          items:
            type: string

    GenerateRequest:
      type: object
      properties:
        generator:
          type: string
          example: component
        template:
          type: string
          example: react
        variables:
          type: object
          example:
            name: UserProfile
            props: [id, name, email]
        destination:
          type: string
          example: ./src/components
        options:
          type: object
          properties:
            force:
              type: boolean
              default: false
            dry:
              type: boolean
              default: false
            backup:
              type: boolean
              default: false
            validate:
              type: boolean
              default: true
      required: [generator, template]

    GenerateResponse:
      type: object
      properties:
        success:
          type: boolean
        files:
          type: array
          items:
            $ref: '#/components/schemas/GeneratedFile'
        duration:
          type: integer
          description: Generation time in milliseconds
        warnings:
          type: array
          items:
            type: string
        metadata:
          type: object

    GeneratedFile:
      type: object
      properties:
        path:
          type: string
        size:
          type: integer
          description: File size in bytes
        checksum:
          type: string
          description: File checksum (SHA-256)
        encoding:
          type: string
          default: utf8
        permissions:
          type: string
          description: File permissions (octal)
        metadata:
          type: object

    SemanticValidateRequest:
      type: object
      properties:
        templatePath:
          type: string
        rdfData:
          type: string
          description: Inline RDF data
        schemaPath:
          type: string
        ontologies:
          type: array
          items:
            type: string
        compliance:
          type: array
          items:
            type: string
            enum: [GDPR, HIPAA, SOX, FHIR, FIBO, GS1, API_GOVERNANCE]
        options:
          type: object
          properties:
            strictMode:
              type: boolean
              default: false
            outputFormat:
              type: string
              enum: [json, turtle, summary]
              default: json

    ValidationResult:
      type: object
      properties:
        valid:
          type: boolean
        score:
          type: number
          minimum: 0
          maximum: 100
          description: Quality score
        errors:
          type: array
          items:
            $ref: '#/components/schemas/ValidationError'
        warnings:
          type: array
          items:
            $ref: '#/components/schemas/ValidationWarning'
        compliance:
          type: object
          properties:
            framework:
              type: string
            status:
              type: string
              enum: [compliant, non-compliant, partial]
            issues:
              type: array
              items:
                type: string
        metrics:
          type: object
          properties:
            triplesValidated:
              type: integer
            executionTime:
              type: integer
            memoryUsage:
              type: integer

    ValidationError:
      type: object
      properties:
        code:
          type: string
        message:
          type: string
        severity:
          type: string
          enum: [error, warning, info]
        location:
          type: object
          properties:
            line:
              type: integer
            column:
              type: integer
            triple:
              type: string
        suggestion:
          type: string

    ValidationWarning:
      type: object
      properties:
        code:
          type: string
        message:
          type: string
        location:
          type: object
        suggestion:
          type: string

    QueryResult:
      type: object
      properties:
        bindings:
          type: array
          items:
            type: object
        resultCount:
          type: integer
        executionTime:
          type: integer
        metadata:
          type: object
          properties:
            tripleCount:
              type: integer
            optimized:
              type: boolean
            cacheHit:
              type: boolean
        insights:
          type: object
          properties:
            recommendations:
              type: array
              items:
                type: object

    Inference:
      type: object
      properties:
        subject:
          type: string
        predicate:
          type: string
        object:
          type: string
        confidence:
          type: number
          minimum: 0
          maximum: 1
        derivation:
          type: array
          items:
            type: string

    MCPServer:
      type: object
      properties:
        name:
          type: string
        status:
          type: string
          enum: [connected, disconnected, error, initializing]
        url:
          type: string
        capabilities:
          type: array
          items:
            type: string
        lastHealthCheck:
          type: string
          format: date-time
        version:
          type: string
        metrics:
          type: object

    Agent:
      type: object
      properties:
        id:
          type: string
        type:
          type: string
        name:
          type: string
        status:
          type: string
          enum: [idle, busy, error, offline]
        capabilities:
          type: array
          items:
            type: string
        swarmId:
          type: string
        currentTask:
          type: string
        performance:
          type: object
          properties:
            tasksCompleted:
              type: integer
            averageExecutionTime:
              type: number
            successRate:
              type: number
        lastActivity:
          type: string
          format: date-time

    SwarmStatus:
      type: object
      properties:
        id:
          type: string
        topology:
          type: string
        status:
          type: string
          enum: [initializing, active, scaling, terminating, terminated]
        agentCount:
          type: integer
        activeAgents:
          type: integer
        agents:
          type: array
          items:
            $ref: '#/components/schemas/Agent'
        performance:
          type: object
        created:
          type: string
          format: date-time

    Task:
      type: object
      properties:
        id:
          type: string
        description:
          type: string
        status:
          type: string
          enum: [pending, running, completed, failed, cancelled]
        priority:
          type: string
          enum: [low, medium, high, critical]
        assignedAgent:
          type: string
        dependencies:
          type: array
          items:
            type: string
        progress:
          type: number
          minimum: 0
          maximum: 1
        result:
          type: object
        error:
          type: string
        created:
          type: string
          format: date-time
        started:
          type: string
          format: date-time
        completed:
          type: string
          format: date-time

    CPUMetrics:
      type: object
      properties:
        usage:
          type: number
          description: CPU usage percentage
        cores:
          type: integer
        loadAverage:
          type: array
          items:
            type: number
        processes:
          type: integer

    MemoryMetrics:
      type: object
      properties:
        total:
          type: integer
          description: Total memory in bytes
        used:
          type: integer
          description: Used memory in bytes
        free:
          type: integer
          description: Free memory in bytes
        usage:
          type: number
          description: Memory usage percentage
        heap:
          type: object
          properties:
            used:
              type: integer
            total:
              type: integer
            limit:
              type: integer

    DiskMetrics:
      type: object
      properties:
        total:
          type: integer
        used:
          type: integer
        free:
          type: integer
        usage:
          type: number
        iops:
          type: object
          properties:
            read:
              type: number
            write:
              type: number

    NetworkMetrics:
      type: object
      properties:
        bytesIn:
          type: integer
        bytesOut:
          type: integer
        packetsIn:
          type: integer
        packetsOut:
          type: integer
        connections:
          type: integer
        errors:
          type: integer

    ApplicationMetrics:
      type: object
      properties:
        requestsPerSecond:
          type: number
        averageResponseTime:
          type: number
        errorRate:
          type: number
        activeConnections:
          type: integer
        templatesGenerated:
          type: integer
        semanticOperations:
          type: integer

    BenchmarkResult:
      type: object
      properties:
        suite:
          type: string
        iterations:
          type: integer
        results:
          type: object
          properties:
            averageTime:
              type: number
            minTime:
              type: number
            maxTime:
              type: number
            throughput:
              type: number
            successRate:
              type: number
        timestamp:
          type: string
          format: date-time
        environment:
          type: object
          properties:
            nodeVersion:
              type: string
            platform:
              type: string
            arch:
              type: string
            memory:
              type: integer

    SystemConfiguration:
      type: object
      properties:
        templates:
          type: object
        semantic:
          type: object
        mcp:
          type: object
        performance:
          type: object
        development:
          type: object
        build:
          type: object
        plugins:
          type: array
          items:
            type: object

    ConfigurationUpdate:
      type: object
      properties:
        section:
          type: string
        changes:
          type: object
        merge:
          type: boolean
          default: true
          description: Whether to merge with existing config

    Hook:
      type: object
      properties:
        name:
          type: string
        type:
          type: string
          enum: [pre-task, post-task, pre-edit, post-edit, agent-assign, notify]
        enabled:
          type: boolean
        triggers:
          type: array
          items:
            type: string
        actions:
          type: array
          items:
            type: object
        metadata:
          type: object

  responses:
    BadRequest:
      description: Bad request - invalid parameters
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: string
                example: Invalid request parameters
              code:
                type: string
                example: BAD_REQUEST
              details:
                type: object

    Unauthorized:
      description: Unauthorized - invalid or missing authentication
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: string
                example: Authentication required
              code:
                type: string
                example: UNAUTHORIZED

    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: string
                example: Resource not found
              code:
                type: string
                example: NOT_FOUND

    InternalError:
      description: Internal server error
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: string
                example: Internal server error
              code:
                type: string
                example: INTERNAL_ERROR
              requestId:
                type: string

  examples:
    ReactComponentGeneration:
      summary: Generate React component
      description: Example of generating a React component with TypeScript and tests
      value:
        generator: component
        template: react
        variables:
          name: UserProfile
          props: [id, name, email, avatar]
          withTests: true
          withStories: true
          typescript: true
        destination: ./src/components
        options:
          force: false
          backup: true

    SemanticValidation:
      summary: Validate RDF data
      description: Example of validating RDF data against GDPR compliance
      value:
        rdfData: |
          @prefix ex: <https://example.org/> .
          ex:User a ex:Person ;
            ex:name "John Doe" ;
            ex:email "john@example.com" ;
            ex:ssn "123-45-6789" .
        compliance: [GDPR]
        options:
          strictMode: true
          outputFormat: json

    SwarmInitialization:
      summary: Initialize agent swarm
      description: Example of initializing a mesh topology swarm
      value:
        topology: mesh
        maxAgents: 10
        strategy: adaptive

webhooks:
  TaskCompleted:
    post:
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                event:
                  type: string
                  example: task.completed
                taskId:
                  type: string
                agentId:
                  type: string
                result:
                  type: object
                timestamp:
                  type: string
                  format: date-time
      responses:
        '200':
          description: Webhook received successfully

  AlertTriggered:
    post:
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                event:
                  type: string
                  example: alert.triggered
                severity:
                  type: string
                  enum: [low, medium, high, critical]
                message:
                  type: string
                metric:
                  type: string
                threshold:
                  type: number
                currentValue:
                  type: number
                timestamp:
                  type: string
                  format: date-time
      responses:
        '200':
          description: Alert webhook received

x-code-samples:
  - lang: 'curl'
    source: |
      # Generate a React component
      curl -X POST https://api.unjucks.dev/v1/templates/generate \
        -H "Content-Type: application/json" \
        -H "X-API-Key: your-api-key" \
        -d '{
          "generator": "component",
          "template": "react",
          "variables": {
            "name": "UserProfile",
            "props": ["id", "name", "email"]
          },
          "destination": "./src/components"
        }'

  - lang: 'javascript'
    source: |
      // Node.js client example
      const UnjucksClient = require('@unjucks/client');
      
      const client = new UnjucksClient({
        apiKey: 'your-api-key',
        baseURL: 'https://api.unjucks.dev/v1'
      });
      
      async function generateComponent() {
        const result = await client.templates.generate({
          generator: 'component',
          template: 'react',
          variables: {
            name: 'UserProfile',
            props: ['id', 'name', 'email']
          },
          destination: './src/components'
        });
        
        console.log('Generated files:', result.files);
      }

  - lang: 'python'
    source: |
      # Python client example
      import unjucks
      
      client = unjucks.Client(
          api_key='your-api-key',
          base_url='https://api.unjucks.dev/v1'
      )
      
      result = client.templates.generate(
          generator='component',
          template='react',
          variables={
              'name': 'UserProfile',
              'props': ['id', 'name', 'email']
          },
          destination='./src/components'
      )
      
      print(f"Generated {len(result.files)} files")

x-tagGroups:
  - name: Core Operations
    tags:
      - Templates
      - Semantic
  - name: Infrastructure
    tags:
      - MCP
      - Agents
  - name: System Management
    tags:
      - Performance
      - Configuration
      - Hooks

x-logo:
  url: https://unjucks.dev/logo.png
  altText: Unjucks Logo

x-api-id: unjucks-api-v1
```

This OpenAPI specification provides comprehensive documentation for all Unjucks APIs, including examples, webhooks, and code samples in multiple languages.