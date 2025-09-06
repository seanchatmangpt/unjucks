/**
 * XSD to TypeScript Datatype Mappings
 * Maps XML Schema Datatypes to TypeScript types bidirectionally
 */

export const XSD_NAMESPACE = 'http://www.w3.org/2001/XMLSchema#';
export const RDF_NAMESPACE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
export const RDFS_NAMESPACE = 'http://www.w3.org/2000/01/rdf-schema#';

/**
 * XSD to TypeScript type mappings (TTL → TS)
 */
export const XSD_TO_TYPESCRIPT: Record<string, string> = {
  // String types
  'xsd:string': 'string',
  'xsd:normalizedString': 'string',
  'xsd:token': 'string',
  'xsd:language': 'string',
  'xsd:Name': 'string',
  'xsd:NCName': 'string',
  'xsd:ENTITY': 'string',
  'xsd:ID': 'string',
  'xsd:IDREF': 'string',
  'xsd:anyURI': 'string',
  
  // Numeric types
  'xsd:decimal': 'number',
  'xsd:integer': 'number',
  'xsd:nonPositiveInteger': 'number',
  'xsd:negativeInteger': 'number',
  'xsd:long': 'number',
  'xsd:int': 'number',
  'xsd:short': 'number',
  'xsd:byte': 'number',
  'xsd:nonNegativeInteger': 'number',
  'xsd:unsignedLong': 'number',
  'xsd:unsignedInt': 'number',
  'xsd:unsignedShort': 'number',
  'xsd:unsignedByte': 'number',
  'xsd:positiveInteger': 'number',
  'xsd:float': 'number',
  'xsd:double': 'number',
  
  // Boolean type
  'xsd:boolean': 'boolean',
  
  // Date/Time types
  'xsd:date': 'Date',
  'xsd:dateTime': 'Date',
  'xsd:time': 'Date',
  'xsd:duration': 'string', // ISO 8601 duration string
  'xsd:gYear': 'number',
  'xsd:gYearMonth': 'string',
  'xsd:gMonth': 'string',
  'xsd:gMonthDay': 'string',
  'xsd:gDay': 'string',
  
  // Binary types
  'xsd:hexBinary': 'string',
  'xsd:base64Binary': 'string',
  
  // Special types
  'xsd:QName': 'string',
  'xsd:NOTATION': 'string'
};

/**
 * TypeScript to XSD type mappings (TS → TTL)
 */
export const TYPESCRIPT_TO_XSD: Record<string, string> = {
  'string': 'xsd:string',
  'number': 'xsd:decimal', // Use decimal as the most general numeric type
  'boolean': 'xsd:boolean',
  'Date': 'xsd:dateTime',
  
  // More specific mappings for common patterns
  'integer': 'xsd:integer',
  'float': 'xsd:float',
  'double': 'xsd:double',
  'uri': 'xsd:anyURI',
  'url': 'xsd:anyURI'
};

/**
 * Convert XSD datatype to TypeScript type
 */
export function xsdToTypeScript(xsdType: string): string {
  // Remove namespace prefix if present
  const normalizedType = xsdType.includes(':') ? xsdType : `xsd:${xsdType}`;
  const fullUri = xsdType.startsWith('http') ? xsdType : `${XSD_NAMESPACE}${xsdType.replace('xsd:', '')}`;
  
  return XSD_TO_TYPESCRIPT[normalizedType] || 
         XSD_TO_TYPESCRIPT[fullUri] || 
         'any'; // Fallback for unknown types
}

/**
 * Convert TypeScript type to XSD datatype
 */
export function typeScriptToXsd(tsType: string): string {
  // Handle generic types
  const baseType = tsType.replace(/\[\]$/, '').replace(/\?$/, '');
  
  return TYPESCRIPT_TO_XSD[baseType] || 'xsd:string'; // Fallback to string
}

/**
 * Check if a type is nullable/optional
 */
export function isOptionalType(tsType: string): boolean {
  return tsType.endsWith('?') || tsType.includes('| null') || tsType.includes('| undefined');
}

/**
 * Check if a type is an array
 */
export function isArrayType(tsType: string): boolean {
  return tsType.endsWith('[]') || tsType.startsWith('Array<');
}

/**
 * Get the base type from a complex type
 */
export function getBaseType(tsType: string): string {
  return tsType
    .replace(/\[\]$/, '')      // Remove array brackets
    .replace(/\?$/, '')        // Remove optional marker
    .replace(/\s*\|\s*(null|undefined)/g, '') // Remove null/undefined unions
    .replace(/Array<(.+)>/, '$1') // Extract from Array<T>
    .trim();
}

/**
 * Enterprise-specific type mappings for Fortune 5 compliance
 */
export const ENTERPRISE_TYPE_MAPPINGS = {
  // Financial types (FIBO)
  'MonetaryAmount': 'number',
  'CurrencyCode': 'string',
  'ISIN': 'string',
  'LEI': 'string', // Legal Entity Identifier
  
  // Healthcare types (FHIR)
  'PatientId': 'string',
  'NPI': 'string', // National Provider Identifier
  'ICD10': 'string',
  'CPTCode': 'string',
  
  // Supply Chain types (GS1)
  'GTIN': 'string', // Global Trade Item Number
  'GLN': 'string',  // Global Location Number
  'SSCC': 'string', // Serial Shipping Container Code
  
  // Compliance types
  'PersonalData': 'string', // GDPR
  'PHI': 'string',         // HIPAA Protected Health Information
  'PCI': 'string',         // Payment Card Industry data
  'SOXControlId': 'string' // Sarbanes-Oxley control identifier
};

/**
 * Get TypeScript type with enterprise validation
 */
export function getEnterpriseType(propertyUri: string, xsdType?: string): string {
  // Check if this is a known enterprise property
  const propertyName = propertyUri.split(/[#/]/).pop() || '';
  
  if (ENTERPRISE_TYPE_MAPPINGS[propertyName]) {
    return ENTERPRISE_TYPE_MAPPINGS[propertyName];
  }
  
  // Fallback to standard XSD mapping
  return xsdType ? xsdToTypeScript(xsdType) : 'string';
}

/**
 * Generate JSDoc comment from RDF metadata
 */
export function generateJSDoc(label?: string, comment?: string, seeAlso?: string[]): string {
  const lines: string[] = ['/**'];
  
  if (label) {
    lines.push(` * ${label}`);
  }
  
  if (comment && comment !== label) {
    lines.push(' *');
    // Wrap long comments
    const words = comment.split(' ');
    let currentLine = ' * ';
    
    for (const word of words) {
      if (currentLine.length + word.length > 80) {
        lines.push(currentLine.trimEnd());
        currentLine = ` * ${word}`;
      } else {
        currentLine += `${word} `;
      }
    }
    
    if (currentLine.length > 3) {
      lines.push(currentLine.trimEnd());
    }
  }
  
  if (seeAlso && seeAlso.length > 0) {
    lines.push(' *');
    seeAlso.forEach(uri => {
      lines.push(` * @see ${uri}`);
    });
  }
  
  lines.push(' */');
  return lines.join('\n');
}

/**
 * Validation patterns for enterprise data types
 */
export const VALIDATION_PATTERNS = {
  'email': /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  'uri': /^https?:\/\/.+/,
  'uuid': /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'isin': /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/, // International Securities Identification Number
  'lei': /^[A-Z0-9]{20}$/, // Legal Entity Identifier
  'gtin': /^[0-9]{8}([0-9]{4,6})?$/, // Global Trade Item Number
  'npi': /^[0-9]{10}$/, // National Provider Identifier
  'icd10': /^[A-Z][0-9]{2}(\.[0-9X]{1,4})?$/ // ICD-10 diagnosis code
};