/**
 * RDF Serializers - Multi-format RDF serialization with byte-for-byte reproducible output
 * Extracted and refactored from RDF processor with deterministic serialization
 */

import { Writer } from 'n3';
import crypto from 'crypto';

export class RDFSerializers {
  constructor(config = {}) {
    this.config = {
      prettyPrint: config.prettyPrint !== false,
      deterministic: config.deterministic !== false,
      includeComments: config.includeComments === true,
      compression: config.compression || 'none',
      ...config
    };
  }

  /**
   * Serialize quads to specified RDF format
   * @param {Array} quads - Quads to serialize
   * @param {string} format - Target format (turtle, ntriples, nquads, jsonld, rdfxml)
   * @param {object} options - Serialization options
   * @returns {Promise<string>} Serialized RDF string
   */
  async serialize(quads, format = 'turtle', options = {}) {
    const opts = { ...this.config, ...options };
    
    // Ensure deterministic output if requested
    if (opts.deterministic) {
      quads = this._canonicalizeQuads(quads);
    }

    switch (format.toLowerCase()) {
      case 'turtle':
      case 'ttl':
        return this._serializeTurtle(quads, opts);
      
      case 'ntriples':
      case 'nt':
        return this._serializeNTriples(quads, opts);
      
      case 'nquads':
      case 'nq':
        return this._serializeNQuads(quads, opts);
      
      case 'jsonld':
      case 'json-ld':
        return this._serializeJSONLD(quads, opts);
      
      case 'rdfxml':
      case 'rdf/xml':
      case 'xml':
        return this._serializeRDFXML(quads, opts);
      
      case 'canonical':
        return this._serializeCanonical(quads, opts);
      
      default:
        throw new Error(`Unsupported serialization format: ${format}`);
    }
  }

  /**
   * Serialize to Turtle format
   * @param {Array} quads - Quads to serialize
   * @param {object} options - Serialization options
   * @returns {Promise<string>} Turtle string
   */
  async _serializeTurtle(quads, options = {}) {
    return new Promise((resolve, reject) => {
      const writer = new Writer({
        format: 'text/turtle',
        prefixes: options.prefixes || {},
        ...this._getWriterOptions(options)
      });

      writer.addQuads(quads);
      writer.end((error, result) => {
        if (error) {
          reject(new Error(`Turtle serialization failed: ${error.message}`));
        } else {
          resolve(this._postProcessOutput(result, options));
        }
      });
    });
  }

  /**
   * Serialize to N-Triples format
   * @param {Array} quads - Quads to serialize
   * @param {object} options - Serialization options
   * @returns {Promise<string>} N-Triples string
   */
  async _serializeNTriples(quads, options = {}) {
    return new Promise((resolve, reject) => {
      const writer = new Writer({
        format: 'application/n-triples',
        ...this._getWriterOptions(options)
      });

      writer.addQuads(quads);
      writer.end((error, result) => {
        if (error) {
          reject(new Error(`N-Triples serialization failed: ${error.message}`));
        } else {
          resolve(this._postProcessOutput(result, options));
        }
      });
    });
  }

  /**
   * Serialize to N-Quads format
   * @param {Array} quads - Quads to serialize
   * @param {object} options - Serialization options
   * @returns {Promise<string>} N-Quads string
   */
  async _serializeNQuads(quads, options = {}) {
    return new Promise((resolve, reject) => {
      const writer = new Writer({
        format: 'application/n-quads',
        ...this._getWriterOptions(options)
      });

      writer.addQuads(quads);
      writer.end((error, result) => {
        if (error) {
          reject(new Error(`N-Quads serialization failed: ${error.message}`));
        } else {
          resolve(this._postProcessOutput(result, options));
        }
      });
    });
  }

  /**
   * Serialize to JSON-LD format
   * @param {Array} quads - Quads to serialize
   * @param {object} options - Serialization options
   * @returns {Promise<string>} JSON-LD string
   */
  async _serializeJSONLD(quads, options = {}) {
    try {
      const jsonld = this._quadsToJSONLD(quads, options);
      const jsonString = options.deterministic 
        ? this._stringifyDeterministic(jsonld)
        : JSON.stringify(jsonld, null, options.prettyPrint ? 2 : 0);
      
      return jsonString;
    } catch (error) {
      throw new Error(`JSON-LD serialization failed: ${error.message}`);
    }
  }

  /**
   * Serialize to RDF/XML format
   * @param {Array} quads - Quads to serialize
   * @param {object} options - Serialization options
   * @returns {Promise<string>} RDF/XML string
   */
  async _serializeRDFXML(quads, options = {}) {
    // Basic RDF/XML serialization (would need more sophisticated implementation)
    const xml = this._quadsToRDFXML(quads, options);
    return xml;
  }

  /**
   * Serialize to canonical format for hashing
   * @param {Array} quads - Quads to serialize
   * @param {object} options - Serialization options
   * @returns {Promise<string>} Canonical string
   */
  async _serializeCanonical(quads, options = {}) {
    const canonicalQuads = this._canonicalizeQuads(quads);
    const lines = canonicalQuads.map(quad => this._quadToCanonicalString(quad));
    return lines.join('\n');
  }

  /**
   * Calculate serialization hash for content addressing
   * @param {Array} quads - Quads to hash
   * @param {string} format - Serialization format
   * @param {object} options - Hash options
   * @returns {Promise<string>} Content hash
   */
  async calculateHash(quads, format = 'canonical', options = {}) {
    const algorithm = options.algorithm || 'sha256';
    const opts = { ...options, deterministic: true };
    
    const serialized = await this.serialize(quads, format, opts);
    return crypto.createHash(algorithm).update(serialized, 'utf8').digest('hex');
  }

  /**
   * Create a content-addressed identifier for the serialized data
   * @param {Array} quads - Quads to identify
   * @param {object} options - Identification options
   * @returns {Promise<string>} Content identifier
   */
  async createContentId(quads, options = {}) {
    const hash = await this.calculateHash(quads, 'canonical', options);
    const prefix = options.prefix || 'kgen';
    const version = options.version || 'v1';
    
    return `${prefix}:${version}:${hash}`;
  }

  /**
   * Verify serialized data against expected hash
   * @param {string} serialized - Serialized RDF data
   * @param {string} expectedHash - Expected hash value
   * @param {object} options - Verification options
   * @returns {boolean} Verification result
   */
  verifyIntegrity(serialized, expectedHash, options = {}) {
    const algorithm = options.algorithm || 'sha256';
    const actualHash = crypto.createHash(algorithm).update(serialized, 'utf8').digest('hex');
    return actualHash === expectedHash;
  }

  /**
   * Create diff between two serializations
   * @param {string} serialized1 - First serialization
   * @param {string} serialized2 - Second serialization
   * @param {object} options - Diff options
   * @returns {object} Diff result
   */
  createDiff(serialized1, serialized2, options = {}) {
    const lines1 = serialized1.split('\n');
    const lines2 = serialized2.split('\n');
    
    const added = [];
    const removed = [];
    const common = [];
    
    const set1 = new Set(lines1);
    const set2 = new Set(lines2);
    
    for (const line of lines1) {
      if (!set2.has(line)) {
        removed.push(line);
      } else {
        common.push(line);
      }
    }
    
    for (const line of lines2) {
      if (!set1.has(line)) {
        added.push(line);
      }
    }
    
    return {
      added: added.length,
      removed: removed.length,
      common: common.length,
      addedLines: added,
      removedLines: removed,
      identical: added.length === 0 && removed.length === 0
    };
  }

  // Private helper methods

  _canonicalizeQuads(quads) {
    // Sort quads for deterministic output
    return [...quads].sort((a, b) => {
      const aStr = this._quadToSortKey(a);
      const bStr = this._quadToSortKey(b);
      return aStr.localeCompare(bStr);
    });
  }

  _quadToSortKey(quad) {
    return [
      this._termToSortKey(quad.subject),
      this._termToSortKey(quad.predicate),
      this._termToSortKey(quad.object),
      this._termToSortKey(quad.graph)
    ].join('|');
  }

  _termToSortKey(term) {
    if (term.termType === 'NamedNode') {
      return `1|${term.value}`;
    } else if (term.termType === 'BlankNode') {
      return `2|${term.value}`;
    } else if (term.termType === 'Literal') {
      const lang = term.language || '';
      const datatype = term.datatype ? term.datatype.value : '';
      return `3|${term.value}|${lang}|${datatype}`;
    } else if (term.termType === 'DefaultGraph') {
      return '0|';
    }
    return `9|${term.value || ''}`;
  }

  _quadToCanonicalString(quad) {
    const s = this._termToCanonicalString(quad.subject);
    const p = this._termToCanonicalString(quad.predicate);
    const o = this._termToCanonicalString(quad.object);
    const g = this._termToCanonicalString(quad.graph);
    
    return g ? `${s} ${p} ${o} ${g} .` : `${s} ${p} ${o} .`;
  }

  _termToCanonicalString(term) {
    if (term.termType === 'NamedNode') {
      return `<${term.value}>`;
    } else if (term.termType === 'Literal') {
      let result = `"${this._escapeLiteral(term.value)}"`;
      if (term.language) {
        result += `@${term.language}`;
      } else if (term.datatype && term.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string') {
        result += `^^<${term.datatype.value}>`;
      }
      return result;
    } else if (term.termType === 'BlankNode') {
      return `_:${term.value}`;
    } else if (term.termType === 'DefaultGraph') {
      return '';
    }
    return term.value || '';
  }

  _escapeLiteral(value) {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  _getWriterOptions(options) {
    const writerOptions = {};
    
    if (options.baseIRI) {
      writerOptions.baseIRI = options.baseIRI;
    }
    
    return writerOptions;
  }

  _postProcessOutput(result, options) {
    let output = result;
    
    // Add header comment if requested
    if (options.includeComments && options.header) {
      const header = `# ${options.header}\n# Generated: ${this.getDeterministicDate().toISOString()}\n\n`;
      output = header + output;
    }
    
    // Normalize line endings for deterministic output
    if (options.deterministic) {
      output = output.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }
    
    // Apply compression if requested
    if (options.compression !== 'none') {
      output = this._compressOutput(output, options.compression);
    }
    
    return output;
  }

  _compressOutput(output, compression) {
    switch (compression) {
      case 'whitespace':
        return output.replace(/\s+/g, ' ').trim();
      case 'minimal':
        return output.replace(/\s*\n\s*/g, '\n').replace(/\s*\.\s*/g, '.').trim();
      default:
        return output;
    }
  }

  _stringifyDeterministic(obj) {
    // Deterministic JSON stringification
    return JSON.stringify(obj, (key, value) => {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Sort object keys for deterministic output
        const sorted = {};
        Object.keys(value).sort().forEach(k => {
          sorted[k] = value[k];
        });
        return sorted;
      }
      return value;
    }, 0);
  }

  _quadsToJSONLD(quads, options) {
    // Basic JSON-LD conversion (would need more sophisticated implementation)
    const context = options.context || {};
    const graph = [];
    
    const subjectMap = new Map();
    
    for (const quad of quads) {
      const subjectId = this._termToJSONLDId(quad.subject);
      
      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, { '@id': subjectId });
      }
      
      const subject = subjectMap.get(subjectId);
      const predicate = this._termToJSONLDProperty(quad.predicate);
      const object = this._termToJSONLDValue(quad.object);
      
      if (subject[predicate]) {
        if (!Array.isArray(subject[predicate])) {
          subject[predicate] = [subject[predicate]];
        }
        subject[predicate].push(object);
      } else {
        subject[predicate] = object;
      }
    }
    
    return {
      '@context': context,
      '@graph': Array.from(subjectMap.values())
    };
  }

  _termToJSONLDId(term) {
    if (term.termType === 'NamedNode') {
      return term.value;
    } else if (term.termType === 'BlankNode') {
      return `_:${term.value}`;
    }
    return term.value;
  }

  _termToJSONLDProperty(term) {
    return term.value;
  }

  _termToJSONLDValue(term) {
    if (term.termType === 'NamedNode') {
      return { '@id': term.value };
    } else if (term.termType === 'Literal') {
      const value = { '@value': term.value };
      if (term.language) {
        value['@language'] = term.language;
      } else if (term.datatype && term.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string') {
        value['@type'] = term.datatype.value;
      }
      return value;
    } else if (term.termType === 'BlankNode') {
      return { '@id': `_:${term.value}` };
    }
    return term.value;
  }

  _quadsToRDFXML(quads, options) {
    // Basic RDF/XML structure
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"';
    
    // Add namespace declarations
    if (options.prefixes) {
      for (const [prefix, uri] of Object.entries(options.prefixes)) {
        xml += ` xmlns:${prefix}="${uri}"`;
      }
    }
    
    xml += '>\n';
    
    // Group quads by subject
    const subjectMap = new Map();
    for (const quad of quads) {
      const subjectKey = quad.subject.value;
      if (!subjectMap.has(subjectKey)) {
        subjectMap.set(subjectKey, []);
      }
      subjectMap.get(subjectKey).push(quad);
    }
    
    // Generate RDF/XML for each subject
    for (const [subjectUri, subjectQuads] of subjectMap) {
      if (subjectQuads[0].subject.termType === 'NamedNode') {
        xml += `  <rdf:Description rdf:about="${subjectUri}">\n`;
        
        for (const quad of subjectQuads) {
          const predicate = quad.predicate.value;
          const localName = this._extractLocalName(predicate);
          
          if (quad.object.termType === 'NamedNode') {
            xml += `    <${localName} rdf:resource="${quad.object.value}"/>\n`;
          } else if (quad.object.termType === 'Literal') {
            xml += `    <${localName}>${this._escapeXML(quad.object.value)}</${localName}>\n`;
          }
        }
        
        xml += '  </rdf:Description>\n';
      }
    }
    
    xml += '</rdf:RDF>';
    return xml;
  }

  _extractLocalName(uri) {
    const parts = uri.split('#');
    if (parts.length > 1) {
      return parts[1];
    }
    const pathParts = uri.split('/');
    return pathParts[pathParts.length - 1] || 'property';
  }

  _escapeXML(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Get supported serialization formats
   * @returns {Array<string>} Supported formats
   */
  getSupportedFormats() {
    return [
      'turtle', 'ttl',
      'ntriples', 'nt', 
      'nquads', 'nq',
      'jsonld', 'json-ld',
      'rdfxml', 'rdf/xml', 'xml',
      'canonical'
    ];
  }

  /**
   * Detect format from MIME type
   * @param {string} mimeType - MIME type
   * @returns {string|null} Format name or null
   */
  detectFormatFromMimeType(mimeType) {
    const mimeMap = {
      'text/turtle': 'turtle',
      'application/n-triples': 'ntriples',
      'application/n-quads': 'nquads',
      'application/ld+json': 'jsonld',
      'application/rdf+xml': 'rdfxml',
      'text/rdf+n3': 'turtle'
    };
    
    return mimeMap[mimeType] || null;
  }
}

export default RDFSerializers;