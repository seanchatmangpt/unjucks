# Spec-Driven Development with Unjucks

Welcome to the comprehensive guide for spec-driven development using Unjucks. This documentation covers everything from getting started to advanced AI-powered workflows.

## 📚 Documentation Structure

### Core Concepts
- **[Getting Started](./getting-started.md)** - Quick introduction to spec-driven development
- **[Specification Format](./specification-format.md)** - Complete format reference and best practices
- **[Integration Guide](./integration-guide.md)** - How spec-driven works with existing unjucks features

### Advanced Topics
- **[AI-Powered Workflows](./ai-workflows.md)** - Leveraging MCP for intelligent spec generation
- **[Migration Guide](./migration-guide.md)** - Moving from traditional development to spec-driven

### Reference
- **[CLI Commands](./cli-reference.md)** - Complete command reference
- **[Examples](./examples/)** - Real-world examples and templates
- **[Best Practices](./best-practices.md)** - Proven patterns and recommendations

## 🚀 Quick Start

```bash
# Generate from specification
unjucks generate-from-spec my-api.spec.yaml --output ./src

# Create interactive specification
unjucks create-spec --interactive

# Validate specification
unjucks validate-spec my-api.spec.yaml
```

## 🎯 What is Spec-Driven Development?

Spec-driven development is a methodology where you define your application's structure, behavior, and requirements in a formal specification before writing code. Unjucks then uses this specification to:

1. **Generate boilerplate code** automatically
2. **Ensure consistency** across components
3. **Validate implementations** against specifications
4. **Enable AI-powered** code generation and optimization
5. **Facilitate collaboration** between team members

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Specification  │───▶│    Unjucks      │───▶│   Generated     │
│     (YAML)      │    │   Generator     │    │     Code        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐             │
         └──────────────▶│   AI/MCP        │◀────────────┘
                        │  Integration    │
                        └─────────────────┘
```

## 🔧 Key Features

- **📝 Declarative Specifications** - Define what you want, not how to build it
- **🤖 AI Integration** - Leverage Claude Flow MCP for intelligent generation
- **⚡ Rapid Prototyping** - From spec to working code in seconds
- **🔄 Iterative Development** - Continuously refine specs and regenerate
- **🎯 Type Safety** - Generate TypeScript with proper types from specs
- **📊 Validation** - Ensure generated code matches specifications
- **🔌 Extensible** - Custom generators and templates

## 🌟 Benefits

### For Developers
- **Faster Development** - Less boilerplate writing
- **Fewer Bugs** - Consistent code generation
- **Better Documentation** - Specs serve as living documentation
- **Easier Refactoring** - Change spec, regenerate code

### For Teams
- **Improved Collaboration** - Shared understanding through specs
- **Standardization** - Consistent patterns across projects
- **Knowledge Transfer** - New team members understand through specs
- **Quality Assurance** - Automated validation and testing

## 📖 Next Steps

1. **Start with [Getting Started](./getting-started.md)** for your first spec-driven project
2. **Learn the [Specification Format](./specification-format.md)** to create effective specs
3. **Explore [AI Workflows](./ai-workflows.md)** for advanced automation
4. **Check [Examples](./examples/)** for real-world use cases

---

*This documentation is part of the Unjucks project - a powerful code generation toolkit that combines the flexibility of templates with the intelligence of AI.*