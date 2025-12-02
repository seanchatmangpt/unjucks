#!/usr/bin/env node

/**
 * Convert remaining TypeScript files to JavaScript
 * Remove type annotations and convert to .js extension
 */

import { promises as fs } from 'fs';
import { dirname, join, basename } from 'path';

const REMAINING_TS_FILES = [
  '/Users/sac/unjucks/packages/kgen-core/src/query/cache/QueryCache.ts',
  '/Users/sac/unjucks/packages/kgen-core/src/query/patterns/TriplePatternMatcher.ts',
  '/Users/sac/unjucks/packages/kgen-core/src/query/optimization/QueryOptimizer.ts',
  '/Users/sac/unjucks/packages/kgen-core/src/query/results/QueryResultFormatter.ts',
  '/Users/sac/unjucks/packages/kgen-core/src/query/templates/PreDefinedQueries.ts',
  '/Users/sac/unjucks/packages/kgen-core/src/validation/ArtifactRegenerationEngine.ts'
];

class TypeScriptConverter {
  constructor() {
    this.convertedFiles = [];
    this.errors = [];
  }

  async convertFile(tsPath) {
    try {
      console.log(`🔄 Converting ${basename(tsPath)}...`);
      
      // Read TypeScript content
      const tsContent = await fs.readFile(tsPath, 'utf-8');
      
      // Convert TypeScript to JavaScript (basic conversion)
      const jsContent = this.convertTypeScriptToJavaScript(tsContent);
      
      // Create JavaScript file path
      const jsPath = tsPath.replace('.ts', '.js');
      
      // Write JavaScript file
      await fs.writeFile(jsPath, jsContent);
      
      // Delete TypeScript file
      await fs.unlink(tsPath);
      
      this.convertedFiles.push({
        from: tsPath,
        to: jsPath
      });
      
      console.log(`✅ Converted: ${basename(tsPath)} → ${basename(jsPath)}`);
      
    } catch (error) {
      this.errors.push(`Failed to convert ${tsPath}: ${error.message}`);
      console.error(`❌ Error converting ${basename(tsPath)}: ${error.message}`);
    }
  }

  convertTypeScriptToJavaScript(content) {
    let jsContent = content;

    // Remove import type statements
    jsContent = jsContent.replace(/import\s+type\s+.*?from.*?;?\n/g, '');
    
    // Remove explicit return types from functions
    jsContent = jsContent.replace(/:\s*[^=>{}\n]+(\s*[=>{])/g, '$1');
    
    // Remove type annotations from parameters
    jsContent = jsContent.replace(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*[^,)=\n]+/g, '$1');
    
    // Remove interface declarations
    jsContent = jsContent.replace(/interface\s+[^{]*\{[^}]*\}/gs, '');
    
    // Remove type aliases
    jsContent = jsContent.replace(/type\s+[^=\n]+=[^;\n]+;?/g, '');
    
    // Remove generic type parameters
    jsContent = jsContent.replace(/<[^>]*>/g, '');
    
    // Remove 'as Type' assertions
    jsContent = jsContent.replace(/\s+as\s+[^;,)\]\n}]+/g, '');
    
    // Remove optional property indicators
    jsContent = jsContent.replace(/([a-zA-Z_$][a-zA-Z0-9_$]*)\?\s*:/g, '$1:');
    
    // Clean up extra whitespace and empty lines
    jsContent = jsContent.replace(/\n\n\n+/g, '\n\n');
    jsContent = jsContent.trim();
    
    // Add basic JSDoc header if not present
    if (!jsContent.includes('/**')) {
      jsContent = `/**\n * Converted from TypeScript\n */\n\n${jsContent}`;
    }

    return jsContent;
  }

  async run() {
    console.log('🔄 Converting remaining TypeScript files to JavaScript...');
    
    for (const tsFile of REMAINING_TS_FILES) {
      await this.convertFile(tsFile);
    }
    
    this.generateReport();
  }

  generateReport() {
    console.log('\n📋 CONVERSION REPORT');
    console.log('='.repeat(50));
    
    console.log(`\n✅ Successfully converted ${this.convertedFiles.length} files:`);
    this.convertedFiles.forEach(({ from, to }) => {
      console.log(`   • ${basename(from)} → ${basename(to)}`);
    });
    
    if (this.errors.length > 0) {
      console.log(`\n❌ Errors (${this.errors.length}):`);
      this.errors.forEach(error => {
        console.log(`   • ${error}`);
      });
    }
    
    console.log('\n🎉 TypeScript to JavaScript conversion complete!');
  }
}

const converter = new TypeScriptConverter();
converter.run();