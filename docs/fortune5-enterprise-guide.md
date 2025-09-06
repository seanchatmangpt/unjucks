# Fortune 5 Enterprise Template Guide

## Overview

The Fortune 5 enterprise template collection provides production-ready scaffolding for large-scale enterprise deployments. These templates are designed with security, compliance, scalability, and observability as first-class concerns.

## Enterprise Template Categories

### 1. Microservice Templates

#### Fortune 5 Microservice (`fortune5/microservice`)

**Job to Be Done:** Deploy a production-ready microservice that meets Fortune 500 enterprise standards for security, scalability, and observability.

**Key Features:**
- SOC2, HIPAA, PCI-DSS compliance built-in
- Kubernetes-native deployment
- Multi-database support (PostgreSQL, MongoDB, Redis, MySQL)
- Multiple authentication providers (OAuth2, JWT, SAML, LDAP)
- Comprehensive observability (Datadog, New Relic, Prometheus, Elastic)
- Multi-cloud support (AWS, Azure, GCP, on-premises)

**Generated Structure:**
```
{serviceName}/
├── src/
│   ├── controllers/          # REST API controllers
│   │   ├── health.controller.js
│   │   ├── auth.controller.js  
│   │   └── {entity}.controller.js
│   ├── middleware/           # Security & compliance middleware
│   │   ├── auth.middleware.js
│   │   ├── audit.middleware.js
│   │   ├── rate-limit.middleware.js
│   │   └── security-headers.middleware.js
│   ├── models/              # Data models with validation
│   │   ├── {entity}.model.js
│   │   └── audit-log.model.js
│   ├── routes/              # API route definitions
│   │   ├── api.routes.js
│   │   ├── health.routes.js
│   │   └── {entity}.routes.js
│   ├── services/            # Business logic services
│   │   ├── {entity}.service.js
│   │   ├── auth.service.js
│   │   └── audit.service.js
│   ├── config/              # Configuration management
│   │   ├── database.config.js
│   │   ├── auth.config.js
│   │   └── observability.config.js
│   └── utils/               # Utility functions
│       ├── logger.js
│       ├── metrics.js
│       └── encryption.js
├── k8s/                     # Kubernetes manifests
│   ├── namespace.yaml
│   ├── deployment.yaml      # Service deployment
│   ├── service.yaml         # Service exposure
│   ├── configmap.yaml       # Configuration
│   ├── secret.yaml          # Secrets management
│   ├── ingress.yaml         # Traffic routing
│   ├── hpa.yaml            # Horizontal Pod Autoscaler
│   ├── pdb.yaml            # Pod Disruption Budget
│   └── networkpolicy.yaml   # Network security
├── docker/                  # Container definitions
│   ├── Dockerfile          # Multi-stage production build
│   ├── Dockerfile.dev      # Development container
│   └── docker-compose.yml  # Local development stack
├── tests/                   # Comprehensive test suite
│   ├── unit/               # Unit tests
│   ├── integration/        # Integration tests
│   ├── security/           # Security tests
│   └── performance/        # Load tests
├── docs/                    # Documentation
│   ├── API.md              # API documentation
│   ├── DEPLOYMENT.md       # Deployment guide
│   └── SECURITY.md         # Security considerations
├── compliance/              # Compliance artifacts
│   ├── audit-configuration.json
│   ├── security-controls.json
│   └── data-retention-policy.json
├── monitoring/              # Observability configuration
│   ├── prometheus/         # Metrics configuration
│   ├── grafana/           # Dashboards
│   └── alerts/            # Alerting rules
└── scripts/                # Automation scripts
    ├── setup.sh           # Environment setup
    ├── deploy.sh          # Deployment script
    └── backup.sh          # Data backup
```

**Usage Example:**
```bash
unjucks generate fortune5/microservice \
  --serviceName user-management \
  --servicePort 3000 \
  --databaseType postgresql \
  --authProvider oauth2 \
  --complianceMode soc2 \
  --observabilityStack datadog \
  --cloudProvider aws \
  --dest ./services/user-management
```

**Variable Configuration:**
```yaml
variables:
  serviceName:
    description: "Name of the microservice (kebab-case)"
    type: string
    required: true
    validation: "^[a-z0-9-]+$"
    
  servicePort:
    description: "Port for the service to run on"
    type: number
    required: true
    default: 3000
    
  databaseType:
    description: "Type of database"
    type: string
    required: true
    options: ["postgresql", "mongodb", "redis", "mysql"]
    
  authProvider:
    description: "Authentication provider"
    type: string
    required: true
    options: ["oauth2", "jwt", "saml", "ldap"]
    
  complianceMode:
    description: "Compliance requirements"
    type: string
    required: true
    options: ["soc2", "hipaa", "pci-dss", "gdpr"]
    
  observabilityStack:
    description: "Observability platform"
    type: string
    required: true
    options: ["datadog", "newrelic", "prometheus", "elastic"]
    
  cloudProvider:
    description: "Target cloud platform"
    type: string
    required: true
    options: ["aws", "azure", "gcp", "on-premises"]
```

### 2. API Gateway Templates

#### Enterprise API Gateway (`fortune5/api-gateway`)

**Job to Be Done:** Deploy a scalable API gateway that handles authentication, rate limiting, load balancing, and provides comprehensive API management capabilities.

**Key Features:**
- Multiple gateway implementations (Kong, NGINX Plus, Istio, Envoy)
- Advanced authentication strategies (JWT, OAuth2, API keys, mTLS)
- Sophisticated rate limiting (fixed window, sliding window, token bucket, leaky bucket)
- Load balancing algorithms (round-robin, least-conn, IP hash, consistent hash)
- Integrated WAF and DDoS protection
- TLS termination and certificate management

**Generated Architecture:**
```
Internet → Load Balancer → API Gateway → Microservices
                            ├── Auth Service
                            ├── Rate Limiter  
                            ├── WAF
                            └── Observability
```

**Usage Example:**
```bash
unjucks generate fortune5/api-gateway \
  --gatewayName enterprise-api \
  --gatewayPort 8080 \
  --adminPort 8001 \
  --gatewayType kong \
  --authStrategy jwt \
  --rateLimitStrategy sliding-window \
  --loadBalancingAlgorithm least-conn \
  --tlsTermination true \
  --wafEnabled true \
  --dest ./infrastructure/api-gateway
```

### 3. Data Pipeline Templates

#### Enterprise Data Pipeline (`fortune5/data-pipeline`)

**Job to Be Done:** Deploy scalable ETL/ELT data processing pipelines with governance, lineage tracking, and compliance controls.

**Key Features:**
- Multi-cloud data processing (Spark, Airflow, Kafka, Flink)
- Data governance and lineage tracking
- GDPR compliance with data anonymization
- Real-time and batch processing capabilities
- Data quality monitoring and validation
- Integration with data lakes and warehouses

**Generated Structure:**
```
{pipelineName}/
├── airflow/                 # Workflow orchestration
│   ├── dags/               # Pipeline definitions
│   └── operators/          # Custom operators
├── spark/                   # Data processing jobs
│   ├── jobs/               # Spark applications
│   └── transformations/    # Data transformations
├── kafka/                   # Streaming configuration
│   ├── topics/             # Topic definitions
│   └── connectors/         # Kafka connectors
├── monitoring/              # Pipeline monitoring
│   ├── dashboards/         # Grafana dashboards
│   └── alerts/             # Alerting rules
├── governance/              # Data governance
│   ├── schemas/            # Data schemas
│   ├── lineage/            # Lineage tracking
│   └── quality/            # Data quality rules
└── compliance/              # Regulatory compliance
    ├── gdpr/               # GDPR controls
    ├── ccpa/               # CCPA controls
    └── audit/              # Audit logging
```

### 4. Compliance Framework Templates

#### Compliance Framework (`fortune5/compliance`)

**Job to Be Done:** Implement comprehensive compliance controls and audit trails for regulatory requirements (SOC2, HIPAA, PCI-DSS, GDPR).

**Key Features:**
- Automated compliance control implementation
- Audit trail generation and management
- Risk assessment and mitigation
- Compliance reporting and dashboards
- Integration with security scanning tools
- Policy as code implementation

**Compliance Controls Included:**
```yaml
SOC2:
  - Access Controls (CC6.1-CC6.8)
  - System Operations (CC7.1-CC7.5)
  - Change Management (CC8.1)
  - Risk Mitigation (CC9.1)
  
HIPAA:
  - Administrative Safeguards (164.308)
  - Physical Safeguards (164.310)
  - Technical Safeguards (164.312)
  - Breach Notification (164.400)
  
PCI-DSS:
  - Network Security (Req 1-2)
  - Data Protection (Req 3-4)
  - Vulnerability Management (Req 5-6)
  - Access Control (Req 7-8)
  - Monitoring (Req 9-10)
  - Testing (Req 11-12)
  
GDPR:
  - Lawful Basis (Art 6)
  - Data Subject Rights (Art 12-23)
  - Data Protection by Design (Art 25)
  - Data Breach Notification (Art 33-34)
```

### 5. Monitoring Stack Templates

#### Enterprise Monitoring (`fortune5/monitoring`)

**Job to Be Done:** Deploy comprehensive observability platform with metrics, logging, tracing, and alerting for enterprise applications.

**Key Features:**
- Multi-platform support (Prometheus, Datadog, New Relic, Elastic)
- Distributed tracing integration
- Log aggregation and analysis
- Custom metrics and dashboards
- Intelligent alerting with escalation
- SLA/SLO monitoring and reporting

**Generated Monitoring Stack:**
```
monitoring/
├── prometheus/              # Metrics collection
│   ├── config/             # Prometheus configuration
│   ├── rules/              # Recording and alerting rules
│   └── exporters/          # Custom exporters
├── grafana/                 # Visualization
│   ├── dashboards/         # Service dashboards
│   ├── panels/             # Reusable panels
│   └── datasources/        # Data source configs
├── jaeger/                  # Distributed tracing
│   ├── config/             # Jaeger configuration
│   └── sampling/           # Sampling strategies
├── elasticsearch/           # Log storage
│   ├── indices/            # Index templates
│   ├── policies/           # Lifecycle policies
│   └── mappings/           # Field mappings
├── logstash/               # Log processing
│   ├── pipelines/          # Processing pipelines
│   ├── filters/            # Log filters
│   └── outputs/            # Output configurations
├── alertmanager/           # Alert routing
│   ├── config/             # Routing rules
│   ├── templates/          # Alert templates
│   └── receivers/          # Notification configs
└── kibana/                 # Log visualization
    ├── dashboards/         # Log dashboards
    ├── searches/           # Saved searches
    └── visualizations/     # Custom visualizations
```

## JTBD Implementation Patterns

### Pattern 1: Microservice Deployment

```typescript
const microserviceJTBD: JTBDWorkflow = {
  id: 'microservice-deployment',
  name: 'Complete Microservice Deployment',
  job: 'Deploy production-ready microservice with full enterprise capabilities',
  steps: [
    {
      action: 'generate',
      description: 'Create microservice scaffolding',
      generator: 'fortune5',
      template: 'microservice',
      parameters: {
        serviceName: 'user-service',
        databaseType: 'postgresql',
        authProvider: 'oauth2',
        complianceMode: 'soc2',
        observabilityStack: 'prometheus'
      }
    },
    {
      action: 'generate',
      description: 'Setup monitoring infrastructure',
      generator: 'fortune5', 
      template: 'monitoring',
      parameters: {
        serviceName: 'user-service',
        monitoringType: 'prometheus'
      }
    },
    {
      action: 'inject',
      description: 'Add compliance middleware',
      parameters: {
        file: './src/middleware/index.js',
        after: '// Middleware imports',
        content: `
const auditMiddleware = require('./audit.middleware');
const complianceMiddleware = require('./compliance.middleware');

app.use(auditMiddleware());
app.use(complianceMiddleware({ mode: 'soc2' }));
        `
      }
    },
    {
      action: 'validate',
      description: 'Validate deployment configuration',
      parameters: {
        files: [
          'k8s/deployment.yaml',
          'k8s/service.yaml',
          'docker/Dockerfile'
        ]
      }
    }
  ]
};
```

### Pattern 2: API Platform Setup

```typescript
const apiPlatformJTBD: JTBDWorkflow = {
  id: 'api-platform-setup',
  name: 'Enterprise API Platform Setup',
  job: 'Deploy complete API platform with gateway, services, and monitoring',
  steps: [
    {
      action: 'generate',
      description: 'Deploy API Gateway',
      generator: 'fortune5',
      template: 'api-gateway',
      parameters: {
        gatewayName: 'enterprise-gateway',
        authStrategy: 'jwt',
        rateLimitStrategy: 'sliding-window'
      }
    },
    {
      action: 'generate',
      description: 'Deploy Auth Service',
      generator: 'fortune5',
      template: 'microservice',
      parameters: {
        serviceName: 'auth-service',
        authProvider: 'oauth2',
        complianceMode: 'soc2'
      }
    },
    {
      action: 'generate',
      description: 'Deploy User Service',
      generator: 'fortune5',
      template: 'microservice',
      parameters: {
        serviceName: 'user-service',
        databaseType: 'postgresql',
        complianceMode: 'soc2'
      }
    },
    {
      action: 'inject',
      description: 'Configure gateway routing',
      parameters: {
        file: './api-gateway/config/routes.yaml',
        after: '# Route definitions',
        content: `
- name: auth-service
  url: http://auth-service:3000
  prefix: /auth
- name: user-service  
  url: http://user-service:3000
  prefix: /users
        `
      }
    }
  ]
};
```

### Pattern 3: Data Platform Deployment

```typescript
const dataPlatformJTBD: JTBDWorkflow = {
  id: 'data-platform-deployment',
  name: 'Enterprise Data Platform',
  job: 'Deploy scalable data processing platform with governance',
  steps: [
    {
      action: 'generate',
      description: 'Setup data pipeline infrastructure',
      generator: 'fortune5',
      template: 'data-pipeline',
      parameters: {
        pipelineName: 'customer-analytics',
        processingEngine: 'spark',
        orchestrator: 'airflow',
        complianceMode: 'gdpr'
      }
    },
    {
      action: 'generate',
      description: 'Setup compliance framework',
      generator: 'fortune5',
      template: 'compliance',
      parameters: {
        complianceType: 'gdpr',
        auditingEnabled: true
      }
    },
    {
      action: 'generate',
      description: 'Setup monitoring stack',
      generator: 'fortune5',
      template: 'monitoring',
      parameters: {
        monitoringType: 'elastic',
        tracingEnabled: true
      }
    }
  ]
};
```

## Compliance and Security Considerations

### Security by Design

All Fortune 5 templates implement security controls:

```yaml
Security Controls:
  Authentication:
    - Multi-factor authentication support
    - Token-based authentication (JWT/OAuth2)
    - Session management and timeout
    - Password policies and encryption
    
  Authorization:
    - Role-based access control (RBAC)
    - Attribute-based access control (ABAC) 
    - Principle of least privilege
    - Permission inheritance and delegation
    
  Data Protection:
    - Encryption at rest (AES-256)
    - Encryption in transit (TLS 1.3)
    - Key management and rotation
    - Data masking and anonymization
    
  Network Security:
    - Network segmentation
    - Firewall rules and policies
    - DDoS protection
    - Intrusion detection and prevention
    
  Monitoring:
    - Security event logging
    - Anomaly detection
    - Threat intelligence integration
    - Incident response automation
```

### Compliance Mapping

Templates are mapped to specific compliance requirements:

```yaml
SOC2 Type II:
  CC6.1: Logical and physical access controls
    - Templates: microservice, api-gateway
    - Controls: RBAC, MFA, session management
    
  CC7.1: Detection of potential security events
    - Templates: monitoring, compliance
    - Controls: SIEM, log aggregation, alerting
    
  CC8.1: Change management procedures
    - Templates: All templates
    - Controls: Git workflows, approval processes
    
HIPAA:
  164.312(a)(1): Access control
    - Templates: microservice, api-gateway
    - Controls: Unique user identification, automatic logoff
    
  164.312(e)(1): Transmission security
    - Templates: All templates  
    - Controls: End-to-end encryption, integrity controls
    
PCI-DSS:
  Requirement 3: Protect stored cardholder data
    - Templates: microservice, data-pipeline
    - Controls: Data encryption, key management
    
  Requirement 10: Log and monitor all network resources
    - Templates: monitoring, compliance
    - Controls: Audit trails, log retention
```

### Audit Trail Implementation

Comprehensive audit logging is built into all templates:

```typescript
interface AuditEvent {
  timestamp: string;           // ISO 8601 timestamp
  eventType: string;           // CREATE, READ, UPDATE, DELETE, LOGIN, etc.
  userId: string;              // User identifier
  sessionId: string;           // Session identifier
  resourceType: string;        // Type of resource accessed
  resourceId: string;          // Resource identifier
  action: string;              // Specific action performed
  outcome: 'SUCCESS' | 'FAILURE';  // Operation result
  sourceIP: string;            // Source IP address
  userAgent: string;           // Client user agent
  requestId: string;           // Unique request identifier
  additionalData?: any;        // Context-specific data
}

// Example audit log entry
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "eventType": "DATA_ACCESS",
  "userId": "user-12345",
  "sessionId": "sess-67890",
  "resourceType": "customer",
  "resourceId": "cust-98765",
  "action": "READ",
  "outcome": "SUCCESS",
  "sourceIP": "192.168.1.100",
  "userAgent": "MyApp/1.0",
  "requestId": "req-abcdef",
  "additionalData": {
    "dataFields": ["name", "email"],
    "complianceMode": "gdpr"
  }
}
```

## Scaling Recommendations

### Horizontal Scaling

Templates support horizontal scaling patterns:

```yaml
Microservice Scaling:
  Strategy: Kubernetes HPA
  Metrics: CPU, Memory, Custom metrics
  Min Replicas: 2
  Max Replicas: 50
  Target CPU: 70%
  Target Memory: 80%
  
API Gateway Scaling:  
  Strategy: Load balancer with multiple instances
  Health Checks: HTTP health endpoints
  Auto Scaling: Based on request volume
  Circuit Breakers: Prevent cascade failures
  
Data Pipeline Scaling:
  Strategy: Dynamic resource allocation
  Spark: Dynamic executor allocation
  Kafka: Partition-based scaling
  Airflow: Worker node auto-scaling
```

### Performance Optimization

Enterprise performance considerations:

```yaml
Database Optimization:
  Connection Pooling: 
    - Min connections: 5
    - Max connections: 20
    - Idle timeout: 30s
  Query Optimization:
    - Index strategy
    - Query plan analysis
    - Slow query logging
  Caching:
    - Redis for session data
    - Application-level caching
    - CDN for static content
    
Network Optimization:
  Load Balancing:
    - Health check intervals: 30s
    - Failover timeout: 5s
    - Session affinity when needed
  CDN Configuration:
    - Cache TTL: 1 hour for static
    - Edge locations for global reach
  Connection Management:
    - Keep-alive connections
    - Connection pooling
    - Request/response compression
```

### Cost Optimization

Resource optimization strategies:

```yaml
Compute Optimization:
  Right Sizing: 
    - Regular instance analysis
    - Auto-scaling policies
    - Spot instance usage
  Resource Allocation:
    - CPU and memory limits
    - Resource quotas
    - Usage monitoring
    
Storage Optimization:
  Data Lifecycle:
    - Automated tiering
    - Data archival policies  
    - Compression strategies
  Backup Strategy:
    - Incremental backups
    - Cross-region replication
    - Retention policies
    
Monitoring Costs:
  Resource Tracking:
    - Cost per service
    - Usage analytics
    - Budget alerts
```

## Enterprise Integration Patterns

### CI/CD Integration

Templates include CI/CD pipeline definitions:

```yaml
# .github/workflows/deploy.yml (generated)
name: Enterprise Deployment Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Security Scan
        uses: securecodewarrior/github-action-add-sarif@v1
        with:
          sarif-file: security-scan-results.sarif
          
  compliance-check:
    runs-on: ubuntu-latest  
    steps:
      - uses: actions/checkout@v3
      - name: SOC2 Compliance Check
        run: |
          npm install -g compliance-checker
          compliance-checker --standard soc2 --config compliance.json
          
  deploy-staging:
    needs: [security-scan, compliance-check]
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Staging
        run: |
          kubectl apply -f k8s/ --namespace staging
          kubectl rollout status deployment/${{ env.SERVICE_NAME }} --namespace staging
          
  integration-tests:
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - name: Run Integration Tests
        run: |
          npm test -- --testPathPattern=integration
          
  deploy-production:
    needs: integration-tests
    runs-on: ubuntu-latest
    environment: production
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to Production
        run: |
          kubectl apply -f k8s/ --namespace production
          kubectl rollout status deployment/${{ env.SERVICE_NAME }} --namespace production
```

### Service Mesh Integration

Templates support service mesh deployment:

```yaml
# Istio configuration (generated)
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: {{ serviceName }}
spec:
  hosts:
  - {{ serviceName }}
  http:
  - match:
    - headers:
        x-user-role:
          exact: admin
    route:
    - destination:
        host: {{ serviceName }}
        subset: v2
  - route:
    - destination:
        host: {{ serviceName }}
        subset: v1
---
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: {{ serviceName }}
spec:
  host: {{ serviceName }}
  trafficPolicy:
    tls:
      mode: ISTIO_MUTUAL
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2
```

### Multi-Cloud Deployment

Templates support multi-cloud deployments:

```yaml
# Terraform configuration (generated)
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

# AWS deployment
module "aws_deployment" {
  source = "./modules/aws"
  
  service_name = var.service_name
  region      = var.aws_region
  compliance  = var.compliance_mode
}

# Azure deployment  
module "azure_deployment" {
  source = "./modules/azure"
  
  service_name = var.service_name
  location    = var.azure_location
  compliance  = var.compliance_mode
}
```

## Best Practices

### Template Customization

Recommended approach for customizing Fortune 5 templates:

1. **Fork and Extend**: Create organization-specific versions
2. **Environment Variables**: Use environment-specific configurations
3. **Overlay Patterns**: Layer additional configurations
4. **Validation**: Implement custom validation rules

### Governance

Enterprise governance recommendations:

```yaml
Template Governance:
  Approval Process:
    - Architecture review required
    - Security team approval
    - Compliance team sign-off
    
  Version Control:
    - Semantic versioning
    - Change documentation
    - Rollback procedures
    
  Testing Strategy:
    - Unit tests for templates
    - Integration tests
    - Security scanning
    - Compliance validation
    
  Monitoring:
    - Template usage analytics
    - Performance metrics
    - Error rate tracking
    - User feedback collection
```

### Team Organization

Recommended team structure for enterprise adoption:

```yaml
Platform Team:
  - Template maintainers
  - Infrastructure engineers
  - DevOps specialists
  
Security Team:
  - Security architects
  - Compliance specialists
  - Penetration testers
  
Development Teams:
  - Template consumers
  - Service owners
  - Quality assurance
```

This comprehensive guide provides enterprise development teams with the knowledge needed to effectively use Fortune 5 templates for building production-ready, compliant, and scalable applications.