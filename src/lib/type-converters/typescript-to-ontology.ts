/**
 * TypeScript to RDF Ontology Generator  
 * Converts TypeScript interfaces to RDF Schema/OWL ontologies
 */

import * as ts from 'typescript';
import { typeScriptToXsd, RDFS_NAMESPACE, RDF_NAMESPACE, XSD_NAMESPACE } from './datatype-mappings.js';

export interface OntologyGenerationOptions {
  /** Base URI for generated ontology (default: 'http://example.org/') */
  baseUri?: string;
  
  /** Output format (default: 'turtle') */
  format?: 'turtle' | 'rdf-xml' | 'n3' | 'json-ld';
  
  /** Include OWL constructs vs pure RDFS (default: false) */
  useOWL?: boolean;
  
  /** Generate SHACL shapes for validation (default: false) */
  generateShapes?: boolean;
  
  /** Namespace prefix for generated classes (default: 'ex') */
  namespacePrefix?: string;
  
  /** Include cardinality constraints (default: true) */
  includeCardinality?: boolean;
  
  /** Enterprise compliance mapping (default: false) */
  enterpriseCompliance?: boolean;
}

export interface RDFClass {
  uri: string;
  label?: string;
  comment?: string;
  properties: RDFProperty[];
  superClasses: string[];
}

export interface RDFProperty {
  uri: string;
  label?: string;
  comment?: string;
  domain: string;
  range: string;
  required: boolean;
  multiValued: boolean;
}

/**
 * TypeScript AST analyzer for interface extraction
 */
export class TypeScriptAnalyzer {
  private sourceFile: ts.SourceFile;
  private typeChecker: ts.TypeChecker;

  constructor(sourceCode: string) {
    // Create TypeScript program for analysis
    const program = ts.createProgram(['temp.ts'], {}, {
      getSourceFile: (fileName) => {
        if (fileName === 'temp.ts') {
          return ts.createSourceFile(fileName, sourceCode, ts.ScriptTarget.Latest);
        }
        return undefined;
      },
      writeFile: () => {},
      getCurrentDirectory: () => '',
      getDirectories: () => [],
      fileExists: () => true,
      readFile: () => '',
      getCanonicalFileName: (fileName) => fileName,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\n'
    });

    this.sourceFile = program.getSourceFile('temp.ts')!;
    this.typeChecker = program.getTypeChecker();
  }

  /**
   * Extract all interfaces from TypeScript source
   */
  extractInterfaces(): ts.InterfaceDeclaration[] {
    const interfaces: ts.InterfaceDeclaration[] = [];

    const visit = (node: ts.Node): void => {
      if (ts.isInterfaceDeclaration(node)) {
        interfaces.push(node);
      }
      ts.forEachChild(node, visit);
    };

    ts.forEachChild(this.sourceFile, visit);
    return interfaces;
  }

  /**
   * Get JSDoc comments from a node
   */
  getJSDocComment(node: ts.Node): string | undefined {
    const jsDoc = ts.getJSDocCommentsAndTags(node);
    if (jsDoc.length > 0) {
      const comment = jsDoc[0];
      if (ts.isJSDoc(comment) && comment.comment) {
        return ts.getTextOfJSDocComment(comment.comment);
      }
    }
    return undefined;
  }

  /**
   * Analyze interface properties
   */
  analyzeProperty(property: ts.PropertySignature): {
    name: string;
    type: string;
    optional: boolean;
    comment?: string;
  } {
    const name = property.name?.getText() || 'unknown';
    const optional = !!property.questionToken;
    const comment = this.getJSDocComment(property);
    
    let type = 'string'; // Default
    if (property.type) {
      type = this.typeNodeToString(property.type);
    }

    return { name, type, optional, comment };
  }

  /**
   * Convert TypeScript type node to string representation
   */
  private typeNodeToString(typeNode: ts.TypeNode): string {
    switch (typeNode.kind) {
      case ts.SyntaxKind.StringKeyword:
        return 'string';
      case ts.SyntaxKind.NumberKeyword:
        return 'number';
      case ts.SyntaxKind.BooleanKeyword:
        return 'boolean';
      case ts.SyntaxKind.ArrayType:
        const arrayType = typeNode as ts.ArrayTypeNode;
        return `${this.typeNodeToString(arrayType.elementType)}[]`;
      case ts.SyntaxKind.TypeReference:
        const typeRef = typeNode as ts.TypeReferenceNode;
        if (typeRef.typeName && ts.isIdentifier(typeRef.typeName)) {
          return typeRef.typeName.text;
        }
        break;
    }
    return typeNode.getText();
  }
}

/**
 * Main generator class for TypeScript to Ontology conversion
 */
export class TypeScriptToOntologyGenerator {
  private options: Required<OntologyGenerationOptions>;
  private classes = new Map<string, RDFClass>();
  
  constructor(options: OntologyGenerationOptions = {}) {
    this.options = {
      baseUri: 'http://example.org/',
      format: 'turtle',
      useOWL: false,
      generateShapes: false,
      namespacePrefix: 'ex',
      includeCardinality: true,
      enterpriseCompliance: false,
      ...options
    };
  }

  /**
   * Generate RDF ontology from TypeScript interfaces
   */
  async generateOntology(sourceCode: string): Promise<string> {
    const analyzer = new TypeScriptAnalyzer(sourceCode);
    const interfaces = analyzer.extractInterfaces();

    // Convert interfaces to RDF classes
    for (const interfaceDecl of interfaces) {
      const rdfClass = this.convertInterfaceToRDFClass(interfaceDecl, analyzer);
      this.classes.set(rdfClass.uri, rdfClass);
    }

    // Generate the ontology based on format
    return this.generateTurtleOntology();
  }

  /**
   * Convert TypeScript interface to RDF class
   */
  private convertInterfaceToRDFClass(
    interfaceDecl: ts.InterfaceDeclaration,
    analyzer: TypeScriptAnalyzer
  ): RDFClass {
    const className = interfaceDecl.name.text;
    const uri = `${this.options.baseUri}${className}`;
    const comment = analyzer.getJSDocComment(interfaceDecl);
    
    const rdfClass: RDFClass = {
      uri,
      label: className,
      comment,
      properties: [],
      superClasses: []
    };

    // Process heritage clauses (extends)
    if (interfaceDecl.heritageClauses) {
      for (const heritage of interfaceDecl.heritageClauses) {
        if (heritage.token === ts.SyntaxKind.ExtendsKeyword) {
          for (const type of heritage.types) {
            if (ts.isIdentifier(type.expression)) {
              const superClassUri = `${this.options.baseUri}${type.expression.text}`;
              rdfClass.superClasses.push(superClassUri);
            }
          }
        }
      }
    }

    // Process properties
    for (const member of interfaceDecl.members) {
      if (ts.isPropertySignature(member)) {
        const propAnalysis = analyzer.analyzeProperty(member);
        const property = this.convertPropertyToRDF(propAnalysis, uri);
        rdfClass.properties.push(property);
      }
    }

    return rdfClass;
  }

  /**
   * Convert TypeScript property to RDF property
   */
  private convertPropertyToRDF(
    propAnalysis: { name: string; type: string; optional: boolean; comment?: string },
    domainUri: string
  ): RDFProperty {
    const propertyUri = `${this.options.baseUri}${propAnalysis.name}`;
    
    // Map TypeScript type to XSD/RDF range
    let range: string;
    const baseType = propAnalysis.type.replace(/\[\]$/, '').replace(/\?$/, '');
    
    if (baseType === 'Date') {
      range = `${XSD_NAMESPACE}dateTime`;
    } else if (['string', 'number', 'boolean'].includes(baseType)) {
      range = `${XSD_NAMESPACE}${typeScriptToXsd(baseType).replace('xsd:', '')}`;
    } else {
      // Assume it's another interface/class
      range = `${this.options.baseUri}${baseType}`;
    }

    return {
      uri: propertyUri,
      label: propAnalysis.name,
      comment: propAnalysis.comment,
      domain: domainUri,
      range,
      required: !propAnalysis.optional,
      multiValued: propAnalysis.type.endsWith('[]')
    };
  }

  /**
   * Generate Turtle/TTL format ontology
   */
  private generateTurtleOntology(): string {
    const lines: string[] = [];

    // Prefixes
    lines.push(`@prefix ${this.options.namespacePrefix}: <${this.options.baseUri}> .`);
    lines.push('@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .');
    lines.push('@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .');
    lines.push('@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .');
    
    if (this.options.useOWL) {
      lines.push('@prefix owl: <http://www.w3.org/2002/07/owl#> .');
    }
    
    if (this.options.generateShapes) {
      lines.push('@prefix sh: <http://www.w3.org/ns/shacl#> .');
    }
    
    lines.push('');

    // Ontology declaration
    const ontologyUri = `${this.options.baseUri}ontology`;
    lines.push(`<${ontologyUri}> a ${this.options.useOWL ? 'owl:Ontology' : 'rdfs:Resource'} ;`);
    lines.push('  rdfs:label "Generated Ontology from TypeScript Interfaces" ;');
    lines.push('  rdfs:comment "Auto-generated by Unjucks TypeScript-to-Ontology converter" .');
    lines.push('');

    // Generate classes
    for (const [classUri, rdfClass] of this.classes) {
      lines.push(`<${classUri}> a rdfs:Class ;`);
      
      if (rdfClass.label) {
        lines.push(`  rdfs:label "${this.escapeString(rdfClass.label)}" ;`);
      }
      
      if (rdfClass.comment) {
        lines.push(`  rdfs:comment "${this.escapeString(rdfClass.comment)}" ;`);
      }

      // Super classes
      for (const superClass of rdfClass.superClasses) {
        lines.push(`  rdfs:subClassOf <${superClass}> ;`);
      }
      
      lines[lines.length - 1] = lines[lines.length - 1].replace(/;$/, '.'); // Replace last ; with .
      lines.push('');
    }

    // Generate properties
    const allProperties = new Map<string, RDFProperty>();
    for (const rdfClass of this.classes.values()) {
      for (const prop of rdfClass.properties) {
        allProperties.set(prop.uri, prop);
      }
    }

    for (const [propUri, property] of allProperties) {
      const propType = this.options.useOWL && property.range.includes(this.options.baseUri) 
        ? 'owl:ObjectProperty' 
        : 'rdf:Property';
      
      lines.push(`<${propUri}> a ${propType} ;`);
      
      if (property.label) {
        lines.push(`  rdfs:label "${this.escapeString(property.label)}" ;`);
      }
      
      if (property.comment) {
        lines.push(`  rdfs:comment "${this.escapeString(property.comment)}" ;`);
      }
      
      lines.push(`  rdfs:domain <${property.domain}> ;`);
      lines.push(`  rdfs:range <${property.range}> ;`);
      
      lines[lines.length - 1] = lines[lines.length - 1].replace(/;$/, '.'); // Replace last ; with .
      lines.push('');
    }

    // Generate SHACL shapes if requested
    if (this.options.generateShapes) {
      lines.push('# SHACL Validation Shapes');
      lines.push('');
      
      for (const [classUri, rdfClass] of this.classes) {
        const shapeUri = `${classUri}Shape`;
        lines.push(`<${shapeUri}> a sh:NodeShape ;`);
        lines.push(`  sh:targetClass <${classUri}> ;`);
        
        for (const prop of rdfClass.properties) {
          lines.push('  sh:property [');
          lines.push(`    sh:path <${prop.uri}> ;`);
          
          if (prop.required) {
            lines.push('    sh:minCount 1 ;');
          }
          
          if (!prop.multiValued) {
            lines.push('    sh:maxCount 1 ;');
          }
          
          if (prop.range.includes('XMLSchema#')) {
            const xsdType = prop.range.split('#')[1];
            lines.push(`    sh:datatype xsd:${xsdType} ;`);
          } else if (prop.range.includes(this.options.baseUri)) {
            lines.push(`    sh:class <${prop.range}> ;`);
          }
          
          lines.push('  ] ;');
        }
        
        lines[lines.length - 1] = lines[lines.length - 1].replace(/;$/, '.'); // Replace last ; with .
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Escape strings for Turtle format
   */
  private escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }
}

/**
 * Convenience function to generate ontology from TypeScript
 */
export async function generateOntologyFromTypeScript(
  sourceCode: string,
  options?: OntologyGenerationOptions
): Promise<string> {
  const generator = new TypeScriptToOntologyGenerator(options);
  return generator.generateOntology(sourceCode);
}