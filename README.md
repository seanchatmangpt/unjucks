# Unjucks

**Professional code generation and scaffolding with semantic web integration**

[![npm version](https://badge.fury.io/js/%40seanchatmangpt%2Funjucks.svg)](https://www.npmjs.com/package/@seanchatmangpt/unjucks)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Unjucks is an advanced AI-powered code generation platform that combines **Nunjucks templating** with **Hygen-style scaffolding** to create everything from simple components to enterprise-grade semantic web applications. With 50+ built-in generators, semantic web integration, and LaTeX document generation, it's designed for developers who need both rapid prototyping and production-ready code.

## ✨ What Makes Unjucks Special

- 🎯 **101+ Production Generators** - From React components to enterprise microservices
- 🧠 **Semantic Web Integration** - RDF/Turtle, SPARQL, and ontology-driven development
- 📄 **LaTeX Document Generation** - Academic papers, reports, and professional documentation
- 🏢 **Enterprise Compliance** - HIPAA, SOX, GDPR, Basel III compliance templates
- ⚡ **AI-Powered Workflows** - MCP integration with intelligent code generation
- 🔧 **Real Working Examples** - Not just tutorials, but production-ready code

## 🚀 Quick Start

### Installation

```bash
# Install globally (recommended)
npm install -g @seanchatmangpt/unjucks

# Verify installation
unjucks --version  # Should show: 2025.9.8
unjucks list       # Shows 101+ available generators
```

### Your First Generation

```bash
# Generate a React component
unjucks generate component react UserProfile --dest ./src

# Generate an API endpoint
unjucks generate api endpoint users --dest ./api

# Generate a database schema
unjucks generate database schema users --dest ./migrations

# See what was created
unjucks list       # Browse all available templates
unjucks help       # Get detailed help
```

## 🎯 Real-World Examples

### Frontend Development

```bash
# Modern React component with TypeScript
unjucks generate component react UserCard \
  --withProps --withTests --typescript

# Vue 3 Composition API component  
unjucks generate component vue UserProfile \
  --composition --withTests

# Complete page with routing
unjucks generate api-route nuxt users/profile --withAuth
```

### Backend & APIs

```bash
# Express.js microservice with full stack
unjucks generate microservice node UserService \
  --database=postgresql \
  --withAuth --withRBAC \
  --monitoring=prometheus

# RESTful API endpoints
unjucks generate api express users \
  --withCRUD --withValidation --withDocs

# Database migrations and models
unjucks generate database schema users \
  --withIndexes --withSeeds
```

### Enterprise & Compliance

```bash
# HIPAA-compliant healthcare service
unjucks generate semantic healthcare-service \
  --serviceName=PatientRegistry \
  --compliance=hipaa,fhir

# Financial API with Basel III compliance
unjucks generate semantic financial-api \
  --serviceName=RiskCalculator \
  --compliance=basel3,sox

# Complete compliance framework
unjucks generate enterprise compliance \
  --regulations=gdpr,sox,hipaa
```

### Documentation & Academic

```bash
# LaTeX academic paper
unjucks latex generate --template article \
  --title="Research Paper" \
  --withBibliography --withTOC

# Export to multiple formats
unjucks export README.md --format pdf,docx,html

# Technical documentation
unjucks generate enterprise documentation \
  --type=api-docs --withOpenAPI
```

## 📚 Template Library

Unjucks includes **101+ professional templates** across these categories:

### 🔥 **Most Popular**
- **Components** (`component/`) - React, Vue, Angular components with tests
- **APIs** (`api/`, `microservice/`) - REST APIs, microservices, database integration  
- **Database** (`database/`) - Schemas, migrations, seeds for PostgreSQL, MongoDB
- **Testing** (`test/`) - Vitest, Jest, E2E testing with real scenarios

### 🏢 **Enterprise Grade**
- **Semantic Web** (`semantic/`) - RDF/Turtle, SPARQL, FHIR, FIBO ontologies
- **Compliance** (`enterprise/`) - HIPAA, SOX, GDPR, Basel III frameworks
- **Microservices** (`microservice/`) - Docker, Kubernetes, monitoring, security
- **Architecture** (`architecture/`) - System design, API documentation, diagrams

### 📄 **Documentation & Export**
- **LaTeX** (`latex/`) - Academic papers, reports, presentations, theses
- **Export** (`export/`) - PDF, DOCX, HTML generation from Markdown
- **Specification** (`spec-driven/`) - OpenAPI, GraphQL schemas, technical specs

### 🛠️ **Development Tools**
- **CLI Commands** (`command/`) - Professional CLI tools with Citty integration
- **Performance** (`performance/`) - Benchmarking, optimization, monitoring
- **Security** (`enterprise/security/`) - Authentication, encryption, audit trails

## 💻 Command Reference

### Core Commands

```bash
# Discovery & Help
unjucks list                           # Show all generators
unjucks help [generator] [template]    # Get detailed help

# Code Generation  
unjucks generate <generator> <template> [name] [options]
unjucks new <generator> <template> [name]              # Alias for generate

# Preview & Validation
unjucks preview <generator> <template> [name]  # Preview without creating
unjucks help <generator> <template>            # Show template variables

# Advanced Features
unjucks semantic <command>             # Semantic web operations
unjucks latex <command>                # LaTeX document generation
unjucks export <file> --format <type> # Export to PDF/DOCX/HTML
```

### Generator Examples

```bash
# Component generation
unjucks generate component react Button --withProps --withStories
unjucks generate component vue Modal --composition --withTeleport

# API development
unjucks generate api endpoint auth/login --withValidation
unjucks generate microservice node OrderService --withDatabase

# Database operations
unjucks generate database migration add-user-preferences
unjucks generate database seeds users --withFakeData

# Enterprise features
unjucks generate enterprise api-gateway --withLoadBalancing
unjucks generate semantic ontology domain-model --withReasoning
```

## 🧠 Semantic Web Features

Unjucks includes **production-ready semantic web capabilities**:

### RDF & Ontology Integration

```bash
# Generate from healthcare ontologies (FHIR R4)
unjucks generate semantic healthcare-service \
  --data=./fhir-ontology.ttl \
  --compliance=hipaa

# Financial services with FIBO ontology
unjucks generate semantic financial-api \
  --data=./fibo-ontology.ttl \
  --compliance=basel3,mifid2

# Custom domain ontologies
unjucks generate semantic ontology supply-chain \
  --standards=gs1,epcis
```

### SPARQL Query Generation

```bash
# Generate SPARQL queries
unjucks generate semantic sparql analytics \
  --queryType=select,construct

# Federated queries
unjucks generate semantic sparql federation \
  --endpoints=local,dbpedia
```

**Supported Standards**: FHIR R4, FIBO, GS1, Dublin Core, FOAF, Schema.org

## 📄 LaTeX Document Generation

Professional LaTeX document generation with PDF compilation:

```bash
# Academic articles
unjucks latex generate --template article \
  --title="Machine Learning Research" \
  --author="Jane Doe" \
  --withBibliography

# Technical reports  
unjucks latex generate --template report \
  --title="System Architecture" \
  --chapters=introduction,methodology,results

# Presentations
unjucks latex generate --template beamer \
  --title="Project Presentation" \
  --theme=metropolis

# Compile to PDF (requires LaTeX distribution)
pdflatex document.tex
```

**Document Types**: Articles, Reports, Theses, Presentations, Legal Briefs

## 🏢 Enterprise Features

### Compliance & Governance

```bash
# Multi-regulatory compliance
unjucks generate enterprise compliance \
  --regulations=gdpr,sox,hipaa,pci-dss \
  --auditLevel=high

# Audit logging system
unjucks generate enterprise audit-system \
  --retentionPeriod=7years \
  --withBlockchain
```

### Security & Authentication

```bash
# Zero-trust authentication
unjucks generate enterprise auth \
  --type=zero-trust \
  --mfa --rbac

# API security
unjucks generate enterprise api-security \
  --withRateLimit --withJWT --withCORS
```

### Monitoring & Observability

```bash
# Prometheus monitoring
unjucks generate enterprise monitoring \
  --platform=prometheus \
  --withGrafana --withAlerts

# Comprehensive logging
unjucks generate enterprise logging \
  --platform=elk \
  --withStructured --withSIEM
```

## 🛠️ Development & Integration

### Project Integration

```bash
# Add to existing project
unjucks init --type integration --dest ./existing-project

# Analyze existing codebase  
unjucks migrate analyze ./legacy-code

# Generate CI/CD pipelines
unjucks generate enterprise cicd \
  --platform=github \
  --withTesting --withSecurity
```

### Custom Templates

```bash
# Create custom generator
unjucks generate template custom MyGenerator

# Extend existing templates
unjucks generate template extend component/react --customizations
```

## 📈 Performance & Quality

- ⚡ **Fast Generation** - Optimized templates with intelligent caching
- 🧪 **Comprehensive Testing** - All templates include test scaffolding  
- 🔒 **Security First** - Built-in security patterns and compliance
- 📊 **Quality Metrics** - Automated quality gates and validation
- 🌐 **Cross-Platform** - Works on macOS, Linux, and Windows
- 📊 **Workflow Monitoring** - Built-in CI/CD monitoring and reporting system

## 🔍 Workflow Monitoring & Reporting

Unjucks includes a comprehensive workflow monitoring system that automatically tracks GitHub Actions performance:

### Key Features

- **📊 Performance Tracking** - Monitors success rates, execution times, and resource usage
- **📈 Trend Analysis** - Detects performance degradation and improvement patterns  
- **🚨 Smart Alerts** - Notifications via Slack, GitHub Issues, and email
- **📋 Automated Reports** - Daily metrics and weekly performance summaries
- **🎯 Interactive Dashboard** - HTML dashboard with real-time charts and visualizations
- **🔍 Degradation Detection** - Identifies issues before they become critical

### Quick Setup

The monitoring system runs automatically. To enable Slack alerts:

```bash
# Configure Slack webhook (optional)
gh secret set SLACK_WEBHOOK_URL --body "https://hooks.slack.com/services/..."

# View monitoring dashboard 
# Available at: https://your-username.github.io/unjucks/monitoring
```

### Monitoring Capabilities

```bash
# Manual report generation (for testing)
node .github/scripts/monitoring/collect-metrics.js --repo owner/repo --days-back 7
node .github/scripts/monitoring/generate-dashboard.js --output-format html
node .github/scripts/monitoring/test-monitoring.js --component all

# The system automatically:
# - Collects metrics daily at 6:00 AM UTC
# - Generates weekly reports every Monday
# - Creates alerts for critical performance issues
# - Maintains 30 days of historical data
# - Provides performance trend analysis
```

**Alert Thresholds:**
- 🔴 **Critical**: Success rate < 80%, Duration increase > 50%
- 🟡 **Warning**: Success rate 80-90%, Duration increase 30-50%
- ✅ **Healthy**: Success rate > 90%, Stable performance trends

For detailed configuration, see [Monitoring Documentation](./.github/scripts/monitoring/README.md)

## 🤝 Getting Help

### Documentation

```bash
# Built-in help system
unjucks help                    # General help
unjucks help component react    # Template-specific help  
unjucks list                    # Browse all templates
```

### Common Workflows

1. **New Project**: `unjucks init` → `unjucks generate` → `npm test`
2. **Add Features**: `unjucks generate api` → `unjucks generate test`
3. **Enterprise Setup**: `unjucks generate enterprise` → `unjucks generate compliance`
4. **Documentation**: `unjucks latex generate` → `unjucks export`

### Troubleshooting

- **Template not found**: Run `unjucks list` to see available generators
- **Permission errors**: Use `sudo` for global installation if needed
- **Node version**: Ensure Node.js v18.0.0 or higher
- **Missing dependencies**: Some features require additional tools (LaTeX, Puppeteer)

## 🔗 Links & Resources

- **npm Package**: [@seanchatmangpt/unjucks](https://www.npmjs.com/package/@seanchatmangpt/unjucks)
- **GitHub Repository**: [unjucks/unjucks](https://github.com/unjucks/unjucks)
- **Documentation**: Comprehensive help system built-in
- **Issues & Support**: [GitHub Issues](https://github.com/unjucks/unjucks/issues)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Unjucks v2025.9.8** - Professional code generation for the modern web