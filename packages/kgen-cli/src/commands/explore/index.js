/**
 * Explore Command Group
 * 
 * Persona-driven marketplace exploration with tailored insights.
 */

import { defineCommand } from 'citty';
import executeView from './execute-view.js';
import listViews from './list-views.js';
import metricsCommand from './metrics.js';

export default defineCommand({
  meta: {
    name: 'explore',
    description: 'Explore marketplace with persona-driven views'
  },
  subCommands: {
    'execute-view': executeView,
    'list-views': listViews,
    metrics: metricsCommand
  },
  args: {
    persona: {
      type: 'string',
      description: 'Target persona: executive, architect, developer',
      default: 'developer',
      valueHint: 'executive|architect|developer'
    },
    format: {
      type: 'string',
      description: 'Output format: json, yaml, table',
      default: 'json',
      valueHint: 'json|yaml|table'
    },
    depth: {
      type: 'string',
      description: 'Analysis depth: summary, detailed, comprehensive',
      default: 'summary',
      valueHint: 'summary|detailed|comprehensive'
    },
    filter: {
      type: 'string',
      description: 'Filter results by category, tag, or pattern'
    },
    output: {
      type: 'string',
      description: 'Output file path'
    }
  },
  async run({ args }) {
    const { persona, format, depth, filter, output } = args;
    
    // Import persona-specific view generator
    let viewGenerator;
    try {
      switch (persona) {
        case 'executive':
          viewGenerator = await import('./views/executive.js');
          break;
        case 'architect':
          viewGenerator = await import('./views/architect.js');
          break;
        case 'developer':
          viewGenerator = await import('./views/developer.js');
          break;
        default:
          throw new Error(`Unknown persona: ${persona}`);
      }
    } catch (error) {
      console.error(`Failed to load ${persona} view generator:`, error.message);
      process.exit(1);
    }

    try {
      const result = await viewGenerator.default.generate({
        depth,
        filter,
        format
      });

      if (output) {
        await import('fs/promises').then(fs => 
          fs.writeFile(output, JSON.stringify(result, null, 2))
        );
        console.log(`Results written to ${output}`);
      } else {
        if (format === 'json') {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(result);
        }
      }

      process.exit(result.success ? 0 : 1);
    } catch (error) {
      console.error('Exploration failed:', error.message);
      process.exit(1);
    }
  }
});