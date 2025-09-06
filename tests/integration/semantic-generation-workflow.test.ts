import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';
import { Store, Parser, Quad } from 'n3';
import yaml from 'js-yaml';
import { SemanticTemplateEngine } from '../../src/lib/semantic-template-engine';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader';
import { TurtleParser } from '../../src/lib/turtle-parser';
import { RDFFilters } from '../../src/lib/rdf-filters';

describe('Semantic Generation Workflow - End-to-End', () => {
  let tempDir: string;
  let templateEngine: SemanticTemplateEngine;
  let rdfLoader: RDFDataLoader;
  let turtleParser: TurtleParser;
  let rdfFilters: RDFFilters;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'semantic-e2e-'));
    templateEngine = new SemanticTemplateEngine();
    rdfLoader = new RDFDataLoader();
    turtleParser = new TurtleParser();
    rdfFilters = new RDFFilters();
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Clear any cached data
    rdfLoader.clearCache();
  });

  describe('Complete Workflow: YAML → Template → RDF/TTL → Validation → Code Generation', () => {
    it('should execute full semantic generation pipeline with enterprise data', async () => {
      // Step 1: Prepare enterprise-scale YAML data
      const enterpriseData = {
        organization: {
          name: 'Acme Corporation',
          id: 'acme-corp',
          departments: [
            {
              name: 'Engineering',
              id: 'engineering',
              employees: Array.from({ length: 100 }, (_, i) => ({
                id: `emp-${i + 1}`,
                name: `Engineer ${i + 1}`,
                email: `engineer${i + 1}@acme.com`,
                skills: ['JavaScript', 'TypeScript', 'Node.js'],
                projects: [`project-${Math.floor(i / 10) + 1}`]
              }))
            },
            {
              name: 'Marketing',
              id: 'marketing',
              employees: Array.from({ length: 50 }, (_, i) => ({
                id: `mkt-${i + 1}`,
                name: `Marketer ${i + 1}`,
                email: `marketer${i + 1}@acme.com`,
                skills: ['SEO', 'Content Marketing', 'Analytics'],
                campaigns: [`campaign-${Math.floor(i / 5) + 1}`]
              }))
            }
          ],
          projects: Array.from({ length: 20 }, (_, i) => ({
            id: `project-${i + 1}`,
            name: `Project ${i + 1}`,
            budget: 50000 + (i * 10000),
            status: ['planning', 'active', 'completed'][i % 3],
            technologies: ['React', 'Node.js', 'PostgreSQL']
          }))
        },
        metadata: {
          version: '1.0.0',
          generated: new Date().toISOString(),
          namespace: 'https://acme.com/ontology#'
        }
      };

      const yamlPath = join(tempDir, 'enterprise-data.yaml');
      await fs.writeFile(yamlPath, yaml.dump(enterpriseData));

      // Step 2: Create semantic template for organization ontology
      const semanticTemplate = `---
to: "{{ organization.id }}-ontology.ttl"
inject: false
---
@prefix org: <{{ metadata.namespace }}> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# Organization Definition
org:{{ organization.id }} a org:Organization ;
  foaf:name "{{ organization.name }}" ;
  dcterms:identifier "{{ organization.id }}" ;
  dcterms:created "{{ metadata.generated }}"^^xsd:dateTime .

{% for department in organization.departments %}
# Department: {{ department.name }}
org:{{ department.id }} a org:Department ;
  foaf:name "{{ department.name }}" ;
  dcterms:identifier "{{ department.id }}" ;
  org:belongsTo org:{{ organization.id }} .

{% for employee in department.employees %}
# Employee: {{ employee.name }}
org:{{ employee.id }} a foaf:Person ;
  foaf:name "{{ employee.name }}" ;
  foaf:mbox <mailto:{{ employee.email }}> ;
  org:memberOf org:{{ department.id }} ;
  dcterms:identifier "{{ employee.id }}" .

{% for skill in employee.skills %}
org:{{ employee.id }} org:hasSkill "{{ skill }}" .
{% endfor %}

{% if employee.projects %}
{% for project in employee.projects %}
org:{{ employee.id }} org:worksOn org:{{ project }} .
{% endfor %}
{% endif %}

{% endfor %}
{% endfor %}

{% for project in organization.projects %}
# Project: {{ project.name }}
org:{{ project.id }} a org:Project ;
  foaf:name "{{ project.name }}" ;
  dcterms:identifier "{{ project.id }}" ;
  org:budget {{ project.budget }} ;
  org:status "{{ project.status }}" .

{% for tech in project.technologies %}
org:{{ project.id }} org:usesTechnology "{{ tech }}" .
{% endfor %}

{% endfor %}`;

      const templatePath = join(tempDir, 'organization-template.njk');
      await fs.writeFile(templatePath, semanticTemplate);

      // Step 3: Generate RDF/TTL from template
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      const renderResult = await templateEngine.renderTemplate(templatePath, templateContent, {
        variables: enterpriseData,
        semanticValidation: false // Skip validation for performance
      });
      
      const ttlOutputPath = join(tempDir, 'generated-ontology.ttl');
      await fs.writeFile(ttlOutputPath, renderResult.content);

      // Verify TTL generation
      expect(renderResult.content).toContain('org:acme-corp a org:Organization');
      expect(renderResult.content).toContain('foaf:name "Acme Corporation"');
      expect(renderResult.content).toContain('org:engineering a org:Department');
      expect(renderResult.content).toContain('org:emp-1 a foaf:Person');

      // Step 4: Parse and validate generated RDF
      const store = await turtleParser.parseFile(ttlOutputPath);
      
      // Validate structure
      const organizationQuads = store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'https://acme.com/ontology#Organization');
      expect(organizationQuads).toHaveLength(1);

      const departmentQuads = store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'https://acme.com/ontology#Department');
      expect(departmentQuads).toHaveLength(2); // Engineering + Marketing

      const personQuads = store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://xmlns.com/foaf/0.1/Person');
      expect(personQuads).toHaveLength(150); // 100 engineers + 50 marketers

      const projectQuads = store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'https://acme.com/ontology#Project');
      expect(projectQuads).toHaveLength(20);

      // Step 5: Create SHACL shapes for validation
      const shaclShapes = `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix org: <https://acme.com/ontology#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

org:OrganizationShape a sh:NodeShape ;
  sh:targetClass org:Organization ;
  sh:property [
    sh:path foaf:name ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
  ] .

org:PersonShape a sh:NodeShape ;
  sh:targetClass foaf:Person ;
  sh:property [
    sh:path foaf:name ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
  ] ;
  sh:property [
    sh:path foaf:mbox ;
    sh:nodeKind sh:IRI ;
    sh:minCount 1 ;
  ] .

org:ProjectShape a sh:NodeShape ;
  sh:targetClass org:Project ;
  sh:property [
    sh:path org:budget ;
    sh:datatype xsd:integer ;
    sh:minInclusive 0 ;
  ] ;
  sh:property [
    sh:path org:status ;
    sh:in ("planning" "active" "completed") ;
  ] .`;

      const shaclPath = join(tempDir, 'validation-shapes.ttl');
      await fs.writeFile(shaclPath, shaclShapes);

      // Step 6: Generate API client from semantic data
      const apiTemplate = `---
to: "{{ organization.id }}-api-client.ts"
inject: false
---
/**
 * Generated API Client for {{ organization.name }}
 * Generated from semantic data on {{ metadata.generated }}
 */

export interface Organization {
  id: string;
  name: string;
  departments: Department[];
  projects: Project[];
}

export interface Department {
  id: string;
  name: string;
  employees: Employee[];
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  skills: string[];
  projects?: string[];
  campaigns?: string[];
}

export interface Project {
  id: string;
  name: string;
  budget: number;
  status: 'planning' | 'active' | 'completed';
  technologies: string[];
}

export class {{ organization.name | replace(' ', '') }}ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // Organization methods
  async getOrganization(): Promise<Organization> {
    const response = await fetch(\`\${this.baseUrl}/organization\`);
    return response.json();
  }

  // Department methods
  async getDepartments(): Promise<Department[]> {
    const response = await fetch(\`\${this.baseUrl}/departments\`);
    return response.json();
  }

  async getDepartment(id: string): Promise<Department> {
    const response = await fetch(\`\${this.baseUrl}/departments/\${id}\`);
    return response.json();
  }

  // Employee methods
  async getEmployees(departmentId?: string): Promise<Employee[]> {
    const url = departmentId 
      ? \`\${this.baseUrl}/departments/\${departmentId}/employees\`
      : \`\${this.baseUrl}/employees\`;
    const response = await fetch(url);
    return response.json();
  }

  async getEmployee(id: string): Promise<Employee> {
    const response = await fetch(\`\${this.baseUrl}/employees/\${id}\`);
    return response.json();
  }

  // Project methods
  async getProjects(): Promise<Project[]> {
    const response = await fetch(\`\${this.baseUrl}/projects\`);
    return response.json();
  }

  async getProject(id: string): Promise<Project> {
    const response = await fetch(\`\${this.baseUrl}/projects/\${id}\`);
    return response.json();
  }

  // Search and filter methods
  async searchEmployeesBySkill(skill: string): Promise<Employee[]> {
    const response = await fetch(\`\${this.baseUrl}/employees/search?skill=\${encodeURIComponent(skill)}\`);
    return response.json();
  }

  async getProjectsByStatus(status: Project['status']): Promise<Project[]> {
    const response = await fetch(\`\${this.baseUrl}/projects?status=\${status}\`);
    return response.json();
  }

  // Statistics
  async getOrganizationStats(): Promise<{
    totalEmployees: number;
    totalProjects: number;
    departmentCount: number;
    totalBudget: number;
  }> {
    const response = await fetch(\`\${this.baseUrl}/stats\`);
    return response.json();
  }
}

// Factory function for easy instantiation
export function create{{ organization.name | replace(' ', '') }}Client(baseUrl: string): {{ organization.name | replace(' ', '') }}ApiClient {
  return new {{ organization.name | replace(' ', '') }}ApiClient(baseUrl);
}

// Default export for convenience
export default {{ organization.name | replace(' ', '') }}ApiClient;`;

      const apiTemplatePath = join(tempDir, 'api-client-template.njk');
      await fs.writeFile(apiTemplatePath, apiTemplate);

      const apiTemplateContent = await fs.readFile(apiTemplatePath, 'utf-8');
      const clientResult = await templateEngine.renderTemplate(apiTemplatePath, apiTemplateContent, {
        variables: enterpriseData,
        semanticValidation: false
      });
      const clientPath = join(tempDir, 'acme-corp-api-client.ts');
      await fs.writeFile(clientPath, clientResult.content);

      // Step 7: Validate generated code structure
      expect(clientResult.content).toContain('export class AcmeCorpApiClient');
      expect(clientResult.content).toContain('async getOrganization(): Promise<Organization>');
      expect(clientResult.content).toContain('async getDepartments(): Promise<Department[]>');
      expect(clientResult.content).toContain('async searchEmployeesBySkill(skill: string)');
      expect(clientResult.content).toContain('totalEmployees: number');

      // Step 8: Generate GraphQL schema from semantic data
      const graphqlTemplate = `---
to: "{{ organization.id }}-schema.graphql"
inject: false
---
"""
GraphQL Schema for {{ organization.name }}
Generated from semantic data
"""

type Organization {
  id: ID!
  name: String!
  departments: [Department!]!
  projects: [Project!]!
  stats: OrganizationStats!
}

type Department {
  id: ID!
  name: String!
  employees: [Employee!]!
  organization: Organization!
}

type Employee {
  id: ID!
  name: String!
  email: String!
  skills: [String!]!
  department: Department!
  projects: [Project!]!
  campaigns: [String!]
}

type Project {
  id: ID!
  name: String!
  budget: Int!
  status: ProjectStatus!
  technologies: [String!]!
  assignedEmployees: [Employee!]!
}

enum ProjectStatus {
  PLANNING
  ACTIVE
  COMPLETED
}

type OrganizationStats {
  totalEmployees: Int!
  totalProjects: Int!
  departmentCount: Int!
  totalBudget: Int!
  averageProjectBudget: Float!
  employeesByDepartment: [DepartmentStats!]!
}

type DepartmentStats {
  department: Department!
  employeeCount: Int!
  averageSkillsPerEmployee: Float!
}

type Query {
  organization: Organization
  departments: [Department!]!
  department(id: ID!): Department
  employees(departmentId: ID): [Employee!]!
  employee(id: ID!): Employee
  projects(status: ProjectStatus): [Project!]!
  project(id: ID!): Project
  searchEmployeesBySkill(skill: String!): [Employee!]!
  organizationStats: OrganizationStats!
}

type Mutation {
  createEmployee(input: CreateEmployeeInput!): Employee!
  updateEmployee(id: ID!, input: UpdateEmployeeInput!): Employee!
  deleteEmployee(id: ID!): Boolean!
  createProject(input: CreateProjectInput!): Project!
  updateProject(id: ID!, input: UpdateProjectInput!): Project!
  assignEmployeeToProject(employeeId: ID!, projectId: ID!): Boolean!
}

input CreateEmployeeInput {
  name: String!
  email: String!
  departmentId: ID!
  skills: [String!]!
}

input UpdateEmployeeInput {
  name: String
  email: String
  skills: [String!]
}

input CreateProjectInput {
  name: String!
  budget: Int!
  status: ProjectStatus!
  technologies: [String!]!
}

input UpdateProjectInput {
  name: String
  budget: Int
  status: ProjectStatus
  technologies: [String!]
}

type Subscription {
  employeeAdded: Employee!
  projectStatusChanged: Project!
  organizationStatsUpdated: OrganizationStats!
}`;

      const gqlTemplatePath = join(tempDir, 'graphql-schema-template.njk');
      await fs.writeFile(gqlTemplatePath, graphqlTemplate);

      const gqlTemplateContent = await fs.readFile(gqlTemplatePath, 'utf-8');
      const schemaResult = await templateEngine.renderTemplate(gqlTemplatePath, gqlTemplateContent, {
        variables: enterpriseData,
        semanticValidation: false
      });
      const schemaPath = join(tempDir, 'acme-corp-schema.graphql');
      await fs.writeFile(schemaPath, schemaResult.content);

      // Step 9: Final validation of complete workflow
      expect(schemaResult.content).toContain('type Organization');
      expect(schemaResult.content).toContain('enum ProjectStatus');
      expect(schemaResult.content).toContain('searchEmployeesBySkill(skill: String!)');

      // Verify all files exist
      expect(await fs.access(yamlPath)).resolves;
      expect(await fs.access(ttlOutputPath)).resolves;
      expect(await fs.access(clientPath)).resolves;
      expect(await fs.access(schemaPath)).resolves;

      // Performance validation - check generation time for large dataset
      const startTime = Date.now();
      await templateEngine.renderTemplate(templatePath, templateContent, {
        variables: enterpriseData,
        semanticValidation: false
      });
      const generationTime = Date.now() - startTime;
      
      expect(generationTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle complex semantic relationships and validation', async () => {
      // Complex data with relationships
      const complexData = {
        knowledge_graph: {
          entities: [
            { id: 'person:john', type: 'Person', name: 'John Doe' },
            { id: 'company:acme', type: 'Company', name: 'Acme Inc' },
            { id: 'skill:javascript', type: 'Skill', name: 'JavaScript' }
          ],
          relationships: [
            { from: 'person:john', to: 'company:acme', type: 'worksFor' },
            { from: 'person:john', to: 'skill:javascript', type: 'hasSkill' }
          ]
        }
      };

      const relationshipTemplate = `---
to: "knowledge-graph.ttl"
---
@prefix kg: <http://example.com/kg#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

{% for entity in knowledge_graph.entities %}
kg:{{ entity.id | replace(':', '_') }} a kg:{{ entity.type }} ;
  kg:name "{{ entity.name }}" .
{% endfor %}

{% for rel in knowledge_graph.relationships %}
kg:{{ rel.from | replace(':', '_') }} kg:{{ rel.type }} kg:{{ rel.to | replace(':', '_') }} .
{% endfor %}`;

      const templatePath = join(tempDir, 'relationship-template.njk');
      await fs.writeFile(templatePath, relationshipTemplate);

      const templateContent = await fs.readFile(templatePath, 'utf-8');
      const renderResult = await templateEngine.renderTemplate(templatePath, templateContent, {
        variables: complexData,
        semanticValidation: false
      });
      const result = renderResult.content;
      
      expect(result).toContain('kg:person_john a kg:Person');
      expect(result).toContain('kg:person_john kg:worksFor kg:company_acme');
      expect(result).toContain('kg:person_john kg:hasSkill kg:skill_javascript');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed YAML gracefully', async () => {
      const malformedYaml = `
        invalid: yaml: content:
          - missing quote
          - [unclosed array
      `;
      
      const yamlPath = join(tempDir, 'malformed.yaml');
      await fs.writeFile(yamlPath, malformedYaml);

      await expect(async () => {
        const data = yaml.load(await fs.readFile(yamlPath, 'utf-8'));
        await templateEngine.renderTemplate('simple-template.njk', '{{ data }}', {
          variables: { data }
        });
      }).rejects.toThrow();
    });

    it('should validate generated RDF against SHACL constraints', async () => {
      const invalidData = {
        person: {
          id: 'invalid-person',
          // Missing required name field
          email: 'invalid-email' // Invalid email format
        }
      };

      const template = `---
to: "invalid-person.ttl"
---
@prefix ex: <http://example.com/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:{{ person.id }} a foaf:Person ;
  foaf:mbox "{{ person.email }}" .`;

      const templatePath = join(tempDir, 'invalid-template.njk');
      await fs.writeFile(templatePath, template);

      const templateContent = await fs.readFile(templatePath, 'utf-8');
      const renderResult = await templateEngine.renderTemplate(templatePath, templateContent, {
        variables: invalidData,
        semanticValidation: false
      });
      const result = renderResult.content;
      const ttlPath = join(tempDir, 'invalid-person.ttl');
      await fs.writeFile(ttlPath, result);

      // Validate the structure - should detect missing name
      const store = await turtleParser.parseFile(ttlPath);
      const nameQuads = store.getQuads('http://example.com/invalid-person', 'http://xmlns.com/foaf/0.1/name', null);
      expect(nameQuads).toHaveLength(0); // No name property found
    });

    it('should handle large datasets efficiently', async () => {
      const largeData = {
        items: Array.from({ length: 10000 }, (_, i) => ({
          id: `item-${i}`,
          name: `Item ${i}`,
          value: Math.random() * 1000
        }))
      };

      const largeTemplate = `---
to: "large-dataset.ttl"
---
@prefix ex: <http://example.com/> .

{% for item in items %}
ex:{{ item.id }} a ex:Item ;
  ex:name "{{ item.name }}" ;
  ex:value {{ item.value }} .
{% endfor %}`;

      const templatePath = join(tempDir, 'large-template.njk');
      await fs.writeFile(templatePath, largeTemplate);

      const startTime = Date.now();
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      const renderResult = await templateEngine.renderTemplate(templatePath, templateContent, {
        variables: largeData,
        semanticValidation: false
      });
      const result = renderResult.content;
      const endTime = Date.now();

      expect(result).toContain('ex:item-0 a ex:Item');
      expect(result).toContain('ex:item-9999 a ex:Item');
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});