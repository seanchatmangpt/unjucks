# Migration Guide from Traditional Development

This comprehensive guide helps you migrate from traditional development workflows to spec-driven development with Unjucks, covering strategies, tools, and best practices for a smooth transition.

## 🎯 Migration Overview

### What Changes?

**Before (Traditional Development):**
```
Requirements → Design → Code → Test → Deploy
     ↓
Manual coding, inconsistent patterns, documentation drift
```

**After (Spec-Driven Development):**
```
Requirements → Specification → Generation → Test → Deploy
     ↓
Automated generation, consistent patterns, living documentation
```

### Migration Benefits

- **🚀 Faster Development**: Reduce boilerplate coding by 60-80%
- **📐 Consistency**: Standardized patterns across all projects
- **📚 Living Documentation**: Specifications serve as up-to-date docs
- **🔄 Easier Maintenance**: Change spec, regenerate code
- **🤖 AI Integration**: Leverage AI for intelligent code generation
- **👥 Better Collaboration**: Shared understanding through specs

## 📊 Migration Assessment

Before starting, assess your current project:

```bash
# Analyze existing codebase for migration readiness
unjucks analyze-project . --migration-assessment

# Output:
# Migration Readiness Score: 8.2/10
# Recommended Strategy: Incremental
# Estimated Effort: 2-3 weeks
# Key Benefits: 65% code reduction, 40% faster development
# Risks: Medium (existing custom logic)
```

### Project Categories

#### ✅ High Migration Potential
- **REST APIs** with standard CRUD operations
- **Database-driven applications** with clear entity relationships
- **Microservices** with well-defined interfaces
- **New projects** starting from scratch

#### ⚠️ Medium Migration Potential
- **Legacy applications** with some technical debt
- **Monolithic applications** with mixed concerns
- **Projects with custom business logic**
- **Applications with complex integrations**

#### ❌ Low Migration Potential (Initially)
- **Highly customized legacy systems**
- **Applications with significant technical debt**
- **Projects with unclear requirements**
- **Systems with heavy vendor lock-in**

## 🚀 Migration Strategies

### Strategy 1: Greenfield Migration (New Projects)

**Best for**: New projects or complete rewrites

```bash
# Start with specification-first development
unjucks create-spec --interactive --type rest-api

# Generate complete project structure
unjucks generate-from-spec api.spec.yaml --output ./src --complete

# Setup development workflow
unjucks setup-workflow --spec-driven --testing --ci-cd
```

**Timeline**: 1-2 weeks
**Effort**: Low
**Risk**: Low

### Strategy 2: Incremental Migration (Recommended)

**Best for**: Existing projects with ongoing development

#### Phase 1: Foundation (Week 1-2)
```bash
# 1. Create specification from existing code
unjucks reverse-engineer ./src --output ./specs/current.spec.yaml

# 2. Validate and refine specification
unjucks validate-spec ./specs/current.spec.yaml --suggestions
unjucks refine-spec ./specs/current.spec.yaml --interactive

# 3. Setup parallel structure
mkdir src-new
unjucks generate-from-spec ./specs/current.spec.yaml --output ./src-new --compare ./src
```

#### Phase 2: New Features (Week 3-4)
```bash
# 4. Use spec-driven for new features only
unjucks add-feature ./specs/current.spec.yaml --feature user-profiles --output ./src-new

# 5. Gradually migrate existing features
unjucks migrate-feature ./src/auth --spec ./specs/current.spec.yaml --output ./src-new/auth
```

#### Phase 3: Full Migration (Week 5-6)
```bash
# 6. Complete migration and cleanup
unjucks complete-migration --from ./src --to ./src-new --spec ./specs/current.spec.yaml
mv ./src ./src-old
mv ./src-new ./src
```

**Timeline**: 6 weeks
**Effort**: Medium
**Risk**: Low-Medium

### Strategy 3: Hybrid Approach

**Best for**: Large, complex applications

Keep existing code while adding spec-driven capabilities:

```bash
# Setup hybrid configuration
unjucks init-hybrid --existing-src ./src --new-features-spec

# Generate new components with spec-driven approach
unjucks generate-from-spec new-features.spec.yaml --output ./src --merge
```

**Timeline**: Ongoing
**Effort**: Low (gradual)
**Risk**: Low

### Strategy 4: Service-by-Service Migration

**Best for**: Microservices architectures

```bash
# Migrate one service at a time
unjucks migrate-service user-service \
  --from ./services/user-service \
  --spec ./specs/user-service.spec.yaml \
  --strategy incremental
```

**Timeline**: 2-4 weeks per service
**Effort**: Medium
**Risk**: Low

## 🔧 Migration Tools and Utilities

### Reverse Engineering Tool

Convert existing code to specifications:

```bash
# Generate specification from existing Express.js API
unjucks reverse-engineer ./src \
  --type rest-api \
  --framework express \
  --output ./specs/generated.spec.yaml \
  --include-tests \
  --include-docs

# Advanced reverse engineering with AI
unjucks ai reverse-engineer ./src \
  --analyze-patterns \
  --suggest-improvements \
  --output ./specs/enhanced.spec.yaml
```

**Generated Specification Example:**
```yaml
# Auto-generated from existing code
apiVersion: unjucks.dev/v1
kind: RestAPI
metadata:
  name: user-api
  description: Generated from existing Express.js application
  version: 1.0.0
  generated:
    from: ./src
    tool: unjucks-reverse-engineer
    timestamp: "2024-01-15T10:00:00Z"
    analysis:
      routes_found: 12
      models_found: 3
      middleware_found: 5
      patterns_detected: ["rest", "mvc", "middleware-chain"]

spec:
  framework: express
  language: typescript
  
  # Detected from existing code structure
  entities:
    - name: User
      source_file: ./src/models/User.js
      fields:
        - name: id
          type: uuid
          primaryKey: true
          detected_from: "@PrimaryGeneratedColumn('uuid')"
        - name: email
          type: string
          unique: true
          validation: [email, required]
          detected_from: "@Column({ unique: true, type: 'varchar' })"
        # More fields...

  # Detected from route handlers
  endpoints:
    - path: /users
      method: GET
      source_file: ./src/routes/users.js
      handler: "userController.getAllUsers"
      detected_patterns:
        - pagination
        - filtering
        - sorting
    # More endpoints...

  # Detected middleware
  middleware:
    - name: cors
      detected_from: "app.use(cors())"
    - name: helmet
      detected_from: "app.use(helmet())"
    - name: morgan
      detected_from: "app.use(morgan('combined'))"
```

### Code Comparison Tool

Compare generated code with existing implementation:

```bash
# Compare generated code with existing
unjucks compare \
  --existing ./src \
  --generated ./src-new \
  --report ./migration-report.html \
  --highlight-differences
```

**Migration Report:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Migration Comparison Report</title>
</head>
<body>
  <h1>Code Migration Analysis</h1>
  
  <div class="summary">
    <h2>Summary</h2>
    <ul>
      <li>Files Compared: 45</li>
      <li>Identical: 12 (26.7%)</li>
      <li>Similar: 28 (62.2%)</li>
      <li>Different: 5 (11.1%)</li>
      <li>Lines Added: 234</li>
      <li>Lines Removed: 189</li>
      <li>Net Change: +45 lines</li>
    </ul>
  </div>

  <div class="improvements">
    <h2>Generated Improvements</h2>
    <ul>
      <li>✅ Added comprehensive input validation</li>
      <li>✅ Improved error handling consistency</li>
      <li>✅ Added OpenAPI documentation</li>
      <li>✅ Enhanced security middleware</li>
      <li>✅ Added comprehensive tests</li>
    </ul>
  </div>

  <div class="differences">
    <h2>Key Differences</h2>
    <!-- Detailed diff view -->
  </div>
</body>
</html>
```

### Configuration Migration Tool

Migrate configuration files and environment setup:

```bash
# Migrate configuration
unjucks migrate-config \
  --from ./config \
  --to ./config-new \
  --spec ./specs/api.spec.yaml \
  --env-mapping ./env-mapping.json
```

## 📋 Step-by-Step Migration Process

### Phase 1: Preparation (Days 1-3)

#### Day 1: Assessment and Planning

```bash
# 1. Project analysis
unjucks analyze-project . --comprehensive
```

**Tasks:**
- [ ] Inventory existing codebase
- [ ] Identify migration challenges
- [ ] Create migration timeline
- [ ] Setup backup strategy

#### Day 2: Environment Setup

```bash
# 2. Install tools and setup environment
npm install -g unjucks@latest
unjucks init --migration-mode
```

**Tasks:**
- [ ] Install Unjucks and dependencies
- [ ] Setup development environment
- [ ] Configure version control
- [ ] Create migration branch

#### Day 3: Reverse Engineering

```bash
# 3. Generate initial specification
unjucks reverse-engineer ./src --output ./specs/initial.spec.yaml
```

**Tasks:**
- [ ] Generate specification from code
- [ ] Review and validate specification
- [ ] Document custom logic areas
- [ ] Plan preservation strategy

### Phase 2: Foundation (Days 4-7)

#### Day 4-5: Specification Refinement

```bash
# 4. Refine specification
unjucks refine-spec ./specs/initial.spec.yaml --interactive
unjucks validate-spec ./specs/initial.spec.yaml --comprehensive
```

**Tasks:**
- [ ] Clean up generated specification
- [ ] Add missing documentation
- [ ] Define validation rules
- [ ] Setup testing strategy

#### Day 6-7: Test Generation

```bash
# 5. Generate test structure
unjucks generate-from-spec ./specs/initial.spec.yaml --components tests --output ./tests-new
```

**Tasks:**
- [ ] Generate test framework
- [ ] Compare with existing tests
- [ ] Identify test gaps
- [ ] Plan test migration

### Phase 3: Implementation (Days 8-12)

#### Day 8-10: Code Generation

```bash
# 6. Generate new code structure
unjucks generate-from-spec ./specs/initial.spec.yaml --output ./src-new --complete
```

**Tasks:**
- [ ] Generate complete codebase
- [ ] Compare with existing code
- [ ] Identify custom logic areas
- [ ] Plan preservation strategy

#### Day 11-12: Custom Logic Migration

```bash
# 7. Migrate custom business logic
unjucks migrate-custom-logic ./src --to ./src-new --preserve-functions
```

**Tasks:**
- [ ] Extract custom business logic
- [ ] Integrate with generated code
- [ ] Update imports and dependencies
- [ ] Test integration

### Phase 4: Validation (Days 13-15)

#### Day 13: Testing

```bash
# 8. Run comprehensive tests
npm test
unjucks test-migration --compare-results ./test-results-old ./test-results-new
```

**Tasks:**
- [ ] Run existing test suite
- [ ] Run new test suite
- [ ] Compare test results
- [ ] Fix failing tests

#### Day 14: Performance Testing

```bash
# 9. Performance comparison
unjucks benchmark --old ./src --new ./src-new --report ./performance-report.json
```

**Tasks:**
- [ ] Benchmark old vs new code
- [ ] Identify performance regressions
- [ ] Optimize if necessary
- [ ] Document improvements

#### Day 15: Security Audit

```bash
# 10. Security validation
unjucks security-audit ./src-new --compare ./src --report ./security-report.json
```

**Tasks:**
- [ ] Run security scans
- [ ] Compare security posture
- [ ] Fix security issues
- [ ] Document improvements

### Phase 5: Deployment (Days 16-18)

#### Day 16: Staging Deployment

```bash
# 11. Deploy to staging
unjucks deploy --env staging --source ./src-new --backup ./src
```

**Tasks:**
- [ ] Deploy to staging environment
- [ ] Run integration tests
- [ ] Validate functionality
- [ ] Monitor performance

#### Day 17: User Acceptance Testing

**Tasks:**
- [ ] Conduct user acceptance testing
- [ ] Collect feedback
- [ ] Fix identified issues
- [ ] Update documentation

#### Day 18: Production Deployment

```bash
# 12. Production deployment
unjucks deploy --env production --source ./src-new --strategy blue-green
```

**Tasks:**
- [ ] Deploy to production
- [ ] Monitor system health
- [ ] Validate functionality
- [ ] Update team documentation

## ⚠️ Common Migration Challenges

### Challenge 1: Custom Business Logic

**Problem**: Complex business logic not captured in generated code

**Solution**:
```typescript
// Preserve custom logic in separate modules
// src-new/services/customLogic.ts
export class CustomBusinessLogic {
  // Preserved from original implementation
  calculateComplexPricing(product: Product, user: User): number {
    // Original custom logic preserved
    return originalPricingLogic(product, user);
  }
}

// Integrate with generated code
// src-new/controllers/ProductController.ts
import { CustomBusinessLogic } from '../services/customLogic';

export class ProductController {
  constructor(private customLogic: CustomBusinessLogic) {}
  
  async getPrice(req: Request, res: Response) {
    const price = this.customLogic.calculateComplexPricing(product, user);
    res.json({ price });
  }
}
```

### Challenge 2: Database Schema Differences

**Problem**: Generated schema differs from existing database

**Solution**:
```bash
# Generate migration scripts
unjucks generate-migration \
  --from-schema ./database/current-schema.sql \
  --to-spec ./specs/api.spec.yaml \
  --output ./migrations/spec-migration.sql
```

### Challenge 3: External Integration Points

**Problem**: Existing external service integrations

**Solution**:
```yaml
# Preserve integrations in specification
spec:
  external:
    services:
      - name: payment-gateway
        type: rest
        baseUrl: "${PAYMENT_GATEWAY_URL}"
        auth: api-key
        custom_client: ./src/integrations/paymentGateway.ts
```

### Challenge 4: Performance Regressions

**Problem**: Generated code performs worse than optimized original

**Solution**:
```bash
# Profile and optimize
unjucks optimize-generated ./src-new \
  --benchmark ./src \
  --focus performance \
  --preserve-functionality
```

## 🔄 Rollback Strategy

Always have a rollback plan:

### Automated Rollback

```bash
# Setup automated rollback
unjucks setup-rollback \
  --backup ./src-backup \
  --migration-id migration-2024-01-15 \
  --trigger-conditions "error-rate>5%,response-time>1000ms"
```

### Manual Rollback

```bash
# Manual rollback process
git checkout migration-backup-branch
unjucks rollback-migration --id migration-2024-01-15
npm run deploy:production
```

## 📊 Migration Success Metrics

Track migration success with these metrics:

### Development Metrics
- **Code Generation Speed**: Time to generate new features
- **Bug Reduction**: Defects in generated vs handwritten code
- **Development Velocity**: Features delivered per sprint
- **Code Consistency**: Adherence to patterns and standards

### Technical Metrics
- **Performance**: Response times, throughput, resource usage
- **Security**: Vulnerability scans, security compliance
- **Maintainability**: Code complexity, documentation coverage
- **Test Coverage**: Automated test coverage percentage

### Business Metrics
- **Time to Market**: Feature delivery timeline
- **Development Cost**: Resource investment in development
- **Quality**: Customer-reported issues
- **Team Satisfaction**: Developer experience scores

## 📚 Post-Migration Best Practices

### 1. Establish Spec-First Workflow

```bash
# New feature development process
# 1. Define in specification
unjucks add-feature ./specs/api.spec.yaml --feature notifications

# 2. Generate and test
unjucks generate-from-spec ./specs/api.spec.yaml --components notifications

# 3. Deploy
unjucks deploy --feature notifications
```

### 2. Continuous Specification Updates

```typescript
// Automated spec synchronization
const keepSpecUpdated = {
  // Monitor code changes
  watchForChanges: './src',
  
  // Update spec when code changes
  onCodeChange: async (changes) => {
    const specUpdates = await analyzeChanges(changes);
    await updateSpecification(specUpdates);
  },
  
  // Validate spec-code alignment
  validateAlignment: {
    frequency: 'daily',
    reportDifferences: true,
    autoFix: true
  }
};
```

### 3. Team Training and Documentation

Create comprehensive documentation for your team:

- **Spec-Driven Workflow Guide**
- **Common Patterns and Examples**
- **Troubleshooting Guide**
- **Best Practices Documentation**

### 4. Continuous Improvement

```bash
# Regular specification optimization
unjucks optimize-spec ./specs/api.spec.yaml \
  --analyze-usage \
  --suggest-improvements \
  --apply-best-practices
```

## 🎉 Migration Completion Checklist

### Technical Validation
- [ ] All tests passing
- [ ] Performance benchmarks met
- [ ] Security scans passed
- [ ] Documentation updated
- [ ] Rollback strategy tested

### Process Validation
- [ ] Team trained on new workflow
- [ ] CI/CD pipeline updated
- [ ] Monitoring and alerting configured
- [ ] Backup and recovery tested

### Business Validation
- [ ] User acceptance testing completed
- [ ] Stakeholder approval obtained
- [ ] Go-live checklist completed
- [ ] Support team briefed

---

*Congratulations on completing your migration to spec-driven development! Continue with the [CLI Reference](./cli-reference.md) to master all available commands.*