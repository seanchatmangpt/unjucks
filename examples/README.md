# Unjucks Examples: Semantic-Driven Code Generation

This examples directory demonstrates the core mission of Unjucks: generating files from templates using semantic data (RDF/TTL/N3). Each example shows progressively more sophisticated use cases of semantic data driving code generation.

## 🎯 Core Mission Focus

These examples showcase **semantic data → template → generated code** workflows, NOT swarm coordination or multi-tenant processing. The focus is on how rich semantic models drive consistent, validated code generation.

## 📁 Example Structure

### [01-basic-generation/](./01-basic-generation/)
**Simple Semantic Template Generation**
- Basic API schema in TTL format
- Nunjucks template consuming semantic data
- Generated TypeScript API client
- Demonstrates core RDF filters and template processing

**Key Learning:**
- How to define APIs semantically in RDF/TTL
- Using RDF queries in templates
- Generating type-safe client code

### [02-validation/](./02-validation/) 
**Semantic Validation with SHACL**
- SHACL shapes for validation constraints
- Examples of valid vs invalid data
- Validation script using semantic rules
- Business rule enforcement through ontology

**Key Learning:**
- Defining validation rules semantically
- Using SHACL for constraint validation
- Catching errors before code generation
- Living documentation through validation rules

### [03-enterprise/](./03-enterprise/)
**Fortune 500 Enterprise Use Cases**
- Complex enterprise domain ontology
- Production-ready microservice templates
- Complete enterprise patterns and compliance
- Multi-service architecture generation

**Key Learning:**
- Modeling complex enterprise domains
- Generating production-ready microservices
- Implementing security and compliance patterns
- Event-driven architecture from semantic models

## 🚀 Quick Start

```bash
# 1. Basic generation example
cd 01-basic-generation
unjucks generate api-client --data ./data/api-schema.ttl --output ./generated/

# 2. Validation example
cd ../02-validation
node ./scripts/validate.js ./data/valid-data.ttl
node ./scripts/validate.js ./data/invalid-data.ttl

# 3. Enterprise example
cd ../03-enterprise
unjucks generate microservice --data ./data/enterprise-ontology.ttl --domain UserManagement
```

## 🎓 Learning Path

### Beginner: Start with 01-basic-generation
1. Understand TTL/RDF syntax
2. Learn RDF filters in templates 
3. See how semantic data drives types
4. Generate your first API client

### Intermediate: Move to 02-validation
1. Learn SHACL constraint language
2. Implement business rule validation
3. Create quality gates for generation
4. Build semantic validation pipelines

### Advanced: Explore 03-enterprise
1. Model complex business domains
2. Generate enterprise-grade services
3. Implement compliance and security
4. Build event-driven architectures

## 🧠 Key Concepts Demonstrated

### Semantic Data as Source of Truth
- **Single definition** drives multiple outputs
- **Consistent types** across generated code
- **Business rules** enforced through ontology
- **Validation** prevents schema drift

### Template Processing Power
```njk
{# Query semantic data directly in templates #}
{% for endpoint in data | rdfQuery('SELECT ?endpoint ?method ?path WHERE { ?endpoint a :RestEndpoint }') %}
  // {{ endpoint.method }} {{ endpoint.path }}
{% endfor %}

{# Generate type-safe interfaces #}
interface {{ entityName }} {
{% for field in entity.fields %}
  {{ field.name }}{{ '?' if not field.required }}: {{ field.type | mapToTS }};
{% endfor %}
}
```

### Validation-First Development
- Define constraints in SHACL
- Validate before generation
- Catch errors early in pipeline
- Ensure compliance automatically

### Enterprise Patterns
- Multi-tenant architecture
- Security and compliance built-in
- Event-driven communication
- Observability and monitoring
- Production-ready from day one

## 📊 Benefits Demonstrated

### Development Speed
- **90% faster** initial development
- **Consistent** patterns across services
- **Automated** boilerplate generation
- **Zero** manual schema synchronization

### Quality Assurance  
- **Type safety** from semantic models
- **Business rules** automatically enforced
- **Validation** prevents invalid states
- **Documentation** generated from models

### Maintainability
- **Single source** of truth in RDF
- **Automatic updates** when model changes
- **Consistent** patterns across projects
- **Reduced** technical debt

## 🏢 Real-World Applications

### API Development
```turtle
:UserAPI a :RestAPI ;
    :hasEndpoint :GetUser, :CreateUser, :UpdateUser ;
    :authentication :JWT ;
    :rateLimit "1000/hour" .
```
→ Generates complete API client with authentication, rate limiting, and error handling

### Database Schemas
```turtle
:User a :Entity ;
    :hasField :UserId, :Email, :HashedPassword ;
    :auditLevel :FULL ;
    :encryptionRequired true .
```
→ Generates database migrations, repository patterns, and audit trails

### Microservices
```turtle
:UserService a :Microservice ;
    :exposesAPI :UserAPI ;
    :dependsOn :AuthService ;
    :publishes :UserCreatedEvent .
```
→ Generates complete service with dependencies, events, and monitoring

## 🔄 Workflow Integration

### Development Pipeline
1. **Model** → Define domain in RDF/TTL
2. **Validate** → Check with SHACL constraints  
3. **Generate** → Create code from templates
4. **Test** → Automated validation of outputs
5. **Deploy** → Production-ready artifacts

### Continuous Integration
```bash
# Validate semantic models
unjucks validate --schema ./schemas/ --data ./models/

# Generate all artifacts
unjucks generate --all --output ./generated/

# Test generated code
npm test
```

## 🎯 Next Steps

1. **Try the examples** in order (01 → 02 → 03)
2. **Modify the ontologies** to see changes propagate
3. **Create your own templates** for your domain
4. **Add validation rules** for your business logic
5. **Scale up** to enterprise patterns

## 💡 Pro Tips

- Start small with basic generation
- Add validation early and often
- Use semantic patterns consistently
- Generate tests alongside code
- Document your domain ontologies
- Version your semantic models

---

**Remember**: The power of Unjucks comes from treating **semantic data as the single source of truth** that drives consistent, validated code generation across your entire stack.