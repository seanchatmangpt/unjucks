# Developer Onboarding Guide

## Table of Contents
1. [Welcome](#welcome)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Project Structure](#project-structure)
5. [Development Workflow](#development-workflow)
6. [Testing Guidelines](#testing-guidelines)
7. [Code Standards](#code-standards)
8. [Contribution Process](#contribution-process)
9. [Tools and Resources](#tools-and-resources)
10. [Getting Help](#getting-help)

## Welcome

Welcome to the Unjucks development team! This guide will help you get up and running with the project, understand our development practices, and make your first contribution.

### Project Overview
Unjucks is a powerful CLI template generator that combines Hygen-style scaffolding with advanced semantic web capabilities. It enables developers to:
- Generate code from templates with semantic RDF/Turtle support
- Create complex project scaffolding
- Build enterprise-grade applications with automated code generation
- Integrate semantic web technologies into modern development workflows

### Team Values
- **Quality First**: Write clean, tested, maintainable code
- **Collaboration**: Share knowledge and help teammates
- **Innovation**: Explore new technologies and approaches
- **Documentation**: Keep documentation current and comprehensive
- **User Focus**: Build tools that developers love to use

## Prerequisites

### Required Knowledge
- **JavaScript/Node.js**: Intermediate to advanced level
- **Git**: Basic to intermediate workflow knowledge
- **CLI Development**: Experience with command-line tools
- **Template Engines**: Familiarity with EJS or similar templating
- **Package Management**: npm/yarn experience

### Recommended Knowledge
- **Semantic Web**: RDF, Turtle, SPARQL (can be learned on the job)
- **Testing**: Unit testing with Jest/Vitest
- **CI/CD**: GitHub Actions experience
- **TypeScript**: For type definitions and documentation

### System Requirements
- **Node.js**: ≥18.0.0 (Latest LTS recommended)
- **npm**: ≥8.0.0 or **yarn**: ≥1.22.0
- **Git**: ≥2.20.0
- **OS**: macOS, Linux, or Windows with WSL2

## Environment Setup

### 1. Development Environment

#### Clone Repository
```bash
# Clone the repository
git clone https://github.com/unjucks/unjucks.git
cd unjucks

# Or if you have SSH configured
git clone git@github.com:unjucks/unjucks.git
cd unjucks
```

#### Install Dependencies
```bash
# Install project dependencies
npm install

# Or using yarn
yarn install
```

#### Link for Global Development
```bash
# Link for global CLI testing
npm link

# Verify installation
unjucks --version
```

### 2. IDE Setup

#### VS Code Configuration
```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.format.enable": true,
  "files.associations": {
    "*.ejs": "html"
  },
  "emmet.includeLanguages": {
    "ejs": "html"
  }
}
```

#### Recommended VS Code Extensions
```json
// .vscode/extensions.json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.test-adapter-converter"
  ]
}
```

### 3. Development Scripts

#### Essential Commands
```bash
# Start development
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build project
npm run build

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Run type checking
npm run typecheck
```

#### Specialized Commands
```bash
# CLI testing
npm run test:cli

# Template testing
npm run test:cucumber

# Performance testing
npm run test:performance

# Production testing
npm run test:production

# Security audit
npm audit
```

### 4. Environment Variables

#### Development Environment
```bash
# .env.development
NODE_ENV=development
DEBUG=unjucks:*
UNJUCKS_TEMPLATE_PATH=_templates
UNJUCKS_OUTPUT_PATH=./dev-output
UNJUCKS_AUTHOR=Your Name
```

#### Environment Setup Script
```bash
#!/bin/bash
# setup-dev-env.sh

echo "🚀 Setting up Unjucks development environment..."

# Check Node.js version
if ! node -e "process.exit(process.version.slice(1).split('.')[0] >= 18 ? 0 : 1)"; then
    echo "❌ Node.js ≥18.0.0 required"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Link for global use
echo "🔗 Linking for global development..."
npm link

# Install git hooks
echo "🪝 Installing git hooks..."
node scripts/install-hooks.js

# Run initial build and tests
echo "🔨 Running initial build..."
npm run build

echo "🧪 Running tests..."
npm test

# Create development directories
mkdir -p dev-output test-output

echo "✅ Development environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Run 'unjucks --version' to verify installation"
echo "2. Run 'unjucks list' to see available templates"
echo "3. Check out the docs/ directory for detailed guides"
echo "4. Join our development chat for questions"
```

## Project Structure

### High-Level Architecture
```
unjucks/
├── bin/                    # Executable binaries
│   └── unjucks.cjs        # Main CLI entry point
├── src/                    # Source code
│   ├── cli/               # CLI interface
│   ├── commands/          # Command implementations
│   ├── lib/               # Core libraries
│   └── types/             # Type definitions
├── _templates/            # Built-in templates
├── docs/                  # Documentation
├── tests/                 # Test suites
├── scripts/               # Build and utility scripts
├── examples/              # Usage examples
└── templates/             # Extended template collections
```

### Core Components

#### CLI System (`src/cli/`)
```javascript
// Main entry point architecture
src/cli/
├── index.js              # Main CLI application
├── argument-parser.js    # Command line parsing
├── help-system.js        # Help and documentation
└── version-resolver.js   # Version management
```

#### Commands (`src/commands/`)
```javascript
// Individual command implementations
src/commands/
├── generate.js           # Template generation
├── list.js              # List templates/generators
├── init.js              # Project initialization
├── inject.js            # Code injection
├── semantic.js          # Semantic web operations
├── github.js            # GitHub integration
└── migrate.js           # Migration utilities
```

#### Core Libraries (`src/lib/`)
```javascript
// Core functionality libraries
src/lib/
├── template-engine.js    # Template processing
├── semantic-processor.js # RDF/semantic operations
├── file-manager.js       # File system operations
├── validator.js          # Input validation
└── logger.js            # Logging system
```

### Template System (`_templates/`)
```
_templates/
├── component/            # Component generators
│   ├── react/           # React components
│   ├── vue/             # Vue components
│   └── angular/         # Angular components
├── api/                 # API generators
│   ├── express/         # Express.js APIs
│   ├── fastify/         # Fastify APIs
│   └── graphql/         # GraphQL schemas
├── database/            # Database generators
│   ├── prisma/          # Prisma schemas
│   ├── sequelize/       # Sequelize models
│   └── mongodb/         # MongoDB schemas
└── semantic/            # Semantic web templates
    ├── ontology/        # RDF ontology templates
    ├── sparql/          # SPARQL query templates
    └── jsonld/          # JSON-LD templates
```

## Development Workflow

### 1. Feature Development

#### Starting New Feature
```bash
# 1. Create feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name

# 2. Set up development environment
npm install
npm run build

# 3. Make your changes
# ... code changes ...

# 4. Test your changes
npm test
npm run lint

# 5. Commit changes (following conventional commits)
git add .
git commit -m "feat: add new template system"

# 6. Push and create PR
git push origin feature/your-feature-name
# Create PR via GitHub interface
```

#### Development Best Practices
1. **Small Commits**: Make frequent, atomic commits
2. **Test First**: Write tests before or alongside code
3. **Documentation**: Update docs with changes
4. **Code Review**: Self-review before creating PR
5. **Continuous Integration**: Ensure CI passes

### 2. Day-to-Day Development

#### Morning Routine
```bash
# Start of day setup
cd unjucks
git checkout develop
git pull origin develop

# Check for any issues
npm run build
npm test

# Start working on feature
git checkout feature/my-feature
git merge develop  # Keep feature updated
```

#### During Development
```bash
# Test changes frequently
npm run test:watch  # Keep tests running

# Check code quality
npm run lint
npm run typecheck

# Test CLI manually
unjucks preview component react TestComponent
```

#### End of Day
```bash
# Commit work in progress
git add .
git commit -m "wip: progress on feature implementation"

# Push to backup branch
git push origin feature/my-feature
```

### 3. Code Review Process

#### Before Submitting PR
```bash
# Final quality checks
npm run lint:fix
npm test
npm run build
npm run test:production

# Self-review checklist
git diff develop..HEAD  # Review all changes
```

#### PR Review Guidelines
- **Functionality**: Does it work as intended?
- **Tests**: Is there adequate test coverage?
- **Documentation**: Are docs updated?
- **Performance**: Any performance implications?
- **Security**: Any security concerns?
- **Style**: Follows coding standards?

## Testing Guidelines

### Test Structure
```
tests/
├── unit/                 # Unit tests
│   ├── cli/             # CLI unit tests
│   ├── template/        # Template engine tests
│   └── semantic/        # Semantic processing tests
├── integration/         # Integration tests
│   ├── cli/             # End-to-end CLI tests
│   ├── template/        # Template generation tests
│   └── semantic/        # Semantic workflow tests
├── performance/         # Performance tests
├── fixtures/            # Test data and fixtures
└── helpers/             # Test utilities
```

### Writing Tests

#### Unit Test Example
```javascript
// tests/unit/template/template-engine.test.js
import { describe, test, expect } from 'vitest';
import { TemplateEngine } from '../../../src/lib/template-engine.js';

describe('TemplateEngine', () => {
  test('should render simple template', async () => {
    const engine = new TemplateEngine();
    const template = 'Hello <%= name %>!';
    const result = await engine.render(template, { name: 'World' });
    
    expect(result).toBe('Hello World!');
  });
  
  test('should handle missing variables gracefully', async () => {
    const engine = new TemplateEngine();
    const template = 'Hello <%= name || "Anonymous" %>!';
    const result = await engine.render(template, {});
    
    expect(result).toBe('Hello Anonymous!');
  });
});
```

#### Integration Test Example
```javascript
// tests/integration/cli/generate-command.test.js
import { describe, test, expect } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';

describe('Generate Command Integration', () => {
  test('should generate React component', () => {
    const result = execSync(
      'unjucks generate component react Button --output ./test-output',
      { encoding: 'utf8' }
    );
    
    expect(result).toContain('Generated successfully');
    expect(existsSync('./test-output/src/components/Button/Button.jsx')).toBe(true);
    
    const content = readFileSync('./test-output/src/components/Button/Button.jsx', 'utf8');
    expect(content).toContain('const Button = ');
    expect(content).toContain('export default Button');
  });
});
```

### Test Commands
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:cli

# Run tests with coverage
npm run test -- --coverage

# Run tests in watch mode
npm run test:watch

# Run performance tests
npm run test:performance
```

## Code Standards

### JavaScript Style Guide

#### General Principles
- **ES6+ Modules**: Use modern JavaScript features
- **Functional Style**: Prefer functional programming patterns
- **Immutability**: Avoid mutating objects/arrays
- **Clear Naming**: Use descriptive variable and function names
- **Error Handling**: Always handle errors gracefully

#### Code Examples
```javascript
// ✅ Good
const generateComponent = async (options) => {
  try {
    const { name, type, includeTests } = options;
    const templatePath = resolveTemplatePath(type);
    const result = await renderTemplate(templatePath, { name });
    
    if (includeTests) {
      await generateTests(name, type);
    }
    
    return result;
  } catch (error) {
    throw new Error(`Component generation failed: ${error.message}`);
  }
};

// ❌ Bad
function gen(opts) {
  var n = opts.name;
  var t = opts.type;
  // ... unclear variable names, var instead of const/let
  return tmpl.render(n, t);  // Missing error handling
}
```

#### Async/Await Usage
```javascript
// ✅ Preferred
const processTemplate = async (templatePath, variables) => {
  const template = await loadTemplate(templatePath);
  const result = await renderTemplate(template, variables);
  return result;
};

// ❌ Avoid unless necessary
const processTemplate = (templatePath, variables) => {
  return loadTemplate(templatePath)
    .then(template => renderTemplate(template, variables));
};
```

### Documentation Standards

#### Function Documentation
```javascript
/**
 * Generates files from a template with the given variables
 * @param {Object} options - Generation options
 * @param {string} options.generator - Generator name
 * @param {string} options.template - Template name  
 * @param {string} options.name - Instance name
 * @param {Object} options.variables - Template variables
 * @param {string} [options.output] - Output directory
 * @returns {Promise<GenerateResult>} Generation result
 * @throws {Error} When template is not found or generation fails
 * 
 * @example
 * const result = await generate({
 *   generator: 'component',
 *   template: 'react',
 *   name: 'Button',
 *   variables: { type: 'primary' }
 * });
 */
const generate = async (options) => {
  // Implementation
};
```

#### README Standards
Every module/directory should have a README with:
- Purpose and overview
- Usage examples
- API documentation
- Configuration options
- Contributing guidelines

### Error Handling

#### Custom Error Classes
```javascript
// src/lib/errors.js
export class UnjucksError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = 'UnjucksError';
    this.code = code;
    this.context = context;
  }
}

export class TemplateNotFoundError extends UnjucksError {
  constructor(templatePath) {
    super(
      `Template not found: ${templatePath}`,
      'TEMPLATE_NOT_FOUND',
      { templatePath }
    );
  }
}
```

#### Error Handling Patterns
```javascript
// ✅ Good error handling
const loadTemplate = async (templatePath) => {
  try {
    const exists = await fileExists(templatePath);
    if (!exists) {
      throw new TemplateNotFoundError(templatePath);
    }
    
    const content = await readFile(templatePath, 'utf8');
    return parseTemplate(content);
  } catch (error) {
    if (error instanceof TemplateNotFoundError) {
      throw error; // Re-throw specific errors
    }
    
    throw new UnjucksError(
      `Failed to load template: ${error.message}`,
      'TEMPLATE_LOAD_ERROR',
      { templatePath, originalError: error }
    );
  }
};
```

## Contribution Process

### 1. Issue Creation
Before starting work:
1. **Search existing issues** to avoid duplicates
2. **Create detailed issue** with:
   - Clear description
   - Steps to reproduce (for bugs)
   - Expected behavior
   - Environment information
3. **Get feedback** from maintainers
4. **Get assigned** to the issue

### 2. Development Process
1. **Fork repository** (external contributors)
2. **Create feature branch** from develop
3. **Implement changes** following standards
4. **Write tests** for new functionality
5. **Update documentation** as needed
6. **Run full test suite**
7. **Create pull request**

### 3. Pull Request Guidelines

#### PR Title Format
```
type(scope): description

Examples:
feat(cli): add dry-run option for template preview
fix(semantic): handle malformed RDF gracefully
docs(api): update semantic web API documentation
```

#### PR Description Template
```markdown
## Description
Brief description of changes and their purpose.

## Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to change)
- [ ] Documentation update

## Changes Made
- Change 1: Description
- Change 2: Description

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed
- [ ] All tests passing

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Breaking changes documented
- [ ] Related documentation updated

## Related Issues
Fixes #123
```

### 4. Code Review Process
1. **Automated checks** must pass (CI/CD)
2. **At least one approval** from maintainer
3. **Address feedback** from reviewers
4. **Resolve merge conflicts** if any
5. **Squash merge** to develop branch

## Tools and Resources

### Development Tools

#### Recommended VS Code Extensions
- **ESLint**: Code linting
- **Prettier**: Code formatting  
- **GitLens**: Git integration
- **Test Explorer**: Test management
- **Thunder Client**: API testing
- **Markdown Preview**: Documentation editing

#### Useful CLI Tools
```bash
# Global development tools
npm install -g nodemon       # File watching
npm install -g eslint        # Linting
npm install -g prettier      # Code formatting
npm install -g vitest        # Testing
npm install -g gh            # GitHub CLI
```

### Documentation Resources

#### Internal Documentation
- [User Guide](USER_GUIDE.md) - End-user documentation
- [API Documentation](API_DOCUMENTATION.md) - Developer API reference
- [Template Development Guide](TEMPLATE_DEVELOPMENT_GUIDE.md) - Template creation
- [Build and Deployment Guide](BUILD_DEPLOYMENT_GUIDE.md) - Build system
- [Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md) - Problem solving

#### External Resources
- [EJS Documentation](https://ejs.co/) - Template engine syntax
- [N3.js Documentation](https://github.com/rdfjs/N3.js/) - RDF processing
- [Citty Documentation](https://citty.unjs.io/) - CLI framework
- [Vitest Documentation](https://vitest.dev/) - Testing framework
- [Conventional Commits](https://conventionalcommits.org/) - Commit standards

### Learning Resources

#### Semantic Web Technologies
- [RDF Primer](https://www.w3.org/TR/rdf11-primer/) - W3C RDF specification
- [Turtle Tutorial](https://www.w3.org/TeamSubmission/turtle/) - Turtle syntax
- [SPARQL Tutorial](https://www.w3.org/TR/sparql11-query/) - Query language
- [JSON-LD Playground](https://json-ld.org/playground/) - JSON-LD testing

#### Template Systems
- [Hygen Documentation](https://www.hygen.io/) - Template generator inspiration  
- [EJS Guide](https://github.com/mde/ejs/wiki) - Template syntax
- [Handlebars.js](https://handlebarsjs.com/) - Alternative templating

## Getting Help

### Internal Support Channels

#### Documentation
1. **Start with docs/**: Comprehensive guides and API docs
2. **Check examples/**: Working code examples
3. **Read tests/**: Implementation examples and edge cases

#### Team Communication
1. **GitHub Issues**: Bug reports and feature requests
2. **GitHub Discussions**: Questions and community support
3. **Pull Request Comments**: Code-specific discussions
4. **Team Slack/Discord**: Real-time chat (if available)

### Escalation Process
1. **Self-help**: Documentation, examples, tests
2. **Community**: GitHub discussions, issues
3. **Team Lead**: Direct message for urgent issues
4. **Maintainers**: Tag in issues for architectural decisions

### Common Questions

#### Q: How do I add a new template generator?
A: See the [Template Development Guide](TEMPLATE_DEVELOPMENT_GUIDE.md) for detailed instructions.

#### Q: How do I test semantic web features?
A: Check `tests/semantic/` for examples and use the debug mode: `DEBUG=unjucks:semantic npm test`.

#### Q: What's the release process?
A: See [Git Workflow Guide](GIT_WORKFLOW_GUIDE.md) for the complete release process.

#### Q: How do I handle breaking changes?
A: Document in PR, follow semantic versioning, and update migration guides.

### Development Tips

#### Productivity Tips
```bash
# Set up aliases for common commands
alias ut="npm test"
alias ub="npm run build"
alias ul="npm run lint"
alias ugen="unjucks generate"

# Use npm scripts effectively
npm run # List all available scripts
npm run test -- --watch # Pass arguments to scripts

# Git workflow shortcuts
git config alias.co checkout
git config alias.br branch
git config alias.ci commit
git config alias.st status
```

#### Debugging Tips
```bash
# Enable debug mode
DEBUG=unjucks:* unjucks generate component react Button

# Use Node.js debugger
node --inspect-brk $(which unjucks) generate component react Button

# Profile performance
node --prof $(which unjucks) generate large-project app MyApp
node --prof-process isolate-*.log > profile.txt
```

---

Welcome to the team! This guide should get you started, but don't hesitate to ask questions. We're here to help you become a productive contributor to the Unjucks project.