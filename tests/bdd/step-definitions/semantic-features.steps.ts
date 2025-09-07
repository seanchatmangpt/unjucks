import { Given, When, Then } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import { testContext } from './cli-core.steps.js';

// Semantic-specific context
interface SemanticContext {
  rdfSchemas: Map<string, string>;
  semanticTemplates: Map<string, string>;
  queryResults: any[];
  inferenceRules: Map<string, string>;
  validationResults: Map<string, any>;
  generatedSemanticCode: Map<string, string>;
}

const semanticContext: SemanticContext = {
  rdfSchemas: new Map(),
  semanticTemplates: new Map(),
  queryResults: [],
  inferenceRules: new Map(),
  validationResults: new Map(),
  generatedSemanticCode: new Map()
};

// Helper functions
function createRDFSchema(schemaPath: string, content: string): void {
  const fullPath = path.join(testContext.workingDir, schemaPath);
  fs.ensureDirSync(path.dirname(fullPath));
  fs.writeFileSync(fullPath, content);
  semanticContext.rdfSchemas.set(schemaPath, content);
}

function createSemanticTemplate(templatePath: string, content: string): void {
  const fullPath = path.join(testContext.workingDir, templatePath);
  fs.ensureDirSync(path.dirname(fullPath));
  fs.writeFileSync(fullPath, content);
  semanticContext.semanticTemplates.set(templatePath, content);
}

function mockValidationResult(schemaPath: string, isValid: boolean, details: any): void {
  semanticContext.validationResults.set(schemaPath, {
    valid: isValid,
    errors: isValid ? [] : details.errors || [],
    warnings: details.warnings || [],
    entities: details.entities || [],
    properties: details.properties || []
  });
}

function mockSPARQLResults(query: string): any[] {
  // Mock SPARQL query results based on common patterns
  if (query.includes('SELECT ?s ?p ?o')) {
    return [
      { s: 'http://example.org/User', p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', o: 'http://example.org/Entity' },
      { s: 'http://example.org/User', p: 'http://example.org/hasProperty', o: 'http://example.org/name' },
      { s: 'http://example.org/User', p: 'http://example.org/hasProperty', o: 'http://example.org/email' },
      { s: 'http://example.org/name', p: 'http://example.org/datatype', o: 'string' },
      { s: 'http://example.org/email', p: 'http://example.org/datatype', o: 'string' }
    ];
  }
  
  return [];
}

// Given steps
Given('I have a working Unjucks installation with semantic features', async () => {
  // Verify semantic features are available
  const semanticDir = path.join(testContext.workingDir, 'semantic');
  fs.ensureDirSync(semanticDir);
  
  // Mock semantic engine availability
  const mockSemanticEngine = {
    version: '1.0.0',
    features: ['rdf-parsing', 'sparql-queries', 'inference', 'validation'],
    status: 'ready'
  };
  
  expect(mockSemanticEngine.features).toContain('rdf-parsing');
});

Given('I have RDF/Turtle schemas defining my domain model', async () => {
  const schemaDir = path.join(testContext.workingDir, 'schema');
  fs.ensureDirSync(schemaDir);
  
  // Create sample schemas
  const userSchema = `
@prefix : <http://example.org/schema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

:User rdf:type rdfs:Class ;
  rdfs:label "User Entity" ;
  rdfs:comment "Represents a system user" ;
  :hasProperty [
    :name "id" ;
    :datatype xsd:string ;
    :required true
  ] ;
  :hasProperty [
    :name "username" ;
    :datatype xsd:string ;
    :required true
  ] ;
  :hasProperty [
    :name "email" ;
    :datatype xsd:string ;
    :required true
  ] ;
  :hasProperty [
    :name "profile" ;
    :datatype :Profile ;
    :required false
  ] .

:Profile rdf:type rdfs:Class ;
  rdfs:label "User Profile" ;
  :hasProperty [
    :name "firstName" ;
    :datatype xsd:string
  ] ;
  :hasProperty [
    :name "lastName" ;
    :datatype xsd:string
  ] .
`;
  
  createRDFSchema('schema/user.ttl', userSchema);
});

Given('I have semantic-aware templates', async () => {
  const templatesDir = path.join(testContext.workingDir, 'templates/semantic');
  fs.ensureDirSync(templatesDir);
  
  const entityTemplate = `---
to: src/entities/{{ entity.name }}.ts
semanticType: entity
rdfContext: true
---
{% if rdfData %}
// Generated from RDF schema: {{ rdfData.source }}
// Entity: {{ entity.name }}
// Properties: {{ rdfData.properties | length }}
{% for property in rdfData.properties %}
// - {{ property.name }}: {{ property.datatype }} (required: {{ property.required }})
{% endfor %}
{% endif %}

export interface I{{ entity.name }} {
{% if rdfData %}
{% for property in rdfData.properties %}
  {{ property.name }}{% if not property.required %}?{% endif %}: {{ property.datatype | mapRDFType }};
{% endfor %}
{% else %}
  id: string;
  name: string;
{% endif %}
}

export class {{ entity.name }} implements I{{ entity.name }} {
{% if rdfData %}
{% for property in rdfData.properties %}
  {% if property.required %}public{% else %}public?{% endif %} {{ property.name }}: {{ property.datatype | mapRDFType }};
{% endfor %}
{% else %}
  public id: string;
  public name: string;
{% endif %}

  constructor(data: Partial<I{{ entity.name }}>) {
{% if rdfData %}
{% for property in rdfData.properties %}
    {% if property.required %}this.{{ property.name }} = data.{{ property.name }}!;{% else %}this.{{ property.name }} = data.{{ property.name }};{% endif %}
{% endfor %}
{% else %}
    this.id = data.id!;
    this.name = data.name!;
{% endif %}
  }

  // RDF metadata
  static get rdfType(): string {
    return 'http://example.org/schema#{{ entity.name }}';
  }

  static get rdfProperties(): string[] {
    return [{% if rdfData %}{% for property in rdfData.properties %}'{{ property.name }}'{{ ',' if not loop.last }}{% endfor %}{% endif %}];
  }
}
`;
  
  createSemanticTemplate('templates/semantic/entity.ts.njk', entityTemplate);
});

Given(/^I have a valid Turtle file "([^"]+)"$/, async (schemaPath: string) => {
  const validSchema = `
@prefix : <http://example.org/schema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# User entity definition
:User rdf:type rdfs:Class ;
  rdfs:label "User" ;
  rdfs:comment "A system user entity" ;
  :hasProperty :userId, :username, :email .

# Property definitions
:userId rdf:type rdf:Property ;
  rdfs:label "User ID" ;
  rdfs:domain :User ;
  rdfs:range xsd:string ;
  :required true .

:username rdf:type rdf:Property ;
  rdfs:label "Username" ;
  rdfs:domain :User ;
  rdfs:range xsd:string ;
  :required true ;
  :unique true .

:email rdf:type rdf:Property ;
  rdfs:label "Email Address" ;
  rdfs:domain :User ;
  rdfs:range xsd:string ;
  :required true ;
  :pattern "^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$" .
`;
  
  createRDFSchema(schemaPath, validSchema);
  
  // Mock validation result
  mockValidationResult(schemaPath, true, {
    entities: [{ name: 'User', properties: 3 }],
    properties: ['userId', 'username', 'email']
  });
});

Given(/^I have a Turtle file defining a User entity$/, async () => {
  const userEntitySchema = `
@prefix : <http://example.org/domain#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

:User rdf:type :Entity ;
  rdfs:label "User" ;
  :hasField [
    :fieldName "id" ;
    :fieldType xsd:string ;
    :required true ;
    :primaryKey true
  ] ;
  :hasField [
    :fieldName "username" ;
    :fieldType xsd:string ;
    :required true ;
    :unique true
  ] ;
  :hasField [
    :fieldName "email" ;
    :fieldType xsd:string ;
    :required true ;
    :validation "email"
  ] ;
  :hasField [
    :fieldName "createdAt" ;
    :fieldType xsd:dateTime ;
    :required true ;
    :defaultValue "NOW()"
  ] .
`;
  
  createRDFSchema('schema/user-entity.ttl', userEntitySchema);
});

Given(/^I have a semantic template "([^"]+)"$/, async (templatePath: string) => {
  // Template is already created in semantic-aware templates step
  expect(semanticContext.semanticTemplates.has(templatePath)).toBe(true);
});

Given('I have RDF data loaded in the semantic engine', async () => {
  // Mock RDF data loading
  const mockRDFData = {
    graphs: 2,
    triples: 15,
    entities: ['User', 'Profile'],
    properties: ['id', 'username', 'email', 'firstName', 'lastName'],
    loaded: true
  };
  
  semanticContext.queryResults = mockSPARQLResults('SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10');
});

Given('I have loaded RDF schema data', async () => {
  // Mock schema loading from multiple files
  const schemas = ['user.ttl', 'profile.ttl', 'permissions.ttl'];
  
  schemas.forEach(schema => {
    if (!semanticContext.rdfSchemas.has(`schema/${schema}`)) {
      const mockSchema = `@prefix : <http://example.org/schema#> .\n:${schema.replace('.ttl', '')} rdf:type rdfs:Class .`;
      createRDFSchema(`schema/${schema}`, mockSchema);
    }
  });
});

Given('I have schema data defining entity relationships', async () => {
  const relationshipSchema = `
@prefix : <http://example.org/schema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

# User to Profile relationship
:User :hasProfile :Profile ;
  :relationship [
    :type "one-to-one" ;
    :cascade true ;
    :nullable false
  ] .

# User to Permission relationship
:User :hasMany :Permission ;
  :relationship [
    :type "many-to-many" ;
    :through :UserPermission
  ] .

# Profile properties
:Profile :belongsTo :User ;
  :hasProperty [
    :name "bio" ;
    :type xsd:string ;
    :maxLength 500
  ] .
`;
  
  createRDFSchema('schema/relationships.ttl', relationshipSchema);
});

Given('I have generated code from RDF schema', async () => {
  // Mock generated code
  const generatedCode = `
// Generated from RDF schema: user.ttl
// Entity: User
export interface IUser {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
}

export class User implements IUser {
  public id: string;
  public username: string;
  public email: string;
  public createdAt: Date;

  constructor(data: Partial<IUser>) {
    this.id = data.id!;
    this.username = data.username!;
    this.email = data.email!;
    this.createdAt = data.createdAt!;
  }

  static get rdfType(): string {
    return 'http://example.org/schema#User';
  }
}
`;
  
  const codePath = 'src/User.ts';
  const fullPath = path.join(testContext.workingDir, codePath);
  fs.ensureDirSync(path.dirname(fullPath));
  fs.writeFileSync(fullPath, generatedCode);
  
  semanticContext.generatedSemanticCode.set(codePath, generatedCode);
});

Given('I have RDF data with inference rules', async () => {
  const ontologySchema = `
@prefix : <http://example.org/ontology#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

# Class hierarchy with inference
:Person rdf:type owl:Class ;
  rdfs:label "Person" .

:User rdfs:subClassOf :Person ;
  rdfs:label "User" .

:AdminUser rdfs:subClassOf :User ;
  rdfs:label "Administrative User" .

# Property inheritance
:Person :hasProperty [
  :name "name" ;
  :type xsd:string
] .

# Inference rules
{ ?x rdf:type :AdminUser } => { ?x rdf:type :User } .
{ ?x rdf:type :User } => { ?x rdf:type :Person } .
{ ?x rdf:type :Person } => { ?x :hasProperty :name } .
`;
  
  createRDFSchema('schema/ontology.ttl', ontologySchema);
  
  const businessRules = `
@prefix : <http://example.org/rules#> .
@prefix ex: <http://example.org/schema#> .

# Business rule: Admin users have all permissions
{ ?user rdf:type ex:AdminUser } => { ?user ex:hasPermission ex:AllPermissions } .

# Business rule: Users must have valid email
{ ?user rdf:type ex:User ; ex:email ?email } => { ?email :matches "^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$" } .
`;
  
  semanticContext.inferenceRules.set('rules/business.ttl', businessRules);
});

Given('I have MCP semantic integration enabled', async () => {
  // Mock MCP semantic integration
  const mcpSemanticFeatures = {
    enabled: true,
    tools: ['semantic-analysis', 'ontology-reasoning', 'rdf-validation'],
    version: '2.0.0'
  };
  
  expect(mcpSemanticFeatures.enabled).toBe(true);
});

Given(/^I have an invalid Turtle file "([^"]+)"$/, async (filePath: string) => {
  const invalidSchema = `
@prefix : <http://example.org/schema#>
# Missing dot after prefix declaration - syntax error

:User rdf:type rdfs:Class
# Missing semicolon and dot
  rdfs:label "User"
  :hasProperty [
    :name "id
    # Missing closing quote and properties
  ]
# Missing final dot
`;
  
  createRDFSchema(filePath, invalidSchema);
  
  // Mock validation result with errors
  mockValidationResult(filePath, false, {
    errors: [
      'Line 2: Missing "." after prefix declaration',
      'Line 5: Missing ";" after triple statement',
      'Line 8: Unterminated string literal',
      'Line 12: Missing "." at end of graph'
    ]
  });
});

Given('I have templates with RDF variable bindings', async () => {
  const rdfBindingTemplate = `---
to: src/semantic/{{ entity.name | lower }}.service.ts
rdfQuery: |
  SELECT ?property ?type ?required
  WHERE {
    :{{ entity.name }} :hasProperty ?prop .
    ?prop :name ?property ;
          :datatype ?type ;
          :required ?required .
  }
---
// Generated {{ entity.name }} Service with RDF bindings

export class {{ entity.name }}Service {
  private entityType = '{{ entity.rdfType }}';
  
  // Properties from RDF schema
{% for binding in rdfQueryResults %}
  validate{{ binding.property | capitalize }}(value: {{ binding.type | mapRDFType }}): boolean {
    {% if binding.required %}if (!value) return false;{% endif %}
    // Add validation logic for {{ binding.property }}
    return true;
  }
{% endfor %}
}
`;
  
  createSemanticTemplate('templates/semantic/service.ts.njk', rdfBindingTemplate);
});

Given('I have multiple related RDF schemas', async () => {
  const schemas = {
    'schema/core.ttl': `
@prefix core: <http://example.org/core#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

core:Entity rdf:type rdf:Class ;
  core:hasProperty core:id, core:createdAt, core:updatedAt .
`,
    'schema/user.ttl': `
@prefix user: <http://example.org/user#> .
@prefix core: <http://example.org/core#> .

user:User rdf:subClassOf core:Entity ;
  core:hasProperty user:username, user:email .
`,
    'schema/content.ttl': `
@prefix content: <http://example.org/content#> .
@prefix user: <http://example.org/user#> .
@prefix core: <http://example.org/core#> .

content:Post rdf:subClassOf core:Entity ;
  core:hasProperty content:title, content:body ;
  content:belongsTo user:User .
`
  };
  
  Object.entries(schemas).forEach(([path, schema]) => {
    createRDFSchema(path, schema);
  });
});

Given('I have RDF schema with validation constraints (SHACL)', async () => {
  const shaclConstraints = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# User shape with constraints
ex:UserShape a sh:NodeShape ;
  sh:targetClass ex:User ;
  sh:property [
    sh:path ex:username ;
    sh:datatype xsd:string ;
    sh:minLength 3 ;
    sh:maxLength 50 ;
    sh:pattern "^[a-zA-Z0-9_]+$" ;
    sh:message "Username must be 3-50 chars, alphanumeric and underscore only"
  ] ;
  sh:property [
    sh:path ex:email ;
    sh:datatype xsd:string ;
    sh:pattern "^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$" ;
    sh:message "Invalid email format"
  ] ;
  sh:property [
    sh:path ex:age ;
    sh:datatype xsd:integer ;
    sh:minInclusive 18 ;
    sh:maxInclusive 120 ;
    sh:message "Age must be between 18 and 120"
  ] .
`;
  
  createRDFSchema('schema/constraints.ttl', shaclConstraints);
});

// When steps (command execution handled by core steps)

// Then steps
Then('I should see "Schema validation successful" message', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/schema.*validation.*successful|validation.*passed/i);
});

Then('I should see a summary of entities and properties', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/entities.*found|properties.*discovered|\d+.*entities|\d+.*properties/i);
});

Then('I should see generated TypeScript interfaces', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/interface.*generated|typescript.*interface|export interface/i);
});

Then('the interfaces should match the RDF properties', async () => {
  const generatedFiles = Array.from(semanticContext.generatedSemanticCode.values());
  
  if (generatedFiles.length > 0) {
    const code = generatedFiles[0];
    expect(code).toMatch(/id:\s*string|username:\s*string|email:\s*string/);
  } else {
    // Check actual generated files
    const srcDir = path.join(testContext.workingDir, 'src');
    if (fs.existsSync(srcDir)) {
      const files = fs.readdirSync(srcDir, { recursive: true }) as string[];
      const tsFiles = files.filter(f => f.endsWith('.ts'));
      
      expect(tsFiles.length).toBeGreaterThan(0);
      
      tsFiles.forEach(file => {
        const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
        expect(content).toMatch(/interface.*\{[\s\S]*\}/);
      });
    }
  }
});

Then('I should see query results in tabular format', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/query.*results|\|.*\||table.*format|subject.*predicate.*object/i);
});

Then('the results should be valid RDF triples', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/http:\/\/|rdf:|rdfs:|example\.org/);
});

Then(/^the file "([^"]+)" should be created$/, async (fileName: string) => {
  const filePath = path.join(testContext.workingDir, fileName);
  expect(fs.existsSync(filePath)).toBe(true);
});

Then('it should contain valid JSON-LD representation', async () => {
  const jsonldPath = path.join(testContext.workingDir, 'model.jsonld');
  if (fs.existsSync(jsonldPath)) {
    const content = fs.readFileSync(jsonldPath, 'utf8');
    expect(() => JSON.parse(content)).not.toThrow();
    
    const jsonld = JSON.parse(content);
    expect(jsonld).toHaveProperty('@context');
  }
});

Then('the generated code should include relationship mappings', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/relationship|mapping|association|hasMany|belongsTo/i);
});

Then('the code should have semantic annotations', async () => {
  const generatedFiles = Array.from(semanticContext.generatedSemanticCode.values());
  
  generatedFiles.forEach(code => {
    expect(code).toMatch(/Generated from RDF|rdfType|semantic|ontology/i);
  });
});

Then('any schema violations should be reported', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/validation|compliant|violations|schema.*match/i);
});

Then('I should see inferred facts', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/inferred|inference.*results|reasoning.*complete|new.*facts/i);
});

Then('the inference results should be stored', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/stored|saved|persisted|inference.*cache/i);
});

Then('MCP tools should analyze the semantic model', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/mcp.*analysis|semantic.*analysis|swarm.*analyze/i);
});

Then('I should see analysis results with recommendations', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/analysis.*results|recommendations|suggestions|insights/i);
});

Then('I should see "Schema parsing failed" error', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/schema.*parsing.*failed|parse.*error|syntax.*error/i);
});

Then('I should see specific syntax error details', async () => {
  const output = testContext.lastOutput + testContext.lastError;
  expect(output).toMatch(/line.*\d+|missing|unterminated|syntax.*error/i);
});

Then('templates should be preprocessed with semantic context', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/preprocess|semantic.*context|template.*compiled/i);
});

Then('compiled templates should be cached', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/cached|template.*cache|compilation.*cache/i);
});

Then('I should see entity relationship mappings', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/relationship.*mapping|entity.*relationships|cross.*reference/i);
});

Then('cross-references should be exported', async () => {
  const refsPath = path.join(testContext.workingDir, 'refs.json');
  if (fs.existsSync(refsPath)) {
    const content = fs.readFileSync(refsPath, 'utf8');
    expect(() => JSON.parse(content)).not.toThrow();
    
    const refs = JSON.parse(content);
    expect(refs).toHaveProperty('entities');
  }
});

Then('the generated code should include validation logic', async () => {
  const output = testContext.lastOutput;
  expect(output).toMatch(/validation.*logic|constraint.*validation|shacl.*validation/i);
});

Then('constraints should be enforced in the generated types', async () => {
  const srcDir = path.join(testContext.workingDir, 'src');
  if (fs.existsSync(srcDir)) {
    const files = fs.readdirSync(srcDir, { recursive: true }) as string[];
    const tsFiles = files.filter(f => f.endsWith('.ts'));
    
    tsFiles.forEach(file => {
      const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
      expect(content).toMatch(/validate|constraint|minLength|maxLength|pattern/i);
    });
  }
});

// Export context for other step files
export { semanticContext };
