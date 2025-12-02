#!/usr/bin/env node

/**
 * Comprehensive Import Update Script
 * Updates all import statements across the codebase to use explicit file names
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

// Define import mapping rules
const LOCAL_IMPORT_MAPPINGS = [
  // CLI entry points
  { from: "from './cli-entry'", to: "from './cli-entry'" },
  { from: "from \"./index\"", to: "from \"./cli-entry\"" },
  
  // Command route mappings
  { from: "from './commands/artifact/route'", to: "from './commands/artifact/route'" },
  { from: "from \"./commands/artifact/index\"", to: "from \"./commands/artifact/route\"" },
  { from: "from './commands/cache/route'", to: "from './commands/cache/route'" },
  { from: "from \"./commands/cache/index\"", to: "from \"./commands/cache/route\"" },
  { from: "from './commands/graph/route'", to: "from './commands/graph/route'" },
  { from: "from \"./commands/graph/index\"", to: "from \"./commands/graph/route\"" },
  { from: "from './commands/project/route'", to: "from './commands/project/route'" },
  { from: "from \"./commands/project/index\"", to: "from \"./commands/project/route\"" },
  { from: "from './commands/templates/route'", to: "from './commands/templates/route'" },
  { from: "from \"./commands/templates/index\"", to: "from \"./commands/templates/route\"" },
  { from: "from './commands/rules/route'", to: "from './commands/rules/route'" },
  { from: "from \"./commands/rules/index\"", to: "from \"./commands/rules/route\"" },
  { from: "from './commands/metrics/route'", to: "from './commands/metrics/route'" },
  { from: "from \"./commands/metrics/index\"", to: "from \"./commands/metrics/route\"" },
  { from: "from './commands/validate/route'", to: "from './commands/validate/route'" },
  { from: "from \"./commands/validate/index\"", to: "from \"./commands/validate/route\"" },
  { from: "from './commands/drift/route'", to: "from './commands/drift/route'" },
  { from: "from \"./commands/drift/index\"", to: "from \"./commands/drift/route\"" },
  { from: "from './commands/query/route'", to: "from './commands/query/route'" },
  { from: "from \"./commands/query/index\"", to: "from \"./commands/query/route\"" },
];

const CROSS_PACKAGE_MAPPINGS = [
  // Core package mappings
  { from: "from '@kgen/core/core'", to: "from '@kgen/core/core'" },
  { from: "from \"@kgen/core/core\"", to: "from \"@kgen/core/core\"" },
  { from: "from '@kgen/core/cache/cache-entry'", to: "from '@kgen/core/cache/cache-entry'" },
  { from: "from \"@kgen/core/cache\"", to: "from \"@kgen/core/cache/cache-entry\"" },
  { from: "from '@kgen/core/config/config-entry'", to: "from '@kgen/core/config/config-entry'" },
  { from: "from \"@kgen/core/config\"", to: "from \"@kgen/core/config/config-entry\"" },
  { from: "from '@kgen/core/utils/utils-entry'", to: "from '@kgen/core/utils/utils-entry'" },
  { from: "from \"@kgen/core/utils\"", to: "from \"@kgen/core/utils/utils-entry\"" },
  
  // Templates package mappings
  { from: "from '@kgen/templates/templates-entry'", to: "from '@kgen/templates/templates-entry'" },
  { from: "from \"@kgen/templates/templates-entry\"", to: "from \"@kgen/templates/templates-entry\"" },
  
  // Rules package mappings
  { from: "from '@kgen/rules/rules-entry'", to: "from '@kgen/rules/rules-entry'" },
  { from: "from \"@kgen/rules/rules-entry\"", to: "from \"@kgen/rules/rules-entry\"" },
  
  // CLI package mappings
  { from: "from '@kgen/cli/cli-entry'", to: "from '@kgen/cli/cli-entry'" },
  { from: "from \"@kgen/cli/cli-entry\"", to: "from \"@kgen/cli/cli-entry\"" },
];

// Additional specific mappings found in the codebase
const SPECIFIC_MAPPINGS = [
  // Core specific paths
  { from: "from '@kgen/core/src/cache/optimized-cache-manager'", to: "from '@kgen/core/src/cache/optimized-cache-manager'" },
  { from: "from \"@kgen/core/cache/optimized-cache-manager\"", to: "from \"@kgen/core/src/cache/optimized-cache-manager\"" },
  
  // Documents mappings in comments (found in examples)
  { from: "from '@kgen/core/src/documents/index'", to: "from '@kgen/core/src/documents/index'" },
  { from: "from \"@kgen/documents\"", to: "from \"@kgen/core/src/documents/index\"" },
  
  // Office mappings in comments
  { from: "from '@kgen/core/src/office/index'", to: "from '@kgen/core/src/office/index'" },
  { from: "from \"@kgen/office\"", to: "from \"@kgen/core/src/office/index\"" },
];

function updateImportsInFile(filePath) {
  try {
    let content = readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Apply all mapping rules
    const allMappings = [...LOCAL_IMPORT_MAPPINGS, ...CROSS_PACKAGE_MAPPINGS, ...SPECIFIC_MAPPINGS];
    
    for (const mapping of allMappings) {
      const regex = new RegExp(mapping.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      if (content.includes(mapping.from)) {
        content = content.replace(regex, mapping.to);
        modified = true;
        console.log(`Updated import in ${filePath}: ${mapping.from} → ${mapping.to}`);
      }
    }
    
    if (modified) {
      writeFileSync(filePath, content, 'utf8');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}: ${error.message}`);
    return false;
  }
}

function findSourceFiles() {
  try {
    // Find all TypeScript and JavaScript files excluding node_modules and dist
    const command = `find /Users/sac/unjucks -type f \\( -name "*.ts" -o -name "*.js" -o -name "*.mjs" \\) ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/.git/*"`;
    const output = execSync(command, { encoding: 'utf8' });
    return output.trim().split('\n').filter(path => path.length > 0);
  } catch (error) {
    console.error('Error finding source files:', error.message);
    return [];
  }
}

function main() {
  console.log('🔄 Starting comprehensive import update...\n');
  
  const sourceFiles = findSourceFiles();
  console.log(`Found ${sourceFiles.length} source files to process\n`);
  
  let totalUpdated = 0;
  let totalFiles = 0;
  
  for (const filePath of sourceFiles) {
    totalFiles++;
    if (updateImportsInFile(filePath)) {
      totalUpdated++;
    }
    
    // Progress indicator
    if (totalFiles % 50 === 0) {
      console.log(`Processed ${totalFiles}/${sourceFiles.length} files...`);
    }
  }
  
  console.log(`\n✅ Import update complete!`);
  console.log(`📊 Summary:`);
  console.log(`   - Total files processed: ${totalFiles}`);
  console.log(`   - Files with updates: ${totalUpdated}`);
  console.log(`   - Files unchanged: ${totalFiles - totalUpdated}`);
  
  if (totalUpdated > 0) {
    console.log('\n🔍 Next steps:');
    console.log('   1. Run: npm run build');
    console.log('   2. Run: npm test');
    console.log('   3. Check for any remaining import errors');
  }
}

// Run the script
main();