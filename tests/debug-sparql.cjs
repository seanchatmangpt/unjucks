// Quick debug test for SPARQL filters
const fs = require('fs');
const vm = require('vm');

// Read and transform the TypeScript to JavaScript
let code = fs.readFileSync('src/lib/filters/sparql/index.ts', 'utf8');

// Simple TypeScript to JavaScript transformation
code = code
  .replace(/export function/g, 'function')
  .replace(/: string/g, '')
  .replace(/: any/g, '')
  .replace(/: number/g, '')
  .replace(/: boolean/g, '')
  .replace(/: object/g, '')
  .replace(/: Record<string, string>/g, '')
  .replace(/export const sparqlFilters = \{[^}]+\};/s, '');

// Add exports at the end
code += `
module.exports = {
  sparqlVar,
  rdfResource,
  rdfProperty,
  sparqlValue,
  sparqlString,
  rdfValue,
  rdfDatatype,
  schemaOrg,
  sparqlFilter,
  sparqlPropertyPath,
  sparqlAggregation,
  sparqlOrderBy,
  escapeRegex
};
`;

// Execute the code
const context = { module: { exports: {} }, exports: {} };
vm.createContext(context);
vm.runInContext(code, context);

const sparqlFilters = context.module.exports;

console.log('Testing sparqlVar:');
console.log("  sparqlVar('123invalid'):", sparqlFilters.sparqlVar('123invalid'));
console.log("  sparqlVar('?existing'):", sparqlFilters.sparqlVar('?existing'));

console.log('\nTesting sparqlValue:');
console.log("  sparqlValue('John'):", sparqlFilters.sparqlValue('John'));
console.log("  sparqlValue('name'):", sparqlFilters.sparqlValue('name'));

console.log('\nTesting sparqlFilter:');
const filter = { operator: 'equals', left: 'name', right: 'John' };
console.log('  filter input:', JSON.stringify(filter));
console.log('  filter output:', sparqlFilters.sparqlFilter(filter));