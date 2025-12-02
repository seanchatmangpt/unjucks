#!/usr/bin/env node

/**
 * Build script for KGEN CLI - Creates single distribution entry point
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.join(__dirname, '..');
const distDir = path.join(packageDir, 'dist');
const srcDir = path.join(packageDir, 'src');

async function build() {
  try {
    console.log('🔨 Building KGEN CLI...');
    
    // Ensure dist directory exists
    await fs.mkdir(distDir, { recursive: true });
    
    // Copy the main CLI file to dist as single entry point
    const srcFile = path.join(srcDir, 'cli.js');
    const distFile = path.join(distDir, 'cli-entry.js');
    
    // Check if source file exists
    try {
      await fs.access(srcFile);
    } catch (error) {
      console.error(`❌ Source file not found: ${srcFile}`);
      process.exit(1);
    }
    
    // Copy and ensure executable permissions
    const content = await fs.readFile(srcFile, 'utf8');
    
    // Ensure shebang is present
    const finalContent = content.startsWith('#!') ? content : `#!/usr/bin/env node\n${content}`;
    
    await fs.writeFile(distFile, finalContent, { mode: 0o755 });
    
    console.log(`✅ Built ${distFile}`);
    console.log('📦 KGEN CLI build complete - single distribution entry created');
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();