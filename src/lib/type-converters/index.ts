/**
 * Unjucks Type Conversion System
 * Bidirectional conversion between RDF/Turtle ontologies and TypeScript types
 */

// Core converters
export { 
  OntologyToTypeScriptGenerator, 
  generateTypeScriptFromOntology,
  type TypeScriptGenerationOptions,
  type TypeScriptInterface,
  type TypeScriptProperty 
} from './ontology-to-typescript.js';

export { 
  TypeScriptToOntologyGenerator,
  generateOntologyFromTypeScript,
  type OntologyGenerationOptions,
  type RDFClass,
  type RDFProperty,
  TypeScriptAnalyzer 
} from './typescript-to-ontology.js';

// Datatype mappings
export {
  xsdToTypeScript,
  typeScriptToXsd,
  isOptionalType,
  isArrayType,
  getBaseType,
  getEnterpriseType,
  generateJSDoc,
  XSD_TO_TYPESCRIPT,
  TYPESCRIPT_TO_XSD,
  ENTERPRISE_TYPE_MAPPINGS,
  VALIDATION_PATTERNS
} from './datatype-mappings.js';

// Convenience functions
import { TurtleParseResult } from '../turtle-parser.js';
import { generateTypeScriptFromOntology, TypeScriptGenerationOptions } from './ontology-to-typescript.js';
import { generateOntologyFromTypeScript, OntologyGenerationOptions } from './typescript-to-ontology.js';

/**
 * High-level conversion functions for easy integration
 */
export class UnjucksTypeConverter {
  /**
   * Convert TTL file to TypeScript interfaces
   */
  static async ttlToTypeScript(
    ontologyData: TurtleParseResult,
    options?: TypeScriptGenerationOptions
  ): Promise<string> {
    return generateTypeScriptFromOntology(ontologyData, options);
  }

  /**
   * Convert TypeScript interfaces to TTL
   */
  static async typeScriptToTtl(
    sourceCode: string,
    options?: OntologyGenerationOptions
  ): Promise<string> {
    return generateOntologyFromTypeScript(sourceCode, options);
  }

  /**
   * Round-trip conversion test (TTL → TS → TTL)
   */
  static async testRoundTrip(
    originalTtl: TurtleParseResult,
    tsOptions?: TypeScriptGenerationOptions,
    ttlOptions?: OntologyGenerationOptions
  ): Promise<{
    original: TurtleParseResult;
    typescript: string;
    regenerated: string;
    matches: boolean;
  }> {
    const typescript = await this.ttlToTypeScript(originalTtl, tsOptions);
    const regenerated = await this.typeScriptToTtl(typescript, ttlOptions);
    
    return {
      original: originalTtl,
      typescript,
      regenerated,
      matches: false // TODO: Implement semantic comparison
    };
  }
}

/**
 * Template helper functions for Nunjucks integration
 */
export const templateHelpers = {
  /**
   * Generate TypeScript interface from RDF data in templates
   */
  async generateInterface(rdfData: TurtleParseResult, className?: string): Promise<string> {
    return generateTypeScriptFromOntology(rdfData, {
      namespace: className || 'Generated',
      includeDocumentation: true,
      enterpriseTypes: true
    });
  },

  /**
   * Get TypeScript type for an RDF property
   */
  getTypeForProperty(propertyUri: string, range?: string): string {
    if (!range) return 'string';
    
    if (range.includes('XMLSchema#')) {
      const xsdType = range.split('#')[1];
      return xsdToTypeScript(`xsd:${xsdType}`);
    }
    
    return 'string';
  },

  /**
   * Generate property name from URI
   */
  propertyNameFromUri(uri: string): string {
    const localName = uri.split(/[#/]/).pop() || 'unknown';
    return localName.charAt(0).toLowerCase() + localName.slice(1);
  },

  /**
   * Generate class name from URI  
   */
  classNameFromUri(uri: string): string {
    const localName = uri.split(/[#/]/).pop() || 'Unknown';
    return localName.charAt(0).toUpperCase() + localName.slice(1);
  }
};