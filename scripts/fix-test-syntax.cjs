#!/usr/bin/env node

/**
 * Fix TypeScript syntax in JavaScript test files
 * Removes type annotations from variable declarations
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all test JavaScript files
const testFiles = glob.sync('tests/**/*.js', { 
  ignore: ['**/node_modules/**']
});

console.log(`Found ${testFiles.length} test files to check`);

let fixedCount = 0;

testFiles.forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Fix TypeScript type annotations in variable declarations
    // Pattern: let/const variable: Type
    content = content.replace(/\b(let|const|var)\s+(\w+)\s*:\s*[A-Z]\w+(\<[^>]+\>)?(?=[;,\s])/g, '$1 $2');
    
    // Fix function parameter type annotations
    // Pattern: (param: Type) => or function(param: Type)
    content = content.replace(/(\w+)\s*:\s*[A-Z]\w+(\<[^>]+\>)?(?=\s*[,\)])/g, '$1');
    
    // Fix interface/type declarations (convert to comments)
    content = content.replace(/^(\s*)(interface|type)\s+(\w+).*$/gm, '$1// $2 $3 (TypeScript type removed)');
    
    // Fix import type statements
    content = content.replace(/import\s+type\s+\{([^}]+)\}\s+from/g, '// import type {$1} from');
    
    // Fix export type statements
    content = content.replace(/export\s+type\s+\{([^}]+)\}/g, '// export type {$1}');
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      console.log(`Fixed: ${filePath}`);
      fixedCount++;
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
});

console.log(`\nFixed ${fixedCount} files`);