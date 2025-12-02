/**
 * Execute View Command
 * 
 * Executes a specific persona view with optional caching and output formatting.
 */

import { defineCommand } from 'citty';

export default defineCommand({
  meta: {
    name: 'execute-view',
    description: 'Execute a specific persona view'
  },
  args: {
    persona: {
      type: 'string',
      description: 'Target persona view',
      required: true,
      valueHint: 'executive|architect|developer'
    },
    format: {
      type: 'string', 
      description: 'Output format',
      default: 'json',
      valueHint: 'json|yaml|table'
    },
    depth: {
      type: 'string',
      description: 'Analysis depth',
      default: 'summary', 
      valueHint: 'summary|detailed|comprehensive'
    },
    filter: {
      type: 'string',
      description: 'Filter by category, tag, or pattern'
    },
    cache: {
      type: 'boolean',
      description: 'Use cached results if available',
      default: true
    },
    output: {
      type: 'string',
      description: 'Output file path'
    }
  },
  async run({ args }) {
    const { persona, format, depth, filter, cache, output } = args;
    
    try {
      // Import the specific view generator
      const viewModule = await import(`./views/${persona}.js`);
      const viewGenerator = viewModule.default;
      
      console.log(`Executing ${persona} view with ${depth} depth...`);
      
      const result = await viewGenerator.generate({
        depth,
        filter,
        format,
        useCache: cache
      });

      if (output) {
        const fs = await import('fs/promises');
        const outputContent = format === 'json' 
          ? JSON.stringify(result, null, 2)
          : result;
        
        await fs.writeFile(output, outputContent);
        console.log(`View results written to ${output}`);
      } else {
        if (format === 'json') {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(result);
        }
      }

      process.exit(result.success ? 0 : 1);
      
    } catch (error) {
      console.error(`Failed to execute ${persona} view:`, error.message);
      process.exit(1);
    }
  }
});