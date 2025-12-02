/**
 * CAS Test Fixtures - Sample Templates and RDF Data
 * 
 * These fixtures provide realistic test data for validating:
 * - Deterministic template rendering
 * - Content-addressed storage functionality  
 * - RDF graph variable extraction
 * - Cache performance scenarios
 */

export interface TemplateFixture {
  name: string;
  content: string;
  variables: Record<string, any>;
  expectedOutputPattern?: string;
  expectedHash?: string;
}

export interface RDFFixture {
  name: string;
  content: string;
  expectedVariables: Record<string, any>;
}

// =============================================================================
// Template Fixtures for Deterministic Rendering Tests
// =============================================================================

export const TEMPLATE_FIXTURES: TemplateFixture[] = [
  {
    name: 'simple-component',
    content: `---
to: src/components/{{name}}.tsx
deterministic: true
---
import React from 'react';

export const {{name}}: React.FC = () => {
  return (
    <div className="{{name | kebabCase}}">
      <h1>{{name}} Component</h1>
      <p>Generated at: {{kgen.staticTimestamp}}</p>
      <p>Build hash: {{kgen.staticHash}}</p>
    </div>
  );
};

export default {{name}};`,
    variables: { name: 'UserProfile' },
    expectedOutputPattern: 'export const UserProfile: React.FC',
    expectedHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' // Example
  },

  {
    name: 'conditional-template',
    content: `---
to: src/models/{{name}}.ts
deterministic: true
---
{% if withInterface %}
export interface {{name}}Config {
  id: string;
  {% if withTimestamp %}
  createdAt: string;
  updatedAt: string;
  {% endif %}
  {% for field in fields %}
  {{field.name}}: {{field.type}};
  {% endfor %}
}
{% endif %}

export class {{name}} {
  {% if withInterface %}
  constructor(private config: {{name}}Config) {}
  {% else %}
  constructor(private id: string) {}
  {% endif %}

  getId(): string {
    {% if withInterface %}
    return this.config.id;
    {% else %}
    return this.id;
    {% endif %}
  }

  // Generated with deterministic hash: {{kgen.buildHash}}
}`,
    variables: {
      name: 'User',
      withInterface: true,
      withTimestamp: true,
      fields: [
        { name: 'email', type: 'string' },
        { name: 'age', type: 'number' }
      ]
    }
  },

  {
    name: 'complex-nested-template',
    content: `---
to: src/services/{{serviceName | kebabCase}}/{{name | kebabCase}}.service.ts
deterministic: true  
---
/**
 * {{name}} Service
 * Generated: {{kgen.staticDate}}
 * Hash: {{kgen.staticHash}}
 */
import { Injectable } from '@nestjs/common';
{% for dependency in dependencies %}
import { {{dependency.class}} } from '{{dependency.path}}';
{% endfor %}

@Injectable()
export class {{name}}Service {
  {% for dependency in dependencies %}
  constructor(
    private readonly {{dependency.name | camelCase}}: {{dependency.class}},
  ) {}
  {% endfor %}

  {% for method in methods %}
  async {{method.name}}(
    {% for param in method.params %}
    {{param.name}}: {{param.type}}{% if not loop.last %},{% endif %}
    {% endfor %}
  ): Promise<{{method.returnType}}> {
    {% if method.useCache %}
    // Content-addressed cache key: {{method.name | hash}}
    const cacheKey = '{{serviceName}}_{{method.name}}_' + JSON.stringify(arguments);
    {% endif %}
    
    // Implementation placeholder
    {% if method.returnType === 'void' %}
    return;
    {% else %}
    return {} as {{method.returnType}};
    {% endif %}
  }
  {% endfor %}

  // Static build identifier: {{kgen.buildHash}}
}`,
    variables: {
      serviceName: 'UserManagement',
      name: 'User',
      dependencies: [
        { name: 'userRepository', class: 'UserRepository', path: '../repositories/user.repository' },
        { name: 'logger', class: 'Logger', path: '@nestjs/common' }
      ],
      methods: [
        {
          name: 'findById',
          params: [{ name: 'id', type: 'string' }],
          returnType: 'User',
          useCache: true
        },
        {
          name: 'create',
          params: [{ name: 'userData', type: 'CreateUserDto' }],
          returnType: 'User',
          useCache: false
        },
        {
          name: 'delete',
          params: [{ name: 'id', type: 'string' }],
          returnType: 'void',
          useCache: false
        }
      ]
    }
  },

  {
    name: 'rdf-driven-template',
    content: `---
to: src/entities/{{entityName | pascalCase}}.entity.ts
deterministic: true
---
/**
 * {{entityName | pascalCase}} Entity
 * Generated from RDF ontology
 * Schema hash: {{schemaHash}}
 */
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('{{entityName | snakeCase}}')
export class {{entityName | pascalCase}}Entity {
  @PrimaryGeneratedColumn()
  id: number;

  {% for property in rdfProperties %}
  {% if property.required %}
  @Column('{{property.dbType}}', { nullable: false })
  {% else %}
  @Column('{{property.dbType}}', { nullable: true })
  {% endif %}
  {{property.name | camelCase}}: {{property.tsType}};

  {% endfor %}

  @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  // Ontology fingerprint: {{ontologyFingerprint}}
}`,
    variables: {
      entityName: 'Person',
      schemaHash: 'abc123',
      ontologyFingerprint: 'def456',
      rdfProperties: [
        { name: 'fullName', tsType: 'string', dbType: 'varchar', required: true },
        { name: 'email', tsType: 'string', dbType: 'varchar', required: true },
        { name: 'age', tsType: 'number', dbType: 'int', required: false },
        { name: 'department', tsType: 'string', dbType: 'varchar', required: false }
      ]
    }
  }
];

// =============================================================================
// RDF Graph Fixtures for Variable Extraction Tests  
// =============================================================================

export const RDF_FIXTURES: RDFFixture[] = [
  {
    name: 'person-ontology',
    content: `@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:Person a ex:EntityClass ;
    ex:className "Person" ;
    ex:tableName "persons" ;
    ex:description "Person entity with contact information" .

ex:Person ex:hasProperty ex:fullName ;
    ex:hasProperty ex:email ;  
    ex:hasProperty ex:age ;
    ex:hasProperty ex:department .

ex:fullName a ex:Property ;
    ex:propertyName "fullName" ;
    ex:propertyType "string" ;
    ex:dbType "varchar(255)" ;
    ex:required "true" ;
    ex:description "Person's full name" .

ex:email a ex:Property ;
    ex:propertyName "email" ;
    ex:propertyType "string" ;
    ex:dbType "varchar(255)" ;
    ex:required "true" ;
    ex:unique "true" ;
    ex:description "Person's email address" .

ex:age a ex:Property ;
    ex:propertyName "age" ;
    ex:propertyType "number" ;
    ex:dbType "int" ;
    ex:required "false" ;
    ex:description "Person's age in years" .

ex:department a ex:Property ;
    ex:propertyName "department" ;
    ex:propertyType "string" ;
    ex:dbType "varchar(100)" ;  
    ex:required "false" ;
    ex:description "Person's department" .`,
    expectedVariables: {
      className: 'Person',
      tableName: 'persons',
      description: 'Person entity with contact information',
      fullName: 'Person\'s full name',
      email: 'Person\'s email address', 
      age: 'Person\'s age in years',
      department: 'Person\'s department'
    }
  },

  {
    name: 'project-ontology',
    content: `@prefix proj: <http://project.example.org/> .
@prefix dc: <http://purl.org/dc/elements/1.1/> .

proj:Project a proj:EntityClass ;
    proj:className "Project" ;
    proj:tableName "projects" ;
    proj:generateService "true" ;
    proj:generateController "true" ;
    proj:generateTests "true" .

proj:Project proj:hasProperty proj:projectName ;
    proj:hasProperty proj:description ;
    proj:hasProperty proj:status ;
    proj:hasProperty proj:budget ;
    proj:hasProperty proj:startDate ;
    proj:hasProperty proj:endDate .

proj:projectName a proj:Property ;
    proj:propertyName "projectName" ;
    proj:propertyType "string" ;
    proj:dbType "varchar(200)" ;
    proj:required "true" ;
    proj:indexed "true" .

proj:description a proj:Property ;
    proj:propertyName "description" ;
    proj:propertyType "string" ;
    proj:dbType "text" ;
    proj:required "false" .

proj:status a proj:Property ;
    proj:propertyName "status" ;
    proj:propertyType "enum" ;
    proj:dbType "varchar(50)" ;
    proj:enumValues "draft,active,completed,cancelled" ;
    proj:required "true" ;
    proj:defaultValue "draft" .

proj:budget a proj:Property ;
    proj:propertyName "budget" ;
    proj:propertyType "decimal" ;
    proj:dbType "decimal(10,2)" ;
    proj:required "false" .

proj:startDate a proj:Property ;
    proj:propertyName "startDate" ;
    proj:propertyType "date" ;
    proj:dbType "date" ;
    proj:required "true" .

proj:endDate a proj:Property ;
    proj:propertyName "endDate" ;
    proj:propertyType "date" ;
    proj:dbType "date" ;
    proj:required "false" .`,
    expectedVariables: {
      className: 'Project',
      tableName: 'projects',
      generateService: 'true',
      generateController: 'true', 
      generateTests: 'true',
      projectName: 'projectName',
      description: 'description',
      status: 'status',
      budget: 'budget',
      startDate: 'startDate',
      endDate: 'endDate'
    }
  }
];

// =============================================================================
// Performance Test Data
// =============================================================================

export const PERFORMANCE_FIXTURES = {
  // Small templates for basic performance testing
  SMALL_TEMPLATES: Array.from({ length: 10 }, (_, i) => ({
    name: `small-template-${i}`,
    content: `// Template ${i}\nexport const Component${i} = () => <div>{{name}}</div>;`,
    variables: { name: `Component${i}` }
  })),

  // Medium templates for cache performance testing
  MEDIUM_TEMPLATES: Array.from({ length: 50 }, (_, i) => ({
    name: `medium-template-${i}`,
    content: `/**
 * Generated Component ${i}
 * Hash: {{kgen.staticHash}}
 */
import React from 'react';

interface Component${i}Props {
  id: string;
  title: string;
  ${Array.from({ length: 5 }, (_, j) => `  field${j}: string;`).join('\n')}
}

export const Component${i}: React.FC<Component${i}Props> = (props) => {
  return (
    <div className="component-${i}">
      <h1>{props.title}</h1>
      ${Array.from({ length: 5 }, (_, j) => `      <p>{props.field${j}}</p>`).join('\n')}
      <small>Generated: {{kgen.staticTimestamp}}</small>
    </div>
  );
};

export default Component${i};`,
    variables: { name: `Component${i}` }
  })),

  // Large template for stress testing
  LARGE_TEMPLATE: {
    name: 'large-stress-template',
    content: `/**
 * Large Template for Stress Testing
 * Contains {{componentCount}} components
 * Generated: {{kgen.staticTimestamp}}
 */

${Array.from({ length: 100 }, (_, i) => `
export interface Component${i}Props {
  id: string;
  name: string;
  ${Array.from({ length: 10 }, (_, j) => `  prop${j}: string;`).join('\n')}
}

export const Component${i}: React.FC<Component${i}Props> = (props) => {
  return (
    <div className="component-${i}">
      <h2>Component ${i}</h2>
      ${Array.from({ length: 10 }, (_, j) => `      <div>{props.prop${j}}</div>`).join('\n')}
    </div>
  );
};`).join('\n')}

// Build hash: {{kgen.buildHash}}
// Component count: {{componentCount}}`,
    variables: { componentCount: 100 }
  }
};

// =============================================================================
// Cache Performance Test Scenarios
// =============================================================================

export const CACHE_SCENARIOS = {
  HIGH_HIT_RATE: {
    name: 'high-cache-hit-rate',
    operations: 1000,
    cacheableContentRatio: 0.9, // 90% of operations hit cache
    expectedHitRate: 85 // 85% minimum hit rate
  },

  MODERATE_HIT_RATE: {
    name: 'moderate-cache-hit-rate', 
    operations: 500,
    cacheableContentRatio: 0.7, // 70% of operations hit cache
    expectedHitRate: 65 // 65% minimum hit rate
  },

  LOW_HIT_RATE: {
    name: 'low-cache-hit-rate',
    operations: 200,
    cacheableContentRatio: 0.3, // 30% of operations hit cache  
    expectedHitRate: 25 // 25% minimum hit rate
  },

  CACHE_EVICTION: {
    name: 'cache-eviction-scenario',
    operations: 2000, // Exceeds typical cache size
    cacheableContentRatio: 0.8,
    expectedHitRate: 70, // Should still maintain reasonable hit rate with LRU
    expectEvictions: true
  }
};

// =============================================================================
// Expected Deterministic Hashes (SHA-256)
// =============================================================================

export const EXPECTED_HASHES = {
  // These hashes are for deterministic validation
  // In real tests, we calculate them once and then verify consistency
  SIMPLE_COMPONENT_HASH: '50d858e0985ecc7f60418aaf0cc5ab587f42c2570a884095a9e8ccacd0f6545c',
  CONDITIONAL_TEMPLATE_HASH: '7d865e959b2466918c9863afca942d0fb89d7c9ac0c99bafc3749504ded97730',
  COMPLEX_SERVICE_HASH: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
  RDF_ENTITY_HASH: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
};

// Export all fixtures
export default {
  TEMPLATE_FIXTURES,
  RDF_FIXTURES,
  PERFORMANCE_FIXTURES,
  CACHE_SCENARIOS,
  EXPECTED_HASHES
};