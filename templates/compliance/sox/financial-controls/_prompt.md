---
to: "<%= h.outputPath(templateDir, filename) %>"
inject: <%= inject || false %>
skipIf: "<%= skipIf || '' %>"
---

# SOX Financial Controls Template

## Compliance Metadata
- **Regulation**: SOX (Sarbanes-Oxley Act)
- **Section**: Section 404 (Management Assessment of Internal Controls)
- **Jurisdiction**: United States
- **Compliance Level**: <%= complianceLevel || 'Standard' %>
- **Risk Level**: Critical
- **Last Updated**: 2024-01-15
- **Certification Status**: Certified

## Variables
This template uses the following variables:

- `entityName` (required): Name of the financial entity/model
- `financialFields` (required): Array of financial data fields
- `publicCompany` (boolean): Whether this is for a public company
- `auditFirm` (string): External audit firm name
- `fiscalYearEnd` (string): Fiscal year end date
- `segregationOfDuties` (boolean): Enable segregation of duties
- `changeControls` (boolean): Enable change control procedures
- `retentionYears` (number): Financial record retention period
- `materialityThreshold` (number): Materiality threshold amount

## Purpose
Generates SOX-compliant financial controls with:
- Segregation of duties enforcement
- Internal control documentation
- Financial data integrity measures
- Change management procedures
- Comprehensive audit trails
- Management assessment capabilities

## Usage Example
```bash
unjucks generate compliance sox/financial-controls --entityName Transaction --publicCompany true --auditFirm "KPMG" --segregationOfDuties true --changeControls true --retentionYears 7 --materialityThreshold 5000000
```

## SOX Compliance Features
- ✅ Internal Control Framework (Section 404)
- ✅ Management Assessment (Section 404(a))
- ✅ Auditor Attestation Support (Section 404(b))
- ✅ Financial Disclosure Controls (Section 302)
- ✅ Real-time Disclosure (Section 409)
- ✅ Code of Ethics (Section 406)
- ✅ Whistleblower Protection (Section 806)
- ✅ Document Retention (Section 802)

## Internal Control Components
- **Control Environment**: Ethical tone, oversight, competence
- **Risk Assessment**: Financial reporting risks identification
- **Control Activities**: Policies and procedures
- **Information & Communication**: Financial data flow
- **Monitoring**: Ongoing assessment and remediation

## Segregation of Duties Matrix
- **Authorization**: Who can approve transactions
- **Recording**: Who can record transactions
- **Custody**: Who has access to assets
- **Reconciliation**: Who performs reconciliations

## Enterprise Features
- Multi-entity consolidation controls
- Executive certification workflows
- Quarterly assessment automation
- External auditor collaboration
- Deficiency tracking and remediation
- Management representation letters
- Continuous monitoring dashboards

## Risk Mitigation
- Automated control testing procedures
- Exception reporting and investigation
- Management override detection
- Fraud risk assessment integration
- Third-party service organization controls
- IT general controls integration
- Business process controls automation