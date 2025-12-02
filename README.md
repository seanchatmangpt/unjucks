# Unjucks v3.0 - Ontology-Driven Template Generation System

[![npm version](https://badge.fury.io/js/%40seanchatmangpt%2Funjucks.svg)](https://www.npmjs.com/package/@seanchatmangpt/unjucks)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[![CI Pipeline](https://github.com/seanchatmangpt/unjucks/actions/workflows/ci.yml/badge.svg)](https://github.com/seanchatmangpt/unjucks/actions/workflows/ci.yml)
[![Drift Detection](https://github.com/seanchatmangpt/unjucks/actions/workflows/drift.yml/badge.svg)](https://github.com/seanchatmangpt/unjucks/actions/workflows/drift.yml)
[![KGEN Release](https://github.com/seanchatmangpt/unjucks/actions/workflows/kgen-release.yml/badge.svg)](https://github.com/seanchatmangpt/unjucks/actions/workflows/kgen-release.yml)
[![Codecov](https://codecov.io/gh/seanchatmangpt/unjucks/branch/main/graph/badge.svg)](https://codecov.io/gh/seanchatmangpt/unjucks)

Unjucks is an advanced code generation platform that combines **Nunjucks templating**, **semantic web technologies**, and **intelligent scaffolding** to create everything from components to enterprise applications. Now with **ontology-driven generation** and **AI-powered semantic matching**.

## ✨ What's New in v3.0

- 🦉 **Ontology-Driven Templates** - Generate from RDF/Turtle semantic data
- 🤖 **Semantic Resume Generation** - AI-powered job matching with LaTeX output
- 📊 **SPARQL Query Support** - Query and transform semantic data
- 🎯 **Enhanced CLI** - New `ontology` command for semantic operations
- 📄 **6 Professional LaTeX Templates** - From ATS-friendly to executive designs
- ⚡ **Performance Optimized** - Lazy loading and smart caching

## 🚀 Quick Start

### Installation

```bash
# Install globally
npm install -g @seanchatmangpt/unjucks

# Or use directly with npx
npx unjucks --help
```

### Core Commands

```bash
# List all 101+ generators
unjucks list

# Generate a React component
unjucks generate component react Button

# Generate from ontology
unjucks ontology generate person.ttl --template person-card

# Generate semantic resume
unjucks semantic resume developer.ttl job.json --pdf
```

## 🦉 Ontology-Driven Generation

### Create Semantic Data (RDF/Turtle)

```turtle
# person.ttl
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix person: <http://unjucks.dev/person/> .
@prefix skill: <http://unjucks.dev/skill/> .

<http://example.org/person/alex-martinez> a foaf:Person ;
    foaf:name "Alex Martinez" ;
    foaf:firstName "Alex" ;
    foaf:lastName "Martinez" ;
    foaf:mbox <mailto:alex.martinez@email.com> ;
    person:hasSkill skill:JavaScript, skill:TypeScript, skill:React ;
    person:yearsOfExperience 6 .
```

### Generate from Ontology

```bash
# Generate single profile
unjucks ontology generate person.ttl --subject http://example.org/person/alex

# Batch generate all subjects
unjucks ontology generate team.ttl --batch --output-dir ./profiles

# Query ontology data
unjucks ontology query person.ttl --predicate hasSkill

# Extract structured data
unjucks ontology extract person.ttl --subject http://example.org/person/alex
```

### Available Ontology Commands

| Command | Description | Example |
|---------|-------------|---------|
| `ontology generate` | Generate from RDF/Turtle | `unjucks ontology generate data.ttl` |
| `ontology list` | List ontology templates | `unjucks ontology list` |
| `ontology query` | Query with SPARQL-like syntax | `unjucks ontology query data.ttl --subject URI` |
| `ontology extract` | Extract structured JSON | `unjucks ontology extract data.ttl -s URI` |

## 📄 Semantic Resume Generation

Generate professional resumes from semantic profiles matched against job requirements:

### LaTeX Resume Templates

1. **modern-clean** - ATS-friendly minimalist design
2. **professional-classic** - Traditional format with perfect alignment
3. **executive-premium** - Premium design for senior positions
4. **moderncv-fixed** - Enhanced ModernCV with proper spacing
5. **academic-cv** - Comprehensive CV for academia
6. **creative-designer** - Visual design for creative roles

### Generate Resumes

```bash
# Generate LaTeX resume
unjucks semantic resume person.ttl job.json --template modern-clean

# Direct PDF generation
unjucks semantic resume person.ttl job.json --pdf --output resume.pdf

# With job matching score
unjucks semantic resume developer.ttl position.json --score
```

## 📋 101+ Built-in Generators

### Popular Generators

| Generator | Templates | Use Case |
|-----------|-----------|----------|
| **component** | react, vue, angular, svelte | UI components |
| **api** | endpoint, controller, graphql | REST/GraphQL APIs |
| **semantic** | ontology, rdf, sparql, resume | Semantic web |
| **database** | schema, migration, seed | Database ops |
| **test** | unit, integration, e2e, bdd | Testing |
| **enterprise** | saga, cqrs, event-sourcing | Patterns |
| **latex** | article, thesis, resume | Documents |
| **nuxt-openapi** | 14 templates | Nuxt.js APIs |

### List All Generators

```bash
# Show all generators
unjucks list

# Show specific generator templates
unjucks list semantic
unjucks list component
```

## 🎯 Advanced Features

### Template Frontmatter

```yaml
---
to: src/components/{{ name }}.jsx
inject: true
after: "// COMPONENTS"
skipIf: fileExists
---
```

### Batch Processing

```bash
# Generate multiple components
unjucks generate component react Button Card Modal

# Process all ontologies
unjucks ontology generate data/*.ttl --batch
```

### Custom Templates

```bash
# Add custom templates
mkdir templates/custom

# Use custom template
unjucks generate custom my-template MyProject
```

## 🔧 Configuration

Create `unjucks.config.ts`:

```typescript
export default {
  templatesDir: './templates',
  outputDir: './src',
  ontology: {
    defaultNamespace: 'http://myproject.dev/',
    templatesPath: './templates/ontology-driven'
  },
  latex: {
    compiler: 'pdflatex',
    outputDir: './documents'
  }
}
```

## 📊 CLI Command Reference

### Core Commands
- `unjucks list [generator]` - List generators/templates
- `unjucks generate <generator> <template> [name]` - Generate from template
- `unjucks help [command]` - Show help

### Ontology Commands
- `unjucks ontology generate <file>` - Generate from RDF/Turtle
- `unjucks ontology query <file>` - Query ontology data
- `unjucks ontology extract <file>` - Extract structured data
- `unjucks ontology list` - List ontology templates

### Semantic Commands
- `unjucks semantic resume <person> <job>` - Generate resume
- `unjucks semantic match <profile> <requirements>` - Match profiles

### Document Commands
- `unjucks latex compile <file>` - Compile LaTeX to PDF
- `unjucks pdf generate <template>` - Generate PDF directly

## 🎯 Real-World Use Cases

### 1. Team Documentation from Ontology
```bash
# Generate team profiles from RDF data
unjucks ontology generate team.ttl --batch --template profile-card
```

### 2. API Generation from Specs
```bash
# Generate OpenAPI implementation
unjucks ontology generate api-spec.ttl --template openapi-server
```

### 3. Compliance Documentation
```bash
# Generate HIPAA compliance docs
unjucks generate enterprise hipaa-policy --dest ./compliance
```

### 4. Research Papers
```bash
# Generate LaTeX paper from semantic data
unjucks latex paper research.ttl --template ieee-conference
```

## 🛠️ Development

```bash
# Clone repository
git clone https://github.com/seanchatmangpt/unjucks.git
cd unjucks

# Install dependencies
npm install

# Build (uses unbuild for ES modules)
npm run build

# Development with watch mode
npm run build:watch

# Run tests
npm test

# Type checking
npm run typecheck

# Full validation
npm run validate

# Link for development
npm link
```

## 📚 Documentation

- [CLI Command Audit](docs/CLI-COMMAND-AUDIT.md) - Complete command reference
- [Template Guide](docs/TEMPLATE-GUIDE.md) - Creating custom templates
- [Ontology Guide](docs/ONTOLOGY-GUIDE.md) - Working with RDF/Turtle
- [LaTeX Templates](docs/LATEX-TEMPLATES.md) - Document generation
- [Migration Report](docs/MIGRATION.md) - TypeScript to JavaScript migration details

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT © 2025 Sean Chatman

## 🙏 Acknowledgments

Built with:
- [Nunjucks](https://mozilla.github.io/nunjucks/) - Mozilla's powerful templating
- [N3.js](https://github.com/rdfjs/N3.js) - RDF/Turtle processing
- [Citty](https://github.com/unjs/citty) - Elegant CLI framework
- [LaTeX](https://www.latex-project.org/) - Professional typesetting

---

**Unjucks v3.0** - Where code generation meets semantic intelligence 🦉

For support: [GitHub Issues](https://github.com/seanchatmangpt/unjucks/issues) | [NPM Package](https://www.npmjs.com/package/@seanchatmangpt/unjucks)