# Unjucks Dependency Analysis Report

## Executive Summary

The Unjucks project has **critical dependency management issues** that prevent successful installation and execution. The analysis reveals multiple categories of problems requiring immediate attention.

## Key Findings

### 🚨 Critical Issues

1. **Complete Dependency Resolution Failure**: All 30 dependencies are UNMET
2. **EsBuild Version Conflict**: Expected "0.25.9" but system has "0.19.12"
3. **Corrupted NPM Cache**: Tarball corruption during installation attempts
4. **Missing Package Lock**: No package-lock.json for dependency tree consistency

### 📊 Dependency Categories Analysis

#### Dependencies (Production - 20 packages)
- **Status**: All missing/unmet
- **Critical for CLI**: `citty@^0.1.6`, `consola@^3.4.2`, `chalk@^4.1.2`
- **Core Functionality**: `nunjucks@^3.2.4`, `gray-matter@^4.0.3`, `glob@^10.3.10`
- **RDF/Semantic**: `n3@^1.26.0` (confirmed available)
- **Validation**: `zod@^4.1.5` (confirmed available)
- **Security**: `bcrypt@^6.0.0` (confirmed available)

#### DevDependencies (10 packages)
- **Status**: All missing/unmet
- **Testing**: `vitest@^3.2.4`, `@vitest/ui@^3.2.4`
- **Build Tools**: `vite@^7.1.4` (requires `esbuild@^0.25.0`)
- **Semantic Web**: `sparqljs@^3.7.3` (confirmed available)

#### PeerDependencies
- **Single Entry**: `chokidar@^3.3.0` (duplicated in dependencies)

### 🔍 Root Cause Analysis

#### 1. EsBuild Version Conflict (Primary Issue)
```
Error: Expected "0.25.9" but got "0.19.12"
Location: /Users/sac/unjucks/node_modules/esbuild/install.js:136:11
```

**Analysis**: 
- Vite 7.1.4 requires `esbuild@^0.25.0`
- System has older esbuild binary (0.19.12) cached or globally installed
- EsBuild version validation fails during post-install scripts

#### 2. NPM Cache Corruption
```
TAR_ENTRY_ERROR ENOENT: no such file or directory
Cannot cd into various node_modules directories
Tarball data seems to be corrupted
```

**Analysis**:
- Multiple packages show corruption during extraction
- Affects core packages like `@babel/core`, `dom-serializer`, `css-tree`
- Indicates npm cache integrity issues

#### 3. Package Manager Configuration Issues
```
packageManager: "pnpm@9.12.0" (in package.json)
Using: npm@10.9.0 (actual)
```

**Analysis**:
- Package.json specifies pnpm but using npm
- Different package managers have different resolution algorithms
- May cause lockfile/dependency tree inconsistencies

### 📋 Dependency Validation Results

#### ✅ Available Packages (Confirmed)
- `zod@4.1.5` ✓
- `bcrypt@6.0.0` ✓
- `inquirer@12.9.4` ✓
- `n3@1.26.0` ✓
- `citty@0.1.6` ✓
- `sparqljs@3.7.3` ✓
- `vite@7.1.4` ✓

#### ❌ Problematic Dependencies
- **EsBuild**: Version mismatch prevents installation
- **Chalk**: Specified `^4.1.2` but latest is `5.6.0` (major version difference)
- **Chokidar**: Specified `^3.3.0` but latest is `4.0.3` (major version difference)
- **Glob**: Specified `^10.3.10` but latest is `11.0.3` (major version difference)

### 🏗️ Transitive Dependency Issues

1. **Babel Ecosystem**: Multiple @babel packages show extraction failures
2. **CSS Processing**: css-tree, csso packages corrupted
3. **DOM Processing**: dom-serializer extraction issues
4. **Test Dependencies**: Vitest ecosystem dependencies affected

### 💾 Cache and File System Issues

1. **NPM Cache**: Corrupted content in `/Users/sac/.npm/_cacache/`
2. **Node Modules**: Directory conflicts during parallel installations
3. **Permissions**: Some cleanup operations require elevated permissions

### 🔧 Circular Dependencies Analysis
No circular dependencies detected in package.json declarations, but:
- Chokidar appears in both dependencies and peerDependencies
- Potential conflicts in build tool dependencies (esbuild, vite, vitest)

### 📊 Version Conflicts Matrix

| Package | Required | Available | Conflict Level |
|---------|----------|-----------|---------------|
| esbuild | ^0.25.0 | 0.19.12 | 🔴 Critical |
| chalk | ^4.1.2 | 5.6.0 | 🟡 Major |
| chokidar | ^3.3.0 | 4.0.3 | 🟡 Major |
| glob | ^10.3.10 | 11.0.3 | 🟡 Major |
| zod | ^4.1.5 | 4.1.5 | ✅ Match |
| n3 | ^1.26.0 | 1.26.0 | ✅ Match |

### 🎯 Impact Assessment

#### High Impact (Prevents Installation)
- EsBuild version conflict
- NPM cache corruption
- Missing node_modules directory

#### Medium Impact (Feature Degradation)
- Outdated major versions (chalk, chokidar, glob)
- Package manager mismatch (pnpm vs npm)

#### Low Impact (Development Experience)
- Missing devDependencies
- Test configuration issues

## Recommendations

### Immediate Actions (Priority 1)
1. **Clear NPM Cache**: `npm cache clean --force`
2. **Remove EsBuild Global**: Check for global esbuild installation
3. **Update Package Versions**: Align with latest compatible versions
4. **Generate Fresh Package Lock**: Ensure dependency tree consistency

### Short-term Actions (Priority 2)
1. **Switch to PNPM**: Honor packageManager specification
2. **Update Major Versions**: Migrate to chalk@5, chokidar@4, glob@11
3. **Audit Dependencies**: Remove unused packages
4. **Test Ecosystem**: Validate all test configurations

### Long-term Actions (Priority 3)
1. **Dependency Strategy**: Implement automated dependency updates
2. **Lock File Maintenance**: Regular dependency tree optimization
3. **CI/CD Integration**: Automated dependency validation
4. **Documentation**: Dependency management guidelines

## Resolution Strategy

See accompanying remediation steps in the next section of this analysis.