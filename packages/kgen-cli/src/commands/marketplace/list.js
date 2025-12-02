/**
 * Marketplace List Command
 * 
 * List installed or published packages with filtering and sorting options.
 */

import { defineCommand } from 'citty';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import { success, error, output } from '../../lib/output.js';

export default defineCommand({
  meta: {
    name: 'list',
    description: 'List marketplace packages'
  },
  args: {
    installed: {
      type: 'boolean',
      description: 'Show only installed packages',
      default: false,
      alias: 'i'
    },
    published: {
      type: 'boolean',
      description: 'Show packages published by current user',
      default: false,
      alias: 'p'
    },
    category: {
      type: 'string',
      description: 'Filter by category',
      alias: 'c'
    },
    format: {
      type: 'string',
      description: 'Output format (table|json|yaml)',
      default: 'table',
      alias: 'f'
    }
  },
  async run({ args }) {
    try {
      let packages = [];

      if (args.installed) {
        packages = await getInstalledPackages();
      } else if (args.published) {
        packages = await getPublishedPackages();
      } else {
        packages = await getAvailablePackages();
      }

      // Apply filters
      if (args.category) {
        packages = packages.filter(pkg => pkg.category === args.category);
      }

      const result = success({
        type: args.installed ? 'installed' : args.published ? 'published' : 'available',
        packages,
        total: packages.length,
        filters: {
          category: args.category
        }
      });

      if (args.format === 'table') {
        outputTable(packages, args);
      } else {
        output(result, args.format);
      }

    } catch (err) {
      const result = error(err.message, 'MARKETPLACE_LIST_FAILED', {
        installed: args.installed,
        published: args.published,
        category: args.category,
        stack: process.env.KGEN_DEBUG ? err.stack : undefined
      });

      output(result);
      process.exit(1);
    }
  }
});

async function getInstalledPackages() {
  // In production, this would read from a local registry/cache
  return [
    {
      name: '@enterprise/gdpr-compliance',
      version: '2.1.3',
      category: 'compliance',
      installed: '2024-01-15',
      size: '2.4MB'
    }
  ];
}

async function getPublishedPackages() {
  // In production, this would query the marketplace API for user's packages
  return [
    {
      name: '@myorg/custom-api',
      version: '1.0.0',
      category: 'api',
      published: '2024-01-10',
      downloads: 156
    }
  ];
}

async function getAvailablePackages() {
  // Mock available packages - in production, would query marketplace API
  return [
    {
      name: '@enterprise/gdpr-compliance',
      version: '2.1.3',
      category: 'compliance',
      rating: 4.8,
      downloads: 15420,
      price: '$2,999'
    },
    {
      name: '@api/rest-generator',
      version: '1.5.2',
      category: 'api',
      rating: 4.6,
      downloads: 8930,
      price: 'Free'
    },
    {
      name: '@frontend/react-enterprise',
      version: '3.2.1',
      category: 'frontend',
      rating: 4.7,
      downloads: 12340,
      price: '$499'
    }
  ];
}

function outputTable(packages, args) {
  if (packages.length === 0) {
    console.log('No packages found.');
    return;
  }

  // Simple table output
  const headers = args.installed 
    ? ['NAME', 'VERSION', 'CATEGORY', 'INSTALLED', 'SIZE']
    : args.published
    ? ['NAME', 'VERSION', 'CATEGORY', 'PUBLISHED', 'DOWNLOADS']
    : ['NAME', 'VERSION', 'CATEGORY', 'RATING', 'DOWNLOADS', 'PRICE'];

  console.log(headers.join('\t'));
  console.log('-'.repeat(headers.join('\t').length));

  packages.forEach(pkg => {
    const row = args.installed
      ? [pkg.name, pkg.version, pkg.category, pkg.installed, pkg.size]
      : args.published
      ? [pkg.name, pkg.version, pkg.category, pkg.published, pkg.downloads]
      : [pkg.name, pkg.version, pkg.category, pkg.rating, pkg.downloads, pkg.price];
    
    console.log(row.join('\t'));
  });
}