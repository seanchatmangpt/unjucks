/**
 * Ontology-driven template commands for Unjucks CLI
 */

import { defineCommand } from 'citty';
import { OntologyTemplateEngine } from '../../core/ontology-template-engine.js';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import chalk from 'chalk';
import { glob } from 'glob';

// Main ontology command
export const ontologyCommand = defineCommand({
  meta: {
    name: 'ontology',
    description: 'Work with ontology-driven templates'
  },
  subCommands: {
    generate: defineCommand({
      meta: {
        name: 'generate',
        description: 'Generate from ontology and template'
      },
      args: {
        ontology: {
          type: 'positional',
          description: 'Path to RDF/Turtle ontology file',
          required: true
        },
        template: {
          type: 'string',
          description: 'Template path or name',
          alias: 't',
          required: false
        },
        subject: {
          type: 'string',
          description: 'Subject URI to process',
          alias: 's',
          required: false
        },
        output: {
          type: 'string',
          description: 'Output file path',
          alias: 'o',
          required: false
        },
        batch: {
          type: 'boolean',
          description: 'Process all subjects in ontology',
          alias: 'b',
          default: false
        },
        outputDir: {
          type: 'string',
          description: 'Output directory for batch processing',
          alias: 'd',
          default: './generated'
        }
      },
      async run({ args }) {
        const engine = new OntologyTemplateEngine();
        
        try {
          // Load ontology
          console.log(chalk.blue('📚 Loading ontology:'), args.ontology);
          await engine.loadOntology(args.ontology);
          
          // Determine template path
          let templatePath = args.template;
          if (!templatePath) {
            // Default to person-card template
            templatePath = join(process.cwd(), 'templates/ontology-driven/person-card.njk');
          } else if (!templatePath.includes('/')) {
            // Look for template in templates/ontology-driven/
            templatePath = join(process.cwd(), `templates/ontology-driven/${templatePath}.njk`);
          }
          
          if (args.batch) {
            // Batch processing
            console.log(chalk.blue('🔄 Batch processing all subjects...'));
            const results = await engine.generateBatch({
              ontologyPath: args.ontology,
              templatePath,
              outputDir: args.outputDir,
              subjectPattern: args.subject
            });
            
            console.log(chalk.green(`✅ Generated ${results.length} files:`));
            results.forEach(r => {
              console.log(chalk.gray(`  - ${r.outputPath}`));
            });
          } else {
            // Single subject processing
            if (!args.subject) {
              // Extract first subject from ontology
              const quads = engine.store.getQuads(null, null, null);
              const subjects = new Set();
              for (const quad of quads) {
                subjects.add(quad.subject.value);
              }
              if (subjects.size === 0) {
                throw new Error('No subjects found in ontology');
              }
              args.subject = Array.from(subjects)[0];
              console.log(chalk.yellow('⚠️  No subject specified, using:'), args.subject);
            }
            
            const result = await engine.generate({
              ontologyPath: args.ontology,
              templatePath,
              subjectUri: args.subject,
              outputPath: args.output
            });
            
            if (!args.output) {
              console.log(chalk.green('\n📄 Generated content:'));
              console.log(result);
            }
          }
        } catch (error) {
          console.error(chalk.red('❌ Error:'), error.message);
          process.exit(1);
        }
      }
    }),
    
    list: defineCommand({
      meta: {
        name: 'list',
        description: 'List available ontology templates'
      },
      async run() {
        try {
          const templatesDir = join(process.cwd(), 'templates/ontology-driven');
          const templates = await glob('**/*.njk', { cwd: templatesDir });
          
          if (templates.length === 0) {
            console.log(chalk.yellow('No ontology templates found in templates/ontology-driven/'));
            return;
          }
          
          console.log(chalk.blue('\n📋 Available Ontology Templates:\n'));
          for (const template of templates) {
            const name = template.replace('.njk', '');
            const content = await fs.readFile(join(templatesDir, template), 'utf8');
            
            // Extract description from template comments
            const descMatch = content.match(/<!--\s*description:\s*(.+?)\s*-->/i);
            const description = descMatch ? descMatch[1] : 'No description';
            
            console.log(chalk.green(`  ${name}`));
            console.log(chalk.gray(`    ${description}`));
          }
          console.log();
        } catch (error) {
          console.error(chalk.red('❌ Error listing templates:'), error.message);
        }
      }
    }),
    
    query: defineCommand({
      meta: {
        name: 'query',
        description: 'Query ontology data'
      },
      args: {
        ontology: {
          type: 'positional',
          description: 'Path to RDF/Turtle ontology file',
          required: true
        },
        subject: {
          type: 'string',
          description: 'Subject URI to query',
          alias: 's'
        },
        predicate: {
          type: 'string',
          description: 'Predicate to filter by',
          alias: 'p'
        },
        object: {
          type: 'string',
          description: 'Object to filter by',
          alias: 'o'
        },
        format: {
          type: 'string',
          description: 'Output format (json, table, turtle)',
          alias: 'f',
          default: 'table'
        }
      },
      async run({ args }) {
        const engine = new OntologyTemplateEngine();
        
        try {
          console.log(chalk.blue('📚 Loading ontology:'), args.ontology);
          await engine.loadOntology(args.ontology);
          
          // Get quads matching the pattern
          const quads = engine.store.getQuads(
            args.subject || null,
            args.predicate || null,
            args.object || null
          );
          
          if (quads.length === 0) {
            console.log(chalk.yellow('No matching triples found'));
            return;
          }
          
          console.log(chalk.green(`\n✅ Found ${quads.length} matching triples:\n`));
          
          if (args.format === 'json') {
            const data = quads.map(q => ({
              subject: q.subject.value,
              predicate: q.predicate.value,
              object: q.object.value
            }));
            console.log(JSON.stringify(data, null, 2));
          } else if (args.format === 'turtle') {
            quads.forEach(q => {
              console.log(`<${q.subject.value}> <${q.predicate.value}> "${q.object.value}" .`);
            });
          } else {
            // Table format
            console.log(chalk.gray('Subject | Predicate | Object'));
            console.log(chalk.gray('-'.repeat(80)));
            quads.forEach(q => {
              const subject = q.subject.value.split('/').pop();
              const predicate = q.predicate.value.split(/[#/]/).pop();
              const object = q.object.value.split('/').pop();
              console.log(`${subject} | ${predicate} | ${object}`);
            });
          }
          console.log();
        } catch (error) {
          console.error(chalk.red('❌ Error:'), error.message);
          process.exit(1);
        }
      }
    }),
    
    extract: defineCommand({
      meta: {
        name: 'extract',
        description: 'Extract structured data from ontology'
      },
      args: {
        ontology: {
          type: 'positional',
          description: 'Path to RDF/Turtle ontology file',
          required: true
        },
        subject: {
          type: 'string',
          description: 'Subject URI to extract',
          alias: 's',
          required: true
        },
        output: {
          type: 'string',
          description: 'Output file path (JSON)',
          alias: 'o'
        }
      },
      async run({ args }) {
        const engine = new OntologyTemplateEngine();
        
        try {
          console.log(chalk.blue('📚 Loading ontology:'), args.ontology);
          await engine.loadOntology(args.ontology);
          
          console.log(chalk.blue('🔍 Extracting data for:'), args.subject);
          const data = await engine.extractTemplateData(args.subject);
          
          if (args.output) {
            await fs.writeFile(args.output, JSON.stringify(data, null, 2));
            console.log(chalk.green('✅ Data extracted to:'), args.output);
          } else {
            console.log(chalk.green('\n📊 Extracted Data:\n'));
            console.log(JSON.stringify(data, null, 2));
          }
        } catch (error) {
          console.error(chalk.red('❌ Error:'), error.message);
          process.exit(1);
        }
      }
    })
  },
  async run({ args }) {
    // Show help if no subcommand
    console.log(chalk.blue('\n🦉 Unjucks Ontology Commands\n'));
    console.log('Usage: unjucks ontology <command> [options]\n');
    console.log('Commands:');
    console.log('  generate  - Generate from ontology and template');
    console.log('  list      - List available ontology templates');
    console.log('  query     - Query ontology data');
    console.log('  extract   - Extract structured data from ontology');
    console.log('\nExamples:');
    console.log('  unjucks ontology generate person.ttl --template person-card');
    console.log('  unjucks ontology generate company.ttl --batch --output-dir ./generated');
    console.log('  unjucks ontology query person.ttl --subject http://example.org/person/alex');
    console.log('  unjucks ontology list');
    console.log();
  }
});

export default ontologyCommand;