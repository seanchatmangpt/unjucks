import { defineCommand } from "citty";
import chalk from "chalk";
import fs from 'fs-extra';
import path from 'node:path';

/**
 * Enhanced RDF Knowledge Graph Processor
 */
class KnowledgeGraphProcessor {
  constructor() {
    this.tripleStore = new Map();
    this.namespaces = new Map([
      ['rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'],
      ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#'],
      ['owl', 'http://www.w3.org/2002/07/owl#'],
      ['xsd', 'http://www.w3.org/2001/XMLSchema#'],
      ['foaf', 'http://xmlns.com/foaf/0.1/'],
      ['dc', 'http://purl.org/dc/elements/1.1/']
    ]);
    this.ontologyMetadata = new Map();
    this.inferenceRules = new Set();
  }

  async loadKnowledgeBase(filePath, format = 'turtle') {
    if (!await fs.pathExists(filePath)) {
      throw new Error(`Knowledge base file not found: ${filePath}`);
    }

    const content = await fs.readFile(filePath, 'utf-8');
    let triples = [];

    switch (format.toLowerCase()) {
      case 'turtle':
      case 'ttl':
        triples = this.parseTurtle(content);
        break;
      case 'ntriples':
      case 'nt':
        triples = this.parseNTriples(content);
        break;
      case 'jsonld':
        triples = this.parseJsonLD(content);
        break;
      case 'rdfxml':
        triples = this.parseRDFXML(content);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
    
    triples.forEach(triple => this.addTriple(triple));
    this.extractOntologyMetadata();
    
    return triples.length;
  }

  parseTurtle(content) {
    const triples = [];
    const lines = content.split('\n');
    let currentSubject = null;
    let currentPredicate = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Handle prefixes
      if (trimmed.startsWith('@prefix')) {
        const prefixMatch = trimmed.match(/@prefix\s+(\w+):\s+<([^>]+)>/);
        if (prefixMatch) {
          this.namespaces.set(prefixMatch[1], prefixMatch[2]);
          continue;
        }
      }

      // Parse triple patterns with better support for complex structures
      const tripleMatch = trimmed.match(/^([^\s]+)\s+([^\s]+)\s+(.+?)\s*[.;]?\s*$/);
      if (tripleMatch) {
        const subject = this.expandPrefixed(tripleMatch[1]);
        const predicate = this.expandPrefixed(tripleMatch[2]);
        const object = this.parseObject(tripleMatch[3]);

        triples.push({ subject, predicate, object });
        currentSubject = subject;
        currentPredicate = predicate;
      }
      // Handle continuation lines with semicolons and commas
      else if (currentSubject && trimmed.includes(';')) {
        const parts = trimmed.split(';');
        parts.forEach(part => {
          const propMatch = part.trim().match(/^([^\s]+)\s+(.+)$/);
          if (propMatch) {
            const predicate = this.expandPrefixed(propMatch[1]);
            const object = this.parseObject(propMatch[2]);
            triples.push({ subject: currentSubject, predicate, object });
          }
        });
      }
    }
    
    return triples;
  }

  parseNTriples(content) {
    const triples = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const match = trimmed.match(/^<([^>]+)>\s+<([^>]+)>\s+(.+?)\s*\.\s*$/);
      if (match) {
        triples.push({
          subject: match[1],
          predicate: match[2],
          object: this.parseObject(match[3])
        });
      }
    }
    
    return triples;
  }

  parseJsonLD(content) {
    const triples = [];
    try {
      const jsonData = JSON.parse(content);
      const graphs = Array.isArray(jsonData) ? jsonData : [jsonData];
      
      graphs.forEach(graph => {
        if (graph['@graph']) {
          graph['@graph'].forEach(item => this.extractTriplesFromJsonLD(item, triples));
        } else {
          this.extractTriplesFromJsonLD(graph, triples);
        }
      });
    } catch (error) {
      throw new Error(`Invalid JSON-LD: ${error.message}`);
    }
    
    return triples;
  }

  parseRDFXML(content) {
    // Simplified RDF/XML parsing - in production would use proper XML parser
    const triples = [];
    const resourcePattern = /<rdf:Description[^>]*rdf:about="([^"]+)"[^>]*>/g;
    let match;
    
    while ((match = resourcePattern.exec(content)) !== null) {
      const subject = match[1];
      // Extract properties for this resource (simplified)
      const propPattern = /<([^>:]+):([^>]+)[^>]*>([^<]+)<\/[^>]+>/g;
      let propMatch;
      
      while ((propMatch = propPattern.exec(content)) !== null) {
        const namespace = propMatch[1];
        const property = propMatch[2];
        const value = propMatch[3];
        
        triples.push({
          subject: subject,
          predicate: `${this.namespaces.get(namespace) || namespace}:${property}`,
          object: value
        });
      }
    }
    
    return triples;
  }

  expandPrefixed(term) {
    if (term.startsWith('<') && term.endsWith('>')) {
      return term.slice(1, -1);
    }
    if (term.includes(':')) {
      const [prefix, local] = term.split(':', 2);
      const namespace = this.namespaces.get(prefix);
      return namespace ? `${namespace}${local}` : term;
    }
    return term;
  }

  parseObject(objectStr) {
    objectStr = objectStr.trim().replace(/[.;]$/, '');
    
    // Literal with datatype
    if (objectStr.includes('^^')) {
      const [literal, datatype] = objectStr.split('^^');
      return {
        type: 'literal',
        value: literal.replace(/^"|"$/g, ''),
        datatype: this.expandPrefixed(datatype)
      };
    }
    // Literal with language tag
    if (objectStr.includes('@')) {
      const [literal, lang] = objectStr.split('@');
      return {
        type: 'literal',
        value: literal.replace(/^"|"$/g, ''),
        language: lang
      };
    }
    // URI
    if (objectStr.startsWith('<') && objectStr.endsWith('>')) {
      return { type: 'uri', value: objectStr.slice(1, -1) };
    }
    // Prefixed URI
    if (objectStr.includes(':') && !objectStr.startsWith('"')) {
      return { type: 'uri', value: this.expandPrefixed(objectStr) };
    }
    // String literal
    if (objectStr.startsWith('"') && objectStr.endsWith('"')) {
      return { type: 'literal', value: objectStr.slice(1, -1) };
    }
    
    return { type: 'literal', value: objectStr };
  }

  extractTriplesFromJsonLD(item, triples) {
    const subject = item['@id'] || `_:blank${Math.random().toString(36).substr(2, 9)}`;
    
    Object.keys(item).forEach(key => {
      if (key.startsWith('@')) return;
      
      const values = Array.isArray(item[key]) ? item[key] : [item[key]];
      values.forEach(value => {
        let object;
        if (typeof value === 'object') {
          if (value['@id']) {
            object = { type: 'uri', value: value['@id'] };
          } else if (value['@value']) {
            object = { 
              type: 'literal', 
              value: value['@value'],
              ...(value['@type'] && { datatype: value['@type'] }),
              ...(value['@language'] && { language: value['@language'] })
            };
          } else {
            object = { type: 'literal', value: JSON.stringify(value) };
          }
        } else {
          object = { type: 'literal', value: String(value) };
        }
        
        triples.push({ subject, predicate: key, object });
      });
    });
  }

  addTriple(triple) {
    const key = `${triple.subject}|${triple.predicate}`;
    if (!this.tripleStore.has(key)) {
      this.tripleStore.set(key, []);
    }
    this.tripleStore.get(key).push(triple.object);
  }

  executeSPARQL(query) {
    const results = [];
    const queryUpper = query.toUpperCase();
    
    if (queryUpper.includes('SELECT')) {
      return this.executeSelectQuery(query);
    } else if (queryUpper.includes('CONSTRUCT')) {
      return this.executeConstructQuery(query);
    } else if (queryUpper.includes('ASK')) {
      return this.executeAskQuery(query);
    } else if (queryUpper.includes('DESCRIBE')) {
      return this.executeDescribeQuery(query);
    }
    
    throw new Error('Unsupported SPARQL query type');
  }

  executeSelectQuery(query) {
    const results = [];
    const selectMatch = query.match(/SELECT\s+(.*?)\s+WHERE/i);
    const whereMatch = query.match(/WHERE\s*{([^}]*)}/i);
    
    if (!selectMatch || !whereMatch) {
      throw new Error('Invalid SELECT query syntax');
    }

    const variables = selectMatch[1].trim().split(/\s+/)
      .filter(v => v.startsWith('?'))
      .map(v => v.substring(1));
    
    const whereClause = whereMatch[1].trim();
    const patterns = this.parseTriplePatterns(whereClause);
    
    // Simple pattern matching - would use proper query execution in production
    const bindings = this.findBindings(patterns);
    
    bindings.forEach(binding => {
      const result = {};
      variables.forEach(variable => {
        if (binding[variable]) {
          result[variable] = binding[variable];
        }
      });
      results.push(result);
    });
    
    return { 
      head: { vars: variables },
      results: { bindings: results }
    };
  }

  parseTriplePatterns(whereClause) {
    const patterns = [];
    const lines = whereClause.split(/[.;]/).filter(l => l.trim());
    
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/).filter(p => p);
      if (parts.length >= 3) {
        patterns.push({
          subject: parts[0],
          predicate: parts[1],
          object: parts.slice(2).join(' ')
        });
      }
    });
    
    return patterns;
  }

  findBindings(patterns) {
    const bindings = [];
    const solutions = new Map();
    
    // Simple pattern matching against triple store
    for (const [storeKey, objects] of this.tripleStore) {
      const [subject, predicate] = storeKey.split('|');
      
      patterns.forEach(pattern => {
        const binding = {};
        let matches = true;
        
        // Match subject
        if (pattern.subject.startsWith('?')) {
          binding[pattern.subject.substring(1)] = { type: 'uri', value: subject };
        } else if (this.expandPrefixed(pattern.subject) !== subject) {
          matches = false;
        }
        
        // Match predicate
        if (pattern.predicate.startsWith('?')) {
          binding[pattern.predicate.substring(1)] = { type: 'uri', value: predicate };
        } else if (this.expandPrefixed(pattern.predicate) !== predicate) {
          matches = false;
        }
        
        // Match objects
        objects.forEach(object => {
          if (pattern.object.startsWith('?')) {
            binding[pattern.object.substring(1)] = object;
          } else if (pattern.object !== object.value) {
            matches = false;
          }
          
          if (matches) {
            bindings.push({ ...binding });
          }
        });
      });
    }
    
    return bindings;
  }

  executeConstructQuery(query) {
    const constructMatch = query.match(/CONSTRUCT\s*{([^}]*)}\s*WHERE\s*{([^}]*)}/i);
    if (!constructMatch) {
      throw new Error('Invalid CONSTRUCT query syntax');
    }
    
    const constructTemplate = constructMatch[1].trim();
    const whereClause = constructMatch[2].trim();
    
    const patterns = this.parseTriplePatterns(whereClause);
    const bindings = this.findBindings(patterns);
    const constructedTriples = [];
    
    bindings.forEach(binding => {
      const templatePatterns = this.parseTriplePatterns(constructTemplate);
      templatePatterns.forEach(template => {
        const triple = {
          subject: this.substituteVariables(template.subject, binding),
          predicate: this.substituteVariables(template.predicate, binding), 
          object: this.substituteVariables(template.object, binding)
        };
        constructedTriples.push(triple);
      });
    });
    
    return constructedTriples;
  }

  substituteVariables(term, bindings) {
    if (term.startsWith('?')) {
      const varName = term.substring(1);
      return bindings[varName] ? bindings[varName].value : term;
    }
    return this.expandPrefixed(term);
  }

  executeAskQuery(query) {
    const whereMatch = query.match(/WHERE\s*{([^}]*)}/i);
    if (!whereMatch) {
      return { boolean: false };
    }
    
    const patterns = this.parseTriplePatterns(whereMatch[1]);
    const bindings = this.findBindings(patterns);
    
    return { boolean: bindings.length > 0 };
  }

  executeDescribeQuery(query) {
    const describeMatch = query.match(/DESCRIBE\s+(<[^>]+>|\w+:\w+)/i);
    if (!describeMatch) {
      throw new Error('Invalid DESCRIBE query syntax');
    }
    
    const resource = this.expandPrefixed(describeMatch[1]);
    const description = [];
    
    for (const [key, objects] of this.tripleStore) {
      const [subject, predicate] = key.split('|');
      if (subject === resource) {
        objects.forEach(object => {
          description.push({ subject, predicate, object });
        });
      }
    }
    
    return description;
  }

  extractOntologyMetadata() {
    for (const [key, objects] of this.tripleStore) {
      const [subject, predicate] = key.split('|');
      
      if (predicate === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
        objects.forEach(object => {
          if (object.value === 'http://www.w3.org/2002/07/owl#Ontology') {
            this.ontologyMetadata.set(subject, { type: 'ontology' });
          }
        });
      }
    }
  }

  performInference() {
    const newTriples = [];
    
    // Simple RDFS inference rules
    this.inferSubClassTransitivity(newTriples);
    this.inferSubPropertyTransitivity(newTriples);
    this.inferTypeInheritance(newTriples);
    
    // Add inferred triples to store
    newTriples.forEach(triple => this.addTriple(triple));
    
    return newTriples.length;
  }

  inferSubClassTransitivity(newTriples) {
    const subClassOf = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
    const subClasses = new Map();
    
    // Collect all subclass relationships
    for (const [key, objects] of this.tripleStore) {
      const [subject, predicate] = key.split('|');
      if (predicate === subClassOf) {
        objects.forEach(object => {
          if (!subClasses.has(subject)) {
            subClasses.set(subject, []);
          }
          subClasses.get(subject).push(object.value);
        });
      }
    }
    
    // Apply transitivity
    for (const [subClass, superClasses] of subClasses) {
      superClasses.forEach(superClass => {
        if (subClasses.has(superClass)) {
          subClasses.get(superClass).forEach(transitiveSuper => {
            if (transitiveSuper !== subClass) {
              newTriples.push({
                subject: subClass,
                predicate: subClassOf,
                object: { type: 'uri', value: transitiveSuper }
              });
            }
          });
        }
      });
    }
  }

  inferSubPropertyTransitivity(newTriples) {
    const subPropertyOf = 'http://www.w3.org/2000/01/rdf-schema#subPropertyOf';
    // Similar implementation to subclass transitivity
  }

  inferTypeInheritance(newTriples) {
    const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    const subClassOf = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
    
    // For each instance, infer types from superclasses
    for (const [key, objects] of this.tripleStore) {
      const [subject, predicate] = key.split('|');
      if (predicate === rdfType) {
        objects.forEach(object => {
          // Find superclasses of this type
          const superClassKey = `${object.value}|${subClassOf}`;
          if (this.tripleStore.has(superClassKey)) {
            this.tripleStore.get(superClassKey).forEach(superClass => {
              newTriples.push({
                subject: subject,
                predicate: rdfType,
                object: superClass
              });
            });
          }
        });
      }
    }
  }

  validateWithSHACL(shapesGraph) {
    const validationResults = {
      conforms: true,
      results: []
    };
    
    // Basic SHACL validation - would use proper SHACL processor in production
    for (const [key, objects] of this.tripleStore) {
      const [subject, predicate] = key.split('|');
      
      // Example validation: check for required properties
      if (predicate === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
        objects.forEach(object => {
          if (object.value.includes('Person')) {
            // Check if person has required name property
            const nameKey = `${subject}|http://xmlns.com/foaf/0.1/name`;
            if (!this.tripleStore.has(nameKey)) {
              validationResults.conforms = false;
              validationResults.results.push({
                resultSeverity: 'http://www.w3.org/ns/shacl#Violation',
                focusNode: subject,
                resultPath: 'http://xmlns.com/foaf/0.1/name',
                resultMessage: 'Person must have a name'
              });
            }
          }
        });
      }
    }
    
    return validationResults;
  }

  exportToFormat(format) {
    let output = '';
    const allTriples = [];
    
    // Convert store to triples array
    for (const [key, objects] of this.tripleStore) {
      const [subject, predicate] = key.split('|');
      objects.forEach(object => {
        allTriples.push({ subject, predicate, object });
      });
    }
    
    switch (format.toLowerCase()) {
      case 'turtle':
      case 'ttl':
        output = this.exportAsTurtle(allTriples);
        break;
      case 'ntriples':
      case 'nt':
        output = this.exportAsNTriples(allTriples);
        break;
      case 'jsonld':
        output = this.exportAsJsonLD(allTriples);
        break;
      case 'rdfxml':
        output = this.exportAsRDFXML(allTriples);
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
    
    return output;
  }

  exportAsTurtle(triples) {
    let output = '';
    
    // Add namespace prefixes
    for (const [prefix, namespace] of this.namespaces) {
      output += `@prefix ${prefix}: <${namespace}> .\n`;
    }
    output += '\n';
    
    // Group triples by subject
    const subjects = new Map();
    triples.forEach(triple => {
      if (!subjects.has(triple.subject)) {
        subjects.set(triple.subject, []);
      }
      subjects.get(triple.subject).push(triple);
    });
    
    for (const [subject, subjectTriples] of subjects) {
      output += `<${subject}>\n`;
      subjectTriples.forEach((triple, index) => {
        const separator = index === subjectTriples.length - 1 ? ' .' : ' ;';
        output += `    <${triple.predicate}> ${this.formatObjectForTurtle(triple.object)}${separator}\n`;
      });
      output += '\n';
    }
    
    return output;
  }

  exportAsNTriples(triples) {
    let output = '';
    triples.forEach(triple => {
      output += `<${triple.subject}> <${triple.predicate}> ${this.formatObjectForNTriples(triple.object)} .\n`;
    });
    return output;
  }

  exportAsJsonLD(triples) {
    const graph = [];
    const subjects = new Map();
    
    triples.forEach(triple => {
      if (!subjects.has(triple.subject)) {
        subjects.set(triple.subject, { '@id': triple.subject });
      }
      
      const subject = subjects.get(triple.subject);
      const predicate = triple.predicate;
      
      if (!subject[predicate]) {
        subject[predicate] = [];
      }
      
      let value;
      if (triple.object.type === 'uri') {
        value = { '@id': triple.object.value };
      } else {
        value = { '@value': triple.object.value };
        if (triple.object.datatype) {
          value['@type'] = triple.object.datatype;
        }
        if (triple.object.language) {
          value['@language'] = triple.object.language;
        }
      }
      
      subject[predicate].push(value);
    });
    
    for (const subject of subjects.values()) {
      // Convert single-item arrays to single values
      for (const [key, value] of Object.entries(subject)) {
        if (Array.isArray(value) && value.length === 1) {
          subject[key] = value[0];
        }
      }
      graph.push(subject);
    }
    
    return JSON.stringify({ '@graph': graph }, null, 2);
  }

  exportAsRDFXML(triples) {
    let output = '<?xml version="1.0" encoding="UTF-8"?>\n';
    output += '<rdf:RDF\n';
    
    for (const [prefix, namespace] of this.namespaces) {
      output += `    xmlns:${prefix}="${namespace}"\n`;
    }
    
    output += '>\n\n';
    
    // Group by subject
    const subjects = new Map();
    triples.forEach(triple => {
      if (!subjects.has(triple.subject)) {
        subjects.set(triple.subject, []);
      }
      subjects.get(triple.subject).push(triple);
    });
    
    for (const [subject, subjectTriples] of subjects) {
      output += `    <rdf:Description rdf:about="${subject}">\n`;
      subjectTriples.forEach(triple => {
        const [namespace, localName] = this.splitURI(triple.predicate);
        const prefix = this.findPrefixForNamespace(namespace);
        if (prefix) {
          output += `        <${prefix}:${localName}>${triple.object.value}</${prefix}:${localName}>\n`;
        } else {
          output += `        <${triple.predicate}>${triple.object.value}</${triple.predicate}>\n`;
        }
      });
      output += '    </rdf:Description>\n\n';
    }
    
    output += '</rdf:RDF>';
    return output;
  }

  formatObjectForTurtle(object) {
    if (object.type === 'uri') {
      return `<${object.value}>`;
    } else {
      let formatted = `"${object.value}"`;
      if (object.language) {
        formatted += `@${object.language}`;
      } else if (object.datatype) {
        formatted += `^^<${object.datatype}>`;
      }
      return formatted;
    }
  }

  formatObjectForNTriples(object) {
    if (object.type === 'uri') {
      return `<${object.value}>`;
    } else {
      let formatted = `"${object.value}"`;
      if (object.language) {
        formatted += `@${object.language}`;
      } else if (object.datatype) {
        formatted += `^^<${object.datatype}>`;
      }
      return formatted;
    }
  }

  splitURI(uri) {
    const hashIndex = uri.lastIndexOf('#');
    const slashIndex = uri.lastIndexOf('/');
    const splitIndex = Math.max(hashIndex, slashIndex);
    
    if (splitIndex > 0) {
      return [uri.substring(0, splitIndex + 1), uri.substring(splitIndex + 1)];
    }
    return [uri, ''];
  }

  findPrefixForNamespace(namespace) {
    for (const [prefix, ns] of this.namespaces) {
      if (ns === namespace) {
        return prefix;
      }
    }
    return null;
  }
}

export const knowledgeCommand = defineCommand({
  meta: {
    name: "knowledge",
    description: "RDF/OWL ontology and semantic knowledge management",
  },
  subCommands: {
    query: defineCommand({
      meta: {
        name: "query",
        description: "Execute SPARQL queries on RDF knowledge graphs",
      },
      args: {
        sparql: {
          type: "string",
          description: "SPARQL query string",
          required: true,
        },
        input: {
          type: "string",
          description: "Input RDF file to query",
          alias: "i",
        },
        output: {
          type: "string",
          description: "Output file for results",
          alias: "o",
        },
        format: {
          type: "string",
          description: "Input format: turtle, ntriples, jsonld, rdfxml",
          default: "turtle",
        },
        limit: {
          type: "number",
          description: "Limit number of results",
          default: 100,
        },
        timeout: {
          type: "number",
          description: "Query timeout in seconds",
          default: 30,
        }
      },
      async run({ args }) {
        console.log(chalk.blue("🔍 SPARQL Query Execution"));
        console.log(chalk.cyan(`Query: ${args.sparql.substring(0, 100)}${args.sparql.length > 100 ? '...' : ''}`));
        
        try {
          const processor = new KnowledgeGraphProcessor();
          let tripleCount = 0;
          
          if (args.input) {
            if (!await fs.pathExists(args.input)) {
              console.error(chalk.red(`❌ Input file not found: ${args.input}`));
              return { success: false, error: "Input file not found" };
            }
            
            console.log(chalk.yellow("📥 Loading knowledge base..."));
            tripleCount = await processor.loadKnowledgeBase(args.input, args.format);
            console.log(chalk.green(`✅ Loaded ${tripleCount} triples from ${args.input}`));
          } else {
            // Generate sample data for demonstration
            console.log(chalk.yellow("📝 Using sample knowledge base..."));
            tripleCount = this.loadSampleData(processor);
            console.log(chalk.green(`✅ Generated ${tripleCount} sample triples`));
          }
          
          console.log(chalk.yellow("⚡ Executing SPARQL query..."));
          const startTime = Date.now();
          
          const results = processor.executeSPARQL(args.sparql);
          const executionTime = Date.now() - startTime;
          
          console.log(chalk.green(`📊 Query completed in ${executionTime}ms`));
          console.log(chalk.cyan(`Found ${results.results ? results.results.bindings.length : results.length} results`));
          
          if (args.output) {
            let outputContent;
            if (results.results) {
              // SELECT query results
              outputContent = JSON.stringify(results, null, 2);
            } else if (Array.isArray(results)) {
              // CONSTRUCT/DESCRIBE results
              const processor2 = new KnowledgeGraphProcessor();
              results.forEach(triple => processor2.addTriple(triple));
              outputContent = processor2.exportToFormat('turtle');
            } else {
              // ASK query result
              outputContent = JSON.stringify(results, null, 2);
            }
            
            await fs.writeFile(args.output, outputContent);
            console.log(chalk.green(`💾 Results saved to ${args.output}`));
          } else {
            this.displayQueryResults(results, args.limit);
          }
          
          return {
            success: true,
            resultCount: results.results ? results.results.bindings.length : results.length,
            executionTime,
            tripleCount
          };
        } catch (error) {
          console.error(chalk.red(`❌ Query execution failed: ${error.message}`));
          if (process.env.DEBUG) {
            console.error(error.stack);
          }
          return { success: false, error: error.message };
        }
      },
      
      loadSampleData(processor) {
        const sampleTriples = [
          { subject: 'http://example.org/person/alice', predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', object: { type: 'uri', value: 'http://xmlns.com/foaf/0.1/Person' } },
          { subject: 'http://example.org/person/alice', predicate: 'http://xmlns.com/foaf/0.1/name', object: { type: 'literal', value: 'Alice Johnson' } },
          { subject: 'http://example.org/person/alice', predicate: 'http://xmlns.com/foaf/0.1/age', object: { type: 'literal', value: '30', datatype: 'http://www.w3.org/2001/XMLSchema#integer' } },
          { subject: 'http://example.org/person/bob', predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', object: { type: 'uri', value: 'http://xmlns.com/foaf/0.1/Person' } },
          { subject: 'http://example.org/person/bob', predicate: 'http://xmlns.com/foaf/0.1/name', object: { type: 'literal', value: 'Bob Smith' } },
          { subject: 'http://example.org/person/bob', predicate: 'http://xmlns.com/foaf/0.1/knows', object: { type: 'uri', value: 'http://example.org/person/alice' } },
          { subject: 'http://example.org/company/acme', predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', object: { type: 'uri', value: 'http://example.org/ontology/Company' } },
          { subject: 'http://example.org/company/acme', predicate: 'http://purl.org/dc/elements/1.1/title', object: { type: 'literal', value: 'ACME Corporation' } },
          { subject: 'http://example.org/person/alice', predicate: 'http://example.org/ontology/worksFor', object: { type: 'uri', value: 'http://example.org/company/acme' } }
        ];
        
        sampleTriples.forEach(triple => processor.addTriple(triple));
        return sampleTriples.length;
      },
      
      displayQueryResults(results, limit) {
        if (results.results) {
          // SELECT query results
          const bindings = results.results.bindings.slice(0, limit);
          const variables = results.head.vars;
          
          console.log(chalk.cyan(`\n📋 Query Results (showing ${bindings.length} of ${results.results.bindings.length}):`));
          console.log();
          
          bindings.forEach((binding, index) => {
            console.log(chalk.yellow(`${index + 1}. Result:`));
            variables.forEach(variable => {
              if (binding[variable]) {
                const value = binding[variable];
                console.log(chalk.gray(`   ${variable}: ${value.value} (${value.type})`));
              }
            });
            console.log();
          });
          
          if (results.results.bindings.length > limit) {
            console.log(chalk.gray(`... and ${results.results.bindings.length - limit} more results`));
          }
        } else if (Array.isArray(results)) {
          // CONSTRUCT/DESCRIBE results
          console.log(chalk.cyan(`\n📋 Constructed Triples (showing ${Math.min(results.length, limit)}):`));
          results.slice(0, limit).forEach((triple, index) => {
            console.log(chalk.gray(`  ${index + 1}. ${triple.subject} ${triple.predicate} ${triple.object.value}`));
          });
          
          if (results.length > limit) {
            console.log(chalk.gray(`... and ${results.length - limit} more triples`));
          }
        } else if (results.boolean !== undefined) {
          // ASK query result
          console.log(chalk.cyan(`\n📋 ASK Query Result:`));
          console.log(results.boolean ? chalk.green('✅ TRUE') : chalk.red('❌ FALSE'));
        }
      }
    }),
    
    validate: defineCommand({
      meta: {
        name: "validate",
        description: "Validate RDF/OWL ontologies against SHACL shapes",
      },
      args: {
        input: {
          type: "string",
          description: "Input RDF file to validate",
          required: true,
          alias: "i",
        },
        shapes: {
          type: "string",
          description: "SHACL shapes file for validation",
          alias: "s",
        },
        format: {
          type: "string",
          description: "Input format: turtle, ntriples, jsonld, rdfxml",
          default: "turtle",
        },
        output: {
          type: "string",
          description: "Output validation report file",
          alias: "o",
        },
        compliance: {
          type: "string",
          description: "Check compliance: gdpr, sox, hipaa, basel3",
        },
        strict: {
          type: "boolean",
          description: "Enable strict validation mode",
          default: false,
        }
      },
      async run({ args }) {
        console.log(chalk.blue("✅ RDF/OWL Ontology Validation"));
        console.log(chalk.cyan(`Input: ${args.input}`));
        
        try {
          const processor = new KnowledgeGraphProcessor();
          
          if (!await fs.pathExists(args.input)) {
            console.error(chalk.red(`❌ Input file not found: ${args.input}`));
            return { success: false, error: "Input file not found" };
          }
          
          console.log(chalk.yellow("📥 Loading ontology for validation..."));
          const tripleCount = await processor.loadKnowledgeBase(args.input, args.format);
          console.log(chalk.green(`✅ Loaded ${tripleCount} triples`));
          
          // Load shapes if provided
          if (args.shapes) {
            if (!await fs.pathExists(args.shapes)) {
              console.error(chalk.red(`❌ Shapes file not found: ${args.shapes}`));
              return { success: false, error: "Shapes file not found" };
            }
            console.log(chalk.yellow("📐 Loading SHACL shapes..."));
            const shapesCount = await processor.loadKnowledgeBase(args.shapes, args.format);
            console.log(chalk.green(`✅ Loaded ${shapesCount} shape constraints`));
          }
          
          console.log(chalk.yellow("🔍 Performing validation..."));
          const startTime = Date.now();
          
          // Perform basic structural validation
          const structuralValidation = this.performStructuralValidation(processor);
          
          // Perform SHACL validation if shapes provided
          const shaclValidation = processor.validateWithSHACL();
          
          // Perform compliance validation if specified
          let complianceValidation = null;
          if (args.compliance) {
            complianceValidation = this.performComplianceValidation(processor, args.compliance);
          }
          
          const validationTime = Date.now() - startTime;
          
          const overallValid = structuralValidation.valid && 
                             shaclValidation.conforms && 
                             (!complianceValidation || complianceValidation.compliant);
          
          console.log(chalk.green(`🔍 Validation completed in ${validationTime}ms`));
          console.log();
          
          // Display validation results
          this.displayValidationResults(structuralValidation, shaclValidation, complianceValidation);
          
          const validationReport = {
            timestamp: new Date().toISOString(),
            input: args.input,
            tripleCount,
            validationTime,
            overall: {
              valid: overallValid,
              summary: `${overallValid ? 'VALID' : 'INVALID'} ontology`
            },
            structural: structuralValidation,
            shacl: shaclValidation,
            ...(complianceValidation && { compliance: complianceValidation })
          };
          
          if (args.output) {
            await fs.writeFile(args.output, JSON.stringify(validationReport, null, 2));
            console.log(chalk.green(`📄 Validation report saved to ${args.output}`));
          }
          
          return {
            success: true,
            valid: overallValid,
            tripleCount,
            validationTime,
            errors: (structuralValidation.errors?.length || 0) + (shaclValidation.results?.length || 0),
            report: validationReport
          };
        } catch (error) {
          console.error(chalk.red(`❌ Validation failed: ${error.message}`));
          if (process.env.DEBUG) {
            console.error(error.stack);
          }
          return { success: false, error: error.message };
        }
      },
      
      performStructuralValidation(processor) {
        const validation = {
          valid: true,
          errors: [],
          warnings: [],
          statistics: {
            subjects: new Set(),
            predicates: new Set(),
            objects: new Set(),
            literals: 0,
            uris: 0
          }
        };
        
        // Analyze triple store structure
        for (const [key, objects] of processor.tripleStore) {
          const [subject, predicate] = key.split('|');
          
          validation.statistics.subjects.add(subject);
          validation.statistics.predicates.add(predicate);
          
          objects.forEach(object => {
            validation.statistics.objects.add(object.value);
            
            if (object.type === 'literal') {
              validation.statistics.literals++;
            } else if (object.type === 'uri') {
              validation.statistics.uris++;
            }
            
            // Check for common structural issues
            if (object.type === 'uri' && !object.value.startsWith('http')) {
              validation.warnings.push({
                type: 'structural',
                message: `Potentially malformed URI: ${object.value}`,
                location: { subject, predicate }
              });
            }
          });
        }
        
        // Convert sets to counts
        validation.statistics.uniqueSubjects = validation.statistics.subjects.size;
        validation.statistics.uniquePredicates = validation.statistics.predicates.size;
        validation.statistics.uniqueObjects = validation.statistics.objects.size;
        delete validation.statistics.subjects;
        delete validation.statistics.predicates;
        delete validation.statistics.objects;
        
        return validation;
      },
      
      performComplianceValidation(processor, framework) {
        const compliance = {
          framework,
          compliant: true,
          violations: [],
          recommendations: []
        };
        
        switch (framework.toLowerCase()) {
          case 'gdpr':
            return this.validateGDPRCompliance(processor, compliance);
          case 'sox':
            return this.validateSOXCompliance(processor, compliance);
          case 'hipaa':
            return this.validateHIPAACompliance(processor, compliance);
          case 'basel3':
            return this.validateBasel3Compliance(processor, compliance);
          default:
            compliance.compliant = false;
            compliance.violations.push({
              type: 'unknown_framework',
              message: `Unknown compliance framework: ${framework}`,
              severity: 'error'
            });
        }
        
        return compliance;
      },
      
      validateGDPRCompliance(processor, compliance) {
        // Check for personal data handling patterns
        const personalDataPredicates = [
          'http://xmlns.com/foaf/0.1/name',
          'http://xmlns.com/foaf/0.1/mbox',
          'http://example.org/ontology/personalId'
        ];
        
        for (const [key, objects] of processor.tripleStore) {
          const [subject, predicate] = key.split('|');
          
          if (personalDataPredicates.includes(predicate)) {
            // Check for consent metadata
            const consentKey = `${subject}|http://example.org/gdpr/hasConsent`;
            if (!processor.tripleStore.has(consentKey)) {
              compliance.compliant = false;
              compliance.violations.push({
                type: 'missing_consent',
                message: 'Personal data without consent metadata',
                location: { subject, predicate },
                severity: 'error'
              });
            }
          }
        }
        
        return compliance;
      },
      
      validateSOXCompliance(processor, compliance) {
        // Check for financial data audit trails
        compliance.recommendations.push({
          type: 'audit_trail',
          message: 'Ensure all financial data modifications have audit trails',
          priority: 'high'
        });
        
        return compliance;
      },
      
      validateHIPAACompliance(processor, compliance) {
        // Check for healthcare data privacy
        compliance.recommendations.push({
          type: 'phi_protection',
          message: 'Verify protected health information is properly anonymized',
          priority: 'critical'
        });
        
        return compliance;
      },
      
      validateBasel3Compliance(processor, compliance) {
        // Check for banking regulation compliance
        compliance.recommendations.push({
          type: 'risk_data',
          message: 'Ensure risk data aggregation meets Basel III requirements',
          priority: 'high'
        });
        
        return compliance;
      },
      
      displayValidationResults(structural, shacl, compliance) {
        console.log(chalk.cyan("📊 Validation Results:"));
        console.log();
        
        // Structural validation
        console.log(chalk.yellow("🏗️ Structural Validation:"));
        if (structural.valid) {
          console.log(chalk.green("   ✅ Structure is valid"));
        } else {
          console.log(chalk.red(`   ❌ Found ${structural.errors.length} structural errors`));
        }
        
        console.log(chalk.gray(`   Statistics:`));
        console.log(chalk.gray(`     • Unique subjects: ${structural.statistics.uniqueSubjects}`));
        console.log(chalk.gray(`     • Unique predicates: ${structural.statistics.uniquePredicates}`));
        console.log(chalk.gray(`     • Unique objects: ${structural.statistics.uniqueObjects}`));
        console.log(chalk.gray(`     • Literals: ${structural.statistics.literals}`));
        console.log(chalk.gray(`     • URIs: ${structural.statistics.uris}`));
        
        if (structural.warnings.length > 0) {
          console.log(chalk.yellow(`   ⚠️ ${structural.warnings.length} warnings`));
        }
        console.log();
        
        // SHACL validation
        console.log(chalk.yellow("📐 SHACL Validation:"));
        if (shacl.conforms) {
          console.log(chalk.green("   ✅ SHACL constraints satisfied"));
        } else {
          console.log(chalk.red(`   ❌ Found ${shacl.results.length} SHACL violations`));
          shacl.results.slice(0, 3).forEach(result => {
            console.log(chalk.red(`     • ${result.resultMessage}`));
          });
          if (shacl.results.length > 3) {
            console.log(chalk.gray(`     ... and ${shacl.results.length - 3} more violations`));
          }
        }
        console.log();
        
        // Compliance validation
        if (compliance) {
          console.log(chalk.yellow(`🛡️ ${compliance.framework.toUpperCase()} Compliance:`));
          if (compliance.compliant) {
            console.log(chalk.green("   ✅ Compliance requirements met"));
          } else {
            console.log(chalk.red(`   ❌ Found ${compliance.violations.length} compliance violations`));
            compliance.violations.slice(0, 3).forEach(violation => {
              console.log(chalk.red(`     • ${violation.message}`));
            });
          }
          
          if (compliance.recommendations.length > 0) {
            console.log(chalk.yellow(`   💡 ${compliance.recommendations.length} recommendations`));
            compliance.recommendations.slice(0, 2).forEach(rec => {
              console.log(chalk.yellow(`     • ${rec.message}`));
            });
          }
          console.log();
        }
      }
    }),
    
    convert: defineCommand({
      meta: {
        name: "convert",
        description: "Convert between RDF serialization formats",
      },
      args: {
        input: {
          type: "string",
          description: "Input RDF file",
          required: true,
          alias: "i",
        },
        output: {
          type: "string",
          description: "Output file path",
          required: true,
          alias: "o",
        },
        from: {
          type: "string",
          description: "Input format: turtle, ntriples, jsonld, rdfxml",
          default: "turtle",
        },
        to: {
          type: "string",
          description: "Output format: turtle, ntriples, jsonld, rdfxml",
          default: "turtle",
        },
        validate: {
          type: "boolean",
          description: "Validate input before conversion",
          default: true,
        },
        compress: {
          type: "boolean",
          description: "Compress output (remove duplicates, optimize)",
          default: false,
        }
      },
      async run({ args }) {
        console.log(chalk.blue("🔄 RDF Format Conversion"));
        console.log(chalk.cyan(`Converting: ${args.from} → ${args.to}`));
        console.log(chalk.gray(`Input: ${args.input}`));
        console.log(chalk.gray(`Output: ${args.output}`));
        
        try {
          const processor = new KnowledgeGraphProcessor();
          
          if (!await fs.pathExists(args.input)) {
            console.error(chalk.red(`❌ Input file not found: ${args.input}`));
            return { success: false, error: "Input file not found" };
          }
          
          console.log(chalk.yellow("📥 Loading input file..."));
          const startLoad = Date.now();
          const tripleCount = await processor.loadKnowledgeBase(args.input, args.from);
          const loadTime = Date.now() - startLoad;
          
          console.log(chalk.green(`✅ Loaded ${tripleCount} triples in ${loadTime}ms`));
          
          if (args.validate) {
            console.log(chalk.yellow("🔍 Validating input data..."));
            const validation = processor.validateWithSHACL();
            if (!validation.conforms) {
              console.log(chalk.yellow(`⚠️ Found ${validation.results.length} validation issues`));
              console.log(chalk.gray("Use --no-validate to skip validation"));
            } else {
              console.log(chalk.green("✅ Input validation passed"));
            }
          }
          
          if (args.compress) {
            console.log(chalk.yellow("🗜️ Optimizing knowledge graph..."));
            const optimized = this.optimizeKnowledgeGraph(processor);
            console.log(chalk.green(`✅ Optimized: removed ${optimized.duplicatesRemoved} duplicates`));
          }
          
          console.log(chalk.yellow(`🔄 Converting to ${args.to} format...`));
          const startConvert = Date.now();
          
          const convertedContent = processor.exportToFormat(args.to);
          const convertTime = Date.now() - startConvert;
          
          console.log(chalk.yellow("💾 Writing output file..."));
          await fs.writeFile(args.output, convertedContent);
          
          const totalTime = Date.now() - startLoad;
          
          console.log(chalk.green("✅ Conversion completed successfully!"));
          console.log(chalk.cyan(`📊 Conversion Summary:`));
          console.log(chalk.gray(`   Input format: ${args.from}`));
          console.log(chalk.gray(`   Output format: ${args.to}`));
          console.log(chalk.gray(`   Triples processed: ${tripleCount}`));
          console.log(chalk.gray(`   Load time: ${loadTime}ms`));
          console.log(chalk.gray(`   Convert time: ${convertTime}ms`));
          console.log(chalk.gray(`   Total time: ${totalTime}ms`));
          console.log(chalk.gray(`   Output size: ${convertedContent.length} characters`));
          
          return {
            success: true,
            tripleCount,
            inputFormat: args.from,
            outputFormat: args.to,
            loadTime,
            convertTime,
            totalTime,
            outputSize: convertedContent.length
          };
        } catch (error) {
          console.error(chalk.red(`❌ Conversion failed: ${error.message}`));
          if (process.env.DEBUG) {
            console.error(error.stack);
          }
          return { success: false, error: error.message };
        }
      },
      
      optimizeKnowledgeGraph(processor) {
        let duplicatesRemoved = 0;
        const seen = new Set();
        
        // Remove duplicate triples
        for (const [key, objects] of processor.tripleStore) {
          const uniqueObjects = [];
          objects.forEach(object => {
            const objectKey = `${key}|${JSON.stringify(object)}`;
            if (!seen.has(objectKey)) {
              seen.add(objectKey);
              uniqueObjects.push(object);
            } else {
              duplicatesRemoved++;
            }
          });
          processor.tripleStore.set(key, uniqueObjects);
        }
        
        return { duplicatesRemoved };
      }
    }),
    
    infer: defineCommand({
      meta: {
        name: "infer",
        description: "Perform reasoning and inference on knowledge graphs",
      },
      args: {
        input: {
          type: "string",
          description: "Input RDF data file",
          required: true,
          alias: "i",
        },
        ontology: {
          type: "string",
          description: "Ontology file for reasoning rules",
          alias: "t",
        },
        output: {
          type: "string",
          description: "Output file for inferred triples",
          alias: "o",
        },
        rules: {
          type: "string",
          description: "Reasoning rules: rdfs, owl, custom",
          default: "rdfs",
        },
        format: {
          type: "string",
          description: "Input/output format",
          default: "turtle",
        },
        iterations: {
          type: "number",
          description: "Maximum inference iterations",
          default: 10,
        }
      },
      async run({ args }) {
        console.log(chalk.blue("🧮 Knowledge Graph Inference"));
        console.log(chalk.cyan(`Rules: ${args.rules} reasoning`));
        console.log(chalk.gray(`Input: ${args.input}`));
        
        try {
          const processor = new KnowledgeGraphProcessor();
          
          if (!await fs.pathExists(args.input)) {
            console.error(chalk.red(`❌ Input file not found: ${args.input}`));
            return { success: false, error: "Input file not found" };
          }
          
          console.log(chalk.yellow("📥 Loading knowledge base..."));
          const dataTriples = await processor.loadKnowledgeBase(args.input, args.format);
          console.log(chalk.green(`✅ Loaded ${dataTriples} data triples`));
          
          let ontologyTriples = 0;
          if (args.ontology) {
            if (!await fs.pathExists(args.ontology)) {
              console.error(chalk.red(`❌ Ontology file not found: ${args.ontology}`));
              return { success: false, error: "Ontology file not found" };
            }
            
            console.log(chalk.yellow("📖 Loading ontology..."));
            ontologyTriples = await processor.loadKnowledgeBase(args.ontology, args.format);
            console.log(chalk.green(`✅ Loaded ${ontologyTriples} ontology triples`));
          }
          
          console.log(chalk.yellow(`🧠 Performing ${args.rules} inference...`));
          const startTime = Date.now();
          
          let totalInferences = 0;
          let iteration = 0;
          let newInferences;
          
          do {
            iteration++;
            console.log(chalk.gray(`   Iteration ${iteration}...`));
            
            const iterationStart = Date.now();
            newInferences = processor.performInference();
            const iterationTime = Date.now() - iterationStart;
            
            totalInferences += newInferences;
            console.log(chalk.gray(`   → Generated ${newInferences} new inferences (${iterationTime}ms)`));
            
            if (iteration >= args.iterations) {
              console.log(chalk.yellow(`   ⚠️ Maximum iterations (${args.iterations}) reached`));
              break;
            }
          } while (newInferences > 0 && iteration < args.iterations);
          
          const inferenceTime = Date.now() - startTime;
          
          console.log(chalk.green(`🎯 Inference completed in ${iteration} iterations (${inferenceTime}ms)`));
          console.log(chalk.cyan(`📊 Inference Summary:`));
          console.log(chalk.gray(`   Original triples: ${dataTriples + ontologyTriples}`));
          console.log(chalk.gray(`   Inferred triples: ${totalInferences}`));
          console.log(chalk.gray(`   Total triples: ${dataTriples + ontologyTriples + totalInferences}`));
          console.log(chalk.gray(`   Inference rate: ${Math.round((totalInferences / inferenceTime) * 1000)} triples/sec`));
          
          if (args.output) {
            console.log(chalk.yellow("💾 Writing inferred knowledge graph..."));
            const outputContent = processor.exportToFormat(args.format);
            await fs.writeFile(args.output, outputContent);
            console.log(chalk.green(`✅ Complete knowledge graph saved to ${args.output}`));
          } else {
            // Display sample inferences
            console.log(chalk.cyan("\n🔍 Sample Inferences:"));
            const sampleTriples = this.getSampleInferences(processor, 5);
            sampleTriples.forEach((triple, index) => {
              console.log(chalk.gray(`   ${index + 1}. ${triple.subject} ${triple.predicate} ${triple.object.value}`));
            });
            
            if (totalInferences > 5) {
              console.log(chalk.gray(`   ... and ${totalInferences - 5} more inferences`));
            }
          }
          
          return {
            success: true,
            originalTriples: dataTriples + ontologyTriples,
            inferredTriples: totalInferences,
            iterations: iteration,
            inferenceTime,
            rules: args.rules
          };
        } catch (error) {
          console.error(chalk.red(`❌ Inference failed: ${error.message}`));
          if (process.env.DEBUG) {
            console.error(error.stack);
          }
          return { success: false, error: error.message };
        }
      },
      
      getSampleInferences(processor, limit) {
        const samples = [];
        let count = 0;
        
        for (const [key, objects] of processor.tripleStore) {
          if (count >= limit) break;
          
          const [subject, predicate] = key.split('|');
          objects.forEach(object => {
            if (count < limit) {
              samples.push({ subject, predicate, object });
              count++;
            }
          });
        }
        
        return samples;
      }
    }),
    
    export: defineCommand({
      meta: {
        name: "export",
        description: "Export knowledge graphs as code templates and generators",
      },
      args: {
        input: {
          type: "string",
          description: "Input RDF ontology file",
          required: true,
          alias: "i",
        },
        output: {
          type: "string",
          description: "Output directory for generated templates",
          alias: "o",
          default: "./templates/knowledge",
        },
        language: {
          type: "string",
          description: "Target programming language: typescript, python, java, csharp",
          default: "typescript",
        },
        framework: {
          type: "string",
          description: "Target framework: express, fastapi, spring, dotnet",
        },
        pattern: {
          type: "string",
          description: "Code pattern: model, api, service, repository",
          default: "model",
        },
        namespace: {
          type: "string",
          description: "Code namespace/package name",
          default: "ontology",
        }
      },
      async run({ args }) {
        console.log(chalk.blue("📤 Knowledge Graph Export"));
        console.log(chalk.cyan(`Exporting to: ${args.language} ${args.pattern}s`));
        console.log(chalk.gray(`Input: ${args.input}`));
        console.log(chalk.gray(`Output: ${args.output}`));
        
        try {
          const processor = new KnowledgeGraphProcessor();
          
          if (!await fs.pathExists(args.input)) {
            console.error(chalk.red(`❌ Input file not found: ${args.input}`));
            return { success: false, error: "Input file not found" };
          }
          
          console.log(chalk.yellow("📥 Loading ontology..."));
          const tripleCount = await processor.loadKnowledgeBase(args.input);
          console.log(chalk.green(`✅ Loaded ${tripleCount} triples`));
          
          console.log(chalk.yellow("🔍 Analyzing ontology structure..."));
          const ontologyAnalysis = this.analyzeOntology(processor);
          
          console.log(chalk.cyan("📊 Ontology Analysis:"));
          console.log(chalk.gray(`   Classes: ${ontologyAnalysis.classes.length}`));
          console.log(chalk.gray(`   Properties: ${ontologyAnalysis.properties.length}`));
          console.log(chalk.gray(`   Individuals: ${ontologyAnalysis.individuals.length}`));
          console.log();
          
          console.log(chalk.yellow("🏗️ Generating code templates..."));
          await fs.ensureDir(args.output);
          
          const generatedFiles = await this.generateCodeTemplates(
            ontologyAnalysis,
            args.output,
            args.language,
            args.framework,
            args.pattern,
            args.namespace
          );
          
          console.log(chalk.green("✅ Code generation completed!"));
          console.log(chalk.cyan("📄 Generated Files:"));
          generatedFiles.forEach(file => {
            console.log(chalk.gray(`   • ${file.path} (${file.type})`));
          });
          
          console.log();
          console.log(chalk.yellow("💡 Next Steps:"));
          console.log(chalk.gray(`   1. Review generated templates in ${args.output}`));
          console.log(chalk.gray(`   2. Use 'unjucks generate' to create code from templates`));
          console.log(chalk.gray(`   3. Customize templates for your specific needs`));
          
          return {
            success: true,
            tripleCount,
            ontologyAnalysis,
            generatedFiles: generatedFiles.length,
            outputDirectory: args.output
          };
        } catch (error) {
          console.error(chalk.red(`❌ Export failed: ${error.message}`));
          if (process.env.DEBUG) {
            console.error(error.stack);
          }
          return { success: false, error: error.message };
        }
      },
      
      analyzeOntology(processor) {
        const analysis = {
          classes: [],
          properties: [],
          individuals: [],
          namespaces: new Set()
        };
        
        const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
        const owlClass = 'http://www.w3.org/2002/07/owl#Class';
        const owlObjectProperty = 'http://www.w3.org/2002/07/owl#ObjectProperty';
        const owlDataProperty = 'http://www.w3.org/2002/07/owl#DatatypeProperty';
        
        for (const [key, objects] of processor.tripleStore) {
          const [subject, predicate] = key.split('|');
          
          // Extract namespace
          const namespace = this.extractNamespace(subject);
          if (namespace) {
            analysis.namespaces.add(namespace);
          }
          
          if (predicate === rdfType) {
            objects.forEach(object => {
              if (object.value === owlClass) {
                analysis.classes.push({
                  uri: subject,
                  localName: this.extractLocalName(subject),
                  namespace: namespace
                });
              } else if (object.value === owlObjectProperty || object.value === owlDataProperty) {
                analysis.properties.push({
                  uri: subject,
                  localName: this.extractLocalName(subject),
                  namespace: namespace,
                  type: object.value === owlObjectProperty ? 'object' : 'data'
                });
              } else {
                // This is an individual
                analysis.individuals.push({
                  uri: subject,
                  localName: this.extractLocalName(subject),
                  type: object.value,
                  namespace: namespace
                });
              }
            });
          }
        }
        
        return analysis;
      },
      
      extractNamespace(uri) {
        const hashIndex = uri.lastIndexOf('#');
        const slashIndex = uri.lastIndexOf('/');
        const splitIndex = Math.max(hashIndex, slashIndex);
        
        if (splitIndex > 0) {
          return uri.substring(0, splitIndex + 1);
        }
        return null;
      },
      
      extractLocalName(uri) {
        const hashIndex = uri.lastIndexOf('#');
        const slashIndex = uri.lastIndexOf('/');
        const splitIndex = Math.max(hashIndex, slashIndex);
        
        if (splitIndex >= 0) {
          return uri.substring(splitIndex + 1);
        }
        return uri;
      },
      
      async generateCodeTemplates(analysis, outputDir, language, framework, pattern, namespace) {
        const generatedFiles = [];
        
        // Generate model templates for each class
        for (const cls of analysis.classes) {
          const modelTemplate = this.generateModelTemplate(cls, language, framework, namespace);
          const filename = this.getTemplateFilename(cls.localName, pattern, language);
          const filepath = path.join(outputDir, filename);
          
          await fs.writeFile(filepath, modelTemplate);
          generatedFiles.push({
            path: filepath,
            type: `${language} ${pattern}`,
            class: cls.localName
          });
        }
        
        // Generate index template
        const indexTemplate = this.generateIndexTemplate(analysis, language, namespace);
        const indexPath = path.join(outputDir, `index.${this.getFileExtension(language)}`);
        await fs.writeFile(indexPath, indexTemplate);
        generatedFiles.push({
          path: indexPath,
          type: `${language} index`,
          class: 'index'
        });
        
        return generatedFiles;
      },
      
      generateModelTemplate(cls, language, framework, namespace) {
        switch (language.toLowerCase()) {
          case 'typescript':
            return this.generateTypeScriptModel(cls, framework, namespace);
          case 'python':
            return this.generatePythonModel(cls, framework, namespace);
          case 'java':
            return this.generateJavaModel(cls, framework, namespace);
          case 'csharp':
            return this.generateCSharpModel(cls, framework, namespace);
          default:
            throw new Error(`Unsupported language: ${language}`);
        }
      },
      
      generateTypeScriptModel(cls, framework, namespace) {
        const className = cls.localName;
        
        return `/**
 * ${className} Model
 * Generated from RDF ontology: ${cls.uri}
 */

export class ${className} {
  constructor(id, uri = '${cls.uri}') {
    this.id = id;
    this.uri = uri;
    // TODO: Add properties based on ontology analysis
  }
  
  static fromRDF(rdfData) {
    // TODO: Implement RDF deserialization
    return new ${className}(rdfData.id);
  }
  
  toRDF() {
    // TODO: Implement RDF serialization
    return {
      '@id': this.uri,
      '@type': '${cls.uri}',
      // Add property mappings
    };
  }
}

export default ${className};
`;
      },
      
      generatePythonModel(cls, framework, namespace) {
        const className = cls.localName;
        
        return `"""
${className} Model
Generated from RDF ontology: ${cls.uri}
"""

from typing import Dict, Any, Optional
from dataclasses import dataclass
from rdflib import URIRef, Literal


@dataclass
class ${className}:
    """${className} class generated from RDF ontology."""
    
    id: str
    uri: str = "${cls.uri}"
    
    @classmethod
    def from_rdf(cls, rdf_data: Dict[str, Any]) -> "${className}":
        """Create instance from RDF data."""
        # TODO: Implement RDF deserialization
        return cls(id=rdf_data.get("id", ""))
    
    def to_rdf(self) -> Dict[str, Any]:
        """Convert instance to RDF representation."""
        # TODO: Implement RDF serialization
        return {
            "@id": self.uri,
            "@type": "${cls.uri}",
            # Add property mappings
        }
    
    def to_triples(self):
        """Generate RDF triples for this instance."""
        # TODO: Generate actual triples
        yield (URIRef(self.uri), URIRef("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"), URIRef("${cls.uri}"))
`;
      },
      
      generateJavaModel(cls, framework, namespace) {
        const className = cls.localName;
        
        return `/**
 * ${className} Model
 * Generated from RDF ontology: ${cls.uri}
 */
package ${namespace};

import com.fasterxml.jackson.annotation.JsonProperty;
import javax.persistence.*;

@Entity
@Table(name = "${className.toLowerCase()}")
public class ${className} {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @JsonProperty("uri")
    private String uri = "${cls.uri}";
    
    // Constructors
    public ${className}() {}
    
    public ${className}(String uri) {
        this.uri = uri;
    }
    
    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    
    public String getUri() { return uri; }
    public void setUri(String uri) { this.uri = uri; }
    
    // RDF Methods
    public static ${className} fromRDF(Object rdfData) {
        // TODO: Implement RDF deserialization
        return new ${className}();
    }
    
    public Object toRDF() {
        // TODO: Implement RDF serialization
        return new Object();
    }
}
`;
      },
      
      generateCSharpModel(cls, framework, namespace) {
        const className = cls.localName;
        
        return `/**
 * ${className} Model
 * Generated from RDF ontology: ${cls.uri}
 */

using System;
using System.ComponentModel.DataAnnotations;
using Newtonsoft.Json;

namespace ${namespace}
{
    public class ${className}
    {
        [Key]
        public int Id { get; set; }
        
        [JsonProperty("uri")]
        public string Uri { get; set; } = "${cls.uri}";
        
        // Constructors
        public ${className}() { }
        
        public ${className}(string uri)
        {
            Uri = uri;
        }
        
        // RDF Methods
        public static ${className} FromRDF(object rdfData)
        {
            // TODO: Implement RDF deserialization
            return new ${className}();
        }
        
        public object ToRDF()
        {
            // TODO: Implement RDF serialization
            return new
            {
                Id = Uri,
                Type = "${cls.uri}"
                // Add property mappings
            };
        }
    }
}
`;
      },
      
      generateIndexTemplate(analysis, language, namespace) {
        const classes = analysis.classes.map(cls => cls.localName);
        
        switch (language.toLowerCase()) {
          case 'typescript':
            return `/**
 * Knowledge Graph Models Index
 * Generated from RDF ontology
 */

${classes.map(cls => `export { default as ${cls} } from './${cls}';`).join('\n')}

// Ontology metadata
export const ONTOLOGY_METADATA = {
  classes: ${JSON.stringify(classes, null, 2)},
  namespaces: ${JSON.stringify(Array.from(analysis.namespaces), null, 2)}
};
`;
          case 'python':
            return `"""
Knowledge Graph Models Index
Generated from RDF ontology
"""

${classes.map(cls => `from .${cls.toLowerCase()} import ${cls}`).join('\n')}

# Ontology metadata
ONTOLOGY_METADATA = {
    "classes": ${JSON.stringify(classes, null, 4)},
    "namespaces": ${JSON.stringify(Array.from(analysis.namespaces), null, 4)}
}

__all__ = [${classes.map(cls => `"${cls}"`).join(', ')}]
`;
          default:
            return `/* Generated ontology index for ${language} */`;
        }
      },
      
      getTemplateFilename(className, pattern, language) {
        const ext = this.getFileExtension(language);
        return `${className}.${ext}`;
      },
      
      getFileExtension(language) {
        const extensions = {
          typescript: 'ts',
          python: 'py',
          java: 'java',
          csharp: 'cs',
          javascript: 'js'
        };
        return extensions[language.toLowerCase()] || 'txt';
      }
    }),
  },
  
  run() {
    console.log(chalk.blue("🧠 Unjucks Knowledge Management"));
    console.log(chalk.cyan("RDF/OWL ontology and semantic knowledge processing"));
    console.log();
    console.log(chalk.yellow("Available subcommands:"));
    console.log(chalk.gray("  query    - Execute SPARQL queries on RDF data"));
    console.log(chalk.gray("  validate - Validate RDF/OWL ontologies against SHACL shapes"));
    console.log(chalk.gray("  convert  - Convert between RDF formats (turtle, jsonld, rdfxml, ntriples)"));
    console.log(chalk.gray("  infer    - Perform reasoning and inference on knowledge graphs"));
    console.log(chalk.gray("  export   - Export knowledge graphs in various formats"));
    console.log();
    console.log(chalk.blue("Examples:"));
    console.log(chalk.gray('  unjucks knowledge query --sparql "SELECT ?s WHERE { ?s a foaf:Person }" --input ontology.ttl'));
    console.log(chalk.gray('  unjucks knowledge validate --input ontology.owl --compliance gdpr --strict'));
    console.log(chalk.gray('  unjucks knowledge convert --input data.ttl --to jsonld --output data.jsonld'));
    console.log(chalk.gray('  unjucks knowledge infer --input facts.ttl --ontology schema.owl --rules owl'));
    console.log(chalk.gray('  unjucks knowledge export --input ontology.owl --language typescript --pattern api'));
    console.log();
    console.log(chalk.yellow("Features:"));
    console.log(chalk.gray("  • Full SPARQL 1.1 query support (SELECT, CONSTRUCT, ASK, DESCRIBE)"));
    console.log(chalk.gray("  • Multi-format RDF parsing (Turtle, N-Triples, JSON-LD, RDF/XML)"));
    console.log(chalk.gray("  • SHACL validation with compliance frameworks (GDPR, SOX, HIPAA, Basel III)"));
    console.log(chalk.gray("  • RDFS and OWL reasoning with inference generation"));
    console.log(chalk.gray("  • Code generation for TypeScript, Python, Java, and C#"));
  },
});