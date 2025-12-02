/**
 * Demo of KGEN Rules Validator - Single Entry Point
 * Shows JSON reporting with ok boolean status
 */

import { validateGraph } from './index.js';

console.log('🚀 KGEN Rules Validator Demo\n');

// Valid RDF data
const validTtl = `
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:john a foaf:Person ;
    foaf:name "John Doe" ;
    foaf:email "john@example.org" ;
    foaf:age 30 .
`;

const validShacl = `
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:PersonShape a sh:NodeShape ;
    sh:targetClass foaf:Person ;
    sh:property [
        sh:path foaf:name ;
        sh:datatype xsd:string ;
        sh:minCount 1 ;
    ] ;
    sh:property [
        sh:path foaf:email ;
        sh:datatype xsd:string ;
        sh:minCount 1 ;
    ] .
`;

// Invalid RDF data (missing required email)
const invalidTtl = `
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:jane a foaf:Person ;
    foaf:name "Jane Smith" .
`;

console.log('✅ Testing valid data:');
const validResult = await validateGraph({ ttl: validTtl, shacl: validShacl });
console.log(JSON.stringify(validResult, null, 2));

console.log('\n❌ Testing invalid data:');
const invalidResult = await validateGraph({ ttl: invalidTtl, shacl: validShacl });
console.log(JSON.stringify(invalidResult, null, 2));

console.log('\n📊 Summary:');
console.log(`Valid graph: ok=${validResult.ok}, errors=${validResult.errors.length}, triples=${validResult.graph.tripleCount}`);
console.log(`Invalid graph: ok=${invalidResult.ok}, errors=${invalidResult.errors.length}, triples=${invalidResult.graph.tripleCount}`);

console.log('\n✨ Single validator entry point with JSON reports and ok boolean - Ready for CLI integration!');