/**
 * Full-Cycle RDF ↔ TypeScript Type Converter
 * 80/20 implementation focusing on enterprise patterns
 */

import { Parser, Store, DataFactory, Quad } from 'n3';
import * as fs from 'node:fs/promises';
import { CommonVocabularies, CommonProperties, type TurtleData, type RDFResource, type RDFValue } from './types/turtle-types.js';

const { namedNode, literal } = DataFactory;

export interface TypeDefinition {
  name: string;
  uri: string;
  description?: string;
  properties: PropertyDefinition[];
  extends?: string[];
  ontology: string;
}

export interface PropertyDefinition {
  name: string;
  uri: string;
  type: TypescriptType;
  required: boolean;
  description?: string;
  constraints?: PropertyConstraints;
  examples?: any[];
}

export interface PropertyConstraints {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  enum?: string[];
  format?: 'email' | 'uri' | 'date' | 'datetime' | 'uuid';
}

export type TypescriptType = 
  | 'string' | 'number' | 'boolean' | 'Date' 
  | 'string[]' | 'number[]' | 'boolean[]'
  | { interface: string }
  | { union: TypescriptType[] }
  | { literal: string };

/**
 * RDF Schema Analyzer - Extract classes and properties from RDF/OWL ontologies
 */
export class RDFSchemaAnalyzer {
  private store: Store;
  private prefixes: Record<string, string>;

  constructor() {
    this.store = new Store();
    this.prefixes = {
      rdf: CommonVocabularies.RDF,
      rdfs: CommonVocabularies.RDFS,
      owl: CommonVocabularies.OWL,
      xsd: CommonVocabularies.XSD,
      foaf: CommonVocabularies.FOAF,
      schema: CommonVocabularies.SCHEMA,
      dc: CommonVocabularies.DCTERMS,
    };
  }

  async analyzeTurtleFile(filepath: string): Promise<TypeDefinition[]> {
    const content = await fs.readFile(filepath, 'utf-8');
    return this.analyzeTurtleContent(content);
  }

  async analyzeTurtleContent(turtleContent: string): Promise<TypeDefinition[]> {
    await this.parseIntoStore(turtleContent);
    return this.extractTypeDefinitions();
  }

  private async parseIntoStore(content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const parser = new Parser();
      parser.parse(content, (error, quad, prefixes) => {
        if (error) {
          reject(error);
        } else if (quad) {
          this.store.add(quad);
        } else {
          // Parsing complete
          if (prefixes) {
            this.prefixes = { ...this.prefixes, ...prefixes };
          }
          resolve();
        }
      });
    });
  }

  private extractTypeDefinitions(): TypeDefinition[] {
    const classes = this.findClasses();
    return classes.map(classUri => this.buildTypeDefinition(classUri));
  }

  private findClasses(): string[] {
    const classes: string[] = [];
    
    // Find OWL classes
    const owlClasses = this.store.getQuads(
      null,
      namedNode(`${CommonVocabularies.RDF}type`),
      namedNode(`${CommonVocabularies.OWL}Class`),
      null
    );
    owlClasses.forEach(quad => classes.push(quad.subject.value));

    // Find RDFS classes
    const rdfsClasses = this.store.getQuads(
      null,
      namedNode(`${CommonVocabularies.RDF}type`),
      namedNode(`${CommonVocabularies.RDFS}Class`),
      null
    );
    rdfsClasses.forEach(quad => classes.push(quad.subject.value));

    return [...new Set(classes)];
  }

  private buildTypeDefinition(classUri: string): TypeDefinition {
    const name = this.getLocalName(classUri);
    const description = this.getDescription(classUri);
    const ontology = this.getOntologyName(classUri);
    const properties = this.getClassProperties(classUri);
    const parentClasses = this.getParentClasses(classUri);

    return {
      name: this.toPascalCase(name),
      uri: classUri,
      description,
      properties,
      extends: parentClasses.map(uri => this.toPascalCase(this.getLocalName(uri))),
      ontology
    };
  }

  private getClassProperties(classUri: string): PropertyDefinition[] {
    const properties: PropertyDefinition[] = [];
    
    // Find properties with domain pointing to this class
    const domainQuads = this.store.getQuads(
      null,
      namedNode(`${CommonVocabularies.RDFS}domain`),
      namedNode(classUri),
      null
    );

    domainQuads.forEach(quad => {
      const propertyUri = quad.subject.value;
      const property = this.buildPropertyDefinition(propertyUri);
      properties.push(property);
    });

    return properties;
  }

  private buildPropertyDefinition(propertyUri: string): PropertyDefinition {
    const name = this.getLocalName(propertyUri);
    const description = this.getDescription(propertyUri);
    const range = this.getRange(propertyUri);
    const required = this.isRequiredProperty(propertyUri);
    const constraints = this.extractConstraints(propertyUri);

    return {
      name: this.toCamelCase(name),
      uri: propertyUri,
      type: this.rdfTypeToTypescript(range),
      required,
      description,
      constraints,
      examples: this.getExamples(propertyUri)
    };
  }

  private rdfTypeToTypescript(rdfType?: string): TypescriptType {
    if (!rdfType) return 'string';

    // XSD datatypes mapping
    const xsdMappings: Record<string, TypescriptType> = {
      [`${CommonVocabularies.XSD}string`]: 'string',
      [`${CommonVocabularies.XSD}integer`]: 'number',
      [`${CommonVocabularies.XSD}decimal`]: 'number',
      [`${CommonVocabularies.XSD}double`]: 'number',
      [`${CommonVocabularies.XSD}float`]: 'number',
      [`${CommonVocabularies.XSD}boolean`]: 'boolean',
      [`${CommonVocabularies.XSD}date`]: 'Date',
      [`${CommonVocabularies.XSD}dateTime`]: 'Date',
      [`${CommonVocabularies.XSD}anyURI`]: 'string',
    };

    if (xsdMappings[rdfType]) {
      return xsdMappings[rdfType];
    }

    // If it's a class, return interface reference
    if (this.isClass(rdfType)) {
      return { interface: this.toPascalCase(this.getLocalName(rdfType)) };
    }

    return 'string';
  }

  private isClass(uri: string): boolean {
    const owlClass = this.store.getQuads(
      namedNode(uri),
      namedNode(`${CommonVocabularies.RDF}type`),
      namedNode(`${CommonVocabularies.OWL}Class`),
      null
    );
    
    const rdfsClass = this.store.getQuads(
      namedNode(uri),
      namedNode(`${CommonVocabularies.RDF}type`),
      namedNode(`${CommonVocabularies.RDFS}Class`),
      null
    );

    return owlClass.length > 0 || rdfsClass.length > 0;
  }

  private getRange(propertyUri: string): string | undefined {
    const rangeQuads = this.store.getQuads(
      namedNode(propertyUri),
      namedNode(`${CommonVocabularies.RDFS}range`),
      null,
      null
    );

    return rangeQuads[0]?.object.value;
  }

  private getParentClasses(classUri: string): string[] {
    const subClassQuads = this.store.getQuads(
      namedNode(classUri),
      namedNode(`${CommonVocabularies.RDFS}subClassOf`),
      null,
      null
    );

    return subClassQuads.map(quad => quad.object.value);
  }

  private getDescription(uri: string): string | undefined {
    const descriptionProps = [
      CommonProperties.COMMENT,
      CommonProperties.DESCRIPTION,
      CommonProperties.LABEL,
    ];

    for (const prop of descriptionProps) {
      const quads = this.store.getQuads(
        namedNode(uri),
        namedNode(prop),
        null,
        null
      );
      if (quads.length > 0) {
        return quads[0].object.value;
      }
    }

    return undefined;
  }

  private isRequiredProperty(propertyUri: string): boolean {
    // Check for OWL cardinality restrictions or similar
    const restrictionQuads = this.store.getQuads(
      null,
      namedNode(`${CommonVocabularies.OWL}minCardinality`),
      null,
      null
    );

    // For now, use heuristics - properties like 'name', 'type' are often required
    const name = this.getLocalName(propertyUri);
    const commonRequired = ['name', 'type', 'id', 'identifier'];
    return commonRequired.includes(name.toLowerCase());
  }

  private extractConstraints(propertyUri: string): PropertyConstraints | undefined {
    const constraints: PropertyConstraints = {};
    
    // Extract from OWL restrictions, SHACL constraints, etc.
    // For 80/20 implementation, use common patterns
    const name = this.getLocalName(propertyUri);
    
    if (name.toLowerCase().includes('email')) {
      constraints.format = 'email';
      constraints.pattern = '^[^@]+@[^@]+\\.[^@]+$';
    }
    
    if (name.toLowerCase().includes('url') || name.toLowerCase().includes('uri')) {
      constraints.format = 'uri';
    }
    
    if (name.toLowerCase().includes('date')) {
      constraints.format = 'date';
    }

    return Object.keys(constraints).length > 0 ? constraints : undefined;
  }

  private getExamples(propertyUri: string): any[] {
    // Extract examples from RDF data or use common patterns
    const name = this.getLocalName(propertyUri);
    const exampleMappings: Record<string, any[]> = {
      name: ['John Doe', 'Acme Corporation', 'Sample Product'],
      email: ['user@example.com', 'contact@company.org'],
      homepage: ['https://example.com', 'https://company.org'],
      age: [25, 30, 45],
      description: ['A sample description', 'Brief overview'],
    };

    return exampleMappings[name.toLowerCase()] || [];
  }

  private getOntologyName(uri: string): string {
    if (uri.startsWith(CommonVocabularies.FOAF)) return 'FOAF';
    if (uri.startsWith(CommonVocabularies.SCHEMA)) return 'Schema.org';
    if (uri.startsWith(CommonVocabularies.DCTERMS)) return 'Dublin Core';
    if (uri.startsWith(CommonVocabularies.OWL)) return 'OWL';
    if (uri.startsWith(CommonVocabularies.RDFS)) return 'RDF Schema';
    return 'Custom';
  }

  private getLocalName(uri: string): string {
    if (uri.includes('#')) {
      return uri.split('#').pop() || uri;
    }
    return uri.split('/').pop() || uri;
  }

  private toPascalCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space before caps
      .split(/[\s_-]+/) // Split on space, underscore, dash
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  private toCamelCase(str: string): string {
    const pascal = this.toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }
}

/**
 * TypeScript Definition Generator - Convert RDF types to .d.ts files
 */
export class TypeScriptGenerator {
  generateDefinitions(types: TypeDefinition[]): string {
    const imports = this.generateImports();
    const interfaces = types.map(type => this.generateInterface(type)).join('\n\n');
    
    return `${imports}\n\n${interfaces}`;
  }

  private generateImports(): string {
    return `// Generated from RDF/OWL ontology
// Do not edit manually - regenerate from source ontology

import { z } from 'zod';`;
  }

  private generateInterface(type: TypeDefinition): string {
    const extendsClause = type.extends && type.extends.length > 0 
      ? ` extends ${type.extends.join(', ')}` 
      : '';

    const properties = type.properties
      .map(prop => this.generateProperty(prop))
      .join('\n  ');

    const description = type.description 
      ? `/**\n * ${type.description}\n * @ontology ${type.ontology}\n * @uri ${type.uri}\n */\n`
      : '';

    return `${description}export interface ${type.name}${extendsClause} {
  ${properties}
}`;
  }

  private generateProperty(prop: PropertyDefinition): string {
    const optional = prop.required ? '' : '?';
    const typeStr = this.typeToString(prop.type);
    const description = prop.description ? `/** ${prop.description} */\n  ` : '';
    
    return `${description}${prop.name}${optional}: ${typeStr};`;
  }

  private typeToString(type: TypescriptType): string {
    if (typeof type === 'string') {
      return type;
    }
    
    if ('interface' in type) {
      return type.interface;
    }
    
    if ('union' in type) {
      return type.union.map(t => this.typeToString(t)).join(' | ');
    }
    
    if ('literal' in type) {
      return `"${type.literal}"`;
    }
    
    return 'unknown';
  }
}

/**
 * Zod Schema Generator - Convert TypeScript interfaces to Zod validation schemas
 */
export class ZodSchemaGenerator {
  generateSchemas(types: TypeDefinition[]): string {
    const imports = `import { z } from 'zod';\n\n`;
    const schemas = types.map(type => this.generateZodSchema(type)).join('\n\n');
    
    return `${imports}${schemas}`;
  }

  private generateZodSchema(type: TypeDefinition): string {
    const properties = type.properties
      .map(prop => this.generateZodProperty(prop))
      .join(',\n  ');

    const description = type.description 
      ? `// ${type.description}\n`
      : '';

    return `${description}export const ${type.name}Schema = z.object({
  ${properties}
});

export type ${type.name} = z.infer<typeof ${type.name}Schema>;`;
  }

  private generateZodProperty(prop: PropertyDefinition): string {
    let zodType = this.typeToZod(prop.type);
    
    // Apply constraints
    if (prop.constraints) {
      zodType = this.applyConstraints(zodType, prop.constraints);
    }

    // Add description
    if (prop.description) {
      zodType += `.describe("${prop.description}")`;
    }

    // Make optional if not required
    if (!prop.required) {
      zodType += '.optional()';
    }

    return `${prop.name}: ${zodType}`;
  }

  private typeToZod(type: TypescriptType): string {
    if (typeof type === 'string') {
      switch (type) {
        case 'string': return 'z.string()';
        case 'number': return 'z.number()';
        case 'boolean': return 'z.boolean()';
        case 'Date': return 'z.date()';
        case 'string[]': return 'z.array(z.string())';
        case 'number[]': return 'z.array(z.number())';
        case 'boolean[]': return 'z.array(z.boolean())';
        default: return 'z.unknown()';
      }
    }

    if ('interface' in type) {
      return `${type.interface}Schema`;
    }

    if ('union' in type) {
      const unionTypes = type.union.map(t => this.typeToZod(t)).join(', ');
      return `z.union([${unionTypes}])`;
    }

    if ('literal' in type) {
      return `z.literal("${type.literal}")`;
    }

    return 'z.unknown()';
  }

  private applyConstraints(zodType: string, constraints: PropertyConstraints): string {
    let result = zodType;

    if (constraints.minLength !== undefined) {
      result = result.replace('z.string()', `z.string().min(${constraints.minLength})`);
    }

    if (constraints.maxLength !== undefined) {
      if (result.includes('.min(')) {
        result = result.replace(/\.min\((\d+)\)/, `.min($1).max(${constraints.maxLength})`);
      } else {
        result = result.replace('z.string()', `z.string().max(${constraints.maxLength})`);
      }
    }

    if (constraints.pattern) {
      result = result.replace(/z\.string\(\)([^.]*)/, `z.string()$1.regex(/${constraints.pattern}/)`);
    }

    if (constraints.format) {
      switch (constraints.format) {
        case 'email':
          result = result.replace(/z\.string\(\)([^.]*)/, 'z.string()$1.email()');
          break;
        case 'uri':
          result = result.replace(/z\.string\(\)([^.]*)/, 'z.string()$1.url()');
          break;
        case 'uuid':
          result = result.replace(/z\.string\(\)([^.]*)/, 'z.string()$1.uuid()');
          break;
      }
    }

    if (constraints.minimum !== undefined && result.includes('z.number()')) {
      result = result.replace('z.number()', `z.number().min(${constraints.minimum})`);
    }

    if (constraints.maximum !== undefined && result.includes('z.number()')) {
      if (result.includes('.min(')) {
        result = result.replace(/\.min\(([^)]+)\)/, `.min($1).max(${constraints.maximum})`);
      } else {
        result = result.replace('z.number()', `z.number().max(${constraints.maximum})`);
      }
    }

    if (constraints.enum) {
      const enumValues = constraints.enum.map(v => `"${v}"`).join(', ');
      result = `z.enum([${enumValues}])`;
    }

    return result;
  }
}

/**
 * Reverse Converter - TypeScript interfaces back to RDF ontology
 */
export class TypeScriptToRDFConverter {
  generateOntology(types: TypeDefinition[], baseUri: string = 'http://example.org/'): string {
    const prefixes = this.generatePrefixes();
    const classes = types.map(type => this.generateClass(type, baseUri)).join('\n\n');
    const properties = types.flatMap(type => 
      type.properties.map(prop => this.generateProperty(prop, baseUri))
    ).join('\n\n');

    return `${prefixes}\n\n# Classes\n${classes}\n\n# Properties\n${properties}`;
  }

  private generatePrefixes(): string {
    return `@prefix rdf: <${CommonVocabularies.RDF}> .
@prefix rdfs: <${CommonVocabularies.RDFS}> .
@prefix owl: <${CommonVocabularies.OWL}> .
@prefix xsd: <${CommonVocabularies.XSD}> .
@prefix ex: <http://example.org/> .`;
  }

  private generateClass(type: TypeDefinition, baseUri: string): string {
    const classUri = `ex:${type.name}`;
    let turtle = `${classUri} a owl:Class`;

    if (type.description) {
      turtle += ` ;\n    rdfs:comment "${type.description}"`;
    }

    if (type.extends && type.extends.length > 0) {
      const parentClasses = type.extends.map(parent => `ex:${parent}`).join(', ');
      turtle += ` ;\n    rdfs:subClassOf ${parentClasses}`;
    }

    turtle += ' .';
    return turtle;
  }

  private generateProperty(prop: PropertyDefinition, baseUri: string): string {
    const propUri = `ex:${prop.name}`;
    let turtle = `${propUri} a owl:DatatypeProperty`;

    if (prop.description) {
      turtle += ` ;\n    rdfs:comment "${prop.description}"`;
    }

    // Add range based on TypeScript type
    const range = this.typescriptTypeToRDF(prop.type);
    if (range) {
      turtle += ` ;\n    rdfs:range ${range}`;
    }

    turtle += ' .';
    return turtle;
  }

  private typescriptTypeToRDF(type: TypescriptType): string | undefined {
    if (typeof type === 'string') {
      switch (type) {
        case 'string': return 'xsd:string';
        case 'number': return 'xsd:decimal';
        case 'boolean': return 'xsd:boolean';
        case 'Date': return 'xsd:dateTime';
        default: return 'xsd:string';
      }
    }

    if ('interface' in type) {
      return `ex:${type.interface}`;
    }

    return undefined;
  }
}

/**
 * Full-Cycle Converter - Main orchestrator class
 */
export class RDFTypeConverter {
  private analyzer: RDFSchemaAnalyzer;
  private tsGenerator: TypeScriptGenerator;
  private zodGenerator: ZodSchemaGenerator;
  private rdfGenerator: TypeScriptToRDFConverter;

  constructor() {
    this.analyzer = new RDFSchemaAnalyzer();
    this.tsGenerator = new TypeScriptGenerator();
    this.zodGenerator = new ZodSchemaGenerator();
    this.rdfGenerator = new TypeScriptToRDFConverter();
  }

  /**
   * Full cycle: TTL → .d.ts → Zod schemas
   */
  async convertTurtleToTypeScript(
    turtleFile: string,
    outputDir: string = './generated'
  ): Promise<{
    types: string;
    schemas: string;
    definitions: TypeDefinition[];
  }> {
    // Analyze RDF schema
    const definitions = await this.analyzer.analyzeTurtleFile(turtleFile);

    // Generate TypeScript interfaces
    const types = this.tsGenerator.generateDefinitions(definitions);

    // Generate Zod schemas
    const schemas = this.zodGenerator.generateSchemas(definitions);

    // Write files
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(`${outputDir}/types.d.ts`, types);
    await fs.writeFile(`${outputDir}/schemas.ts`, schemas);

    return { types, schemas, definitions };
  }

  /**
   * Reverse cycle: TypeScript → RDF ontology
   */
  async convertTypeScriptToTurtle(
    definitions: TypeDefinition[],
    outputFile: string,
    baseUri?: string
  ): Promise<string> {
    const ontology = this.rdfGenerator.generateOntology(definitions, baseUri);
    await fs.writeFile(outputFile, ontology);
    return ontology;
  }

  /**
   * Generate validation utilities
   */
  generateValidationHelpers(types: TypeDefinition[]): string {
    return `// Generated validation helpers
import { z } from 'zod';
${types.map(type => `import { ${type.name}Schema } from './schemas.js';`).join('\n')}

${types.map(type => `
export function validate${type.name}(data: unknown): ${type.name} {
  return ${type.name}Schema.parse(data);
}

export function is${type.name}(data: unknown): data is ${type.name} {
  return ${type.name}Schema.safeParse(data).success;
}
`).join('\n')}

// Bulk validation
export const validators = {
${types.map(type => `  ${type.name.toLowerCase()}: ${type.name}Schema`).join(',\n')}
};`;
  }
}

// Export convenience functions
export async function convertTurtleToTypes(turtleFile: string, outputDir?: string) {
  const converter = new RDFTypeConverter();
  return converter.convertTurtleToTypeScript(turtleFile, outputDir);
}

export async function convertTypesToTurtle(definitions: TypeDefinition[], outputFile: string, baseUri?: string) {
  const converter = new RDFTypeConverter();
  return converter.convertTypeScriptToTurtle(definitions, outputFile, baseUri);
}