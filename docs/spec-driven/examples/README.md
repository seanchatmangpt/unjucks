# Spec-Driven Development Examples

This directory contains real-world examples of spec-driven development with Unjucks, showcasing different application types, patterns, and use cases.

## 📁 Example Categories

### Basic Examples
- **[Simple REST API](./simple-rest-api/)** - Basic CRUD API with users and posts
- **[React Frontend](./react-frontend/)** - Simple React application with components
- **[Express Microservice](./express-microservice/)** - Lightweight microservice example

### Intermediate Examples
- **[E-commerce API](./ecommerce-api/)** - Complete e-commerce backend with authentication
- **[Blog Platform](./blog-platform/)** - Full-stack blog with React + Express
- **[Task Management](./task-management/)** - Project management API with teams and permissions

### Advanced Examples
- **[Microservices Architecture](./microservices-arch/)** - Multi-service architecture with service mesh
- **[GraphQL API](./graphql-api/)** - GraphQL server with complex resolvers and subscriptions
- **[Real-time Chat](./realtime-chat/)** - WebSocket-based chat application
- **[Event-Driven System](./event-driven/)** - Event sourcing and CQRS pattern implementation

### AI-Powered Examples
- **[AI-Enhanced API](./ai-enhanced-api/)** - API generated and enhanced with Claude Flow MCP
- **[Smart Documentation](./smart-docs/)** - Auto-generated docs with AI insights
- **[Intelligent Testing](./intelligent-testing/)** - AI-generated comprehensive test suites

### Migration Examples
- **[Legacy to Spec](./legacy-migration/)** - Migrating existing Express app to spec-driven
- **[Monolith to Microservices](./monolith-split/)** - Breaking down monolith using specs
- **[Framework Migration](./framework-migration/)** - Moving from Express to Fastify using specs

## 🚀 Quick Start with Examples

### Clone and Explore
```bash
# Clone an example
cp -r docs/spec-driven/examples/simple-rest-api ./my-project
cd my-project

# Generate code from specification
unjucks generate-from-spec api.spec.yaml --output ./src

# Install dependencies and run
npm install
npm run dev
```

### Customize for Your Needs
```bash
# Modify the specification
vim api.spec.yaml

# Regenerate with your changes
unjucks generate-from-spec api.spec.yaml --output ./src --merge

# Test your changes
npm test
```

## 📖 Example Structure

Each example follows this structure:

```
example-name/
├── README.md                    # Example-specific documentation
├── api.spec.yaml               # Main specification file
├── package.json                # Dependencies and scripts
├── src/                        # Generated source code
│   ├── models/
│   ├── controllers/
│   ├── routes/
│   └── ...
├── tests/                      # Generated and custom tests
├── docs/                       # Generated documentation
├── generated/                  # AI-generated enhancements (if applicable)
└── custom/                     # Custom business logic
    └── README.md               # Notes on preserving custom code
```

## 🎯 Learning Path

### Beginner Path
1. Start with **Simple REST API** to understand basics
2. Explore **React Frontend** for client-side generation
3. Try **Express Microservice** for service patterns

### Intermediate Path
1. Study **E-commerce API** for complex entity relationships
2. Examine **Blog Platform** for full-stack coordination
3. Analyze **Task Management** for permission patterns

### Advanced Path
1. Dive into **Microservices Architecture** for distributed systems
2. Explore **GraphQL API** for alternative API patterns
3. Study **Event-Driven System** for advanced architectural patterns

### AI Integration Path
1. Start with **AI-Enhanced API** for MCP basics
2. Explore **Smart Documentation** for AI-powered docs
3. Master **Intelligent Testing** for comprehensive AI testing

## 🔧 Using Examples with Your Own Projects

### Extract Patterns
```bash
# Extract reusable patterns from examples
unjucks extract-pattern docs/spec-driven/examples/ecommerce-api \
  --pattern authentication \
  --output ./patterns/auth.spec.yaml
```

### Combine Examples
```bash
# Combine multiple example patterns
unjucks combine-specs \
  --specs docs/spec-driven/examples/simple-rest-api/api.spec.yaml \
  --specs docs/spec-driven/examples/react-frontend/app.spec.yaml \
  --output ./my-fullstack.spec.yaml
```

### Customize Templates
```bash
# Use example templates as starting point
cp -r docs/spec-driven/examples/ecommerce-api/templates ./my-templates
unjucks generate-from-spec my-api.spec.yaml \
  --templates ./my-templates \
  --output ./src
```

## 🧪 Testing Examples

All examples include comprehensive testing strategies:

```bash
# Run all example tests
npm run test:examples

# Test specific example
npm run test:example simple-rest-api

# Generate test report
npm run test:report
```

## 📊 Example Metrics

Each example includes metrics and benchmarks:

- **Generation Time**: How long it takes to generate the example
- **Code Coverage**: Test coverage percentage
- **Performance**: Response times and throughput
- **Complexity**: Cyclomatic complexity scores
- **Maintainability**: Code maintainability index

## 🤝 Contributing Examples

Want to contribute an example?

1. **Fork the repository**
2. **Create example directory** under `docs/spec-driven/examples/`
3. **Follow the standard structure**
4. **Include comprehensive documentation**
5. **Add tests and validation**
6. **Submit pull request**

### Example Contribution Checklist
- [ ] Clear, descriptive README.md
- [ ] Complete specification file
- [ ] Generated code examples
- [ ] Test suite with good coverage
- [ ] Documentation for key concepts
- [ ] Performance benchmarks
- [ ] AI integration (if applicable)

## 🔍 Finding the Right Example

### By Application Type
- **Web APIs**: simple-rest-api, ecommerce-api, graphql-api
- **Frontend Apps**: react-frontend, blog-platform
- **Microservices**: express-microservice, microservices-arch
- **Real-time**: realtime-chat, event-driven

### By Complexity
- **Beginner**: simple-rest-api, react-frontend, express-microservice
- **Intermediate**: ecommerce-api, blog-platform, task-management
- **Advanced**: microservices-arch, graphql-api, event-driven

### By Technology
- **Node.js/Express**: simple-rest-api, ecommerce-api, express-microservice
- **React**: react-frontend, blog-platform
- **TypeScript**: All examples support TypeScript
- **Database**: PostgreSQL (most), MongoDB (some), SQLite (simple)

### By Feature
- **Authentication**: ecommerce-api, task-management, blog-platform
- **File Upload**: ecommerce-api, blog-platform
- **Real-time**: realtime-chat, event-driven
- **Testing**: All examples (intelligent-testing for AI-generated tests)
- **AI Integration**: ai-enhanced-api, smart-docs, intelligent-testing

## 📚 Additional Resources

- **[Specification Format Reference](../specification-format.md)**
- **[Integration Guide](../integration-guide.md)**
- **[AI Workflows Documentation](../ai-workflows.md)**
- **[Migration Guide](../migration-guide.md)**
- **[CLI Reference](../cli-reference.md)**

---

*Ready to dive in? Start with the [Simple REST API example](./simple-rest-api/) to see spec-driven development in action!*