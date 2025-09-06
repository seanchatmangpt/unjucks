# The Complete Unjucks Ecosystem Guide

[Introduction](./introduction.md)

---

# Part I: Foundation & Getting Started

- [What is Unjucks?](./introduction/what-is-unjucks.md)
  - [Key Differentiators](./introduction/differentiators.md)
  - [vs. Hygen, Yeoman, Plop](./introduction/comparisons.md)
  - [Ecosystem Overview](./introduction/ecosystem-overview.md)
  - [Architecture at a Glance](./introduction/architecture-overview.md)

- [Installation & Setup](./getting-started/installation.md)
  - [System Requirements](./getting-started/requirements.md)
  - [Package Manager Integration](./getting-started/package-managers.md)
  - [Verification & Health Check](./getting-started/verification.md)
  - [IDE Setup & Extensions](./getting-started/ide-setup.md)

- [Quick Start Guide](./getting-started/quick-start.md)
  - [First Template Generation](./getting-started/first-template.md)
  - [Basic Concepts](./getting-started/basic-concepts.md)
  - [Project Structure](./getting-started/project-structure.md)
  - [Configuration Basics](./getting-started/configuration-basics.md)

---

# Part II: Core Features & CLI

- [Template System](./core/template-system.md)
  - [Nunjucks Templating Engine](./core/nunjucks-engine.md)
  - [Template Discovery & Indexing](./core/template-discovery.md)
  - [Variable System & Injection](./core/variable-system.md)
  - [Frontmatter Processing](./core/frontmatter.md)
  - [Template Inheritance & Macros](./core/template-inheritance.md)

- [CLI Interface](./cli/overview.md)
  - [Command Reference](./cli/commands.md)
  - [Global Flags & Options](./cli/flags-options.md)
  - [Interactive Mode](./cli/interactive-mode.md)
  - [Batch Operations](./cli/batch-operations.md)
  - [Shell Integration](./cli/shell-integration.md)

- [File Operations (6 Modes)](./core/file-operations.md)
  - [Write Mode: New Files](./core/operations/write.md)
  - [Inject Mode: Existing Files](./core/operations/inject.md)
  - [Append & Prepend](./core/operations/append-prepend.md)
  - [LineAt: Line-Specific Insertion](./core/operations/line-at.md)
  - [Conditional Operations (skipIf)](./core/operations/conditional.md)
  - [Atomic Operations & Safety](./core/operations/atomic-safety.md)

- [Advanced Templating](./templates/advanced.md)
  - [Filters & Functions](./templates/filters-functions.md)
  - [Complex Conditionals](./templates/conditionals.md)
  - [Loops & Iteration](./templates/loops-iteration.md)
  - [Dynamic Path Generation](./templates/dynamic-paths.md)
  - [Template Composition](./templates/composition.md)

---

# Part III: Advanced Features

- [MCP Integration (AI Accessibility)](./mcp/overview.md)
  - [Model Context Protocol Setup](./mcp/setup.md)
  - [Claude AI Integration](./mcp/claude-integration.md)
  - [Natural Language Generation](./mcp/natural-language.md)
  - [Context-Aware Templates](./mcp/context-awareness.md)
  - [AI Agent Coordination](./mcp/agent-coordination.md)
  - [Swarm Orchestration](./mcp/swarm-orchestration.md)

- [Semantic Web Capabilities](./semantic/overview.md)
  - [N3.js Integration](./semantic/n3-integration.md)
  - [RDF Knowledge Graphs](./semantic/rdf-knowledge-graphs.md)
  - [Turtle & N-Triples Support](./semantic/turtle-support.md)
  - [SPARQL-like Querying](./semantic/sparql-querying.md)
  - [Ontological Reasoning](./semantic/ontological-reasoning.md)
  - [Semantic Validation](./semantic/semantic-validation.md)
  - [Knowledge Graph Governance](./semantic/knowledge-governance.md)

- [Performance Optimization](./performance/overview.md)
  - [Smart Caching System](./performance/caching.md)
  - [Memory Management](./performance/memory-management.md)
  - [Concurrent Processing](./performance/concurrent-processing.md)
  - [Performance Benchmarks](./performance/benchmarks.md)
  - [Optimization Strategies](./performance/optimization-strategies.md)

---

# Part IV: Enterprise Deployment

- [Fortune 5 Enterprise Patterns](./enterprise/overview.md)
  - [Walmart Supply Chain](./enterprise/walmart-supply-chain.md)
  - [Amazon Infrastructure](./enterprise/amazon-infrastructure.md)
  - [Apple Privacy & Compliance](./enterprise/apple-privacy-compliance.md)
  - [Berkshire Financial Models](./enterprise/berkshire-financial.md)
  - [Saudi Aramco Energy Systems](./enterprise/saudi-aramco-energy.md)

- [Security & Compliance](./security/overview.md)
  - [Zero-Trust Architecture](./security/zero-trust.md)
  - [Path Traversal Protection](./security/path-protection.md)
  - [Input Sanitization](./security/input-sanitization.md)
  - [Audit Logging](./security/audit-logging.md)
  - [Secrets Management](./security/secrets-management.md)
  - [Encryption Guide](./security/encryption.md)
  - [Compliance Frameworks](./security/compliance-frameworks.md)

- [Multi-Tenant Architecture](./enterprise/multi-tenant.md)
  - [Tenant Isolation](./enterprise/tenant-isolation.md)
  - [Resource Management](./enterprise/resource-management.md)
  - [Scaling Strategies](./enterprise/scaling-strategies.md)
  - [Data Governance](./enterprise/data-governance.md)

- [Monitoring & Observability](./enterprise/monitoring.md)
  - [Metrics Collection](./enterprise/metrics.md)
  - [Log Management](./enterprise/logging.md)
  - [Performance Monitoring](./enterprise/performance-monitoring.md)
  - [Alerting & Incident Response](./enterprise/alerting.md)
  - [Dashboard & Visualization](./enterprise/dashboards.md)

---

# Part V: Developer Guide & API

- [API Reference](./api/overview.md)
  - [Core Generator API](./api/generator-api.md)
  - [Template Engine API](./api/template-engine-api.md)
  - [File Operations API](./api/file-operations-api.md)
  - [Configuration API](./api/configuration-api.md)
  - [Plugin System API](./api/plugin-api.md)

- [Extension Development](./extensions/overview.md)
  - [Custom Filters](./extensions/custom-filters.md)
  - [Plugin Architecture](./extensions/plugin-architecture.md)
  - [Hook System](./extensions/hook-system.md)
  - [Custom Commands](./extensions/custom-commands.md)
  - [Template Processors](./extensions/template-processors.md)

- [Testing Frameworks](./testing/overview.md)
  - [BDD with Vitest-Cucumber](./testing/bdd-cucumber.md)
  - [Unit Testing Templates](./testing/unit-testing.md)
  - [Integration Testing](./testing/integration-testing.md)
  - [Performance Testing](./testing/performance-testing.md)
  - [Template Validation](./testing/template-validation.md)

- [Migration from Hygen](./migration/overview.md)
  - [Template Conversion Guide](./migration/template-conversion.md)
  - [Configuration Migration](./migration/configuration-migration.md)
  - [Feature Mapping](./migration/feature-mapping.md)
  - [Automated Migration Tools](./migration/automated-tools.md)
  - [Validation & Testing](./migration/validation-testing.md)

---

# Part VI: Real-World Examples & Patterns

- [Common Use Cases](./examples/common-use-cases.md)
  - [React Component Generation](./examples/react-components.md)
  - [Nuxt Page Generation](./examples/nuxt-pages.md)
  - [API Service Generation](./examples/api-services.md)
  - [Database Schema Generation](./examples/database-schemas.md)
  - [Configuration File Templates](./examples/configuration-files.md)

- [Advanced Patterns](./examples/advanced-patterns.md)
  - [Multi-Framework Support](./examples/multi-framework.md)
  - [Conditional Generation](./examples/conditional-generation.md)
  - [Template Composition](./examples/template-composition.md)
  - [Dynamic Template Selection](./examples/dynamic-selection.md)

- [Industry-Specific Examples](./examples/industry-specific.md)
  - [Financial Services](./examples/financial-services.md)
  - [Healthcare Systems](./examples/healthcare.md)
  - [E-commerce Platforms](./examples/ecommerce.md)
  - [Manufacturing & IoT](./examples/manufacturing-iot.md)

---

# Part VII: Configuration & Reference

- [Configuration Guide](./configuration/overview.md)
  - [Project Configuration](./configuration/project-config.md)
  - [Template Configuration](./configuration/template-config.md)
  - [Environment Variables](./configuration/environment-variables.md)
  - [Global Settings](./configuration/global-settings.md)
  - [Per-Generator Config](./configuration/per-generator-config.md)

- [Command Line Reference](./reference/cli-reference.md)
  - [unjucks init](./reference/commands/init.md)
  - [unjucks generate](./reference/commands/generate.md)
  - [unjucks list](./reference/commands/list.md)
  - [unjucks help](./reference/commands/help.md)
  - [unjucks version](./reference/commands/version.md)

- [Template Syntax Reference](./reference/template-syntax.md)
  - [Nunjucks Syntax](./reference/nunjucks-syntax.md)
  - [Built-in Filters](./reference/built-in-filters.md)
  - [Custom Filters](./reference/custom-filters.md)
  - [Frontmatter Schema](./reference/frontmatter-schema.md)
  - [Variable Injection](./reference/variable-injection.md)

- [Troubleshooting](./troubleshooting/overview.md)
  - [Common Issues](./troubleshooting/common-issues.md)
  - [Template Debugging](./troubleshooting/template-debugging.md)
  - [Performance Issues](./troubleshooting/performance-issues.md)
  - [Error Messages](./troubleshooting/error-messages.md)
  - [Recovery Procedures](./troubleshooting/recovery.md)

- [FAQ](./faq/overview.md)
  - [General Questions](./faq/general.md)
  - [Technical Questions](./faq/technical.md)
  - [Migration Questions](./faq/migration.md)
  - [Performance Questions](./faq/performance.md)
  - [Enterprise Questions](./faq/enterprise.md)

---

# Part VIII: Community & Ecosystem

- [Contributing](./contributing/overview.md)
  - [Development Setup](./contributing/development-setup.md)
  - [Code Style Guide](./contributing/code-style.md)
  - [Testing Guidelines](./contributing/testing-guidelines.md)
  - [Documentation Guidelines](./contributing/documentation.md)
  - [Pull Request Process](./contributing/pull-request.md)

- [Community Resources](./community/overview.md)
  - [Official Templates](./community/official-templates.md)
  - [Community Templates](./community/community-templates.md)
  - [Template Marketplace](./community/marketplace.md)
  - [Best Practices](./community/best-practices.md)
  - [Case Studies](./community/case-studies.md)

- [Roadmap & Future](./roadmap/overview.md)
  - [Current Roadmap](./roadmap/current.md)
  - [Planned Features](./roadmap/planned-features.md)
  - [Community Requests](./roadmap/community-requests.md)
  - [Breaking Changes](./roadmap/breaking-changes.md)

---

# Appendices

- [Appendix A: Complete API Documentation](./appendix/api-complete.md)
- [Appendix B: All CLI Commands](./appendix/cli-complete.md)
- [Appendix C: Template Examples Collection](./appendix/template-examples.md)
- [Appendix D: Migration Scripts](./appendix/migration-scripts.md)
- [Appendix E: Performance Benchmarks](./appendix/performance-data.md)
- [Appendix F: Security Compliance Checklist](./appendix/security-checklist.md)
- [Appendix G: Glossary](./appendix/glossary.md)

---

[Contributing](./contributing/overview.md)
[License](./license.md)
[Changelog](./changelog.md)