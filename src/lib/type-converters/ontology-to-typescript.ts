/**
 * Ontology to TypeScript Interface Generator
 * Converts RDF Schema/OWL ontologies to TypeScript interface definitions
 */

import { TurtleParseResult, ParsedTriple } from '../turtle-parser.js';
import { 
  xsdToTypeScript, 
  generateJSDoc, 
  getEnterpriseType,
  isArrayType,
  RDFS_NAMESPACE,
  RDF_NAMESPACE,
  XSD_NAMESPACE
} from './datatype-mappings.js';

export interface TypeScriptGenerationOptions {
  /** Namespace for generated interfaces (default: 'Generated') */
  namespace?: string;
  
  /** Output format (default: 'interface') */
  outputFormat?: 'interface' | 'type' | 'class';
  
  /** Include validation decorators (default: false) */
  includeValidation?: boolean;
  
  /** Generate enums for known value sets (default: true) */
  generateEnums?: boolean;
  
  /** Include JSDoc comments from rdfs:label/comment (default: true) */
  includeDocumentation?: boolean;
  
  /** Prefix for generated type names (default: '') */
  typePrefix?: string;
  
  /** Include enterprise-specific type mappings (default: false) */
  enterpriseTypes?: boolean;
  
  /** Base URI for the ontology */
  baseUri?: string;
}

export interface TypeScriptInterface {
  name: string;
  documentation?: string;
  properties: TypeScriptProperty[];
  extends?: string[];
}

export interface TypeScriptProperty {
  name: string;
  type: string;
  optional: boolean;
  documentation?: string;
  validation?: string[];
}

/**
 * Main generator class for converting ontologies to TypeScript
 */
export class OntologyToTypeScriptGenerator {
  private options: Required<TypeScriptGenerationOptions>;
  private classes = new Map<string, TypeScriptInterface>();
  private properties = new Map<string, ParsedTriple[]>();
  private enums = new Map<string, Set<string>>();

  constructor(options: TypeScriptGenerationOptions = {}) {
    this.options = {
      namespace: 'Generated',
      outputFormat: 'interface',
      includeValidation: false,
      generateEnums: true,
      includeDocumentation: true,
      typePrefix: '',
      enterpriseTypes: false,
      baseUri: 'http://example.org/',
      ...options
    };
  }

  /**
   * Generate TypeScript interfaces from RDF ontology
   */
  async generateTypeScript(ontologyData: TurtleParseResult): Promise<string> {
    // Step 1: Extract classes and properties
    this.extractClasses(ontologyData);
    this.extractProperties(ontologyData);
    
    // Step 2: Build interface definitions
    this.buildInterfaces(ontologyData);
    
    // Step 3: Generate TypeScript code
    return this.generateCode();
  }

  /**
   * Extract RDF Schema classes from the ontology
   */
  private extractClasses(data: TurtleParseResult): void {
    const classTriples = data.triples.filter(triple => 
      triple.predicate.value === `${RDF_NAMESPACE}type` &&
      (triple.object.value === `${RDFS_NAMESPACE}Class` || 
       triple.object.value.includes('owl#Class'))
    );

    for (const triple of classTriples) {
      const classUri = triple.subject.value;
      const className = this.uriToClassName(classUri);
      
      if (!this.classes.has(classUri)) {
        this.classes.set(classUri, {
          name: className,
          properties: [],
          extends: []
        });
      }
    }
  }

  /**
   * Extract RDF properties and their domains/ranges
   */
  private extractProperties(data: TurtleParseResult): void {
    // Group triples by subject to analyze properties
    const triplesBySubject = new Map<string, ParsedTriple[]>();
    
    for (const triple of data.triples) {
      if (!triplesBySubject.has(triple.subject.value)) {
        triplesBySubject.set(triple.subject.value, []);
      }
      triplesBySubject.get(triple.subject.value)!.push(triple);
    }

    // Identify properties (things with rdfs:domain or rdfs:range)
    for (const [subjectUri, triples] of triplesBySubject) {
      const isProperty = triples.some(t => 
        t.predicate.value === `${RDF_NAMESPACE}type` &&
        (t.object.value === `${RDF_NAMESPACE}Property` ||
         t.object.value === `${RDFS_NAMESPACE}Property` ||
         t.object.value.includes('owl#ObjectProperty') ||
         t.object.value.includes('owl#DatatypeProperty'))
      );

      if (isProperty) {
        this.properties.set(subjectUri, triples);
      }
    }
  }

  /**
   * Build interface definitions with properties
   */
  private buildInterfaces(data: TurtleParseResult): void {
    for (const [propertyUri, propertyTriples] of this.properties) {
      // Find domain and range
      const domainTriple = propertyTriples.find(t => t.predicate.value === `${RDFS_NAMESPACE}domain`);
      const rangeTriple = propertyTriples.find(t => t.predicate.value === `${RDFS_NAMESPACE}range`);
      const labelTriple = propertyTriples.find(t => t.predicate.value === `${RDFS_NAMESPACE}label`);
      const commentTriple = propertyTriples.find(t => t.predicate.value === `${RDFS_NAMESPACE}comment`);

      if (domainTriple && this.classes.has(domainTriple.object.value)) {
        const classInterface = this.classes.get(domainTriple.object.value)!;
        const propertyName = this.uriToPropertyName(propertyUri);
        
        // Determine TypeScript type
        let tsType = 'string'; // Default
        if (rangeTriple) {
          if (this.options.enterpriseTypes) {
            tsType = getEnterpriseType(propertyUri, rangeTriple.object.value);
          } else {
            tsType = this.mapRangeToType(rangeTriple.object.value, data);
          }
        }

        // Check for cardinality constraints (SHACL or OWL)
        const isOptional = !this.hasMinCardinality(propertyUri, data);
        const isArray = this.hasMaxCardinalityGreaterThanOne(propertyUri, data);
        
        if (isArray) {
          tsType = `${tsType}[]`;
        }

        // Generate documentation
        let documentation: string | undefined;
        if (this.options.includeDocumentation) {
          const label = labelTriple?.object.value;
          const comment = commentTriple?.object.value;
          if (label || comment) {
            documentation = generateJSDoc(label, comment).replace(/\/\*\*|\*\/|\s*\*/g, '').trim();
          }
        }

        classInterface.properties.push({
          name: propertyName,
          type: tsType,
          optional: isOptional,
          documentation
        });
      }
    }

    // Add labels and comments to classes
    if (this.options.includeDocumentation) {
      for (const [classUri, classInterface] of this.classes) {
        const classTriples = data.triples.filter(t => t.subject.value === classUri);
        const labelTriple = classTriples.find(t => t.predicate.value === `${RDFS_NAMESPACE}label`);
        const commentTriple = classTriples.find(t => t.predicate.value === `${RDFS_NAMESPACE}comment`);
        
        if (labelTriple || commentTriple) {
          const label = labelTriple?.object.value;
          const comment = commentTriple?.object.value;
          classInterface.documentation = generateJSDoc(label, comment).replace(/\/\*\*|\*\/|\s*\*/g, '').trim();
        }
      }
    }
  }

  /**
   * Generate the final TypeScript code
   */
  private generateCode(): string {
    const lines: string[] = [];

    // Header
    lines.push('/**');
    lines.push(' * Auto-generated TypeScript interfaces from RDF ontology');
    lines.push(' * Generated by Unjucks Ontology-to-TypeScript converter');
    lines.push(' * Do not edit manually - regenerate from source ontology');
    lines.push(' */');
    lines.push('');

    // Namespace declaration
    if (this.options.namespace && this.options.namespace !== 'Generated') {
      lines.push(`export namespace ${this.options.namespace} {`);
    }

    // Generate interfaces
    for (const [classUri, classInterface] of this.classes) {
      if (classInterface.properties.length === 0) continue;

      // Class documentation
      if (classInterface.documentation) {
        lines.push('  /**');
        lines.push(`   * ${classInterface.documentation}`);
        lines.push(`   * @source ${classUri}`);
        lines.push('   */');
      }

      // Interface declaration
      const extendsClause = classInterface.extends?.length > 0 
        ? ` extends ${classInterface.extends.join(', ')}` 
        : '';
      
      lines.push(`  export interface ${classInterface.name}${extendsClause} {`);

      // Properties
      for (const prop of classInterface.properties) {
        if (prop.documentation) {
          lines.push('    /**');
          lines.push(`     * ${prop.documentation}`);
          lines.push('     */');
        }
        
        const optional = prop.optional ? '?' : '';
        lines.push(`    ${prop.name}${optional}: ${prop.type};`);
        lines.push('');
      }

      lines.push('  }');
      lines.push('');
    }

    // Generate enums if requested
    if (this.options.generateEnums) {
      for (const [enumName, values] of this.enums) {
        lines.push(`  export enum ${enumName} {`);
        for (const value of values) {
          const enumKey = this.valueToEnumKey(value);
          lines.push(`    ${enumKey} = '${value}',`);
        }
        lines.push('  }');
        lines.push('');
      }
    }

    // Close namespace
    if (this.options.namespace && this.options.namespace !== 'Generated') {
      lines.push('}');
    }

    return lines.join('\n');
  }

  /**
   * Convert URI to TypeScript class name
   */
  private uriToClassName(uri: string): string {
    const localName = uri.split(/[#/]/).pop() || 'Unknown';
    const pascalCase = localName.charAt(0).toUpperCase() + localName.slice(1);
    return `${this.options.typePrefix}${pascalCase}`;
  }

  /**
   * Convert URI to TypeScript property name
   */
  private uriToPropertyName(uri: string): string {
    const localName = uri.split(/[#/]/).pop() || 'unknown';
    // Convert to camelCase
    return localName.charAt(0).toLowerCase() + localName.slice(1);
  }

  /**
   * Map RDF range to TypeScript type
   */
  private mapRangeToType(rangeUri: string, data: TurtleParseResult): string {
    // Check if it's a class (object property)
    if (this.classes.has(rangeUri)) {
      return this.uriToClassName(rangeUri);
    }

    // Check if it's an XSD datatype
    if (rangeUri.startsWith(XSD_NAMESPACE) || rangeUri.includes('XMLSchema#')) {
      return xsdToTypeScript(rangeUri);
    }

    // Check if it's a known enumeration
    const enumValues = this.getEnumValues(rangeUri, data);
    if (enumValues.size > 0) {
      const enumName = this.uriToClassName(rangeUri);
      this.enums.set(enumName, enumValues);
      return enumName;
    }

    return 'string'; // Fallback
  }

  /**
   * Check if property has minimum cardinality > 0 (required)
   */
  private hasMinCardinality(propertyUri: string, data: TurtleParseResult): boolean {
    // Look for SHACL shapes or OWL cardinality restrictions
    return false; // Default to optional
  }

  /**
   * Check if property has maximum cardinality > 1 (array)
   */
  private hasMaxCardinalityGreaterThanOne(propertyUri: string, data: TurtleParseResult): boolean {
    // Look for SHACL shapes or OWL cardinality restrictions
    return false; // Default to single value
  }

  /**
   * Get enumeration values for a range
   */
  private getEnumValues(rangeUri: string, data: TurtleParseResult): Set<string> {
    const values = new Set<string>();
    // Look for owl:oneOf or similar patterns
    return values;
  }

  /**
   * Convert value to valid enum key
   */
  private valueToEnumKey(value: string): string {
    return value
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/^(\d)/, '_$1') // Prefix with _ if starts with number
      .toUpperCase();
  }
}

/**
 * Convenience function to generate TypeScript from ontology
 */
export async function generateTypeScriptFromOntology(
  ontologyData: TurtleParseResult,
  options?: TypeScriptGenerationOptions
): Promise<string> {
  const generator = new OntologyToTypeScriptGenerator(options);
  return generator.generateTypeScript(ontologyData);
}