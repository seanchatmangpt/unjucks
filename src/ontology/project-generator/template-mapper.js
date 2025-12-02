/**
 * Ontology Template Mapper
 *
 * Maps parsed ontology schemas to Nunjucks template generation instructions.
 * Handles class-to-template, property-to-field, relationship-to-endpoint,
 * and constraint-to-validation mappings.
 *
 * @module ontology/project-generator/template-mapper
 */

import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { access, constants } from 'node:fs/promises';
import { pascalCase, camelCase, paramCase, snakeCase } from 'change-case';
import pluralize from 'pluralize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * XSD datatype to TypeScript type mapping
 */
const XSD_TO_TS_TYPE = {
  'xsd:string': 'string',
  'xsd:integer': 'number',
  'xsd:int': 'number',
  'xsd:long': 'number',
  'xsd:decimal': 'number',
  'xsd:double': 'number',
  'xsd:float': 'number',
  'xsd:boolean': 'boolean',
  'xsd:date': 'Date',
  'xsd:dateTime': 'Date',
  'xsd:time': 'Date',
  'xsd:anyURI': 'string', // URL validated
  'xsd:base64Binary': 'string',
  'xsd:hexBinary': 'string',
};

/**
 * XSD datatype to database column type mapping
 */
const XSD_TO_DB_TYPE = {
  'xsd:string': 'VARCHAR(255)',
  'xsd:integer': 'INTEGER',
  'xsd:int': 'INTEGER',
  'xsd:long': 'BIGINT',
  'xsd:decimal': 'DECIMAL(10,2)',
  'xsd:double': 'DOUBLE PRECISION',
  'xsd:float': 'REAL',
  'xsd:boolean': 'BOOLEAN',
  'xsd:date': 'DATE',
  'xsd:dateTime': 'TIMESTAMP',
  'xsd:time': 'TIME',
  'xsd:anyURI': 'VARCHAR(2048)',
  'xsd:base64Binary': 'TEXT',
  'xsd:hexBinary': 'TEXT',
};

/**
 * Cardinality patterns for relationships
 */
const CARDINALITY = {
  ONE_TO_ONE: '1:1',
  ONE_TO_MANY: '1:n',
  MANY_TO_ONE: 'n:1',
  MANY_TO_MANY: 'n:n',
};

/**
 * Template instruction for rendering
 * @typedef {Object} TemplateInstruction
 * @property {string} templatePath - Path to Nunjucks template
 * @property {string} outputPath - Where to write rendered output
 * @property {Object} context - Template variables
 * @property {string[]} dependencies - Required templates/files
 * @property {Function[]} postProcess - Post-render hooks
 */

/**
 * Maps ontology schemas to template generation instructions
 */
export class OntologyTemplateMapper {
  /**
   * @param {Object} projectSchema - Parsed ontology schema
   * @param {string} templateDir - Base directory for templates
   */
  constructor(projectSchema, templateDir = null) {
    this.schema = projectSchema;
    this.templateDir = templateDir || join(__dirname, '../../../_templates/ontology');
    this.customTemplatePaths = [];
    this.templateCache = new Map();
  }

  /**
   * Register custom template search path
   * @param {string} customPath - Additional template directory
   */
  addTemplateSearchPath(customPath) {
    if (!this.customTemplatePaths.includes(customPath)) {
      this.customTemplatePaths.push(customPath);
    }
  }

  /**
   * Resolve template path with fallback search
   * @param {string} templateName - Template filename
   * @returns {Promise<string|null>} - Resolved path or null
   */
  async resolveTemplate(templateName) {
    // Check cache first
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName);
    }

    // Search in custom paths first, then default
    const searchPaths = [
      ...this.customTemplatePaths,
      this.templateDir,
    ];

    for (const basePath of searchPaths) {
      const fullPath = resolve(basePath, templateName);
      try {
        await access(fullPath, constants.R_OK);
        this.templateCache.set(templateName, fullPath);
        return fullPath;
      } catch {
        // Template not found in this path, continue search
      }
    }

    // Template not found in any path
    return null;
  }

  /**
   * Map OWL class to multiple template instructions
   * @param {Object} classSchema - Class definition from ontology
   * @returns {Promise<TemplateInstruction[]>} - Generation instructions
   */
  async mapClassToTemplates(classSchema) {
    const instructions = [];

    // Validate class schema
    if (!classSchema?.id || !classSchema?.label) {
      throw new Error('Invalid class schema: missing id or label');
    }

    // Build base context for all templates
    const baseContext = await this.buildTemplateContext(classSchema);

    // 1. TypeScript interface template
    const interfaceInstruction = await this.mapToInterface(baseContext);
    if (interfaceInstruction) {
      instructions.push(interfaceInstruction);
    }

    // 2. Database table template
    const tableInstruction = await this.mapToTable(baseContext);
    if (tableInstruction) {
      instructions.push(tableInstruction);
    }

    // 3. API resource template
    const apiInstruction = await this.mapToAPIResource(baseContext);
    if (apiInstruction) {
      instructions.push(apiInstruction);
    }

    // 4. Service class template
    const serviceInstruction = await this.mapToService(baseContext);
    if (serviceInstruction) {
      instructions.push(serviceInstruction);
    }

    return instructions;
  }

  /**
   * Build comprehensive template context from class schema
   * @param {Object} classSchema - OWL class definition
   * @returns {Promise<Object>} - Template rendering context
   */
  async buildTemplateContext(classSchema) {
    const className = pascalCase(classSchema.label);
    const classNameLower = camelCase(classSchema.label);
    const classNameKebab = paramCase(classSchema.label);
    const classNameSnake = snakeCase(classSchema.label);
    const classNamePlural = pluralize(className);
    const classNamePluralLower = camelCase(classNamePlural);

    // Map properties
    const properties = await this.mapProperties(classSchema.properties || []);

    // Map relationships
    const relationships = await this.mapRelationships(classSchema.relationships || []);

    // Build imports based on dependencies
    const imports = this.buildImports(properties, relationships);

    // Extract validators from constraints
    const validators = this.buildValidators(properties);

    // Metadata
    const metadata = {
      ontologyId: classSchema.id,
      description: classSchema.description || '',
      version: classSchema.version || '1.0.0',
      namespace: classSchema.namespace || '',
    };

    return {
      className,
      classNameLower,
      classNameKebab,
      classNameSnake,
      classNamePlural,
      classNamePluralLower,
      properties,
      relationships,
      imports,
      validators,
      metadata,
      // Raw schema for advanced templates
      _raw: classSchema,
    };
  }

  /**
   * Map ontology properties to template property definitions
   * @param {Array} schemaProperties - Property definitions
   * @returns {Promise<Array>} - Mapped properties
   */
  async mapProperties(schemaProperties) {
    return schemaProperties.map(prop => {
      const name = camelCase(prop.label || prop.id);
      const type = this.mapDatatype(prop.range || 'xsd:string');
      const dbType = this.mapDatatypeToDb(prop.range || 'xsd:string');
      const required = this.isRequired(prop.constraints || []);
      const validators = this.extractValidators(prop.constraints || []);

      return {
        name,
        nameSnake: snakeCase(name),
        namePascal: pascalCase(name),
        type,
        dbType,
        required,
        validators,
        description: prop.description || '',
        defaultValue: prop.defaultValue || null,
        // Raw property for custom logic
        _raw: prop,
      };
    });
  }

  /**
   * Map OWL object properties to relationship definitions
   * @param {Array} schemaRelationships - Relationship definitions
   * @returns {Promise<Array>} - Mapped relationships
   */
  async mapRelationships(schemaRelationships) {
    return schemaRelationships.map(rel => {
      const name = camelCase(rel.label || rel.id);
      const target = pascalCase(rel.target || 'Unknown');
      const cardinality = this.determineCardinality(rel.constraints || []);
      const endpoints = this.buildRelationshipEndpoints(name, target, cardinality);

      return {
        name,
        nameSnake: snakeCase(name),
        target,
        targetLower: camelCase(target),
        targetPlural: pluralize(target),
        cardinality,
        endpoints,
        inverse: rel.inverse || null,
        description: rel.description || '',
        // Raw relationship for custom logic
        _raw: rel,
      };
    });
  }

  /**
   * Map XSD datatype to TypeScript type
   * @param {string} xsdType - XSD datatype URI
   * @returns {string} - TypeScript type
   */
  mapDatatype(xsdType) {
    return XSD_TO_TS_TYPE[xsdType] || 'unknown';
  }

  /**
   * Map XSD datatype to database column type
   * @param {string} xsdType - XSD datatype URI
   * @returns {string} - Database column type
   */
  mapDatatypeToDb(xsdType) {
    return XSD_TO_DB_TYPE[xsdType] || 'TEXT';
  }

  /**
   * Check if property is required from constraints
   * @param {Array} constraints - Property constraints
   * @returns {boolean} - True if required
   */
  isRequired(constraints) {
    return constraints.some(c =>
      c.type === 'owl:minCardinality' && Number.parseInt(c.value, 10) >= 1
    );
  }

  /**
   * Determine relationship cardinality from constraints
   * @param {Array} constraints - Relationship constraints
   * @returns {string} - Cardinality pattern
   */
  determineCardinality(constraints) {
    const minCard = constraints.find(c => c.type === 'owl:minCardinality');
    const maxCard = constraints.find(c => c.type === 'owl:maxCardinality');

    const min = minCard ? Number.parseInt(minCard.value, 10) : 0;
    const max = maxCard ? Number.parseInt(maxCard.value, 10) : Number.POSITIVE_INFINITY;

    if (max === 1) {
      return min === 1 ? CARDINALITY.ONE_TO_ONE : CARDINALITY.MANY_TO_ONE;
    }
    return min === 1 ? CARDINALITY.ONE_TO_MANY : CARDINALITY.MANY_TO_MANY;
  }

  /**
   * Build API endpoints for relationship
   * @param {string} name - Relationship name
   * @param {string} target - Target class name
   * @param {string} cardinality - Relationship cardinality
   * @returns {Array} - Endpoint definitions
   */
  buildRelationshipEndpoints(name, target, cardinality) {
    const nameLower = camelCase(name);
    const targetLower = camelCase(target);

    const endpoints = [];

    // GET endpoint for relationship
    if (cardinality === CARDINALITY.ONE_TO_ONE || cardinality === CARDINALITY.MANY_TO_ONE) {
      endpoints.push({
        method: 'GET',
        path: `/api/{resource}/{id}/${nameLower}`,
        returns: 'single',
        description: `Get ${name} for resource`,
      });
    } else {
      endpoints.push({
        method: 'GET',
        path: `/api/{resource}/{id}/${nameLower}`,
        returns: 'array',
        description: `Get all ${name} for resource`,
      });
    }

    // POST/PUT/DELETE for managing relationships
    endpoints.push({
      method: 'POST',
      path: `/api/{resource}/{id}/${nameLower}`,
      description: `Add ${name} relationship`,
    });

    endpoints.push({
      method: 'DELETE',
      path: `/api/{resource}/{id}/${nameLower}/{targetId}`,
      description: `Remove ${name} relationship`,
    });

    return endpoints;
  }

  /**
   * Extract validators from property constraints
   * @param {Array} constraints - Property constraints
   * @returns {Array} - Validator definitions
   */
  extractValidators(constraints) {
    const validators = [];

    for (const constraint of constraints) {
      switch (constraint.type) {
        case 'xsd:minInclusive':
          validators.push({
            type: 'min',
            value: constraint.value,
            message: `Must be at least ${constraint.value}`,
          });
          break;

        case 'xsd:maxInclusive':
          validators.push({
            type: 'max',
            value: constraint.value,
            message: `Must be at most ${constraint.value}`,
          });
          break;

        case 'xsd:pattern':
          validators.push({
            type: 'pattern',
            value: constraint.value,
            message: `Must match pattern: ${constraint.value}`,
          });
          break;

        case 'xsd:minLength':
          validators.push({
            type: 'minLength',
            value: constraint.value,
            message: `Minimum length: ${constraint.value}`,
          });
          break;

        case 'xsd:maxLength':
          validators.push({
            type: 'maxLength',
            value: constraint.value,
            message: `Maximum length: ${constraint.value}`,
          });
          break;

        case 'rdfs:range':
          validators.push({
            type: 'type',
            value: this.mapDatatype(constraint.value),
            message: `Must be of type ${this.mapDatatype(constraint.value)}`,
          });
          break;

        case 'owl:maxCardinality':
          validators.push({
            type: 'arrayMaxSize',
            value: constraint.value,
            message: `Array size cannot exceed ${constraint.value}`,
          });
          break;
      }
    }

    return validators;
  }

  /**
   * Build validators array for template context
   * @param {Array} properties - Mapped properties
   * @returns {Array} - All validators
   */
  buildValidators(properties) {
    const allValidators = [];

    for (const prop of properties) {
      if (prop.validators && prop.validators.length > 0) {
        allValidators.push({
          property: prop.name,
          validators: prop.validators,
        });
      }
    }

    return allValidators;
  }

  /**
   * Build imports based on property and relationship types
   * @param {Array} properties - Mapped properties
   * @param {Array} relationships - Mapped relationships
   * @returns {Array} - Import statements
   */
  buildImports(properties, relationships) {
    const imports = [];
    const typeSet = new Set();

    // Check for Date types
    const hasDate = properties.some(p => p.type === 'Date');
    if (hasDate) {
      typeSet.add('Date');
    }

    // Add relationship target imports
    for (const rel of relationships) {
      if (rel.target && rel.target !== 'Unknown') {
        imports.push({
          module: `./${rel.target}`,
          exports: [rel.target],
        });
      }
    }

    // Add validator imports if needed
    const hasValidators = properties.some(p => p.validators.length > 0);
    if (hasValidators) {
      imports.push({
        module: 'class-validator',
        exports: ['IsString', 'IsNumber', 'IsBoolean', 'IsDate', 'Min', 'Max', 'Matches'],
      });
    }

    return imports;
  }

  /**
   * Map to TypeScript interface template
   * @param {Object} context - Template context
   * @returns {Promise<TemplateInstruction|null>} - Instruction or null if template missing
   */
  async mapToInterface(context) {
    const templatePath = await this.resolveTemplate('interface.njk');
    if (!templatePath) {
      console.warn('TypeScript interface template not found, skipping');
      return null;
    }

    return {
      templatePath,
      outputPath: `src/models/${context.className}.ts`,
      context,
      dependencies: [],
      postProcess: [],
    };
  }

  /**
   * Map to database table template
   * @param {Object} context - Template context
   * @returns {Promise<TemplateInstruction|null>} - Instruction or null if template missing
   */
  async mapToTable(context) {
    const templatePath = await this.resolveTemplate('table.sql.njk');
    if (!templatePath) {
      console.warn('Database table template not found, skipping');
      return null;
    }

    return {
      templatePath,
      outputPath: `database/tables/${context.classNameSnake}.sql`,
      context,
      dependencies: [],
      postProcess: [],
    };
  }

  /**
   * Map to API resource template
   * @param {Object} context - Template context
   * @returns {Promise<TemplateInstruction|null>} - Instruction or null if template missing
   */
  async mapToAPIResource(context) {
    const templatePath = await this.resolveTemplate('api-resource.njk');
    if (!templatePath) {
      console.warn('API resource template not found, skipping');
      return null;
    }

    return {
      templatePath,
      outputPath: `src/api/${context.classNameKebab}.ts`,
      context,
      dependencies: [`src/models/${context.className}.ts`],
      postProcess: [],
    };
  }

  /**
   * Map to service class template
   * @param {Object} context - Template context
   * @returns {Promise<TemplateInstruction|null>} - Instruction or null if template missing
   */
  async mapToService(context) {
    const templatePath = await this.resolveTemplate('service.njk');
    if (!templatePath) {
      console.warn('Service class template not found, skipping');
      return null;
    }

    return {
      templatePath,
      outputPath: `src/services/${context.className}Service.ts`,
      context,
      dependencies: [`src/models/${context.className}.ts`],
      postProcess: [],
    };
  }

  /**
   * Validate template context before rendering
   * @param {Object} context - Template context
   * @param {string} templateName - Template being validated for
   * @returns {Object} - Validation result {valid: boolean, errors: []}
   */
  validateContext(context, templateName) {
    const errors = [];

    // Required fields
    if (!context.className) {
      errors.push('Missing required field: className');
    }

    if (!context.classNameLower) {
      errors.push('Missing required field: classNameLower');
    }

    if (!Array.isArray(context.properties)) {
      errors.push('Missing or invalid field: properties (must be array)');
    }

    if (!Array.isArray(context.relationships)) {
      errors.push('Missing or invalid field: relationships (must be array)');
    }

    // Validate properties structure
    if (Array.isArray(context.properties)) {
      for (const [index, prop] of context.properties.entries()) {
        if (!prop.name) {
          errors.push(`Property at index ${index} missing name`);
        }
        if (!prop.type) {
          errors.push(`Property at index ${index} missing type`);
        }
      }
    }

    // Validate relationships structure
    if (Array.isArray(context.relationships)) {
      for (const [index, rel] of context.relationships.entries()) {
        if (!rel.name) {
          errors.push(`Relationship at index ${index} missing name`);
        }
        if (!rel.target) {
          errors.push(`Relationship at index ${index} missing target`);
        }
        if (!rel.cardinality) {
          errors.push(`Relationship at index ${index} missing cardinality`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default OntologyTemplateMapper;
