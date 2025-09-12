/**
 * Result Serializer - Multi-format SPARQL result serialization
 * 
 * Supports JSON, XML, CSV, TSV, and RDF serialization formats
 * with streaming capabilities for large result sets.
 */

import { Consola } from 'consola';

export class ResultSerializer {
  constructor(config = {}) {
    this.config = {
      defaultFormat: 'json',
      enableStreaming: true,
      maxMemoryResults: 10000,
      ...config
    };
    
    this.logger = new Consola({ tag: 'result-serializer' });
  }

  /**
   * Serialize query results to specified format
   * @param {Object} results - SPARQL query results
   * @param {string} format - Output format (json, xml, csv, tsv, rdf)
   * @param {Object} options - Serialization options
   * @returns {Promise<string>} Serialized results
   */
  async serialize(results, format = 'json', options = {}) {
    try {
      this.logger.info(`Serializing ${results.results?.bindings?.length || 0} results to ${format}`);
      
      switch (format.toLowerCase()) {
        case 'json':
          return await this._serializeToJSON(results, options);
        case 'xml':
          return await this._serializeToXML(results, options);
        case 'csv':
          return await this._serializeToCSV(results, options);
        case 'tsv':
          return await this._serializeToTSV(results, options);
        case 'rdf':
          return await this._serializeToRDF(results, options);
        case 'table':
          return await this._serializeToTable(results, options);
        default:
          throw new Error(`Unsupported serialization format: ${format}`);
      }
    } catch (error) {
      this.logger.error('Serialization failed:', error);
      throw error;
    }
  }

  /**
   * Serialize to JSON format (SPARQL 1.1 Query Results JSON Format)
   */
  async _serializeToJSON(results, options) {
    const output = {
      head: {
        vars: results.head?.vars || []
      },
      results: {
        bindings: results.results?.bindings || []
      }
    };
    
    // Add links if present
    if (results.head?.link) {
      output.head.link = results.head.link;
    }
    
    // Add boolean result for ASK queries
    if (typeof results.boolean !== 'undefined') {
      output.boolean = results.boolean;
    }
    
    // Pretty print if requested
    const indent = options.pretty ? 2 : 0;
    return JSON.stringify(output, null, indent);
  }

  /**
   * Serialize to XML format (SPARQL Query Results XML Format)
   */
  async _serializeToXML(results, options) {
    const vars = results.head?.vars || [];
    const bindings = results.results?.bindings || [];
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<sparql xmlns="http://www.w3.org/2005/sparql-results#">\n';
    
    // Head section
    xml += '  <head>\n';
    for (const variable of vars) {
      xml += `    <variable name="${this._escapeXML(variable)}"/>\n`;
    }
    xml += '  </head>\n';
    
    // Results section
    if (typeof results.boolean !== 'undefined') {
      // ASK query result
      xml += `  <boolean>${results.boolean}</boolean>\n`;
    } else {
      // SELECT query results
      xml += '  <results>\n';
      
      for (const binding of bindings) {
        xml += '    <result>\n';
        
        for (const variable of vars) {
          if (binding[variable]) {
            const term = binding[variable];
            xml += `      <binding name="${this._escapeXML(variable)}">\n`;
            
            switch (term.type) {
              case 'uri':
                xml += `        <uri>${this._escapeXML(term.value)}</uri>\n`;
                break;
              case 'literal':
                if (term.datatype) {
                  xml += `        <literal datatype="${this._escapeXML(term.datatype)}">${this._escapeXML(term.value)}</literal>\n`;
                } else if (term.language) {
                  xml += `        <literal xml:lang="${this._escapeXML(term.language)}">${this._escapeXML(term.value)}</literal>\n`;
                } else {
                  xml += `        <literal>${this._escapeXML(term.value)}</literal>\n`;
                }
                break;
              case 'bnode':
                xml += `        <bnode>${this._escapeXML(term.value)}</bnode>\n`;
                break;
            }
            
            xml += '      </binding>\n';
          }
        }
        
        xml += '    </result>\n';
      }
      
      xml += '  </results>\n';
    }
    
    xml += '</sparql>\n';
    
    return xml;
  }

  /**
   * Serialize to CSV format
   */
  async _serializeToCSV(results, options) {
    const vars = results.head?.vars || [];
    const bindings = results.results?.bindings || [];
    
    if (vars.length === 0) return '';
    
    const separator = options.separator || ',';
    const quote = options.quote || '"';
    const escape = options.escape || quote + quote;
    
    // Header row
    let csv = vars.map(variable => this._escapeCSV(variable, quote, escape)).join(separator) + '\n';
    
    // Data rows
    for (const binding of bindings) {
      const row = vars.map(variable => {
        const term = binding[variable];
        if (!term) return '';
        
        let value = term.value;
        
        // Add type information if requested
        if (options.includeTypes && term.type !== 'literal') {
          value = `${value} [${term.type}]`;
        }
        
        return this._escapeCSV(value, quote, escape);
      });
      
      csv += row.join(separator) + '\n';
    }
    
    return csv;
  }

  /**
   * Serialize to TSV format (Tab-Separated Values)
   */
  async _serializeToTSV(results, options) {
    return await this._serializeToCSV(results, {
      ...options,
      separator: '\t',
      quote: '',
      escape: ''
    });
  }

  /**
   * Serialize to RDF format (for CONSTRUCT/DESCRIBE queries)
   */
  async _serializeToRDF(results, options) {
    const format = options.rdfFormat || 'turtle';
    
    if (results.results?.bindings) {
      // Convert SELECT results to RDF triples
      return await this._convertBindingsToRDF(results, format, options);
    }
    
    // If already RDF data, just format it
    if (results.triples) {
      return await this._formatRDFTriples(results.triples, format, options);
    }
    
    throw new Error('Cannot serialize to RDF: no RDF data found in results');
  }

  /**
   * Serialize to human-readable table format
   */
  async _serializeToTable(results, options) {
    const vars = results.head?.vars || [];
    const bindings = results.results?.bindings || [];
    
    if (vars.length === 0) return '';
    
    // Calculate column widths
    const widths = vars.map(variable => variable.length);
    
    for (const binding of bindings) {
      vars.forEach((variable, index) => {
        const term = binding[variable];
        const value = term ? term.value : '';
        widths[index] = Math.max(widths[index], value.length);
      });
    }
    
    // Create table
    let table = '';
    
    // Header
    const headerRow = vars.map((variable, index) => 
      variable.padEnd(widths[index])
    ).join(' | ');
    
    table += headerRow + '\n';
    table += vars.map((_, index) => '-'.repeat(widths[index])).join('-|-') + '\n';
    
    // Data rows
    for (const binding of bindings) {
      const row = vars.map((variable, index) => {
        const term = binding[variable];
        const value = term ? term.value : '';
        return value.padEnd(widths[index]);
      }).join(' | ');
      
      table += row + '\n';
    }
    
    return table;
  }

  /**
   * Convert SPARQL bindings to RDF triples
   */
  async _convertBindingsToRDF(results, format, options) {
    const { Store, Writer, DataFactory } = await import('n3');
    const { namedNode, literal, blankNode } = DataFactory;
    
    const store = new Store();
    const bindings = results.results.bindings;
    
    // Generate triples from bindings
    for (let i = 0; i < bindings.length; i++) {
      const binding = bindings[i];
      const subject = namedNode(`http://example.org/result/${i}`);
      
      for (const [variable, term] of Object.entries(binding)) {
        const predicate = namedNode(`http://example.org/var/${variable}`);
        let object;
        
        switch (term.type) {
          case 'uri':
            object = namedNode(term.value);
            break;
          case 'literal':
            if (term.datatype) {
              object = literal(term.value, namedNode(term.datatype));
            } else if (term.language) {
              object = literal(term.value, term.language);
            } else {
              object = literal(term.value);
            }
            break;
          case 'bnode':
            object = blankNode(term.value);
            break;
          default:
            object = literal(term.value);
        }
        
        store.addQuad(subject, predicate, object);
      }
    }
    
    // Serialize the store
    return new Promise((resolve, reject) => {
      const writer = new Writer({ format });
      writer.addQuads([...store]);
      writer.end((error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  /**
   * Format RDF triples to specified format
   */
  async _formatRDFTriples(triples, format, options) {
    const { Writer } = await import('n3');
    
    return new Promise((resolve, reject) => {
      const writer = new Writer({ format });
      writer.addQuads(triples);
      writer.end((error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  /**
   * Escape XML special characters
   */
  _escapeXML(text) {
    if (typeof text !== 'string') return text;
    
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Escape CSV values
   */
  _escapeCSV(value, quote, escape) {
    if (typeof value !== 'string') return value;
    
    // If value contains special characters, quote it
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
      return quote + value.replace(new RegExp(quote, 'g'), escape) + quote;
    }
    
    return value;
  }

  /**
   * Create streaming serializer for large result sets
   */
  createStreamingSerializer(format, options = {}) {
    return new StreamingResultSerializer(format, {
      ...this.config,
      ...options
    });
  }

  /**
   * Detect appropriate format from file extension
   */
  detectFormat(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    
    const formatMap = {
      'json': 'json',
      'xml': 'xml',
      'csv': 'csv',
      'tsv': 'tsv',
      'ttl': 'rdf',
      'turtle': 'rdf',
      'nt': 'rdf',
      'n3': 'rdf',
      'rdf': 'rdf'
    };
    
    return formatMap[ext] || this.config.defaultFormat;
  }
}

/**
 * Streaming Result Serializer for large datasets
 */
class StreamingResultSerializer {
  constructor(format, config = {}) {
    this.format = format;
    this.config = config;
    this.logger = new Consola({ tag: 'streaming-serializer' });
    this.serializer = new ResultSerializer(config);
  }

  /**
   * Create a stream processor for incremental serialization
   */
  async *processStream(resultStream) {
    let isFirst = true;
    let headers = [];
    
    try {
      for await (const chunk of resultStream) {
        if (isFirst) {
          headers = chunk.head?.vars || [];
          yield await this._serializeHeader(headers);
          isFirst = false;
        }
        
        for (const binding of chunk.results?.bindings || []) {
          yield await this._serializeBinding(binding, headers);
        }
      }
      
      yield await this._serializeFooter();
      
    } catch (error) {
      this.logger.error('Streaming serialization failed:', error);
      throw error;
    }
  }

  async _serializeHeader(vars) {
    switch (this.format) {
      case 'csv':
        return vars.join(',') + '\n';
      case 'xml':
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<sparql xmlns="http://www.w3.org/2005/sparql-results#">\n';
        xml += '  <head>\n';
        for (const variable of vars) {
          xml += `    <variable name="${variable}"/>\n`;
        }
        xml += '  </head>\n  <results>\n';
        return xml;
      case 'json':
        return `{"head":{"vars":[${vars.map(v => `"${v}"`).join(',')}]},"results":{"bindings":[`;
      default:
        return '';
    }
  }

  async _serializeBinding(binding, vars) {
    switch (this.format) {
      case 'csv':
        const row = vars.map(variable => {
          const term = binding[variable];
          return term ? term.value : '';
        });
        return row.join(',') + '\n';
      
      case 'xml':
        let xml = '    <result>\n';
        for (const variable of vars) {
          if (binding[variable]) {
            const term = binding[variable];
            xml += `      <binding name="${variable}">\n`;
            xml += `        <${term.type}>${term.value}</${term.type}>\n`;
            xml += '      </binding>\n';
          }
        }
        xml += '    </result>\n';
        return xml;
      
      case 'json':
        return JSON.stringify(binding) + ',';
      
      default:
        return '';
    }
  }

  async _serializeFooter() {
    switch (this.format) {
      case 'xml':
        return '  </results>\n</sparql>\n';
      case 'json':
        return ']}}\n';
      default:
        return '';
    }
  }
}

export default ResultSerializer;