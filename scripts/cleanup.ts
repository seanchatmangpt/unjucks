#!/usr/bin/env tsx
/**
 * Repository Cleanup Script
 * Removes temporary files, caches, and test pollution
 */

import { unlink, rmdir, readdir } from 'fs/promises'
import { join } from 'path'
import { glob } from 'glob'

interface CleanupConfig {
  dryRun?: boolean
  verbose?: boolean
}

class RepositoryCleanup {
  private config: CleanupConfig

  constructor(config: CleanupConfig = {}) {
    this.config = config
  }

  async cleanupTestDirectories(): Promise<void> {
    const testDirs = await glob('test-*', { cwd: process.cwd() })
    
    for (const dir of testDirs) {
      if (this.config.verbose) {
        console.log(`Removing test directory: ${dir}`)
      }
      
      if (!this.config.dryRun) {
        await rmdir(dir, { recursive: true }).catch(() => {})
      }
    }
    
    console.log(`${this.config.dryRun ? 'Would remove' : 'Removed'} ${testDirs.length} test directories`)
  }

  async cleanupCacheFiles(): Promise<void> {
    const cacheDirs = await glob('**/.unjucks-cache', { 
      cwd: process.cwd(),
      ignore: ['node_modules/**']
    })
    
    for (const dir of cacheDirs) {
      if (this.config.verbose) {
        console.log(`Removing cache directory: ${dir}`)
      }
      
      if (!this.config.dryRun) {
        await rmdir(dir, { recursive: true }).catch(() => {})
      }
    }
    
    console.log(`${this.config.dryRun ? 'Would remove' : 'Removed'} ${cacheDirs.length} cache directories`)
  }

  async cleanupTempFiles(): Promise<void> {
    const patterns = [
      'debug-cli.js',
      '**/temp/**',
      '**/*-temp*/**',
      '**/*-results.json',
      '**/*-output.log'
    ]
    
    let totalFiles = 0
    
    for (const pattern of patterns) {
      const files = await glob(pattern, { 
        cwd: process.cwd(),
        ignore: ['node_modules/**']
      })
      
      for (const file of files) {
        if (this.config.verbose) {
          console.log(`Removing temp file: ${file}`)
        }
        
        if (!this.config.dryRun) {
          await unlink(file).catch(() => {})
        }
      }
      
      totalFiles += files.length
    }
    
    console.log(`${this.config.dryRun ? 'Would remove' : 'Removed'} ${totalFiles} temporary files`)
  }

  async run(): Promise<void> {
    console.log('🧹 Starting repository cleanup...')
    console.log(`Mode: ${this.config.dryRun ? 'DRY RUN' : 'LIVE'}`)
    
    await this.cleanupTestDirectories()
    await this.cleanupCacheFiles()
    await this.cleanupTempFiles()
    
    console.log('✅ Repository cleanup completed!')
  }
}

// CLI execution
const args = process.argv.slice(2)
const config: CleanupConfig = {
  dryRun: args.includes('--dry-run'),
  verbose: args.includes('--verbose')
}

const cleanup = new RepositoryCleanup(config)
cleanup.run().catch(console.error)