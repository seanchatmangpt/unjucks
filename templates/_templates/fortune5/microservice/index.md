---
name: "Fortune 500 Microservice"
description: "Complete enterprise microservice scaffolding with security, observability, and compliance built-in"
category: "microservice"
jtbd: "Deploy a production-ready microservice that meets Fortune 500 enterprise standards for security, scalability, and observability"
tags: 
  - microservice
  - enterprise
  - kubernetes
  - security
  - observability
  - compliance
compliance:
  standards:
    - SOC2
    - ISO27001
    - PCI-DSS
  certifications:
    - "NIST Cybersecurity Framework"
    - "CIS Controls"
  auditTrail: true
inject:
  - name: "helm-values"
    description: "Inject Helm values for existing deployments"
    pattern: "# HELM VALUES INJECTION"
    type: "after"
  - name: "middleware"
    description: "Add middleware to existing Express apps"
    pattern: "// MIDDLEWARE INJECTION"
    type: "after"
  - name: "routes"
    description: "Add routes to existing API servers"
    pattern: "// ROUTES INJECTION"
    type: "before"
variables:
  - name: "serviceName"
    type: "string"
    description: "Name of the microservice (kebab-case)"
    required: true
    validation: "^[a-z0-9-]+$"
  - name: "servicePort"
    type: "number"
    description: "Port for the service to run on"
    required: true
    defaultValue: 3000
  - name: "databaseType"
    type: "string"
    description: "Type of database (postgresql, mongodb, redis)"
    required: true
    options: ["postgresql", "mongodb", "redis", "mysql"]
  - name: "authProvider"
    type: "string"
    description: "Authentication provider"
    required: true
    options: ["oauth2", "jwt", "saml", "ldap"]
  - name: "complianceMode"
    type: "string" 
    description: "Compliance requirements"
    required: true
    options: ["soc2", "hipaa", "pci-dss", "gdpr"]
  - name: "observabilityStack"
    type: "string"
    description: "Observability platform"
    required: true
    options: ["datadog", "newrelic", "prometheus", "elastic"]
  - name: "cloudProvider"
    type: "string"
    description: "Target cloud platform"
    required: true
    options: ["aws", "azure", "gcp", "on-premises"]
rdf:
  ontology: "http://unjucks.dev/ontology/microservice"
  properties:
    - "hasDatabase"
    - "requiresAuth" 
    - "meetsCompliance"
    - "usesObservability"
---

# Fortune 500 Microservice Template

This template generates a production-ready microservice that meets enterprise standards for:

- **Security**: OAuth2/JWT authentication, input validation, security headers
- **Observability**: Structured logging, metrics, distributed tracing  
- **Compliance**: SOC2, HIPAA, PCI-DSS controls and audit trails
- **Scalability**: Kubernetes-ready with auto-scaling and health checks
- **Reliability**: Circuit breakers, retries, graceful shutdowns

## Generated Structure

```
{{serviceName}}/
├── src/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   └── routes/
├── k8s/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── configmap.yaml
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── tests/
├── docs/
└── compliance/
```

## Compliance Features

- Audit logging for all operations
- Encryption at rest and in transit
- Role-based access control (RBAC)
- Data retention policies
- Security scanning and SAST integration