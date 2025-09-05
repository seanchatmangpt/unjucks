import type { UnjucksConfig } from '../../../../src/types';

const config: UnjucksConfig = {
  templatesDir: '_templates',
  outputDir: 'src',
  defaultVariables: {
    author: 'TypeScript Test Author',
    license: 'MIT',
    year: new Date().getFullYear(),
    typescript: true
  },
  filters: {
    pascalCase: (str: string) => {
      return str
        .replace(/[\W_]/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
    },
    camelCase: (str: string) => {
      const pascalCased = str
        .replace(/[\W_]/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
      return pascalCased.charAt(0).toLowerCase() + pascalCased.slice(1);
    },
    kebabCase: (str: string) => {
      return str
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\W_]/g, '-')
        .toLowerCase()
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    },
    snakeCase: (str: string) => {
      return str
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[\W]/g, '_')
        .toLowerCase()
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    }
  },
  helpers: {
    generateId: () => Math.random().toString(36).substring(2, 15),
    formatTimestamp: (date?: Date) => (date || new Date()).toISOString(),
    createSlug: (str: string) => {
      return str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }
  },
  hooks: {
    beforeGenerate: (context) => {
      console.log(`[TypeScript Config] Before generate: ${context.templateName}`);
      if (context.variables.withTypeScript) {
        context.variables.fileExtension = '.ts';
      }
    },
    afterGenerate: (context) => {
      console.log(`[TypeScript Config] Generated: ${context.outputPath}`);
    },
    onError: (error, context) => {
      console.error(`[TypeScript Config] Error in ${context.templateName}:`, error.message);
    }
  },
  validation: {
    validateVariables: true,
    strictMode: true,
    requiredVariables: ['name'],
    customValidators: {
      name: (value: any) => {
        if (typeof value !== 'string') {
          throw new Error('Name must be a string');
        }
        if (value.length < 2) {
          throw new Error('Name must be at least 2 characters long');
        }
        return true;
      }
    }
  },
  dryRun: false,
  force: false,
  verbose: true
};

export default config;