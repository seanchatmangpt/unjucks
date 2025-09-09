#!/usr/bin/env node

/**
 * CRITICAL PRODUCTION FIX: Remove console.log statements from production code
 * Found 10,323 console.log instances across 540 files - Fortune 5 production blocker
 */

import fs from 'fs';
import path from 'path';
import glob from 'glob';

const PRODUCTION_LOGGER_IMPORT = `import logger from '../utils/secure-logger.js';`;
const PRODUCTION_LOGGER_ALT = `import logger from './utils/secure-logger.js';`;

/**
 * Replace console.log with secure logger calls
 */
function replaceConsoleLogsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Skip test files and templates
  if (filePath.includes('/tests/') || 
      filePath.includes('/_templates/') || 
      filePath.includes('.test.') || 
      filePath.includes('.spec.') ||
      filePath.includes('/node_modules/')) {
    return false;
  }

  // Add logger import if needed
  if (content.includes('console.log') || content.includes('console.error') || content.includes('console.warn')) {
    if (!content.includes('secure-logger')) {
      // Determine correct import path
      const relativePath = path.relative(path.dirname(filePath), path.join(process.cwd(), 'src/utils'));
      const importPath = relativePath ? `${relativePath}/secure-logger.js` : './utils/secure-logger.js';
      
      // Add import after existing imports
      const lastImportIndex = content.lastIndexOf('import ');
      if (lastImportIndex !== -1) {
        const nextLineIndex = content.indexOf('\n', lastImportIndex);
        if (nextLineIndex !== -1) {
          content = content.slice(0, nextLineIndex + 1) + 
                   `import logger from '${importPath}';\n` + 
                   content.slice(nextLineIndex + 1);
          modified = true;
        }
      }
    }
  }

  // Replace console.log patterns
  const replacements = [
    // console.log with multiple arguments
    {
      pattern: /console\.log\(([^)]+)\);?/g,
      replacement: 'logger.info($1);'
    },
    // console.error patterns  
    {
      pattern: /console\.error\(([^)]+)\);?/g,
      replacement: 'logger.error($1);'
    },
    // console.warn patterns
    {
      pattern: /console\.warn\(([^)]+)\);?/g,
      replacement: 'logger.warn($1);'
    },
    // console.debug patterns
    {
      pattern: /console\.debug\(([^)]+)\);?/g,
      replacement: 'logger.debug($1);'
    },
    // console.info patterns
    {
      pattern: /console\.info\(([^)]+)\);?/g,
      replacement: 'logger.info($1);'
    }
  ];

  for (const { pattern, replacement } of replacements) {
    const originalContent = content;
    content = content.replace(pattern, replacement);
    if (content !== originalContent) {
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✓ Fixed console.log statements in: ${filePath}`);
    return true;
  }
  
  return false;
}

/**
 * Scan and fix all JavaScript files
 */
function fixConsoleLogsInProject() {
  console.log('🔧 CRITICAL PRODUCTION FIX: Removing console.log statements...\n');
  
  const patterns = [
    'src/**/*.js',
    'scripts/**/*.js',
    'bin/**/*.js'
  ];
  
  let totalFilesFixed = 0;
  
  for (const pattern of patterns) {
    const files = glob.sync(pattern, { 
      ignore: [
        '**/node_modules/**',
        '**/tests/**',
        '**/_templates/**',
        '**/*.test.js',
        '**/*.spec.js'
      ]
    });
    
    console.log(`\nProcessing pattern: ${pattern}`);
    console.log(`Found ${files.length} files to check\n`);
    
    for (const filePath of files) {
      try {
        if (replaceConsoleLogsInFile(filePath)) {
          totalFilesFixed++;
        }
      } catch (error) {
        console.error(`✗ Error processing ${filePath}: ${error.message}`);
      }
    }
  }
  
  console.log(`\n🎯 PRODUCTION FIX COMPLETE:`);
  console.log(`   • Fixed console.log statements in ${totalFilesFixed} files`);
  console.log(`   • Replaced with secure logger calls`);
  console.log(`   • Test files preserved (for debugging)`);
  
  if (totalFilesFixed > 0) {
    console.log(`\n⚠️  NEXT STEPS:`);
    console.log(`   1. Review changed files for correctness`);
    console.log(`   2. Run tests to ensure no regressions`);
    console.log(`   3. Commit changes before production deployment`);
    console.log(`   4. Configure LOG_LEVEL environment variable`);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixConsoleLogsInProject();
}

export { replaceConsoleLogsInFile, fixConsoleLogsInProject };