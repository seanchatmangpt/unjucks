import { RDFDataLoader } from './src/lib/rdf-data-loader.js';

const loader = new RDFDataLoader({
  baseUri: 'http://example.org/',
  cacheEnabled: true,
  validateSyntax: true
});

const turtleData = `
@prefix ex: <http://example.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:Test rdfs:label "Test Resource"@en .
`;

const source = {
  type: 'inline',
  source: turtleData,
  format: 'text/turtle'
};

try {
  const result = await loader.loadFromSource(source);
  console.log('Success:', result.success);
  console.log('Errors:', result.errors);
  console.log('Data subjects:', Object.keys(result.data.subjects));
  console.log('Variables:', Object.keys(result.variables));
} catch (error) {
  console.error('Error:', error);
}