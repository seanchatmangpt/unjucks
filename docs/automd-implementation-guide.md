# AutoMD Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing automd automation in the Unjucks project to ensure README.md and documentation stay synchronized automatically.

## ✅ Completed Setup

### 1. Dependencies Added
- Added `automd: ^0.3.8` to devDependencies in package.json
- Added npm scripts: `docs:update` and `docs:check`

### 2. Configuration Files Created
- `automd.config.ts` - Main configuration for automd
- `README.automd.md` - Example of automd-compatible README structure

### 3. GitHub Workflow Updated
- Fixed `.github/workflows/autofix.yml` to use `npm run docs:update` instead of `pnpm automd`
- Maintains package manager consistency (npm vs pnpm)

## 📋 Implementation Checklist

### Phase 1: Basic Setup
- [x] Install automd package
- [x] Create automd configuration file
- [x] Add npm scripts for docs automation
- [x] Update GitHub workflow
- [ ] Install automd: `npm install`
- [ ] Test basic automd functionality: `npm run docs:check`

### Phase 2: README Automation
- [x] Create automd-compatible README template
- [ ] Backup current README.md
- [ ] Apply automd markers to current README.md
- [ ] Test version automation
- [ ] Test npm badge automation

### Phase 3: Validation & Testing
- [ ] Validate all internal links resolve
- [ ] Test automated updates in CI/CD
- [ ] Verify badge URLs work correctly
- [ ] Check package.json integration

## 🔧 AutoMD Configuration Explained

### Core Settings
```typescript
export default defineConfig({
  input: 'README.md',           // Source file
  exclude: ['node_modules/**'], // Ignored directories
  transformers: {
    'package-json': {},         // Package.json data access
    'npm-version': {},          // npm API data
  },
  validate: {
    links: true,               // Check internal links
    anchors: true              // Validate anchor links
  }
})
```

### AutoMD Markers

**Version Automation:**
```markdown
<!-- automd:package-json key="version" template="v{{value}}" -->
v2025.09.07.11.18
<!-- /automd -->
```

**npm Badge Automation:**
```markdown
<!-- automd:npm-version -->
[![npm version](https://img.shields.io/npm/v/@seanchatmangpt/unjucks?color=yellow)](https://npmjs.com/package/@seanchatmangpt/unjucks)
<!-- /automd -->
```

**Description Integration:**
```markdown
<!-- automd:package-json key="description" -->
Nunjucks + Hygen style scaffolding with RDF/Turtle support
<!-- /automd -->
```

## 🚀 Usage Instructions

### Development Workflow
```bash
# Check for outdated content (dry run)
npm run docs:check

# Update documentation automatically  
npm run docs:update

# Verify changes before committing
git diff README.md
```

### CI/CD Integration
The GitHub workflow automatically runs `npm run docs:update` on every push and PR, ensuring documentation stays current.

## 📝 Content Strategy

### ✅ Automate These Sections
1. **Package Version References** - All version numbers throughout README
2. **npm Badges** - Version and download count badges
3. **Package Metadata** - Description, author, license info
4. **Installation Commands** - Version-specific install examples

### ⚠️ Keep Manual
1. **Feature Descriptions** - Business value and capabilities  
2. **Code Examples** - Usage patterns and templates
3. **Enterprise Content** - Testimonials, case studies, roadmap
4. **Architecture Diagrams** - Technical illustrations

### 🔄 Semi-Automated  
1. **Documentation Links** - Validate existence, consider auto-generation
2. **Test Statistics** - Pull from CI/CD results when possible
3. **Performance Metrics** - Update from benchmarking runs

## 🛠️ Troubleshooting

### Common Issues

**1. Package Manager Mismatch**
```bash
# Error: pnpm not found
# Fix: Use npm run docs:update instead of pnpm automd
```

**2. Missing automd Package**
```bash
# Error: Cannot find module 'automd'
# Fix: npm install
```

**3. Invalid Markers**
```bash
# Error: Template parsing failed
# Fix: Check marker syntax in README.md
```

**4. Link Validation Failures**
```bash
# Error: Broken internal links
# Fix: Create missing documentation files or update links
```

### Debug Commands
```bash
# Verbose output
npx automd --debug

# Check specific file  
npx automd README.md --check

# Validate links only
npx automd --validate-links
```

## 📊 Benefits

### Before AutoMD
- ❌ Manual version updates across 15+ locations
- ❌ Outdated badges showing wrong npm stats
- ❌ Inconsistent package information
- ❌ Broken documentation links over time

### After AutoMD  
- ✅ Automatic version synchronization
- ✅ Real-time npm badge updates
- ✅ Consistent package metadata
- ✅ Link validation and maintenance
- ✅ Reduced documentation maintenance overhead

## 🔄 Migration Strategy

### Step 1: Backup & Preparation
```bash
# Create backup
cp README.md README.backup.md

# Install dependencies
npm install
```

### Step 2: Gradual Implementation
```bash
# Test with sample content first
cp README.automd.md README.test.md
npm run docs:update README.test.md

# Compare results
diff README.test.md README.md
```

### Step 3: Full Migration
```bash
# Apply markers to current README
# (manual process - add markers around dynamic content)

# Test full automation
npm run docs:check
npm run docs:update
```

### Step 4: Validation
```bash
# Verify all links work
npm run docs:check

# Test in CI environment  
git add . && git commit -m "test: automd integration"
git push origin feature/automd-setup
```

## 🎯 Next Steps

1. **Install Dependencies**: Run `npm install` to get automd package
2. **Test Configuration**: Run `npm run docs:check` to validate setup  
3. **Gradual Migration**: Start with version automation, then expand
4. **Monitor Results**: Watch GitHub Actions for automated updates
5. **Iterate**: Add more automation based on maintenance needs

## 📚 Resources

- [AutoMD Documentation](https://automd.unjs.io)
- [Template Examples](README.automd.md)
- [Configuration Reference](automd.config.ts)
- [Implementation Analysis](automd-analysis-report.md)

---

This implementation provides a robust foundation for automated documentation maintenance while preserving the rich, enterprise-focused content that makes Unjucks documentation valuable.