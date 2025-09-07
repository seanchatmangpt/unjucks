import { defineConfig } from 'automd'

export default defineConfig({
  input: 'README.md',
  exclude: [
    'node_modules/**',
    'dist/**',
    '.git/**',
    'tests/**',
    'coverage/**'
  ],
  transformers: {
    // Package.json data injection
    'package-json': {
      package: './package.json'
    },
    // npm badge automation  
    'npm-version': {
      package: '@seanchatmangpt/unjucks'
    },
    // GitHub repository stats
    'github-stats': {
      repository: 'unjucks/unjucks'
    }
  },
  // Enable content validation
  validate: {
    links: true,
    anchors: true
  },
  // Custom templates for dynamic content
  templates: {
    version: '<!-- automd:package-json key="version" template="v{{value}}" -->',
    npmBadge: '<!-- automd:npm-version template="[![npm version](https://img.shields.io/npm/v/@seanchatmangpt/unjucks?color=yellow)](https://npmjs.com/package/@seanchatmangpt/unjucks)" -->',
    downloadsBadge: '<!-- automd:npm-downloads template="[![npm downloads](https://img.shields.io/npm/dm/@seanchatmangpt/unjucks?color=yellow)](https://npmjs.com/package/@seanchatmangpt/unjucks)" -->'
  }
})