#!/usr/bin/env node

/**
 * TypeScript Build Script for KGEN Monorepo
 * Compiles TypeScript to ESM .mjs files with source maps and declaration files
 */

import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync, readdirSync, statSync } from 'fs'
import { writeFileSync, readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

// Package build order (core dependencies first)
const buildOrder = [
  'packages/kgen-core',
  'packages/kgen-templates', 
  'packages/kgen-rules',
  'packages/kgen-marketplace',
  'packages/kgen-cli'
]

console.log('🚀 Building TypeScript monorepo...')

// Clean previous builds
console.log('🧹 Cleaning previous builds...')
for (const pkg of buildOrder) {
  const distPath = join(rootDir, pkg, 'dist')
  if (existsSync(distPath)) {
    execSync(`rm -rf "${distPath}"`, { cwd: rootDir })
    console.log(`   Cleaned ${pkg}/dist`)
  }
}

// Build each package in order
console.log('🔨 Building packages...')
for (const pkg of buildOrder) {
  const pkgPath = join(rootDir, pkg)
  
  if (existsSync(join(pkgPath, 'tsconfig.json'))) {
    console.log(`   Building ${pkg}...`)
    
    try {
      // Run TypeScript compiler
      execSync('npx tsc --build', { 
        cwd: pkgPath,
        stdio: 'inherit' 
      })
      
      // Post-process: rename .js to .mjs in dist folder
      const distPath = join(pkgPath, 'dist')
      if (existsSync(distPath)) {
        renameJsToMjs(distPath)
        console.log(`   ✅ Built ${pkg}`)
      }
    } catch (error) {
      console.error(`   ❌ Failed to build ${pkg}:`, error.message)
      process.exit(1)
    }
  } else {
    console.log(`   ⏭️  Skipping ${pkg} (no TypeScript config)`)
  }
}

// Build root-level CLI entry
console.log('🔗 Building root CLI entry...')
try {
  execSync('npx tsc --build', { 
    cwd: rootDir,
    stdio: 'inherit' 
  })
  
  const rootDistPath = join(rootDir, 'dist')
  if (existsSync(rootDistPath)) {
    renameJsToMjs(rootDistPath)
  }
  
  console.log('   ✅ Built root CLI')
} catch (error) {
  console.error('   ❌ Failed to build root CLI:', error.message)
  process.exit(1)
}

console.log('🎉 TypeScript build completed successfully!')

/**
 * Recursively rename .js files to .mjs in a directory
 */
function renameJsToMjs(dir) {
  const items = readdirSync(dir)
  
  for (const item of items) {
    const itemPath = join(dir, item)
    const stat = statSync(itemPath)
    
    if (stat.isDirectory()) {
      renameJsToMjs(itemPath)
    } else if (item.endsWith('.js') && !item.endsWith('.min.js')) {
      const mjsPath = itemPath.replace(/\.js$/, '.mjs')
      
      // Read the file content
      const content = readFileSync(itemPath, 'utf8')
      
      // Update relative imports to use .mjs extension
      const updatedContent = content.replace(
        /from\s+['"](\.[^'"]*?)(?:\.js)?['"]/g,
        "from '$1.mjs'"
      ).replace(
        /import\s*\(\s*['"](\.[^'"]*?)(?:\.js)?['"]\s*\)/g,
        "import('$1.mjs')"
      )
      
      // Write to .mjs file
      writeFileSync(mjsPath, updatedContent)
      
      // Remove original .js file
      execSync(`rm "${itemPath}"`)
    }
  }
}