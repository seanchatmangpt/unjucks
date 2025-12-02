#!/usr/bin/env node

/**
 * Verify kgen-core uses single JavaScript surface
 * Check for any remaining TypeScript references or inconsistencies
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { globSync } from 'glob';

const KGEN_CORE_ROOT = '/Users/sac/unjucks/packages/kgen-core';

class JavaScriptSurfaceVerifier {
  constructor() {
    this.issues = [];
    this.stats = {
      jsFiles: 0,
      tsFiles: 0,
      dtsFiles: 0,
      jsImports: 0,
      tsImports: 0
    };
  }

  async verify() {
    console.log('🔍 Verifying kgen-core JavaScript surface...');
    
    await this.checkFileExtensions();
    await this.checkImportStatements();
    await this.checkPackageJson();
    await this.generateReport();
  }

  async checkFileExtensions() {
    console.log('📁 Checking file extensions...');
    
    // Count JavaScript files
    const jsFiles = globSync(join(KGEN_CORE_ROOT, 'src/**/*.js'));
    this.stats.jsFiles = jsFiles.length;
    console.log(`   ✅ Found ${jsFiles.length} JavaScript files`);
    
    // Check for TypeScript files (excluding node_modules)
    const tsFiles = globSync(join(KGEN_CORE_ROOT, 'src/**/*.ts'), {
      ignore: ['**/node_modules/**']
    });
    this.stats.tsFiles = tsFiles.length;
    
    if (tsFiles.length > 0) {
      this.issues.push(`Found ${tsFiles.length} TypeScript files in src/`);
      tsFiles.forEach(file => {
        this.issues.push(`  - ${file.replace(KGEN_CORE_ROOT, '')}`);
      });
    } else {
      console.log('   ✅ No TypeScript files found in src/');
    }
    
    // Check for .d.ts files in dist/
    const dtsFiles = globSync(join(KGEN_CORE_ROOT, 'dist/**/*.d.ts'));
    this.stats.dtsFiles = dtsFiles.length;
    
    if (dtsFiles.length > 0) {
      this.issues.push(`Found ${dtsFiles.length} .d.ts files in dist/`);
      console.log(`   ⚠️  Found ${dtsFiles.length} .d.ts files (should be 0)`);
    } else {
      console.log('   ✅ No .d.ts files found in dist/');
    }
  }

  async checkImportStatements() {
    console.log('🔗 Checking import statements...');
    
    const jsFiles = globSync(join(KGEN_CORE_ROOT, 'src/**/*.js'));
    let jsImports = 0;
    let tsImports = 0;
    
    for (const file of jsFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');
        
        for (const line of lines) {
          // Check for imports from .ts files
          if (line.includes('from ') && line.includes('.ts')) {
            tsImports++;
            this.issues.push(`TypeScript import in ${file.replace(KGEN_CORE_ROOT, '')}: ${line.trim()}`);
          }
          
          // Count JS imports
          if (line.includes('from ') && line.includes('.js')) {
            jsImports++;
          }
        }
      } catch (error) {
        this.issues.push(`Error reading ${file}: ${error.message}`);
      }
    }
    
    this.stats.jsImports = jsImports;
    this.stats.tsImports = tsImports;
    
    console.log(`   ✅ Found ${jsImports} JavaScript imports`);
    if (tsImports > 0) {
      console.log(`   ⚠️  Found ${tsImports} TypeScript imports (should be 0)`);
    } else {
      console.log('   ✅ No TypeScript imports found');
    }
  }

  async checkPackageJson() {
    console.log('📦 Checking package.json...');
    
    try {
      const packagePath = join(KGEN_CORE_ROOT, 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf-8');
      const packageJson = JSON.parse(packageContent);
      
      // Check main entry point
      if (packageJson.main && packageJson.main.endsWith('.ts')) {
        this.issues.push(`package.json main points to TypeScript file: ${packageJson.main}`);
      }
      
      // Check exports
      if (packageJson.exports) {
        const exportsStr = JSON.stringify(packageJson.exports);
        if (exportsStr.includes('.ts')) {
          this.issues.push('package.json exports contain TypeScript references');
        }
      }
      
      // Check scripts for TypeScript compilation
      if (packageJson.scripts) {
        for (const [name, script] of Object.entries(packageJson.scripts)) {
          if (script.includes('tsc') || script.includes('typescript')) {
            console.log(`   ℹ️  Script "${name}" contains TypeScript tooling: ${script}`);
          }
        }
      }
      
      console.log('   ✅ package.json checked');
      
    } catch (error) {
      this.issues.push(`Error reading package.json: ${error.message}`);
    }
  }

  async generateReport() {
    console.log('\n📋 VERIFICATION REPORT');
    console.log('='.repeat(60));
    
    console.log('\n📊 Statistics:');
    console.log(`   • JavaScript files: ${this.stats.jsFiles}`);
    console.log(`   • TypeScript files: ${this.stats.tsFiles}`);
    console.log(`   • .d.ts files: ${this.stats.dtsFiles}`);
    console.log(`   • JavaScript imports: ${this.stats.jsImports}`);
    console.log(`   • TypeScript imports: ${this.stats.tsImports}`);
    
    if (this.issues.length === 0) {
      console.log('\n🎉 VERIFICATION PASSED');
      console.log('   ✅ kgen-core successfully consolidated to single JavaScript surface');
      console.log('   ✅ No TypeScript duplicates found');
      console.log('   ✅ No build artifacts remaining');
      console.log('   ✅ All imports use JavaScript extensions');
    } else {
      console.log(`\n⚠️  VERIFICATION ISSUES (${this.issues.length}):`);
      this.issues.forEach(issue => {
        console.log(`   • ${issue}`);
      });
      console.log('\nSome issues may need manual review or fixing.');
    }
    
    // Save verification report
    const reportPath = join(KGEN_CORE_ROOT, 'js-surface-verification.json');
    const report = {
      timestamp: new Date().toISOString(),
      passed: this.issues.length === 0,
      statistics: this.stats,
      issues: this.issues
    };
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Verification report saved to: js-surface-verification.json`);
  }
}

const verifier = new JavaScriptSurfaceVerifier();
verifier.verify();