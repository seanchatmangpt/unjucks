/**
 * KGEN Validation Engine - Drift Detection Helper Methods
 * Additional methods for comprehensive drift detection and validation
 */

import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import consola from 'consola';

/**
 * Helper methods for drift detection and validation
 * These are mixed into the main KGenValidationEngine class
 */
export const DriftHelperMethods = {
  
  /**
   * Calculate similarity score between two content strings
   */
  calculateSimilarityScore(content1, content2) {
    if (content1 === content2) return 1.0;
    if (!content1 || !content2) return 0.0;
    
    // Simple similarity calculation based on character-level comparison
    // In production, this could use more sophisticated algorithms like Levenshtein
    const shorter = content1.length < content2.length ? content1 : content2;
    const longer = content1.length >= content2.length ? content1 : content2;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.calculateEditDistance(shorter, longer);
    return (longer.length - editDistance) / longer.length;
  },
  
  /**
   * Calculate edit distance (Levenshtein distance) between two strings
   */
  calculateEditDistance(str1, str2) {
    const matrix = [];
    
    // Initialize matrix
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  },
  
  /**
   * Analyze differences between current and expected content
   */
  async analyzeDifferences(currentContent, expectedContent, filePath) {
    const differences = [];
    
    // Basic line-by-line comparison
    const currentLines = currentContent.split('\n');
    const expectedLines = expectedContent.split('\n');
    
    const maxLines = Math.max(currentLines.length, expectedLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const currentLine = currentLines[i] || '';
      const expectedLine = expectedLines[i] || '';
      
      if (currentLine !== expectedLine) {
        differences.push({
          type: currentLine ? (expectedLine ? 'modified' : 'added') : 'removed',
          line: i + 1,
          current: currentLine,
          expected: expectedLine,
          message: `Line ${i + 1}: ${currentLine ? (expectedLine ? 'modified' : 'added') : 'removed'}`
        });
      }
    }
    
    // Add metadata about the differences
    if (differences.length > 0) {
      differences.unshift({
        type: 'summary',
        message: `Found ${differences.length - 1} differences in ${path.basename(filePath)}`,
        totalDifferences: differences.length - 1,
        addedLines: differences.filter(d => d.type === 'added').length,
        removedLines: differences.filter(d => d.type === 'removed').length,
        modifiedLines: differences.filter(d => d.type === 'modified').length
      });
    }
    
    return differences;
  },
  
  /**
   * Check state consistency of a file's content
   */
  async checkStateConsistency(filePath, content) {
    const consistency = {
      valid: true,
      checks: [],
      warnings: [],
      errors: []
    };
    
    try {
      // File format consistency check
      const extension = path.extname(filePath).toLowerCase();
      const formatCheck = this.validateFileFormat(content, extension);
      consistency.checks.push(formatCheck);
      
      if (!formatCheck.valid) {
        consistency.valid = false;
        consistency.errors.push(formatCheck.error);
      }
      
      // Content integrity check
      const integrityCheck = this.validateContentIntegrity(content, extension);
      consistency.checks.push(integrityCheck);
      
      if (!integrityCheck.valid) {
        consistency.errors.push(integrityCheck.error);
        consistency.valid = false;
      }
      
      // Semantic consistency check for RDF files
      if (['.ttl', '.turtle', '.n3', '.rdf', '.jsonld'].includes(extension)) {
        const semanticCheck = await this.validateSemanticConsistency(content, extension);
        consistency.checks.push(semanticCheck);
        
        if (semanticCheck.warnings?.length > 0) {
          consistency.warnings.push(...semanticCheck.warnings);
        }
      }
      
    } catch (error) {
      consistency.valid = false;
      consistency.errors.push(`State consistency check failed: ${error.message}`);
    }
    
    return consistency;
  },
  
  /**
   * Validate file format consistency
   */
  validateFileFormat(content, extension) {
    const check = {
      type: 'format-validation',
      valid: true,
      message: 'File format is valid'
    };
    
    try {
      switch (extension) {
        case '.json':
          JSON.parse(content);
          break;
        case '.jsonld':
          JSON.parse(content);
          // Additional JSON-LD validation could be added here
          break;
        case '.ttl':
        case '.turtle':
        case '.n3':
          // Basic Turtle/N3 syntax check
          if (content.includes('@@') || content.match(/[<>].*[<>]/g)?.some(uri => !uri.match(/^<[^<>]*>$/))) {
            throw new Error('Invalid Turtle/N3 syntax detected');
          }
          break;
        case '.rdf':
          // Basic RDF/XML validation
          if (!content.includes('<rdf:RDF') && !content.includes('<RDF')) {
            throw new Error('Invalid RDF/XML format - missing RDF root element');
          }
          break;
        default:
          // For other formats, just check if content is readable
          if (typeof content !== 'string') {
            throw new Error('Content is not a valid string');
          }
      }
    } catch (error) {
      check.valid = false;
      check.error = `Format validation failed: ${error.message}`;
    }
    
    return check;
  },
  
  /**
   * Validate content integrity
   */
  validateContentIntegrity(content, extension) {
    const check = {
      type: 'integrity-validation',
      valid: true,
      message: 'Content integrity is valid'
    };
    
    // Check for null bytes or other suspicious content
    if (content.includes('\0')) {
      check.valid = false;
      check.error = 'Content contains null bytes';
      return check;
    }
    
    // Check for extremely long lines that might indicate malformed content
    const lines = content.split('\n');
    const maxLineLength = 10000; // 10KB per line seems reasonable
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length > maxLineLength) {
        check.valid = false;
        check.error = `Line ${i + 1} exceeds maximum length (${maxLineLength} characters)`;
        return check;
      }
    }
    
    return check;
  },
  
  /**
   * Validate semantic consistency for RDF content
   */
  async validateSemanticConsistency(content, extension) {
    const check = {
      type: 'semantic-validation',
      valid: true,
      message: 'Semantic consistency is valid',
      warnings: []
    };
    
    try {
      // Use the semantic validator to check RDF content
      if (this.semanticValidator) {
        // Create a simple graph representation for validation
        const graph = {
          entities: [],
          relationships: [],
          triples: content.split('\n').filter(line => 
            line.trim() && 
            !line.trim().startsWith('#') && 
            !line.trim().startsWith('@')
          )
        };
        
        const semanticResult = this.semanticValidator.validateGraph(graph);
        
        if (!semanticResult.valid) {
          check.warnings.push(...semanticResult.errors);
        }
        
        if (semanticResult.warnings?.length > 0) {
          check.warnings.push(...semanticResult.warnings);
        }
      }
    } catch (error) {
      check.warnings.push(`Semantic validation warning: ${error.message}`);
    }
    
    return check;
  },
  
  /**
   * Handle different drift detection modes (fail/warn/fix)
   */
  async handleDriftDetectionMode(driftResult) {
    const mode = this.config.driftDetection.failMode;
    
    switch (mode) {
      case 'fail':
        if (driftResult.driftDetected || driftResult.unauthorizedModification) {
          const message = driftResult.unauthorizedModification 
            ? 'Unauthorized modification detected'
            : `Drift detected (score: ${driftResult.driftScore.toFixed(3)})`;
          consola.error(`❌ ${message} in ${driftResult.metadata.targetPath}`);
        }
        break;
        
      case 'warn':
        if (driftResult.driftDetected || driftResult.unauthorizedModification) {
          const message = driftResult.unauthorizedModification 
            ? 'Unauthorized modification detected'
            : `Drift detected (score: ${driftResult.driftScore.toFixed(3)})`;
          consola.warn(`⚠️ ${message} in ${driftResult.metadata.targetPath}`);
        }
        break;
        
      case 'fix':
        if (driftResult.driftDetected && this.config.driftDetection.autoFix) {
          const fixResult = await this.applyDriftFixes(driftResult);
          consola.info(`🔧 Applied ${fixResult.fixesApplied} automatic fixes`);
        } else if (driftResult.driftDetected) {
          consola.warn(`⚠️ Drift detected but auto-fix is disabled in ${driftResult.metadata.targetPath}`);
        }
        break;
        
      default:
        consola.warn(`⚠️ Unknown drift detection mode: ${mode}`);
    }
  },
  
  /**
   * Apply automatic drift fixes
   */
  async applyDriftFixes(driftResult) {
    let fixesApplied = 0;
    
    try {
      if (!this.config.driftDetection.autoFix) {
        return { fixesApplied: 0, message: 'Auto-fix disabled' };
      }
      
      const targetPath = driftResult.metadata.targetPath;
      
      // Backup original file if requested
      if (this.config.driftDetection.backupOriginal) {
        const backupPath = `${targetPath}.backup.${this.getDeterministicTimestamp()}`;
        await fs.copy(targetPath, backupPath);
        consola.info(`💾 Created backup: ${backupPath}`);
      }
      
      // For now, the simplest fix is to restore from expected content
      if (driftResult.expected.content) {
        await fs.writeFile(targetPath, driftResult.expected.content, 'utf8');
        fixesApplied = 1;
        this.stats.driftFixed++;
        
        consola.success(`✅ Restored ${targetPath} from expected content`);
      }
      
    } catch (error) {
      consola.error(`❌ Failed to apply drift fixes: ${error.message}`);
      throw error;
    }
    
    return { fixesApplied, message: `Applied ${fixesApplied} fixes` };
  },
  
  /**
   * Generate baseline key for drift tracking
   */
  getBaselineKey(filePath) {
    return crypto.createHash('md5').update(path.resolve(filePath)).digest('hex');
  },
  
  /**
   * Update baseline with new content
   */
  async updateBaseline(filePath, content) {
    const fullPath = path.resolve(filePath);
    const baselineKey = this.getBaselineKey(fullPath);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    
    this.driftBaseline.set(baselineKey, {
      path: fullPath,
      content,
      hash,
      timestamp: this.getDeterministicDate().toISOString()
    });
    
    await this.saveDriftBaseline();
    consola.success(`📝 Updated baseline for ${path.basename(filePath)}`);
  },
  
  /**
   * Save drift baseline to disk
   */
  async saveDriftBaseline() {
    try {
      const baselineData = Object.fromEntries(this.driftBaseline.entries());
      await fs.writeJson(this.baselineFile, baselineData, { spaces: 2 });
    } catch (error) {
      consola.warn(`⚠️ Failed to save drift baseline: ${error.message}`);
    }
  },
  
  /**
   * Load drift baseline from disk
   */
  async loadDriftBaseline() {
    try {
      if (await fs.pathExists(this.baselineFile)) {
        const baselineData = await fs.readJson(this.baselineFile);
        this.driftBaseline = new Map(Object.entries(baselineData));
        consola.info(`📋 Loaded ${this.driftBaseline.size} baseline entries`);
      }
    } catch (error) {
      consola.warn(`⚠️ Failed to load drift baseline: ${error.message}`);
    }
  }
};

export default DriftHelperMethods;