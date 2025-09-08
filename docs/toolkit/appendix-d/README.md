# Appendix D: Code Samples and Exercises

## Overview

This appendix provides hands-on exercises, practical code samples, and real-world examples to help developers master the Unjucks ecosystem. From basic template creation to advanced AI-powered generation workflows, these exercises build practical skills through progressive learning.

## Learning Path Structure

### 1. Foundation Exercises
- [Getting Started](./01-getting-started/README.md) - Basic template creation and usage
- [Template Syntax](./02-template-syntax/README.md) - Mastering Nunjucks and Unjucks extensions
- [Configuration Management](./03-configuration/README.md) - Working with frontmatter and variables
- [File Organization](./04-file-organization/README.md) - Project structure and template organization

### 2. Intermediate Projects
- [React Component Generator](./05-react-generator/README.md) - Complete React ecosystem templates
- [API Scaffolding](./06-api-scaffolding/README.md) - REST API generation with tests and docs
- [Database Schema Generator](./07-database-generator/README.md) - Database-first development
- [Configuration Files](./08-config-files/README.md) - Generate project configuration

### 3. Advanced Workflows
- [Specification-Driven Development](./09-spec-driven/README.md) - From requirements to code
- [AI-Powered Generation](./10-ai-generation/README.md) - Using Claude for intelligent generation
- [Multi-Project Templates](./11-multi-project/README.md) - Monorepo and multi-service templates
- [Custom Plugin Development](./12-plugin-development/README.md) - Extending Unjucks capabilities

### 4. Enterprise Solutions
- [Team Template Libraries](./13-team-libraries/README.md) - Shared template management
- [CI/CD Integration](./14-cicd-integration/README.md) - Automated generation workflows
- [Security and Compliance](./15-security-compliance/README.md) - Enterprise security patterns
- [Migration Strategies](./16-migration-strategies/README.md) - Migrating existing projects

## Quick Start Challenges

### Challenge 1: Your First Template (15 minutes)
Create a simple "Hello World" template that generates a personalized greeting file.

**Objective**: Learn basic template creation and variable usage.

**Prerequisites**: 
- Node.js 18+ installed
- Unjucks CLI installed globally: `npm install -g @unjucks/cli`

**Step 1**: Initialize a new template project
```bash
mkdir unjucks-exercises
cd unjucks-exercises
unjucks init --template-only
```

**Step 2**: Create your first template
```bash
mkdir templates/greeting
cd templates/greeting
```

Create `index.njk`:
```nunjucks
---
to: "greetings/{{ name | kebab }}.txt"
---
Hello, {{ name }}!

Welcome to the wonderful world of Unjucks!

Generated on: {{ now | date('YYYY-MM-DD HH:mm:ss') }}
Template: {{ templateName }}
Your greeting type: {{ greetingType | default('friendly') }}

{% if includeQuote %}

Here's an inspiring quote for you:
"{{ quote | default('The best way to get started is to quit talking and begin doing.') }}"
{% endif %}

Best wishes,
The Unjucks Team
```

Create `template.yml`:
```yaml
name: "Personal Greeting Generator"
description: "Generates a personalized greeting file"
version: "1.0.0"
category: "demo"

variables:
  name:
    type: string
    required: true
    description: "Your name"
    example: "Alice"
  
  greetingType:
    type: string
    enum: ["friendly", "formal", "casual", "enthusiastic"]
    default: "friendly"
    description: "Type of greeting"
  
  includeQuote:
    type: boolean
    default: false
    description: "Include an inspirational quote"
  
  quote:
    type: string
    required: false
    description: "Custom quote (only if includeQuote is true)"
    when: "{{ includeQuote }}"
```

**Step 3**: Test your template
```bash
# Go back to project root
cd ../..

# Generate a greeting
unjucks generate greeting --name "Alice" --greetingType "enthusiastic" --includeQuote true

# Check the result
cat greetings/alice.txt
```

**Expected Output**: A personalized greeting file in the `greetings/` directory.

### Challenge 2: React Component with Tests (30 minutes)
Build a comprehensive React component generator that creates the component, test file, and story file.

**Objective**: Learn multi-file generation, conditional logic, and template composition.

**Step 1**: Create the template structure
```bash
mkdir -p templates/react-component/{partials,examples}
cd templates/react-component
```

**Step 2**: Create the main template (`index.njk`)
```nunjucks
---
files:
  component:
    to: "src/components/{{ name }}/{{ name }}.tsx"
    template: "component.njk"
  
  test:
    to: "src/components/{{ name }}/{{ name }}.test.tsx"
    template: "test.njk"
    condition: "{{ generateTests | default(true) }}"
  
  story:
    to: "src/components/{{ name }}/{{ name }}.stories.tsx"
    template: "story.njk"
    condition: "{{ generateStorybook | default(false) }}"
  
  index:
    to: "src/components/{{ name }}/index.ts"
    template: "index.njk"
  
  types:
    to: "src/components/{{ name }}/types.ts"
    template: "types.njk"
    condition: "{{ hasComplexProps }}"
---
{# This template generates multiple files #}
```

**Step 3**: Create `component.njk`
```nunjucks
{% include "partials/file-header.njk" %}
import React{% if hasState %}, { useState }{% endif %}{% if hasEffect %}, { useEffect }{% endif %} from 'react';
{% if hasComplexProps %}
import type { {{ name }}Props } from './types';
{% endif %}

{% if not hasComplexProps and hasProps %}
interface {{ name }}Props {
  {% for prop in props %}
  {{ prop.name }}{{ '?' if prop.optional }}: {{ prop.type }};
  {% endfor %}
}
{% endif %}

export const {{ name }}: React.FC<{% if hasProps %}{{ name }}Props{% endif %}> = ({
  {% for prop in props %}{{ prop.name }}{% if prop.defaultValue %} = {{ prop.defaultValue }}{% endif %}{% if not loop.last %},{% endif %}
  {% endfor %}
}) => {
  {% if hasState %}
  const [{{ stateVariable }}, set{{ stateVariable | pascalCase }}] = useState<{{ stateType }}>({{ initialState }});
  {% endif %}

  {% if hasEffect %}
  useEffect(() => {
    // Effect logic here
    {{ effectLogic | default('// Add your effect logic') }}
  }, [{{ effectDependencies | join(', ') }}]);
  {% endif %}

  return (
    <div className="{{ name | kebab }}" data-testid="{{ name | kebab }}">
      {% if hasProps and props.length > 0 %}
      {/* Props: {{ props | map(attribute='name') | join(', ') }} */}
      {% endif %}
      {/* Component content goes here */}
      <h1>{{ name }} Component</h1>
      {% if hasChildren %}
      {children}
      {% endif %}
    </div>
  );
};

export default {{ name }};
```

**Step 4**: Create `test.njk`
```nunjucks
{% include "partials/file-header.njk" %}
import { render, screen{% if hasUserInteraction %}, fireEvent{% endif %} } from '@testing-library/react';
import { {{ name }} } from './{{ name }}';

describe('{{ name }}', () => {
  it('should render successfully', () => {
    render(<{{ name }}{% if hasProps %} {{ testProps }}{% endif %} />);
    expect(screen.getByTestId('{{ name | kebab }}')).toBeInTheDocument();
  });

  {% if hasProps %}
  it('should display props correctly', () => {
    const testProps = {{ testPropsExample | dump }};
    render(<{{ name }} {...testProps} />);
    
    {% for prop in props %}
    {% if prop.testable %}
    // Test {{ prop.name }} prop
    expect(screen.getByTestId('{{ name | kebab }}')).toHaveTextContent(testProps.{{ prop.name }});
    {% endif %}
    {% endfor %}
  });
  {% endif %}

  {% if hasUserInteraction %}
  it('should handle user interactions', () => {
    const mockHandler = jest.fn();
    render(<{{ name }} {% for prop in props %}{% if prop.isHandler %}{{ prop.name }}={mockHandler}{% endif %}{% endfor %} />);
    
    // Simulate user interaction
    fireEvent.click(screen.getByTestId('{{ name | kebab }}'));
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });
  {% endif %}

  {% if hasState %}
  it('should manage state correctly', () => {
    render(<{{ name }}{% if hasProps %} {{ testProps }}{% endif %} />);
    
    // Test initial state
    expect(screen.getByTestId('{{ name | kebab }}')).toHaveTextContent('{{ initialState }}');
    
    // Test state changes if applicable
    // Add specific state testing logic here
  });
  {% endif %}
});
```

**Step 5**: Create supporting files

`partials/file-header.njk`:
```nunjucks
/**
 * {{ name }} Component
 * 
 * Generated by Unjucks on {{ now | date('YYYY-MM-DD HH:mm:ss') }}
 * 
 * @description {{ description | default('A React component generated by Unjucks') }}
 * @author {{ author | default('Generated by Unjucks') }}
 * @version {{ version | default('1.0.0') }}
 */
```

`template.yml`:
```yaml
name: "React Component Generator"
description: "Generates a complete React component with tests and stories"
version: "2.0.0"
category: "react"
tags: ["react", "typescript", "component", "testing"]

variables:
  name:
    type: string
    required: true
    description: "Component name in PascalCase"
    pattern: "^[A-Z][a-zA-Z0-9]*$"
    example: "UserProfile"
  
  description:
    type: string
    required: false
    description: "Component description"
    example: "A user profile display component"
  
  hasProps:
    type: boolean
    default: false
    description: "Whether the component accepts props"
  
  props:
    type: array
    required: false
    description: "Component props definition"
    when: "{{ hasProps }}"
    items:
      type: object
      properties:
        name:
          type: string
          required: true
        type:
          type: string
          required: true
        optional:
          type: boolean
          default: false
        defaultValue:
          type: string
        testable:
          type: boolean
          default: true
        isHandler:
          type: boolean
          default: false
  
  hasState:
    type: boolean
    default: false
    description: "Whether the component has local state"
  
  stateVariable:
    type: string
    required: false
    when: "{{ hasState }}"
    description: "State variable name"
    example: "value"
  
  stateType:
    type: string
    default: "string"
    when: "{{ hasState }}"
    description: "TypeScript type for state"
  
  initialState:
    type: string
    default: "''"
    when: "{{ hasState }}"
    description: "Initial state value"
  
  hasEffect:
    type: boolean
    default: false
    description: "Whether the component uses useEffect"
  
  generateTests:
    type: boolean
    default: true
    description: "Generate test file"
  
  generateStorybook:
    type: boolean
    default: false
    description: "Generate Storybook story file"

computed:
  hasComplexProps: "{{ hasProps and props.length > 3 }}"
  hasUserInteraction: "{{ props and props.some(p => p.isHandler) }}"
  testProps: "{{ props | map(attribute='name') | join('={mockProps.') | prepend('{') | append('}') if hasProps else '' }}"
  testPropsExample: |
    {
      {% for prop in props %}
      {{ prop.name }}: "test-{{ prop.name }}"{% if not loop.last %},{% endif %}
      {% endfor %}
    }
```

**Step 6**: Test the generator
```bash
cd ../.. # Back to project root

# Generate a simple component
unjucks generate react-component \
  --name UserCard \
  --description "A user card component" \
  --hasProps true \
  --props '[
    {"name": "userName", "type": "string", "testable": true},
    {"name": "email", "type": "string", "testable": true},
    {"name": "onClick", "type": "() => void", "optional": true, "isHandler": true}
  ]' \
  --hasState true \
  --stateVariable "isExpanded" \
  --stateType "boolean" \
  --initialState "false" \
  --generateTests true

# Check generated files
ls -la src/components/UserCard/
cat src/components/UserCard/UserCard.tsx
cat src/components/UserCard/UserCard.test.tsx
```

### Challenge 3: API Route Generator (45 minutes)
Build a comprehensive API route generator that creates endpoints, tests, documentation, and database schemas.

**Objective**: Learn complex template logic, multi-file coordination, and specification integration.

**Setup**: Create `templates/api-route/` with the following structure:

```bash
templates/api-route/
├── index.njk              # Main orchestration template
├── template.yml           # Configuration and variables
├── route.njk             # Express route handler
├── controller.njk        # Controller logic
├── model.njk            # Database model
├── test.njk             # API tests
├── docs.njk             # OpenAPI documentation
└── migration.njk        # Database migration
```

This challenge involves creating a sophisticated generator that demonstrates advanced Unjucks features including specification parsing, database schema generation, and API documentation.

## Progressive Exercise Series

### Series 1: Template Fundamentals (4 exercises)
1. **Hello Template**: Basic variable substitution and file generation
2. **Conditional Content**: Using if/else logic and conditional file generation
3. **Loops and Arrays**: Iterating over data structures
4. **Template Composition**: Using includes and extends

### Series 2: Real-World Generators (6 exercises)
1. **Node.js Express Server**: Complete server setup with middleware
2. **React Application**: Full React app with routing and state management
3. **Database Schemas**: SQL and NoSQL schema generation
4. **Configuration Management**: Environment-specific config generation
5. **Testing Frameworks**: Test setup for different frameworks
6. **Documentation Sites**: Generate documentation from code

### Series 3: Advanced Patterns (4 exercises)
1. **Specification-Driven**: Generate code from OpenAPI specs
2. **Multi-Language**: Templates that work across programming languages
3. **Plugin Architecture**: Create custom Unjucks plugins
4. **AI Integration**: Use Claude for intelligent code completion

### Series 4: Enterprise Projects (6 exercises)
1. **Microservices Architecture**: Generate entire service architectures
2. **DevOps Pipelines**: CI/CD configuration generation
3. **Security Patterns**: Generate secure code patterns
4. **Monitoring and Logging**: Observability stack generation
5. **Multi-Tenant Applications**: SaaS application patterns
6. **Migration Tools**: Legacy system modernization

## Code Sample Library

### Template Patterns
- **File Organization Patterns**: Standard project structures
- **Configuration Patterns**: Environment and build configurations
- **Security Patterns**: Authentication, authorization, and data protection
- **Testing Patterns**: Unit, integration, and e2e testing setups
- **Documentation Patterns**: API docs, README files, and guides

### Integration Examples
- **GitHub Actions**: Automated generation workflows
- **VS Code Extensions**: Editor integration examples
- **Docker**: Containerized generation environments
- **Kubernetes**: Cloud-native deployment patterns
- **Database Migrations**: Schema evolution patterns

### AI-Powered Examples
- **Specification Analysis**: Parse requirements and generate code
- **Code Optimization**: AI-suggested improvements
- **Test Generation**: AI-generated test cases
- **Documentation**: AI-generated API documentation
- **Code Review**: AI-powered code analysis

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue: Template Not Found
```bash
# Problem: unjucks generate my-template
# Error: Template 'my-template' not found

# Solution 1: Check template directory
unjucks list templates

# Solution 2: Verify template structure
ls -la templates/my-template/

# Solution 3: Use full path
unjucks generate ./templates/my-template
```

#### Issue: Variable Validation Fails
```bash
# Problem: Required variable not provided
# Error: Variable 'name' is required but not provided

# Solution 1: Provide required variables
unjucks generate my-template --name "MyComponent"

# Solution 2: Use interactive mode
unjucks generate my-template --interactive

# Solution 3: Use configuration file
echo 'name: MyComponent' > config.yml
unjucks generate my-template --config config.yml
```

#### Issue: Generated Files Not Formatted
```bash
# Problem: Generated code is not properly formatted

# Solution 1: Enable auto-formatting
unjucks generate my-template --format

# Solution 2: Configure prettier in template
# Add to template.yml:
plugins:
  - name: "prettier"
    config:
      parser: "typescript"

# Solution 3: Post-generation hook
# In hooks/post-generate.js:
await context.runCommand('prettier --write generated-file.ts');
```

## Mini-Projects

### Project 1: Personal Blog Generator
**Duration**: 2-3 hours  
**Difficulty**: Beginner  
**Skills**: Basic templating, static site generation, markdown processing

Create a complete blog generator that produces:
- Blog post templates with frontmatter
- Index page with post listings
- RSS feed generation
- Basic CSS styling
- GitHub Pages deployment

### Project 2: REST API Boilerplate
**Duration**: 4-5 hours  
**Difficulty**: Intermediate  
**Skills**: API design, database integration, testing, documentation

Build a comprehensive API generator that creates:
- Express.js server with middleware
- Database models and migrations
- CRUD endpoints with validation
- JWT authentication
- API documentation (OpenAPI/Swagger)
- Jest test suites
- Docker configuration

### Project 3: React Component Library
**Duration**: 6-8 hours  
**Difficulty**: Advanced  
**Skills**: Component architecture, design systems, build tools

Develop a component library generator that produces:
- React components with TypeScript
- Storybook stories and documentation
- Jest tests with React Testing Library
- Build configuration (Rollup/Webpack)
- NPM package configuration
- Design tokens integration
- Accessibility compliance

## Assessment and Validation

### Skill Checkpoints

#### Checkpoint 1: Basic Proficiency
- [ ] Create simple templates with variable substitution
- [ ] Use conditional logic and loops
- [ ] Organize templates with includes and partials
- [ ] Configure template metadata and variables
- [ ] Generate multiple files from a single template

#### Checkpoint 2: Intermediate Competency
- [ ] Build complex multi-file generators
- [ ] Implement template inheritance and composition
- [ ] Use advanced Nunjucks features and filters
- [ ] Create reusable template libraries
- [ ] Integrate with build tools and CI/CD

#### Checkpoint 3: Advanced Mastery
- [ ] Develop specification-driven generators
- [ ] Create AI-powered intelligent templates
- [ ] Build custom plugins and extensions
- [ ] Implement enterprise security and compliance
- [ ] Design scalable template architectures

### Validation Exercises

Each exercise includes:
- **Automated Tests**: Verify generated code functionality
- **Code Quality Checks**: Linting, formatting, and best practices
- **Performance Benchmarks**: Generation speed and resource usage
- **Security Validation**: Security pattern compliance
- **Documentation Review**: Generated documentation quality

### Certification Path

1. **Unjucks Fundamentals Certificate**: Complete Series 1 exercises
2. **Unjucks Developer Certificate**: Complete Series 1-2 exercises plus one mini-project
3. **Unjucks Expert Certificate**: Complete all exercises plus two mini-projects
4. **Unjucks Master Certificate**: Complete all content plus contribute to community templates

## Resources and References

- **Official Documentation**: Complete API and template reference
- **Video Tutorials**: Step-by-step video walkthroughs
- **Community Templates**: Library of community-contributed templates
- **Best Practices Guide**: Patterns and anti-patterns
- **Troubleshooting Database**: Common issues and solutions
- **Performance Optimization**: Tips for fast template generation
- **Security Guidelines**: Secure template development practices