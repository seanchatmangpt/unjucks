/**
 * Knowledge Compilation Example
 * Demonstrates how to use KnowledgeCompiler to transform RDF graphs + N3 rules 
 * into template contexts for KGEN template generation
 */

import { KnowledgeCompiler } from '../knowledge-compiler.js';
import fs from 'fs/promises';

/**
 * Example: Compile API documentation template context
 */
export async function compileAPIDocumentationContext() {
  const compiler = new KnowledgeCompiler({
    enableCaching: true,
    optimizeForTemplates: true,
    compactOutput: false,
    includeMetadata: true
  });

  // Initialize the compiler
  await compiler.initialize();

  // Sample RDF graph representing an API schema
  const apiSchemaGraph = {
    triples: [
      // API Definition
      {
        subject: 'http://unjucks.dev/api/UserService',
        predicate: 'http://unjucks.dev/template/hasVariable',
        object: { type: 'literal', value: 'serviceName' }
      },
      {
        subject: 'http://unjucks.dev/api/UserService',
        predicate: 'http://www.w3.org/2000/01/rdf-schema#comment',
        object: { type: 'literal', value: 'User management service' }
      },
      
      // API Endpoints
      {
        subject: 'http://unjucks.dev/api/UserService',
        predicate: 'http://unjucks.dev/api/hasEndpoint',
        object: { type: 'uri', value: 'http://unjucks.dev/api/endpoint/createUser' }
      },
      {
        subject: 'http://unjucks.dev/api/endpoint/createUser',
        predicate: 'http://unjucks.dev/template/hasVariable',
        object: { type: 'literal', value: 'createUserEndpoint' }
      },
      {
        subject: 'http://unjucks.dev/api/endpoint/createUser',
        predicate: 'http://unjucks.dev/api/httpMethod',
        object: { type: 'literal', value: 'POST' }
      },
      {
        subject: 'http://unjucks.dev/api/endpoint/createUser',
        predicate: 'http://unjucks.dev/api/path',
        object: { type: 'literal', value: '/api/v1/users' }
      },
      {
        subject: 'http://unjucks.dev/api/endpoint/createUser',
        predicate: 'http://unjucks.dev/api/isPublic',
        object: { type: 'literal', value: 'true', datatype: 'http://www.w3.org/2001/XMLSchema#boolean' }
      },
      
      // Data Models
      {
        subject: 'http://unjucks.dev/data/User',
        predicate: 'http://unjucks.dev/template/hasVariable',
        object: { type: 'literal', value: 'userModel' }
      },
      {
        subject: 'http://unjucks.dev/data/User',
        predicate: 'http://unjucks.dev/data/hasField',
        object: { type: 'literal', value: 'id' }
      },
      {
        subject: 'http://unjucks.dev/data/User',
        predicate: 'http://unjucks.dev/data/hasField',
        object: { type: 'literal', value: 'email' }
      },
      {
        subject: 'http://unjucks.dev/data/User',
        predicate: 'http://unjucks.dev/data/hasField',
        object: { type: 'literal', value: 'username' }
      },
      
      // Field Types
      {
        subject: 'http://unjucks.dev/data/User/id',
        predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        object: { type: 'uri', value: 'http://www.w3.org/2001/XMLSchema#integer' }
      },
      {
        subject: 'http://unjucks.dev/data/User/email',
        predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        object: { type: 'uri', value: 'http://www.w3.org/2001/XMLSchema#string' }
      }
    ]
  };

  // N3 rules for API security and compliance
  const securityRules = [
    {
      name: 'Public API Security Rule',
      body: `{
        ?endpoint <http://unjucks.dev/api/isPublic> true .
        ?endpoint <http://unjucks.dev/api/httpMethod> "POST"
      } => {
        ?endpoint <http://unjucks.dev/api/requiresAuthentication> true .
        ?endpoint <http://unjucks.dev/api/requiresRateLimiting> true .
        ?endpoint <http://unjucks.dev/security/threatLevel> "high"
      }`
    },
    {
      name: 'API Versioning Rule',
      body: `{
        ?endpoint <http://unjucks.dev/api/path> ?path
      } => {
        ?endpoint <http://unjucks.dev/api/requiresVersioning> true .
        ?endpoint <http://unjucks.dev/api/versionStrategy> "semantic"
      }`
    },
    {
      name: 'Data Model Documentation Rule',
      body: `{
        ?model <http://unjucks.dev/data/hasField> ?field
      } => {
        ?model <http://unjucks.dev/documentation/requiresFieldDocumentation> true .
        ?field <http://unjucks.dev/documentation/requiresDescription> true
      }`
    }
  ];

  // Compile the context
  console.log('🔄 Compiling API documentation context...');
  const context = await compiler.compileContext(apiSchemaGraph, securityRules);

  // Display results
  console.log('✅ Context compiled successfully!');
  console.log('📊 Metrics:', compiler.getMetrics());
  
  return context;
}

/**
 * Example: Compile React component template context
 */
export async function compileReactComponentContext() {
  const compiler = new KnowledgeCompiler({
    enableCaching: true,
    optimizeForTemplates: true
  });

  await compiler.initialize();

  // RDF graph for React component schema
  const componentGraph = {
    triples: [
      // Component Definition
      {
        subject: 'http://unjucks.dev/component/UserCard',
        predicate: 'http://unjucks.dev/template/hasVariable',
        object: { type: 'literal', value: 'componentName' }
      },
      {
        subject: 'http://unjucks.dev/component/UserCard',
        predicate: 'http://unjucks.dev/react/componentType',
        object: { type: 'literal', value: 'functional' }
      },
      
      // Props
      {
        subject: 'http://unjucks.dev/component/UserCard',
        predicate: 'http://unjucks.dev/react/hasProp',
        object: { type: 'literal', value: 'user' }
      },
      {
        subject: 'http://unjucks.dev/component/UserCard',
        predicate: 'http://unjucks.dev/react/hasProp',
        object: { type: 'literal', value: 'theme' }
      },
      
      // Prop Types
      {
        subject: 'http://unjucks.dev/component/UserCard/user',
        predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        object: { type: 'literal', value: 'object' }
      },
      {
        subject: 'http://unjucks.dev/component/UserCard/user',
        predicate: 'http://unjucks.dev/react/isRequired',
        object: { type: 'literal', value: 'true', datatype: 'http://www.w3.org/2001/XMLSchema#boolean' }
      },
      
      // Styling
      {
        subject: 'http://unjucks.dev/component/UserCard',
        predicate: 'http://unjucks.dev/css/hasStyled',
        object: { type: 'literal', value: 'true', datatype: 'http://www.w3.org/2001/XMLSchema#boolean' }
      }
    ]
  };

  // React-specific rules
  const reactRules = [
    {
      name: 'Functional Component Props Rule',
      body: `{
        ?component <http://unjucks.dev/react/componentType> "functional" .
        ?component <http://unjucks.dev/react/hasProp> ?prop
      } => {
        ?component <http://unjucks.dev/react/requiresPropTypes> true .
        ?prop <http://unjucks.dev/react/requiresValidation> true
      }`
    },
    {
      name: 'Styled Components Rule',
      body: `{
        ?component <http://unjucks.dev/css/hasStyled> true
      } => {
        ?component <http://unjucks.dev/react/requiresStyledImport> true .
        ?component <http://unjucks.dev/css/requiresThemeProvider> true
      }`
    }
  ];

  const context = await compiler.compileContext(componentGraph, reactRules);
  
  console.log('🔄 Compiling React component context...');
  console.log('✅ Context compiled successfully!');
  
  return context;
}

/**
 * Example: Compile database schema template context
 */
export async function compileDatabaseSchemaContext() {
  const compiler = new KnowledgeCompiler();
  await compiler.initialize();

  const schemaGraph = {
    triples: [
      // Table Definition
      {
        subject: 'http://unjucks.dev/db/table/users',
        predicate: 'http://unjucks.dev/template/hasVariable',
        object: { type: 'literal', value: 'tableName' }
      },
      {
        subject: 'http://unjucks.dev/db/table/users',
        predicate: 'http://unjucks.dev/db/hasColumn',
        object: { type: 'literal', value: 'id' }
      },
      {
        subject: 'http://unjucks.dev/db/table/users',
        predicate: 'http://unjucks.dev/db/hasColumn',
        object: { type: 'literal', value: 'email' }
      },
      
      // Column Properties
      {
        subject: 'http://unjucks.dev/db/column/users/id',
        predicate: 'http://unjucks.dev/db/dataType',
        object: { type: 'literal', value: 'serial' }
      },
      {
        subject: 'http://unjucks.dev/db/column/users/id',
        predicate: 'http://unjucks.dev/db/isPrimaryKey',
        object: { type: 'literal', value: 'true', datatype: 'http://www.w3.org/2001/XMLSchema#boolean' }
      },
      {
        subject: 'http://unjucks.dev/db/column/users/email',
        predicate: 'http://unjucks.dev/db/dataType',
        object: { type: 'literal', value: 'varchar' }
      },
      {
        subject: 'http://unjucks.dev/db/column/users/email',
        predicate: 'http://unjucks.dev/db/isUnique',
        object: { type: 'literal', value: 'true', datatype: 'http://www.w3.org/2001/XMLSchema#boolean' }
      }
    ]
  };

  const dbRules = [
    {
      name: 'Primary Key Rule',
      body: `{
        ?column <http://unjucks.dev/db/isPrimaryKey> true
      } => {
        ?column <http://unjucks.dev/db/isNotNull> true .
        ?column <http://unjucks.dev/db/isUnique> true
      }`
    },
    {
      name: 'Email Column Rule',
      body: `{
        ?column <http://unjucks.dev/db/dataType> "varchar" .
        ?column <http://unjucks.dev/db/isUnique> true
      } => {
        ?column <http://unjucks.dev/db/requiresIndex> true .
        ?column <http://unjucks.dev/validation/requiresEmailValidation> true
      }`
    }
  ];

  const context = await compiler.compileContext(schemaGraph, dbRules);
  
  console.log('🔄 Compiling database schema context...');
  console.log('✅ Context compiled successfully!');
  
  return context;
}

/**
 * Main example runner
 */
export async function runKnowledgeCompilerExamples() {
  console.log('🚀 Running Knowledge Compiler Examples\n');

  try {
    // Example 1: API Documentation
    console.log('📝 Example 1: API Documentation Context');
    const apiContext = await compileAPIDocumentationContext();
    console.log('Variables:', Object.keys(apiContext.variables));
    console.log('Facts:', Object.keys(apiContext.facts));
    console.log('Computed:', apiContext.computed);
    console.log();

    // Example 2: React Component
    console.log('⚛️ Example 2: React Component Context');
    const reactContext = await compileReactComponentContext();
    console.log('Variables:', Object.keys(reactContext.variables));
    console.log('Facts:', Object.keys(reactContext.facts));
    console.log();

    // Example 3: Database Schema
    console.log('🗃️ Example 3: Database Schema Context');
    const dbContext = await compileDatabaseSchemaContext();
    console.log('Variables:', Object.keys(dbContext.variables));
    console.log('Facts:', Object.keys(dbContext.facts));
    console.log();

    console.log('✅ All examples completed successfully!');
    
    return {
      apiContext,
      reactContext,
      dbContext
    };

  } catch (error) {
    console.error('❌ Example failed:', error);
    throw error;
  }
}

// Export context examples for testing
export {
  compileAPIDocumentationContext,
  compileReactComponentContext,
  compileDatabaseSchemaContext
};

// Run examples if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runKnowledgeCompilerExamples().catch(console.error);
}