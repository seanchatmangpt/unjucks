#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LIB_DIR = path.join(__dirname, '..', 'src', 'lib');

/**
 * Simple TypeScript to JavaScript converter
 */
class TypeScriptToJavaScriptConverter {
  constructor() {
    this.processedFiles = [];
    this.skippedFiles = [];
  }

  /**
   * Convert TypeScript type annotations to JSDoc comments
   */
  convertToJavaScript(content, filename) {
    let result = content;

    // Remove type imports
    result = result.replace(/^import type \{[^}]*\} from [^;]+;?$/gm, '');
    
    // Convert export interface to JSDoc typedef
    result = result.replace(/export interface (\w+) \{([^}]+)\}/gs, (match, name, body) => {
      const fields = body.split(/[,;]/).map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//')) return '';
        
        const propMatch = trimmed.match(/(\w+)(\?)?: ([^;,\n]+)/);
        if (propMatch) {
          const [, propName, optional, type] = propMatch;
          const jsDocType = this.convertTypeToJSDoc(type);
          return ` * @property {${jsDocType}} ${optional ? `[${propName}]` : propName}`;
        }
        return '';
      }).filter(Boolean).join('\n');

      return `/**\n * @typedef {Object} ${name}\n${fields}\n */`;
    });

    // Convert export enum to object
    result = result.replace(/export enum (\w+) \{([^}]+)\}/gs, (match, name, body) => {
      const entries = body.split(',').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '';
        
        const enumMatch = trimmed.match(/(\w+) = ['"](.*?)['"]?/);
        if (enumMatch) {
          const [, key, value] = enumMatch;
          return `  ${key}: '${value}'`;
        }
        return '';
      }).filter(Boolean).join(',\n');

      return `export const ${name} = {\n${entries}\n};`;
    });

    // Remove type annotations from function parameters
    result = result.replace(/(\w+):\s*([^,)=]+)([,)=])/g, '$1$3');
    
    // Remove return type annotations
    result = result.replace(/\):\s*[^{;]+(\{|;)/g, ')$1');
    
    // Remove variable type annotations
    result = result.replace(/:\s*[^=;,\n}]+(\s*[=;,\n}])/g, '$1');
    
    // Remove generic type parameters
    result = result.replace(/<[^>]+>/g, '');
    
    // Convert .ts imports to .js
    result = result.replace(/from ['"]([^'"]+)\.ts['"]/g, "from '$1.js'");
    result = result.replace(/from ['"]([^'"]+)\.tsx['"]/g, "from '$1.js'");

    return result;
  }

  convertTypeToJSDoc(type) {
    // Simple type conversion
    const typeMap = {
      'string': 'string',
      'number': 'number', 
      'boolean': 'boolean',
      'any': 'any',
      'void': 'void',
      'undefined': 'undefined',
      'null': 'null'
    };

    if (typeMap[type]) return typeMap[type];
    if (type.includes('[]')) return 'Array';
    if (type.includes('Record<')) return 'Object';
    if (type.includes('Promise<')) return 'Promise';
    
    return 'any'; // fallback
  }

  async convertFile(tsPath) {
    try {
      const content = await fs.readFile(tsPath, 'utf8');
      const filename = path.basename(tsPath);
      
      // Convert content
      const jsContent = this.convertToJavaScript(content, filename);
      
      // Write JS file
      const jsPath = tsPath.replace(/\.ts$/, '.js');
      await fs.writeFile(jsPath, jsContent, 'utf8');
      
      // Remove original TS file
      await fs.remove(tsPath);
      
      this.processedFiles.push(path.relative(LIB_DIR, tsPath));
      console.log(`✓ Converted: ${path.relative(LIB_DIR, tsPath)}`);
      
    } catch (error) {
      this.skippedFiles.push(path.relative(LIB_DIR, tsPath));
      console.warn(`⚠ Skipped: ${path.relative(LIB_DIR, tsPath)} - ${error.message}`);
    }
  }

  async convertDirectory(dirPath) {
    const entries = await fs.readdir(dirPath);
    
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry);
      const stat = await fs.stat(entryPath);
      
      if (stat.isDirectory()) {
        await this.convertDirectory(entryPath);
      } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
        await this.convertFile(entryPath);
      }
    }
  }

  async convert() {
    console.log('🔄 Converting TypeScript files to JavaScript...\n');
    
    await this.convertDirectory(LIB_DIR);
    
    console.log('\n📊 Conversion Summary:');
    console.log(`✅ Converted: ${this.processedFiles.length} files`);
    console.log(`⚠️  Skipped: ${this.skippedFiles.length} files`);
    
    if (this.processedFiles.length > 0) {
      console.log('\n📝 Converted files:');
      this.processedFiles.forEach(file => console.log(`  • ${file}`));
    }
    
    if (this.skippedFiles.length > 0) {
      console.log('\n⚠️ Skipped files:');
      this.skippedFiles.forEach(file => console.log(`  • ${file}`));
    }
    
    console.log('\n✨ TypeScript to JavaScript conversion completed!');
  }
}

// Run the converter
const converter = new TypeScriptToJavaScriptConverter();
converter.convert().catch(console.error);