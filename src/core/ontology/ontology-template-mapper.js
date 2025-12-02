/**
 * Ontology Template Mapper
 * Maps ontology classes to appropriate templates
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

export class OntologyTemplateMapper {
  constructor(options = {}) {
    this.templatesDir = options.templatesDir || join(process.cwd(), 'templates');
    this.templateCache = new Map();
  }

  /**
   * Map ontology structure to templates
   */
  async mapToTemplates(projectStructure, options = {}) {
    const {
      framework = 'express',
      database = 'postgresql',
      projectName = 'ontology-project'
    } = options;

    const templateMap = {
      project: {
        packageJson: await this.getTemplate('microservice/node/package.json.njk'),
        server: await this.getTemplate(`api/${framework}/server.js.njk`) ||
                await this.getTemplate('microservice/node/server.js.njk'),
        config: await this.getTemplate('microservice/node/config.js.njk')
      },
      models: [],
      controllers: [],
      routes: [],
      migrations: []
    };

    // Map each class to model template
    for (const classData of projectStructure.classes) {
      const modelTemplate = await this.getTemplate('database/schema/model.js.njk');
      if (modelTemplate) {
        templateMap.models.push({
          name: classData.name,
          template: modelTemplate,
          data: this.prepareModelData(classData, projectStructure, database)
        });
      }

      // Map to controller template
      const controllerTemplate = await this.getTemplate('api/endpoint/controller.js.njk');
      if (controllerTemplate) {
        templateMap.controllers.push({
          name: classData.name,
          template: controllerTemplate,
          data: this.prepareControllerData(classData)
        });
      }

      // Map to routes template
      const routesTemplate = await this.getTemplate('api/endpoint/routes.js.njk');
      if (routesTemplate) {
        templateMap.routes.push({
          name: classData.name,
          template: routesTemplate,
          data: this.prepareRoutesData(classData)
        });
      }

      // Map to migration template
      const migrationTemplate = await this.getTemplate('database/schema/migration.sql.njk');
      if (migrationTemplate) {
        templateMap.migrations.push({
          name: classData.name,
          template: migrationTemplate,
          data: this.prepareMigrationData(classData, projectStructure, database)
        });
      }
    }

    // Add project-level data
    templateMap.project.data = {
      projectName,
      framework,
      database,
      classes: projectStructure.classes,
      metadata: projectStructure.metadata
    };

    return templateMap;
  }

  /**
   * Get template content
   */
  async getTemplate(relativePath) {
    if (this.templateCache.has(relativePath)) {
      return this.templateCache.get(relativePath);
    }

    const templatePath = join(this.templatesDir, relativePath);
    try {
      const content = await fs.readFile(templatePath, 'utf8');
      this.templateCache.set(relativePath, content);
      return content;
    } catch (error) {
      // Template doesn't exist, return null
      return null;
    }
  }

  /**
   * Prepare model data for template
   */
  prepareModelData(classData, projectStructure, database) {
    // Find properties for this class
    const properties = projectStructure.properties.filter(
      prop => prop.domain === classData.name
    );

    // Find relationships for this class
    const relationships = projectStructure.relationships.filter(
      rel => rel.domain === classData.name
    );

    return {
      className: this.capitalize(classData.name),
      tableName: this.toSnakeCase(classData.name),
      properties: properties.map(prop => ({
        name: prop.name,
        type: prop.datatype,
        dbType: this.mapToDBType(prop.datatype, database),
        label: prop.label || prop.name,
        comment: prop.comment
      })),
      relationships: relationships.map(rel => ({
        name: rel.name,
        type: rel.type,
        targetClass: this.capitalize(rel.range),
        targetTable: this.toSnakeCase(rel.range)
      })),
      timestamps: true,
      softDelete: false
    };
  }

  /**
   * Prepare controller data for template
   */
  prepareControllerData(classData) {
    return {
      className: this.capitalize(classData.name),
      resourceName: classData.name,
      modelName: this.capitalize(classData.name),
      description: classData.comment || `Controller for ${classData.name}`,
      methods: [
        { name: 'getAll', verb: 'GET', path: `/${classData.name}s` },
        { name: 'getById', verb: 'GET', path: `/${classData.name}s/:id` },
        { name: 'create', verb: 'POST', path: `/${classData.name}s` },
        { name: 'update', verb: 'PUT', path: `/${classData.name}s/:id` },
        { name: 'delete', verb: 'DELETE', path: `/${classData.name}s/:id` }
      ]
    };
  }

  /**
   * Prepare routes data for template
   */
  prepareRoutesData(classData) {
    return {
      resourceName: classData.name,
      controllerName: this.capitalize(classData.name) + 'Controller',
      basePath: `/${classData.name}s`,
      routes: [
        { method: 'get', path: '/', handler: 'getAll' },
        { method: 'get', path: '/:id', handler: 'getById' },
        { method: 'post', path: '/', handler: 'create' },
        { method: 'put', path: '/:id', handler: 'update' },
        { method: 'delete', path: '/:id', handler: 'delete' }
      ]
    };
  }

  /**
   * Prepare migration data for template
   */
  prepareMigrationData(classData, projectStructure, database) {
    const properties = projectStructure.properties.filter(
      prop => prop.domain === classData.name
    );

    const relationships = projectStructure.relationships.filter(
      rel => rel.domain === classData.name
    );

    return {
      tableName: this.toSnakeCase(classData.name),
      columns: properties.map(prop => ({
        name: this.toSnakeCase(prop.name),
        type: this.mapToDBType(prop.datatype, database),
        nullable: true,
        unique: false
      })),
      foreignKeys: relationships.map(rel => ({
        column: this.toSnakeCase(rel.name) + '_id',
        references: this.toSnakeCase(rel.range),
        onDelete: 'CASCADE'
      })),
      indexes: [],
      timestamps: true
    };
  }

  /**
   * Map to database column type
   */
  mapToDBType(jsType, database = 'postgresql') {
    const typeMap = {
      postgresql: {
        string: 'VARCHAR(255)',
        number: 'INTEGER',
        boolean: 'BOOLEAN',
        Date: 'TIMESTAMP'
      },
      mysql: {
        string: 'VARCHAR(255)',
        number: 'INT',
        boolean: 'TINYINT(1)',
        Date: 'DATETIME'
      },
      sqlite: {
        string: 'TEXT',
        number: 'INTEGER',
        boolean: 'INTEGER',
        Date: 'TEXT'
      }
    };

    return typeMap[database]?.[jsType] || 'TEXT';
  }

  /**
   * Convert to snake_case
   */
  toSnakeCase(str) {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }

  /**
   * Capitalize first letter
   */
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

export default OntologyTemplateMapper;
