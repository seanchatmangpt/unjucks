# Best Practices for Spec-Driven Development

This guide outlines proven practices, patterns, and strategies for effective spec-driven development with Unjucks.

## 🎯 Specification Design Principles

### 1. Clarity and Simplicity

**✅ Good: Clear, descriptive specifications**
```yaml
apiVersion: unjucks.dev/v1
kind: RestAPI
metadata:
  name: user-management-api
  description: Handles user registration, authentication, and profile management
  version: 1.0.0

spec:
  entities:
    - name: User
      description: Represents a system user with authentication capabilities
      fields:
        - name: email
          type: string
          description: User's primary email address for authentication
          unique: true
          validation: [email, required]
        - name: hashedPassword
          type: string
          description: Securely hashed password using bcrypt
          hidden: true
```

**❌ Bad: Ambiguous, unclear specifications**
```yaml
spec:
  entities:
    - name: U
      fields:
        - name: e
          type: string
        - name: p
          type: string
```

### 2. Single Responsibility

**✅ Good: Focused, cohesive specifications**
```yaml
# user-service.spec.yaml - Handles only user-related operations
spec:
  entities: [User, UserProfile, UserSession]
  endpoints:
    - /users
    - /auth
    - /profile

# order-service.spec.yaml - Handles only order-related operations  
spec:
  entities: [Order, OrderItem, OrderStatus]
  endpoints:
    - /orders
    - /checkout
```

**❌ Bad: Monolithic specifications**
```yaml
# everything.spec.yaml - Tries to handle everything
spec:
  entities: [User, Product, Order, Category, Review, Payment, Shipping, Analytics, Settings, ...]
```

### 3. Consistency and Standards

**✅ Good: Consistent naming and patterns**
```yaml
spec:
  entities:
    - name: User          # PascalCase for entities
      fields:
        - name: firstName # camelCase for fields
          type: string
        - name: lastName
          type: string
    
  endpoints:
    - path: /users        # kebab-case for URLs
      method: GET
    - path: /user-profiles
      method: GET
```

**❌ Bad: Inconsistent naming**
```yaml
spec:
  entities:
    - name: user          # Inconsistent casing
      fields:
        - name: first_name # Mixed naming conventions
        - name: LastName
    
  endpoints:
    - path: /Users        # Inconsistent URL patterns
    - path: /user_profiles
```

## 🏗️ Architecture Best Practices

### 1. Domain-Driven Design

Organize specifications around business domains:

```
specs/
├── user-domain/
│   ├── user-service.spec.yaml
│   ├── auth-service.spec.yaml
│   └── profile-service.spec.yaml
├── product-domain/
│   ├── catalog-service.spec.yaml
│   ├── inventory-service.spec.yaml
│   └── review-service.spec.yaml
└── order-domain/
    ├── order-service.spec.yaml
    ├── payment-service.spec.yaml
    └── shipping-service.spec.yaml
```

### 2. Bounded Contexts

Define clear boundaries between services:

```yaml
# user-service.spec.yaml
spec:
  bounded_context: user-management
  entities:
    - name: User
      fields:
        - name: id
        - name: email
        - name: profile
  
  # Only expose necessary data to other contexts
  external_contracts:
    - name: UserSummary
      fields: [id, email, displayName]
      consumers: [order-service, notification-service]
```

### 3. Event-Driven Architecture

Design for asynchronous communication:

```yaml
spec:
  events:
    published:
      - name: UserRegistered
        schema:
          userId: uuid
          email: string
          timestamp: datetime
        
      - name: UserProfileUpdated
        schema:
          userId: uuid
          changes: object
          timestamp: datetime
    
    subscribed:
      - name: OrderCreated
        handler: sendWelcomeEmail
      - name: PaymentProcessed
        handler: updateUserSpending
```

## 📋 Specification Organization

### 1. Modular Specifications

Break large specifications into manageable modules:

```yaml
# main.spec.yaml
apiVersion: unjucks.dev/v1
kind: RestAPI
metadata:
  name: ecommerce-api

extends:
  - ./modules/auth.spec.yaml
  - ./modules/products.spec.yaml
  - ./modules/orders.spec.yaml
  - ./modules/common.spec.yaml

spec:
  # Main configuration
  framework: express
  database: postgresql
```

```yaml
# modules/auth.spec.yaml
authentication:
  type: jwt
  secret: "${JWT_SECRET}"
  expiresIn: 7d

entities:
  - name: User
    # User entity definition
  - name: Session
    # Session entity definition

endpoints:
  - path: /auth/login
    # Auth endpoints
```

### 2. Configuration Management

Use environment-specific configurations:

```yaml
# base.spec.yaml
spec:
  database:
    type: postgresql
    host: "${DB_HOST}"
    port: "${DB_PORT:5432}"
    
  redis:
    host: "${REDIS_HOST}"
    port: "${REDIS_PORT:6379}"
```

```yaml
# environments/development.spec.yaml
extends: ../base.spec.yaml
spec:
  database:
    host: localhost
    logging: true
    
  logging:
    level: debug
    
  cors:
    origin: ["http://localhost:3000"]
```

```yaml
# environments/production.spec.yaml
extends: ../base.spec.yaml
spec:
  database:
    ssl: true
    pool:
      min: 10
      max: 100
      
  logging:
    level: warn
    
  security:
    rateLimit:
      windowMs: 900000
      max: 100
```

### 3. Version Management

Plan for specification evolution:

```yaml
# v1/api.spec.yaml
apiVersion: unjucks.dev/v1
metadata:
  version: 1.0.0
  compatibility:
    - v1.0.x
  deprecated: false
  sunset: null

spec:
  endpoints:
    - path: /api/v1/users
      version: v1
      deprecated: false
```

```yaml
# v2/api.spec.yaml
apiVersion: unjucks.dev/v1
metadata:
  version: 2.0.0
  compatibility:
    - v2.0.x
  deprecated: false
  migrationFrom: v1

spec:
  endpoints:
    - path: /api/v2/users
      version: v2
      changes:
        - added: pagination
        - added: filtering
        - changed: response_format
```

## 🔒 Security Best Practices

### 1. Authentication and Authorization

```yaml
spec:
  authentication:
    type: jwt
    secret: "${JWT_SECRET}"
    algorithm: HS256
    expiresIn: 15m
    refreshToken:
      enabled: true
      expiresIn: 7d
      
  authorization:
    rbac:
      enabled: true
      roles:
        - name: admin
          permissions: ["*"]
        - name: user
          permissions: ["user:read:own", "user:update:own"]
        - name: guest
          permissions: ["auth:login", "auth:register"]

  endpoints:
    - path: /admin/users
      method: GET
      security:
        roles: [admin]
        permissions: ["user:read:all"]
        
    - path: /users/:id
      method: PUT
      security:
        roles: [user, admin]
        permissions: ["user:update:own"]
        ownershipCheck: "params.id === user.id || user.role === 'admin'"
```

### 2. Input Validation and Sanitization

```yaml
spec:
  validation:
    engine: joi
    options:
      stripUnknown: true
      abortEarly: false
      
  entities:
    - name: User
      fields:
        - name: email
          type: string
          validation:
            - email
            - required
            - maxLength: 255
            - sanitize: normalizeEmail
            
        - name: password
          type: string
          validation:
            - required
            - minLength: 8
            - pattern: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])"
            - custom: passwordStrength
            
        - name: bio
          type: text
          validation:
            - maxLength: 1000
            - sanitize: [stripHtml, trim]
```

### 3. Rate Limiting and Protection

```yaml
spec:
  middleware:
    - name: rateLimit
      options:
        windowMs: 900000  # 15 minutes
        max: 100
        standardHeaders: true
        legacyHeaders: false
        
    - name: helmet
      options:
        contentSecurityPolicy:
          directives:
            defaultSrc: ["'self'"]
            scriptSrc: ["'self'", "'unsafe-inline'"]
            styleSrc: ["'self'", "'unsafe-inline'"]
            
    - name: cors
      options:
        origin: ["${ALLOWED_ORIGINS}"]
        credentials: true
        optionsSuccessStatus: 200
```

## 🚀 Performance Best Practices

### 1. Database Optimization

```yaml
spec:
  database:
    connection:
      pool:
        min: 5
        max: 20
        acquireTimeoutMillis: 30000
        idleTimeoutMillis: 600000
        
  entities:
    - name: User
      indexes:
        - fields: [email]
          unique: true
        - fields: [createdAt]
          type: btree
        - fields: [status, createdAt]
          type: composite
          
    - name: Product
      fields:
        - name: searchVector
          type: tsvector
          generated: "to_tsvector('english', name || ' ' || description)"
      indexes:
        - fields: [searchVector]
          type: gin
```

### 2. Caching Strategy

```yaml
spec:
  caching:
    redis:
      host: "${REDIS_HOST}"
      port: 6379
      db: 0
      
    strategies:
      - name: userProfile
        key: "user:profile:${userId}"
        ttl: 3600
        invalidateOn: [UserUpdated]
        
      - name: productCatalog
        key: "products:category:${categoryId}"
        ttl: 1800
        invalidateOn: [ProductAdded, ProductUpdated, ProductDeleted]
        
  endpoints:
    - path: /users/:id
      method: GET
      cache:
        strategy: userProfile
        vary: [authorization]
        
    - path: /products
      method: GET
      cache:
        strategy: productCatalog
        vary: [category, page, limit]
```

### 3. API Response Optimization

```yaml
spec:
  endpoints:
    - path: /users
      method: GET
      parameters:
        - name: fields
          in: query
          description: "Comma-separated list of fields to include"
          example: "id,name,email"
          
        - name: expand
          in: query
          description: "Expand related entities"
          example: "profile,orders"
          
      pagination:
        type: cursor
        defaultLimit: 20
        maxLimit: 100
        
      response:
        compression: gzip
        minify: true
```

## 🧪 Testing Best Practices

### 1. Comprehensive Test Strategy

```yaml
spec:
  testing:
    unit:
      framework: jest
      coverage:
        threshold: 90
        statements: 90
        branches: 85
        functions: 90
        lines: 90
        
    integration:
      framework: supertest
      database: test-containers
      cleanup: after-each
      
    e2e:
      framework: playwright
      environments: [chrome, firefox, safari]
      
    performance:
      framework: artillery
      scenarios:
        - name: user-registration
          weight: 30
          flow: [register, verify, login]
        - name: product-browsing
          weight: 70
          flow: [browse, search, view-details]
```

### 2. Test Data Management

```yaml
spec:
  testing:
    fixtures:
      - name: users
        factory: UserFactory
        traits: [admin, regular, inactive]
        
      - name: products
        factory: ProductFactory
        traits: [featured, discounted, out-of-stock]
        
    seeds:
      development:
        - users: 100
        - products: 1000
        - orders: 500
        
      test:
        - users: 10
        - products: 50
        - orders: 20
```

### 3. Contract Testing

```yaml
spec:
  contracts:
    - name: UserAPI
      consumer: frontend-app
      producer: user-service
      interactions:
        - description: "Get user profile"
          request:
            method: GET
            path: /users/123
          response:
            status: 200
            body:
              id: 123
              name: "John Doe"
              email: "john@example.com"
```

## 🔄 Development Workflow

### 1. Specification-First Development

```bash
# 1. Define specification
unjucks create-spec --interactive --type rest-api

# 2. Validate specification
unjucks validate-spec api.spec.yaml --strict --suggestions

# 3. Generate code and tests
unjucks generate-from-spec api.spec.yaml --output ./src --components all

# 4. Implement business logic
# Edit generated files, add custom logic

# 5. Run tests
npm test

# 6. Iterate on specification
# Update api.spec.yaml based on learnings

# 7. Regenerate with merge
unjucks generate-from-spec api.spec.yaml --output ./src --merge
```

### 2. Continuous Integration

```yaml
# .github/workflows/spec-driven-ci.yml
name: Spec-Driven CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  validate-specs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Validate Specifications
        run: |
          unjucks validate-spec specs/*.spec.yaml --strict
          unjucks validate-spec specs/*.spec.yaml --suggestions > validation-report.txt
          
      - name: Upload Validation Report
        uses: actions/upload-artifact@v3
        with:
          name: validation-report
          path: validation-report.txt

  generate-code:
    needs: validate-specs
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Generate Code
        run: unjucks generate-from-spec specs/api.spec.yaml --output ./src
        
      - name: Check for Changes
        run: |
          git diff --exit-code || (echo "Generated code differs from committed code" && exit 1)

  test:
    needs: generate-code
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Test Environment
        run: |
          docker-compose -f docker-compose.test.yml up -d
          
      - name: Run Tests
        run: |
          npm run test:unit
          npm run test:integration
          npm run test:e2e
          
      - name: Upload Coverage
        uses: codecov/codecov-action@v3
```

### 3. Code Review Process

```markdown
# Code Review Checklist for Spec-Driven Development

## Specification Review
- [ ] Specification follows naming conventions
- [ ] All entities have proper validation rules
- [ ] Security requirements are defined
- [ ] Performance considerations are addressed
- [ ] Documentation is comprehensive

## Generated Code Review
- [ ] Generated code compiles without errors
- [ ] Tests pass with adequate coverage
- [ ] Custom business logic is preserved
- [ ] Security implementations are correct
- [ ] Performance is acceptable

## Integration Review
- [ ] API contracts are maintained
- [ ] Database migrations are safe
- [ ] External integrations work correctly
- [ ] Error handling is comprehensive
- [ ] Logging and monitoring are adequate
```

## 📊 Quality Assurance

### 1. Specification Quality Metrics

```bash
# Analyze specification quality
unjucks analyze-spec api.spec.yaml --metrics

# Output includes:
# - Completeness score
# - Documentation coverage
# - Complexity metrics
# - Security score
# - Performance indicators
```

### 2. Code Quality Gates

```yaml
# quality-gates.config.yaml
gates:
  specification:
    validation: strict
    documentation: 90%
    security: 95%
    
  generation:
    compilation: required
    linting: error-free
    formatting: enforced
    
  testing:
    coverage: 85%
    unit: required
    integration: required
    e2e: required
    
  security:
    vulnerabilities: none
    dependencies: up-to-date
    secrets: not-hardcoded
```

### 3. Performance Monitoring

```yaml
spec:
  monitoring:
    metrics:
      - name: response_time
        type: histogram
        labels: [endpoint, method]
        
      - name: error_rate
        type: counter
        labels: [endpoint, error_type]
        
      - name: throughput
        type: gauge
        labels: [endpoint]
        
    alerts:
      - name: high_error_rate
        condition: error_rate > 5%
        duration: 5m
        
      - name: slow_response
        condition: response_time_p95 > 1000ms
        duration: 2m
```

## 🚀 Advanced Patterns

### 1. Multi-Tenant Architecture

```yaml
spec:
  multiTenancy:
    strategy: database-per-tenant
    isolation: schema
    
  entities:
    - name: User
      tenantKey: organizationId
      fields:
        - name: organizationId
          type: uuid
          index: true
          required: true
          
  middleware:
    - name: tenantResolver
      options:
        headerName: X-Tenant-ID
        fallback: subdomain
```

### 2. API Versioning

```yaml
spec:
  versioning:
    strategy: url-path
    defaultVersion: v1
    supportedVersions: [v1, v2]
    
  endpoints:
    - path: /api/v1/users
      version: v1
      deprecated: true
      sunsetDate: "2024-12-31"
      migrationGuide: "/docs/migration/v1-to-v2"
      
    - path: /api/v2/users
      version: v2
      changes:
        - added: ["pagination", "filtering"]
        - modified: ["response_format"]
        - removed: ["legacy_field"]
```

### 3. Event Sourcing

```yaml
spec:
  eventSourcing:
    enabled: true
    eventStore: postgresql
    
  aggregates:
    - name: User
      events:
        - UserRegistered
        - UserProfileUpdated
        - UserDeactivated
        
  events:
    - name: UserRegistered
      version: 1
      schema:
        userId: uuid
        email: string
        timestamp: datetime
        metadata: object
```

## 📚 Documentation Best Practices

### 1. Comprehensive Specification Documentation

```yaml
metadata:
  name: user-management-api
  description: |
    Comprehensive user management API that handles:
    - User registration and authentication
    - Profile management and updates
    - Role-based access control
    - Session management
    
  documentation:
    guides:
      - title: "Getting Started"
        path: "./docs/getting-started.md"
      - title: "Authentication Guide"
        path: "./docs/authentication.md"
    examples:
      - title: "User Registration"
        path: "./examples/registration.md"
```

### 2. Living Documentation

```bash
# Generate and update documentation automatically
unjucks generate-docs api.spec.yaml \
  --format openapi \
  --include-examples \
  --include-guides \
  --output ./docs

# Keep documentation in sync with specification
unjucks watch-spec api.spec.yaml --update-docs
```

### 3. Team Collaboration

```yaml
# .unjucks/team.yaml
team:
  roles:
    - name: architect
      responsibilities: [specification-design, architecture-decisions]
      members: [alice, bob]
      
    - name: developer
      responsibilities: [implementation, testing]
      members: [charlie, diana]
      
    - name: reviewer
      responsibilities: [code-review, quality-assurance]
      members: [eve, frank]
      
  workflow:
    specificationChanges:
      requiredApprovals: 2
      approvers: [architect]
      
    codeGeneration:
      automated: true
      reviewRequired: false
      
    customLogic:
      reviewRequired: true
      approvers: [reviewer]
```

---

*These best practices will help you build maintainable, scalable, and high-quality applications with spec-driven development. Continue refining your approach based on your team's specific needs and project requirements.*