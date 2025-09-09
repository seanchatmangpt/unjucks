# 🏛️ Fortune 5 Quality Gates System

This document describes the comprehensive quality gate system implemented for the Unjucks project, designed to meet Fortune 5 enterprise standards.

## Overview

The unified quality gate system ensures that all code changes meet the highest standards for:
- **Code Coverage**: 85%+ lines, 90%+ functions, 80%+ branches
- **Security**: Zero critical/high vulnerabilities 
- **Code Quality**: Cyclomatic complexity ≤10, duplication ≤3%
- **Performance**: Bundle size ≤250KB, startup time ≤500ms
- **Documentation**: 80%+ coverage for public APIs

## System Architecture

### 1. Unified Quality Gate Workflow
**File**: `.github/workflows/unified-quality-gate.yml`

The main quality validation pipeline that:
- Auto-detects validation tier based on branch and changes
- Runs comprehensive coverage, security, and quality analysis
- Provides auto-remediation for certain types of issues
- Enforces Fortune 5 standards with zero tolerance for critical issues

**Validation Tiers**:
- **Basic**: Feature branches (relaxed standards)
- **Enterprise**: Develop branch (standard requirements)
- **Fortune 5**: Main branch (strictest standards)
- **Compliance Audit**: Regulatory compliance mode

### 2. Quality Configuration
**File**: `.github/quality-gate-config.yml`

Centralized configuration defining:
- Coverage thresholds by validation tier
- Security vulnerability limits
- Code quality metrics and limits
- Performance budgets
- Documentation requirements

### 3. Security Configuration
**Files**: 
- `.eslintrc.security.js` - Security-focused ESLint rules
- `.semgrep-rules.yml` - Custom SAST rules for Unjucks

Advanced security scanning including:
- Hardcoded secrets detection
- SQL injection prevention
- XSS vulnerability detection
- Prototype pollution prevention
- Insecure crypto usage detection

### 4. Production Validator
**File**: `scripts/quality/production-validator.js`

Comprehensive production readiness validation that ensures:
- No mock/fake/stub implementations remain
- Real database connections (no in-memory DBs)
- Proper external API integrations
- Security hardening in place
- Performance optimizations applied

## Quality Metrics Dashboard

### Real-time Monitoring
**File**: `.github/workflows/quality-dashboard.yml`

Automated dashboard generation providing:
- Overall quality score (0-100)
- Coverage breakdown by category
- Security issue tracking
- Performance metrics
- Code complexity analysis
- Trend analysis and recommendations

The dashboard is automatically deployed to GitHub Pages and updated on every push to main.

### Key Metrics Tracked

| Metric | Fortune 5 Threshold | Enterprise Threshold |
|--------|-------------------|---------------------|
| Line Coverage | 85% | 80% |
| Function Coverage | 90% | 85% |
| Branch Coverage | 80% | 75% |
| Critical Vulnerabilities | 0 | 0 |
| High Vulnerabilities | 0 | 1 |
| Cyclomatic Complexity | ≤10 | ≤12 |
| Code Duplication | ≤3% | ≤5% |
| Bundle Size | ≤250KB | ≤350KB |

## Branch Protection & Auto-Merge

### Branch Protection Rules
**File**: `.github/workflows/branch-protection-setup.yml`

Automatically configures:
- **Main Branch**: 2 required reviewers, 15+ status checks, admin enforcement
- **Develop Branch**: 1 required reviewer, 7+ status checks
- Linear history requirement
- Force push prevention

### Auto-Merge Configuration
**File**: `.github/auto-merge-config.yml`

Intelligent auto-merge system that:
- Evaluates PR size, author, and file patterns
- Requires all quality gates to pass
- Enforces different standards by branch
- Provides emergency override mechanisms
- Maintains complete audit trail

**Auto-Merge Eligibility**:
- ✅ Small PRs from trusted bots (Dependabot, Renovate)
- ✅ Documentation and test updates
- ✅ Non-security configuration changes
- ❌ Security-sensitive code changes
- ❌ Breaking changes
- ❌ Production configuration

## Quality Gate Enforcement

### Status Checks Required

#### Main Branch (Fortune 5)
1. **Coverage Validation**: Comprehensive test coverage analysis
2. **Security Validation**: SAST, dependency scanning, vulnerability detection
3. **Quality Analysis**: Complexity, duplication, maintainability
4. **Production Validation**: Real integration testing
5. **Performance Validation**: Bundle size, load time benchmarks

#### All Branches (Core)
1. **Lint Check**: Code style and best practices
2. **Type Check**: Type safety validation
3. **Unit Tests**: Comprehensive test suite execution
4. **Build Check**: Successful compilation and packaging
5. **Security Audit**: Dependency vulnerability scanning

### Failure Handling

**Automatic Remediation**:
- ESLint auto-fixes for style issues
- Prettier formatting corrections
- Security patch applications
- Dependency updates (minor/patch)

**Manual Review Required**:
- Critical security vulnerabilities
- Complex code quality issues
- Architecture changes
- Breaking changes

## Usage Guide

### For Developers

1. **Local Validation**:
   ```bash
   # Run production validator
   node scripts/quality/production-validator.js --level fortune_5
   
   # Check coverage
   npm run test -- --coverage
   
   # Security scan
   npm run security:scan
   ```

2. **PR Guidelines**:
   - Keep PRs small (< 200 lines changed)
   - Add appropriate labels
   - Ensure all tests pass locally
   - Address quality gate failures promptly

3. **Auto-Merge Setup**:
   ```bash
   # Enable auto-merge for eligible PRs
   gh pr create --label "auto-merge"
   
   # For dependency updates
   gh pr create --label "dependencies,auto-merge"
   ```

### For Maintainers

1. **Emergency Overrides**:
   ```bash
   # Security hotfix
   gh pr create --label "security,hotfix,emergency"
   
   # Production fix
   gh pr create --label "production,hotfix,critical"
   ```

2. **Quality Monitoring**:
   - Review quality dashboard daily
   - Monitor trend analysis
   - Address recurring issues
   - Update thresholds as needed

## Compliance & Audit

### Regulatory Compliance
The system supports various compliance frameworks:
- **SOX**: Dual approval for financial systems
- **GDPR**: Data processing impact reviews
- **HIPAA**: Healthcare data protection
- **ISO 27001**: Information security management

### Audit Trail
Complete audit trail maintained for:
- All quality gate decisions
- Auto-merge actions
- Override usage
- Security scan results
- Performance metrics

### Reporting
Automated reports generated for:
- Executive quality summaries
- Compliance dashboard updates
- Security posture reports
- Performance trend analysis

## Troubleshooting

### Common Issues

1. **Coverage Below Threshold**:
   ```bash
   # Generate coverage report
   npm run test -- --coverage
   
   # Identify uncovered lines
   open coverage/lcov-report/index.html
   ```

2. **Security Vulnerabilities**:
   ```bash
   # Review security report
   semgrep --config=.semgrep-rules.yml src/
   
   # Fix dependencies
   npm audit fix
   ```

3. **Quality Gate Failures**:
   ```bash
   # Run comprehensive validation
   node scripts/quality/production-validator.js --format text
   ```

### Support Contacts

- **Quality Issues**: [@seanchatmangpt](https://github.com/seanchatmangpt)
- **Security Concerns**: Create issue with `security` label
- **Emergency Overrides**: Ping `@emergency-contacts` in PR

---

## Implementation Status

- ✅ Unified quality gate workflow
- ✅ Security configuration and SAST rules
- ✅ Production validation framework
- ✅ Quality metrics dashboard
- ✅ Branch protection automation
- ✅ Auto-merge configuration
- ✅ Compliance framework
- ✅ Documentation and guides

**The Fortune 5 quality gate system is fully operational and enforcing enterprise standards across all code changes.**