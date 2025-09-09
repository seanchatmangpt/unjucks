---
name: 🚨 CI/CD Failure (Automated)
about: Automated issue for CI/CD workflow failures
title: 'CI/CD Failure: [WORKFLOW_NAME] - [ERROR_TYPE]'
labels: ['ci-failure', 'automated-tracking', 'needs-investigation']
assignees: []
---

<!-- This template is used by automated systems. Do not edit manually. -->

## 🚨 CI/CD Workflow Failure Detected

### Workflow Details
- **Workflow**: [WORKFLOW_NAME]
- **Run ID**: [RUN_ID]
- **Commit**: [COMMIT_SHA]
- **Branch**: [BRANCH_NAME]
- **Conclusion**: [FAILURE_TYPE]
- **Run URL**: [RUN_URL]
- **Triggered**: [TRIGGER_TIME]

### Failure Analysis
[FAILURE_SUMMARY]

### Identified Issues
[ISSUE_LIST]

### Logs Preview
```
[LOGS_PREVIEW]
```

### Recommended Actions
[RECOMMENDATION_LIST]

### Performance Impact
- **Duration**: [DURATION]
- **Previous Success Rate**: [SUCCESS_RATE]
- **Failure Pattern**: [PATTERN]

### Swarm Coordination
This issue will be automatically tracked and coordinated by specialized agents:
- **Monitor Agent**: Continuous failure pattern analysis
- **Debugger Agent**: Root cause investigation  
- **Fixer Agent**: Automated resolution attempts

---
🤖 **Automated Issue Tracking**
- Created: [CREATION_TIME]
- Swarm ID: [SWARM_ID]
- Analysis ID: [ANALYSIS_ID]
- Priority: [PRIORITY]

_This issue was automatically created by the GitHub Actions failure tracking system._