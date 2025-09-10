#!/usr/bin/env node

/**
 * CLI Framework Demo
 * 
 * Demonstrates the capabilities of our Citty-based CLI framework with Hygen-style parsing
 */

import chalk from 'chalk';
import { HygenArgumentParser } from './parser.js';
import { CommandRouter } from './router.js';
import { HelpSystem } from './help-system.js';

console.log(chalk.blue.bold('🚀 Unjucks CLI Framework Demo\n'));

// Initialize components
const parser = new HygenArgumentParser();
const router = new CommandRouter();
const helpSystem = new HelpSystem();

// Demo scenarios
const scenarios = [
  {
    name: 'Hygen-style Component Generation',
    args: ['component', 'react', 'Button', '--withTests', '--typescript'],
    description: 'Generate a React component with tests and TypeScript'
  },
  {
    name: 'API Endpoint Generation',
    args: ['api', 'endpoint', 'users', '--withAuth', '--dest=./src/api'],
    description: 'Generate an API endpoint with authentication'
  },
  {
    name: 'Explicit Generate Command',
    args: ['generate', 'page', 'dashboard', '--name=AdminDashboard', '--layout=sidebar'],
    description: 'Generate a dashboard page using explicit syntax'
  },
  {
    name: 'Help Command',
    args: ['help', 'component', 'react'],
    description: 'Show help for React component template'
  },
  {
    name: 'List Command',
    args: ['list', '--verbose'],
    description: 'List all available generators and templates'
  },
  {
    name: 'Error Handling',
    args: ['componnt', 'react'], // Typo in 'component'
    description: 'Demonstrate error handling and suggestions'
  }
];

// Register mock commands for demonstration
router.register({
  command: 'generate',
  handler: async (context) => {
    return {
      success: true,
      files: [
        `src/components/${context.name}.jsx`,
        ...(context.flags.withTests ? [`src/components/${context.name}.test.js`] : []),
        ...(context.flags.typescript ? [`src/components/${context.name}.d.ts`] : [])
      ],
      context
    };
  },
  description: 'Generate files from templates',
  flags: {
    withTests: { type: 'boolean', description: 'Include test files' },
    typescript: { type: 'boolean', description: 'Use TypeScript' },
    dest: { type: 'string', description: 'Output destination', default: './src' }
  }
});

router.register({
  command: 'list',
  handler: async (context) => {
    return {
      success: true,
      generators: [
        { name: 'component', templates: ['react', 'vue', 'angular'] },
        { name: 'api', templates: ['endpoint', 'middleware', 'controller'] },
        { name: 'page', templates: ['basic', 'dashboard', 'form'] }
      ]
    };
  },
  description: 'List available generators and templates'
});

router.register({
  command: 'help',
  handler: async (context) => {
    if (context.generator && context.template) {
      return {
        success: true,
        help: await helpSystem.showTemplateHelp(context.generator, context.template)
      };
    }
    return {
      success: true,
      help: helpSystem.showGeneralHelp()
    };
  },
  description: 'Show contextual help'
});

// Run demo scenarios
async function runDemo() {
  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    
    console.log(chalk.yellow(`${i + 1}. ${scenario.name}`));
    console.log(chalk.gray(`   ${scenario.description}`));
    console.log(chalk.cyan(`   Command: unjucks ${scenario.args.join(' ')}`));
    
    try {
      // Parse arguments
      const parsed = parser.parse(scenario.args);
      console.log(chalk.green('   ✓ Parsed:'), {
        command: parsed.command,
        generator: parsed.generator,
        template: parsed.template,
        name: parsed.name,
        flags: Object.keys(parsed.flags).length > 0 ? parsed.flags : 'none'
      });

      // Route and execute
      const result = await router.route(scenario.args);
      
      if (result.success) {
        console.log(chalk.green('   ✓ Result:'), {
          success: result.success,
          files: result.result?.files || result.result?.generators || 'help shown'
        });
      } else {
        console.log(chalk.red('   ✗ Error:'), {
          error: result.error,
          suggestion: result.suggestion || 'none'
        });
      }
      
    } catch (error) {
      console.log(chalk.red('   ✗ Exception:'), error.message);
    }
    
    console.log(''); // Empty line for spacing
  }
}

// Feature demonstrations
async function demonstrateFeatures() {
  console.log(chalk.blue.bold('🎯 Feature Demonstrations\n'));

  // 1. Style transformation
  console.log(chalk.yellow('1. Argument Style Transformation'));
  const hygenArgs = ['component', 'react', 'Button', '--withTests'];
  const explicitArgs = parser.transformStyle(hygenArgs, 'explicit');
  const backToHygen = parser.transformStyle(explicitArgs, 'hygen');
  
  console.log(chalk.cyan('   Hygen → Explicit:'), hygenArgs, '→', explicitArgs);
  console.log(chalk.cyan('   Explicit → Hygen:'), explicitArgs, '→', backToHygen);
  console.log('');

  // 2. Validation
  console.log(chalk.yellow('2. Command Validation'));
  const validCommand = {
    command: 'generate',
    generator: 'component',
    template: 'react',
    name: 'Button'
  };
  
  const invalidCommand = {
    command: 'generate',
    generator: null, // Missing
    template: 'react'
  };
  
  console.log(chalk.green('   Valid command:'), parser.validate(validCommand));
  console.log(chalk.red('   Invalid command:'), parser.validate(invalidCommand));
  console.log('');

  // 3. Help system
  console.log(chalk.yellow('3. Contextual Help'));
  console.log(chalk.cyan('   Quick reference:'));
  console.log(helpSystem.generateQuickReference());

  // 4. Flag processing
  console.log(chalk.yellow('4. Complex Flag Processing'));
  const complexArgs = [
    'component', 'react', 'ComplexButton',
    '--withTests',
    '--typescript',
    '--dest=./src/components',
    '--stories=true',
    '--export=named',
    '--props=title,onClick,disabled'
  ];
  
  const complexParsed = parser.parse(complexArgs);
  console.log(chalk.green('   Complex flags parsed:'), complexParsed.flags);
  console.log('');
}

// Main demo execution
async function main() {
  try {
    await runDemo();
    await demonstrateFeatures();
    
    console.log(chalk.blue.bold('🎉 Demo Complete!'));
    console.log(chalk.gray('The CLI framework successfully handles:'));
    console.log(chalk.gray('• Hygen-style positional arguments'));
    console.log(chalk.gray('• Explicit command syntax'));
    console.log(chalk.gray('• Complex flag combinations'));
    console.log(chalk.gray('• Error handling and suggestions'));
    console.log(chalk.gray('• Contextual help system'));
    console.log(chalk.gray('• Command routing and validation'));
    console.log(chalk.gray('• Style transformations'));
    
  } catch (error) {
    console.error(chalk.red('Demo failed:'), error.message);
    process.exit(1);
  }
}

// Export for use as module or run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as runDemo };