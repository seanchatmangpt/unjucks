# Integration with Existing Unjucks Features

This guide shows how spec-driven development seamlessly integrates with existing Unjucks features like templates, generators, and customization capabilities.

## 🔗 Integration Architecture

Spec-driven development enhances Unjucks' existing template system rather than replacing it:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Specification  │───▶│  Spec Parser    │───▶│   Context       │
│   (YAML/JSON)   │    │   & Validator   │    │   Builder       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Generated     │◀───│    Nunjucks     │◀───│   Existing      │
│     Output      │    │    Renderer     │    │   Templates     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📁 Template Structure with Spec Support

Your existing template structure can coexist with spec-driven generation:

```
templates/
├── _templates/
│   ├── api/              # Traditional generators
│   │   ├── new/
│   │   │   ├── index.js.ejs
│   │   │   ├── controller.js.ejs
│   │   │   └── prompt.js
│   │   └── model/
│   │       └── ...
│   └── spec/             # Spec-driven generators
│       ├── rest-api/
│       │   ├── entity.ts.ejs      # Enhanced with spec context
│       │   ├── controller.ts.ejs
│       │   ├── routes.ts.ejs
│       │   └── _spec.yaml         # Template specification
│       ├── frontend/
│       │   ├── component.tsx.ejs
│       │   ├── page.tsx.ejs
│       │   └── _spec.yaml
│       └── microservice/
│           └── ...
├── specs/                # Your project specifications
│   ├── api.spec.yaml
│   ├── frontend.spec.yaml
│   └── microservice.spec.yaml
└── unjucks.config.ts     # Configuration
```

## 🎯 Enhanced Template Context

Spec-driven generation provides rich context to your existing templates:

### Traditional Template Context
```javascript
// Traditional Unjucks context
{
  name: "User",
  fields: ["name", "email"],
  // Limited context
}
```

### Spec-Enhanced Context
```javascript
// Spec-driven context
{
  // Original spec context
  spec: {
    entities: [...],
    endpoints: [...],
    middleware: [...],
    // Full specification
  },
  
  // Current entity/component context
  entity: {
    name: "User",
    fields: [
      { name: "id", type: "uuid", primaryKey: true },
      { name: "email", type: "string", unique: true, validation: ["email"] }
    ],
    relationships: [...],
    methods: [...]
  },
  
  // Generated helpers
  helpers: {
    toPascalCase,
    toCamelCase,
    toSnakeCase,
    pluralize,
    singularize,
    // Spec-specific helpers
    getValidationRules,
    getRelationshipImports,
    generateSwaggerDoc
  },
  
  // Configuration
  config: {
    framework: "express",
    language: "typescript",
    database: "postgresql"
  }
}
```

## 🔧 Template Enhancement Examples

### 1. Enhanced Entity Template

```typescript
// templates/_templates/spec/rest-api/entity.ts.ejs
---
to: src/entities/<%= entity.name %>.ts
inject: false
skip_if: <%= !spec.database %>
---
import { Entity, Column, PrimaryGeneratedColumn<% if (entity.relationships && entity.relationships.length > 0) { %>, OneToMany, ManyToOne<% } %> } from 'typeorm';
<% if (entity.fields.some(f => f.validation)) { %>import { IsEmail, IsNotEmpty, Length<% if (entity.fields.some(f => f.type === 'uuid')) { %>, IsUUID<% } %> } from 'class-validator';<% } %>
<% entity.relationships?.forEach(rel => { %>
import { <%= rel.target %> } from './<%= rel.target %>';
<% }); %>

@Entity('<%= helpers.toSnakeCase(helpers.pluralize(entity.name)) %>')
export class <%= entity.name %> {
<% entity.fields.forEach(field => { %>
  <% if (field.primaryKey) { %>
  @PrimaryGeneratedColumn('<%= field.type %>')
  <% } else { %>
  @Column(<%= field.unique ? '{ unique: true }' : '' %>)
  <% } %>
  <% if (field.validation) { %>
  <% field.validation.forEach(validation => { %>
  <% if (validation === 'email') { %>@IsEmail()<% } %>
  <% if (validation === 'required') { %>@IsNotEmpty()<% } %>
  <% if (field.type === 'uuid') { %>@IsUUID()<% } %>
  <% }); %>
  <% } %>
  <%= field.name %>: <%= helpers.mapTypeToTypeScript(field.type) %>;

<% }); %>
<% entity.relationships?.forEach(rel => { %>
  @<%= rel.type === 'hasMany' ? 'OneToMany' : 'ManyToOne' %>(() => <%= rel.target %><% if (rel.foreignKey) { %>, <%= rel.target.toLowerCase() %> => <%= rel.target.toLowerCase() %>.<%= rel.foreignKey %><% } %>)
  <%= rel.name %>: <%= rel.type === 'hasMany' ? `${rel.target}[]` : rel.target %>;

<% }); %>
<% entity.methods?.forEach(method => { %>
  <% if (method.type === 'static') { %>static <% } %><%= method.name %>(<% method.parameters?.forEach((param, index) => { %><%= param.name %>: <%= helpers.mapTypeToTypeScript(param.type) %><% if (index < method.parameters.length - 1) { %>, <% } %><% }); %>): <%= helpers.mapTypeToTypeScript(method.returns) %> {
    // Implementation generated from spec
    <% if (method.name === 'validatePassword') { %>
    return bcrypt.compareSync(password, this.password);
    <% } else if (method.name === 'findByEmail') { %>
    return this.createQueryBuilder().where('email = :email', { email }).getOne();
    <% } else { %>
    throw new Error('Method implementation not generated');
    <% } %>
  }

<% }); %>
}
```

### 2. Smart Route Generation

```typescript
// templates/_templates/spec/rest-api/routes.ts.ejs
---
to: src/routes/<%= helpers.pluralize(entity.name.toLowerCase()) %>.ts
inject: false
---
import { Router } from 'express';
import { <%= entity.name %>Controller } from '../controllers/<%= entity.name.toLowerCase() %>Controller';
<% if (spec.middleware) { %>
<% spec.middleware.filter(m => m.name === 'validation').forEach(m => { %>
import { validate } from '../middleware/validation';
<% }); %>
<% } %>
import { <%= entity.name %> } from '../entities/<%= entity.name %>';

const router = Router();
const <%= entity.name.toLowerCase() %>Controller = new <%= entity.name %>Controller();

<% spec.endpoints.filter(endpoint => endpoint.path.includes(entity.name.toLowerCase())).forEach(endpoint => { %>
/**
 * @route <%= endpoint.method.toUpperCase() %> <%= endpoint.path %>
 * @desc <%= endpoint.description %>
 * @access <%= endpoint.security === 'bearer' ? 'Private' : 'Public' %>
 */
router.<%= endpoint.method.toLowerCase() %>('<%= endpoint.path.replace(`/${helpers.pluralize(entity.name.toLowerCase())}`, '') || '/' %>', 
<% if (endpoint.security === 'bearer') { %>  auth,<% } %>
<% if (endpoint.body) { %>  validate(<%= entity.name %>),<% } %>
  <%= entity.name.toLowerCase() %>Controller.<%= helpers.getControllerMethod(endpoint.method, endpoint.path) %>
);

<% }); %>

export default router;
```

## 🎨 Custom Template Helpers

Extend Unjucks with spec-aware helpers:

```javascript
// unjucks.config.ts
import { defineConfig } from 'unjucks';

export default defineConfig({
  helpers: {
    // Existing helpers work as before
    pascalCase: (str) => str.charAt(0).toUpperCase() + str.slice(1),
    
    // New spec-aware helpers
    getValidationRules: (field) => {
      if (!field.validation) return '';
      return field.validation.map(rule => {
        if (typeof rule === 'string') return `@${capitalize(rule)}()`;
        if (typeof rule === 'object') {
          const [key, value] = Object.entries(rule)[0];
          return `@${capitalize(key)}(${value})`;
        }
      }).join('\n  ');
    },
    
    mapTypeToTypeScript: (type) => {
      const typeMap = {
        string: 'string',
        integer: 'number',
        uuid: 'string',
        datetime: 'Date',
        boolean: 'boolean',
        object: 'object',
        array: 'any[]'
      };
      return typeMap[type] || 'any';
    },
    
    getControllerMethod: (method, path) => {
      const methodMap = {
        'GET': path.includes(':id') ? 'getById' : 'getAll',
        'POST': 'create',
        'PUT': 'update',
        'DELETE': 'delete'
      };
      return methodMap[method.toUpperCase()] || 'handle';
    },
    
    generateSwaggerDoc: (endpoint) => {
      return {
        summary: endpoint.description,
        parameters: endpoint.parameters || [],
        requestBody: endpoint.body,
        responses: endpoint.response
      };
    }
  }
});
```

## 🔄 Hybrid Generation Workflow

Combine spec-driven and traditional generation:

```bash
# 1. Generate from specification (structure and boilerplate)
unjucks generate-from-spec api.spec.yaml --output ./src

# 2. Use traditional generators for specific customizations
unjucks generate api controller User --custom-logic --output ./src/controllers

# 3. Add specific components with traditional approach
unjucks generate component ErrorBoundary --framework react --output ./src/components

# 4. Update spec and regenerate (preserves custom code)
unjucks generate-from-spec api.spec.yaml --merge --output ./src
```

## 🎭 Advanced Integration Patterns

### 1. Conditional Template Loading

```yaml
# templates/_templates/spec/rest-api/_spec.yaml
conditions:
  entity_template:
    enabled: "spec.database.type === 'postgresql'"
    template: "entity-postgres.ts.ejs"
  entity_template_mongo:
    enabled: "spec.database.type === 'mongodb'"
    template: "entity-mongo.ts.ejs"
```

### 2. Multi-Stage Generation

```javascript
// unjucks.config.ts
export default defineConfig({
  specDriven: {
    stages: [
      // Stage 1: Core structure
      {
        name: 'core',
        templates: ['entity', 'controller', 'routes'],
        merge: false
      },
      // Stage 2: Tests and docs
      {
        name: 'auxiliary',
        templates: ['test', 'docs'],
        merge: true,
        dependsOn: ['core']
      },
      // Stage 3: Custom enhancements
      {
        name: 'custom',
        templates: ['custom-*'],
        merge: true,
        interactive: true
      }
    ]
  }
});
```

### 3. Template Inheritance

```yaml
# templates/_templates/spec/base/_spec.yaml
base:
  helpers:
    - dateHelpers
    - stringHelpers
  middleware:
    - validation
    - errorHandling

# templates/_templates/spec/rest-api/_spec.yaml
extends: ../base/_spec.yaml
specific:
  database: true
  authentication: jwt
```

## 🧩 Plugin Integration

Integrate with existing Unjucks plugins:

```javascript
// unjucks.config.ts
import { formatPlugin } from '@unjucks/format-plugin';
import { lintPlugin } from '@unjucks/lint-plugin';
import { specPlugin } from '@unjucks/spec-plugin';

export default defineConfig({
  plugins: [
    formatPlugin({
      prettier: true,
      eslint: true
    }),
    lintPlugin({
      rules: ['typescript', 'react']
    }),
    specPlugin({
      validation: true,
      documentation: true,
      testing: true
    })
  ],
  
  specDriven: {
    // Plugins apply to spec-driven generation
    applyPlugins: true,
    
    // Plugin-specific configuration
    formatting: {
      autoFormat: true,
      rules: 'spec-driven'
    }
  }
});
```

## 📊 Migration Strategies

### Gradual Migration

```bash
# 1. Start with a simple specification for new features
unjucks create-spec --minimal --output ./specs/new-feature.spec.yaml

# 2. Generate alongside existing code
unjucks generate-from-spec specs/new-feature.spec.yaml --output ./src --prefix new-

# 3. Gradually convert existing generators to spec-aware
unjucks convert-generator _templates/api/new --spec-aware

# 4. Consolidate into comprehensive specification
unjucks merge-specs specs/*.spec.yaml --output ./specs/main.spec.yaml
```

### Full Migration

```bash
# 1. Analyze existing templates and generate specification
unjucks analyze-templates _templates/ --generate-spec ./specs/inferred.spec.yaml

# 2. Review and refine generated specification
unjucks validate-spec specs/inferred.spec.yaml --suggestions

# 3. Test generation with existing codebase
unjucks generate-from-spec specs/inferred.spec.yaml --dry-run --compare ./src

# 4. Generate with backup
unjucks generate-from-spec specs/inferred.spec.yaml --output ./src --backup
```

## 🔍 Debugging Integration

### Template Context Debugging

```bash
# Debug spec-driven context
unjucks debug-context specs/api.spec.yaml --template entity.ts.ejs

# Compare traditional vs spec-driven context
unjucks debug-context --traditional user --spec specs/api.spec.yaml --entity User
```

### Generation Tracing

```bash
# Trace generation process
unjucks generate-from-spec specs/api.spec.yaml --trace --output ./debug

# Analyze template resolution
unjucks trace-templates specs/api.spec.yaml --verbose
```

## 🚀 Performance Optimization

### Template Caching

```javascript
// unjucks.config.ts
export default defineConfig({
  cache: {
    // Cache compiled templates
    templates: true,
    // Cache spec parsing
    specs: true,
    // Cache helper functions
    helpers: true,
    // TTL in seconds
    ttl: 3600
  }
});
```

### Parallel Generation

```javascript
// unjucks.config.ts
export default defineConfig({
  specDriven: {
    parallel: {
      enabled: true,
      // Number of concurrent generators
      workers: 4,
      // Batch size for entity processing
      batchSize: 10
    }
  }
});
```

## 📝 Best Practices for Integration

### 1. Template Organization
```
templates/
├── _legacy/          # Keep existing templates
├── _spec/            # New spec-driven templates
├── _shared/          # Shared partials and helpers
└── _migration/       # Transition templates
```

### 2. Gradual Enhancement
- Start with simple spec-driven generators
- Keep existing templates working
- Gradually migrate complex generators
- Use feature flags for rollback

### 3. Context Compatibility
- Design templates to work with both contexts
- Use defensive programming in templates
- Provide fallbacks for missing spec context
- Test with both generation methods

### 4. Configuration Strategy
```javascript
// unjucks.config.ts
export default defineConfig({
  // Maintain backward compatibility
  legacy: {
    templates: '_templates',
    helpers: './helpers',
    enabled: true
  },
  
  // Enable new spec-driven features
  specDriven: {
    templates: '_templates/spec',
    enabled: true,
    fallback: 'legacy'
  }
});
```

---

*Next: Discover [AI-powered workflows](./ai-workflows.md) that leverage MCP for intelligent spec generation.*