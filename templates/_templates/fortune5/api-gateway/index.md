---
name: "Enterprise API Gateway"
description: "High-performance API gateway with advanced rate limiting, authentication, and observability for Fortune 500 enterprises"
category: "api-gateway"
jtbd: "Deploy a scalable API gateway that handles authentication, rate limiting, load balancing, and provides comprehensive API management capabilities"
tags:
  - api-gateway
  - kong
  - nginx
  - authentication
  - rate-limiting
  - load-balancer
  - enterprise
compliance:
  standards:
    - SOC2
    - ISO27001
    - PCI-DSS
  certifications:
    - "OWASP API Security"
    - "NIST Cybersecurity Framework"
  auditTrail: true
inject:
  - name: "upstream-services"
    description: "Add upstream services to existing gateway"
    pattern: "# UPSTREAM SERVICES INJECTION"
    type: "after"
  - name: "rate-limit-rules"
    description: "Add rate limiting rules"
    pattern: "# RATE LIMIT RULES INJECTION"
    type: "after"
variables:
  - name: "gatewayName"
    type: "string"
    description: "Name of the API gateway"
    required: true
  - name: "gatewayPort"
    type: "number"
    description: "Port for the gateway"
    required: true
    defaultValue: 8080
  - name: "adminPort"
    type: "number"
    description: "Admin API port"
    required: true
    defaultValue: 8001
  - name: "gatewayType"
    type: "string"
    description: "Type of gateway implementation"
    required: true
    options: ["kong", "nginx-plus", "istio", "envoy"]
  - name: "authStrategy"
    type: "string"
    description: "Authentication strategy"
    required: true
    options: ["jwt", "oauth2", "api-key", "mutual-tls"]
  - name: "rateLimitStrategy"
    type: "string"
    description: "Rate limiting strategy"
    required: true
    options: ["fixed-window", "sliding-window", "token-bucket", "leaky-bucket"]
  - name: "loadBalancingAlgorithm"
    type: "string"
    description: "Load balancing algorithm"
    required: true
    options: ["round-robin", "least-conn", "ip-hash", "consistent-hash"]
  - name: "tlsTermination"
    type: "boolean"
    description: "Enable TLS termination"
    required: true
    defaultValue: true
  - name: "wafEnabled"
    type: "boolean"
    description: "Enable Web Application Firewall"
    required: true
    defaultValue: true
rdf:
  ontology: "http://unjucks.dev/ontology/api-gateway"
  properties:
    - "managesAPI"
    - "providesAuth"
    - "enforcesRateLimit"
    - "terminatesTLS"
---

# Enterprise API Gateway Template

This template generates a production-ready API gateway with:

- **Authentication**: JWT, OAuth2, API keys, mTLS
- **Rate Limiting**: Multiple algorithms with Redis backend
- **Load Balancing**: Advanced algorithms with health checks
- **Security**: WAF, DDoS protection, security headers
- **Observability**: Metrics, logging, distributed tracing
- **High Availability**: Multi-zone deployment with failover

## Generated Architecture

```
Internet → Load Balancer → API Gateway → Microservices
                            ├── Auth Service
                            ├── Rate Limiter
                            ├── WAF
                            └── Observability
```

## Features

- Auto-scaling based on request volume
- Circuit breaker pattern for upstream services
- Request/response transformation
- API versioning and deprecation
- Developer portal with API documentation