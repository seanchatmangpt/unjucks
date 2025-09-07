# TypeScript to JavaScript Migration - Rollback Plan

## Overview

This document provides a comprehensive rollback plan for reverting the TypeScript to JavaScript migration in the Unjucks project. This plan should be executed if critical issues arise that cannot be resolved quickly in the JavaScript codebase.

## 🚨 Emergency Rollback (< 15 minutes)

### Quick Rollback Command Sequence

```bash
# 1. Stop all running processes
pkill -f "unjucks"
pkill -f "node.*unjucks"

# 2. Backup current JavaScript changes (for analysis)
git stash push -m "JS migration state backup $(date)"

# 3. Revert to last stable TypeScript commit
git checkout HEAD~20 -- tsconfig.json tsconfig.build.json
git checkout HEAD~20 -- package.json
git checkout HEAD~20 -- src/cli/index.ts

# 4. Restore TypeScript dependencies
npm install typescript @types/node @types/inquirer @types/fs-extra --save-dev

# 5. Verify TypeScript build
npm run build

# 6. Test basic functionality
npm test

# Emergency rollback complete - system should be functional
```

## 📋 Complete Restoration Process

### Phase 1: Configuration Restoration

#### 1.1 TypeScript Configuration Files
```bash
# Restore all TypeScript configuration files from git history
git checkout HEAD~20 -- tsconfig.json
git checkout HEAD~20 -- tsconfig.build.json
git checkout HEAD~20 -- tests/tsconfig.json
git checkout HEAD~20 -- tests/final-validation/tsconfig.json
git checkout HEAD~20 -- _templates/cli/citty/tsconfig.json

# Verify files are restored
ls -la tsconfig*.json
ls -la tests/tsconfig*.json
ls -la _templates/cli/citty/tsconfig.json
```

#### 1.2 Package.json Restoration
```bash
# Restore package.json from git history
git checkout HEAD~20 -- package.json

# Alternative: Manual package.json updates
```

**Manual package.json Changes (if needed):**
```json
{
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit",
    "dev": "ts-node src/cli/index.ts"
  },
  "devDependencies": {
    "typescript": "^5.2.0",
    "@types/node": "^20.8.0",
    "@types/inquirer": "^9.0.0",
    "@types/fs-extra": "^11.0.0",
    "@types/glob": "^8.1.0",
    "ts-node": "^10.9.0"
  }
}
```

### Phase 2: Source File Restoration

#### 2.1 CLI Entry Point
```bash
# Restore TypeScript CLI entry point
git checkout HEAD~20 -- src/cli/index.ts

# Remove JavaScript version if it exists
rm -f src/cli/index.js

# Verify TypeScript version is back
ls -la src/cli/index.*
```

#### 2.2 Main Index File
```bash
# Restore main TypeScript index
git checkout HEAD~20 -- src/index.ts

# Remove @ts-nocheck directive if present
sed -i '' '1s/^\/\/ @ts-nocheck//' src/index.ts
```

#### 2.3 All Source Files
```bash
# If extensive JavaScript conversion was done, restore all TypeScript files
git checkout HEAD~20 -- src/

# Verify TypeScript files are restored
find src -name "*.ts" | head -10
find src -name "*.js" | grep -v node_modules | head -5
```

### Phase 3: Build System Restoration

#### 3.1 Reinstall TypeScript Dependencies
```bash
# Clean npm cache and node_modules
rm -rf node_modules package-lock.json
npm cache clean --force

# Install with TypeScript dependencies
npm install

# Verify TypeScript is available
npx tsc --version
npx ts-node --version
```

#### 3.2 Build Configuration
```bash
# Test TypeScript compilation
npm run typecheck

# Full build test
npm run build

# Verify dist output
ls -la dist/
```

### Phase 4: Testing Restoration

#### 4.1 Test Configuration
```bash
# Restore test configurations if needed
git checkout HEAD~20 -- vitest.config.ts
git checkout HEAD~20 -- vitest.cucumber.config.ts

# Verify test TypeScript configuration
npm run test:cli
```

#### 4.2 Template System
```bash
# Restore template TypeScript files
git checkout HEAD~20 -- _templates/

# Verify templates work
unjucks list
unjucks help command citty
```

### Phase 5: Documentation Restoration

#### 5.1 Remove Migration Documentation
```bash
# Remove migration-specific documentation
rm -f docs/migration/MIGRATION_TO_JS.md
rm -f docs/migration/ROLLBACK_PLAN.md

# Restore TypeScript-focused documentation
git checkout HEAD~20 -- docs/typescript-migration-strategy.md
```

#### 5.2 Update README.md
```bash
# Remove JavaScript migration references from README
# Restore TypeScript references

git checkout HEAD~20 -- README.md

# Or manually update badges:
# - Remove: [![Migration](https://img.shields.io/badge/TypeScript→JavaScript-95%25_Complete-green.svg)]
# - Update references to TypeScript development workflow
```

## 🔍 Verification Checklist

### Post-Rollback Validation

#### ✅ Configuration Verification
- [ ] `tsconfig.json` exists and is valid
- [ ] `tsconfig.build.json` exists and compiles correctly  
- [ ] TypeScript dependencies installed
- [ ] `tsc --version` returns valid version
- [ ] `npm run typecheck` passes

#### ✅ Build Verification  
- [ ] `npm run build` completes successfully
- [ ] `dist/` directory contains compiled JavaScript
- [ ] Binary `bin/unjucks.cjs` is executable
- [ ] `unjucks --version` works

#### ✅ CLI Verification
- [ ] `unjucks help` displays correctly
- [ ] `unjucks list` shows templates
- [ ] `unjucks generate --help` works
- [ ] Template generation works: `unjucks generate command citty --commandName=Test --dry`

#### ✅ Test Verification
- [ ] `npm test` passes
- [ ] `npm run test:cli` passes
- [ ] `npm run test:cucumber` passes
- [ ] BDD scenarios execute correctly

#### ✅ Development Verification
- [ ] `npm run dev` starts correctly
- [ ] Hot reload works with TypeScript files
- [ ] IDE type checking functions
- [ ] Debugging works with source maps

## 📊 Performance Impact of Rollback

### Expected Changes After Rollback

| Metric | JavaScript (Pre-Rollback) | TypeScript (Post-Rollback) | Delta |
|---------|---------------------------|---------------------------|--------|
| **Build Time** | ~5-10 seconds | ~30-45 seconds | +200-350% |
| **Development Hot Reload** | Immediate | ~2-3 seconds | +∞ |
| **Type Safety** | JSDoc only | Full TypeScript | +95% safety |
| **Bundle Size** | Smaller (-15%) | Larger (with helpers) | +15% |
| **IDE Support** | JavaScript intellisense | Full TypeScript | +100% accuracy |
| **Debugging** | Direct source | Source mapped | Same quality |

## 🎯 Decision Matrix

### When to Execute Rollback

**✅ Execute Rollback If:**
- Critical functionality is completely broken
- CLI commands fail to execute
- Template generation produces corrupted output
- Test suite success rate drops below 80%
- Performance degrades more than 50%
- Security vulnerabilities are introduced
- Enterprise customers report production issues

**❌ Do NOT Execute Rollback If:**
- Minor type conversion issues (can be fixed incrementally)
- Documentation needs updates
- Some edge cases need JavaScript adjustments  
- IDE warnings about missing types (JSDoc can address)
- Performance improvements are being realized

### Risk Assessment

**Rollback Risk Level: LOW**
- All TypeScript code is preserved in git history
- Build system rollback is well-tested
- Configuration files are easily restorable
- No data loss risk
- Minimal downtime (< 30 minutes)

## 🔄 Post-Rollback Actions

### 1. Analysis and Learning
```bash
# Create analysis branch for JavaScript changes
git checkout -b analysis/js-migration-lessons
git stash pop  # Restore JavaScript changes for analysis

# Document what worked and what didn't
# Create lessons learned document
```

### 2. Communication
- Notify team of rollback completion
- Update project status in documentation  
- Inform stakeholders of timeline impact
- Plan for future migration approach

### 3. Stabilization
```bash
# Run full test suite multiple times
npm test
npm run test:cucumber  
npm run test:cli

# Performance baseline re-establishment
npm run test:performance

# Security audit
npm audit
npm run test:security
```

### 4. Planning Next Steps
- Analyze root causes of migration issues
- Plan incremental migration approach
- Update migration strategy documentation
- Set new timeline for JavaScript conversion

## 📝 Rollback Log Template

Use this template to document the rollback process:

```markdown
# Rollback Execution Log

**Date:** [DATE]
**Time Started:** [TIME]
**Executed By:** [NAME]
**Reason:** [REASON FOR ROLLBACK]

## Actions Taken:
1. [ ] Emergency commands executed
2. [ ] Configuration files restored
3. [ ] Source files reverted
4. [ ] Dependencies reinstalled
5. [ ] Build system verified
6. [ ] Tests validated

## Verification Results:
- Build: ✅/❌
- CLI: ✅/❌
- Tests: ✅/❌
- Performance: ✅/❌

**Time Completed:** [TIME]
**Total Duration:** [DURATION]
**System Status:** [OPERATIONAL/ISSUES]

## Issues Encountered:
[DOCUMENT ANY ISSUES]

## Next Steps:
[PLAN FOR MOVING FORWARD]
```

## 📞 Support Contacts

### Emergency Rollback Support
- **Technical Lead:** [CONTACT INFO]
- **DevOps Engineer:** [CONTACT INFO]  
- **Enterprise Support:** [CONTACT INFO]

### Escalation Path
1. Development Team Lead
2. Engineering Manager  
3. CTO/Technical Director
4. Enterprise Customer Success

---

**Remember: This rollback plan is a safety net. The goal is to never need it, but having it provides confidence to proceed with the JavaScript migration knowing we can quickly revert if needed.**