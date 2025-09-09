#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';

const projectRoot = process.cwd();

// Patterns to convert
const patterns = [
  'tests/**/*.test.ts',
  'tests/**/*.spec.ts',
  '_templates/**/*.test.ts',
  '_templates/**/*.spec.ts'
];

// TypeScript-specific patterns to remove or modify
const conversions = [
  // Remove TypeScript type annotations from variable declarations
  {
    pattern: /:\s*([A-Za-z_$][A-Za-z0-9_$]*(?:<.*?>)?(\[\])?\s*=)/g,
    replacement: ' ='
  },
  // Remove TypeScript type annotations from function parameters  
  {
    pattern: /(\w+)\s*:\s*[A-Za-z_$][A-Za-z0-9_$]*(?:<.*?>)?(\s*[,\)])/g,
    replacement: '$1$2'
  },
  // Remove TypeScript return type annotations
  {
    pattern: /\):\s*[A-Za-z_$][A-Za-z0-9_$]*(?:<.*?>)?(\s*[{=])/g,
    replacement: ')$1'
  },
  // Remove explicit type assertions
  {
    pattern: /\s+as\s+[A-Za-z_$][A-Za-z0-9_$]*(?:<.*?>)?/g,
    replacement: ''
  },
  // Remove TypeScript interface declarations in tests (if any)
  {
    pattern: /interface\s+\w+\s*\{[^}]*\}\s*/g,
    replacement: ''
  },
  // Remove type imports
  {
    pattern: /import\s+type\s+\{[^}]*\}\s+from\s+['""][^'"]*['""];\s*/g,
    replacement: ''
  },
  // Update import extensions from .ts to .js
  {
    pattern: /from\s+['"]([^'"]*?)\.ts['"]/g,
    replacement: "from '$1.js'"
  },
  // Update relative path imports to include .js extension
  {
    pattern: /from\s+['"](\.[^'"]*?)(?<!\.js)['"]/g,
    replacement: "from '$1.js'"
  }
];

async function convertFile(filePath) {
  try {
    console.log(`Converting ${filePath}...`);
    
    let content = await fs.readFile(filePath, 'utf8');
    const originalContent = content;
    
    // Apply all conversions
    for (const conversion of conversions) {
      content = content.replace(conversion.pattern, conversion.replacement);
    }
    
    // Only write if content changed significantly
    const newPath = filePath.replace(/\.ts$/, '.js');
    
    // Write the converted file
    await fs.writeFile(newPath, content, 'utf8');
    
    console.log(`✓ Converted ${filePath} -> ${newPath}`);
    
    // Remove the original TypeScript file after successful conversion
    if (newPath !== filePath) {
      await fs.remove(filePath);
      console.log(`✓ Removed original ${filePath}`);
    }
    
    return true;
  } catch (error) {
    console.error(`✗ Failed to convert ${filePath}:`, error.message);
    return false;
  }
}

async function convertTests() {
  try {
    console.log('🔄 Converting TypeScript test files to JavaScript...\n');
    
    let totalFiles = 0;
    let convertedFiles = 0;
    
    for (const pattern of patterns) {
      const files = await glob(pattern, { 
        cwd: projectRoot,
        absolute: true,
        ignore: ['node_modules/**', 'dist/**']
      });
      
      console.log(`Found ${files.length} files matching pattern: ${pattern}`);
      totalFiles += files.length;
      
      for (const file of files) {
        const success = await convertFile(file);
        if (success) {
          convertedFiles++;
        }
      }
    }
    
    console.log(`\n📊 Conversion Summary:`);
    console.log(`   Total files found: ${totalFiles}`);
    console.log(`   Successfully converted: ${convertedFiles}`);
    console.log(`   Failed conversions: ${totalFiles - convertedFiles}`);
    
    if (convertedFiles === totalFiles) {
      console.log(`\n✅ All TypeScript test files have been converted to JavaScript!`);
    } else {
      console.log(`\n⚠️  Some files failed to convert. Please review the errors above.`);
    }
    
  } catch (error) {
    console.error('❌ Error during conversion:', error.message);
    process.exit(1);
  }
}

// Run the conversion
convertTests();