# System Overview

## High-Level Architecture

Unjucks is a next-generation template scaffolding system that extends traditional generators with semantic web capabilities, MCP (Model Context Protocol) integration, and enterprise-grade features. The system follows a modular, extensible architecture designed for scalability and maintainability.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Unjucks Ecosystem                        │
├─────────────────────────────────────────────────────────────────┤
│  CLI Interface (Citty)                                         │
│  ├─ Command Parsing       ├─ Help System      ├─ Validation    │
│  ├─ Template Discovery    ├─ Variable Extraction               │
│  └─ Dry Run & Force Modes                                      │
├─────────────────────────────────────────────────────────────────┤
│  MCP Integration Layer                                          │
│  ├─ Claude Flow Connector ├─ Task Orchestrator                 │
│  ├─ Shared Memory         ├─ Real-time Collaboration          │
│  └─ Semantic Server                                            │
├─────────────────────────────────────────────────────────────────┤
│  Core Engine                                                   │
│  ├─ Template Engine       ├─ Frontmatter Parser               │
│  │  (Nunjucks + Filters)  │  (YAML + RDF Config)              │
│  ├─ File Operations       ├─ Variable Enhancement             │
│  │  (Write/Inject/Append) │  (Type Inference + Validation)    │
│  └─ Performance Monitor                                        │
├─────────────────────────────────────────────────────────────────┤
│  Semantic Layer (RDF/N3.js)                                   │
│  ├─ Turtle Parser         ├─ RDF Data Loader                  │
│  ├─ Semantic Validator    ├─ Compliance Frameworks            │
│  │  (GDPR/HIPAA/SOX)      │  (FHIR/FIBO/GS1)                  │
│  ├─ Ontology Cache        ├─ Cross-Ontology Mapping           │
│  └─ Query Engine                                               │
├─────────────────────────────────────────────────────────────────┤
│  Extension Points                                              │
│  ├─ Custom MCP Servers    ├─ Plugin System                    │
│  ├─ Template Marketplace  ├─ Workflow Extensions              │
│  └─ Enterprise Integrations                                   │
├─────────────────────────────────────────────────────────────────┤
│  Security & Enterprise                                         │
│  ├─ Zero Trust Auth      ├─ mTLS/RBAC                         │
│  ├─ Multi-tenant         ├─ Audit Logging                     │
│  ├─ Encryption           ├─ DDoS Protection                   │
│  └─ Vulnerability Scanning                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Key Architectural Principles

### 1. **Modular Design**
Each component is self-contained with well-defined interfaces:
- **CLI Layer**: User interaction and command processing
- **MCP Layer**: Agent coordination and real-time collaboration
- **Core Engine**: Template processing and file operations
- **Semantic Layer**: RDF processing and knowledge management
- **Security Layer**: Authentication, authorization, and protection

### 2. **Extensibility**
System supports multiple extension points:
- **MCP Servers**: Custom protocol implementations
- **Template Filters**: Custom Nunjucks extensions
- **Validation Rules**: Domain-specific validators
- **Compliance Frameworks**: Industry standards integration

### 3. **Performance**
Optimized for large-scale operations:
- **Streaming Processing**: Handle large datasets efficiently
- **Caching**: Multi-level cache system (templates, RDF, queries)
- **Parallel Processing**: Concurrent template generation
- **Memory Management**: Automatic cleanup and optimization

### 4. **Enterprise-Ready**
Built for production environments:
- **Multi-tenancy**: Isolated workspaces per organization
- **High Availability**: Distributed deployment support
- **Monitoring**: Comprehensive metrics and logging
- **Compliance**: Built-in regulatory framework support

## Technology Stack

### Core Technologies
- **TypeScript**: Primary language for type safety and maintainability
- **Node.js**: Runtime environment (≥18.0.0)
- **Nunjucks**: Template engine with powerful filtering capabilities
- **N3.js**: RDF/Turtle parsing and SPARQL-like querying
- **Citty**: Modern CLI framework with auto-completion support

### Supporting Libraries
- **Gray-matter**: YAML frontmatter parsing
- **Glob**: Pattern-based file discovery
- **Chokidar**: File system monitoring
- **Consola**: Structured logging with performance metrics
- **Ora**: Terminal spinners and progress indicators

### MCP Integration
- **Claude Flow**: Swarm coordination and task orchestration
- **Ruv Swarm**: Neural network training and optimization
- **Flow Nexus**: Enterprise features and deployment

## Deployment Architecture

### Standalone CLI
```
┌─────────────────┐
│   unjucks CLI   │
├─────────────────┤
│ Local Templates │
│ File Operations │
│ Direct Parsing  │
└─────────────────┘
```

### MCP-Enabled
```
┌─────────────────┐    MCP     ┌─────────────────┐
│   Claude Code   │ ◄─────────► │ Unjucks Server  │
├─────────────────┤             ├─────────────────┤
│ Task Spawning   │             │ Template Engine │
│ File Operations │             │ RDF Processing  │
│ Agent Coord.    │             │ Semantic Valid. │
└─────────────────┘             └─────────────────┘
                                          │
                                          ▼
                                ┌─────────────────┐
                                │ External APIs   │
                                │ • SPARQL        │
                                │ • GraphQL       │
                                │ • REST          │
                                └─────────────────┘
```

### Enterprise Deployment
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Load Balancer   │    │ Authentication  │    │ Audit/Monitor   │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ SSL Termination │    │ OAuth2/SAML     │    │ Metrics/Logs    │
│ Rate Limiting   │    │ mTLS            │    │ Alerts          │
└─────────┬───────┘    └─────────┬───────┘    └─────────────────┘
          │                      │                      ▲
          ▼                      ▼                      │
┌─────────────────────────────────────────────────────────────────┐
│                    Unjucks Cluster                              │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ Template Nodes  │ Semantic Nodes  │ MCP Gateway Nodes           │
│ • Generation    │ • RDF Processing│ • Protocol Translation      │
│ • File Ops      │ • Validation    │ • Agent Coordination        │
│ • Caching       │ • Queries       │ • Memory Management         │
└─────────────────┴─────────────────┴─────────────────────────────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Storage Layer   │    │ Knowledge Base  │    │ Message Queue   │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ Templates       │    │ Ontologies      │    │ Task Queue      │
│ Generated Files │    │ Compliance      │    │ Event Stream    │
│ Cache           │    │ Validation      │    │ Notifications   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## System Boundaries

### Internal Components
- Template processing and generation
- RDF/semantic data processing
- File system operations
- Validation and compliance checking
- Performance monitoring and optimization

### External Interfaces
- **MCP Protocol**: Agent communication and coordination
- **File System**: Template storage and output generation
- **Network APIs**: External data sources and services
- **Security Providers**: Authentication and authorization services
- **Monitoring Systems**: Metrics collection and alerting

## Quality Attributes

### Performance
- **Target**: Process 1000+ templates per minute
- **Memory**: <512MB for typical workloads
- **Startup**: <2 seconds for CLI initialization
- **Caching**: 90%+ cache hit ratio for repeated operations

### Scalability
- **Horizontal**: Support distributed deployment
- **Vertical**: Efficient resource utilization
- **Data**: Handle GB-scale RDF datasets
- **Concurrent Users**: Support 100+ simultaneous operations

### Reliability
- **Availability**: 99.9% uptime in enterprise deployments
- **Error Handling**: Graceful degradation and recovery
- **Data Integrity**: Atomic file operations with rollback
- **Monitoring**: Real-time health checks and alerts

### Security
- **Authentication**: Multi-factor and federated identity
- **Authorization**: Fine-grained RBAC with audit trails
- **Encryption**: End-to-end data protection
- **Compliance**: GDPR, HIPAA, SOX framework support

This system overview provides the foundation for understanding Unjucks' architecture and serves as a guide for development, deployment, and maintenance activities.