# Unjucks Documentation

Welcome to the complete documentation for **Unjucks v1.0** - a powerful Hygen-style CLI generator for creating templates and scaffolding projects.

## What is Unjucks?

Unjucks is a modern, flexible code generator that combines the power of Nunjucks templating with an intuitive CLI interface. It allows developers to create reusable templates for rapid project scaffolding, component generation, and code automation.

## Core Features

- **Hygen-style CLI** - Familiar command structure for generator-based workflows
- **Nunjucks Templating** - Full-featured template engine with custom filters
- **Dynamic CLI Generation** - Automatically generates CLI arguments from template variables
- **File Injection** - Smart code injection with idempotent operations
- **Template Discovery** - Automatic discovery and organization of generators
- **Interactive Prompts** - User-friendly prompts for missing variables
- **TypeScript Support** - Built with TypeScript for excellent developer experience

## Quick Links

### Getting Started
- [Getting Started Guide](getting-started.md) - Quick setup and first steps
- [Configuration Reference](configuration.md) - Complete configuration options

### Core Documentation
- [CLI Reference](cli/README.md) - Complete command line interface documentation
- [API Reference](api/README.md) - Programmatic API documentation
- [Testing Guide](testing/README.md) - BDD testing framework and guidelines

### Advanced Topics
- [System Architecture](architecture/README.md) - Internal design and architecture
- [Template Development](templates/README.md) - Creating and managing templates

## Installation

```bash
# Install globally
npm install -g unjucks

# Or use with npx
npx unjucks --help
```

## Quick Example

```bash
# Initialize a new project with templates
unjucks init --type cli --dest ./my-project

# List available generators
unjucks list

# Generate a new component
unjucks generate component react --componentName Button --withProps --dest ./src

# Show help for a specific template
unjucks help component react
```

## Project Structure

```
docs/
├── README.md               # This file - main documentation index
├── getting-started.md      # Quick start guide and tutorials
├── configuration.md        # Configuration reference
├── api/                   # API documentation
│   └── README.md          # Programmatic API reference
├── cli/                   # CLI documentation
│   └── README.md          # Command line interface reference
├── testing/               # Testing documentation
│   └── README.md          # BDD testing guide
├── architecture/          # System design documentation
│   └── README.md          # Architecture and design principles
└── templates/             # Template development guide
    └── README.md          # Template creation and management
```

## Key Concepts

### Generators
Generators are collections of templates organized by purpose (e.g., `component`, `service`, `cli`). Each generator can contain multiple templates.

### Templates
Templates are the actual files that get processed and generated. They use Nunjucks syntax with custom filters for common transformations.

### Variables
Variables are extracted from templates and automatically converted to CLI arguments. They can have types, defaults, and descriptions.

### Injection
Unjucks supports smart code injection for updating existing files, not just creating new ones.

## Version Information

- **Current Version**: 1.0.0
- **Node.js**: >= 16.0.0
- **License**: MIT

## Community

- **Repository**: [unjs/unjucks](https://github.com/unjs/unjucks)
- **Issues**: [GitHub Issues](https://github.com/unjs/unjucks/issues)
- **Discussions**: [GitHub Discussions](https://github.com/unjs/unjucks/discussions)

## Next Steps

1. Start with the [Getting Started Guide](getting-started.md) for your first Unjucks project
2. Explore the [CLI Reference](cli/README.md) to learn all available commands
3. Check out [Template Development](templates/README.md) to create custom generators
4. Read the [Testing Guide](testing/README.md) for contributing to the project

---

*This documentation covers Unjucks v1.0. For the latest updates, check the [official repository](https://github.com/unjs/unjucks).*