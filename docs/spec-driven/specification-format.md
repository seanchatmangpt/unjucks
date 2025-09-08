# Specification Format and Best Practices

This comprehensive guide covers the complete specification format for Unjucks spec-driven development, including syntax, validation, and best practices.

## 📋 Specification Structure

Every Unjucks specification follows this basic structure:

```yaml
apiVersion: unjucks.dev/v1
kind: <SpecificationType>
metadata:
  name: string
  description: string
  version: string
  labels: {}
  annotations: {}

spec:
  # Type-specific configuration
```

## 🎯 Specification Types

### REST API Specification

Complete format for REST API applications:

```yaml
apiVersion: unjucks.dev/v1
kind: RestAPI
metadata:
  name: ecommerce-api
  description: E-commerce platform REST API
  version: 2.1.0
  labels:
    team: backend
    environment: production
  annotations:
    generated-by: unjucks
    last-updated: "2024-01-15"

spec:
  # Framework configuration
  framework: express | fastify | koa | nest
  language: typescript | javascript
  runtime: node | deno | bun
  
  # Database configuration
  database:
    type: postgresql | mysql | mongodb | sqlite
    host: "${DB_HOST:-localhost}"
    port: "${DB_PORT:-5432}"
    name: "${DB_NAME}"
    migrations: true
    seeds: true
    
  # Entity definitions
  entities:
    - name: User
      tableName: users  # Optional, defaults to lowercase plural
      fields:
        - name: id
          type: uuid
          primaryKey: true
          generated: true
        - name: email
          type: string
          unique: true
          validation:
            - email
            - maxLength: 255
        - name: password
          type: string
          hidden: true  # Exclude from serialization
          validation:
            - minLength: 8
            - pattern: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)"
        - name: profile
          type: object
          properties:
            firstName: { type: string, required: true }
            lastName: { type: string, required: true }
            avatar: { type: string, format: url }
        - name: roles
          type: array
          items: string
          default: ["user"]
        - name: createdAt
          type: datetime
          default: now
        - name: updatedAt
          type: datetime
          default: now
          onUpdate: now
      
      # Entity relationships
      relationships:
        - name: orders
          type: hasMany
          target: Order
          foreignKey: userId
        - name: profile
          type: hasOne
          target: UserProfile
          foreignKey: userId
      
      # Entity hooks/middleware
      hooks:
        beforeCreate:
          - hashPassword
        afterFind:
          - removePassword
      
      # Custom methods
      methods:
        - name: validatePassword
          type: instance
          parameters:
            - name: password
              type: string
          returns: boolean
        - name: findByEmail
          type: static
          parameters:
            - name: email
              type: string
          returns: User

  # API endpoint definitions
  endpoints:
    - path: /auth/login
      method: POST
      description: User authentication
      tags: [auth]
      security: none
      body:
        type: object
        properties:
          email: { type: string, validation: email }
          password: { type: string, validation: minLength:6 }
        required: [email, password]
      response:
        success:
          status: 200
          type: object
          properties:
            token: string
            user: User
            expiresAt: datetime
        error:
          - status: 401
            message: Invalid credentials
          - status: 400
            message: Validation error
      
    - path: /users
      method: GET
      description: List users with pagination
      tags: [users]
      security: bearer
      parameters:
        - name: page
          in: query
          type: integer
          default: 1
          validation: min:1
        - name: limit
          in: query
          type: integer
          default: 20
          validation: min:1,max:100
        - name: search
          in: query
          type: string
          description: Search in name and email
      response:
        success:
          status: 200
          type: object
          properties:
            data: { type: array, items: User }
            pagination:
              type: object
              properties:
                page: integer
                limit: integer
                total: integer
                pages: integer
      
    - path: /users/:id
      method: GET
      description: Get user by ID
      tags: [users]
      security: bearer
      parameters:
        - name: id
          in: path
          type: uuid
          required: true
      response:
        success:
          status: 200
          type: User
        error:
          - status: 404
            message: User not found
  
  # Middleware configuration
  middleware:
    - name: cors
      options:
        origin: ["http://localhost:3000"]
        credentials: true
    - name: helmet
    - name: morgan
      options:
        format: combined
    - name: rateLimit
      options:
        windowMs: 900000  # 15 minutes
        max: 100  # limit each IP to 100 requests per windowMs

  # Authentication & authorization
  authentication:
    type: jwt
    secret: "${JWT_SECRET}"
    expiresIn: 7d
    issuer: api.example.com
    
  authorization:
    roles:
      - name: admin
        permissions: ["*"]
      - name: user
        permissions: ["user:read", "user:update:own"]
      - name: guest
        permissions: ["auth:*"]

  # Validation configuration
  validation:
    engine: joi | yup | zod
    options:
      stripUnknown: true
      abortEarly: false

  # Error handling
  errorHandling:
    format: json
    includeStack: false  # in production
    logErrors: true
    
  # Testing configuration
  testing:
    framework: jest | vitest | tap
    coverage:
      threshold: 80
      reports: [text, html, lcov]
    e2e:
      framework: supertest | playwright
    mocking:
      database: true
      external: true

  # Documentation generation
  documentation:
    openapi:
      version: 3.0.0
      title: "${metadata.name}"
      description: "${metadata.description}"
    readme: true
    examples: true

  # Deployment configuration
  deployment:
    docker: true
    healthCheck: /health
    monitoring:
      metrics: prometheus
      logs: structured
    environment:
      - NODE_ENV
      - PORT
      - DATABASE_URL
      - JWT_SECRET
```

### Frontend Application Specification

For client-side applications:

```yaml
apiVersion: unjucks.dev/v1
kind: Frontend
metadata:
  name: ecommerce-web
  description: E-commerce web application
  version: 1.0.0

spec:
  framework: react | vue | angular | svelte | solid
  language: typescript | javascript
  bundler: vite | webpack | parcel | rollup
  
  # Styling configuration
  styling:
    framework: tailwind | styled-components | emotion | sass | css-modules
    theme:
      colors:
        primary: "#3b82f6"
        secondary: "#64748b"
        accent: "#f59e0b"
      fonts:
        sans: ["Inter", "system-ui", "sans-serif"]
        mono: ["JetBrains Mono", "monospace"]

  # State management
  stateManagement:
    library: redux | zustand | valtio | jotai
    persistence: localStorage | sessionStorage | indexedDB
    devtools: true

  # Routing configuration
  routing:
    library: react-router | vue-router | @reach/router
    mode: browser | hash | memory
    guards: true

  # Components structure
  components:
    - name: Layout
      type: layout
      props:
        children: ReactNode
    
    - name: Header
      type: component
      props:
        user: User
        onLogout: function
    
    - name: ProductCard
      type: component
      props:
        product: Product
        onAddToCart: function
      variants:
        - compact
        - detailed

  # Pages/Routes
  pages:
    - path: /
      component: HomePage
      title: Home
    
    - path: /products
      component: ProductsPage
      title: Products
      loader: fetchProducts
    
    - path: /products/:id
      component: ProductDetailPage
      title: Product Details
      loader: fetchProduct
      
    - path: /cart
      component: CartPage
      title: Shopping Cart
      protected: true

  # API integration
  api:
    baseUrl: "${API_BASE_URL}"
    timeout: 10000
    retries: 3
    interceptors:
      request: [addAuthToken]
      response: [handleErrors]

  # Testing
  testing:
    unit: vitest | jest
    integration: testing-library
    e2e: playwright | cypress
    coverage: 85
```

### Microservice Specification

For microservice architectures:

```yaml
apiVersion: unjucks.dev/v1
kind: Microservice
metadata:
  name: order-service
  description: Order processing microservice
  version: 1.2.0

spec:
  runtime: node | go | python | rust | java
  framework: express | fastapi | gin | actix | spring
  
  # Service mesh configuration
  serviceMesh:
    enabled: true
    type: istio | linkerd | consul
    
  # Communication
  communication:
    http:
      port: 3000
      basePath: /api/v1
    grpc:
      port: 50051
      protoFile: order.proto
    messaging:
      broker: rabbitmq | kafka | nats
      topics: [order.created, order.updated, order.cancelled]

  # Dependencies
  dependencies:
    services:
      - name: user-service
        endpoint: http://user-service:3000
        fallback: mock
      - name: inventory-service
        endpoint: http://inventory-service:3000
        circuit_breaker: true
    
    databases:
      - name: orders_db
        type: postgresql
        migrations: true
    
    external:
      - name: payment-gateway
        endpoint: https://api.stripe.com
        auth: api_key

  # Observability
  observability:
    metrics:
      provider: prometheus
      custom:
        - order_processing_duration
        - order_success_rate
    logging:
      level: info
      format: json
      correlation: true
    tracing:
      provider: jaeger
      sampling: 0.1

  # Deployment
  deployment:
    replicas: 3
    resources:
      memory: 512Mi
      cpu: 500m
    health:
      liveness: /health
      readiness: /ready
    scaling:
      min: 2
      max: 10
      cpu_threshold: 70
```

## 🎛️ Advanced Features

### Variable Interpolation

Use environment variables and expressions:

```yaml
spec:
  database:
    host: "${DB_HOST:-localhost}"
    port: "${DB_PORT:5432}"  # Default value
    url: "postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
    
  # Conditional configuration
  middleware:
    - name: cors
      enabled: "${NODE_ENV !== 'production'}"
    - name: compression
      enabled: "${NODE_ENV === 'production'}"
```

### Template Extensions

Extend specifications with custom templates:

```yaml
spec:
  extends: ["@unjucks/rest-api-base", "./common.spec.yaml"]
  
  # Override or extend base configuration
  entities:
    - name: CustomEntity
      extends: BaseEntity
      fields:
        - name: customField
          type: string
```

### Conditional Generation

Generate code conditionally:

```yaml
spec:
  features:
    authentication: true
    authorization: false
    caching: true
    
  entities:
    - name: User
      # Only generate if authentication is enabled
      condition: "features.authentication"
      
  middleware:
    - name: auth
      condition: "features.authentication && features.authorization"
```

## ✅ Validation Rules

### Built-in Validations

```yaml
fields:
  - name: email
    type: string
    validation:
      - email                    # Email format
      - required                 # Not null/undefined
      - unique                   # Unique in database
      - maxLength: 255          # Maximum length
      - minLength: 5            # Minimum length
      - pattern: "^[a-zA-Z]+$"  # Regex pattern
      - in: [value1, value2]    # Enum values
      - custom: validateEmail   # Custom function
```

### Custom Validations

```yaml
spec:
  validations:
    validateEmail:
      function: |
        function validateEmail(value) {
          const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return re.test(value);
        }
      message: "Invalid email format"
    
    strongPassword:
      function: |
        function strongPassword(value) {
          return value.length >= 8 && 
                 /[A-Z]/.test(value) && 
                 /[a-z]/.test(value) && 
                 /\d/.test(value);
        }
      message: "Password must be at least 8 characters with uppercase, lowercase, and numbers"
```

## 🏆 Best Practices

### 1. Specification Organization

```yaml
# ✅ Good: Clear, organized structure
metadata:
  name: user-management-api
  description: Handles user operations and authentication
  version: 1.0.0
  labels:
    domain: user-management
    team: backend-team

spec:
  # Group related configurations
  database: { ... }
  authentication: { ... }
  entities: [ ... ]
  endpoints: [ ... ]

# ❌ Bad: Flat, unclear structure
spec:
  framework: express
  dbType: postgres
  jwtSecret: secret
  userTable: users
```

### 2. Field Definitions

```yaml
# ✅ Good: Comprehensive field definition
fields:
  - name: email
    type: string
    description: User's primary email address
    unique: true
    index: true
    validation:
      - email
      - required
      - maxLength: 255
    example: "user@example.com"

# ❌ Bad: Minimal definition
fields:
  - name: email
    type: string
```

### 3. Endpoint Documentation

```yaml
# ✅ Good: Well-documented endpoint
endpoints:
  - path: /users/:id
    method: GET
    summary: Retrieve user by ID
    description: |
      Fetches a single user record by their unique identifier.
      Requires authentication and appropriate permissions.
    tags: [users, public-api]
    parameters:
      - name: id
        in: path
        type: uuid
        required: true
        description: Unique user identifier
        example: "123e4567-e89b-12d3-a456-426614174000"
    response:
      success:
        status: 200
        description: User found and returned
        schema: User
      error:
        - status: 404
          description: User not found
          schema: ErrorResponse

# ❌ Bad: Minimal documentation
endpoints:
  - path: /users/:id
    method: GET
    response: User
```

### 4. Environment Configuration

```yaml
# ✅ Good: Environment-aware configuration
spec:
  database:
    host: "${DB_HOST}"
    port: "${DB_PORT:5432}"
    ssl: "${NODE_ENV === 'production'}"
    
  cors:
    origin: "${CORS_ORIGIN:http://localhost:3000}"
    credentials: true
    
  rateLimit:
    windowMs: "${NODE_ENV === 'production' ? 900000 : 60000}"
    max: "${NODE_ENV === 'production' ? 100 : 1000}"

# ❌ Bad: Hardcoded values
spec:
  database:
    host: localhost
    port: 5432
  cors:
    origin: http://localhost:3000
```

### 5. Modular Specifications

```yaml
# ✅ Good: Modular, reusable specs
# common/auth.spec.yaml
authentication:
  type: jwt
  secret: "${JWT_SECRET}"
  expiresIn: 7d

# main.spec.yaml
apiVersion: unjucks.dev/v1
kind: RestAPI
metadata:
  name: my-api
extends:
  - ./common/auth.spec.yaml
  - ./common/database.spec.yaml

# ❌ Bad: Monolithic specification
apiVersion: unjucks.dev/v1
kind: RestAPI
spec:
  # Everything in one file...
```

## 🔍 Validation and Linting

### Specification Validation

```bash
# Validate syntax and structure
unjucks validate-spec api.spec.yaml

# Validate with specific rules
unjucks validate-spec api.spec.yaml --rules security,performance

# Continuous validation
unjucks validate-spec --watch api.spec.yaml
```

### Schema Validation

Unjucks provides JSON Schema validation for all specification types:

```bash
# Get schema for a specification type
unjucks schema RestAPI > restapi.schema.json

# Validate against schema
unjucks validate-spec --schema restapi.schema.json api.spec.yaml
```

## 📏 Specification Metrics

Track specification quality:

```bash
# Analyze specification completeness
unjucks analyze-spec api.spec.yaml

# Output:
# Completeness: 85%
# Documentation Coverage: 92%
# Test Coverage Potential: 78%
# Security Score: 90%
# Performance Score: 85%
```

## 🚀 Performance Considerations

### Large Specifications

For large specifications (100+ entities/endpoints):

```yaml
# Use pagination in generation
spec:
  generation:
    batchSize: 50
    parallel: true
    
  # Split into modules
  modules:
    - name: auth
      entities: [User, Role, Permission]
      endpoints: [/auth/*, /users/*]
    - name: orders
      entities: [Order, OrderItem]
      endpoints: [/orders/*]
```

### Memory Optimization

```yaml
# Optimize memory usage during generation
spec:
  generation:
    streaming: true
    cache: false  # For very large specs
    compression: true
```

---

*Next: Learn how to [integrate spec-driven development](./integration-guide.md) with existing Unjucks projects.*