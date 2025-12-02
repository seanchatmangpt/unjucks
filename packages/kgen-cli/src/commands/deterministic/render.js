/**
 * Deterministic Render Command
 * 
 * Renders templates with deterministic output ensuring byte-for-byte reproducibility.
 * Uses ONLY the single DeterministicRenderer from kgen-templates package.
 */

import { defineCommand } from 'citty';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { DeterministicRenderer } from '../../../kgen/packages/kgen-templates/src/renderer/deterministic.js';

export default defineCommand({
  meta: {
    name: 'render',
    description: 'Render templates with deterministic output'
  },
  args: {
    template: {
      type: 'string',
      description: 'Template name or path to render',
      required: true
    },
    data: {
      type: 'string',
      description: 'Path to JSON data file for template variables',
      required: false
    },
    output: {
      type: 'string',
      description: 'Output file path (default: stdout)',
      required: false
    },
    seed: {
      type: 'string',
      description: 'Deterministic seed for reproducible output',
      default: '0'
    },
    format: {
      type: 'string',
      description: 'Output format (text|json)',
      default: 'text'
    },
    'verify-deterministic': {
      type: 'boolean',
      description: 'Verify output is deterministic by rendering twice',
      default: false
    },
    'hash-output': {
      type: 'boolean',
      description: 'Include content hash in output',
      default: false
    }
  },
  async run({ args }) {
    try {
      const startTime = this.getDeterministicTimestamp();
      
      // Load template data if provided
      let templateData = {};
      if (args.data) {
        const dataPath = resolve(args.data);
        const dataContent = readFileSync(dataPath, 'utf8');
        templateData = JSON.parse(dataContent);
      }

      // Set deterministic seed
      const seed = args.seed;
      
      // Create deterministic context
      const context = {
        ...templateData,
        __deterministic: {
          seed,
          timestamp: '2024-01-01T00:00:00.000Z', // Fixed timestamp
          version: '1.0.0',
          node: process.version
        }
      };

      // Use the SINGLE deterministic renderer from templates package
      const renderer = new DeterministicRenderer({
        staticBuildTime: '2024-01-01T00:00:00.000Z',
        enableCaching: false,
        strictMode: true
      });
      
      const renderResult = await renderer.render(args.template, context, { seed });
      
      if (!renderResult.success) {
        throw new Error(renderResult.error);
      }
      
      const rendered = renderResult.content;
      
      // Calculate content hash
      const contentHash = createHash('sha256').update(rendered).digest('hex');
      
      // Verify deterministic property if requested
      if (args['verify-deterministic']) {
        const secondRenderResult = await renderer.render(args.template, context, { seed });
        if (!secondRenderResult.success) {
          throw new Error(secondRenderResult.error);
        }
        const secondHash = createHash('sha256').update(secondRenderResult.content).digest('hex');
        
        if (contentHash !== secondHash) {
          throw new Error('Template rendering is not deterministic - outputs differ between runs');
        }
      }

      // Prepare result
      const result = {
        success: true,
        data: {
          template: args.template,
          seed,
          contentHash,
          size: rendered.length,
          deterministic: true,
          renderTime: this.getDeterministicTimestamp() - startTime
        }
      };

      if (args.format === 'json') {
        result.data.content = rendered;
      }

      // Output handling
      if (args.output) {
        if (args.format === 'json') {
          writeFileSync(args.output, JSON.stringify(result, null, 2));
        } else {
          writeFileSync(args.output, rendered);
        }
        
        if (args['hash-output']) {
          writeFileSync(`${args.output}.sha256`, contentHash);
        }
        
        console.log(`Rendered template to: ${args.output}`);
        console.log(`Content hash: ${contentHash}`);
      } else {
        if (args.format === 'json') {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(rendered);
          if (args['hash-output']) {
            console.log(`\n# SHA256: ${contentHash}`);
          }
        }
      }

      return result;
      
    } catch (error) {
      const result = {
        success: false,
        error: {
          message: error.message,
          code: 'RENDER_ERROR',
          template: args.template,
          timestamp: this.getDeterministicDate().toISOString()
        }
      };
      
      console.error(JSON.stringify(result, null, 2));
      process.exit(1);
    }
  }
});

