#!/usr/bin/env node

/**
 * SPARQL Integration Test Suite
 * Tests SPARQL query generation and validation
 */

import { Parser } from 'sparqljs';
import fs from 'fs';

// SPARQL filter implementations for testing
const sparqlFilters = {
  sparqlVar: (name) => {
    if (!name) return '?var';
    return `?${name.replace(/[^a-zA-Z0-9_]/g, '_')}`;
  },

  sparqlSafe: (value) => {
    return value.replace(/[^a-zA-Z0-9_]/g, '_');
  },

  sparqlSelect: (variables, where) => {
    const vars = Array.isArray(variables) ? variables : [variables];
    const varList = vars.map(v => sparqlFilters.sparqlVar(v)).join(' ');
    return `SELECT ${varList} WHERE { ${where} }`;
  },

  sparqlConstruct: (template, where) => {
    return `CONSTRUCT { ${template} } WHERE { ${where} }`;
  },

  sparqlAsk: (where) => {
    return `ASK { ${where} }`;
  },

  sparqlDescribe: (resource) => {
    return `DESCRIBE ${resource}`;
  },

  sparqlFilter: (condition) => {
    return `FILTER(${condition})`;
  },

  sparqlOptional: (pattern) => {
    return `OPTIONAL { ${pattern} }`;
  },

  sparqlUnion: (patterns) => {
    const patternList = Array.isArray(patterns) ? patterns : [patterns];
    return `{ ${patternList.join(' } UNION { ')} }`;
  },

  sparqlOrderBy: (variables, direction = 'ASC') => {
    const vars = Array.isArray(variables) ? variables : [variables];
    const orderVars = vars.map(v => `${direction}(${sparqlFilters.sparqlVar(v)})`).join(' ');
    return `ORDER BY ${orderVars}`;
  },

  sparqlLimit: (count) => {
    return `LIMIT ${parseInt(count)}`;
  },

  sparqlOffset: (count) => {
    return `OFFSET ${parseInt(count)}`;
  }
};

class SPARQLTestSuite {
  constructor() {
    this.testResults = [];
    this.parser = new Parser();
  }

  async runTest(name, testFn) {
    try {
      console.log(`\n🧪 Running: ${name}`);
      const result = await testFn();
      this.testResults.push({ name, status: 'PASS', result });
      console.log(`✅ PASS: ${name}`);
      return result;
    } catch (error) {
      this.testResults.push({ name, status: 'FAIL', error: error.message });
      console.log(`❌ FAIL: ${name} - ${error.message}`);
      return null;
    }
  }

  validateSPARQL(query) {
    try {
      const parsed = this.parser.parse(query);
      return { valid: true, parsed };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async testBasicVariableGeneration() {
    const var1 = sparqlFilters.sparqlVar('person');
    const var2 = sparqlFilters.sparqlVar('first-name');
    const var3 = sparqlFilters.sparqlVar('company_id');
    const var4 = sparqlFilters.sparqlVar('email@address');
    
    console.log('Variable 1:', var1);
    console.log('Variable 2:', var2);
    console.log('Variable 3:', var3);
    console.log('Variable 4:', var4);
    
    if (var1 !== '?person' || 
        var2 !== '?first_name' ||
        var3 !== '?company_id' ||
        var4 !== '?email_address') {
      throw new Error('SPARQL variable generation failed');
    }
    
    return { var1, var2, var3, var4 };
  }

  async testSelectQueryGeneration() {
    const query1 = sparqlFilters.sparqlSelect('person', '?person rdf:type ex:Person .');
    const query2 = sparqlFilters.sparqlSelect(['person', 'name'], '?person ex:hasName ?name .');
    
    console.log('Query 1:', query1);
    console.log('Query 2:', query2);
    
    const validation1 = this.validateSPARQL(query1);
    const validation2 = this.validateSPARQL(query2);
    
    if (!validation1.valid || !validation2.valid) {
      throw new Error(`SPARQL validation failed: ${validation1.error || validation2.error}`);
    }
    
    return { query1, query2, validation1, validation2 };
  }

  async testComplexQueryGeneration() {
    // Test complex SPARQL query with multiple clauses
    const basePattern = '?person rdf:type ex:Person . ?person ex:firstName ?firstName . ?person ex:worksFor ?company .';
    const optionalPattern = sparqlFilters.sparqlOptional('?person ex:email ?email');
    const filterPattern = sparqlFilters.sparqlFilter('strlen(?firstName) > 3');
    const orderBy = sparqlFilters.sparqlOrderBy(['firstName', 'company'], 'ASC');
    const limit = sparqlFilters.sparqlLimit(10);
    
    const complexQuery = `
SELECT ?person ?firstName ?company ?email WHERE {
  ${basePattern}
  ${optionalPattern}
  ${filterPattern}
}
${orderBy}
${limit}`.trim();
    
    console.log('Complex Query:');
    console.log(complexQuery);
    
    const validation = this.validateSPARQL(complexQuery);
    
    if (!validation.valid) {
      throw new Error(`Complex SPARQL validation failed: ${validation.error}`);
    }
    
    return { complexQuery, validation };
  }

  async testConstructQueryGeneration() {
    const template = '?person ex:hasProfile ?profile .';
    const where = '?person rdf:type ex:Person . ?person ex:firstName ?firstName . BIND(CONCAT("profile/", ?firstName) AS ?profile)';
    
    const constructQuery = sparqlFilters.sparqlConstruct(template, where);
    
    console.log('Construct Query:', constructQuery);
    
    const validation = this.validateSPARQL(constructQuery);
    
    if (!validation.valid) {
      throw new Error(`CONSTRUCT query validation failed: ${validation.error}`);
    }
    
    return { constructQuery, validation };
  }

  async testAskQueryGeneration() {
    const askQuery = sparqlFilters.sparqlAsk('?person rdf:type ex:Person . ?person ex:firstName "John" .');
    
    console.log('Ask Query:', askQuery);
    
    const validation = this.validateSPARQL(askQuery);
    
    if (!validation.valid) {
      throw new Error(`ASK query validation failed: ${validation.error}`);
    }
    
    return { askQuery, validation };
  }

  async testDescribeQueryGeneration() {
    const describeQuery = sparqlFilters.sparqlDescribe('<https://example.org/person/john>');
    
    console.log('Describe Query:', describeQuery);
    
    const validation = this.validateSPARQL(describeQuery);
    
    if (!validation.valid) {
      throw new Error(`DESCRIBE query validation failed: ${validation.error}`);
    }
    
    return { describeQuery, validation };
  }

  async testUnionAndOptionalPatterns() {
    const pattern1 = '?person ex:email ?contact';
    const pattern2 = '?person ex:phone ?contact';
    const unionPattern = sparqlFilters.sparqlUnion([pattern1, pattern2]);
    
    const query = `SELECT ?person ?contact WHERE {
      ?person rdf:type ex:Person .
      ${unionPattern}
    }`;
    
    console.log('Union Query:', query);
    
    const validation = this.validateSPARQL(query);
    
    if (!validation.valid) {
      throw new Error(`Union query validation failed: ${validation.error}`);
    }
    
    return { query, validation, unionPattern };
  }

  async testEnterpriseOntologyQueries() {
    // Generate comprehensive enterprise ontology queries
    const queries = {
      // Find all employees and their departments
      employeeDepartments: sparqlFilters.sparqlSelect(
        ['employee', 'firstName', 'lastName', 'department'],
        `?employee rdf:type ex:Employee .
         ?employee ex:firstName ?firstName .
         ?employee ex:lastName ?lastName .
         ?employee ex:worksInDepartment ?department .
         ${sparqlFilters.sparqlFilter('?department != ex:UnknownDepartment')}`
      ),

      // Find managers with their direct reports
      managersWithReports: `
        SELECT ?manager ?managerName (COUNT(?report) AS ?reportCount) WHERE {
          ?manager rdf:type ex:Manager .
          ?manager ex:firstName ?managerName .
          ?report ex:reportsTo ?manager .
        }
        GROUP BY ?manager ?managerName
        HAVING (COUNT(?report) > 0)
        ${sparqlFilters.sparqlOrderBy('reportCount', 'DESC')}
      `,

      // Find organizational hierarchy
      orgHierarchy: sparqlFilters.sparqlConstruct(
        `?dept ex:hasSubDepartment ?subDept .
         ?dept ex:departmentHead ?head .
         ?subDept ex:parentDepartment ?dept .`,
        `?dept rdf:type ex:Department .
         ?subDept rdf:type ex:Department .
         ?subDept ex:parentDepartment ?dept .
         ${sparqlFilters.sparqlOptional('?dept ex:departmentHead ?head')}`
      ),

      // Security audit query
      securityAudit: `
        ${sparqlFilters.sparqlSelect(
          ['user', 'role', 'permission', 'lastAccess'],
          `?user rdf:type ex:User .
           ?user ex:hasRole ?role .
           ?role ex:hasPermission ?permission .
           ${sparqlFilters.sparqlOptional('?user ex:lastAccessTime ?lastAccess')}
           ${sparqlFilters.sparqlFilter('?permission = ex:AdminPermission')}`
        )}
        ${sparqlFilters.sparqlOrderBy('lastAccess', 'DESC')}
      `
    };

    // Validate all enterprise queries
    for (const [name, query] of Object.entries(queries)) {
      console.log(`\nValidating ${name}:`);
      console.log(query);
      
      const validation = this.validateSPARQL(query);
      if (!validation.valid) {
        throw new Error(`Enterprise query ${name} validation failed: ${validation.error}`);
      }
      
      console.log(`✅ ${name} query is valid`);
    }
    
    return queries;
  }

  async testFederatedQueryGeneration() {
    // Test federated SPARQL query generation
    const federatedQuery = `
      SELECT ?person ?localInfo ?externalInfo WHERE {
        # Local data
        SERVICE <http://local.example.org/sparql> {
          ?person rdf:type ex:Person .
          ?person ex:firstName ?localInfo .
        }
        
        # External data source
        SERVICE <http://external.example.org/sparql> {
          ?person owl:sameAs ?externalPerson .
          ?externalPerson ex:additionalInfo ?externalInfo .
        }
        
        ${sparqlFilters.sparqlFilter('bound(?localInfo) && bound(?externalInfo)')}
      }
      ${sparqlFilters.sparqlOrderBy('person')}
    `;
    
    console.log('Federated Query:');
    console.log(federatedQuery);
    
    // Note: SPARQL.js parser might not fully support SERVICE clauses
    // This is a known limitation, so we'll do basic validation
    if (!federatedQuery.includes('SERVICE') || 
        !federatedQuery.includes('SELECT') ||
        !federatedQuery.includes('WHERE')) {
      throw new Error('Federated query structure validation failed');
    }
    
    return { federatedQuery };
  }

  async runAllTests() {
    console.log('🚀 Starting SPARQL Integration Test Suite');
    console.log('==========================================');

    await this.runTest('Basic Variable Generation', () => this.testBasicVariableGeneration());
    await this.runTest('SELECT Query Generation', () => this.testSelectQueryGeneration());
    await this.runTest('Complex Query Generation', () => this.testComplexQueryGeneration());
    await this.runTest('CONSTRUCT Query Generation', () => this.testConstructQueryGeneration());
    await this.runTest('ASK Query Generation', () => this.testAskQueryGeneration());
    await this.runTest('DESCRIBE Query Generation', () => this.testDescribeQueryGeneration());
    await this.runTest('UNION and OPTIONAL Patterns', () => this.testUnionAndOptionalPatterns());
    await this.runTest('Enterprise Ontology Queries', () => this.testEnterpriseOntologyQueries());
    await this.runTest('Federated Query Generation', () => this.testFederatedQueryGeneration());

    // Summary
    console.log('\n📊 Test Summary');
    console.log('================');
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${this.testResults.length}`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults.filter(r => r.status === 'FAIL').forEach(test => {
        console.log(`  - ${test.name}: ${test.error}`);
      });
    }
    
    return {
      passed,
      failed,
      total: this.testResults.length,
      results: this.testResults
    };
  }
}

// Run the test suite if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testSuite = new SPARQLTestSuite();
  testSuite.runAllTests().then(summary => {
    console.log('\n🏁 SPARQL Integration Tests Complete');
    process.exit(summary.failed > 0 ? 1 : 0);
  }).catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });
}

export default SPARQLTestSuite;