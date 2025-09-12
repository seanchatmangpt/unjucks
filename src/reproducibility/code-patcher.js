/**
 * Code Patcher for KGEN - Replaces Non-Deterministic Code Patterns
 * 
 * This module patches existing KGEN files to replace all non-deterministic
 * elements with deterministic alternatives.
 */

import fs from 'fs';
import path from 'path';
import { getDeterministicEngine } from './deterministic-engine.js';

export class CodePatcher {
  constructor(options = {}) {
    this.engine = getDeterministicEngine(options);
    this.enableLogging = options.enableLogging || false;
    this.dryRun = options.dryRun || false;
  }

  /**
   * Patch patterns that need to be replaced for deterministic behavior
   */
  getPatchPatterns() {
    return [
      // Replace new Date().toISOString() with deterministic timestamp
      {
        pattern: /new Date\(\)\.toISOString\(\)/g,
        replacement: () => `getDeterministicEngine().getDeterministicTimestamp()`,
        description: 'Replace Date.now() timestamps with deterministic timestamps'
      },

      // Replace new Date() with deterministic date
      {
        pattern: /new Date\(\)(?!\.)/g,
        replacement: () => `new Date(getDeterministicEngine().getDeterministicTimestamp())`,
        description: 'Replace new Date() with deterministic date'
      },

      // Replace Date.now() with deterministic timestamp
      {
        pattern: /Date\.now\(\)/g,
        replacement: () => `new Date(getDeterministicEngine().getDeterministicTimestamp()).getTime()`,
        description: 'Replace Date.now() with deterministic timestamp'
      },

      // Replace Math.random() with deterministic random
      {
        pattern: /Math\.random\(\)/g,
        replacement: (match, offset, string) => {
          // Use offset as content for deterministic seeding
          return `getDeterministicEngine().generateDeterministicRandom('${offset}')`;
        },
        description: 'Replace Math.random() with deterministic random'
      },

      // Replace Math.floor(Math.random() * n) with deterministic int
      {
        pattern: /Math\.floor\(Math\.random\(\)\s*\*\s*(\d+)\)/g,
        replacement: (match, n, offset) => {
          return `getDeterministicEngine().generateDeterministicRandomInt(0, ${parseInt(n) - 1}, '${offset}')`;
        },
        description: 'Replace random integer generation with deterministic version'
      },

      // Replace crypto.randomBytes with deterministic hex
      {
        pattern: /crypto\.randomBytes\((\d+)\)\.toString\('hex'\)/g,
        replacement: (match, length, offset) => {
          return `getDeterministicEngine().generateDeterministicHex(${parseInt(length) * 2}, '${offset}')`;
        },
        description: 'Replace crypto.randomBytes with deterministic hex'
      },

      // Replace UUID generation patterns
      {
        pattern: /Array\.from\(\{\s*length:\s*32\s*\},\s*\(\)\s*=>\s*Math\.floor\(Math\.random\(\)\s*\*\s*16\)\.toString\(16\)\)\.join\(''\)/g,
        replacement: (match, offset) => {
          return `getDeterministicEngine().generateDeterministicHex(32, 'uuid_${offset}')`;
        },
        description: 'Replace UUID generation with deterministic version'
      },

      // Replace timestamp-based filenames
      {
        pattern: /new Date\(\)\.toISOString\(\)\.replace\(/g,
        replacement: () => `getDeterministicEngine().getDeterministicTimestamp().replace(`,
        description: 'Replace timestamp in filenames with deterministic version'
      }
    ];
  }

  /**
   * Add required imports to a file
   */
  addDeterministicImports(content) {
    // Check if imports already exist
    if (content.includes('getDeterministicEngine')) {
      return content;
    }

    // Find the import section
    const lines = content.split('\n');
    let importIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ') || lines[i].startsWith('const ') || lines[i].startsWith('let ')) {
        importIndex = i;
      } else if (importIndex !== -1 && !lines[i].trim().startsWith('//') && lines[i].trim() !== '') {
        break;
      }
    }

    // Add the import after the last import or at the top
    const importLine = "import { getDeterministicEngine } from '../src/reproducibility/deterministic-engine.js';";
    
    if (importIndex !== -1) {
      lines.splice(importIndex + 1, 0, importLine);
    } else {
      lines.splice(1, 0, '', importLine);
    }

    return lines.join('\n');
  }

  /**
   * Patch a single file
   */
  patchFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        if (this.enableLogging) {
          console.log(`[Patcher] File not found: ${filePath}`);
        }
        return null;
      }

      const originalContent = fs.readFileSync(filePath, 'utf8');
      let patchedContent = originalContent;
      const appliedPatches = [];

      // Apply each patch pattern
      const patterns = this.getPatchPatterns();
      for (const patch of patterns) {
        const matches = patchedContent.match(patch.pattern);
        if (matches) {
          patchedContent = patchedContent.replace(patch.pattern, patch.replacement);
          appliedPatches.push({
            description: patch.description,
            matchCount: matches.length
          });
        }
      }

      // Add imports if patches were applied
      if (appliedPatches.length > 0) {
        patchedContent = this.addDeterministicImports(patchedContent);
      }

      // Write the patched file (unless dry run)
      if (!this.dryRun && patchedContent !== originalContent) {
        // Backup original file
        const backupPath = `${filePath}.orig`;
        if (!fs.existsSync(backupPath)) {
          fs.writeFileSync(backupPath, originalContent);
        }
        
        fs.writeFileSync(filePath, patchedContent);
      }

      if (this.enableLogging && appliedPatches.length > 0) {
        console.log(`[Patcher] Patched ${filePath}: ${appliedPatches.length} patterns`);
      }

      return {
        filePath,
        appliedPatches,
        originalSize: originalContent.length,
        patchedSize: patchedContent.length,
        changed: patchedContent !== originalContent
      };

    } catch (error) {
      console.error(`[Patcher] Error patching file ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * Patch all KGEN-related files in a directory
   */
  patchDirectory(directory) {
    const kgenFiles = this.findKgenFiles(directory);
    const results = [];

    for (const file of kgenFiles) {
      const result = this.patchFile(file);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Find all KGEN-related files that need patching
   */
  findKgenFiles(directory) {
    const files = [];
    const extensions = ['.js', '.mjs', '.ts'];
    const kgenPatterns = ['kgen', 'artifact', 'template', 'generator'];

    const scanRecursive = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (extensions.includes(ext)) {
              const filename = entry.name.toLowerCase();
              // Include files that contain KGEN patterns or are in bin/ directory
              if (kgenPatterns.some(pattern => filename.includes(pattern)) || 
                  dir.includes('bin') || 
                  dir.includes('src')) {
                files.push(fullPath);
              }
            }
          } else if (entry.isDirectory() && 
                    !entry.name.startsWith('.') && 
                    !entry.name.includes('node_modules')) {
            scanRecursive(fullPath);
          }
        }
      } catch (error) {
        // Ignore directory access errors
      }
    };

    scanRecursive(directory);
    return files;
  }

  /**
   * Generate a patch report
   */
  generatePatchReport(results) {
    const totalFiles = results.length;
    const changedFiles = results.filter(r => r.changed).length;
    const totalPatches = results.reduce((sum, r) => sum + r.appliedPatches.length, 0);

    const patchSummary = {};
    for (const result of results) {
      for (const patch of result.appliedPatches) {
        if (!patchSummary[patch.description]) {
          patchSummary[patch.description] = 0;
        }
        patchSummary[patch.description] += patch.matchCount;
      }
    }

    return {
      timestamp: this.engine.getDeterministicTimestamp(),
      commit: this.engine.baseCommit,
      dryRun: this.dryRun,
      summary: {
        totalFiles,
        changedFiles,
        totalPatches
      },
      patchSummary,
      files: results.filter(r => r.changed).map(r => ({
        path: r.filePath,
        patches: r.appliedPatches.length,
        sizeChange: r.patchedSize - r.originalSize
      }))
    };
  }

  /**
   * Restore original files from backups
   */
  restoreFromBackups(directory) {
    const backupFiles = [];
    
    const scanForBackups = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isFile() && entry.name.endsWith('.orig')) {
            backupFiles.push(fullPath);
          } else if (entry.isDirectory() && 
                    !entry.name.startsWith('.') && 
                    !entry.name.includes('node_modules')) {
            scanForBackups(fullPath);
          }
        }
      } catch (error) {
        // Ignore errors
      }
    };

    scanForBackups(directory);

    const restored = [];
    for (const backupPath of backupFiles) {
      const originalPath = backupPath.replace('.orig', '');
      try {
        const backupContent = fs.readFileSync(backupPath, 'utf8');
        fs.writeFileSync(originalPath, backupContent);
        fs.unlinkSync(backupPath); // Remove backup after restoration
        restored.push(originalPath);
      } catch (error) {
        console.error(`Failed to restore ${originalPath}:`, error.message);
      }
    }

    return restored;
  }
}

// Export convenience functions
export function patchFile(filePath, options = {}) {
  const patcher = new CodePatcher(options);
  return patcher.patchFile(filePath);
}

export function patchDirectory(directory, options = {}) {
  const patcher = new CodePatcher(options);
  return patcher.patchDirectory(directory);
}

export function restoreBackups(directory) {
  const patcher = new CodePatcher();
  return patcher.restoreFromBackups(directory);
}