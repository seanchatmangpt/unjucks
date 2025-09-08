# Business Requirements Document (BRD) Template

## Document Information

| Field | Value |
|-------|-------|
| Project Name | `[PROJECT_NAME]` |
| Document Version | `[VERSION]` |
| Last Updated | `[DATE]` |
| Authors | `[AUTHOR_NAMES]` |
| Reviewers | `[REVIEWER_NAMES]` |
| Approvers | `[APPROVER_NAMES]` |

## 1. Executive Summary

### 1.1 Purpose
Briefly describe the business problem or opportunity this project addresses.

### 1.2 Scope
Define what is and isn't included in this project.

### 1.3 Success Criteria
List measurable outcomes that define project success.

## 2. Business Context

### 2.1 Background
Provide context about the current business situation.

### 2.2 Problem Statement
Clearly articulate the business problem to be solved.

### 2.3 Business Opportunity
Describe the opportunity and potential benefits.

## 3. Stakeholders

### 3.1 Primary Stakeholders
| Name | Role | Responsibilities | Contact |
|------|------|------------------|---------|
| `[NAME]` | `[ROLE]` | `[RESPONSIBILITIES]` | `[CONTACT]` |

### 3.2 Secondary Stakeholders
List other affected parties and their interests.

## 4. Business Requirements

### 4.1 Functional Requirements

#### BR-001: [Requirement Name]
- **Description**: [Detailed description]
- **Business Value**: [Why this is needed]
- **Acceptance Criteria**: [How success is measured]
- **Priority**: [High/Medium/Low]
- **Dependencies**: [Other requirements this depends on]

#### BR-002: [Requirement Name]
[Continue pattern for each requirement]

### 4.2 Non-Functional Requirements

#### Performance Requirements
- **Response Time**: [Expected response times]
- **Throughput**: [Transaction volumes]
- **Scalability**: [Growth expectations]

#### Security Requirements
- **Authentication**: [User authentication needs]
- **Authorization**: [Access control requirements]
- **Data Protection**: [Sensitive data handling]

#### Compliance Requirements
- **Regulatory**: [Legal/regulatory compliance]
- **Standards**: [Industry standards to follow]
- **Audit**: [Audit trail requirements]

## 5. Business Rules

### BR-RULE-001: [Rule Name]
- **Description**: [Business rule description]
- **Rationale**: [Why this rule exists]
- **Impact**: [What happens if violated]

## 6. Assumptions and Constraints

### 6.1 Assumptions
List key assumptions made during requirements gathering.

### 6.2 Constraints
- **Budget**: [Budget limitations]
- **Timeline**: [Time constraints]
- **Technology**: [Technology constraints]
- **Resources**: [Resource limitations]

## 7. Risks and Mitigation

| Risk | Impact | Probability | Mitigation Strategy |
|------|---------|-------------|-------------------|
| `[RISK]` | `[HIGH/MED/LOW]` | `[HIGH/MED/LOW]` | `[MITIGATION]` |

## 8. Success Metrics

### 8.1 Key Performance Indicators (KPIs)
- **Metric 1**: [Description and target]
- **Metric 2**: [Description and target]

### 8.2 Return on Investment (ROI)
- **Investment**: [Total project cost]
- **Expected Return**: [Expected benefits]
- **Payback Period**: [Time to break even]

## 9. Approval

### 9.1 Sign-off
| Name | Role | Signature | Date |
|------|------|-----------|------|
| `[NAME]` | `[ROLE]` | | |

### 9.2 Change Control
All changes to this document must follow the established change control process.

---

## Template Usage Notes

### For Unjucks Integration:
```yaml
# frontmatter for BRD generation
---
to: docs/requirements/<%= projectName.toLowerCase() %>-brd.md
inject: false
---
```

### Variables to Customize:
- `PROJECT_NAME`: Name of your project
- `VERSION`: Document version (use semantic versioning)
- `DATE`: Last update date (ISO format recommended)
- `AUTHOR_NAMES`: Comma-separated list of authors
- Add specific business requirements as BR-XXX items
- Customize sections based on project complexity

### Integration Points:
- Link to Software Requirements Specification (SRS)
- Reference Architecture Decision Records (ADRs)
- Connect to test strategies and acceptance criteria
- Trace to user stories and epics