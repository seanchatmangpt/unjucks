---
name: "SOC2/HIPAA Compliant Service"
description: "Template for creating services that meet SOC2 Type II and HIPAA compliance requirements with built-in controls and audit trails"
category: "compliance"
jtbd: "Deploy services that automatically meet enterprise compliance requirements with proper controls, audit logging, and security measures"
tags:
  - compliance
  - soc2
  - hipaa
  - security
  - audit
  - encryption
  - access-control
compliance:
  standards:
    - SOC2
    - HIPAA
    - ISO27001
    - NIST
  certifications:
    - "SOC2 Type II"
    - "HIPAA Security Rule"
    - "HIPAA Privacy Rule"
  auditTrail: true
inject:
  - name: "compliance-middleware"
    description: "Add compliance middleware to existing services"
    pattern: "// COMPLIANCE MIDDLEWARE INJECTION"
    type: "after"
  - name: "audit-hooks"
    description: "Add audit logging hooks"
    pattern: "// AUDIT HOOKS INJECTION"
    type: "after"
variables:
  - name: "serviceName"
    type: "string"
    description: "Name of the compliant service"
    required: true
  - name: "complianceStandard"
    type: "string"
    description: "Primary compliance standard"
    required: true
    options: ["soc2", "hipaa", "both"]
  - name: "dataClassification"
    type: "string"
    description: "Highest data classification level"
    required: true
    options: ["public", "internal", "confidential", "restricted"]
  - name: "auditRetention"
    type: "number"
    description: "Audit log retention period (days)"
    required: true
    defaultValue: 2555
  - name: "encryptionLevel"
    type: "string"
    description: "Encryption requirements"
    required: true
    options: ["standard", "high", "fips-140-2"]
  - name: "accessControlModel"
    type: "string"
    description: "Access control model"
    required: true
    options: ["rbac", "abac", "zero-trust"]
rdf:
  ontology: "http://unjucks.dev/ontology/compliance"
  properties:
    - "meetsSOC2"
    - "meetsHIPAA"
    - "hasAuditTrail"
    - "encryptsData"
---

# SOC2/HIPAA Compliance Template

Creates services with built-in compliance controls:

## SOC2 Type II Controls
- **Security**: Multi-factor authentication, encryption, access controls
- **Availability**: Monitoring, incident response, business continuity
- **Processing Integrity**: Data validation, error handling, reconciliation
- **Confidentiality**: Data classification, DLP, secure transmission
- **Privacy**: Consent management, data subject rights, breach notification

## HIPAA Safeguards
- **Administrative**: Security officer, training, incident procedures
- **Physical**: Facility access controls, workstation security
- **Technical**: Access controls, audit controls, integrity, transmission security

## Built-in Features
- Automatic audit logging for all data access
- Role-based access control with least privilege
- End-to-end encryption (AES-256)
- Data loss prevention (DLP)
- Breach detection and notification
- Regular security assessments