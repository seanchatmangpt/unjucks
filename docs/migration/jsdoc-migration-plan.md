# TypeScript to JSDoc Migration Plan
**Project:** Unjucks Code Generator  
**Version:** 2025.09.06.17.40  
**Agent:** Strategic Planning Agent (Agent 3/12)  
**Date:** September 7, 2025

## Executive Summary

This document outlines a comprehensive migration plan to transition the Unjucks project from TypeScript (.ts) to JavaScript with JSDoc annotations (.js), maintaining type safety while eliminating TypeScript compilation overhead.

### Current State Analysis
- **197 TypeScript files** across the codebase
- **793 exported type definitions** (interfaces, types, enums)
- TypeScript 5.9.2 with strict mode enabled
- Complex build pipeline with tsc compilation
- Extensive type definitions in `/src/types/` directory
- Heavy use of generics, unions, and mapped types

## 1. JSDoc Type Safety Strategy

### 1.1 Core JSDoc Annotation Patterns

#### Interface Definitions
```javascript
/**
 * @typedef {Object} TemplateFile
 * @property {string} path - File path
 * @property {string} content - File content
 * @property {FrontmatterConfig} [frontmatter] - Optional frontmatter config
 * @property {InjectionResult} [injectionResult] - Injection result
 */

/**
 * @typedef {Object} GenerateOptions
 * @property {string} generator - Generator name
 * @property {string} template - Template name
 * @property {Record<string, any>} variables - Template variables
 * @property {boolean} [dryRun] - Dry run mode
 * @property {boolean} [force] - Force overwrite
 */
```

#### Generic Type Patterns
```javascript
/**
 * @template T
 * @typedef {Object} Result
 * @property {boolean} success - Operation success
 * @property {T} [data] - Result data
 * @property {string} [error] - Error message
 */

/**
 * @template {string} K
 * @template V
 * @typedef {Record<K, V>} KeyValueMap
 */
```

#### Complex Union Types
```javascript
/**
 * @typedef {'pending' | 'generating' | 'completed' | 'failed'} GenerationStatus
 */

/**
 * @typedef {string | number | boolean | Array<any> | Object} TemplateVariableValue
 */
```

#### Function Type Definitions
```javascript
/**
 * @typedef {function(string, Object): Promise<GenerationResult>} GeneratorFunction
 */

/**
 * @callback ValidationCallback
 * @param {any} value - Value to validate
 * @param {ValidationContext} context - Validation context
 * @returns {Promise<ValidationResult>}
 */
```

### 1.2 Advanced JSDoc Patterns

#### Namespace Organization
```javascript
/**
 * @namespace Unjucks
 */

/**
 * @namespace Unjucks.Types
 */

/**
 * @memberof Unjucks.Types
 * @typedef {Object} TemplateConfig
 */
```

#### Class Definitions with JSDoc
```javascript
/**
 * Template Generator
 * @class
 */
class Generator {
  /**
   * @param {GeneratorConfig} config - Generator configuration
   */
  constructor(config) {
    /** @type {GeneratorConfig} */
    this.config = config;
  }

  /**
   * Generate files from template
   * @param {string} template - Template name
   * @param {GenerateOptions} options - Generation options
   * @returns {Promise<GenerationResult>} Generation result
   * @throws {Error} When template not found
   */
  async generate(template, options) {
    // Implementation
  }
}
```

#### Module Exports with Type Safety
```javascript
/**
 * @typedef {import('./types/index.js').TemplateFile} TemplateFile
 * @typedef {import('./types/index.js').GenerateOptions} GenerateOptions
 */

/**
 * Generate files from template
 * @param {string} generator - Generator name
 * @param {string} template - Template name  
 * @param {GenerateOptions} options - Options
 * @returns {Promise<GenerationResult>}
 */
export async function generate(generator, template, options) {
  // Implementation
}
```

## 2. Build System Transformation

### 2.1 Remove TypeScript Compilation

#### Current Build Process
```json
{
  "scripts": {
    "build": "tsc --project tsconfig.build.json && npm run build:post",
    "typecheck": "tsc --noEmit"
  }
}
```

#### New Build Process
```json
{
  "scripts": {
    "build": "node scripts/build-js-only.js && npm run build:post",
    "typecheck": "node scripts/jsdoc-type-check.js",
    "validate-jsdoc": "node scripts/validate-jsdoc-coverage.js"
  }
}
```

### 2.2 JSDoc Validation Tools

#### JSDoc Type Checker Script
```javascript
// scripts/jsdoc-type-check.js
import { execSync } from 'child_process';
import chalk from 'chalk';

/**
 * Validate JSDoc type annotations
 * @returns {Promise<void>}
 */
async function validateJSDocTypes() {
  try {
    // Use TypeScript in checkJs mode to validate JSDoc
    execSync('npx tsc --allowJs --checkJs --noEmit --target es2020 src/**/*.js', {
      stdio: 'inherit'
    });
    console.log(chalk.green('✅ JSDoc type validation passed'));
  } catch (error) {
    console.error(chalk.red('❌ JSDoc type validation failed'));
    process.exit(1);
  }
}
```

#### JSDoc Coverage Checker
```javascript
// scripts/validate-jsdoc-coverage.js
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

/**
 * Check JSDoc documentation coverage
 * @param {string} srcDir - Source directory
 * @returns {Promise<{coverage: number, missing: string[]}>}
 */
async function checkJSDocCoverage(srcDir) {
  // Implementation to scan for missing JSDoc
}
```

### 2.3 Build Configuration Changes

#### New tsconfig.json (for JSDoc validation only)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "esnext", 
    "moduleResolution": "bundler",
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.js"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

#### Package.json Updates
```json
{
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js", 
  "types": "./dist/types.d.ts",
  "scripts": {
    "build": "node scripts/build-esm.js",
    "build:types": "node scripts/generate-dts-from-jsdoc.js",
    "typecheck": "tsc --allowJs --checkJs --noEmit"
  }
}
```

## 3. Migration Timeline & Phases

### Phase 1: Foundation (Week 1-2)
**Duration:** 10 days  
**Risk Level:** Medium

#### Tasks:
1. **Create JSDoc type definitions** (`src/types/`)
   - Convert all TypeScript interfaces to JSDoc typedefs
   - Maintain existing type relationships
   - Create central types index file

2. **Setup validation tooling**
   - JSDoc type checker script
   - JSDoc coverage validator
   - Update package.json scripts

3. **Migration tooling development**
   - Automated TypeScript to JSDoc converter
   - Import statement transformer
   - File extension updater

### Phase 2: Core Libraries (Week 3-4)  
**Duration:** 10 days  
**Risk Level:** High

#### Tasks:
1. **Migrate core library files** (`src/lib/`)
   - Template scanner, generator, file injector
   - RDF/Turtle processors
   - Frontmatter parser
   - Semantic engine components

2. **Update import statements**
   - Change .ts extensions to .js
   - Add JSDoc import types where needed
   - Update dynamic imports

3. **Validate type safety**
   - Run JSDoc type checker on migrated files
   - Ensure no type safety regression
   - Fix any type annotation issues

### Phase 3: Commands & MCP (Week 5-6)
**Duration:** 10 days  
**Risk Level:** Medium

#### Tasks:
1. **Migrate CLI commands** (`src/commands/`)
   - Generate, list, init, version commands
   - GitHub integration commands  
   - Swarm orchestration commands

2. **Migrate MCP server** (`src/mcp/`)
   - Server implementation
   - Tool definitions
   - Request handlers

3. **Update build configuration**
   - Remove TypeScript compilation
   - Add JSDoc-only build process
   - Generate .d.ts from JSDoc

### Phase 4: Advanced Features (Week 7-8)
**Duration:** 10 days  
**Risk Level:** Low

#### Tasks:
1. **Migrate server components** (`src/server/`)
   - API endpoints
   - WebSocket server
   - Authentication middleware

2. **Migrate security modules** (`src/security/`)
   - Encryption utilities
   - Access controls
   - Vulnerability scanners

3. **Performance optimizations** (`src/performance/`)
   - Monitoring tools
   - Memory optimizers
   - Query optimizers

### Phase 5: Testing & Validation (Week 9-10)
**Duration:** 10 days
**Risk Level:** Low

#### Tasks:
1. **Update all tests**
   - Change imports from .ts to .js
   - Update test utilities
   - Validate test coverage

2. **End-to-end testing**
   - CLI functionality tests
   - MCP server integration tests
   - Performance benchmarks

3. **Documentation updates**
   - API documentation generation
   - Migration guide
   - Developer documentation

## 4. Automated Conversion Tools

### 4.1 TypeScript to JSDoc Converter

#### Core Converter Script
```javascript
// scripts/ts-to-jsdoc-converter.js
import fs from 'fs-extra';
import { Project } from 'ts-morph';
import chalk from 'chalk';

/**
 * Convert TypeScript file to JavaScript with JSDoc
 * @param {string} filePath - Path to TypeScript file
 * @returns {Promise<{jsContent: string, jsDocTypes: string[]}>}
 */
async function convertTSToJSDoc(filePath) {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(filePath);
  
  // Extract interfaces
  const interfaces = sourceFile.getInterfaces().map(interfaceDecl => {
    return convertInterfaceToJSDoc(interfaceDecl);
  });
  
  // Extract type aliases
  const typeAliases = sourceFile.getTypeAliases().map(typeAlias => {
    return convertTypeAliasToJSDoc(typeAlias);
  });
  
  // Convert class methods
  const classes = sourceFile.getClasses().map(classDecl => {
    return convertClassToJSDoc(classDecl);
  });
  
  // Convert functions
  const functions = sourceFile.getFunctions().map(funcDecl => {
    return convertFunctionToJSDoc(funcDecl);
  });
  
  return {
    jsContent: generateJSContent(sourceFile),
    jsDocTypes: [...interfaces, ...typeAliases]
  };
}
```

#### Interface Converter
```javascript
/**
 * Convert TypeScript interface to JSDoc typedef
 * @param {InterfaceDeclaration} interfaceDecl - Interface declaration
 * @returns {string} JSDoc typedef
 */
function convertInterfaceToJSDoc(interfaceDecl) {
  const name = interfaceDecl.getName();
  const properties = interfaceDecl.getProperties();
  
  let jsDoc = `/**\n * @typedef {Object} ${name}\n`;
  
  properties.forEach(prop => {
    const propName = prop.getName();
    const propType = prop.getType().getText();
    const isOptional = prop.hasQuestionToken();
    const description = prop.getJsDocs()[0]?.getDescription() || '';
    
    jsDoc += ` * @property {${propType}} ${isOptional ? '[' + propName + ']' : propName}`;
    if (description) jsDoc += ` - ${description}`;
    jsDoc += '\n';
  });
  
  jsDoc += ' */';
  return jsDoc;
}
```

### 4.2 Import Statement Transformer

```javascript
/**
 * Transform TypeScript imports to JSDoc imports
 * @param {string} content - File content
 * @returns {string} Transformed content
 */
function transformImports(content) {
  // Transform type-only imports
  content = content.replace(
    /import type \{ ([^}]+) \} from ['"]([^'"]+)['"];/g,
    '/**\n * @typedef {import(\'$2.js\').$1} $1\n */'
  );
  
  // Transform regular imports  
  content = content.replace(
    /import \{ ([^}]+) \} from ['"]([^'"]+)['"];/g,
    'import { $1 } from \'$2.js\';'
  );
  
  // Transform default imports
  content = content.replace(
    /import ([^{][^']+) from ['"]([^'"]+)['"];/g,
    'import $1 from \'$2.js\';'
  );
  
  return content;
}
```

### 4.3 File Extension Update Tool

```javascript
/**
 * Update file extensions from .ts to .js
 * @param {string} srcDir - Source directory
 * @returns {Promise<void>}
 */
async function updateFileExtensions(srcDir) {
  const tsFiles = await glob(`${srcDir}/**/*.ts`);
  
  for (const tsFile of tsFiles) {
    const jsFile = tsFile.replace(/\.ts$/, '.js');
    await fs.rename(tsFile, jsFile);
    console.log(chalk.blue(`Renamed: ${tsFile} → ${jsFile}`));
  }
}
```

## 5. Testing Strategy

### 5.1 Pre-Migration Testing

#### Type Safety Validation
```javascript
// tests/migration/type-safety-validation.test.js
import { describe, test, expect } from 'vitest';
import { execSync } from 'child_process';

describe('Pre-migration type safety', () => {
  test('TypeScript compilation should pass', () => {
    expect(() => {
      execSync('npx tsc --noEmit', { stdio: 'pipe' });
    }).not.toThrow();
  });
  
  test('All exports should be properly typed', () => {
    // Validate export types
  });
});
```

### 5.2 Migration Testing

#### JSDoc Validation Tests
```javascript
// tests/migration/jsdoc-validation.test.js
describe('JSDoc migration validation', () => {
  test('All functions should have JSDoc annotations', async () => {
    const coverage = await checkJSDocCoverage('src');
    expect(coverage.coverage).toBeGreaterThan(95);
  });
  
  test('JSDoc type checking should pass', () => {
    expect(() => {
      execSync('npx tsc --allowJs --checkJs --noEmit', { stdio: 'pipe' });
    }).not.toThrow();
  });
});
```

### 5.3 Post-Migration Testing

#### Functional Testing
```javascript
// tests/migration/functional-validation.test.js
describe('Post-migration functionality', () => {
  test('CLI commands should work identically', async () => {
    // Test all CLI commands
  });
  
  test('MCP server should function properly', async () => {
    // Test MCP server functionality
  });
  
  test('Template generation should work', async () => {
    // Test template generation
  });
});
```

#### Performance Testing
```javascript
// tests/migration/performance-validation.test.js
describe('Performance comparison', () => {
  test('Build time should be faster without TypeScript', async () => {
    const buildTime = await measureBuildTime();
    expect(buildTime).toBeLessThan(previousBuildTime * 0.5);
  });
  
  test('Runtime performance should be maintained', async () => {
    // Performance benchmarks
  });
});
```

## 6. Risk Assessment & Mitigation

### 6.1 High Risk Areas

#### Complex Generic Types
**Risk:** Advanced TypeScript generics may not translate well to JSDoc  
**Mitigation:**
- Manual conversion for complex generics
- Extensive testing of type inference
- Fallback to `any` type with comments where necessary

#### Dynamic Type Patterns
**Risk:** TypeScript's mapped types and conditional types have no JSDoc equivalent  
**Mitigation:**
- Convert to runtime validation where possible
- Use union types for finite sets
- Document complex patterns in comments

#### Third-party Dependencies
**Risk:** Dependencies expecting TypeScript types  
**Mitigation:**
- Keep TypeScript as dev dependency for type checking
- Generate .d.ts files from JSDoc
- Use `@types/*` packages where available

### 6.2 Medium Risk Areas

#### Import/Export Patterns
**Risk:** Module resolution issues after file extension changes  
**Mitigation:**
- Comprehensive import transformation script
- Automated testing of all import paths
- Gradual migration with both .ts and .js coexisting temporarily

#### Build Pipeline Integration
**Risk:** CI/CD pipeline failures due to build changes  
**Mitigation:**
- Update all CI configurations
- Parallel build processes during migration
- Rollback plan for build failures

### 6.3 Low Risk Areas

#### Test Files
**Risk:** Test imports and type definitions  
**Mitigation:**
- Update test imports incrementally
- Maintain test coverage during migration
- Use TypeScript for test files if needed

## 7. Migration Execution Plan

### 7.1 Preparation Phase

#### Week 0: Setup
1. Create migration branch: `feature/jsdoc-migration`
2. Setup migration tooling and scripts
3. Create baseline performance benchmarks
4. Document current type safety coverage

### 7.2 Execution Phases

#### Phase 1: Type Definitions (Days 1-10)
```bash
# Execute automated conversion
npm run migration:convert-types

# Validate JSDoc generation  
npm run migration:validate-types

# Manual review and cleanup
npm run migration:review-phase1
```

#### Phase 2: Core Libraries (Days 11-20)
```bash
# Convert core library files
npm run migration:convert-lib

# Update imports and dependencies
npm run migration:fix-imports

# Run type validation
npm run typecheck
```

#### Phase 3-5: Remaining Components (Days 21-50)
```bash
# Convert remaining files by category
npm run migration:convert-commands
npm run migration:convert-mcp
npm run migration:convert-server
npm run migration:convert-security

# Comprehensive validation
npm run migration:validate-all
```

### 7.3 Validation & Testing

#### Continuous Validation
```bash
# Run after each phase
npm run test:migration
npm run typecheck  
npm run build
npm run test:all
```

#### Performance Benchmarking
```bash
# Compare performance metrics
npm run benchmark:build-time
npm run benchmark:runtime
npm run benchmark:memory-usage
```

## 8. Success Criteria

### 8.1 Functional Requirements
- [ ] All CLI commands work identically
- [ ] MCP server functions without regression
- [ ] Template generation produces identical output
- [ ] All tests pass with same coverage
- [ ] No runtime errors introduced

### 8.2 Performance Requirements  
- [ ] Build time reduced by 50%+ (no TypeScript compilation)
- [ ] Runtime performance maintained or improved
- [ ] Memory usage remains stable
- [ ] Package size reduced (no TypeScript dependency)

### 8.3 Quality Requirements
- [ ] JSDoc coverage >95% for public APIs
- [ ] Type safety validated via TypeScript checkJs
- [ ] Zero breaking changes to public API
- [ ] Documentation quality maintained
- [ ] Developer experience preserved

### 8.4 Technical Requirements
- [ ] All imports/exports work correctly
- [ ] Module resolution functions properly  
- [ ] .d.ts files generated for consumers
- [ ] ESM compatibility maintained
- [ ] Node.js version compatibility preserved

## 9. Rollback Plan

### 9.1 Rollback Triggers
- Build time increases instead of decreases
- Functional regressions discovered in testing
- Type safety significantly compromised
- Developer productivity reduced
- Critical third-party compatibility issues

### 9.2 Rollback Process
1. **Immediate:** Switch back to main branch
2. **Short-term:** Keep TypeScript configuration available
3. **Long-term:** Analyze migration failures and re-plan

### 9.3 Contingency Options
- **Partial migration:** Keep core types in TypeScript
- **Hybrid approach:** JSDoc for implementation, TypeScript for types
- **Delayed migration:** Wait for better tooling support

## 10. Post-Migration Considerations

### 10.1 Maintenance
- Update JSDoc annotations as code evolves
- Maintain type checking in CI/CD pipeline
- Monitor for JSDoc coverage regression
- Keep migration tooling for future changes

### 10.2 Developer Onboarding
- Update contribution guidelines
- Provide JSDoc style guide
- Document migration rationale
- Create development best practices

### 10.3 Future Enhancements
- Investigate advanced JSDoc tooling
- Consider TypeScript JSDoc improvements
- Explore automated JSDoc generation
- Monitor ECMAScript type annotations proposal

## Conclusion

This migration plan provides a comprehensive roadmap for transitioning from TypeScript to JSDoc while maintaining type safety and code quality. The phased approach minimizes risk while the automated tooling ensures consistency. Success depends on thorough testing, careful validation, and maintaining developer experience throughout the process.

The expected benefits include faster build times, reduced dependencies, and simplified toolchain while preserving the type safety that makes the codebase maintainable and robust.

---

**Next Steps:**
1. Review and approve migration plan
2. Setup development environment for migration
3. Begin Phase 1: Type Definitions conversion
4. Coordinate with Code Analyzer agent for technical implementation details

**Coordination with other agents:**
- Code Analyzer: Technical implementation details and tooling
- Test Engineer: Comprehensive testing strategy and validation
- Performance Specialist: Build time and runtime benchmarking