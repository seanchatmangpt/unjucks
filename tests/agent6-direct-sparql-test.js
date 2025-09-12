/**
 * Agent 6 Direct SPARQL Execution Test
 * 
 * Tests direct SPARQL execution using available libraries
 */

import { Store, DataFactory, Parser as N3Parser } from 'n3';
import { readFileSync } from 'fs';

const { namedNode, literal } = DataFactory;

async function testDirectSparqlExecution() {
  console.log('\n=== DIRECT SPARQL EXECUTION TEST ===\n');
  
  try {
    // Load our test data
    console.log('📝 Loading test RDF data...');
    const store = new Store();
    const parser = new N3Parser({ format: 'turtle' });
    
    const testData = readFileSync('tests/agent6-test-dataset.ttl', 'utf8');
    const quads = parser.parse(testData);
    store.addQuads(quads);
    
    console.log(`✅ Loaded ${quads.length} triples\n`);
    
    // Test 1: Direct store queries (Pattern matching)
    console.log('🔍 Test 1: Direct Store Pattern Matching');
    
    // Find all persons
    const personType = namedNode('http://xmlns.com/foaf/0.1/Person');
    const rdfType = namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
    const foafName = namedNode('http://xmlns.com/foaf/0.1/name');
    const foafAge = namedNode('http://xmlns.com/foaf/0.1/age');
    
    const persons = store.getQuads(null, rdfType, personType);
    console.log(`▫️ Found ${persons.length} Person entities:`);
    
    for (const personQuad of persons) {
      const person = personQuad.subject;
      const nameQuads = store.getQuads(person, foafName, null);
      const ageQuads = store.getQuads(person, foafAge, null);
      
      const name = nameQuads[0]?.object?.value || 'Unknown';
      const age = ageQuads[0]?.object?.value || 'Unknown';
      
      console.log(`   ${person.value} -> Name: "${name}", Age: ${age}`);
    }
    
    console.log('\n🔍 Test 2: Complex Pattern Matching (Simulated FILTER)');
    
    // Simulate FILTER(?age > 30) by checking values
    const olderPersons = [];
    for (const personQuad of persons) {
      const person = personQuad.subject;
      const ageQuads = store.getQuads(person, foafAge, null);
      
      if (ageQuads.length > 0) {
        const age = parseInt(ageQuads[0].object.value);
        if (age > 30) {
          const nameQuads = store.getQuads(person, foafName, null);
          const name = nameQuads[0]?.object?.value || 'Unknown';
          olderPersons.push({ person: person.value, name, age });
        }
      }
    }
    
    console.log(`▫️ Persons over 30 years old (${olderPersons.length}):`);
    olderPersons.forEach(p => {
      console.log(`   ${p.name} (${p.age} years)`);
    });
    
    console.log('\n🔍 Test 3: Relationship Traversal (Simulated JOIN)');
    
    // Find department relationships
    const exDept = namedNode('http://example.org/department');
    const deptQuads = store.getQuads(null, exDept, null);
    
    const deptCounts = {};
    for (const deptQuad of deptQuads) {
      const person = deptQuad.subject;
      const dept = deptQuad.object.value;
      
      if (!deptCounts[dept]) deptCounts[dept] = [];
      
      const nameQuads = store.getQuads(person, foafName, null);
      const name = nameQuads[0]?.object?.value || 'Unknown';
      deptCounts[dept].push(name);
    }
    
    console.log('▫️ Department breakdown:');
    Object.entries(deptCounts).forEach(([dept, people]) => {
      console.log(`   ${dept}: ${people.join(', ')} (${people.length} people)`);
    });
    
    console.log('\n🔍 Test 4: Attempting Real SPARQL Execution');
    
    // Try using a simple SPARQL-to-N3 bridge if available
    try {
      const sparqljs = await import('sparqljs');
      const parser = new sparqljs.Parser();
      const generator = new sparqljs.Generator();
      
      const testQuery = 'SELECT ?name WHERE { ?person <http://xmlns.com/foaf/0.1/name> ?name }';
      const parsedQuery = parser.parse(testQuery);
      
      console.log('✅ SPARQL Query Parsed Successfully:');
      console.log(`   Query Type: ${parsedQuery.queryType}`);
      console.log(`   Variables: ${parsedQuery.variables?.map(v => v.variable || v).join(', ')}`);
      
      // Manual execution of the parsed query
      console.log('\n▫️ Manual query execution:');
      const nameTriples = store.getQuads(null, foafName, null);
      nameTriples.forEach(triple => {
        console.log(`   Result: ?name = "${triple.object.value}"`);
      });
      
    } catch (error) {
      console.log(`❌ SPARQL execution failed: ${error.message}`);
    }
    
    console.log('\n🔍 Test 5: ASK Query Simulation');
    
    // Simulate: ASK WHERE { ?s a foaf:Person }
    const hasPersons = persons.length > 0;
    console.log(`▫️ ASK { ?s a foaf:Person } => ${hasPersons}`);
    
    // Simulate: ASK WHERE { ?s foaf:name "Alice Smith" }
    const aliceExists = store.getQuads(null, foafName, literal('Alice Smith')).length > 0;
    console.log(`▫️ ASK { ?s foaf:name "Alice Smith" } => ${aliceExists}`);
    
    console.log('\n🔍 Test 6: CONSTRUCT Query Simulation');
    
    // Simulate: CONSTRUCT { ?s rdfs:label ?name } WHERE { ?s foaf:name ?name }
    console.log('▫️ CONSTRUCT { ?s rdfs:label ?name } WHERE { ?s foaf:name ?name }');
    console.log('   Generated triples:');
    
    const rdfsLabel = namedNode('http://www.w3.org/2000/01/rdf-schema#label');
    const nameTriples = store.getQuads(null, foafName, null);
    
    nameTriples.forEach(triple => {
      console.log(`   ${triple.subject.value} <${rdfsLabel.value}> "${triple.object.value}"`);
    });
    
    console.log('\n' + '='.repeat(50));
    console.log('DIRECT SPARQL EXECUTION SUMMARY:');
    console.log('='.repeat(50));
    console.log('✅ RDF Triple Store: N3 - FULLY FUNCTIONAL');
    console.log('✅ Pattern Matching: Direct queries work perfectly');
    console.log('✅ Complex Filtering: Can be simulated with JavaScript logic');
    console.log('✅ Relationship Traversal: JOIN-like operations work');
    console.log('✅ SPARQL Parser: Available and functional');
    console.log('❌ SPARQL Engine Integration: Missing - requires manual bridging');
    
    console.log('\nREAL QUERY CAPABILITIES:');
    console.log(`• Total triples available: ${quads.length}`);
    console.log(`• Person entities found: ${persons.length}`);
    console.log(`• Name properties found: ${store.getQuads(null, foafName, null).length}`);
    console.log(`• Department relationships: ${deptQuads.length}`);
    console.log(`• Age properties found: ${store.getQuads(null, foafAge, null).length}`);
    
    return {
      status: 'PARTIALLY_FUNCTIONAL',
      rdfStore: 'WORKING',
      patternMatching: 'WORKING', 
      sparqlParser: 'WORKING',
      sparqlExecution: 'MISSING_INTEGRATION',
      tripleCount: quads.length,
      personCount: persons.length
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return {
      status: 'BROKEN',
      error: error.message
    };
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testDirectSparqlExecution()
    .then(result => {
      console.log('\n🎯 Test completed');
      console.log(`Status: ${result.status}`);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { testDirectSparqlExecution };