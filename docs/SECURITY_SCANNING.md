# Security Scanning Documentation

## Unified Security Workflow

The unified security scanning workflow consolidates all security checks into a single GitHub Actions workflow that runs comprehensive security analysis.

## Components

### 1. CodeQL Analysis (SAST)
- **Purpose**: Static Application Security Testing
- **Tools**: GitHub CodeQL with security-extended queries
- **Scope**: JavaScript/TypeScript source code analysis
- **Triggers**: All pushes, PRs, daily schedule
- **SARIF Upload**: Yes - results appear in GitHub Security tab

### 2. Dependency Security Scanning
- **Purpose**: Identify vulnerabilities in dependencies
- **Tools**: NPM Audit with enhanced error handling
- **Scope**: package.json, package-lock.json, node_modules
- **Failure Conditions**: Critical or High severity vulnerabilities
- **Features**: 
  - SBOM (Software Bill of Materials) generation
  - Known vulnerable package detection
  - Suspicious postinstall script detection

### 3. Secret Scanning
- **Purpose**: Detect secrets, API keys, tokens in code
- **Tools**: TruffleHog + custom pattern matching
- **Scope**: Full git history, source files
- **Failure Conditions**: Verified secrets only
- **Features**:
  - Multi-pattern detection (API keys, tokens, private keys)
  - High-confidence verification
  - False positive filtering

### 4. Vulnerability Scanning
- **Purpose**: Multi-tool vulnerability analysis
- **Tools**: Snyk, OSV Scanner
- **Scope**: Dependencies and known CVEs
- **Failure Conditions**: continue-on-error (informational)
- **Features**: Cross-validation across multiple databases

### 5. Compliance Scanning
- **Purpose**: License and regulatory compliance
- **Tools**: license-checker, custom GDPR checks
- **Scope**: All dependencies, data collection patterns
- **Failure Conditions**: continue-on-error (informational)
- **Features**:
  - Prohibited license detection
  - GDPR compliance patterns
  - License summary generation

## Triggering the Workflow

### Automatic Triggers
- **Push**: main, develop branches
- **Pull Request**: affecting sensitive files (src/, bin/, scripts/, package*.json, .github/, Dockerfile*, .env*)
- **Schedule**: Daily at 3 AM UTC
- **Manual**: GitHub Actions UI

### Manual Execution Options
```yaml
scan_type:
  - full      # All security scans (default)
  - sast      # CodeQL analysis only
  - dependencies # Dependency and vulnerability scans
  - secrets   # Secret scanning only
  - compliance # License and compliance only
```

## Configuration

### Required Permissions
```yaml
permissions:
  contents: read
  security-events: write  # For SARIF upload
  actions: read
```

### Timeout Settings
- **CodeQL Analysis**: 30 minutes
- **Dependency Security**: 15 minutes
- **Secret Scanning**: 20 minutes
- **Vulnerability Scanning**: 25 minutes
- **Compliance Scanning**: 15 minutes
- **Security Summary**: 10 minutes

### Caching Strategy
- **CodeQL databases**: Per commit with fallback
- **NPM dependencies**: Per package*.json hash
- **TruffleHog**: Per OS with version pinning

## Error Handling

### Critical Failures (Block Deployment)
- CodeQL analysis failures
- Critical/High dependency vulnerabilities
- Verified secret detection

### Non-Critical Warnings (Informational)
- Vulnerability scanner findings
- License compliance issues
- Unverified secret patterns

### Continue-on-Error Usage
- Custom pattern checks (SAST)
- Third-party vulnerability tools
- License compliance scanning
- GDPR pattern detection

## Output and Reporting

### Artifacts (Retention)
- **dependency-scan-results**: 30 days
- **secret-scan-results**: 30 days
- **vulnerability-scan-results**: 30 days
- **compliance-scan-results**: 30 days
- **unified-security-report**: 90 days

### GitHub Security Tab
- CodeQL findings automatically uploaded via SARIF
- Dependency vulnerabilities from npm audit
- Secret scanning results (if verified)

### Pull Request Comments
- Comprehensive security summary
- Component-by-component status
- Overall pass/fail determination
- Links to detailed artifacts

## Local Security Commands

### NPM Scripts
```bash
# Basic security scan
npm run security:scan

# SAST analysis
npm run security:sast

# Dependency analysis
npm run security:deps

# Pattern checking
npm run security:patterns

# License compliance
npm run security:compliance

# Comprehensive security test
npm run test:security
```

### Manual Tools
```bash
# TruffleHog secret scanning
curl -sSfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh | sh
trufflehog git file://. --json

# Snyk vulnerability scanning
npm install -g snyk
snyk test

# OSV Scanner
curl -L https://github.com/google/osv-scanner/releases/latest/download/osv-scanner_linux_amd64 -o osv-scanner
./osv-scanner --lockfile package-lock.json

# License checking
npm install -g license-checker
license-checker --summary
```

## Best Practices

### For Developers
1. Run `npm run test:security` before committing
2. Use environment variables for sensitive data
3. Review dependency updates for security implications
4. Keep `.gitignore` updated to exclude secrets

### For Security Teams
1. Review daily scan results
2. Investigate all verified secret findings immediately
3. Evaluate new dependency vulnerabilities
4. Monitor compliance report trends

### For DevOps
1. Ensure GitHub Security tab is monitored
2. Configure branch protection rules based on security results
3. Set up notifications for critical failures
4. Regular review of security artifacts

## Troubleshooting

### Common Issues
- **CodeQL timeout**: Reduce code complexity or increase timeout
- **NPM audit failures**: Check for false positives in audit results
- **TruffleHog false positives**: Add exclusion patterns
- **Cache misses**: Verify cache key patterns

### Debug Mode
Enable debug logging by setting GitHub Actions secret:
```
ACTIONS_RUNNER_DEBUG=true
```

## Security Contact

For security issues or questions about the scanning process:
- Create an issue with the `security` label
- Contact the security team through established channels
- For critical vulnerabilities, follow responsible disclosure procedures