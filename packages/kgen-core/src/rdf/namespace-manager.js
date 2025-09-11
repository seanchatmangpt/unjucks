/**
 * Namespace Manager - Handles RDF namespace prefixes and URI expansion/compaction
 * Extracted and refactored from semantic processor
 */

import { EventEmitter } from 'events';

export class NamespaceManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.prefixes = new Map();
    this.reverseLookup = new Map();
    this.config = {
      autoRegister: config.autoRegister !== false,
      caseSensitive: config.caseSensitive !== false,
      validateURIs: config.validateURIs !== false,
      ...config
    };

    // Initialize with standard prefixes
    this._initializeStandardPrefixes();
    
    // Add custom prefixes if provided
    if (config.prefixes) {
      for (const [prefix, uri] of Object.entries(config.prefixes)) {
        this.addPrefix(prefix, uri);
      }
    }
  }

  /**
   * Add a namespace prefix
   * @param {string} prefix - Prefix name
   * @param {string} uri - Namespace URI
   * @param {object} options - Addition options
   * @returns {boolean} Success status
   */
  addPrefix(prefix, uri, options = {}) {
    // Validate inputs
    if (!this._isValidPrefix(prefix)) {
      throw new Error(`Invalid prefix: ${prefix}`);
    }
    
    if (this.config.validateURIs && !this._isValidURI(uri)) {
      throw new Error(`Invalid namespace URI: ${uri}`);
    }

    // Check for conflicts
    if (this.prefixes.has(prefix) && !options.overwrite) {
      const existing = this.prefixes.get(prefix);
      if (existing !== uri) {
        throw new Error(`Prefix ${prefix} already exists with different URI: ${existing}`);
      }
      return false; // No change needed
    }

    // Remove old reverse lookup if overwriting
    if (this.prefixes.has(prefix)) {
      const oldUri = this.prefixes.get(prefix);
      this.reverseLookup.delete(oldUri);
    }

    // Add new mapping
    this.prefixes.set(prefix, uri);
    this.reverseLookup.set(uri, prefix);

    this.emit('prefix-added', { prefix, uri, overwrite: !!options.overwrite });
    return true;
  }

  /**
   * Remove a namespace prefix
   * @param {string} prefix - Prefix to remove
   * @returns {boolean} Success status
   */
  removePrefix(prefix) {
    if (!this.prefixes.has(prefix)) {
      return false;
    }

    const uri = this.prefixes.get(prefix);
    this.prefixes.delete(prefix);
    this.reverseLookup.delete(uri);

    this.emit('prefix-removed', { prefix, uri });
    return true;
  }

  /**
   * Get namespace URI for a prefix
   * @param {string} prefix - Prefix name
   * @returns {string|null} Namespace URI or null if not found
   */
  getNamespaceURI(prefix) {
    return this.prefixes.get(prefix) || null;
  }

  /**
   * Get prefix for a namespace URI
   * @param {string} uri - Namespace URI
   * @returns {string|null} Prefix or null if not found
   */
  getPrefix(uri) {
    return this.reverseLookup.get(uri) || null;
  }

  /**
   * Expand a prefixed URI to full URI
   * @param {string} prefixedUri - Prefixed URI (e.g., "foaf:Person")
   * @returns {string} Full URI or original string if no prefix found
   */
  expand(prefixedUri) {
    if (!prefixedUri || typeof prefixedUri !== 'string') {
      return prefixedUri;
    }

    // Already a full URI
    if (this._isFullURI(prefixedUri)) {
      return prefixedUri;
    }

    const colonIndex = prefixedUri.indexOf(':');
    if (colonIndex === -1) {
      return prefixedUri; // No prefix
    }

    const prefix = prefixedUri.substring(0, colonIndex);
    const localName = prefixedUri.substring(colonIndex + 1);

    const namespaceURI = this.prefixes.get(prefix);
    if (namespaceURI) {
      return namespaceURI + localName;
    }

    // Auto-register if enabled and looks like a URI scheme
    if (this.config.autoRegister && this._looksLikeURIScheme(prefix)) {
      return prefixedUri; // Return as-is for URI schemes
    }

    return prefixedUri; // No expansion possible
  }

  /**
   * Compact a full URI to prefixed form
   * @param {string} fullUri - Full URI
   * @param {object} options - Compaction options
   * @returns {string} Prefixed URI or original URI if no prefix available
   */
  compact(fullUri, options = {}) {
    if (!fullUri || typeof fullUri !== 'string') {
      return fullUri;
    }

    // Not a full URI
    if (!this._isFullURI(fullUri)) {
      return fullUri;
    }

    // Find the longest matching namespace
    let bestMatch = null;
    let bestPrefix = null;
    let bestLocalName = null;

    for (const [prefix, namespaceURI] of this.prefixes) {
      if (fullUri.startsWith(namespaceURI)) {
        const localName = fullUri.substring(namespaceURI.length);
        
        // Prefer longer namespace matches and valid local names
        if ((!bestMatch || namespaceURI.length > bestMatch.length) &&
            this._isValidLocalName(localName, options)) {
          bestMatch = namespaceURI;
          bestPrefix = prefix;
          bestLocalName = localName;
        }
      }
    }

    if (bestPrefix && bestLocalName) {
      return `${bestPrefix}:${bestLocalName}`;
    }

    return fullUri;
  }

  /**
   * Expand multiple prefixed URIs
   * @param {Array<string>} prefixedUris - Array of prefixed URIs
   * @returns {Array<string>} Array of expanded URIs
   */
  expandAll(prefixedUris) {
    return prefixedUris.map(uri => this.expand(uri));
  }

  /**
   * Compact multiple full URIs
   * @param {Array<string>} fullUris - Array of full URIs
   * @param {object} options - Compaction options
   * @returns {Array<string>} Array of compacted URIs
   */
  compactAll(fullUris, options = {}) {
    return fullUris.map(uri => this.compact(uri, options));
  }

  /**
   * Get all registered prefixes
   * @returns {object} Prefix to URI mapping
   */
  getPrefixes() {
    return Object.fromEntries(this.prefixes);
  }

  /**
   * Get all namespaces
   * @returns {Array<string>} Array of namespace URIs
   */
  getNamespaces() {
    return Array.from(this.prefixes.values());
  }

  /**
   * Check if a prefix is registered
   * @param {string} prefix - Prefix to check
   * @returns {boolean} Registration status
   */
  hasPrefix(prefix) {
    return this.prefixes.has(prefix);
  }

  /**
   * Check if a namespace URI is registered
   * @param {string} uri - Namespace URI to check
   * @returns {boolean} Registration status
   */
  hasNamespace(uri) {
    return this.reverseLookup.has(uri);
  }

  /**
   * Clear all prefixes (except standard ones if preserveStandard is true)
   * @param {object} options - Clear options
   */
  clear(options = {}) {
    const preserveStandard = options.preserveStandard !== false;
    
    if (preserveStandard) {
      // Keep standard prefixes
      const standardPrefixes = this._getStandardPrefixes();
      const toRemove = [];
      
      for (const [prefix, uri] of this.prefixes) {
        if (!standardPrefixes[prefix]) {
          toRemove.push(prefix);
        }
      }
      
      for (const prefix of toRemove) {
        this.removePrefix(prefix);
      }
    } else {
      this.prefixes.clear();
      this.reverseLookup.clear();
    }

    this.emit('prefixes-cleared', { preserveStandard });
  }

  /**
   * Import prefixes from object or another namespace manager
   * @param {object|NamespaceManager} source - Source of prefixes
   * @param {object} options - Import options
   */
  importPrefixes(source, options = {}) {
    let prefixMap;

    if (source instanceof NamespaceManager) {
      prefixMap = source.getPrefixes();
    } else if (typeof source === 'object' && source !== null) {
      prefixMap = source;
    } else {
      throw new Error('Invalid prefix source');
    }

    let importedCount = 0;
    for (const [prefix, uri] of Object.entries(prefixMap)) {
      try {
        if (this.addPrefix(prefix, uri, { overwrite: options.overwrite })) {
          importedCount++;
        }
      } catch (error) {
        if (!options.ignoreErrors) {
          throw error;
        }
      }
    }

    this.emit('prefixes-imported', { count: importedCount, source: typeof source });
    return importedCount;
  }

  /**
   * Export prefixes to object
   * @param {object} options - Export options
   * @returns {object} Prefix to URI mapping
   */
  exportPrefixes(options = {}) {
    const exported = this.getPrefixes();
    
    if (options.excludeStandard) {
      const standardPrefixes = this._getStandardPrefixes();
      for (const prefix of Object.keys(standardPrefixes)) {
        delete exported[prefix];
      }
    }

    return exported;
  }

  /**
   * Get prefix suggestions for a URI
   * @param {string} uri - URI to find suggestions for
   * @param {number} maxSuggestions - Maximum number of suggestions
   * @returns {Array<string>} Suggested prefixes
   */
  getSuggestions(uri, maxSuggestions = 5) {
    const suggestions = [];
    
    // Check for partial matches
    for (const [prefix, namespaceURI] of this.prefixes) {
      if (uri.includes(namespaceURI) || namespaceURI.includes(uri)) {
        suggestions.push(prefix);
      }
    }

    // Generate suggestions based on URI structure
    if (suggestions.length < maxSuggestions) {
      const generated = this._generatePrefixSuggestions(uri);
      suggestions.push(...generated.slice(0, maxSuggestions - suggestions.length));
    }

    return suggestions.slice(0, maxSuggestions);
  }

  /**
   * Validate all registered prefixes and namespaces
   * @returns {object} Validation report
   */
  validate() {
    const report = {
      valid: true,
      errors: [],
      warnings: [],
      statistics: {
        totalPrefixes: this.prefixes.size,
        standardPrefixes: 0,
        customPrefixes: 0
      }
    };

    const standardPrefixes = this._getStandardPrefixes();

    for (const [prefix, uri] of this.prefixes) {
      // Check prefix validity
      if (!this._isValidPrefix(prefix)) {
        report.errors.push(`Invalid prefix format: ${prefix}`);
        report.valid = false;
      }

      // Check URI validity
      if (!this._isValidURI(uri)) {
        report.errors.push(`Invalid namespace URI: ${uri} for prefix ${prefix}`);
        report.valid = false;
      }

      // Update statistics
      if (standardPrefixes[prefix]) {
        report.statistics.standardPrefixes++;
      } else {
        report.statistics.customPrefixes++;
      }
    }

    // Check for orphaned reverse lookups
    for (const [uri, prefix] of this.reverseLookup) {
      if (!this.prefixes.has(prefix)) {
        report.warnings.push(`Orphaned reverse lookup: ${uri} -> ${prefix}`);
      }
    }

    return report;
  }

  // Private helper methods

  _initializeStandardPrefixes() {
    const standardPrefixes = this._getStandardPrefixes();
    for (const [prefix, uri] of Object.entries(standardPrefixes)) {
      this.prefixes.set(prefix, uri);
      this.reverseLookup.set(uri, prefix);
    }
  }

  _getStandardPrefixes() {
    return {
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      owl: 'http://www.w3.org/2002/07/owl#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      foaf: 'http://xmlns.com/foaf/0.1/',
      dcterms: 'http://purl.org/dc/terms/',
      dc: 'http://purl.org/dc/elements/1.1/',
      skos: 'http://www.w3.org/2004/02/skos/core#',
      sh: 'http://www.w3.org/ns/shacl#',
      prov: 'http://www.w3.org/ns/prov#',
      schema: 'http://schema.org/',
      dcat: 'http://www.w3.org/ns/dcat#',
      void: 'http://rdfs.org/ns/void#'
    };
  }

  _isValidPrefix(prefix) {
    // Empty prefix is allowed for default namespace
    if (prefix === '') return true;
    
    // Must start with letter, can contain letters, numbers, hyphens
    return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(prefix);
  }

  _isValidURI(uri) {
    if (!uri || typeof uri !== 'string') {
      return false;
    }

    try {
      new URL(uri);
      return true;
    } catch {
      // Check for URN format
      return /^urn:[a-z0-9][a-z0-9-]{0,31}:/.test(uri);
    }
  }

  _isFullURI(str) {
    return /^https?:\/\//.test(str) || /^urn:/.test(str) || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(str);
  }

  _looksLikeURIScheme(prefix) {
    return /^[a-zA-Z][a-zA-Z0-9+.-]*$/.test(prefix) && prefix.length <= 8;
  }

  _isValidLocalName(localName, options = {}) {
    if (!localName) return false;
    
    // Basic check for valid characters
    if (options.strict) {
      return /^[a-zA-Z0-9_-]+$/.test(localName);
    }
    
    // More permissive - just check it's not empty and doesn't start with invalid chars
    return localName.length > 0 && !/^[#?]/.test(localName);
  }

  _generatePrefixSuggestions(uri) {
    const suggestions = [];
    
    try {
      const url = new URL(uri);
      const hostname = url.hostname.replace(/^www\./, '');
      const parts = hostname.split('.');
      
      // Use domain parts as suggestions
      if (parts.length >= 2) {
        suggestions.push(parts[parts.length - 2]); // e.g., "example" from "example.com"
      }
      
      // Use path segments
      const pathSegments = url.pathname.split('/').filter(s => s.length > 0);
      if (pathSegments.length > 0) {
        suggestions.push(pathSegments[0]);
      }
      
    } catch {
      // Fallback for non-URL URIs
      const match = uri.match(/([a-zA-Z]+)/g);
      if (match) {
        suggestions.push(...match.slice(0, 3));
      }
    }
    
    return suggestions.map(s => s.toLowerCase()).filter((s, i, arr) => arr.indexOf(s) === i);
  }

  /**
   * Get statistics about registered prefixes
   * @returns {object} Namespace statistics
   */
  getStatistics() {
    const standardPrefixes = this._getStandardPrefixes();
    let standardCount = 0;
    let customCount = 0;

    for (const prefix of this.prefixes.keys()) {
      if (standardPrefixes[prefix]) {
        standardCount++;
      } else {
        customCount++;
      }
    }

    return {
      total: this.prefixes.size,
      standard: standardCount,
      custom: customCount,
      averageURILength: this._calculateAverageURILength(),
      duplicateNamespaces: this._findDuplicateNamespaces()
    };
  }

  _calculateAverageURILength() {
    if (this.prefixes.size === 0) return 0;
    
    const totalLength = Array.from(this.prefixes.values())
      .reduce((sum, uri) => sum + uri.length, 0);
    
    return Math.round(totalLength / this.prefixes.size);
  }

  _findDuplicateNamespaces() {
    const uriCounts = new Map();
    
    for (const uri of this.prefixes.values()) {
      uriCounts.set(uri, (uriCounts.get(uri) || 0) + 1);
    }
    
    return Array.from(uriCounts.entries())
      .filter(([uri, count]) => count > 1)
      .map(([uri, count]) => ({ uri, count }));
  }

  /**
   * Create a clone of this namespace manager
   * @returns {NamespaceManager} Cloned instance
   */
  clone() {
    const clone = new NamespaceManager(this.config);
    clone.importPrefixes(this, { overwrite: true });
    return clone;
  }
}

export default NamespaceManager;