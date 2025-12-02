#!/usr/bin/env node

/**
 * Advanced Import Update Script
 * Handles complex import patterns and edge cases
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { execSync } from 'child_process';

// Advanced mapping rules based on analysis of actual imports
const ADVANCED_MAPPINGS = [
  // Template helper imports (from temp-utils.js)
  {
    pattern: /import { {{ name \| pascalCase }} } from '\.\/index';/g,
    replacement: "import { {{ name | pascalCase }} } from './cli-entry';"
  },
  
  // Multi-line import statements
  {
    pattern: /import {([^}]+)} from ['"]\.\/index['"]/g,
    replacement: "import {$1} from './cli-entry'"
  },
  
  // Import with destructuring from command indexes
  {
    pattern: /import ([^{]+) from ['"]\.\/commands\/(\w+)\/index['"]/g,
    replacement: "import $1 from './commands/$2/route'"
  },
  
  // Core package sub-module imports
  {
    pattern: /from ['"]@kgen\/core\/src\/([^'"]+)['"]/g,
    replacement: "from '@kgen/core/src/$1'"
  },
  
  // Specific provenance imports
  {
    pattern: /from ['"]@kgen\/core\/src\/provenance\/index\.js['"]/g,
    replacement: "from '@kgen/core/src/provenance/provenance-entry.js'"
  }
];

// File-specific mapping rules
const FILE_SPECIFIC_MAPPINGS = {
  // For files in packages/kgen-cli/src/
  'kgen-cli': [
    { from: /from ['"]\.\/index['"]/g, to: "from './cli-entry'" },
    { from: /from ['"]\.\/commands\/artifact\/index['"]/g, to: "from './commands/artifact/route'" },
    { from: /from ['"]\.\/commands\/cache\/index['"]/g, to: "from './commands/cache/route'" },
    { from: /from ['"]\.\/commands\/graph\/index['"]/g, to: "from './commands/graph/route'" },
    { from: /from ['"]\.\/commands\/project\/index['"]/g, to: "from './commands/project/route'" },
    { from: /from ['"]\.\/commands\/templates\/index['"]/g, to: "from './commands/templates/route'" },
    { from: /from ['"]\.\/commands\/rules\/index['"]/g, to: "from './commands/rules/route'" },
    { from: /from ['"]\.\/commands\/metrics\/index['"]/g, to: "from './commands/metrics/route'" },
    { from: /from ['"]\.\/commands\/validate\/index['"]/g, to: "from './commands/validate/route'" },
    { from: /from ['"]\.\/commands\/drift\/index['"]/g, to: "from './commands/drift/route'" },
    { from: /from ['"]\.\/commands\/query\/index['"]/g, to: "from './commands/query/route'" }
  ],
  
  // For files in packages/kgen-core/src/
  'kgen-core': [
    { from: /from ['"]\.\/index['"]/g, to: "from './core'" },
    { from: /from ['"]\.\/templating\/index['"]/g, to: "from './templating/templating-entry'" },
    { from: /from ['"]\.\/rdf\/index['"]/g, to: "from './rdf/rdf-entry'" },
    { from: /from ['"]\.\/config\/index['"]/g, to: "from './config/config-entry'" },
    { from: /from ['"]\.\/utils\/index['"]/g, to: "from './utils/utils-entry'" },
    { from: /from ['"]\.\/cache\/index['"]/g, to: "from './cache/cache-entry'" },
    { from: /from ['"]\.\/provenance\/index['"]/g, to: "from './provenance/provenance-entry'" },
    { from: /from ['"]\.\/security\/index['"]/g, to: "from './security/security-entry'" },
    { from: /from ['"]\.\/attestation\/index['"]/g, to: "from './attestation/attestation-entry'" }
  ],
  
  // For files in packages/kgen-templates/src/
  'kgen-templates': [
    { from: /from ['"]\.\/index['"]/g, to: "from './templates-entry'" }
  ],
  
  // For files in packages/kgen-rules/src/
  'kgen-rules': [
    { from: /from ['"]\.\/index['"]/g, to: "from './rules-entry'" }
  ]
};

function getPackageType(filePath) {
  if (filePath.includes('packages/kgen-cli/')) return 'kgen-cli';
  if (filePath.includes('packages/kgen-core/')) return 'kgen-core';
  if (filePath.includes('packages/kgen-templates/')) return 'kgen-templates';
  if (filePath.includes('packages/kgen-rules/')) return 'kgen-rules';
  return 'other';
}

function updateAdvancedImports(filePath) {
  try {
    let content = readFileSync(filePath, 'utf8');
    let modified = false;
    const originalContent = content;
    
    // Apply advanced pattern-based mappings
    for (const mapping of ADVANCED_MAPPINGS) {
      if (mapping.pattern.test(content)) {
        content = content.replace(mapping.pattern, mapping.replacement);
        modified = true;
      }
    }
    
    // Apply file-specific mappings
    const packageType = getPackageType(filePath);
    if (FILE_SPECIFIC_MAPPINGS[packageType]) {
      for (const mapping of FILE_SPECIFIC_MAPPINGS[packageType]) {
        if (mapping.from.test(content)) {
          content = content.replace(mapping.from, mapping.to);
          modified = true;
        }
      }
    }
    
    // Handle cross-package imports with proper resolution
    const crossPackagePatterns = [
      { from: /@kgen\/core(?!\/)/g, to: '@kgen/core/core' },
      { from: /@kgen\/templates(?!\/)/g, to: '@kgen/templates/templates-entry' },
      { from: /@kgen\/rules(?!\/)/g, to: '@kgen/rules/rules-entry' },
      { from: /@kgen\/cli(?!\/)/g, to: '@kgen/cli/cli-entry' }
    ];
    
    for (const pattern of crossPackagePatterns) {
      if (pattern.from.test(content)) {
        content = content.replace(pattern.from, pattern.to);
        modified = true;
      }
    }
    
    if (modified) {
      writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Advanced updates applied to: ${filePath}`);
      
      // Show diff summary for major changes
      const lines = content.split('\n').length;
      const originalLines = originalContent.split('\n').length;
      if (Math.abs(lines - originalLines) > 2) {
        console.log(`   📊 Line count changed: ${originalLines} → ${lines}`);
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}: ${error.message}`);
    return false;
  }
}

function validateImportPaths(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const importRegex = /from ['"]([^'"]+)['"]/g;
    let match;
    const issues = [];
    
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      
      // Skip external packages
      if (!importPath.startsWith('.') && !importPath.startsWith('@kgen/')) {
        continue;
      }
      
      // Check for remaining index imports
      if (importPath.includes('/index') || importPath === './index') {
        issues.push(`Remaining index import: ${importPath}`);
      }
      
      // Check for unresolved relative imports
      if (importPath.startsWith('./')) {
        const resolvedPath = join(dirname(filePath), importPath);
        const jsPath = resolvedPath + '.js';
        const tsPath = resolvedPath + '.ts';
        const mjsPath = resolvedPath + '.mjs';
        
        if (!existsSync(jsPath) && !existsSync(tsPath) && !existsSync(mjsPath)) {
          issues.push(`Unresolved import: ${importPath}`);
        }
      }
    }
    
    return issues;
  } catch (error) {
    return [`Error reading file: ${error.message}`];
  }
}

function main() {
  console.log('🚀 Starting advanced import update...\n');
  
  try {
    // Find all source files
    const command = `find /Users/sac/unjucks -type f \\( -name "*.ts" -o -name "*.js" -o -name "*.mjs" \\) ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/.git/*"`;
    const output = execSync(command, { encoding: 'utf8' });
    const sourceFiles = output.trim().split('\n').filter(path => path.length > 0);
    
    console.log(`📁 Found ${sourceFiles.length} source files\n`);
    
    let updatedFiles = 0;
    let totalIssues = 0;
    
    // Phase 1: Update imports
    console.log('📝 Phase 1: Updating import statements...');
    for (const filePath of sourceFiles) {
      if (updateAdvancedImports(filePath)) {
        updatedFiles++;
      }
    }
    
    console.log(`\n✅ Phase 1 complete: ${updatedFiles} files updated\n`);
    
    // Phase 2: Validation
    console.log('🔍 Phase 2: Validating import paths...');
    for (const filePath of sourceFiles) {
      const issues = validateImportPaths(filePath);
      if (issues.length > 0) {
        console.log(`⚠️  Issues in ${filePath}:`);
        issues.forEach(issue => console.log(`     - ${issue}`));
        totalIssues += issues.length;
      }
    }
    
    console.log(`\n📊 Final Summary:`);
    console.log(`   - Files processed: ${sourceFiles.length}`);
    console.log(`   - Files updated: ${updatedFiles}`);
    console.log(`   - Import issues found: ${totalIssues}`);
    
    if (totalIssues === 0) {
      console.log('\n🎉 All imports successfully updated!');
      console.log('✅ Next steps:');
      console.log('   1. Run: npm run build');
      console.log('   2. Run: npm test');
    } else {
      console.log('\n⚠️  Some import issues remain. Please review and fix manually.');
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();