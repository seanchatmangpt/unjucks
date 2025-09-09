#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';

const projectRoot = process.cwd();

// More comprehensive TypeScript-specific patterns to remove or modify
const cleanupPatterns = [
  // Remove TypeScript type annotations from variable declarations
  {
    name: 'Variable type annotations',
    pattern: /let\s+(\w+):\s*[A-Za-z_$][A-Za-z0-9_$<>[\]|&]*\s*=/g,
    replacement: 'let $1 ='
  },
  {
    name: 'Const type annotations',
    pattern: /const\s+(\w+):\s*[A-Za-z_$][A-Za-z0-9_$<>[\]|&]*\s*=/g,
    replacement: 'const $1 ='
  },
  // Remove TypeScript function parameter type annotations  
  {
    name: 'Function parameter types',
    pattern: /(\w+):\s*[A-Za-z_$][A-Za-z0-9_$<>[\]|&]*(\s*[,)])/g,
    replacement: '$1$2'
  },
  // Remove TypeScript return type annotations
  {
    name: 'Function return types',
    pattern: /\):\s*[A-Za-z_$][A-Za-z0-9_$<>[\]|&]*(\s*[{=>])/g,
    replacement: ')$1'
  },
  // Remove arrow function return types
  {
    name: 'Arrow function return types',
    pattern: /=>\s*[A-Za-z_$][A-Za-z0-9_$<>[\]|&]*\s*=>/g,
    replacement: '=>'
  },
  // Remove explicit type assertions (as Type)
  {
    name: 'Type assertions',
    pattern: /\s+as\s+[A-Za-z_$][A-Za-z0-9_$<>[\]|&]*/g,
    replacement: ''
  },
  // Remove generic type parameters in function calls
  {
    name: 'Generic type parameters',
    pattern: /<[A-Za-z_$][A-Za-z0-9_$<>[\]|&,\s]*>/g,
    replacement: ''
  },
  // Remove type-only imports
  {
    name: 'Type-only imports',
    pattern: /import\s+type\s+\{[^}]*\}\s+from\s+['""][^'"]*['""];\s*\n?/g,
    replacement: ''
  },
  // Remove interface declarations
  {
    name: 'Interface declarations',
    pattern: /interface\s+\w+\s*\{[^}]*\}\s*\n?/g,
    replacement: ''
  },
  // Remove type alias declarations
  {
    name: 'Type alias declarations',
    pattern: /type\s+\w+\s*=\s*[^;\n]*;\s*\n?/g,
    replacement: ''
  },
  // Fix method signatures by removing return types
  {
    name: 'Method return types',
    pattern: /(\s+\w+\s*\([^)]*\)):\s*[A-Za-z_$][A-Za-z0-9_$<>[\]|&]*(\s*\{)/g,
    replacement: '$1$2'
  },
  // Remove array type syntax T[]
  {
    name: 'Array type syntax',
    pattern: /:\s*([A-Za-z_$][A-Za-z0-9_$]*)\[\]/g,
    replacement: ''
  },
  // Fix destructuring with types
  {
    name: 'Destructuring types',
    pattern: /\{\s*([^}:]*?):\s*[A-Za-z_$][A-Za-z0-9_$<>[\]|&]*\s*\}/g,
    replacement: '{ $1 }'
  }
];

async function cleanupFile(filePath) {
  try {
    console.log(`Cleaning up ${filePath}...`);
    
    let content = await fs.readFile(filePath, 'utf8');
    const originalContent = content;
    let changesCount = 0;
    
    // Apply all cleanup patterns
    for (const pattern of cleanupPatterns) {
      const matches = content.match(pattern.pattern);
      if (matches) {
        content = content.replace(pattern.pattern, pattern.replacement);
        changesCount += matches.length;
        console.log(`  ✓ Fixed ${matches.length} instances of ${pattern.name}`);
      }
    }
    
    // Only write if content changed
    if (content !== originalContent) {
      await fs.writeFile(filePath, content, 'utf8');
      console.log(`  ✅ Applied ${changesCount} fixes to ${filePath}`);
      return changesCount;
    } else {
      console.log(`  ⚪ No TypeScript syntax found in ${filePath}`);
      return 0;
    }
    
  } catch (error) {
    console.error(`  ❌ Failed to cleanup ${filePath}:`, error.message);
    return 0;
  }
}

async function cleanupJavaScriptTests() {
  try {
    console.log('🧹 Cleaning up remaining TypeScript syntax from JavaScript test files...\n');
    
    const patterns = [
      'tests/**/*.test.js',
      'tests/**/*.spec.js',
      '_templates/**/*.test.js',
      '_templates/**/*.spec.js'
    ];
    
    let totalFiles = 0;
    let totalFixes = 0;
    
    for (const pattern of patterns) {
      const files = await glob(pattern, { 
        cwd: projectRoot,
        absolute: true,
        ignore: ['node_modules/**', 'dist/**']
      });
      
      console.log(`Found ${files.length} files matching pattern: ${pattern}`);
      totalFiles += files.length;
      
      for (const file of files) {
        const fixes = await cleanupFile(file);
        totalFixes += fixes;
      }
    }
    
    console.log(`\n📊 Cleanup Summary:`);
    console.log(`   Total files processed: ${totalFiles}`);
    console.log(`   Total TypeScript syntax fixes applied: ${totalFixes}`);
    
    if (totalFixes > 0) {
      console.log(`\n✅ Successfully cleaned up TypeScript syntax from JavaScript test files!`);
    } else {
      console.log(`\n✨ No TypeScript syntax found - files are already clean!`);
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    process.exit(1);
  }
}

// Run the cleanup
cleanupJavaScriptTests();