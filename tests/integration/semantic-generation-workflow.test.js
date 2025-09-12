import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { promises } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';
import { Store, Parser, Quad } from 'n3';
import yaml from 'js-yaml';
import { SemanticTemplateEngine } from '../../src/lib/semantic-template-engine.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { RDFFilters } from '../../src/lib/rdf-filters.js';

describe('Semantic Generation Workflow - End-to-End', () => {
  let tempDir => {
    tempDir = await mkdtemp(join(tmpdir(), 'semantic-e2e-'));
    templateEngine = new SemanticTemplateEngine();
    rdfLoader = new RDFDataLoader();
    turtleParser = new TurtleParser();
    rdfFilters = new RDFFilters();
  });

  afterAll(async () => { await rm(tempDir, { recursive: true, force });
  });

  beforeEach(() => {
    // Clear any cached data
    rdfLoader.clearCache();
  });

  describe('Complete Workflow, () => { it('should execute full semantic generation pipeline with enterprise data', async () => {
      // Step 1 }`,
                name: `Engineer ${i + 1}`,
                email: `engineer${i + 1}@acme.com`,
                skills: ['JavaScript', 'TypeScript', 'Node.js'],
                projects) + 1}`]
              }))
            },
            { name }`,
                name: `Marketer ${i + 1}`,
                email: `marketer${i + 1}@acme.com`,
                skills: ['SEO', 'Content Marketing', 'Analytics'],
                campaigns) + 1}`]
              }))
            }
          ],
          projects: Array.from({ length, (_, i) => ({
            id }`,
            name: `Project ${i + 1}`,
            budget),
            status: ['planning', 'active', 'completed'][i % 3],
            technologies: ['React', 'Node.js', 'PostgreSQL']
          }))
        },
        metadata: { version }
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
      const renderResult = await templateEngine.renderTemplate(templatePath, templateContent, { variables,
        semanticValidation);
      
      const ttlOutputPath = join(tempDir, 'generated-ontology.ttl');
      await fs.writeFile(ttlOutputPath, renderResult.content);

      // Verify TTL generation
      expect(renderResult.content).toContain('org }}-api-client.ts"
inject: false
---
/**
 * Generated API Client for {{ organization.name }}
 * Generated from semantic data on {{ metadata.generated }}
 */

export export export export export class {{ organization.name | replace(' ', '') }}ApiClient { private baseUrl }

  // Organization methods
  async getOrganization() {
    const response = await fetch(\`\${this.baseUrl}/organization\`);
    return response.json();
  }

  // Department methods
  async getDepartments() {
    const response = await fetch(\`\${this.baseUrl}/departments\`);
    return response.json();
  }

  async getDepartment(id) {
    const response = await fetch(\`\${this.baseUrl}/departments/\${id}\`);
    return response.json();
  }

  // Employee methods
  async getEmployees(departmentId?) {
    const url = departmentId 
      ? \`\${this.baseUrl}/departments/\${departmentId}/employees\`
      : \`\${this.baseUrl}/employees\`;
    const response = await fetch(url);
    return response.json();
  }

  async getEmployee(id) {
    const response = await fetch(\`\${this.baseUrl}/employees/\${id}\`);
    return response.json();
  }

  // Project methods
  async getProjects() {
    const response = await fetch(\`\${this.baseUrl}/projects\`);
    return response.json();
  }

  async getProject(id) {
    const response = await fetch(\`\${this.baseUrl}/projects/\${id}\`);
    return response.json();
  }

  // Search and filter methods
  async searchEmployeesBySkill(skill) {
    const response = await fetch(\`\${this.baseUrl}/employees/search?skill=\${encodeURIComponent(skill)}\`);
    return response.json();
  }

  async getProjectsByStatus(status) {
    const response = await fetch(\`\${this.baseUrl}/projects?status=\${status}\`);
    return response.json();
  }

  // Statistics
  async getOrganizationStats(){ totalEmployees }> {
    const response = await fetch(\`\${this.baseUrl}/stats\`);
    return response.json();
  }
}

// Factory function for easy instantiation
export function create{{ organization.name | replace(' ', '') }}Client(baseUrl): {{ organization.name | replace(' ', '') }}ApiClient {
  return new {{ organization.name | replace(' ', '') }}ApiClient(baseUrl);
}

// Default export for convenience
export default {{ organization.name | replace(' ', '') }}ApiClient;`;

      const apiTemplatePath = join(tempDir, 'api-client-template.njk');
      await fs.writeFile(apiTemplatePath, apiTemplate);

      const apiTemplateContent = await fs.readFile(apiTemplatePath, 'utf-8');
      const clientResult = await templateEngine.renderTemplate(apiTemplatePath, apiTemplateContent, { variables,
        semanticValidation });
      const clientPath = join(tempDir, 'acme-corp-api-client.ts');
      await fs.writeFile(clientPath, clientResult.content);

      // Step 7: Validate generated code structure
      expect(clientResult.content).toContain('export class AcmeCorpApiClient');
      expect(clientResult.content).toContain('async getOrganization()>');
      expect(clientResult.content).toContain('async getDepartments()>');
      expect(clientResult.content).toContain('async searchEmployeesBySkill(skill)');
      expect(clientResult.content).toContain('totalEmployees);

      // Step 8: Generate GraphQL schema from semantic data
      const graphqlTemplate = `---
to: "{{ organization.id }}-schema.graphql"
inject: false
---
"""
GraphQL Schema for {{ organization.name }}
Generated from semantic data
"""

// type Organization (TypeScript type removed)
  id: ID!
  name: String!
  departments: [Department!]!
  projects: [Project!]!
  stats: OrganizationStats!
}

// type Department (TypeScript type removed)
  id: ID!
  name: String!
  employees: [Employee!]!
  organization: Organization!
}

// type Employee (TypeScript type removed)
  id: ID!
  name: String!
  email: String!
  skills: [String!]!
  department: Department!
  projects: [Project!]!
  campaigns: [String!]
}

// type Project (TypeScript type removed)
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

// type OrganizationStats (TypeScript type removed)
  totalEmployees: Int!
  totalProjects: Int!
  departmentCount: Int!
  totalBudget: Int!
  averageProjectBudget: Float!
  employeesByDepartment: [DepartmentStats!]!
}

// type DepartmentStats (TypeScript type removed)
  department: Department!
  employeeCount: Int!
  averageSkillsPerEmployee: Float!
}

// type Query (TypeScript type removed)
  organization: Organization
  departments: [Department!]!
  department(id): Department
  employees(departmentId): [Employee!]!
  employee(id): Employee
  projects(status): [Project!]!
  project(id): Project
  searchEmployeesBySkill(skill): [Employee!]!
  organizationStats: OrganizationStats!
}

// type Mutation (TypeScript type removed)
  createEmployee(input): Employee!
  updateEmployee(id: ID!, input): Employee!
  deleteEmployee(id): Boolean!
  createProject(input): Project!
  updateProject(id: ID!, input): Project!
  assignEmployeeToProject(employeeId: ID!, projectId): Boolean!
}

input CreateEmployeeInput { name }

input UpdateEmployeeInput { name }

input CreateProjectInput { name }

input UpdateProjectInput { name }

// type Subscription (TypeScript type removed)
  employeeAdded: Employee!
  projectStatusChanged: Project!
  organizationStatsUpdated: OrganizationStats!
}`;

      const gqlTemplatePath = join(tempDir, 'graphql-schema-template.njk');
      await fs.writeFile(gqlTemplatePath, graphqlTemplate);

      const gqlTemplateContent = await fs.readFile(gqlTemplatePath, 'utf-8');
      const schemaResult = await templateEngine.renderTemplate(gqlTemplatePath, gqlTemplateContent, { variables,
        semanticValidation });
      const schemaPath = join(tempDir, 'acme-corp-schema.graphql');
      await fs.writeFile(schemaPath, schemaResult.content);

      // Step 9: Final validation of complete workflow
      expect(schemaResult.content).toContain('type Organization');
      expect(schemaResult.content).toContain('enum ProjectStatus');
      expect(schemaResult.content).toContain('searchEmployeesBySkill(skill)');

      // Verify all files exist
      expect(await fs.access(yamlPath)).resolves;
      expect(await fs.access(ttlOutputPath)).resolves;
      expect(await fs.access(clientPath)).resolves;
      expect(await fs.access(schemaPath)).resolves;

      // Performance validation - check generation time for large dataset
      const startTime = this.getDeterministicTimestamp();
      await templateEngine.renderTemplate(templatePath, templateContent, { variables,
        semanticValidation });
      const generationTime = this.getDeterministicTimestamp() - startTime;
      
      expect(generationTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle complex semantic relationships and validation', async () => { // Complex data with relationships
      const complexData = {
        knowledge_graph },
            { id },
            { id }
          ],
          relationships: [
            { from },
            { from }
          ]
        }
      };

      const relationshipTemplate = `---
to: "knowledge-graph.ttl"
---
@prefix kg: <http://example.com/kg#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

{% for entity in knowledge_graph.entities %}
kg:{ { entity.id | replace(' }} a kg:{{ entity.type }} ;
  kg:name "{{ entity.name }}" .
{% endfor %}

{% for rel in knowledge_graph.relationships %}
kg:{ { rel.from | replace(' }} kg:{{ rel.type }} kg:{ { rel.to | replace(' }} .
{% endfor %}`;

      const templatePath = join(tempDir, 'relationship-template.njk');
      await fs.writeFile(templatePath, relationshipTemplate);

      const templateContent = await fs.readFile(templatePath, 'utf-8');
      const renderResult = await templateEngine.renderTemplate(templatePath, templateContent, { variables,
        semanticValidation });
      const result = renderResult.content;
      
      expect(result).toContain('kg:person_john a kg:Person');
      expect(result).toContain('kg:person_john kg:worksFor kg:company_acme');
      expect(result).toContain('kg:person_john kg:hasSkill kg:skill_javascript');
    });
  });

  describe('Error Handling and Edge Cases', () => { it('should handle malformed YAML gracefully', async () => {
      const malformedYaml = `
        invalid }}', {
          variables);
      }).rejects.toThrow();
    });

    it('should validate generated RDF against SHACL constraints', async () => { const invalidData = {
        person }
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
      const renderResult = await templateEngine.renderTemplate(templatePath, templateContent, { variables,
        semanticValidation });
      const result = renderResult.content;
      const ttlPath = join(tempDir, 'invalid-person.ttl');
      await fs.writeFile(ttlPath, result);

      // Validate the structure - should detect missing name
      const store = await turtleParser.parseFile(ttlPath);
      const nameQuads = store.getQuads('http://example.com/invalid-person', 'http://xmlns.com/foaf/0.1/name', null);
      expect(nameQuads).toHaveLength(0); // No name property found
    });

    it('should handle large datasets efficiently', async () => { const largeData = {
        items }`,
          name: `Item ${i}`,
          value) * 1000
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

      const startTime = this.getDeterministicTimestamp();
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      const renderResult = await templateEngine.renderTemplate(templatePath, templateContent, { variables,
        semanticValidation });
      const result = renderResult.content;
      const endTime = this.getDeterministicTimestamp();

      expect(result).toContain('ex:item-0 a ex:Item');
      expect(result).toContain('ex:item-9999 a ex:Item');
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});