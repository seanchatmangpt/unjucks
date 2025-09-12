/**
 * KGEN Project Lockfile Generation
 * Creates deterministic lockfiles for reproducible builds
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile, access, stat } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import glob from 'glob';
import mkdirp from 'mkdirp';

/**
 * Generate project lockfile
 * @param {Object} options - Lockfile generation options
 * @returns {Promise<Object>} Generated lockfile data
 */
export async function generateLockfile(options = {}) {
  const {
    cwd = process.cwd(),
    config = null,
    includePatterns = ['**/*.ttl', '**/*.n3', '**/*.rdf', 'templates/**/*', 'rules/**/*'],
    excludePatterns = ['node_modules/**', '.git/**', 'dist/**', '.kgen/cache/**'],
    outputPath = '.kgen/project.lock',
    includeContent = false,
    hashAlgorithm = 'sha256'
  } = options;

  const startTime = this.getDeterministicTimestamp();
  const lockfile = {
    version: '1.0.0',
    generator: 'kgen-core',
    timestamp: this.getDeterministicDate().toISOString(),
    project: await getProjectMetadata(cwd),
    config: config ? await hashConfig(config) : null,
    files: {},
    dependencies: {},
    integrity: null,
    stats: {
      totalFiles: 0,
      totalSize: 0,
      generationTime: 0
    }
  };

  try {
    // Find all relevant files
    const files = await findProjectFiles(cwd, includePatterns, excludePatterns);
    
    // Process each file
    for (const filePath of files) {
      const fullPath = resolve(cwd, filePath);
      const relativePath = relative(cwd, fullPath);
      
      const fileInfo = await processFile(fullPath, {
        includeContent,
        hashAlgorithm
      });
      
      lockfile.files[relativePath] = fileInfo;
      lockfile.stats.totalFiles++;
      lockfile.stats.totalSize += fileInfo.size;
    }

    // Process dependencies
    lockfile.dependencies = await processDependencies(cwd);

    // Generate overall integrity hash
    lockfile.integrity = generateIntegrityHash(lockfile, hashAlgorithm);
    
    // Calculate generation time
    lockfile.stats.generationTime = this.getDeterministicTimestamp() - startTime;

    // Write lockfile
    const lockfilePath = resolve(cwd, outputPath);
    await mkdirp(dirname(lockfilePath));
    await writeFile(lockfilePath, JSON.stringify(lockfile, null, 2), 'utf8');

    return {
      success: true,
      lockfile,
      path: lockfilePath,
      stats: lockfile.stats
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      lockfile: null
    };
  }
}

/**
 * Verify project against lockfile
 * @param {Object} options - Verification options
 * @returns {Promise<Object>} Verification result
 */
export async function verifyLockfile(options = {}) {
  const {
    cwd = process.cwd(),
    lockfilePath = '.kgen/project.lock',
    strict = true,
    checkContent = false
  } = options;

  const fullLockfilePath = resolve(cwd, lockfilePath);
  
  try {
    // Read existing lockfile
    const lockfileContent = await readFile(fullLockfilePath, 'utf8');
    const existingLockfile = JSON.parse(lockfileContent);
    
    // Generate current lockfile for comparison
    const currentResult = await generateLockfile({
      cwd,
      includeContent: checkContent,
      outputPath: lockfilePath + '.temp'
    });
    
    if (!currentResult.success) {
      return {
        success: false,
        error: 'Failed to generate current lockfile for comparison',
        details: currentResult.error
      };
    }

    const currentLockfile = currentResult.lockfile;
    const issues = [];

    // Compare files
    const existingFiles = Object.keys(existingLockfile.files);
    const currentFiles = Object.keys(currentLockfile.files);
    
    // Check for added files
    const addedFiles = currentFiles.filter(f => !existingFiles.includes(f));
    if (addedFiles.length > 0) {
      issues.push({
        type: 'files_added',
        files: addedFiles,
        severity: strict ? 'error' : 'warning'
      });
    }

    // Check for removed files
    const removedFiles = existingFiles.filter(f => !currentFiles.includes(f));
    if (removedFiles.length > 0) {
      issues.push({
        type: 'files_removed',
        files: removedFiles,
        severity: 'error'
      });
    }

    // Check for modified files
    const modifiedFiles = [];
    for (const filePath of existingFiles) {
      if (currentFiles.includes(filePath)) {
        const existingFile = existingLockfile.files[filePath];
        const currentFile = currentLockfile.files[filePath];
        
        if (existingFile.hash !== currentFile.hash) {
          modifiedFiles.push({
            path: filePath,
            existingHash: existingFile.hash,
            currentHash: currentFile.hash,
            existingSize: existingFile.size,
            currentSize: currentFile.size
          });
        }
      }
    }

    if (modifiedFiles.length > 0) {
      issues.push({
        type: 'files_modified',
        files: modifiedFiles,
        severity: 'error'
      });
    }

    // Check overall integrity
    const integrityMatch = existingLockfile.integrity === currentLockfile.integrity;
    if (!integrityMatch) {
      issues.push({
        type: 'integrity_mismatch',
        expected: existingLockfile.integrity,
        actual: currentLockfile.integrity,
        severity: 'error'
      });
    }

    // Clean up temp lockfile
    try {
      const { unlink } = await import('node:fs/promises');
      await unlink(resolve(cwd, lockfilePath + '.temp'));
    } catch (err) {
      // Ignore cleanup errors
    }

    const hasErrors = issues.some(issue => issue.severity === 'error');
    
    return {
      success: !hasErrors,
      verified: !hasErrors,
      issues,
      stats: {
        existingFiles: existingFiles.length,
        currentFiles: currentFiles.length,
        addedFiles: addedFiles.length,
        removedFiles: removedFiles.length,
        modifiedFiles: modifiedFiles.length,
        integrityMatch
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to verify lockfile: ${error.message}`
    };
  }
}

/**
 * Update lockfile with current project state
 * @param {Object} options - Update options
 * @returns {Promise<Object>} Update result
 */
export async function updateLockfile(options = {}) {
  const {
    cwd = process.cwd(),
    lockfilePath = '.kgen/project.lock',
    backup = true
  } = options;

  const fullLockfilePath = resolve(cwd, lockfilePath);

  try {
    // Backup existing lockfile if requested
    if (backup) {
      try {
        await access(fullLockfilePath);
        const backupPath = fullLockfilePath + '.backup.' + this.getDeterministicTimestamp();
        const { copyFile } = await import('node:fs/promises');
        await copyFile(fullLockfilePath, backupPath);
      } catch (err) {
        // File doesn't exist, no backup needed
      }
    }

    // Generate new lockfile
    const result = await generateLockfile({
      cwd,
      outputPath: lockfilePath
    });

    return {
      success: result.success,
      updated: result.success,
      error: result.error,
      stats: result.stats
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to update lockfile: ${error.message}`
    };
  }
}

/**
 * Get project metadata
 * @private
 */
async function getProjectMetadata(cwd) {
  const metadata = {
    name: null,
    version: null,
    type: 'unknown'
  };

  try {
    // Try to read package.json
    const packageJsonPath = resolve(cwd, 'package.json');
    await access(packageJsonPath);
    
    const packageContent = await readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageContent);
    
    metadata.name = packageJson.name;
    metadata.version = packageJson.version;
    metadata.type = 'node';
  } catch (err) {
    // No package.json, try other project types
    metadata.name = cwd.split('/').pop();
    metadata.version = '0.0.0';
  }

  return metadata;
}

/**
 * Find all project files matching patterns
 * @private
 */
async function findProjectFiles(cwd, includePatterns, excludePatterns) {
  const files = new Set();
  
  for (const pattern of includePatterns) {
    const matches = await glob(pattern, {
      cwd,
      ignore: excludePatterns,
      dot: true
    });
    matches.forEach(file => files.add(file));
  }

  return Array.from(files).sort();
}

/**
 * Process individual file
 * @private
 */
async function processFile(filePath, options) {
  const { includeContent, hashAlgorithm } = options;
  
  const stats = await stat(filePath);
  const content = await readFile(filePath);
  
  const fileInfo = {
    size: stats.size,
    modified: stats.mtime.toISOString(),
    hash: createHash(hashAlgorithm).update(content).digest('hex'),
    type: getFileType(filePath)
  };

  if (includeContent) {
    fileInfo.content = content.toString('base64');
  }

  return fileInfo;
}

/**
 * Process project dependencies
 * @private
 */
async function processDependencies(cwd) {
  const dependencies = {
    packages: {},
    templates: {},
    rules: {}
  };

  try {
    // Process package.json dependencies
    const packageJsonPath = resolve(cwd, 'package.json');
    await access(packageJsonPath);
    
    const packageContent = await readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageContent);
    
    dependencies.packages = {
      ...packageJson.dependencies || {},
      ...packageJson.devDependencies || {},
      ...packageJson.peerDependencies || {}
    };
  } catch (err) {
    // No package.json
  }

  // Process template dependencies
  try {
    const templateFiles = await glob('templates/**/template.{json,yaml,yml}', { cwd });
    for (const templateFile of templateFiles) {
      const templatePath = resolve(cwd, templateFile);
      const templateContent = await readFile(templatePath, 'utf8');
      
      let templateConfig;
      if (templateFile.endsWith('.json')) {
        templateConfig = JSON.parse(templateContent);
      } else {
        const { parse } = await import('yaml');
        templateConfig = parse(templateContent);
      }
      
      if (templateConfig.dependencies) {
        const templateName = templateFile.split('/')[1];
        dependencies.templates[templateName] = templateConfig.dependencies;
      }
    }
  } catch (err) {
    // No templates
  }

  return dependencies;
}

/**
 * Generate integrity hash for entire lockfile
 * @private
 */
function generateIntegrityHash(lockfile, algorithm) {
  const hashableData = {
    files: lockfile.files,
    dependencies: lockfile.dependencies,
    project: lockfile.project
  };
  
  const dataString = JSON.stringify(hashableData, Object.keys(hashableData).sort());
  return createHash(algorithm).update(dataString).digest('hex');
}

/**
 * Determine file type from extension
 * @private
 */
function getFileType(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  
  const typeMap = {
    'ttl': 'turtle',
    'n3': 'n3',
    'rdf': 'rdf-xml',
    'jsonld': 'json-ld',
    'nq': 'n-quads',
    'nt': 'n-triples',
    'trig': 'trig',
    'js': 'javascript',
    'ts': 'typescript',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'md': 'markdown',
    'txt': 'text'
  };
  
  return typeMap[ext] || 'unknown';
}

/**
 * Hash configuration object
 * @private
 */
async function hashConfig(config) {
  const configString = JSON.stringify(config, Object.keys(config).sort());
  return {
    hash: createHash('sha256').update(configString).digest('hex'),
    timestamp: this.getDeterministicDate().toISOString()
  };
}