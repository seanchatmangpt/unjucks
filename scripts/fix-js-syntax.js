#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';

const projectRoot = process.cwd();

// Specific syntax fixes for common JavaScript conversion issues
const syntaxFixes = [
  // Fix broken key expressions in object access
  {
    name: 'Fix object key expressions',
    pattern: /expect\(result\.frontmatter\[key typeof result\.frontmatter\]\)\.toBe\(value\)/g,
    replacement: 'expect(result.frontmatter[key]).toBe(value)'
  },
  // Fix broken template literal expressions
  {
    name: 'Fix template literal expressions',
    pattern: /private true: boolean = false/g,
    replacement: 'private enabled = false'
  },
  // Fix broken property definitions 
  {
    name: 'Fix property definitions',
    pattern: /enabled: boolean = true/g,
    replacement: 'enabled = true'
  },
  // Fix broken function parameter syntax
  {
    name: 'Fix function parameters',
    pattern: /\(([^)]+): [^,)]+([,)])/g,
    replacement: '($1$2'
  },
  // Fix broken import statements with missing values
  {
    name: 'Fix broken import statements',
    pattern: /import\s*{\s*([^}]*),\s*}\s*from/g,
    replacement: 'import { $1 } from'
  },
  // Fix broken template strings with invalid syntax
  {
    name: 'Fix invalid template strings',
    pattern: /Expected unicode escape\./g,
    replacement: ''
  },
  // Fix semicolon issues in object destructuring
  {
    name: 'Fix destructuring syntax',
    pattern: /const\s*{\s*([^}=]+)=([^}]+)\s*}\s*=/g,
    replacement: 'const { $1: $2 } ='
  },
  // Fix typeof usage in object property access
  {
    name: 'Fix typeof expressions',
    pattern: /\[key typeof ([^\]]+)\]/g,
    replacement: '[key]'
  },
  // Remove broken type annotations in variable declarations
  {
    name: 'Remove type annotations',
    pattern: /let\s+(\w+):\s*[^=]+=/g,
    replacement: 'let $1 ='
  },
  // Fix broken arrow function syntax
  {
    name: 'Fix arrow functions',
    pattern: /\(\s*([^)]*),\s*\)\s*=>/g,
    replacement: '($1) =>'
  }
];

async function fixFile(filePath) {
  try {
    console.log(`Fixing ${filePath}...`);
    
    let content = await fs.readFile(filePath, 'utf8');
    const originalContent = content;
    let fixCount = 0;
    
    // Apply all syntax fixes
    for (const fix of syntaxFixes) {
      const matches = content.match(fix.pattern);
      if (matches) {
        content = content.replace(fix.pattern, fix.replacement);
        fixCount += matches.length;
        console.log(`  ✓ Applied ${matches.length} fixes for: ${fix.name}`);
      }
    }
    
    // Manual fixes for specific known issues
    if (filePath.includes('chaos-engineering.test.js')) {
      // Fix the specific issue with this file
      content = content.replace(/typeOf\./g, 'typeof ');
      content = content.replace(/\[key typeof result\.frontmatter\]/g, '[key]');
    }
    
    if (filePath.includes('semantic-swarm-integration.feature.spec.js')) {
      // Fix unicode escape issues
      content = content.replace(/\\u[0-9a-fA-F]{1,3}(?![0-9a-fA-F])/g, match => {
        return match.padEnd(6, '0');
      });
    }
    
    // Additional fixes for semicolon issues
    if (content.includes('Expected a semicolon')) {
      content = content.replace(/Expected a semicolon\./g, '');
    }
    
    // Fix broken destructuring patterns
    content = content.replace(/{\s*([^}:]*?):\s*[^}]*\s*}/g, '{ $1 }');
    
    // Only write if content changed
    if (content !== originalContent) {
      await fs.writeFile(filePath, content, 'utf8');
      console.log(`  ✅ Applied ${fixCount} syntax fixes to ${filePath}`);
      return fixCount;
    } else {
      console.log(`  ⚪ No syntax issues found in ${filePath}`);
      return 0;
    }
    
  } catch (error) {
    console.error(`  ❌ Failed to fix ${filePath}:`, error.message);
    return 0;
  }
}

async function fixJavaScriptSyntax() {
  try {
    console.log('🔧 Fixing JavaScript syntax errors in test files...\n');
    
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
        const fixes = await fixFile(file);
        totalFixes += fixes;
      }
    }
    
    console.log(`\n📊 Syntax Fix Summary:`);
    console.log(`   Total files processed: ${totalFiles}`);
    console.log(`   Total syntax fixes applied: ${totalFixes}`);
    
    if (totalFixes > 0) {
      console.log(`\n✅ Successfully fixed JavaScript syntax errors!`);
    } else {
      console.log(`\n✨ No syntax errors found - files are already clean!`);
    }
    
  } catch (error) {
    console.error('❌ Error during syntax fixing:', error.message);
    process.exit(1);
  }
}

// Run the syntax fixes
fixJavaScriptSyntax();