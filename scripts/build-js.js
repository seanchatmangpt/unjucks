#!/usr/bin/env node

/**
 * JavaScript build script for Unjucks
 * Replaces TypeScript compilation with JavaScript module processing
 */

import { writeFileSync, readFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');
const srcDir = join(projectRoot, 'src');
const distDir = join(projectRoot, 'dist');

console.log('🚀 Building Unjucks JavaScript modules...');

// Ensure dist directory exists
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

/**
 * Copy and process JavaScript files recursively
 */
function copyJavaScriptFiles(sourceDir, targetDir) {
  if (!existsSync(sourceDir)) {
    console.warn(`Warning: Source directory ${sourceDir} does not exist`);
    return;
  }

  const items = readdirSync(sourceDir);
  
  for (const item of items) {
    const sourcePath = join(sourceDir, item);
    const targetPath = join(targetDir, item);
    const stat = statSync(sourcePath);
    
    if (stat.isDirectory()) {
      // Create target directory if it doesn't exist
      if (!existsSync(targetPath)) {
        mkdirSync(targetPath, { recursive: true });
      }
      // Recursively copy directory
      copyJavaScriptFiles(sourcePath, targetPath);
    } else if (extname(item) === '.js') {
      // Copy JavaScript files
      console.log(`📁 Copying: ${sourcePath} -> ${targetPath}`);
      copyFileSync(sourcePath, targetPath);
    }
  }
}

// Copy all JavaScript files from src to dist
copyJavaScriptFiles(srcDir, distDir);

// Create main entry points
const mainIndexPath = join(srcDir, 'index.js');
const distIndexPath = join(distDir, 'index.js');

if (existsSync(mainIndexPath)) {
  copyFileSync(mainIndexPath, distIndexPath);
  console.log('📦 Copied main index.js');
} else {
  // Create a basic index.js if it doesn't exist
  const basicIndex = `// Unjucks main entry point
export * from './lib/frontmatter-parser.js';
export * from './lib/turtle-parser.js';
export * from './lib/rdf-data-loader.js';
export * from './lib/rdf-filters.js';
export { default as RDFDataLoader } from './lib/rdf-data-loader.js';
export { TurtleParser } from './lib/turtle-parser.js';
export { FrontmatterParser } from './lib/frontmatter-parser.js';
`;
  
  writeFileSync(distIndexPath, basicIndex);
  console.log('📦 Created main index.js');
}

// Create CommonJS version
const cjsIndex = `// CommonJS compatibility for Unjucks
const { 
  FrontmatterParser, 
  TurtleParser, 
  RDFDataLoader, 
  RDFFilters, 
  createRDFHelpers,
  parseTurtle,
  parseTurtleSync,
  loadRDFData,
  loadMultipleRDFData
} = require('./index.js');

module.exports = {
  FrontmatterParser,
  TurtleParser,
  RDFDataLoader,
  RDFFilters,
  createRDFHelpers,
  parseTurtle,
  parseTurtleSync,
  loadRDFData,
  loadMultipleRDFData,
  default: RDFDataLoader
};
`;

writeFileSync(join(distDir, 'index.cjs'), cjsIndex);
console.log('📦 Created CommonJS index.cjs');

// Update package.json module references
const packageJsonPath = join(projectRoot, 'package.json');
if (existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  
  // Update exports
  packageJson.exports = {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  };
  
  packageJson.main = "./dist/index.cjs";
  packageJson.module = "./dist/index.js";
  
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('📦 Updated package.json exports');
}

// Create CLI executable
const binDir = join(projectRoot, 'bin');
if (!existsSync(binDir)) {
  mkdirSync(binDir, { recursive: true });
}

const cliContent = `#!/usr/bin/env node

/**
 * Unjucks CLI - JavaScript version
 */

import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the main CLI module (assume it exists in src/cli)
async function main() {
  try {
    const { cli } = await import(join(__dirname, '..', 'src', 'cli', 'index.js'));
    await cli();
  } catch (error) {
    console.error('Failed to start Unjucks CLI:', error.message);
    process.exit(1);
  }
}

main();
`;

writeFileSync(join(binDir, 'unjucks.js'), cliContent);
console.log('📦 Created CLI executable');

console.log('✅ JavaScript build completed successfully!');
console.log('📁 Built files are in:', distDir);
console.log('🔧 Run `npm run build:post` to finalize the build');