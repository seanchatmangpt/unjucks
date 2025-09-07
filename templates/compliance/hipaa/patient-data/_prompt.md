---
to: "<%= h.outputPath(templateDir, filename) %>"
inject: <%= inject || false %>
skipIf: "<%= skipIf || '' %>"
---

# HIPAA Patient Data Protection Template

## Compliance Metadata
- **Regulation**: HIPAA (Health Insurance Portability and Accountability Act)
- **Standard**: Security Rule (45 CFR §164.306)
- **Jurisdiction**: United States
- **Compliance Level**: <%= complianceLevel || 'Standard' %>
- **Risk Level**: Critical
- **Last Updated**: 2024-01-15
- **Certification Status**: Certified

## Variables
This template uses the following variables:

- `entityName` (required): Name of the healthcare entity/model
- `phiFields` (required): Array of PHI (Protected Health Information) fields
- `coveredEntity` (string): Name of covered entity
- `businessAssociate` (string): Business associate name (if applicable)
- `encryptionLevel` (string): Encryption level (AES256, AES128)
- `accessControlModel` (string): RBAC, ABAC, or MAC
- `auditRetentionYears` (number): Audit log retention period
- `minimumNecessary` (boolean): Apply minimum necessary standard

## Purpose
Generates HIPAA-compliant patient data handling code with:
- PHI encryption (AES-256)
- Role-based access controls
- Comprehensive audit logging
- Data integrity measures
- Secure transmission protocols
- Minimum necessary access

## Usage Example
```bash
unjucks generate compliance hipaa/patient-data --entityName Patient --coveredEntity "Memorial Hospital" --encryptionLevel AES256 --accessControlModel RBAC --auditRetentionYears 6 --minimumNecessary true
```

## HIPAA Compliance Features
- ✅ Administrative Safeguards (§164.308)
- ✅ Physical Safeguards (§164.310)
- ✅ Technical Safeguards (§164.312)
- ✅ PHI Encryption (§164.312(a)(2)(iv))
- ✅ Access Control (§164.312(a)(1))
- ✅ Audit Controls (§164.312(b))
- ✅ Integrity (§164.312(c)(1))
- ✅ Person or Entity Authentication (§164.312(d))
- ✅ Transmission Security (§164.312(e)(1))

## Risk Mitigation
- AES-256 encryption for all PHI at rest and in transit
- Role-based access with minimum necessary principle
- Comprehensive audit trails with tamper detection
- Digital signatures for data integrity
- Secure key management with HSM integration
- Automated breach detection and notification
- Regular vulnerability assessments

## Access Control Roles
- **Healthcare Provider**: Full patient care access
- **Nurse**: Limited clinical access
- **Billing**: Financial information only
- **Administrator**: System configuration
- **Auditor**: Read-only audit access
- **Patient**: Own records access

## Enterprise Features
- Multi-facility data segregation
- HL7 FHIR integration
- Clinical decision support
- Population health analytics
- Interoperability with EHR systems
- Automated compliance reporting
- Incident response workflows