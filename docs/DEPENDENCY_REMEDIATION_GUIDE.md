# Unjucks Dependency Remediation Guide

## 🚨 Critical Fix Required - Step by Step

### Phase 1: Environment Cleanup (Required First)

#### Step 1.1: Clear All NPM State
```bash
# Clear npm cache (force clean)
npm cache clean --force

# Remove any existing installation attempts
rm -rf node_modules
rm -f package-lock.json

# Check for global esbuild conflicts
npm list -g esbuild
npm uninstall -g esbuild  # If found globally installed
```

#### Step 1.2: Check System EsBuild
```bash
# Check if esbuild is available in PATH
which esbuild
esbuild --version  # Should show 0.19.12 if causing conflict

# If system esbuild exists, temporarily rename it
sudo mv $(which esbuild) $(which esbuild).backup  # If needed
```

### Phase 2: Package.json Fixes (Critical)

#### Step 2.1: Fix Version Conflicts
Update `/Users/sac/unjucks/package.json` with compatible versions:

```json
{
  "dependencies": {
    "chalk": "^5.3.0",      // Update from ^4.1.2
    "chokidar": "^4.0.3",   // Update from ^3.3.0  
    "glob": "^11.0.3",      // Update from ^10.3.10
    "zod": "^3.25.68"       // Downgrade from ^4.1.5 (more stable)
  },
  "devDependencies": {
    "vite": "^6.0.1",       // Downgrade from ^7.1.4
    "vitest": "^2.1.8"      // Downgrade from ^3.2.4
  }
}
```

#### Step 2.2: Remove Package Manager Specification (Temporary)
Comment out or remove the packageManager line:
```json
// "packageManager": "pnpm@9.12.0",
```

#### Step 2.3: Fix Peer Dependencies
Remove chokidar from peerDependencies (duplicate):
```json
"peerDependencies": {
  // Remove: "chokidar": "^3.3.0"
}
```

### Phase 3: Strategic Installation

#### Step 3.1: Install Core Dependencies First
```bash
# Install production dependencies only
npm install --production --no-optional --legacy-peer-deps

# Verify core packages installed
npm list --depth=0
```

#### Step 3.2: Install Dev Dependencies Separately
```bash
# Install development dependencies
npm install --include=dev --no-optional --legacy-peer-deps

# Check for any remaining issues
npm audit --audit-level moderate
```

#### Step 3.3: Test Basic Functionality
```bash
# Test CLI availability
node src/cli/index.js --help

# Test basic template discovery
node src/cli/index.js list
```

### Phase 4: Alternative Installation Strategy

If npm continues to fail, switch to PNPM as specified:

#### Step 4.1: Install PNPM
```bash
# Install pnpm globally
npm install -g pnpm@9.12.0

# Verify installation
pnpm --version
```

#### Step 4.2: PNPM Installation
```bash
# Clean start with pnpm
rm -rf node_modules pnpm-lock.yaml package-lock.json

# Install with pnpm
pnpm install --frozen-lockfile=false

# Generate new lockfile
pnpm install
```

### Phase 5: Specific Package Fixes

#### Step 5.1: EsBuild Resolution
If esbuild conflicts persist:
```bash
# Force specific esbuild version
npm install esbuild@0.25.9 --force

# Or pin to stable version
npm install esbuild@0.23.1
```

#### Step 5.2: Chalk Migration (Breaking Changes)
Update code for Chalk v5 (ESM only):
```javascript
// OLD (Chalk v4)
const chalk = require('chalk');

// NEW (Chalk v5)
import chalk from 'chalk';
```

#### Step 5.3: Glob Migration (API Changes)
Update glob usage for v11:
```javascript
// OLD (Glob v10)
const glob = require('glob');
const files = glob.sync('**/*.js');

// NEW (Glob v11) 
import { globSync } from 'glob';
const files = globSync('**/*.js');
```

### Phase 6: Test Configuration Fixes

#### Step 6.1: Update Vitest Configs
All vitest.*.config.js files need updates for version compatibility:

```javascript
// vitest.config.js - Remove incompatible options
export default defineConfig({
  test: {
    // Remove if causing issues:
    // typecheck: { enabled: false },
    
    // Update coverage provider
    coverage: {
      provider: 'v8', // or 'c8' for older versions
    }
  }
});
```

#### Step 6.2: Vite Configuration
Update for Vite v6 compatibility:
```javascript
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  // Remove incompatible plugins temporarily
  plugins: [
    // @vitejs/plugin-vue may need version update
  ]
});
```

### Phase 7: Verification Steps

#### Step 7.1: Installation Verification
```bash
# Check all dependencies resolved
npm list --all 2>&1 | grep -E "(UNMET|missing|ERROR)" || echo "All dependencies resolved"

# Verify critical packages
node -e "console.log(require('citty'))" 2>/dev/null && echo "✅ citty" || echo "❌ citty"
node -e "console.log(require('n3'))" 2>/dev/null && echo "✅ n3" || echo "❌ n3"
node -e "console.log(require('nunjucks'))" 2>/dev/null && echo "✅ nunjucks" || echo "❌ nunjucks"
```

#### Step 7.2: Functionality Tests
```bash
# Test CLI
node src/cli/index.js --version

# Test template discovery
node src/cli/index.js list

# Test basic generation (if templates exist)
node src/cli/index.js help
```

#### Step 7.3: Build Tests
```bash
# Test build process
npm run build

# Test basic tests
npm run test
```

## Emergency Fallback: Minimal Installation

If all else fails, create a minimal package.json:

```json
{
  "name": "@seanchatmangpt/unjucks",
  "version": "2025.9.071954", 
  "type": "module",
  "dependencies": {
    "citty": "^0.1.6",
    "consola": "^3.4.2", 
    "nunjucks": "^3.2.4",
    "gray-matter": "^4.0.3",
    "fs-extra": "^11.3.1",
    "n3": "^1.26.0"
  }
}
```

Then gradually add back other dependencies once core functionality works.

## Long-term Solutions

1. **Pin Versions**: Use exact versions instead of ranges
2. **Dependency Audit**: Regular updates with testing
3. **CI/CD**: Automated dependency validation
4. **Documentation**: Keep this guide updated

## Troubleshooting Common Issues

### Issue: "Cannot resolve module"
```bash
# Clear node require cache
rm -rf ~/.npm ~/.cache/npm
npm install --no-cache
```

### Issue: "Permission denied"
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
npm config set cache ~/.npm-cache --global
```

### Issue: "Version conflict" 
```bash
# Use legacy peer deps resolution
npm install --legacy-peer-deps --force
```

This guide provides a systematic approach to resolving the dependency crisis. Start with Phase 1 and proceed sequentially.