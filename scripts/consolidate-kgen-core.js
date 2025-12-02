#!/usr/bin/env node

/**
 * Consolidate kgen-core to single JavaScript surface
 * Remove TypeScript duplicates and build artifacts
 */

import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, relative } from 'path';
import { globSync } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const KGEN_CORE_ROOT = join(__dirname, '..', 'packages', 'kgen-core');

class KgenConsolidator {
  constructor() {
    this.duplicateMap = new Map();
    this.deletedFiles = [];
    this.preservedFiles = [];
    this.errors = [];
  }

  async run() {
    console.log('🔍 Analyzing kgen-core file structure...');
    
    try {
      await this.analyzeStructure();
      await this.identifyDuplicates();
      await this.removeTypeScriptDuplicates();
      await this.removeBuildArtifacts();
      await this.generateReport();
    } catch (error) {
      console.error('❌ Error during consolidation:', error);
      process.exit(1);
    }
  }

  async analyzeStructure() {
    // Find all TypeScript and JavaScript files in src/
    const srcPattern = join(KGEN_CORE_ROOT, 'src/**/*.{ts,js}');
    const srcFiles = globSync(srcPattern, {
      ignore: ['**/node_modules/**']
    });

    console.log(`📁 Found ${srcFiles.length} source files`);
    
    // Categorize files
    for (const file of srcFiles) {
      const relativePath = relative(KGEN_CORE_ROOT, file);
      const ext = file.endsWith('.ts') ? 'ts' : 'js';
      const basePath = file.replace(/\.(ts|js)$/, '');
      
      if (!this.duplicateMap.has(basePath)) {
        this.duplicateMap.set(basePath, { ts: null, js: null });
      }
      
      this.duplicateMap.get(basePath)[ext] = {
        fullPath: file,
        relativePath: relativePath
      };
    }
  }

  async identifyDuplicates() {
    console.log('🔍 Identifying TypeScript/JavaScript duplicates...');
    
    let duplicateCount = 0;
    let tsOnlyCount = 0;
    let jsOnlyCount = 0;

    for (const [basePath, files] of this.duplicateMap) {
      if (files.ts && files.js) {
        duplicateCount++;
        console.log(`📋 Duplicate found: ${files.ts.relativePath} + ${files.js.relativePath}`);
      } else if (files.ts && !files.js) {
        tsOnlyCount++;
      } else if (files.js && !files.ts) {
        jsOnlyCount++;
      }
    }

    console.log(`📊 Analysis complete:`);
    console.log(`   • ${duplicateCount} TypeScript/JavaScript duplicates`);
    console.log(`   • ${tsOnlyCount} TypeScript-only files`);
    console.log(`   • ${jsOnlyCount} JavaScript-only files`);
  }

  async removeTypeScriptDuplicates() {
    console.log('🗑️  Removing TypeScript duplicates (keeping JavaScript)...');
    
    for (const [basePath, files] of this.duplicateMap) {
      if (files.ts && files.js) {
        try {
          // Verify JS file exists before deleting TS
          const jsExists = await this.fileExists(files.js.fullPath);
          if (jsExists) {
            await fs.unlink(files.ts.fullPath);
            this.deletedFiles.push(files.ts.relativePath);
            this.preservedFiles.push(files.js.relativePath);
            console.log(`✅ Deleted: ${files.ts.relativePath}`);
            console.log(`✅ Kept: ${files.js.relativePath}`);
          } else {
            this.errors.push(`JS file missing for ${files.ts.relativePath}`);
          }
        } catch (error) {
          this.errors.push(`Failed to delete ${files.ts.relativePath}: ${error.message}`);
        }
      }
    }
  }

  async removeBuildArtifacts() {
    console.log('🗑️  Removing build artifacts (.d.ts files)...');
    
    const distPattern = join(KGEN_CORE_ROOT, 'dist/**/*.d.ts');
    const dtsFiles = globSync(distPattern);
    
    console.log(`📁 Found ${dtsFiles.length} .d.ts files to remove`);
    
    for (const file of dtsFiles) {
      try {
        await fs.unlink(file);
        const relativePath = relative(KGEN_CORE_ROOT, file);
        this.deletedFiles.push(relativePath);
        console.log(`✅ Deleted: ${relativePath}`);
      } catch (error) {
        this.errors.push(`Failed to delete ${file}: ${error.message}`);
      }
    }
  }

  async fileExists(path) {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async generateReport() {
    console.log('\n📋 CONSOLIDATION REPORT');
    console.log('='.repeat(50));
    
    console.log(`\n✅ Successfully deleted ${this.deletedFiles.length} files:`);
    this.deletedFiles.slice(0, 10).forEach(file => {
      console.log(`   • ${file}`);
    });
    if (this.deletedFiles.length > 10) {
      console.log(`   ... and ${this.deletedFiles.length - 10} more`);
    }
    
    console.log(`\n💾 Preserved ${this.preservedFiles.length} JavaScript files`);
    
    if (this.errors.length > 0) {
      console.log(`\n❌ Errors encountered (${this.errors.length}):`);
      this.errors.forEach(error => {
        console.log(`   • ${error}`);
      });
    }
    
    // Save detailed report
    const reportPath = join(KGEN_CORE_ROOT, 'consolidation-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      deletedFiles: this.deletedFiles,
      preservedFiles: this.preservedFiles,
      errors: this.errors,
      summary: {
        totalDeleted: this.deletedFiles.length,
        totalPreserved: this.preservedFiles.length,
        totalErrors: this.errors.length
      }
    };
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${relative(process.cwd(), reportPath)}`);
    
    console.log('\n🎉 Consolidation complete!');
    console.log('   kgen-core now uses single JavaScript surface');
  }
}

// Specific target files mentioned in requirements
const KNOWN_DUPLICATES = [
  'packages/kgen-core/src/query/index.ts',
  'packages/kgen-core/src/query/types/index.ts'
];

console.log('🚀 Starting kgen-core consolidation...');
console.log('Target: Remove TypeScript duplicates, keep JavaScript surface');

const consolidator = new KgenConsolidator();
consolidator.run();