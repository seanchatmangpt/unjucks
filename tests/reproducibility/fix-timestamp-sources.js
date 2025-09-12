#!/usr/bin/env node

/**
 * Timestamp Source Fixer
 * 
 * This script identifies and fixes all sources of non-deterministic timestamps
 * in the KGEN codebase to ensure reproducible builds.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

class TimestampFixer {
  constructor() {
    this.results = {
      timestamp: this.getDeterministicDate().toISOString(),
      scannedFiles: 0,
      issuesFound: 0,
      issuesFixed: 0,
      issues: [],
      summary: {
        dateNowCalls: 0,
        newDateCalls: 0,
        timestampStrings: 0,
        lockFileIssues: 0
      }
    };
  }

  /**
   * Find all problematic timestamp usage in codebase
   */
  scanForTimestampIssues() {
    console.log('🔍 Scanning for non-deterministic timestamp usage...');
    
    const codeFiles = this.findCodeFiles(process.cwd());
    
    for (const filePath of codeFiles) {
      this.scanFile(filePath);
    }
    
    // Special handling for kgen.lock.json
    this.scanLockFile();
    
    console.log(`\n📊 Scan Results:`);
    console.log(`  - Files scanned: ${this.results.scannedFiles}`);
    console.log(`  - Issues found: ${this.results.issuesFound}`);
    console.log(`  - this.getDeterministicTimestamp() calls: ${this.results.summary.dateNowCalls}`);
    console.log(`  - this.getDeterministicDate() calls: ${this.results.summary.newDateCalls}`);
    console.log(`  - Timestamp strings: ${this.results.summary.timestampStrings}`);
    console.log(`  - Lock file issues: ${this.results.summary.lockFileIssues}`);
  }

  /**
   * Find all code files to scan
   */
  findCodeFiles(dir, files = []) {
    const skipDirs = ['node_modules', '.git', 'generated', 'dist', 'build'];
    const codeExtensions = ['.js', '.mjs', '.ts', '.json'];
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (!skipDirs.includes(entry.name)) {
            this.findCodeFiles(fullPath, files);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (codeExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read directory ${dir}: ${error.message}`);
    }
    
    return files;
  }

  /**
   * Scan individual file for timestamp issues
   */
  scanFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      this.results.scannedFiles++;
      
      const lines = content.split('\n');
      const relativePath = path.relative(process.cwd(), filePath);
      
      lines.forEach((line, index) => {
        const lineNumber = index + 1;
        
        // Look for this.getDeterministicTimestamp() calls
        if (line.includes('this.getDeterministicTimestamp()')) {
          this.addIssue({
            type: 'date_now',
            file: relativePath,
            line: lineNumber,
            content: line.trim(),
            severity: 'high',
            description: 'this.getDeterministicTimestamp() call creates non-deterministic timestamp'
          });
          this.results.summary.dateNowCalls++;
        }
        
        // Look for this.getDeterministicDate() calls without fixed timestamp
        const newDateMatches = line.match(/new Date\([^)]*\)/g);
        if (newDateMatches) {
          newDateMatches.forEach(match => {
            // Skip if it's already using a fixed timestamp
            if (!match.includes('SOURCE_DATE_EPOCH') && match === 'this.getDeterministicDate()') {
              this.addIssue({
                type: 'new_date',
                file: relativePath,
                line: lineNumber,
                content: line.trim(),
                severity: 'high',
                description: 'this.getDeterministicDate() without fixed timestamp creates non-deterministic timestamp'
              });
              this.results.summary.newDateCalls++;
            }
          });
        }
        
        // Look for timestamp-related strings
        if (line.includes('timestamp') && 
            (line.includes('toISOString') || line.includes('toJSON'))) {
          this.addIssue({
            type: 'timestamp_string',
            file: relativePath,
            line: lineNumber,
            content: line.trim(),
            severity: 'medium',
            description: 'Timestamp string generation may be non-deterministic'
          });
          this.results.summary.timestampStrings++;
        }
      });
      
    } catch (error) {
      console.warn(`Warning: Could not read file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Special scan for kgen.lock.json issues
   */
  scanLockFile() {
    const lockPath = path.join(process.cwd(), 'kgen.lock.json');
    
    if (fs.existsSync(lockPath)) {
      try {
        const lockContent = fs.readFileSync(lockPath, 'utf8');
        const lockData = JSON.parse(lockContent);
        
        // Check if timestamp exists and is dynamic
        if (lockData.timestamp) {
          this.addIssue({
            type: 'lock_timestamp',
            file: 'kgen.lock.json',
            line: 3,
            content: `"timestamp": "${lockData.timestamp}"`,
            severity: 'critical',
            description: 'Lock file contains non-deterministic timestamp'
          });
          this.results.summary.lockFileIssues++;
        }
        
        // Check for file modification timestamps
        if (lockData.files) {
          Object.entries(lockData.files).forEach(([fileName, fileInfo]) => {
            if (fileInfo.modified) {
              this.addIssue({
                type: 'lock_file_modified',
                file: 'kgen.lock.json',
                line: 0,
                content: `${fileName}: modified timestamp`,
                severity: 'high',
                description: 'Lock file contains file modification timestamps'
              });
              this.results.summary.lockFileIssues++;
            }
          });
        }
        
      } catch (error) {
        console.warn(`Warning: Could not parse kgen.lock.json: ${error.message}`);
      }
    }
  }

  /**
   * Add an issue to the results
   */
  addIssue(issue) {
    this.results.issues.push(issue);
    this.results.issuesFound++;
  }

  /**
   * Apply fixes to make timestamps deterministic
   */
  async applyFixes() {
    console.log('\n🔧 Applying fixes for non-deterministic timestamps...');
    
    const fixesByFile = {};
    
    // Group fixes by file
    this.results.issues.forEach(issue => {
      if (!fixesByFile[issue.file]) {
        fixesByFile[issue.file] = [];
      }
      fixesByFile[issue.file].push(issue);
    });
    
    // Apply fixes file by file
    for (const [filePath, issues] of Object.entries(fixesByFile)) {
      await this.fixFile(filePath, issues);
    }
    
    console.log(`\n✅ Applied fixes: ${this.results.issuesFixed}/${this.results.issuesFound}`);
  }

  /**
   * Fix issues in a specific file
   */
  async fixFile(relativePath, issues) {
    const fullPath = path.join(process.cwd(), relativePath);
    
    if (!fs.existsSync(fullPath)) {
      console.warn(`Warning: File not found: ${fullPath}`);
      return;
    }
    
    try {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;
      
      for (const issue of issues) {
        const fixed = this.applyFixToContent(content, issue);
        if (fixed.success) {
          content = fixed.content;
          modified = true;
          this.results.issuesFixed++;
          console.log(`  ✓ Fixed ${issue.type} in ${relativePath}:${issue.line}`);
        }
      }
      
      if (modified) {
        // Create backup
        const backupPath = `${fullPath}.backup-${this.getDeterministicTimestamp()}`;
        fs.writeFileSync(backupPath, fs.readFileSync(fullPath));
        
        // Write fixed content
        fs.writeFileSync(fullPath, content);
        
        console.log(`  💾 Updated ${relativePath} (backup: ${path.basename(backupPath)})`);
      }
      
    } catch (error) {
      console.error(`  ❌ Failed to fix ${relativePath}: ${error.message}`);
    }
  }

  /**
   * Apply specific fix to content
   */
  applyFixToContent(content, issue) {
    let newContent = content;
    let success = false;
    
    switch (issue.type) {
      case 'date_now':
        // Replace this.getDeterministicTimestamp() with deterministic timestamp
        newContent = newContent.replace(
          /Date\.now\(\)/g,
          'this.getDeterministicTimestamp()'
        );
        success = true;
        break;
        
      case 'new_date':
        // Replace this.getDeterministicDate() with deterministic date
        newContent = newContent.replace(
          /new Date\(\)/g,
          'this.getDeterministicDate()'
        );
        success = true;
        break;
        
      case 'lock_timestamp':
        // Remove timestamp from lock file
        if (issue.file === 'kgen.lock.json') {
          try {
            const lockData = JSON.parse(content);
            delete lockData.timestamp;
            newContent = JSON.stringify(lockData, null, 2);
            success = true;
          } catch (e) {
            console.warn('Could not parse lock file for timestamp removal');
          }
        }
        break;
        
      case 'lock_file_modified':
        // Remove modified timestamps from lock file
        if (issue.file === 'kgen.lock.json') {
          try {
            const lockData = JSON.parse(content);
            if (lockData.files) {
              Object.values(lockData.files).forEach(fileInfo => {
                delete fileInfo.modified;
              });
            }
            newContent = JSON.stringify(lockData, null, 2);
            success = true;
          } catch (e) {
            console.warn('Could not parse lock file for modified timestamp removal');
          }
        }
        break;
    }
    
    return { success, content: newContent };
  }

  /**
   * Create deterministic timestamp helper functions
   */
  createTimestampHelpers() {
    console.log('\n📝 Creating deterministic timestamp helper functions...');
    
    const helpersPath = path.join(process.cwd(), 'src/utils/deterministic-time.js');
    
    // Ensure directory exists
    fs.mkdirSync(path.dirname(helpersPath), { recursive: true });
    
    const helpersContent = `/**
 * Deterministic Timestamp Utilities
 * 
 * Provides deterministic timestamps for reproducible builds
 */

/**
 * Get deterministic timestamp (milliseconds)
 * Uses SOURCE_DATE_EPOCH if set, otherwise a fixed timestamp
 */
export function getDeterministicTimestamp() {
  const sourceEpoch = process.env.SOURCE_DATE_EPOCH;
  
  if (sourceEpoch) {
    return parseInt(sourceEpoch) * 1000;
  }
  
  // Default to 2024-01-01T00:00:00.000Z for reproducible builds
  return 1704067200000;
}

/**
 * Get deterministic Date object
 * Uses SOURCE_DATE_EPOCH if set, otherwise a fixed date
 */
export function getDeterministicDate() {
  return new Date(getDeterministicTimestamp());
}

/**
 * Get deterministic ISO string
 * Uses SOURCE_DATE_EPOCH if set, otherwise a fixed date string
 */
export function getDeterministicISOString() {
  return getDeterministicDate().toISOString();
}

/**
 * Create timestamp that respects SOURCE_DATE_EPOCH for reproducible builds
 */
export function getReproducibleTimestamp() {
  const sourceEpoch = process.env.SOURCE_DATE_EPOCH;
  
  if (sourceEpoch) {
    return new Date(parseInt(sourceEpoch) * 1000).toISOString();
  }
  
  // In production, use current time
  // In tests/builds with SOURCE_DATE_EPOCH, use fixed time
  return this.getDeterministicDate().toISOString();
}

/**
 * Get build-time timestamp that's deterministic in CI but current in dev
 */
export function getBuildTimestamp() {
  // Check if we're in a build environment
  if (process.env.CI || process.env.NODE_ENV === 'production' || process.env.SOURCE_DATE_EPOCH) {
    return getDeterministicISOString();
  }
  
  // In development, use current timestamp
  return this.getDeterministicDate().toISOString();
}
`;
    
    fs.writeFileSync(helpersPath, helpersContent);
    console.log(`  ✓ Created ${path.relative(process.cwd(), helpersPath)}`);
    
    // Create mixin for classes
    const mixinPath = path.join(process.cwd(), 'src/utils/deterministic-time-mixin.js');
    
    const mixinContent = `/**
 * Deterministic Time Mixin
 * 
 * Mixin to add deterministic timestamp methods to classes
 */

import { getDeterministicTimestamp, getDeterministicDate, getDeterministicISOString } from './deterministic-time.js';

export const DeterministicTimeMixin = {
  /**
   * Get deterministic timestamp (replaces this.getDeterministicTimestamp())
   */
  getDeterministicTimestamp() {
    return getDeterministicTimestamp();
  },
  
  /**
   * Get deterministic Date object (replaces this.getDeterministicDate())
   */
  getDeterministicDate() {
    return getDeterministicDate();
  },
  
  /**
   * Get deterministic ISO string
   */
  getDeterministicISOString() {
    return getDeterministicISOString();
  }
};

/**
 * Apply deterministic time mixin to a class
 */
export function withDeterministicTime(BaseClass) {
  return class extends BaseClass {
    getDeterministicTimestamp() {
      return getDeterministicTimestamp();
    }
    
    getDeterministicDate() {
      return getDeterministicDate();
    }
    
    getDeterministicISOString() {
      return getDeterministicISOString();
    }
  };
}
`;
    
    fs.writeFileSync(mixinPath, mixinContent);
    console.log(`  ✓ Created ${path.relative(process.cwd(), mixinPath)}`);
    
    return { helpersPath, mixinPath };
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    const reportPath = path.join(process.cwd(), 'tests/reproducibility/timestamp-fix-report.json');
    
    // Ensure directory exists
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    
    // Write detailed JSON report
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    
    // Generate human-readable summary
    const summaryPath = path.join(process.cwd(), 'tests/reproducibility/timestamp-fix-summary.md');
    const summary = this.generateMarkdownSummary();
    fs.writeFileSync(summaryPath, summary);
    
    console.log(`\n📄 Reports generated:`);
    console.log(`  - Detailed: ${path.relative(process.cwd(), reportPath)}`);
    console.log(`  - Summary: ${path.relative(process.cwd(), summaryPath)}`);
    
    return { reportPath, summaryPath };
  }

  /**
   * Generate markdown summary
   */
  generateMarkdownSummary() {
    const { summary, issuesFound, issuesFixed } = this.results;
    
    return `# Timestamp Fix Report

## Summary

**Total Issues Found**: ${issuesFound}
**Issues Fixed**: ${issuesFixed}
**Fix Success Rate**: ${Math.round((issuesFixed / issuesFound) * 100)}%

## Issue Breakdown

- **this.getDeterministicTimestamp() calls**: ${summary.dateNowCalls}
- **this.getDeterministicDate() calls**: ${summary.newDateCalls}
- **Timestamp strings**: ${summary.timestampStrings}
- **Lock file issues**: ${summary.lockFileIssues}

## Critical Issues

${this.results.issues
  .filter(i => i.severity === 'critical')
  .map(i => `- **${i.file}:${i.line}** - ${i.description}`)
  .join('\n') || 'None found'}

## High Priority Issues

${this.results.issues
  .filter(i => i.severity === 'high')
  .map(i => `- **${i.file}:${i.line}** - ${i.description}`)
  .join('\n') || 'None found'}

## Applied Fixes

### 1. Deterministic Timestamp Helpers

Created utility functions to replace non-deterministic timestamp calls:

\`\`\`javascript
// Before
const timestamp = this.getDeterministicTimestamp();
const date = this.getDeterministicDate();

// After  
const timestamp = this.getDeterministicTimestamp();
const date = this.getDeterministicDate();
\`\`\`

### 2. Lock File Cleanup

Removed dynamic timestamps from kgen.lock.json:
- Removed top-level timestamp field
- Removed file modification timestamps
- Kept only content hashes and sizes for reproducibility

### 3. Environment Variable Support

All timestamp functions now respect \`SOURCE_DATE_EPOCH\` for reproducible builds:

\`\`\`bash
# For reproducible builds
export SOURCE_DATE_EPOCH=1704067200  # 2024-01-01T00:00:00Z

# Build will now be deterministic
npm run build
\`\`\`

## Usage Instructions

### For Developers

1. Import deterministic time utilities:
   \`\`\`javascript
   import { getDeterministicTimestamp, getDeterministicDate } from './src/utils/deterministic-time.js';
   \`\`\`

2. Use in classes with mixin:
   \`\`\`javascript
   import { withDeterministicTime } from './src/utils/deterministic-time-mixin.js';
   
   class MyClass extends withDeterministicTime(BaseClass) {
     generateTimestamp() {
       return this.getDeterministicTimestamp();
     }
   }
   \`\`\`

### For CI/CD

Set SOURCE_DATE_EPOCH for reproducible builds:

\`\`\`yaml
env:
  SOURCE_DATE_EPOCH: 1704067200
\`\`\`

## Verification

Run the reproducibility test suite to verify fixes:

\`\`\`bash
node tests/reproducibility/test-build-reproducibility.js
\`\`\`

---
*Generated by KGEN Timestamp Fixer - ${this.results.timestamp}*
`;
  }

  /**
   * Run complete fix process
   */
  async run() {
    console.log('🛠️  KGEN Timestamp Fixer');
    console.log('========================');
    
    // Scan for issues
    this.scanForTimestampIssues();
    
    if (this.results.issuesFound === 0) {
      console.log('\n✅ No timestamp issues found! Build should be reproducible.');
      return this.results;
    }
    
    // Create helper functions
    this.createTimestampHelpers();
    
    // Apply fixes
    await this.applyFixes();
    
    // Generate report
    this.generateReport();
    
    console.log('\n🎉 Timestamp fixing complete!');
    console.log(`\nNext steps:`);
    console.log(`1. Review the generated report`);
    console.log(`2. Test builds with: SOURCE_DATE_EPOCH=1704067200 npm run build`);
    console.log(`3. Run reproducibility test: node tests/reproducibility/test-build-reproducibility.js`);
    
    return this.results;
  }
}

// Run the fixer if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const fixer = new TimestampFixer();
  
  fixer.run()
    .then(results => {
      console.log(`\n📊 FINAL SUMMARY`);
      console.log(`================`);
      console.log(`Issues found: ${results.issuesFound}`);
      console.log(`Issues fixed: ${results.issuesFixed}`);
      
      if (results.issuesFixed < results.issuesFound) {
        console.log(`\n⚠️  Some issues could not be automatically fixed.`);
        console.log(`Review the report for manual fixes needed.`);
        process.exit(1);
      }
      
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Timestamp fixer failed:', error);
      process.exit(1);
    });
}

export { TimestampFixer };