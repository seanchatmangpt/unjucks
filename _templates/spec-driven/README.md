# Spec-Driven Development Templates

This directory contains Unjucks templates for specification-driven development workflows. These templates enable you to generate comprehensive specifications, technical plans, task breakdowns, and implementation code based on structured requirements.

## Available Templates

### 1. Specification Templates (`specification/new/`)
- **File**: `specification.md.ejs`
- **Purpose**: Generate comprehensive specification documents with requirements, acceptance criteria, and technical constraints

**Usage:**
```bash
# Generate a new specification
unjucks generate specification new --specName "User Authentication System" --author "John Doe" --version "1.0.0"

# With detailed requirements
unjucks generate specification new \
  --specName "Payment Processing API" \
  --description "Secure payment processing with multiple providers" \
  --features '[{"name":"Credit Card Processing","priority":"High","complexity":"High"}]' \
  --performance '{"responseTime":"<200ms","throughput":"1000 RPS"}' \
  --dest ./specs
```

### 2. Technical Plan Templates (`plan/technical/`)
- **File**: `technical-plan.md.ejs`
- **Purpose**: Generate technical architecture plans based on specifications

**Usage:**
```bash
# Generate technical architecture plan
unjucks generate plan technical --planName "Microservices Architecture" --architect "Jane Smith"

# With technology stack
unjucks generate plan technical \
  --planName "E-commerce Platform" \
  --technologies '{"runtime":"Node.js 18+","framework":"Express.js","database":"PostgreSQL"}' \
  --architecture '{"pattern":"Microservices","style":"Event-driven"}' \
  --dest ./architecture
```

### 3. Task Breakdown Templates (`tasks/breakdown/`)
- **File**: `task-breakdown.md.ejs`
- **Purpose**: Generate detailed task breakdowns with sprints, user stories, and effort estimates

**Usage:**
```bash
# Generate task breakdown
unjucks generate tasks breakdown --projectName "Customer Portal" --estimationMethod "Story Points"

# With epics and stories
unjucks generate tasks breakdown \
  --projectName "Inventory Management" \
  --epics '[{"name":"Product Catalog","businessValue":"High","effort":"25"}]' \
  --sprints '[{"name":"Sprint 1","duration":"2 weeks","capacity":"40"}]' \
  --dest ./project-planning
```

### 4. Implementation Templates (`implementation/from-spec/`)
- **Files**: `component.ts.ejs`, `component.test.ts.ejs`
- **Purpose**: Generate TypeScript components and comprehensive test suites based on specifications

**Usage:**
```bash
# Generate TypeScript component
unjucks generate implementation from-spec \
  --componentName "UserService" \
  --specName "User Management API" \
  --componentType "class"

# Generate with interfaces and methods
unjucks generate implementation from-spec \
  --componentName "PaymentProcessor" \
  --interfaces '[{"name":"PaymentProvider","properties":[{"name":"id","type":"string"},{"name":"name","type":"string"}]}]' \
  --methods '[{"name":"processPayment","async":true,"returns":{"type":"PaymentResult"}}]' \
  --dest ./src
```

## Template Features

### Specification Template Features
- ✅ Functional and non-functional requirements
- ✅ Acceptance criteria with BDD format
- ✅ Performance and security requirements
- ✅ API specifications with examples
- ✅ Risk assessment and mitigation
- ✅ Data models and flow diagrams
- ✅ Testing strategy definition

### Technical Plan Features
- ✅ System architecture patterns
- ✅ Technology stack recommendations
- ✅ Data architecture and caching strategy
- ✅ Security and scalability planning
- ✅ Integration architecture
- ✅ Deployment and CI/CD strategy
- ✅ Monitoring and observability
- ✅ Risk assessment with mitigation

### Task Breakdown Features
- ✅ Epic and user story management
- ✅ Sprint planning with capacity
- ✅ Effort estimation (story points/hours)
- ✅ Task dependencies tracking
- ✅ Risk identification and mitigation
- ✅ Team responsibility matrix
- ✅ Success metrics definition

### Implementation Features
- ✅ TypeScript component generation
- ✅ Interface and type definitions
- ✅ Class and function templates
- ✅ Comprehensive test suites
- ✅ JSDoc documentation
- ✅ Error handling patterns
- ✅ Performance test templates
- ✅ Integration test scaffolding

## Advanced Usage Examples

### Complete Spec-Driven Workflow

```bash
# 1. Generate specification
unjucks generate specification new \
  --specName "Order Management System" \
  --description "E-commerce order processing and fulfillment" \
  --features '[
    {"name":"Order Creation","priority":"High","complexity":"Medium"},
    {"name":"Payment Integration","priority":"High","complexity":"High"},
    {"name":"Inventory Updates","priority":"High","complexity":"Medium"}
  ]' \
  --dest ./docs/specs

# 2. Generate technical plan
unjucks generate plan technical \
  --planName "Order Management Architecture" \
  --architecture '{"pattern":"Event-driven","style":"Microservices"}' \
  --technologies '{
    "runtime":"Node.js 18+",
    "framework":"Express.js",
    "database":"PostgreSQL",
    "messageQueue":"RabbitMQ"
  }' \
  --dest ./docs/architecture

# 3. Generate task breakdown
unjucks generate tasks breakdown \
  --projectName "Order Management Implementation" \
  --epics '[
    {
      "name":"Core Order Processing",
      "businessValue":"High",
      "stories":[
        {"title":"Create Order API","effort":"8","priority":"High"},
        {"title":"Order Status Updates","effort":"5","priority":"Medium"}
      ]
    }
  ]' \
  --dest ./project

# 4. Generate implementation
unjucks generate implementation from-spec \
  --componentName "OrderService" \
  --specName "Order Management System" \
  --componentType "class" \
  --methods '[
    {"name":"createOrder","async":true,"returns":{"type":"Order"}},
    {"name":"updateStatus","async":true,"returns":{"type":"void"}}
  ]' \
  --dest ./src
```

### Variable Reference

#### Common Variables
- `specName` - Name of the specification
- `componentName` - Name of the component/service
- `projectName` - Project identifier
- `author` - Document author
- `version` - Version number
- `description` - Detailed description

#### Specification Variables
```typescript
interface SpecificationVariables {
  specName: string;
  author?: string;
  version?: string;
  status?: 'Draft' | 'Review' | 'Approved';
  objectives?: string[];
  features?: Feature[];
  performance?: PerformanceRequirements;
  security?: string[];
  constraints?: string[];
  dependencies?: Dependency[];
  dataModels?: DataModel[];
  apiEndpoints?: APIEndpoint[];
  testStrategy?: TestStrategy;
  risks?: Risk[];
}
```

#### Technical Plan Variables
```typescript
interface TechnicalPlanVariables {
  planName: string;
  architect?: string;
  architecture?: {
    pattern: 'Microservices' | 'Monolith' | 'Serverless';
    style: 'Event-driven' | 'REST' | 'GraphQL';
    description?: string;
  };
  technologies?: TechnologyStack;
  components?: Component[];
  scaling?: ScalingStrategy;
  deployment?: DeploymentStrategy;
}
```

#### Implementation Variables
```typescript
interface ImplementationVariables {
  componentName: string;
  specName?: string;
  componentType?: 'class' | 'function';
  interfaces?: Interface[];
  methods?: Method[];
  imports?: Import[];
  testFramework?: 'jest' | 'vitest';
  acceptanceCriteria?: AcceptanceCriteria[];
}
```

## Filters and Utilities

These templates use Unjucks filters for string manipulation:

- `paramCase` - Converts to param-case (kebab-case)
- `camelCase` - Converts to camelCase
- `pascalCase` - Converts to PascalCase
- `snakeCase` - Converts to snake_case

## Integration with Development Tools

### With Jest/Vitest
Generated test files are compatible with both Jest and Vitest testing frameworks.

### With TypeScript
All generated code includes proper TypeScript types and interfaces.

### With CI/CD
Templates include CI/CD considerations and deployment strategies.

### With Documentation Tools
Generated components include JSDoc comments for automatic documentation generation.

## Best Practices

1. **Start with Specifications**: Always generate specifications first to establish clear requirements
2. **Iterate on Plans**: Use technical plans to validate architectural decisions
3. **Break Down Tasks**: Create detailed task breakdowns for accurate project estimation
4. **Generate Tests First**: Use test templates to establish TDD workflows
5. **Update Regularly**: Keep generated documents updated as requirements evolve

## Contributing

To add new spec-driven templates:

1. Create template files in appropriate subdirectories
2. Use Nunjucks syntax with EJS extension
3. Include comprehensive frontmatter for file generation
4. Add variable documentation and examples
5. Test with various input combinations

---

*Generated with Unjucks spec-driven templates*