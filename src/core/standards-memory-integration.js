/**
 * Standards Memory Integration
 * 
 * Integration module for storing ontology standards mapping in memory
 * Key: hive/standards/compliance
 */

import { createOntologyStandardsRegistry } from '../lib/ontology-standards.js';
import { SemanticValidator } from '../lib/semantic-validator.js';

/**
 * Memory storage interface for standards compliance data
 */
export class StandardsMemoryIntegration {
  constructor(options = {}) {
    this.memoryStore = options.memoryStore || new Map();
    this.baseKey = options.baseKey || 'hive/standards';
    this.registry = createOntologyStandardsRegistry(options);
    this.validator = new SemanticValidator(options);
  }

  /**
   * Store complete standards mapping in memory
   * @returns {Promise<Object>} Storage result
   */
  async storeStandardsMapping() {
    try {
      const mapping = this.registry.generateStandardsMapping();
      const validatorMapping = this.validator.getStandardsMapping();
      
      // Combine registry and validator data
      const completeMapping = {
        ...mapping,
        validation: validatorMapping,
        storage: {
          timestamp: new Date().toISOString(),
          key: `${this.baseKey}/compliance`,
          version: '1.0.0'
        }
      };

      // Store in memory with the required key
      const storageKey = `${this.baseKey}/compliance`;
      this.memoryStore.set(storageKey, completeMapping);

      // Also store individual vocabularies for quick access
      for (const [vocabName, vocab] of this.registry.getAllVocabularies()) {
        const vocabKey = `${this.baseKey}/vocabularies/${vocabName}`;
        this.memoryStore.set(vocabKey, vocab);
      }

      // Store interoperability data
      const interopKey = `${this.baseKey}/interoperability`;
      this.memoryStore.set(interopKey, {
        mappings: Array.from(this.registry.standardMappings.entries()),
        compliance: Array.from(this.registry.complianceRules.entries()),
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        key: storageKey,
        dataSize: JSON.stringify(completeMapping).length,
        vocabulariesStored: mapping.vocabularies ? Object.keys(mapping.vocabularies).length : 0,
        mappingsStored: mapping.mappings ? Object.keys(mapping.mappings).length : 0
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        key: `${this.baseKey}/compliance`
      };
    }
  }

  /**
   * Retrieve standards mapping from memory
   * @returns {Object|null} Stored standards mapping
   */
  retrieveStandardsMapping() {
    const storageKey = `${this.baseKey}/compliance`;
    return this.memoryStore.get(storageKey) || null;
  }

  /**
   * Get vocabulary by name from memory
   * @param {string} vocabName - Vocabulary name
   * @returns {Object|null} Vocabulary data
   */
  getVocabularyFromMemory(vocabName) {
    const vocabKey = `${this.baseKey}/vocabularies/${vocabName}`;
    return this.memoryStore.get(vocabKey) || null;
  }

  /**
   * Get interoperability data from memory
   * @returns {Object|null} Interoperability data
   */
  getInteroperabilityFromMemory() {
    const interopKey = `${this.baseKey}/interoperability`;
    return this.memoryStore.get(interopKey) || null;
  }

  /**
   * Update standards mapping with new data
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Update result
   */
  async updateStandardsMapping(updates) {
    try {
      const currentMapping = this.retrieveStandardsMapping();
      if (!currentMapping) {
        throw new Error('No existing standards mapping found');
      }

      const updatedMapping = {
        ...currentMapping,
        ...updates,
        storage: {
          ...currentMapping.storage,
          lastUpdated: new Date().toISOString(),
          version: this.incrementVersion(currentMapping.storage.version)
        }
      };

      const storageKey = `${this.baseKey}/compliance`;
      this.memoryStore.set(storageKey, updatedMapping);

      return {
        success: true,
        key: storageKey,
        version: updatedMapping.storage.version,
        updatedFields: Object.keys(updates)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clear all standards data from memory
   * @returns {Object} Clear result
   */
  clearStandardsData() {
    const keysToDelete = [];
    
    for (const key of this.memoryStore.keys()) {
      if (key.startsWith(this.baseKey)) {
        keysToDelete.push(key);
        this.memoryStore.delete(key);
      }
    }

    return {
      success: true,
      keysDeleted: keysToDelete.length,
      deletedKeys: keysToDelete
    };
  }

  /**
   * Get memory usage statistics
   * @returns {Object} Memory usage stats
   */
  getMemoryStats() {
    const standardsKeys = [];
    let totalSize = 0;

    for (const [key, value] of this.memoryStore.entries()) {
      if (key.startsWith(this.baseKey)) {
        standardsKeys.push(key);
        totalSize += JSON.stringify(value).length;
      }
    }

    return {
      totalKeys: standardsKeys.length,
      totalSize,
      averageSize: totalSize / (standardsKeys.length || 1),
      keys: standardsKeys,
      formattedSize: this.formatBytes(totalSize)
    };
  }

  /**
   * Validate stored standards mapping
   * @returns {Promise<Object>} Validation result
   */
  async validateStoredMapping() {
    try {
      const mapping = this.retrieveStandardsMapping();
      if (!mapping) {
        return {
          isValid: false,
          errors: ['No standards mapping found in memory'],
          warnings: []
        };
      }

      const errors = [];
      const warnings = [];

      // Validate structure
      if (!mapping.vocabularies) {
        errors.push('Missing vocabularies section');
      }
      if (!mapping.mappings) {
        errors.push('Missing mappings section');
      }
      if (!mapping.compliance) {
        errors.push('Missing compliance section');
      }
      if (!mapping.interoperability) {
        errors.push('Missing interoperability section');
      }

      // Validate vocabulary count
      const expectedVocabs = ['schema.org', 'foaf', 'dcterms', 'hr-xml', 'saro'];
      const actualVocabs = mapping.vocabularies ? Object.keys(mapping.vocabularies) : [];
      
      for (const vocab of expectedVocabs) {
        if (!actualVocabs.includes(vocab)) {
          warnings.push(`Missing expected vocabulary: ${vocab}`);
        }
      }

      // Validate timestamp
      if (!mapping.timestamp || !this.isValidDate(mapping.timestamp)) {
        warnings.push('Invalid or missing timestamp');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        statistics: {
          vocabulariesCount: actualVocabs.length,
          mappingsCount: mapping.mappings ? Object.keys(mapping.mappings).length : 0,
          complianceRulesCount: mapping.compliance ? Object.keys(mapping.compliance).length : 0
        }
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Export standards data for external tools
   * @param {string} format - Export format ('json', 'turtle', 'jsonld')
   * @returns {Object} Export result
   */
  async exportStandardsData(format = 'json') {
    try {
      const mapping = this.retrieveStandardsMapping();
      if (!mapping) {
        throw new Error('No standards mapping found');
      }

      let exportedData;
      let contentType;

      switch (format.toLowerCase()) {
        case 'json':
          exportedData = JSON.stringify(mapping, null, 2);
          contentType = 'application/json';
          break;
        
        case 'turtle':
          exportedData = this.convertToTurtle(mapping);
          contentType = 'text/turtle';
          break;
        
        case 'jsonld':
          exportedData = this.convertToJsonLd(mapping);
          contentType = 'application/ld+json';
          break;
        
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      return {
        success: true,
        format,
        contentType,
        data: exportedData,
        size: exportedData.length
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        format
      };
    }
  }

  /**
   * Helper methods
   */

  incrementVersion(version) {
    const parts = version.split('.');
    const patch = parseInt(parts[2] || '0') + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  isValidDate(dateString) {
    return !isNaN(Date.parse(dateString));
  }

  convertToTurtle(mapping) {
    // Basic Turtle conversion - in production would use proper RDF serialization
    let turtle = `@prefix unjucks: <https://unjucks.dev/standards/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

<https://unjucks.dev/standards/compliance> a unjucks:StandardsMapping ;
  dcterms:title "Unjucks Ontology Standards Compliance Mapping" ;
  dcterms:created "${mapping.timestamp}" ;
  dcterms:creator "Ontology Standards Expert Agent" ;
  unjucks:version "${mapping.version}" .
`;

    return turtle;
  }

  convertToJsonLd(mapping) {
    // Basic JSON-LD conversion
    return JSON.stringify({
      '@context': {
        'unjucks': 'https://unjucks.dev/standards/',
        'dcterms': 'http://purl.org/dc/terms/',
        'rdfs': 'http://www.w3.org/2000/01/rdf-schema#'
      },
      '@id': 'https://unjucks.dev/standards/compliance',
      '@type': 'unjucks:StandardsMapping',
      'dcterms:title': 'Unjucks Ontology Standards Compliance Mapping',
      'dcterms:created': mapping.timestamp,
      'unjucks:version': mapping.version,
      'unjucks:data': mapping
    }, null, 2);
  }
}

/**
 * Factory function to create standards memory integration
 * @param {Object} options - Configuration options
 * @returns {StandardsMemoryIntegration} Integration instance
 */
export function createStandardsMemoryIntegration(options = {}) {
  return new StandardsMemoryIntegration(options);
}

/**
 * Convenience function to store standards in global memory
 * @param {Map} memoryStore - Global memory store
 * @returns {Promise<Object>} Storage result
 */
export async function storeStandardsInMemory(memoryStore = new Map()) {
  const integration = createStandardsMemoryIntegration({ memoryStore });
  return await integration.storeStandardsMapping();
}

export default StandardsMemoryIntegration;