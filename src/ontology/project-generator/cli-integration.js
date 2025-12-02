/**
 * @fileoverview CLI Integration for Project Scaffolder
 * Provides command-line interface for generating projects
 */

import { ProjectScaffolder } from './project-scaffolder.js';
import yaml from 'yaml';
import fs from 'fs-extra';
import path from 'node:path';
import { consola } from 'consola';

/**
 * Generate project from YAML schema file
 * @param {string} schemaPath - Path to schema YAML file
 * @param {string} outputDir - Output directory
 * @param {Object} options - Generation options
 */
export async function generateFromSchema(schemaPath, outputDir, options = {}) {
  try {
    consola.start(`Loading schema: ${schemaPath}`);

    // Read and parse schema
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');
    const schema = yaml.parse(schemaContent);

    consola.info(`Schema loaded: ${schema.name}`);
    consola.info(`Classes: ${schema.classes.length}`);
    consola.info(`Relationships: ${schema.relationships.length}`);

    // Create scaffolder
    const scaffolder = new ProjectScaffolder(schema, options);

    // Generate project
    const result = await scaffolder.generateProject(outputDir);

    // Display results
    consola.success('Project generated successfully!');
    consola.box({
      title: 'Generation Summary',
      message: [
        `Project: ${result.projectPath}`,
        `Classes: ${result.summary.classes}`,
        `Files: ${result.summary.files.total}`,
        `Size: ${result.summary.size.formatted}`,
        '',
        'Files by type:',
        ...Object.entries(result.summary.files.byType).map(
          ([type, count]) => `  ${type}: ${count}`
        )
      ].join('\n')
    });

    if (result.validation.warnings.length > 0) {
      consola.warn(`Warnings: ${result.validation.warnings.length}`);
      result.validation.warnings.forEach(w => consola.warn(`  - ${w}`));
    }

    if (result.validation.errors.length > 0) {
      consola.error(`Errors: ${result.validation.errors.length}`);
      result.validation.errors.forEach(e => consola.error(`  - ${e}`));
    }

    return result;

  } catch (error) {
    consola.error('Failed to generate project:', error);
    throw error;
  }
}

/**
 * Generate project from ontology RDF file
 * @param {string} ontologyPath - Path to ontology file (.ttl, .rdf, etc.)
 * @param {string} outputDir - Output directory
 * @param {Object} options - Generation options
 */
export async function generateFromOntology(ontologyPath, outputDir, options = {}) {
  try {
    consola.start(`Parsing ontology: ${ontologyPath}`);

    // This would integrate with the ontology parser
    // For now, we'll throw a helpful error
    throw new Error(
      'Ontology parsing not yet implemented. Please use generateFromSchema with a YAML schema file.'
    );

  } catch (error) {
    consola.error('Failed to parse ontology:', error);
    throw error;
  }
}

/**
 * List files that would be generated (dry run)
 * @param {string} schemaPath - Path to schema file
 * @param {Object} options - Generation options
 */
export async function listFiles(schemaPath, options = {}) {
  try {
    // Read schema
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');
    const schema = yaml.parse(schemaContent);

    // Run in dry-run mode
    const scaffolder = new ProjectScaffolder(schema, {
      ...options,
      dryRun: true
    });

    const result = await scaffolder.generateProject('/tmp');

    // Display file list
    consola.box({
      title: `Files to be generated (${result.filesCreated.length})`,
      message: result.filesCreated
        .map(f => `[${f.type.padEnd(12)}] ${f.path}`)
        .join('\n')
    });

    return result;

  } catch (error) {
    consola.error('Failed to list files:', error);
    throw error;
  }
}

/**
 * Validate schema file
 * @param {string} schemaPath - Path to schema file
 */
export async function validateSchema(schemaPath) {
  try {
    consola.start(`Validating schema: ${schemaPath}`);

    const schemaContent = await fs.readFile(schemaPath, 'utf-8');
    const schema = yaml.parse(schemaContent);

    const errors = [];
    const warnings = [];

    // Required fields
    if (!schema.name) errors.push('Missing required field: name');
    if (!schema.classes || schema.classes.length === 0) {
      errors.push('No classes defined');
    }

    // Validate classes
    if (schema.classes) {
      for (const cls of schema.classes) {
        if (!cls.name) errors.push('Class missing name field');
        if (!cls.properties || cls.properties.length === 0) {
          warnings.push(`Class ${cls.name} has no properties`);
        }

        // Validate properties
        if (cls.properties) {
          for (const prop of cls.properties) {
            if (!prop.name) errors.push(`Property in ${cls.name} missing name`);
            if (!prop.type) errors.push(`Property ${prop.name} missing type`);
          }
        }
      }
    }

    // Validate relationships
    if (schema.relationships) {
      const classNames = schema.classes.map(c => c.name);
      for (const rel of schema.relationships) {
        if (!classNames.includes(rel.source)) {
          errors.push(`Unknown relationship source: ${rel.source}`);
        }
        if (!classNames.includes(rel.target)) {
          errors.push(`Unknown relationship target: ${rel.target}`);
        }
      }
    }

    // Display results
    if (errors.length === 0 && warnings.length === 0) {
      consola.success('Schema is valid!');
    } else {
      if (errors.length > 0) {
        consola.error(`Validation errors: ${errors.length}`);
        errors.forEach(e => consola.error(`  - ${e}`));
      }
      if (warnings.length > 0) {
        consola.warn(`Warnings: ${warnings.length}`);
        warnings.forEach(w => consola.warn(`  - ${w}`));
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };

  } catch (error) {
    consola.error('Failed to validate schema:', error);
    throw error;
  }
}

/**
 * Example usage and CLI entry point
 */
export async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    consola.info('Usage:');
    consola.info('  generate <schema.yaml> <output-dir> [options]');
    consola.info('  list <schema.yaml>');
    consola.info('  validate <schema.yaml>');
    consola.info('');
    consola.info('Options:');
    consola.info('  --dry-run          Preview without creating files');
    consola.info('  --overwrite        Overwrite existing files');
    consola.info('  --no-tests         Skip test generation');
    consola.info('  --framework <name> Framework (express, fastify, koa)');
    consola.info('  --database <name>  Database (postgres, mysql, sqlite)');
    consola.info('  --orm <name>       ORM (prisma, typeorm, sequelize)');
    return;
  }

  const command = args[0];
  const schemaPath = args[1];

  if (!schemaPath) {
    consola.error('Schema file path required');
    process.exit(1);
  }

  // Parse options
  const options = {
    dryRun: args.includes('--dry-run'),
    overwrite: args.includes('--overwrite'),
    generateTests: !args.includes('--no-tests'),
    framework: args[args.indexOf('--framework') + 1] || 'express',
    database: args[args.indexOf('--database') + 1] || 'postgres',
    orm: args[args.indexOf('--orm') + 1] || 'prisma'
  };

  try {
    switch (command) {
      case 'generate':
      case 'gen':
        const outputDir = args[2] || process.cwd();
        await generateFromSchema(schemaPath, outputDir, options);
        break;

      case 'list':
      case 'ls':
        await listFiles(schemaPath, options);
        break;

      case 'validate':
      case 'val':
        await validateSchema(schemaPath);
        break;

      default:
        consola.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    consola.error('Command failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
