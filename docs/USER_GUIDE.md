# Unjucks User Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [CLI Commands](#cli-commands)
5. [Template Development](#template-development)
6. [Semantic Web Features](#semantic-web-features)
7. [Advanced Usage](#advanced-usage)
8. [Configuration](#configuration)
9. [Troubleshooting](#troubleshooting)
10. [Examples](#examples)

## Introduction

Unjucks is a powerful CLI template generator that combines the simplicity of Hygen-style scaffolding with advanced semantic web capabilities. It supports RDF/Turtle ontologies, making it ideal for modern web development and enterprise applications.

### Key Features
- **Hygen-style Templates**: Familiar template syntax and structure
- **Semantic Web Integration**: RDF/Turtle support with N3.js
- **Multiple Output Formats**: Support for various programming languages
- **Enterprise Ready**: Production-grade features and security
- **Extensible Architecture**: Plugin system for custom functionality

## Installation

### Prerequisites
- Node.js ≥18.0.0
- npm or yarn package manager
- Git (for template repositories)

### Global Installation
```bash
# Install globally via npm
npm install -g @seanchatmangpt/unjucks

# Verify installation
unjucks --version
```

### Local Installation
```bash
# Install in project
npm install @seanchatmangpt/unjucks

# Use via npx
npx unjucks --help
```

### Development Installation
```bash
# Clone repository
git clone https://github.com/unjucks/unjucks.git
cd unjucks

# Install dependencies
npm install

# Link for global use
npm link
```

## Quick Start

### Basic Usage
```bash
# List available templates
unjucks list

# Generate from template (Hygen-style)
unjucks component react MyComponent

# Generate with explicit syntax
unjucks generate component react MyComponent

# Preview before generation
unjucks preview component react MyComponent
```

### First Template Generation
1. **Choose a Generator**: List available generators
   ```bash
   unjucks list
   ```

2. **Generate Code**: Use Hygen-style positional syntax
   ```bash
   unjucks api endpoint users
   ```

3. **Customize**: Add flags and options
   ```bash
   unjucks api endpoint users --auth --validation
   ```

## CLI Commands

### Primary Commands

#### `unjucks generate`
Generate files from templates.
```bash
# Basic generation
unjucks generate <generator> <template> [name] [options]

# Examples
unjucks generate component react Button
unjucks generate api endpoint users --withAuth
unjucks generate database migration createUsers
```

#### `unjucks list`
List available generators and templates.
```bash
# List all generators
unjucks list

# List templates for a generator
unjucks list component

# Show detailed information
unjucks list --detailed
```

#### `unjucks init`
Initialize new project or generator.
```bash
# Initialize new project
unjucks init my-project

# Initialize with template
unjucks init my-project --template enterprise

# Create new generator
unjucks init --generator my-generator
```

#### `unjucks inject`
Inject content into existing files.
```bash
# Inject into file
unjucks inject route users --into src/routes/index.js

# Inject with pattern
unjucks inject import --pattern "// IMPORTS" --content "import { User } from './User'"
```

### Advanced Commands

#### `unjucks semantic`
Semantic web and RDF operations.
```bash
# Generate from RDF ontology
unjucks semantic generate --ontology schema.ttl --output models/

# Validate RDF data
unjucks semantic validate --data data.ttl --schema schema.ttl

# Convert formats
unjucks semantic convert --input data.json --output data.ttl --format turtle
```

#### `unjucks github`
GitHub integration and repository management.
```bash
# Analyze repository
unjucks github analyze --repo owner/repository

# Generate from GitHub template
unjucks github template --repo template-repo --output ./

# Setup repository
unjucks github init --name my-repo --template node
```

#### `unjucks migrate`
Migration and upgrade utilities.
```bash
# Migrate from other generators
unjucks migrate --from hygen --to unjucks

# Upgrade templates
unjucks migrate upgrade --version latest

# Database migrations
unjucks migrate database --action create --name createUsers
```

### Command Options

#### Global Options
```bash
--help, -h          Show help information
--version, -v       Show version information
--verbose           Enable verbose output
--dry-run          Preview without writing files
--force            Overwrite existing files
--config           Specify config file path
```

#### Generation Options
```bash
--output, -o        Output directory
--template-path     Custom template path
--data             JSON data file
--vars             Template variables (key=value)
--format           Output format (js, ts, py, etc.)
--style            Code style (camelCase, snake_case, etc.)
```

## Template Development

### Template Structure
Templates follow Hygen conventions with enhancements:
```
_templates/
├── generator-name/
│   ├── template-name/
│   │   ├── index.js           # Template configuration
│   │   ├── prompt.js          # Interactive prompts
│   │   └── template.ejs       # Template content
│   └── README.md              # Generator documentation
```

### Basic Template
Create a simple component template:

**`_templates/component/new/index.js`**
```javascript
module.exports = {
  prompt: ({ inquirer }) => {
    const questions = [
      {
        type: 'input',
        name: 'name',
        message: 'Component name?'
      },
      {
        type: 'select',
        name: 'type',
        message: 'Component type?',
        choices: ['functional', 'class']
      }
    ];
    return inquirer.prompt(questions);
  }
};
```

**`_templates/component/new/component.ejs.t`**
```javascript
---
to: src/components/<%= Name %>.jsx
---
<% if (type === 'functional') { -%>
import React from 'react';

const <%= Name %> = () => {
  return (
    <div className="<%= name %>">
      <h1><%= Name %></h1>
    </div>
  );
};

export default <%= Name %>;
<% } else { -%>
import React, { Component } from 'react';

class <%= Name %> extends Component {
  render() {
    return (
      <div className="<%= name %>">
        <h1><%= Name %></h1>
      </div>
    );
  }
}

export default <%= Name %>;
<% } -%>
```

### Template Variables
Templates have access to several built-in variables:

#### Case Helpers
```ejs
<%= name %>         <!-- original input -->
<%= Name %>         <!-- PascalCase -->
<%= NAME %>         <!-- UPPER_CASE -->
<%= name %>         <!-- camelCase -->
<%= name %>         <!-- snake_case -->
<%= name %>         <!-- kebab-case -->
```

#### Date Helpers
```ejs
<%= date %>         <!-- Current date -->
<%= timestamp %>    <!-- Unix timestamp -->
<%= iso_date %>     <!-- ISO date string -->
```

#### Path Helpers
```ejs
<%= cwd %>          <!-- Current working directory -->
<%= output_path %>  <!-- Output file path -->
<%= template_path %> <!-- Template source path -->
```

### Advanced Templates

#### Conditional Generation
```javascript
// index.js
module.exports = {
  prompt: ({ inquirer }) => {
    return inquirer.prompt([
      {
        type: 'confirm',
        name: 'includeTests',
        message: 'Include test files?'
      }
    ]);
  }
};
```

```ejs
---
to: <%= includeTests ? `tests/${Name}.test.js` : null %>
---
<% if (includeTests) { -%>
import { <%= Name %> } from '../src/<%= Name %>';

describe('<%= Name %>', () => {
  test('should render correctly', () => {
    expect(<%= Name %>).toBeDefined();
  });
});
<% } -%>
```

#### Multiple File Generation
```javascript
// index.js with multiple files
module.exports = [
  {
    type: 'add',
    path: 'src/components/{{Name}}/index.js',
    templateFile: 'component/new/index.ejs'
  },
  {
    type: 'add',
    path: 'src/components/{{Name}}/{{Name}}.jsx',
    templateFile: 'component/new/component.ejs'
  },
  {
    type: 'add',
    path: 'src/components/{{Name}}/{{Name}}.module.css',
    templateFile: 'component/new/styles.ejs'
  }
];
```

## Semantic Web Features

### RDF/Turtle Support
Unjucks includes comprehensive semantic web capabilities through N3.js integration.

#### Basic RDF Generation
```bash
# Generate TypeScript classes from RDF ontology
unjucks semantic generate \
  --ontology schema/person.ttl \
  --output src/models/ \
  --format typescript \
  --namespace "http://example.com/person#"
```

#### Ontology Example
**`schema/person.ttl`**
```turtle
@prefix ex: <http://example.com/person#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

ex:Person a owl:Class ;
    rdfs:label "Person" ;
    rdfs:comment "A human being" .

ex:name a owl:DatatypeProperty ;
    rdfs:domain ex:Person ;
    rdfs:range rdfs:Literal ;
    rdfs:label "name" .

ex:age a owl:DatatypeProperty ;
    rdfs:domain ex:Person ;
    rdfs:range xsd:integer ;
    rdfs:label "age" .

ex:email a owl:DatatypeProperty ;
    rdfs:domain ex:Person ;
    rdfs:range xsd:string ;
    rdfs:label "email address" .
```

#### Generated Output
**`src/models/Person.ts`**
```typescript
/**
 * A human being
 * Generated from RDF ontology: http://example.com/person#Person
 */
export interface Person {
  /** name */
  name?: string;
  
  /** age */
  age?: number;
  
  /** email address */
  email?: string;
}

export class PersonImpl implements Person {
  constructor(
    public name?: string,
    public age?: number,
    public email?: string
  ) {}
  
  toRDF(): string {
    // RDF serialization logic
  }
  
  static fromRDF(rdf: string): Person {
    // RDF deserialization logic
  }
}
```

### Advanced Semantic Features

#### SPARQL Query Generation
```bash
# Generate SPARQL queries from templates
unjucks semantic query \
  --ontology schema.ttl \
  --template queries/person-queries.sparql.ejs \
  --output queries/person-queries.sparql
```

#### Data Validation
```bash
# Validate RDF data against schema
unjucks semantic validate \
  --data data/persons.ttl \
  --schema schema/person.ttl \
  --output validation-report.json
```

#### Format Conversion
```bash
# Convert between RDF formats
unjucks semantic convert \
  --input data.json \
  --output data.ttl \
  --format turtle \
  --context context.jsonld
```

## Advanced Usage

### Custom Configuration
Create `.unjucks.config.js` in your project root:
```javascript
module.exports = {
  // Template directories
  templates: [
    '_templates',
    'node_modules/@company/templates',
    '~/.unjucks/templates'
  ],
  
  // Default variables
  variables: {
    author: 'Your Name',
    license: 'MIT',
    copyright: new Date().getFullYear()
  },
  
  // Helpers
  helpers: {
    titleCase: (str) => str.replace(/\w\S*/g, (txt) =>
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    )
  },
  
  // Semantic web configuration
  semantic: {
    defaultNamespace: 'http://example.com/',
    prefixes: {
      'ex': 'http://example.com/',
      'schema': 'http://schema.org/'
    }
  },
  
  // Output configuration
  output: {
    directory: './generated',
    overwrite: false,
    backup: true
  }
};
```

### Plugin System
Create custom plugins for extended functionality:

**`plugins/custom-helper.js`**
```javascript
module.exports = {
  name: 'custom-helper',
  type: 'helper',
  
  register(unjucks) {
    unjucks.addHelper('randomId', () => {
      return Math.random().toString(36).substr(2, 9);
    });
    
    unjucks.addHelper('formatDate', (date, format = 'yyyy-mm-dd') => {
      // Date formatting logic
    });
  }
};
```

### Environment Variables
Use environment variables for configuration:
```bash
# Set template path
export UNJUCKS_TEMPLATE_PATH=/custom/templates

# Set default author
export UNJUCKS_AUTHOR="John Doe"

# Enable debug mode
export UNJUCKS_DEBUG=true

# Run with environment
unjucks generate component react Button
```

### Batch Operations
Process multiple templates or data sources:
```bash
# Process multiple components
unjucks batch --config batch.json

# batch.json
{
  "operations": [
    {
      "generator": "component",
      "template": "react",
      "name": "Button",
      "vars": { "type": "primary" }
    },
    {
      "generator": "component", 
      "template": "react",
      "name": "Input",
      "vars": { "type": "text" }
    }
  ]
}
```

## Configuration

### Configuration Files
Unjucks supports multiple configuration formats:

#### `.unjucks.config.js`
```javascript
module.exports = {
  templates: ['_templates'],
  variables: { author: 'John Doe' },
  helpers: { /* custom helpers */ }
};
```

#### `.unjucks.config.json`
```json
{
  "templates": ["_templates"],
  "variables": {
    "author": "John Doe"
  }
}
```

#### `package.json`
```json
{
  "unjucks": {
    "templates": ["_templates"],
    "variables": {
      "author": "John Doe"
    }
  }
}
```

### CLI Configuration
Override configuration via CLI flags:
```bash
# Override template path
unjucks generate component react Button --template-path ./custom-templates

# Set variables
unjucks generate api endpoint users --vars author="Jane Doe" version="1.0"

# Use different config file
unjucks generate component react Button --config ./custom.config.js
```

### Environment-Specific Configuration
Use different configurations for different environments:
```javascript
// .unjucks.config.js
const env = process.env.NODE_ENV || 'development';

const configs = {
  development: {
    output: { directory: './dev-generated' }
  },
  production: {
    output: { directory: './dist-generated' }
  }
};

module.exports = {
  // Base configuration
  templates: ['_templates'],
  
  // Environment-specific overrides
  ...configs[env]
};
```

## Troubleshooting

### Common Issues

#### Installation Issues
**Problem**: "Command not found: unjucks"
**Solutions**:
```bash
# Check installation
npm list -g @seanchatmangpt/unjucks

# Reinstall globally
npm uninstall -g @seanchatmangpt/unjucks
npm install -g @seanchatmangpt/unjucks

# Check PATH
echo $PATH
which unjucks
```

**Problem**: "Permission denied"
**Solutions**:
```bash
# Fix permissions (macOS/Linux)
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Use npm prefix (alternative)
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

#### Template Issues
**Problem**: "Template not found"
**Solutions**:
```bash
# List available templates
unjucks list

# Check template path
unjucks --help

# Verify template structure
ls -la _templates/generator-name/template-name/
```

**Problem**: "Template syntax error"
**Solutions**:
```bash
# Preview template to check syntax
unjucks preview generator template name

# Check EJS syntax
# - Ensure proper opening/closing tags
# - Verify variable names match prompt
# - Check for unclosed conditionals
```

#### Generation Issues
**Problem**: "Output directory not found"
**Solutions**:
```bash
# Create output directory
mkdir -p src/components

# Use --force to create directories
unjucks generate component react Button --force

# Check write permissions
ls -la src/
```

#### Semantic Web Issues
**Problem**: "RDF parsing error"
**Solutions**:
```bash
# Validate RDF syntax
unjucks semantic validate --data schema.ttl

# Check namespace declarations
# Ensure all prefixes are declared
# Verify URI syntax
```

### Debug Mode
Enable debug mode for detailed information:
```bash
# Enable debug output
export DEBUG=unjucks:*
unjucks generate component react Button

# Or use --verbose flag
unjucks generate component react Button --verbose
```

### Log Files
Check log files for errors:
```bash
# View logs (Unix-like systems)
tail -f ~/.unjucks/logs/unjucks.log

# View logs (Windows)
type %USERPROFILE%\.unjucks\logs\unjucks.log
```

## Examples

### Example 1: React Component Generator
Create a complete React component with tests and styles.

**Template Structure**:
```
_templates/
└── react/
    └── component/
        ├── index.js
        ├── component.ejs.t
        ├── test.ejs.t
        └── styles.ejs.t
```

**Generate**:
```bash
unjucks react component MyButton --props "text,onClick,disabled"
```

**Output**:
```
src/
├── components/
│   └── MyButton/
│       ├── index.js
│       ├── MyButton.jsx
│       ├── MyButton.test.js
│       └── MyButton.module.css
```

### Example 2: API Endpoint Generator
Generate Express.js API endpoints with validation and tests.

**Generate**:
```bash
unjucks api endpoint users --methods "GET,POST,PUT,DELETE" --auth jwt
```

**Output**:
```
src/
├── routes/
│   └── users.js
├── controllers/
│   └── usersController.js
├── middleware/
│   └── usersValidation.js
└── tests/
    └── users.test.js
```

### Example 3: Database Model Generator
Generate database models with migrations and seeders.

**Generate**:
```bash
unjucks database model User --fields "name:string,email:string,age:integer"
```

**Output**:
```
src/
├── models/
│   └── User.js
├── migrations/
│   └── 20240101000000_create_users_table.js
└── seeds/
    └── users_seeder.js
```

### Example 4: Semantic Web Class Generation
Generate TypeScript classes from RDF ontology.

**RDF Input**:
```turtle
@prefix ex: <http://example.com/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

ex:Product a owl:Class .
ex:name a owl:DatatypeProperty .
ex:price a owl:DatatypeProperty .
```

**Generate**:
```bash
unjucks semantic generate --ontology product.ttl --output models/ --format typescript
```

**Output**:
```typescript
export interface Product {
  name?: string;
  price?: number;
}

export class ProductImpl implements Product {
  // Implementation
}
```

### Example 5: Full Stack Application
Generate complete application structure.

**Generate**:
```bash
unjucks fullstack app MyApp \
  --frontend react \
  --backend express \
  --database postgresql \
  --auth jwt \
  --features "users,products,orders"
```

**Output**:
```
MyApp/
├── frontend/          # React application
├── backend/           # Express API
├── database/          # PostgreSQL schemas
├── shared/            # Shared types/utilities
├── docker-compose.yml # Development environment
└── README.md         # Setup instructions
```

---

This user guide provides comprehensive coverage of Unjucks capabilities. For additional help, consult the [API Documentation](API_DOCUMENTATION.md) or [Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md).