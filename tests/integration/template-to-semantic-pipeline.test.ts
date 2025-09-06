import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';
import { Store, Parser, Writer } from 'n3';
import yaml from 'js-yaml';
import { SemanticTemplateEngine } from '../../src/lib/semantic-template-engine';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader';
import { TurtleParser } from '../../src/lib/turtle-parser';
import { RDFFilters } from '../../src/lib/rdf-filters';

describe('Template to Semantic Pipeline Integration', () => {
  let tempDir: string;
  let templateEngine: SemanticTemplateEngine;
  let rdfLoader: RDFDataLoader;
  let turtleParser: TurtleParser;
  let rdfFilters: RDFFilters;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'template-pipeline-'));
    templateEngine = new SemanticTemplateEngine();
    rdfLoader = new RDFDataLoader();
    turtleParser = new TurtleParser();
    rdfFilters = new RDFFilters();
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    rdfLoader.clearCache();
  });

  describe('Multi-Stage Template Pipeline', () => {
    it('should process cascading template transformations', async () => {
      // Stage 1: Raw data to normalized structure
      const rawData = {
        users: [
          { name: 'John Doe', email: 'john@example.com', department: 'Engineering', skills: 'JavaScript,TypeScript,Node.js' },
          { name: 'Jane Smith', email: 'jane@example.com', department: 'Design', skills: 'Figma,Sketch,Prototyping' }
        ]
      };

      const normalizationTemplate = `---
to: "normalized-data.yaml"
---
organization:
  departments:
{% set departments = {} %}
{% for user in users %}
  {% set dept = departments[user.department] or [] %}
  {% set _ = dept.push({
    name: user.name,
    email: user.email,
    skills: user.skills.split(',')
  }) %}
  {% set departments = departments | merge({[user.department]: dept}) %}
{% endfor %}
{% for dept_name, employees in departments %}
    - name: "{{ dept_name }}"
      employees:
{% for emp in employees %}
        - name: "{{ emp.name }}"
          email: "{{ emp.email }}"
          skills:
{% for skill in emp.skills %}
            - "{{ skill.trim() }}"
{% endfor %}
{% endfor %}
{% endfor %}`;

      const stage1Path = join(tempDir, 'stage1-template.njk');
      await fs.writeFile(stage1Path, normalizationTemplate);

      const normalizedYaml = await templateEngine.render(stage1Path, rawData);
      const normalizedPath = join(tempDir, 'normalized-data.yaml');
      await fs.writeFile(normalizedPath, normalizedYaml);

      // Stage 2: Normalized data to RDF
      const normalizedData = yaml.load(normalizedYaml) as any;
      
      const rdfTemplate = `---
to: "organization.ttl"
---
@prefix org: <http://example.com/org#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .

{% for dept in organization.departments %}
org:{{ dept.name | slug }} a org:Department ;
  foaf:name "{{ dept.name }}" .

{% for emp in dept.employees %}
org:{{ emp.name | slug }} a foaf:Person ;
  foaf:name "{{ emp.name }}" ;
  foaf:mbox <mailto:{{ emp.email }}> ;
  org:memberOf org:{{ dept.name | slug }} .

{% for skill in emp.skills %}
org:{{ emp.name | slug }} org:hasSkill org:{{ skill | slug }} .
org:{{ skill | slug }} a skos:Concept ;
  skos:prefLabel "{{ skill }}" .
{% endfor %}

{% endfor %}
{% endfor %}`;

      const stage2Path = join(tempDir, 'stage2-template.njk');
      await fs.writeFile(stage2Path, rdfTemplate);

      const rdfOutput = await templateEngine.render(stage2Path, normalizedData);
      const rdfPath = join(tempDir, 'organization.ttl');
      await fs.writeFile(rdfPath, rdfOutput);

      // Stage 3: RDF to API specification
      const store = await turtleParser.parseFile(rdfPath);
      const apiData = await rdfFilters.extractApiStructure(store);

      const apiTemplate = `---
to: "api-spec.yaml"
---
openapi: 3.0.0
info:
  title: Organization API
  version: 1.0.0
  description: Generated from RDF data

paths:
{% for dept in departments %}
  /departments/{{ dept.id }}:
    get:
      summary: Get {{ dept.name }} department
      responses:
        '200':
          description: Department information
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Department'
{% endfor %}

{% for person in people %}
  /people/{{ person.id }}:
    get:
      summary: Get {{ person.name }}
      responses:
        '200':
          description: Person information
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Person'
{% endfor %}

components:
  schemas:
    Department:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        employees:
          type: array
          items:
            $ref: '#/components/schemas/Person'
    
    Person:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        email:
          type: string
          format: email
        department:
          type: string
        skills:
          type: array
          items:
            type: string`;

      const stage3Path = join(tempDir, 'stage3-template.njk');
      await fs.writeFile(stage3Path, apiTemplate);

      const apiSpec = await templateEngine.render(stage3Path, apiData);
      const apiPath = join(tempDir, 'api-spec.yaml');
      await fs.writeFile(apiPath, apiSpec);

      // Verify all stages
      expect(normalizedYaml).toContain('organization:');
      expect(normalizedYaml).toContain('departments:');
      expect(rdfOutput).toContain('a org:Department');
      expect(rdfOutput).toContain('a foaf:Person');
      expect(apiSpec).toContain('openapi: 3.0.0');
      expect(apiSpec).toContain('/departments/');
    });

    it('should handle template inheritance and composition', async () => {
      // Base template
      const baseTemplate = `---
to: false
---
@prefix base: <http://example.com/base#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

{% block prefixes %}{% endblock %}

{% block entities %}{% endblock %}

{% block relationships %}{% endblock %}`;

      // Child template extending base
      const childTemplate = `---
to: "extended-output.ttl"
extends: "base-template.njk"
---
{% block prefixes %}
@prefix custom: <http://example.com/custom#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
{% endblock %}

{% block entities %}
{% for entity in entities %}
custom:{{ entity.id }} a custom:{{ entity.type }} ;
  foaf:name "{{ entity.name }}" .
{% endfor %}
{% endblock %}

{% block relationships %}
{% for rel in relationships %}
custom:{{ rel.from }} custom:{{ rel.property }} custom:{{ rel.to }} .
{% endfor %}
{% endblock %}`;

      const basePath = join(tempDir, 'base-template.njk');
      const childPath = join(tempDir, 'child-template.njk');
      await fs.writeFile(basePath, baseTemplate);
      await fs.writeFile(childPath, childTemplate);

      const data = {
        entities: [
          { id: 'person1', type: 'Person', name: 'Alice' },
          { id: 'company1', type: 'Company', name: 'Tech Corp' }
        ],
        relationships: [
          { from: 'person1', property: 'worksFor', to: 'company1' }
        ]
      };

      const result = await templateEngine.render(childPath, data);
      
      expect(result).toContain('@prefix custom:');
      expect(result).toContain('custom:person1 a custom:Person');
      expect(result).toContain('custom:person1 custom:worksFor custom:company1');
    });

    it('should validate semantic consistency across pipeline stages', async () => {
      const inconsistentData = {
        schema: {
          entities: ['Person', 'Company'],
          properties: ['worksFor', 'hasSkill']
        },
        data: {
          instances: [
            { type: 'Person', id: 'john', properties: { worksFor: 'acme', hasSkill: 'coding' } },
            { type: 'NonexistentType', id: 'invalid', properties: {} } // Invalid type
          ]
        }
      };

      const validationTemplate = `---
to: "validation-report.json"
---
{
  "validation": {
    "valid": {{ validation.valid }},
    "errors": [
      {% for error in validation.errors %}
      {
        "type": "{{ error.type }}",
        "message": "{{ error.message }}",
        "entity": "{{ error.entity }}"
      }{{ "," if not loop.last }}
      {% endfor %}
    ],
    "warnings": [
      {% for warning in validation.warnings %}
      {
        "type": "{{ warning.type }}",
        "message": "{{ warning.message }}",
        "entity": "{{ warning.entity }}"
      }{{ "," if not loop.last }}
      {% endfor %}
    ]
  }
}`;

      // Perform validation
      const validation = {
        valid: false,
        errors: [],
        warnings: []
      };

      const validTypes = new Set(inconsistentData.schema.entities);
      const validProperties = new Set(inconsistentData.schema.properties);

      for (const instance of inconsistentData.data.instances) {
        if (!validTypes.has(instance.type)) {
          validation.errors.push({
            type: 'INVALID_TYPE',
            message: `Type '${instance.type}' is not defined in schema`,
            entity: instance.id
          });
        }

        for (const prop of Object.keys(instance.properties)) {
          if (!validProperties.has(prop)) {
            validation.warnings.push({
              type: 'UNDEFINED_PROPERTY',
              message: `Property '${prop}' is not defined in schema`,
              entity: instance.id
            });
          }
        }
      }

      validation.valid = validation.errors.length === 0;

      const templatePath = join(tempDir, 'validation-template.njk');
      await fs.writeFile(templatePath, validationTemplate);

      const result = await templateEngine.render(templatePath, { validation });
      const report = JSON.parse(result);

      expect(report.validation.valid).toBe(false);
      expect(report.validation.errors).toHaveLength(1);
      expect(report.validation.errors[0].type).toBe('INVALID_TYPE');
      expect(report.validation.warnings).toHaveLength(0);
    });
  });

  describe('Semantic Data Transformation', () => {
    it('should transform between different RDF vocabularies', async () => {
      const dublinCoreData = {
        resources: [
          {
            id: 'doc1',
            title: 'Research Paper',
            creator: 'Dr. Smith',
            subject: 'Artificial Intelligence',
            date: '2024-01-15'
          }
        ]
      };

      // Transform Dublin Core to FOAF + Schema.org
      const transformTemplate = `---
to: "transformed-metadata.ttl"
---
@prefix dc: <http://purl.org/dc/elements/1.1/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix schema: <https://schema.org/> .
@prefix ex: <http://example.com/> .

{% for resource in resources %}
# Original Dublin Core representation
ex:{{ resource.id }} dc:title "{{ resource.title }}" ;
  dc:creator "{{ resource.creator }}" ;
  dc:subject "{{ resource.subject }}" ;
  dc:date "{{ resource.date }}" .

# Transformed to Schema.org
ex:{{ resource.id }} a schema:ScholarlyArticle ;
  schema:name "{{ resource.title }}" ;
  schema:author [
    a schema:Person ;
    schema:name "{{ resource.creator }}"
  ] ;
  schema:about "{{ resource.subject }}" ;
  schema:datePublished "{{ resource.date }}" .

# Additional FOAF representation for person
ex:{{ resource.creator | slug }} a foaf:Person ;
  foaf:name "{{ resource.creator }}" ;
  foaf:made ex:{{ resource.id }} .
{% endfor %}`;

      const templatePath = join(tempDir, 'transform-template.njk');
      await fs.writeFile(templatePath, transformTemplate);

      const result = await templateEngine.render(templatePath, dublinCoreData);
      const ttlPath = join(tempDir, 'transformed-metadata.ttl');
      await fs.writeFile(ttlPath, result);

      // Verify transformations
      expect(result).toContain('dc:title "Research Paper"');
      expect(result).toContain('schema:ScholarlyArticle');
      expect(result).toContain('foaf:Person');
      expect(result).toContain('foaf:made ex:doc1');

      // Parse and verify structure
      const store = await turtleParser.parseFile(ttlPath);
      const articleQuads = store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'https://schema.org/ScholarlyArticle');
      expect(articleQuads).toHaveLength(1);
    });

    it('should generate SPARQL queries from template data', async () => {
      const queryData = {
        search: {
          entity_type: 'Person',
          filters: [
            { property: 'department', operator: 'equals', value: 'Engineering' },
            { property: 'skills', operator: 'contains', value: 'JavaScript' }
          ],
          limit: 10
        }
      };

      const sparqlTemplate = `---
to: "generated-query.sparql"
---
PREFIX org: <http://example.com/org#>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT DISTINCT ?person ?name ?email ?department
WHERE {
  ?person rdf:type foaf:{{ search.entity_type }} ;
          foaf:name ?name ;
          foaf:mbox ?email .
  
{% for filter in search.filters %}
  {% if filter.operator == 'equals' %}
  ?person org:{{ filter.property }} "{{ filter.value }}" .
  {% elif filter.operator == 'contains' %}
  ?person org:{{ filter.property }} ?{{ filter.property }}Value .
  FILTER(CONTAINS(LCASE(STR(?{{ filter.property }}Value)), LCASE("{{ filter.value }}")))
  {% endif %}
{% endfor %}
}
{% if search.limit %}
LIMIT {{ search.limit }}
{% endif %}`;

      const templatePath = join(tempDir, 'sparql-template.njk');
      await fs.writeFile(templatePath, sparqlTemplate);

      const result = await templateEngine.render(templatePath, queryData);
      
      expect(result).toContain('SELECT DISTINCT ?person ?name ?email ?department');
      expect(result).toContain('foaf:Person');
      expect(result).toContain('org:department "Engineering"');
      expect(result).toContain('CONTAINS(LCASE(STR(?skillsValue)), LCASE("JavaScript"))');
      expect(result).toContain('LIMIT 10');
    });

    it('should handle complex nested data structures in RDF generation', async () => {
      const complexData = {
        university: {
          name: 'Tech University',
          faculties: [
            {
              name: 'Computer Science',
              departments: [
                {
                  name: 'Software Engineering',
                  courses: [
                    {
                      code: 'SE101',
                      title: 'Intro to Software Engineering',
                      credits: 3,
                      prerequisites: [],
                      instructors: ['Dr. Johnson', 'Prof. Lee']
                    },
                    {
                      code: 'SE201',
                      title: 'Advanced Software Design',
                      credits: 4,
                      prerequisites: ['SE101'],
                      instructors: ['Dr. Johnson']
                    }
                  ]
                }
              ]
            }
          ]
        }
      };

      const complexTemplate = `---
to: "university-ontology.ttl"
---
@prefix univ: <http://university.edu/ontology#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix dcterms: <http://purl.org/dc/terms/> .

# University
univ:{{ university.name | slug }} a univ:University ;
  foaf:name "{{ university.name }}" .

{% for faculty in university.faculties %}
# Faculty: {{ faculty.name }}
univ:{{ faculty.name | slug }} a univ:Faculty ;
  foaf:name "{{ faculty.name }}" ;
  univ:belongsTo univ:{{ university.name | slug }} .

{% for dept in faculty.departments %}
# Department: {{ dept.name }}
univ:{{ dept.name | slug }} a univ:Department ;
  foaf:name "{{ dept.name }}" ;
  univ:belongsTo univ:{{ faculty.name | slug }} .

{% for course in dept.courses %}
# Course: {{ course.title }}
univ:{{ course.code }} a univ:Course ;
  dcterms:identifier "{{ course.code }}" ;
  dcterms:title "{{ course.title }}" ;
  univ:credits {{ course.credits }} ;
  univ:offeredBy univ:{{ dept.name | slug }} .

{% for prereq in course.prerequisites %}
univ:{{ course.code }} univ:hasPrerequisite univ:{{ prereq }} .
{% endfor %}

{% for instructor in course.instructors %}
univ:{{ instructor | slug }} a foaf:Person ;
  foaf:name "{{ instructor }}" ;
  univ:teaches univ:{{ course.code }} .
{% endfor %}

{% endfor %}
{% endfor %}
{% endfor %}`;

      const templatePath = join(tempDir, 'complex-template.njk');
      await fs.writeFile(templatePath, complexTemplate);

      const result = await templateEngine.render(templatePath, complexData);
      const ttlPath = join(tempDir, 'university-ontology.ttl');
      await fs.writeFile(ttlPath, result);

      // Verify complex relationships
      expect(result).toContain('univ:tech-university a univ:University');
      expect(result).toContain('univ:SE201 univ:hasPrerequisite univ:SE101');
      expect(result).toContain('univ:dr-johnson univ:teaches univ:SE101');
      expect(result).toContain('univ:credits 3');

      // Parse and validate structure
      const store = await turtleParser.parseFile(ttlPath);
      const courseQuads = store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://university.edu/ontology#Course');
      expect(courseQuads).toHaveLength(2); // SE101 and SE201

      const prereqQuads = store.getQuads(null, 'http://university.edu/ontology#hasPrerequisite', null);
      expect(prereqQuads).toHaveLength(1); // SE201 -> SE101
    });
  });

  describe('Pipeline Error Handling and Recovery', () => {
    it('should handle template compilation errors gracefully', async () => {
      const invalidTemplate = `---
to: "invalid.ttl"
---
{% for item in items %}
  {% invalid_tag %}
  {{ item.nonexistent.deeply.nested.property }}
{% endfor %}`;

      const templatePath = join(tempDir, 'invalid-template.njk');
      await fs.writeFile(templatePath, invalidTemplate);

      await expect(
        templateEngine.render(templatePath, { items: [{ id: 1 }] })
      ).rejects.toThrow();
    });

    it('should provide detailed error context for data validation', async () => {
      const schema = {
        required_fields: ['id', 'name'],
        field_types: {
          id: 'string',
          name: 'string',
          age: 'number'
        }
      };

      const invalidData = {
        records: [
          { id: 'valid', name: 'Valid Record', age: 25 },
          { name: 'Missing ID', age: 30 }, // Missing required field
          { id: 'invalid-age', name: 'Invalid Age', age: 'not-a-number' } // Wrong type
        ]
      };

      // Validate data before processing
      const errors = [];
      for (let i = 0; i < invalidData.records.length; i++) {
        const record = invalidData.records[i];
        
        for (const field of schema.required_fields) {
          if (!record[field]) {
            errors.push(`Record ${i}: Missing required field '${field}'`);
          }
        }
        
        for (const [field, expectedType] of Object.entries(schema.field_types)) {
          if (record[field] !== undefined) {
            const actualType = typeof record[field];
            if (actualType !== expectedType) {
              errors.push(`Record ${i}: Field '${field}' expected ${expectedType}, got ${actualType}`);
            }
          }
        }
      }

      expect(errors).toContain("Record 1: Missing required field 'id'");
      expect(errors).toContain("Record 2: Field 'age' expected number, got string");
    });

    it('should handle partial pipeline failures with rollback', async () => {
      const pipelineSteps = [
        { name: 'validation', success: true },
        { name: 'transformation', success: true },
        { name: 'generation', success: false }, // This step fails
        { name: 'output', success: true }
      ];

      let completedSteps = [];
      let rollbackRequired = false;

      try {
        for (const step of pipelineSteps) {
          if (!step.success) {
            throw new Error(`Pipeline step '${step.name}' failed`);
          }
          completedSteps.push(step.name);
        }
      } catch (error) {
        rollbackRequired = true;
        // Simulate rollback
        for (const stepName of completedSteps.reverse()) {
          // Rollback logic would go here
          console.log(`Rolling back step: ${stepName}`);
        }
      }

      expect(rollbackRequired).toBe(true);
      expect(completedSteps).toContain('validation');
      expect(completedSteps).toContain('transformation');
      expect(completedSteps).not.toContain('output');
    });
  });
});