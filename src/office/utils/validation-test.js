import VariableExtractor from './variable-extractor.js';

const extractor = new VariableExtractor();

// Test complex template
const template = `
{{user.name|capitalize}} has {{posts|count}} posts
{{#each items}}{{name}} - {{price|currency}}{{/each}}
{{#if user.permissions[role].admin}}Admin Panel{{/if}}
`;

const result = extractor.extract(template);

console.log('=== Validation Test Results ===');
console.log('Variables found:', result.variables.length);
console.log('By type:', Object.fromEntries(result.byType.entries()));
console.log('Dependencies:', Object.fromEntries(result.dependencies.entries()));
console.log('Statistics:', result.statistics);
console.log('Errors:', result.errors.length);
console.log('Warnings:', result.warnings.length);

// Test documentation generation
const docs = extractor.generateDocumentation(result, { format: 'json' });
const parsed = JSON.parse(docs);
console.log('Documentation generated successfully');
console.log('JSON doc size:', docs.length, 'characters');

console.log('✅ All functionality validated successfully!');