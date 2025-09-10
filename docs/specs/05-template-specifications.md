# Template System Specifications

## 5. Template Specifications

### 5.1 Template Structure

#### 5.1.1 Directory Organization
```
_templates/
├── generator-name/
│   ├── template-name.{ext}.ejs        # EJS template files
│   ├── template-name.{ext}.njk        # Nunjucks template files
│   ├── config.yml                     # Generator configuration
│   ├── meta.yml                       # Generator metadata
│   └── {{ dynamicName | filter }}.ext # Dynamic filename templates
└── category/
    └── generator/
        └── templates...
```

#### 5.1.2 File Naming Conventions
- **Template Files**: `{name}.{extension}.{engine}`
  - `component.tsx.ejs` - EJS template for TypeScript React component
  - `api.ts.njk` - Nunjucks template for TypeScript API
  - `{{ name | kebabCase }}.vue` - Dynamic filename with filters

- **Configuration Files**: 
  - `config.yml` - Template configuration and variables
  - `meta.yml` - Generator metadata and documentation

#### 5.1.3 Metadata Requirements
All generators MUST include a `meta.yml` file with:
- `name` - Display name
- `description` - Generator purpose
- `category` - Categorization
- `complexity` - Difficulty level (simple, intermediate, advanced)
- `tags` - Searchable keywords
- `author` - Creator information
- `version` - Semantic version

### 5.2 Template Syntax

#### 5.2.1 Nunjucks Syntax Support
```nunjucks
{# Comments #}
{{ variable }}                    # Variable output
{{ variable | filter }}           # With filters
{% if condition %}...{% endif %}  # Conditionals
{% for item in array %}...{% endfor %} # Loops
{% set variable = value %}        # Variable assignment
{% include "partial.njk" %}       # Template inclusion
```

#### 5.2.2 EJS Syntax Support
```ejs
<%# Comments %>
<%= variable %>                   # Escaped output
<%- variable %>                   # Raw output
<% if (condition) { %>...<% } %>  # Conditionals
<% for (const item of array) { %>...<% } %> # Loops
<% const variable = value; %>     # Variable assignment
<%- include('partial.ejs') %>     # Template inclusion
```

#### 5.2.3 Variable Declaration Format
Variables are declared in frontmatter YAML:
```yaml
variables:
  name:
    type: string
    required: true
    description: Component name
    pattern: "^[A-Z][a-zA-Z0-9]*$"
  
  withProps:
    type: boolean
    default: false
    description: Include props interface
  
  methods:
    type: array
    default: ['get', 'post']
    choices: ['get', 'post', 'put', 'delete']
    description: HTTP methods to include
```

#### 5.2.4 Conditional Logic Rules
```nunjucks
{% if withAuth %}
import { authenticate } from '../middleware/auth';
{% endif %}

{% if method == 'get' %}
this.router.get('/', this.getHandler);
{% endif %}
```

#### 5.2.5 Loop Constructs
```nunjucks
{% for method in methods %}
  {% if method == 'get' %}
  private get{{ name | pascalCase }} = async (req: Request, res: Response) => {
    // Implementation
  };
  {% endif %}
{% endfor %}
```

### 5.3 Frontmatter Format

#### 5.3.1 Required Fields
```yaml
---
to: path/to/{{ name | kebabCase }}.ts
---
```

#### 5.3.2 Optional Metadata
```yaml
---
to: src/components/{{ name | pascalCase }}.tsx
variables:
  name:
    type: string
    required: true
    description: Component name
inject: false              # File creation mode
append: false              # Append to existing file
prepend: false             # Prepend to existing file
lineAt: 0                  # Insert at specific line
before: "// BEFORE_MARKER" # Inject before pattern
after: "// AFTER_MARKER"   # Inject after pattern
skipIf: "{{ name == 'skip' }}" # Skip condition
chmod: "755"               # File permissions
sh: "npm install"          # Post-generation command
---
```

#### 5.3.3 Injection Directives
```yaml
---
to: src/app.ts
inject: true
after: "// ROUTES_START"
skipIf: "{{ routeName == 'existing' }}"
---
// New route: {{ routeName }}
app.use('/{{ routeName | kebabCase }}', {{ routeName }}Router);
```

#### 5.3.4 RDF/Semantic Configuration
```yaml
---
to: api/{{ operationId | kebabCase }}.ts
rdf:
  source: schemas/openapi.ttl
  type: file
  prefixes:
    - "@prefix api: <http://api.example.com/> ."
    - "@prefix schema: <http://schema.org/> ."
sparql: |
  SELECT ?operationId ?method ?path
  WHERE {
    ?operation api:operationId "{{ operationId }}" ;
               api:method ?method ;
               api:path ?path .
  }
---
```

### 5.4 Variable System

#### 5.4.1 Variable Naming Rules
- **camelCase** for JavaScript/TypeScript variables
- **PascalCase** for class/component names
- **kebab-case** for filenames and URLs
- **snake_case** for database fields
- **SCREAMING_SNAKE_CASE** for constants

#### 5.4.2 Type Specifications
```yaml
variables:
  # String types
  name:
    type: string
    required: true
    pattern: "^[A-Z][a-zA-Z0-9]*$"
    minLength: 1
    maxLength: 50
  
  # Boolean types
  withAuth:
    type: boolean
    default: false
  
  # Number types
  port:
    type: number
    default: 3000
    minimum: 1000
    maximum: 65535
  
  # Array types
  methods:
    type: array
    default: ['get']
    choices: ['get', 'post', 'put', 'delete', 'patch']
  
  # Object types
  database:
    type: object
    properties:
      host: { type: string, default: "localhost" }
      port: { type: number, default: 5432 }
      name: { type: string, required: true }
```

#### 5.4.3 Default Values
```yaml
variables:
  environment:
    type: string
    default: "development"
    choices: ["development", "staging", "production"]
  
  features:
    type: array
    default: []
    description: "Optional features to include"
```

#### 5.4.4 Validation Rules
```yaml
variables:
  email:
    type: string
    required: true
    pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
    description: "Valid email address"
  
  version:
    type: string
    pattern: "^\\d+\\.\\d+\\.\\d+$"
    description: "Semantic version (e.g., 1.0.0)"
  
  className:
    type: string
    required: true
    pattern: "^[A-Z][a-zA-Z0-9]*$"
    description: "Valid class name in PascalCase"
```

### 5.5 Generator Configuration

#### 5.5.1 Generator Types
```yaml
# meta.yml
name: "React Component Generator"
category: "frontend"
complexity: "simple"
type: "component"          # component, api, database, config, test
framework: "react"         # react, vue, angular, express, nextjs
language: "typescript"     # typescript, javascript, python, go
```

#### 5.5.2 Template Discovery
Templates are discovered by:
1. **Directory Structure**: `_templates/{generator}/{template}`
2. **File Extensions**: `.ejs`, `.njk`, `.hbs` (planned)
3. **Metadata Files**: `config.yml`, `meta.yml`

#### 5.5.3 Priority Rules
1. **Exact Match**: Generator name matches exactly
2. **Category Match**: Templates in same category
3. **Fuzzy Match**: Partial name matching
4. **Tag Match**: Matching tags in metadata

#### 5.5.4 Override Mechanisms
```yaml
# Local config overrides global defaults
# Project _templates/ override global templates
# Command-line flags override config values

# Override example in unjucks.config.js
export default {
  templatesDir: 'my-templates',
  overrides: {
    'react-component': {
      defaultProps: true,
      typescript: true
    }
  }
}
```

### 5.6 Advanced Features

#### 5.6.1 Dynamic Filenames
```yaml
---
to: "src/{{ category }}/{{ name | kebabCase }}/index.ts"
---
export { {{ name | pascalCase }} } from './{{ name | kebabCase }}';
```

#### 5.6.2 Multi-File Generation
```yaml
---
to: "src/{{ name | kebabCase }}.ts"
---
# Main file content

---
to: "src/{{ name | kebabCase }}.test.ts"
inject: false
---
# Test file content

---
to: "src/index.ts"
inject: true
after: "// EXPORTS"
---
export * from './{{ name | kebabCase }}';
```

#### 5.6.3 Custom Filters
```javascript
// Register custom filters
nunjucks.addFilter('customCase', (str) => {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
});

// Use in templates
{{ componentName | customCase }}  # myComponent -> my_component
```

#### 5.6.4 Template Inheritance
```nunjucks
{# base-component.njk #}
{% block imports %}{% endblock %}

{% block interface %}{% endblock %}

export const {{ name | pascalCase }} = () => {
  {% block implementation %}
  return <div>Default implementation</div>;
  {% endblock %}
};

{# react-component.njk #}
{% extends "base-component.njk" %}

{% block imports %}
import React from 'react';
{% endblock %}

{% block implementation %}
return (
  <div className="{{ name | kebabCase }}">
    <h1>{{ name | titleCase }}</h1>
  </div>
);
{% endblock %}
```

#### 5.6.5 Built-in Filters
```nunjucks
{{ name | camelCase }}      # userProfile
{{ name | pascalCase }}     # UserProfile
{{ name | kebabCase }}      # user-profile
{{ name | snakeCase }}      # user_profile
{{ name | titleCase }}      # User Profile
{{ name | upperCase }}      # USER PROFILE
{{ name | lowerCase }}      # user profile
{{ name | pluralize }}      # users (from user)
{{ name | singularize }}    # user (from users)
```

### 5.7 Validation Criteria

#### 5.7.1 Template Validation
- **Syntax Check**: Valid Nunjucks/EJS syntax
- **Variable Check**: All used variables declared
- **Frontmatter Validation**: Valid YAML structure
- **Path Validation**: Valid output paths
- **Injection Safety**: Safe injection patterns

#### 5.7.2 Generator Validation
- **Metadata Presence**: Required meta.yml fields
- **Template Consistency**: All templates use same variables
- **Example Validity**: Working example commands
- **Documentation**: Complete variable descriptions

#### 5.7.3 Runtime Validation
```yaml
variables:
  port:
    type: number
    validate: |
      if (value < 1000 || value > 65535) {
        throw new Error('Port must be between 1000 and 65535');
      }
```

### 5.8 Error Handling

#### 5.8.1 Template Syntax Errors
```javascript
try {
  const rendered = nunjucks.render(templatePath, variables);
} catch (error) {
  throw new TemplateError(
    `Syntax error in template ${templatePath}`,
    { cause: error, templatePath, line: error.lineno }
  );
}
```

#### 5.8.2 Variable Validation Errors
```javascript
const missingRequired = requiredVars.filter(name => 
  variables[name] === undefined
);

if (missingRequired.length > 0) {
  throw new ValidationError(
    `Missing required variables: ${missingRequired.join(', ')}`
  );
}
```

#### 5.8.3 File System Errors
```javascript
try {
  await fs.writeFile(outputPath, content);
} catch (error) {
  throw new FileSystemError(
    `Failed to write file: ${outputPath}`,
    { cause: error, path: outputPath }
  );
}
```

### 5.9 Performance Considerations

#### 5.9.1 Template Caching
- Compiled templates cached in memory
- Cache invalidation on file changes
- Memory limits and LRU eviction

#### 5.9.2 Large File Handling
- Stream-based processing for large outputs
- Chunked injection for large files
- Progress reporting for long operations

#### 5.9.3 Concurrent Generation
- Parallel template processing
- Dependency-aware ordering
- Resource pooling for file operations

---

*This specification defines the complete template system architecture for Unjucks, ensuring consistent behavior, security, and maintainability across all template operations.*