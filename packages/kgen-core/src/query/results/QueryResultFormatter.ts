/**
 * Advanced Query Result Formatting and Serialization
 * 
 * High-performance result formatting with multiple output formats and streaming support
 */

import { 
  QueryResults, 
  Binding, 
  BindingValue,
  QueryResultMetadata 
} from '../types/index.js';
import { EventEmitter } from 'events';
import { Transform } from 'stream';

export interface FormatterOptions {
  format: 'sparql-json' | 'sparql-xml' | 'csv' | 'tsv' | 'turtle' | 'n3' | 'json-ld' | 'rdf-xml' | 'yaml' | 'custom';
  includeMetadata: boolean;
  prettyPrint: boolean;
  maxFieldLength: number;
  dateFormat: string;
  numberFormat: string;
  escapeHtml: boolean;
  includeHeaders: boolean;
  streaming: boolean;
  customSerializer?: (results: QueryResults) => string;
}

export interface SerializationStats {
  totalResults: number;
  serializedResults: number;
  skippedResults: number;
  outputSize: number;
  executionTime: number;
  warnings: string[];
}

export class QueryResultFormatter extends EventEmitter {
  private options: FormatterOptions;

  constructor(options: Partial<FormatterOptions> = {}) {
    super();
    
    this.options = {
      format: 'sparql-json',
      includeMetadata: true,
      prettyPrint: false,
      maxFieldLength: 10000,
      dateFormat: 'ISO8601',
      numberFormat: 'default',
      escapeHtml: false,
      includeHeaders: true,
      streaming: false,
      ...options
    };
  }

  /**
   * Format query results according to specified format
   */
  async formatResults(results: QueryResults, options?: Partial<FormatterOptions>): Promise<string> {
    const startTime = Date.now();
    const opts = { ...this.options, ...options };
    
    try {
      this.emit('formatting:started', { format: opts.format, resultCount: results.results.bindings.length });

      let formatted: string;
      const stats: SerializationStats = {
        totalResults: results.results.bindings.length,
        serializedResults: 0,
        skippedResults: 0,
        outputSize: 0,
        executionTime: 0,
        warnings: []
      };

      switch (opts.format) {
        case 'sparql-json':
          formatted = await this.formatSparqlJson(results, opts, stats);
          break;
        case 'sparql-xml':
          formatted = await this.formatSparqlXml(results, opts, stats);
          break;
        case 'csv':
          formatted = await this.formatCsv(results, opts, stats);
          break;
        case 'tsv':
          formatted = await this.formatTsv(results, opts, stats);
          break;
        case 'turtle':
          formatted = await this.formatTurtle(results, opts, stats);
          break;
        case 'n3':
          formatted = await this.formatN3(results, opts, stats);
          break;
        case 'json-ld':
          formatted = await this.formatJsonLd(results, opts, stats);
          break;
        case 'rdf-xml':
          formatted = await this.formatRdfXml(results, opts, stats);
          break;
        case 'yaml':
          formatted = await this.formatYaml(results, opts, stats);
          break;
        case 'custom':
          formatted = opts.customSerializer ? opts.customSerializer(results) : JSON.stringify(results);
          break;
        default:
          throw new Error(`Unsupported format: ${opts.format}`);
      }

      stats.executionTime = Date.now() - startTime;
      stats.outputSize = formatted.length;

      this.emit('formatting:completed', { stats, format: opts.format });

      return formatted;

    } catch (error) {
      this.emit('formatting:error', { error, format: opts.format });
      throw error;
    }
  }

  /**
   * Create streaming formatter for large result sets
   */
  createStreamFormatter(options?: Partial<FormatterOptions>): Transform {
    const opts = { ...this.options, ...options };
    let isFirstResult = true;
    let headerWritten = false;

    return new Transform({
      objectMode: true,
      transform(chunk: Binding, encoding, callback) {
        try {
          let output = '';

          if (!headerWritten && opts.includeHeaders) {
            switch (opts.format) {
              case 'csv':
                output += this.generateCsvHeader(chunk) + '\n';
                break;
              case 'tsv':
                output += this.generateTsvHeader(chunk) + '\n';
                break;
              case 'sparql-json':
                output += '{"head":{"vars":[' + Object.keys(chunk).map(k => `"${k}"`).join(',') + ']},"results":{"bindings":[';
                break;
              case 'sparql-xml':
                output += this.generateSparqlXmlHeader(chunk);
                break;
            }
            headerWritten = true;
          }

          switch (opts.format) {
            case 'csv':
              output += this.bindingToCsv(chunk, opts);
              break;
            case 'tsv':
              output += this.bindingToTsv(chunk, opts);
              break;
            case 'sparql-json':
              if (!isFirstResult) output += ',';
              output += this.bindingToSparqlJson(chunk, opts);
              break;
            case 'sparql-xml':
              output += this.bindingToSparqlXml(chunk, opts);
              break;
            default:
              output += JSON.stringify(chunk);
          }

          isFirstResult = false;
          callback(null, output);

        } catch (error) {
          callback(error);
        }
      }.bind(this),

      flush(callback) {
        let footer = '';

        switch (opts.format) {
          case 'sparql-json':
            footer = ']}}';
            break;
          case 'sparql-xml':
            footer = '</results></sparql>';
            break;
        }

        if (footer) {
          this.push(footer);
        }
        
        callback();
      }
    });
  }

  /**
   * Format results for template rendering context
   */
  formatForTemplate(results: QueryResults): Record<string, any> {
    const templateData: Record<string, any> = {
      meta: {
        resultCount: results.results.bindings.length,
        variables: results.head.vars,
        executionTime: results.metadata?.executionTime || 0,
        fromCache: results.fromCache || false,
        truncated: results.truncated || false
      },
      results: [],
      grouped: {},
      aggregated: {},
      transformed: {}
    };

    // Process each binding
    for (const binding of results.results.bindings) {
      const processedBinding: Record<string, any> = {};
      
      for (const [variable, value] of Object.entries(binding)) {
        processedBinding[variable] = this.processBindingValue(value);
      }
      
      templateData.results.push(processedBinding);
    }

    // Create grouped views
    templateData.grouped = this.createGroupedViews(templateData.results);

    // Create aggregated views
    templateData.aggregated = this.createAggregatedViews(templateData.results, results.head.vars);

    // Create transformed views
    templateData.transformed = this.createTransformedViews(templateData.results);

    return templateData;
  }

  /**
   * Generate summary statistics from results
   */
  generateSummaryStats(results: QueryResults): Record<string, any> {
    const stats: Record<string, any> = {
      totalResults: results.results.bindings.length,
      variables: results.head.vars.length,
      variableNames: results.head.vars,
      dataTypes: {},
      nullCounts: {},
      uniqueCounts: {},
      sampleValues: {}
    };

    // Initialize counters
    for (const variable of results.head.vars) {
      stats.dataTypes[variable] = {};
      stats.nullCounts[variable] = 0;
      stats.uniqueCounts[variable] = new Set();
      stats.sampleValues[variable] = [];
    }

    // Analyze bindings
    for (const binding of results.results.bindings) {
      for (const variable of results.head.vars) {
        if (binding[variable]) {
          const value = binding[variable];
          
          // Count data types
          if (!stats.dataTypes[variable][value.type]) {
            stats.dataTypes[variable][value.type] = 0;
          }
          stats.dataTypes[variable][value.type]++;
          
          // Track unique values
          stats.uniqueCounts[variable].add(value.value);
          
          // Collect sample values (up to 10)
          if (stats.sampleValues[variable].length < 10) {
            stats.sampleValues[variable].push(value.value);
          }
        } else {
          stats.nullCounts[variable]++;
        }
      }
    }

    // Convert Sets to counts
    for (const variable of results.head.vars) {
      stats.uniqueCounts[variable] = stats.uniqueCounts[variable].size;
    }

    return stats;
  }

  // Private formatting methods

  private async formatSparqlJson(
    results: QueryResults, 
    options: FormatterOptions, 
    stats: SerializationStats
  ): Promise<string> {
    const output = {
      head: { vars: results.head.vars },
      results: { bindings: [] as any[] }
    };

    if (options.includeMetadata && results.metadata) {
      output['@metadata'] = results.metadata;
    }

    for (const binding of results.results.bindings) {
      const processedBinding: Record<string, any> = {};
      
      for (const [variable, value] of Object.entries(binding)) {
        processedBinding[variable] = this.processBindingValue(value, options);
      }
      
      output.results.bindings.push(processedBinding);
      stats.serializedResults++;
    }

    return options.prettyPrint 
      ? JSON.stringify(output, null, 2)
      : JSON.stringify(output);
  }

  private async formatSparqlXml(
    results: QueryResults,
    options: FormatterOptions,
    stats: SerializationStats
  ): Promise<string> {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<sparql xmlns="http://www.w3.org/2005/sparql-results#">\n';
    
    // Head
    xml += '  <head>\n';
    for (const variable of results.head.vars) {
      xml += `    <variable name="${this.escapeXml(variable)}"/>\n`;
    }
    xml += '  </head>\n';

    // Results
    xml += '  <results>\n';
    
    for (const binding of results.results.bindings) {
      xml += '    <result>\n';
      
      for (const [variable, value] of Object.entries(binding)) {
        xml += `      <binding name="${this.escapeXml(variable)}">\n`;
        xml += this.bindingValueToXml(value, options);
        xml += '      </binding>\n';
      }
      
      xml += '    </result>\n';
      stats.serializedResults++;
    }

    xml += '  </results>\n';
    xml += '</sparql>';

    return xml;
  }

  private async formatCsv(
    results: QueryResults,
    options: FormatterOptions,
    stats: SerializationStats
  ): Promise<string> {
    const lines: string[] = [];
    
    // Header
    if (options.includeHeaders) {
      lines.push(results.head.vars.map(v => this.escapeCsv(v)).join(','));
    }

    // Data rows
    for (const binding of results.results.bindings) {
      const row: string[] = [];
      
      for (const variable of results.head.vars) {
        const value = binding[variable];
        row.push(value ? this.escapeCsv(this.bindingValueToString(value, options)) : '');
      }
      
      lines.push(row.join(','));
      stats.serializedResults++;
    }

    return lines.join('\n');
  }

  private async formatTsv(
    results: QueryResults,
    options: FormatterOptions,
    stats: SerializationStats
  ): Promise<string> {
    const lines: string[] = [];
    
    // Header
    if (options.includeHeaders) {
      lines.push(results.head.vars.map(v => this.escapeTsv(v)).join('\t'));
    }

    // Data rows
    for (const binding of results.results.bindings) {
      const row: string[] = [];
      
      for (const variable of results.head.vars) {
        const value = binding[variable];
        row.push(value ? this.escapeTsv(this.bindingValueToString(value, options)) : '');
      }
      
      lines.push(row.join('\t'));
      stats.serializedResults++;
    }

    return lines.join('\n');
  }

  private async formatTurtle(
    results: QueryResults,
    options: FormatterOptions,
    stats: SerializationStats
  ): Promise<string> {
    const prefixes: string[] = [
      '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .',
      '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
      '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .',
      ''
    ];

    const triples: string[] = [];
    
    for (const binding of results.results.bindings) {
      if (binding.subject && binding.predicate && binding.object) {
        const subject = this.bindingValueToTurtle(binding.subject);
        const predicate = this.bindingValueToTurtle(binding.predicate);
        const object = this.bindingValueToTurtle(binding.object);
        
        triples.push(`${subject} ${predicate} ${object} .`);
        stats.serializedResults++;
      }
    }

    return [...prefixes, ...triples].join('\n');
  }

  private async formatN3(
    results: QueryResults,
    options: FormatterOptions,
    stats: SerializationStats
  ): Promise<string> {
    // N3 is similar to Turtle but with some extensions
    return this.formatTurtle(results, options, stats);
  }

  private async formatJsonLd(
    results: QueryResults,
    options: FormatterOptions,
    stats: SerializationStats
  ): Promise<string> {
    const context = {
      "@context": {
        "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
        "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
        "xsd": "http://www.w3.org/2001/XMLSchema#"
      },
      "@graph": [] as any[]
    };

    for (const binding of results.results.bindings) {
      const entity: Record<string, any> = {};
      
      if (binding.subject) {
        entity["@id"] = binding.subject.value;
      }

      for (const [variable, value] of Object.entries(binding)) {
        if (variable !== 'subject') {
          entity[variable] = this.bindingValueToJsonLd(value);
        }
      }

      context["@graph"].push(entity);
      stats.serializedResults++;
    }

    return options.prettyPrint 
      ? JSON.stringify(context, null, 2)
      : JSON.stringify(context);
  }

  private async formatRdfXml(
    results: QueryResults,
    options: FormatterOptions,
    stats: SerializationStats
  ): Promise<string> {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"\n';
    xml += '         xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#">\n';

    for (const binding of results.results.bindings) {
      if (binding.subject) {
        xml += `  <rdf:Description rdf:about="${this.escapeXml(binding.subject.value)}">\n`;
        
        for (const [variable, value] of Object.entries(binding)) {
          if (variable !== 'subject' && value) {
            xml += `    <${variable}`;
            
            if (value.type === 'literal') {
              if (value.datatype) {
                xml += ` rdf:datatype="${this.escapeXml(value.datatype)}"`;
              } else if (value.language) {
                xml += ` xml:lang="${this.escapeXml(value.language)}"`;
              }
              xml += `>${this.escapeXml(value.value)}</${variable}>\n`;
            } else {
              xml += ` rdf:resource="${this.escapeXml(value.value)}"/>\n`;
            }
          }
        }
        
        xml += '  </rdf:Description>\n';
        stats.serializedResults++;
      }
    }

    xml += '</rdf:RDF>';
    return xml;
  }

  private async formatYaml(
    results: QueryResults,
    options: FormatterOptions,
    stats: SerializationStats
  ): Promise<string> {
    const yamlData = {
      head: { vars: results.head.vars },
      results: { bindings: [] as any[] }
    };

    if (options.includeMetadata && results.metadata) {
      yamlData['metadata'] = results.metadata;
    }

    for (const binding of results.results.bindings) {
      const processedBinding: Record<string, any> = {};
      
      for (const [variable, value] of Object.entries(binding)) {
        processedBinding[variable] = this.processBindingValue(value, options);
      }
      
      yamlData.results.bindings.push(processedBinding);
      stats.serializedResults++;
    }

    return this.toYaml(yamlData);
  }

  // Helper methods

  private processBindingValue(value: BindingValue, options?: FormatterOptions): any {
    const processed: any = { type: value.type, value: value.value };
    
    if (value.datatype) processed.datatype = value.datatype;
    if (value.language) processed.language = value.language;
    
    // Apply transformations based on options
    if (options) {
      if (options.maxFieldLength && value.value.length > options.maxFieldLength) {
        processed.value = value.value.substring(0, options.maxFieldLength) + '...';
        processed.truncated = true;
      }
      
      if (options.escapeHtml) {
        processed.value = this.escapeHtml(processed.value);
      }
    }
    
    return processed;
  }

  private bindingValueToString(value: BindingValue, options: FormatterOptions): string {
    let result = value.value;
    
    // Apply formatting based on data type
    if (value.datatype) {
      switch (value.datatype) {
        case 'http://www.w3.org/2001/XMLSchema#dateTime':
          if (options.dateFormat === 'ISO8601') {
            result = new Date(value.value).toISOString();
          }
          break;
        case 'http://www.w3.org/2001/XMLSchema#decimal':
        case 'http://www.w3.org/2001/XMLSchema#double':
          if (options.numberFormat !== 'default') {
            result = parseFloat(value.value).toLocaleString();
          }
          break;
      }
    }
    
    return result;
  }

  private bindingValueToXml(value: BindingValue, options: FormatterOptions): string {
    switch (value.type) {
      case 'uri':
        return `        <uri>${this.escapeXml(value.value)}</uri>\n`;
      case 'literal':
        let literal = `        <literal`;
        if (value.datatype) {
          literal += ` datatype="${this.escapeXml(value.datatype)}"`;
        } else if (value.language) {
          literal += ` xml:lang="${this.escapeXml(value.language)}"`;
        }
        literal += `>${this.escapeXml(value.value)}</literal>\n`;
        return literal;
      case 'bnode':
        return `        <bnode>${this.escapeXml(value.value)}</bnode>\n`;
      default:
        return `        <unknown>${this.escapeXml(value.value)}</unknown>\n`;
    }
  }

  private bindingValueToTurtle(value: BindingValue): string {
    switch (value.type) {
      case 'uri':
        return `<${value.value}>`;
      case 'literal':
        let literal = `"${value.value.replace(/"/g, '\\"')}"`;
        if (value.datatype) {
          literal += `^^<${value.datatype}>`;
        } else if (value.language) {
          literal += `@${value.language}`;
        }
        return literal;
      case 'bnode':
        return `_:${value.value}`;
      default:
        return `"${value.value}"`;
    }
  }

  private bindingValueToJsonLd(value: BindingValue): any {
    switch (value.type) {
      case 'uri':
        return { "@id": value.value };
      case 'literal':
        const result: any = { "@value": value.value };
        if (value.datatype) {
          result["@type"] = value.datatype;
        } else if (value.language) {
          result["@language"] = value.language;
        }
        return result;
      default:
        return value.value;
    }
  }

  private bindingToCsv(binding: Binding, options: FormatterOptions): string {
    // Implementation for streaming CSV conversion
    return ''; // Simplified
  }

  private bindingToTsv(binding: Binding, options: FormatterOptions): string {
    // Implementation for streaming TSV conversion
    return ''; // Simplified
  }

  private bindingToSparqlJson(binding: Binding, options: FormatterOptions): string {
    return JSON.stringify(binding);
  }

  private bindingToSparqlXml(binding: Binding, options: FormatterOptions): string {
    // Implementation for streaming XML conversion
    return ''; // Simplified
  }

  private createGroupedViews(results: Array<Record<string, any>>): Record<string, any> {
    const grouped: Record<string, any> = {};
    
    // Group by each variable
    for (const result of results) {
      for (const [variable, value] of Object.entries(result)) {
        if (!grouped[variable]) {
          grouped[variable] = {};
        }
        
        const key = typeof value === 'object' ? JSON.stringify(value) : String(value);
        if (!grouped[variable][key]) {
          grouped[variable][key] = [];
        }
        
        grouped[variable][key].push(result);
      }
    }
    
    return grouped;
  }

  private createAggregatedViews(results: Array<Record<string, any>>, variables: string[]): Record<string, any> {
    const aggregated: Record<string, any> = {};
    
    for (const variable of variables) {
      const values = results.map(r => r[variable]).filter(v => v !== undefined);
      
      aggregated[variable] = {
        count: values.length,
        unique: [...new Set(values.map(v => typeof v === 'object' ? JSON.stringify(v) : v))].length,
        samples: values.slice(0, 10)
      };
    }
    
    return aggregated;
  }

  private createTransformedViews(results: Array<Record<string, any>>): Record<string, any> {
    return {
      flat: results.map(r => Object.values(r)),
      keys: results.map(r => Object.keys(r)),
      pairs: results.map(r => Object.entries(r))
    };
  }

  // Utility methods for escaping

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  private escapeCsv(text: string): string {
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  private escapeTsv(text: string): string {
    return text
      .replace(/\t/g, '\\t')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }

  private toYaml(obj: any, indent: number = 0): string {
    const spaces = ' '.repeat(indent);
    
    if (obj === null) return 'null';
    if (typeof obj === 'boolean') return obj.toString();
    if (typeof obj === 'number') return obj.toString();
    if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"')}"`;
    
    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      return '\n' + obj.map(item => `${spaces}- ${this.toYaml(item, indent + 2).trim()}`).join('\n');
    }
    
    if (typeof obj === 'object') {
      const keys = Object.keys(obj);
      if (keys.length === 0) return '{}';
      
      return '\n' + keys.map(key => {
        const value = this.toYaml(obj[key], indent + 2);
        return `${spaces}${key}: ${value.trim()}`;
      }).join('\n');
    }
    
    return obj.toString();
  }

  private generateCsvHeader(binding: Binding): string {
    return Object.keys(binding).map(k => this.escapeCsv(k)).join(',');
  }

  private generateTsvHeader(binding: Binding): string {
    return Object.keys(binding).map(k => this.escapeTsv(k)).join('\t');
  }

  private generateSparqlXmlHeader(binding: Binding): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<sparql xmlns="http://www.w3.org/2005/sparql-results#">\n';
    xml += '  <head>\n';
    for (const variable of Object.keys(binding)) {
      xml += `    <variable name="${this.escapeXml(variable)}"/>\n`;
    }
    xml += '  </head>\n';
    xml += '  <results>\n';
    return xml;
  }
}

export default QueryResultFormatter;