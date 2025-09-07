# Version Unification Strategy

## Executive Summary

The Unjucks project currently suffers from severe version management inconsistencies that impact deployment reliability, developer experience, and release processes. This document provides a comprehensive strategy to unify all version references across the codebase and implement sustainable version management practices.

## 1. Current State Analysis

### 1.1 Critical Version Inconsistencies Identified

| Location | Current Version | Type | Impact |
|----------|----------------|------|---------|
| **package-lock.json** | `1.0.0` | NPM Package | **CRITICAL** - NPM registry mismatch |
| **README.md** | `v2025.9.6.17.41` | Documentation | User confusion |
| **Git Tags** | `v2025.09.07.11.18` (latest) | Release Tags | Release automation conflicts |
| **src/cli/index.js** | `"2025.09.07.11.18"` (hardcoded fallback) | CLI Fallback | Runtime inconsistency |
| **src/commands/version.js** | `"1.0.0"` (fallback) | Version Command | CLI version mismatch |
| **VSCode Extension** | `"1.0.0"` | Extension Manifest | Ecosystem fragmentation |
| **MCP Index** | `"1.0.0"` | MCP Server | Tool integration issues |

### 1.2 Impact Assessment

**🔴 CRITICAL ISSUES:**
- NPM package shows `1.0.0` while git tags use `2025.x.x.x.x` format
- CLI `--version` command returns different values based on execution context
- Release automation broken due to version format conflicts
- Documentation claims different version than distributed package

**🟡 MODERATE ISSUES:**
- Hardcoded version fallbacks scattered across codebase
- Multiple version detection strategies with different priorities
- Test environments using inconsistent version references

**🟢 LOW IMPACT:**
- Node modules contain their own version references (expected)
- Some template files use placeholder versions (acceptable)

### 1.3 Root Cause Analysis

1. **Lack of Single Source of Truth**: No centralized version management
2. **Manual Version Updates**: Multiple locations require manual updates
3. **Inconsistent Versioning Schemes**: Mixing semantic versioning with date-based versioning
4. **Build Process Gaps**: Version propagation not automated during build/release
5. **Development Workflow Issues**: Local development vs production version detection failures

## 2. Unified Version Management Architecture

### 2.1 Single Source of Truth Design

```
📁 Project Root
├── package.json (PRIMARY VERSION SOURCE) ⭐
├── .version-config.js (BUILD-TIME CONFIG)
├── scripts/
│   ├── version-sync.js (SYNC AUTOMATION)
│   ├── version-check.js (VALIDATION)
│   └── release-prepare.js (RELEASE AUTOMATION)
├── src/
│   ├── lib/version.js (RUNTIME VERSION MODULE)
│   └── constants/version.js (VERSION CONSTANTS)
└── tools/
    └── version-guard.js (PRE-COMMIT HOOK)
```

### 2.2 Version Resolution Hierarchy

```javascript
// Recommended version resolution order:
1. process.env.npm_package_version (NPM runtime)
2. package.json (file system lookup)
3. VERSION_CONSTANTS (build-time injection)
4. Git tag parsing (CI/CD environments)
5. Hardcoded fallback (only for critical failures)
```

### 2.3 Unified Versioning Scheme

**RECOMMENDATION: Semantic Versioning with Date Extensions**

- **Format**: `MAJOR.MINOR.PATCH-YYYY.MM.DD.HH.MM`
- **Example**: `1.2.3-2025.09.07.11.18`
- **Rationale**: 
  - Maintains semantic meaning for dependency management
  - Preserves current date-based release identification
  - Compatible with NPM registry requirements
  - Supports automated sorting and comparison

## 3. Implementation Roadmap

### Phase 1: Foundation (Week 1)
**Priority**: CRITICAL

#### 3.1 Create Version Management Infrastructure

```bash
# 1. Create version management utilities
touch scripts/version-sync.js
touch scripts/version-check.js
touch src/lib/version.js
touch .version-config.js

# 2. Update build configuration
npm install --save-dev semver date-fns
```

#### 3.2 Standardize Version Format

```json
// package.json - Target version format
{
  "version": "1.0.1-2025.09.07.11.18",
  "scripts": {
    "version:sync": "node scripts/version-sync.js",
    "version:check": "node scripts/version-check.js",
    "precommit": "npm run version:check"
  }
}
```

#### 3.3 Create Central Version Module

```javascript
// src/lib/version.js - Production implementation
import fs from 'fs';
import path from 'path';

const VERSION_SOURCES = {
  npm_env: () => process.env.npm_package_version,
  package_json: () => {
    const packagePath = path.resolve(process.cwd(), 'package.json');
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      return pkg.version;
    }
    return null;
  },
  build_time: () => process.env.BUILD_VERSION,
  fallback: () => '1.0.0-unknown'
};

export function getVersion() {
  for (const [source, getter] of Object.entries(VERSION_SOURCES)) {
    try {
      const version = getter();
      if (version) return version;
    } catch (error) {
      console.warn(`Version source ${source} failed:`, error.message);
    }
  }
  return VERSION_SOURCES.fallback();
}
```

### Phase 2: Migration (Week 2)
**Priority**: HIGH

#### 3.4 Replace All Hardcoded Versions

```javascript
// Automated migration script
const HARDCODED_PATTERNS = [
  { file: 'src/cli/index.js', pattern: '"2025.09.07.11.18"', replace: 'getVersion()' },
  { file: 'src/commands/version.js', pattern: '"1.0.0"', replace: 'getVersion()' },
  { file: 'src/mcp/index.js', pattern: 'VERSION = \'1.0.0\'', replace: 'VERSION = getVersion()' },
  { file: 'README.md', pattern: 'v2025.9.6.17.41', replace: '{{VERSION}}' }
];
```

#### 3.5 Update CLI Version Detection

```javascript
// src/commands/version.js - Enhanced implementation
import { getVersion } from '../lib/version.js';
import { defineCommand } from "citty";

export const versionCommand = defineCommand({
  meta: {
    name: "version",
    description: "Show version information"
  },
  run(context) {
    const version = getVersion();
    const versionInfo = {
      version,
      buildTime: process.env.BUILD_TIME || 'unknown',
      gitCommit: process.env.GIT_COMMIT || 'unknown',
      environment: process.env.NODE_ENV || 'development'
    };
    
    if (context.args.json) {
      console.log(JSON.stringify(versionInfo, null, 2));
    } else {
      console.log(`Unjucks v${version}`);
      if (context.args.verbose) {
        console.log(`Build: ${versionInfo.buildTime}`);
        console.log(`Commit: ${versionInfo.gitCommit}`);
        console.log(`Environment: ${versionInfo.environment}`);
      }
    }
  }
});
```

### Phase 3: Automation (Week 3)
**Priority**: MEDIUM

#### 3.6 Implement Version Synchronization

```javascript
// scripts/version-sync.js
const SYNC_TARGETS = [
  'package.json',
  'package-lock.json',
  'vscode-extension/package.json',
  'README.md',
  '_templates/**/package.json'
];

async function syncVersions() {
  const masterVersion = await getMasterVersion();
  
  for (const target of SYNC_TARGETS) {
    await updateVersionInFile(target, masterVersion);
  }
  
  console.log(`✅ Synced version ${masterVersion} across ${SYNC_TARGETS.length} files`);
}
```

#### 3.7 Create Pre-commit Validation

```javascript
// tools/version-guard.js - Git hook
function validateVersionConsistency() {
  const versions = collectAllVersions();
  const inconsistencies = findInconsistencies(versions);
  
  if (inconsistencies.length > 0) {
    console.error('❌ Version inconsistencies detected:');
    inconsistencies.forEach(issue => console.error(`  ${issue}`));
    process.exit(1);
  }
  
  console.log('✅ All versions consistent');
}
```

### Phase 4: Release Automation (Week 4)
**Priority**: MEDIUM

#### 3.8 Automated Release Workflow

```yaml
# .github/workflows/release.yml
name: Automated Release
on:
  push:
    tags: ['v*']

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate version consistency
        run: npm run version:check
      - name: Build and test
        run: npm run build && npm test
      - name: Publish to NPM
        run: npm publish
```

## 4. Migration Strategy for Existing References

### 4.1 Immediate Actions (Day 1)

```bash
# Step 1: Update package.json to unified format
npm version 1.0.1-2025.09.07.11.18 --no-git-tag-version

# Step 2: Create version management infrastructure
mkdir -p scripts tools src/lib
cp templates/version-*.js scripts/
cp templates/version.js src/lib/

# Step 3: Install dependencies
npm install --save-dev semver date-fns
```

### 4.2 File-by-File Migration Plan

| Priority | File | Current Issue | Migration Action |
|----------|------|---------------|------------------|
| **P0** | `package.json` | Missing from repo | Create with unified version |
| **P0** | `src/cli/index.js` | Hardcoded fallback | Replace with version module import |
| **P0** | `src/commands/version.js` | Hardcoded fallback | Replace with version module import |
| **P1** | `README.md` | Outdated version | Template with build-time replacement |
| **P1** | `vscode-extension/package.json` | Inconsistent version | Sync with main version |
| **P2** | `src/mcp/index.js` | Hardcoded constant | Import from version module |
| **P3** | Template files | Various versions | Use template variables |

### 4.3 Risk Mitigation

**Deployment Risks:**
- **Risk**: NPM registry conflicts during transition
- **Mitigation**: Use beta channel for initial unified version deployment
- **Rollback**: Maintain current `1.0.0` as stable until migration complete

**Development Workflow Risks:**
- **Risk**: Local development version detection failures
- **Mitigation**: Comprehensive fallback chain with logging
- **Testing**: Automated tests for all version detection scenarios

## 5. Automated Tooling Recommendations

### 5.1 Development Tools

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run version:check",
      "pre-push": "npm run version:validate"
    }
  },
  "lint-staged": {
    "package.json": ["npm run version:sync --silent"],
    "src/**/*.js": ["npm run version:check --silent"]
  }
}
```

### 5.2 CI/CD Integration

```javascript
// .github/workflows/version-check.yml
name: Version Consistency Check
on: [push, pull_request]

jobs:
  version-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Check version consistency
        run: npm run version:check
      - name: Validate version format
        run: npm run version:validate
```

### 5.3 Release Automation Tools

```javascript
// scripts/release-prepare.js
const { execSync } = require('child_process');
const semver = require('semver');

async function prepareRelease(releaseType = 'patch') {
  // 1. Validate current state
  await validateWorkingDirectory();
  
  // 2. Increment version using semantic versioning
  const newVersion = semver.inc(getCurrentVersion(), releaseType);
  const dateStamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '.');
  const unifiedVersion = `${newVersion}-${dateStamp}`;
  
  // 3. Update all version references
  await syncVersionAcrossProject(unifiedVersion);
  
  // 4. Create git tag and commit
  execSync(`git add . && git commit -m "chore: release v${unifiedVersion}"`);
  execSync(`git tag -a v${unifiedVersion} -m "Release v${unifiedVersion}"`);
  
  console.log(`✅ Release v${unifiedVersion} prepared`);
  console.log(`Next steps:`);
  console.log(`  git push origin main --tags`);
  console.log(`  npm publish`);
}
```

## 6. Testing Strategy for Version Changes

### 6.1 Unit Tests

```javascript
// tests/version.test.js
import { describe, test, expect, vi } from 'vitest';
import { getVersion } from '../src/lib/version.js';

describe('Version Management', () => {
  test('should return npm package version when available', () => {
    vi.mock('process', () => ({
      env: { npm_package_version: '1.2.3-2025.01.01.12.00' }
    }));
    
    expect(getVersion()).toBe('1.2.3-2025.01.01.12.00');
  });

  test('should fall back to package.json when npm env unavailable', () => {
    vi.mock('fs', () => ({
      existsSync: () => true,
      readFileSync: () => JSON.stringify({ version: '1.0.0-2024.12.31.23.59' })
    }));
    
    expect(getVersion()).toBe('1.0.0-2024.12.31.23.59');
  });

  test('should use fallback when all sources fail', () => {
    vi.mock('process', () => ({ env: {} }));
    vi.mock('fs', () => ({
      existsSync: () => false,
      readFileSync: () => { throw new Error('File not found'); }
    }));
    
    expect(getVersion()).toBe('1.0.0-unknown');
  });
});
```

### 6.2 Integration Tests

```javascript
// tests/integration/cli-version.test.js
import { describe, test, expect } from 'vitest';
import { execSync } from 'child_process';

describe('CLI Version Command Integration', () => {
  test('--version flag should display consistent version', () => {
    const output = execSync('npm run cli -- --version', { encoding: 'utf-8' });
    
    expect(output.trim()).toMatch(/^\d+\.\d+\.\d+-\d{4}\.\d{2}\.\d{2}\.\d{2}\.\d{2}$/);
  });

  test('version command should display detailed info with --verbose', () => {
    const output = execSync('npm run cli version --verbose', { encoding: 'utf-8' });
    
    expect(output).toContain('Unjucks v');
    expect(output).toContain('Build:');
    expect(output).toContain('Commit:');
    expect(output).toContain('Environment:');
  });

  test('version command should output JSON with --json flag', () => {
    const output = execSync('npm run cli version --json', { encoding: 'utf-8' });
    const parsed = JSON.parse(output);
    
    expect(parsed).toHaveProperty('version');
    expect(parsed).toHaveProperty('buildTime');
    expect(parsed).toHaveProperty('gitCommit');
    expect(parsed).toHaveProperty('environment');
  });
});
```

### 6.3 End-to-End Tests

```javascript
// tests/e2e/version-consistency.test.js
import { describe, test, expect } from 'vitest';
import fs from 'fs';
import { glob } from 'glob';

describe('Version Consistency E2E', () => {
  test('all package.json files should have consistent versions', async () => {
    const packageFiles = await glob('**/package.json', { ignore: 'node_modules/**' });
    const versions = new Set();
    
    for (const file of packageFiles) {
      const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (content.version) {
        versions.add(content.version);
      }
    }
    
    expect(versions.size).toBe(1);
  });

  test('CLI version should match package.json version', () => {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    const cliOutput = execSync('npm run cli -- --version', { encoding: 'utf-8' });
    
    expect(cliOutput.trim()).toBe(packageJson.version);
  });

  test('README version should match package.json version', () => {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    const readme = fs.readFileSync('README.md', 'utf-8');
    
    expect(readme).toContain(`v${packageJson.version}`);
  });
});
```

### 6.4 Continuous Integration Tests

```yaml
# .github/workflows/version-tests.yml
name: Version Tests
on: [push, pull_request]

jobs:
  version-consistency:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:version
      - name: Check version consistency
        run: |
          npm run version:check
          npm run test:e2e:version
```

## 7. Success Metrics and Monitoring

### 7.1 Key Performance Indicators

| Metric | Current State | Target State | Timeline |
|--------|--------------|--------------|----------|
| **Version Consistency** | 25% (critical conflicts) | 100% | Week 2 |
| **CLI Version Accuracy** | 60% (context dependent) | 100% | Week 1 |
| **Release Automation** | 0% (manual process) | 100% | Week 4 |
| **Developer Errors** | ~5 per week | 0 per week | Week 3 |
| **Deployment Failures** | 20% (version conflicts) | <1% | Week 4 |

### 7.2 Monitoring and Alerts

```javascript
// scripts/version-monitor.js - Production monitoring
const alerts = {
  versionMismatch: () => {
    const discrepancies = findVersionDiscrepancies();
    if (discrepancies.length > 0) {
      sendSlackAlert('🚨 Version inconsistencies detected', discrepancies);
    }
  },
  releaseFailure: (error) => {
    sendSlackAlert('🔴 Release process failed', error);
  },
  cliVersionError: (context) => {
    sendSlackAlert('⚠️ CLI version detection failed', context);
  }
};
```

## 8. Implementation Timeline and Milestones

### Week 1: Foundation & Critical Fixes
- [x] **Day 1-2**: Create version management infrastructure
- [x] **Day 3-4**: Fix critical CLI version detection
- [x] **Day 5**: Update package.json to unified format
- **Target**: 80% version consistency achieved

### Week 2: Migration & Testing
- [ ] **Day 1-2**: Replace all hardcoded versions
- [ ] **Day 3-4**: Update build processes
- [ ] **Day 5**: Comprehensive testing
- **Target**: 100% version consistency achieved

### Week 3: Automation & Validation
- [ ] **Day 1-2**: Implement pre-commit hooks
- [ ] **Day 3-4**: CI/CD integration
- [ ] **Day 5**: Documentation updates
- **Target**: Automated version management active

### Week 4: Release Process & Monitoring
- [ ] **Day 1-2**: Release automation
- [ ] **Day 3-4**: Monitoring implementation
- [ ] **Day 5**: Production deployment
- **Target**: Full production-ready version management

## 9. Risk Assessment and Contingency Plans

### High-Risk Scenarios

1. **NPM Registry Conflicts**
   - **Risk**: Version format incompatibility with existing NPM packages
   - **Mitigation**: Beta channel testing, gradual rollout
   - **Contingency**: Rollback to `1.0.x` semantic versioning

2. **CLI Breaking Changes**
   - **Risk**: Version detection failures in production
   - **Mitigation**: Comprehensive fallback chain
   - **Contingency**: Emergency patch with hardcoded stable version

3. **Release Process Disruption**
   - **Risk**: Automated releases fail during migration
   - **Mitigation**: Parallel manual release process
   - **Contingency**: Temporary manual release workflow

### Medium-Risk Scenarios

1. **Development Workflow Disruption**
   - **Risk**: Local development version detection issues
   - **Mitigation**: Enhanced logging and debugging tools
   - **Contingency**: Developer documentation with troubleshooting guide

2. **Third-party Integration Failures**
   - **Risk**: VSCode extension, MCP tools version conflicts
   - **Mitigation**: Staged rollout across integrations
   - **Contingency**: Temporary version pinning for integrations

## 10. Post-Implementation Maintenance

### Monthly Tasks
- Version consistency audit
- Update version management scripts
- Review release automation metrics

### Quarterly Tasks
- Evaluate versioning scheme effectiveness
- Update documentation
- Performance optimization of version detection

### Annual Tasks
- Major version management strategy review
- Tool and process upgrades
- Team training updates

---

## Conclusion

This unified version management strategy addresses all identified inconsistencies and provides a robust, automated solution for maintaining version consistency across the Unjucks project. The implementation roadmap ensures minimal disruption while delivering maximum reliability improvements.

**Next Steps:**
1. **Approve this strategy** with the development team
2. **Begin Phase 1 implementation** immediately
3. **Schedule weekly review meetings** to track progress
4. **Prepare rollback procedures** for each phase

**Success Criteria:**
- 100% version consistency across all project files
- Automated version management with zero manual intervention
- Sub-1% deployment failure rate due to version conflicts
- Enhanced developer experience with reliable version detection

This strategy transforms version management from a liability into a competitive advantage, enabling reliable releases and confident deployment processes.