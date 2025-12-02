/**
 * @file Unjucks V4 CLI Entry Point
 * @module unjucks-v4/cli
 * @description Command-line interface for unjucks v4 template engine
 */

import { createCommand } from 'citty';
import { CoreEngine } from './core/engine.mjs';

/**
 * Main CLI command definition
 */
export const main = createCommand({
  meta: {
    name: 'unjucks',
    version: '4.0.0',
    description: 'Template-driven code generation with frontmatter, Nunjucks, and RDF support'
  },
  args: {
    generator: {
      type: 'positional',
      description: 'Generator name (e.g., component, service)',
      required: true
    },
    action: {
      type: 'positional',
      description: 'Action name (e.g., new, add)',
      required: true
    },
    name: {
      type: 'positional',
      description: 'Entity name',
      required: false
    },
    'dry-run': {
      type: 'boolean',
      description: 'Show what would be generated without writing files',
      default: false
    },
    force: {
      type: 'boolean',
      description: 'Overwrite existing files',
      default: false
    },
    templates: {
      type: 'string',
      description: 'Path to templates directory',
      default: '_templates'
    }
  },
  async run({ args }) {
    const engine = new CoreEngine({
      templatesDir: args.templates,
      dryRun: args['dry-run'],
      force: args.force
    });

    try {
      await engine.initialize();
      const result = await engine.generate(args.generator, args.action, {
        name: args.name,
        ...args
      });

      if (result.success) {
        console.log(`✅ Generated ${result.artifacts.length} file(s)`);
        result.artifacts.forEach(artifact => {
          console.log(`   ${artifact.path}`);
        });
      } else {
        console.error(`❌ Generation failed: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }
});

// Export for programmatic use
export { CoreEngine };


