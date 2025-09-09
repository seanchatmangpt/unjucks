# 🔍 Code Quality Validation Setup

## Overview

This document describes the comprehensive code quality validation system implemented for the Unjucks project. The system provides enterprise-grade code quality enforcement through automated linting, formatting, complexity analysis, and continuous integration.

## 🏗️ Architecture

```
Quality Validation System
├── 🧹 ESLint Configuration (.eslintrc.quality.js)
├── 💅 Prettier Configuration (.prettierrc.quality)
├── 🧠 Complexity Analysis (scripts/quality/complexity-analyzer.js)
├── ☂️ Coverage Analysis (scripts/quality/coverage-analyzer.js)
├── 📊 Quality Dashboard (scripts/quality/quality-dashboard.js)
├── 🔄 Pre-commit Hooks (.husky/pre-commit)
├── 📋 Lint-staged (lint-staged.config.js)
└── 🚀 GitHub Actions (.github/workflows/code-quality.yml)
```

## 📋 Components

### 1. ESLint Quality Configuration

**File**: `.eslintrc.quality.js`

Enterprise-grade ESLint configuration with comprehensive rules:

- **Error Level Rules**: Security, safety, and critical code quality issues
- **Warning Level Rules**: Complexity, maintainability, and style issues  
- **Complexity Thresholds**: Cyclomatic complexity, function/file size limits
- **Modern JavaScript**: ES2023 support with strict quality enforcement
- **Context-aware Rules**: Different rules for test files, config files, CLI scripts

**Key Features**:
- Maximum cyclomatic complexity: 15
- Maximum function lines: 100
- Maximum file lines: 500
- Maximum parameters: 5
- Security-focused rules (no eval, no script injection)
- JSDoc documentation enforcement

### 2. Prettier Quality Configuration

**File**: `.prettierrc.quality`

Consistent code formatting standards:

- **Print Width**: 80 characters
- **Indentation**: 2 spaces, no tabs
- **Quotes**: Single quotes for JavaScript, double for JSON
- **Trailing Commas**: ES5 compatible
- **Semicolons**: Always required
- **Line Endings**: LF (Unix style)

### 3. Complexity Analyzer

**File**: `scripts/quality/complexity-analyzer.js`

Advanced cyclomatic complexity analysis:

```bash
# Basic complexity analysis
npm run quality:complexity

# Strict mode (threshold: 10)
npm run quality:complexity:strict

# Generate JSON report
npm run quality:report
```

**Features**:
- **Cyclomatic Complexity**: Weighted complexity calculation
- **Maintainability Index**: 0-100 score based on multiple factors
- **Risk Assessment**: LOW/MODERATE/HIGH/CRITICAL classification
- **Issue Detection**: Automatic identification of quality issues
- **Quality Grading**: A-F grade system

**Complexity Scoring**:
- **Low Risk (≤5)**: Simple, easily testable code
- **Moderate (6-10)**: Acceptable complexity
- **High (11-15)**: Consider refactoring
- **Critical (>15)**: Immediate refactoring required

### 4. Coverage Analyzer

**File**: `scripts/quality/coverage-analyzer.js`

Comprehensive test coverage analysis:

```bash
# Run coverage analysis
npm run quality:coverage

# With custom thresholds
node scripts/quality/coverage-analyzer.js --threshold-lines 85 --threshold-branches 75
```

**Metrics**:
- **Line Coverage**: Percentage of executed lines
- **Function Coverage**: Percentage of called functions
- **Branch Coverage**: Percentage of executed branches
- **Statement Coverage**: Percentage of executed statements
- **Overall Score**: Weighted average with quality grading

### 5. Quality Dashboard

**File**: `scripts/quality/quality-dashboard.js`

Interactive quality metrics dashboard:

```bash
# Generate HTML dashboard
npm run quality:dashboard

# Custom options
node scripts/quality/quality-dashboard.js --format html,markdown --output quality-reports
```

**Outputs**:
- **HTML Dashboard**: Interactive visualization with charts
- **Markdown Report**: Detailed analysis report
- **JSON Data**: Machine-readable metrics
- **Trend Analysis**: Historical quality tracking

### 6. Pre-commit Hooks

**File**: `.husky/pre-commit`

Automated quality enforcement before commits:

```bash
# Install hooks
npm install
npx husky install

# Manual hook trigger
.husky/pre-commit
```

**Validations**:
- ✅ ESLint quality rules with auto-fix
- ✅ Prettier formatting with auto-fix
- ✅ Complexity analysis on staged files
- ✅ JSDoc syntax validation
- ✅ Security pattern detection
- ✅ Claude Flow coordination hooks

### 7. Lint-staged Configuration

**File**: `lint-staged.config.js`

File-type specific quality checks:

- **JavaScript Files**: ESLint + Prettier + JSDoc validation
- **JSON Files**: Prettier formatting
- **Markdown Files**: Prettier with prose wrap
- **Source Files**: Additional JSDoc validation
- **Test Files**: Relaxed rules for test-specific patterns
- **Scripts**: Security validation for potentially dangerous operations

## 🚀 GitHub Actions Workflow

**File**: `.github/workflows/code-quality.yml`

Comprehensive CI/CD quality validation:

### Jobs

1. **🧹 Lint Validation**
   - ESLint quality rules enforcement
   - Comparison with standard config
   - Quality gate: Max 50 errors

2. **💅 Format Validation**
   - Prettier formatting checks
   - Auto-fix suggestions
   - Quality gate: Max 20 formatting issues

3. **🧠 Complexity Analysis**
   - Cyclomatic complexity analysis
   - Risk distribution reporting
   - Quality gate: Grade D or higher

4. **📝 JSDoc Validation**
   - Documentation syntax validation
   - Coverage analysis
   - Quality gate: 50% coverage (strict mode)

5. **☂️ Coverage Analysis**
   - Test coverage with c8
   - Threshold enforcement
   - Quality gate: 60% coverage (strict mode)

6. **🎯 Quality Gates Summary**
   - Consolidated results
   - Overall pass/fail determination
   - Trend reporting

7. **🔧 Auto-Fix** (optional)
   - Automatic quality issue fixes
   - Commit fixes back to PR
   - Available via workflow dispatch

### Quality Levels

- **Basic**: Essential quality checks only
- **Comprehensive**: Full quality validation (default)
- **Strict**: Higher thresholds for enterprise use
- **Auto-fix**: Automatic issue remediation

## 📊 Quality Metrics

### Complexity Thresholds

| Risk Level | Complexity | Action Required |
|------------|------------|-----------------|
| Low | ≤5 | ✅ Maintain |
| Moderate | 6-10 | 🟡 Monitor |
| High | 11-15 | 🟠 Consider refactoring |
| Critical | >15 | 🔴 Immediate refactoring |

### Coverage Thresholds

| Grade | Lines | Functions | Branches | Statements |
|-------|-------|-----------|----------|------------|
| A | ≥90% | ≥90% | ≥85% | ≥90% |
| B | ≥80% | ≥80% | ≥75% | ≥80% |
| C | ≥70% | ≥70% | ≥65% | ≥70% |
| D | ≥60% | ≥60% | ≥55% | ≥60% |
| F | <60% | <60% | <55% | <60% |

### Maintainability Index

- **90-100**: Excellent maintainability
- **70-89**: Good maintainability
- **50-69**: Moderate maintainability
- **25-49**: Poor maintainability
- **0-24**: Critical maintainability issues

## 🛠️ Usage

### Local Development

```bash
# Install dependencies
npm install

# Run full quality check
npm run quality

# Fix quality issues automatically
npm run quality:fix

# Generate quality dashboard
npm run quality:dashboard

# Run specific checks
npm run lint:quality
npm run format:check
npm run quality:complexity
npm run quality:coverage
```

### CI/CD Integration

The quality workflow runs automatically on:
- **Push** to main/develop branches
- **Pull requests** to main/develop branches
- **Manual trigger** with custom parameters

### Quality Gates

Quality gates will fail builds if:
- ESLint errors exceed 50
- Formatting issues exceed 20
- Overall quality grade is F
- Coverage below thresholds (strict mode)
- Critical complexity issues found

## 🔧 Configuration

### Custom Thresholds

Update thresholds in workflow or scripts:

```yaml
# GitHub Actions
env:
  QUALITY_THRESHOLD: '12'  # Complexity threshold
  QUALITY_LEVEL: 'strict'  # Quality level
```

```bash
# Local scripts
node scripts/quality/complexity-analyzer.js --threshold 12
node scripts/quality/coverage-analyzer.js --threshold-lines 85
```

### Adding Custom Rules

1. **ESLint Rules**: Edit `.eslintrc.quality.js`
2. **Prettier Options**: Edit `.prettierrc.quality`
3. **Complexity Weights**: Modify `complexity-analyzer.js`
4. **Quality Grades**: Update grading logic in analyzers

## 📈 Monitoring

### Quality Trends

The system tracks quality metrics over time:
- Historical quality grades
- Complexity trends
- Coverage evolution
- Issue resolution patterns

### Reporting

- **Daily**: Automated quality reports
- **PR**: Quality impact analysis
- **Release**: Quality gate validation
- **Dashboard**: Real-time quality metrics

## 🚨 Troubleshooting

### Common Issues

1. **Pre-commit Hook Fails**
   ```bash
   # Fix permissions
   chmod +x .husky/pre-commit
   
   # Reinstall hooks
   npx husky install
   ```

2. **ESLint Quality Rules Too Strict**
   ```bash
   # Use standard config temporarily
   npm run lint:fix
   
   # Gradually adopt quality rules
   ```

3. **Coverage Analysis Fails**
   ```bash
   # Install c8
   npm install -g c8
   
   # Check test command
   npm test
   ```

4. **Complexity Threshold Too Low**
   ```bash
   # Increase threshold temporarily
   node scripts/quality/complexity-analyzer.js --threshold 20
   ```

### Getting Help

- **Documentation**: This file and inline comments
- **GitHub Issues**: Report bugs and feature requests
- **Code Review**: Request quality review in PRs
- **Dashboard**: Check quality metrics regularly

## 🎯 Best Practices

### Code Quality

1. **Write Simple Functions**: Keep complexity ≤10
2. **Add Documentation**: JSDoc for all public functions
3. **Test Thoroughly**: Aim for >80% coverage
4. **Refactor Regularly**: Address quality debt promptly
5. **Monitor Trends**: Use dashboard for insights

### Workflow Integration

1. **Pre-commit Hooks**: Enable for all contributors
2. **Quality Reviews**: Include quality checks in PR reviews
3. **Continuous Monitoring**: Regular quality dashboard reviews
4. **Team Training**: Share quality standards and tools
5. **Gradual Adoption**: Implement quality rules incrementally

## 📚 References

- [ESLint Rules Documentation](https://eslint.org/docs/rules/)
- [Prettier Configuration](https://prettier.io/docs/en/configuration.html)
- [Cyclomatic Complexity](https://en.wikipedia.org/wiki/Cyclomatic_complexity)
- [Code Coverage Best Practices](https://testing.googleblog.com/2020/08/code-coverage-best-practices.html)
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)

---

*This quality validation system ensures enterprise-grade code quality for the Unjucks project through automated enforcement, comprehensive analysis, and continuous monitoring.*