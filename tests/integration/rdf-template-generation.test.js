import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve, join } from 'path';
import { readFileSync, writeFileSync, ensureDirSync, removeSync, existsSync } from 'fs-extra';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import { RDFFilters, registerRDFFilters } from '../../src/lib/rdf-filters.js';
import { Generator } from '../../src/lib/generator.js';
import nunjucks from 'nunjucks';
/**
 * RDF Template Generation Integration Tests
 * Validates that RDF data can be successfully used to generate
 * realistic templates and code scaffolding
 */
describe('RDF Template Generation Integration Tests', () => {
  let dataLoader;
  let rdfFilters;
  let nunjucksEnv = resolve(__dirname, '../fixtures/turtle');
  const templateFixturesPath = resolve(__dirname, '../fixtures/turtle-templates');

  beforeEach(() => {
    dataLoader = new RDFDataLoader({
      cacheEnabled,
      templateDir,
      baseUri);
    
    rdfFilters = new RDFFilters();
    
    // Setup Nunjucks with RDF filters
    nunjucksEnv = new nunjucks.Environment(
      new nunjucks.FileSystemLoader([templateFixturesPath, resolve(__dirname, '../fixtures')]),
      { autoescape }
    );
    
    registerRDFFilters(nunjucksEnv, { prefixes });
  });

  afterEach(() => {
    if (existsSync(testOutputDir)) {
      removeSync(testOutputDir);
    }
    dataLoader.clearCache();
    rdfFilters.clearStore();
  });

  describe('Person Profile Generation', () => { it('should generate TypeScript component from person RDF data', async () => {
      const dataSource = {
        type };

      const result = await dataLoader.loadFromSource(dataSource);
      expect(result.success).toBe(true);
      
      rdfFilters.updateStore(result.data.triples);
      const templateContext = dataLoader.createTemplateContext(result.data, result.variables);

      // Template for generating React component
      const componentTemplate = `---
to: src/components/{{ componentName }}.tsx
---
import React from 'react';

export export interface {{ componentName }}Props {
  persons;
}

export const {{ componentName }}: React.FC<{{ componentName }}Props> = ({ persons }) => {
  return (
    <div className="person-profiles">
      Person Profiles</h2>
      {persons.map((person, index) => (
        <div key={index} className="person-card">
          {person.name}</h3>
          Email: <a href={ \`mailto }\`}>{person.email}</a></p>
          Age: {person.age}</p>
          {person.homepage && (
            Homepage)}
          { person.knows && person.knows.length > 0 && (
            Knows }>{contact}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Sample data extracted from RDF
export const samplePersons = [
{ %- for person in $rdf.getByType('http }
  { name }}",
    email: "{ { person.uri | rdfObject('foaf }}",
    age: { { person.uri | rdfObject('foaf }},
    { %- set homepage = person.uri | rdfObject('foaf }
    {%- if homepage %}
    homepage: "{{ homepage }}",
    {%- endif %}
    { %- set knownPersons = person.uri | rdfObject('foaf }
    {%- if knownPersons.length > 0 %}
    knows: [
      {%- for known in knownPersons %}
      "{{ known | rdfLabel }}"{% if not loop.last %},{% endif %}
      {%- endfor %}
    ]
    {%- endif %}
  }{% if not loop.last %},{% endif %}
{%- endfor %}
];
      `;

      const rendered = nunjucksEnv.renderString(componentTemplate, {
        ...templateContext,
        componentName);

      expect(rendered).toContain('export const PersonProfiles');
      expect(rendered).toContain('name);
      expect(rendered).toContain('email);
      expect(rendered).toContain('age);
      expect(rendered).toContain('name);
      expect(rendered).toContain('knows); // John knows Jane

      // Write the generated file
      const outputPath = join(testOutputDir, 'PersonProfiles.tsx');
      writeFileSync(outputPath, rendered);
      
      // Verify file was created and has expected content
      expect(existsSync(outputPath)).toBe(true);
      const generatedContent = readFileSync(outputPath, 'utf-8');
      expect(generatedContent).toContain('React.FC');
      expect(generatedContent).toContain('Person[]');
    });

    it('should generate API endpoints from person data', async () => { const dataSource = {
        type };

      const result = await dataLoader.loadFromSource(dataSource);
      rdfFilters.updateStore(result.data.triples);
      const templateContext = dataLoader.createTemplateContext(result.data, result.variables);

      const apiTemplate = `---
to: src/api/{{ apiName.toLowerCase() }}.ts
---
import { Request, Response, Router } from 'express';
import { Person } from '../types/Person.js';

export const {{ apiName.toLowerCase() }}Router = Router();

// Sample data from RDF
const persons = [
{ %- for person in $rdf.getByType('http }
  { id }}",
    name: "{ { person.uri | rdfObject('foaf }}",
    email: "{ { person.uri | rdfObject('foaf }}",
    age: { { person.uri | rdfObject('foaf }},
    { %- set homepage = person.uri | rdfObject('foaf }
    {%- if homepage %}
    homepage: "{{ homepage }}",
    {%- endif %}
    createdAt: "{ { person.uri | rdfObject('dcterms }}"
  }{% if not loop.last %},{% endif %}
{%- endfor %}
];

/**
 * GET /{{ apiName.toLowerCase() }}
 * Get all persons
 */
{{ apiName.toLowerCase() }}Router.get('/', (req, res) => {
  res.json({
    success,
    data,
    count);
});

/**
 * GET /{{ apiName.toLowerCase() }}/:id
 * Get person by ID
 */
{{ apiName.toLowerCase() }}Router.get('/:id', (req, res) => {
  const person = persons.find(p => p.id === req.params.id);
  
  if (!person) {
    return res.status(404).json({
      success,
      error);
  }
  
  res.json({ success,
    data });
});

/**
 * GET /{{ apiName.toLowerCase() }}/search
 * Search persons by name or email
 */
{{ apiName.toLowerCase() }}Router.get('/search', (req, res) => {
  const query = req.query.q;
  
  if (!query) {
    return res.status(400).json({
      success,
      error);
  }
  
  const results = persons.filter(person => 
    person.name.toLowerCase().includes(query.toLowerCase()) ||
    person.email.toLowerCase().includes(query.toLowerCase())
  );
  
  res.json({
    success,
    data,
    count);
});

/**
 * GET /{{ apiName.toLowerCase() }}/:id/connections
 * Get connections for a specific person
 */
{{ apiName.toLowerCase() }}Router.get('/:id/connections', (req, res) => { // In real implementation, this would query the RDF store
  // For now, return sample connections based on RDF data
  const connections = [
    {%- for person in $rdf.getByType('http }
    { %- set knownPersons = person.uri | rdfObject('foaf }
    {%- if knownPersons.length > 0 %}
    { personId }}",
      knows: [
        {%- for known in knownPersons %}
        "{{ known | rdfCompact }}"{% if not loop.last %},{% endif %}
        {%- endfor %}
      ]
    }{% if not loop.last %},{% endif %}
    {%- endif %}
    {%- endfor %}
  ].find(conn => conn.personId === req.params.id);
  
  res.json({ success,
    data });

export default {{ apiName.toLowerCase() }}Router;
      `;

      const rendered = nunjucksEnv.renderString(apiTemplate, {
        ...templateContext,
        apiName);

      expect(rendered).toContain('export const personsapiRouter');
      expect(rendered).toContain('name);
      expect(rendered).toContain('email);
      expect(rendered).toContain('GET /personsapi');
      expect(rendered).toContain('search persons by name');

      // Write and verify
      const outputPath = join(testOutputDir, 'personsapi.ts');
      writeFileSync(outputPath, rendered);
      expect(existsSync(outputPath)).toBe(true);
    });
  });

  describe('Organization Project Generation', () => { it('should generate project management dashboard from complex schema', async () => {
      const dataSource = {
        type };

      const result = await dataLoader.loadFromSource(dataSource);
      rdfFilters.updateStore(result.data.triples);
      const templateContext = dataLoader.createTemplateContext(result.data, result.variables);

      const dashboardTemplate = `---
to: src/components/{{ componentName }}.tsx
---
import React, { useMemo } from 'react';
import { Card, Grid, Typography, Chip, LinearProgress } from '@mui/material';

export export export interface {{ componentName }}Props { className? }

const organizations = [
{ %- for org in $rdf.getByType('http }
  { id }}",
    name: "{{ org.uri | rdfLabel }}",
    projects: [
      { %- set orgProjects = org.uri | rdfObject('ex }
      {%- for project in orgProjects %}
      { id }}",
        name: "{{ project.value | rdfLabel }}",
        description: "{ { project.value | rdfObject('rdfs }}",
        budget: { { project.value | rdfObject('ex }},
        priority: "{ { project.value | rdfObject('ex }}",
        startDate: "{ { project.value | rdfObject('ex }}",
        status: "active"
      }{% if not loop.last %},{% endif %}
      {%- endfor %}
    ]
  }{% if not loop.last %},{% endif %}
{%- endfor %}
];

const priorityColors = { low };

export const {{ componentName }}: React.FC<{{ componentName }}Props> = ({ className }) => {
  const stats = useMemo(() => {
    const totalProjects = organizations.reduce((sum, org) => sum + org.projects.length, 0);
    const totalBudget = organizations.reduce((sum, org) => 
      sum + org.projects.reduce((projSum, proj) => projSum + proj.budget, 0), 0
    );
    const criticalProjects = organizations.reduce((sum, org) => 
      sum + org.projects.filter(p => p.priority === 'critical').length, 0
    );
    
    return { totalProjects, totalBudget, criticalProjects };
  }, []);

  return (
    <div className={className}>
      <Typography variant="h4" gutterBottom>
        Project Management Dashboard
      </Typography>
      
      {/* Summary Cards */}
      <Grid container spacing={3} sx={ { mb }}>
        <Grid item xs={12} sm={4}>
          <Card sx={ { p }}>
            <Typography variant="h6" color="primary">
              Total Projects
            </Typography>
            <Typography variant="h3">
              {stats.totalProjects}
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ p)}
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={ { p }}>
            <Typography variant="h6" color="error">
              Critical Projects
            </Typography>
            <Typography variant="h3">
              {stats.criticalProjects}
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Organizations and Projects */}
      {organizations.map(org => (
        <Card key={org.id} sx={ { mb }}>
          <div style={ { padding }}>
            <Typography variant="h5" gutterBottom>
              {org.name}
            </Typography>
            
            <Grid container spacing={2}>
              {org.projects.map(project => (
                <Grid item xs={12} md={6} key={project.id}>
                  <Card variant="outlined" sx={ { p }}>
                    <div style={ { display } 
                        color={priorityColors[project.priority]}
                        size="small"
                      />
                    </div>
                    
                    <Typography variant="body2" color="textSecondary" sx={ { mb }}>
                      {project.description}
                    </Typography>
                    
                    <div style={ { marginBottom }}>
                      <Typography variant="body2">
                        Budget:</strong> \${project.budget.toLocaleString()}
                      </Typography>
                    </div>
                    
                    <div style={ { marginBottom }}>
                      <Typography variant="body2">
                        Start Date:</strong> {project.startDate}
                      </Typography>
                    </div>
                    
                    {/* Simulated progress bar */}
                    <div style={ { marginTop }}>
                      <Typography variant="body2" sx={ { mb }}>
                        Progress
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={ project.priority === 'critical' ? 75  }
                        color={ project.priority === 'critical' ? 'error'  }
                      />
                    </div>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default {{ componentName }};
      `;

      const rendered = nunjucksEnv.renderString(dashboardTemplate, {
        ...templateContext,
        componentName);

      expect(rendered).toContain('export const ProjectDashboard');
      expect(rendered).toContain('ACME Corporation');
      expect(rendered).toContain('Website Redesign');
      expect(rendered).toContain('Database Migration');
      expect(rendered).toContain('budget);
      expect(rendered).toContain('budget);
      expect(rendered).toContain('priority);
      expect(rendered).toContain('priority);

      // Write and verify
      const outputPath = join(testOutputDir, 'ProjectDashboard.tsx');
      writeFileSync(outputPath, rendered);
      expect(existsSync(outputPath)).toBe(true);
      
      const generatedContent = readFileSync(outputPath, 'utf-8');
      expect(generatedContent).toContain('@mui/material');
      expect(generatedContent).toContain('LinearProgress');
    });

    it('should generate database schema from organization RDF', async () => { const dataSource = {
        type };

      const result = await dataLoader.loadFromSource(dataSource);
      rdfFilters.updateStore(result.data.triples);
      const templateContext = dataLoader.createTemplateContext(result.data, result.variables);

      const schemaTemplate = `---
to: database/schema/{{ schemaName.toLowerCase() }}.sql
---
-- Generated SQL Schema from RDF Data
-- Source: {{ dataSource.source }}
-- Generated at: {{ new Date().toISOString() }}

-- Organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    label VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects table  
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    label VARCHAR(255),
    description TEXT,
    budget DECIMAL(12, 2),
    priority VARCHAR(20) CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    start_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data from RDF
{ %- for org in $rdf.getByType('http }

-- {{ org.uri | rdfLabel }}
INSERT INTO organizations (name, label) 
VALUES ('{{ org.uri | rdfLabel }}', '{{ org.uri | rdfLabel }}');

{ %- set orgProjects = org.uri | rdfObject('ex }
{%- if orgProjects.length > 0 %}
-- Projects for {{ org.uri | rdfLabel }}
{%- for project in orgProjects %}
INSERT INTO projects (
    organization_id,
    name,
    label,
    description,
    budget,
    priority,
    start_date
) VALUES (
    (SELECT id FROM organizations WHERE name = '{{ org.uri | rdfLabel }}'),
    '{{ project.value | rdfLabel }}',
    '{{ project.value | rdfLabel }}',
    '{ { project.value | rdfObject('rdfs }}',
    { { project.value | rdfObject('ex }},
    '{ { project.value | rdfObject('ex }}',
    '{ { project.value | rdfObject('ex }}'
);
{%- endfor %}
{%- endif %}
{%- endfor %}

-- Indexes for performance
CREATE INDEX idx_projects_organization_id ON projects(organization_id);
CREATE INDEX idx_projects_priority ON projects(priority);
CREATE INDEX idx_projects_start_date ON projects(start_date);

-- Views for common queries
CREATE VIEW project_summary AS
SELECT 
    o.name AS organization_name,
    COUNT(p.id) AS project_count,
    SUM(p.budget) AS total_budget,
    COUNT(CASE WHEN p.priority = 'critical' THEN 1 END) AS critical_projects,
    COUNT(CASE WHEN p.priority = 'high' THEN 1 END) AS high_priority_projects
FROM organizations o
LEFT JOIN projects p ON o.id = p.organization_id
GROUP BY o.id, o.name;

-- Functions
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER trigger_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_projects_updated_at
    BEFORE UPDATE ON projects  
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Comments
COMMENT ON TABLE organizations IS 'Organizations extracted from RDF data';
COMMENT ON TABLE projects IS 'Projects belonging to organizations, with budget and priority information';
COMMENT ON VIEW project_summary IS 'Summary view showing project statistics by organization';
      `;

      const rendered = nunjucksEnv.renderString(schemaTemplate, {
        ...templateContext,
        schemaName,
        dataSource
      });

      expect(rendered).toContain('CREATE TABLE organizations');
      expect(rendered).toContain('CREATE TABLE projects');
      expect(rendered).toContain('INSERT INTO organizations');
      expect(rendered).toContain("'ACME Corporation'");
      expect(rendered).toContain("'Website Redesign'");
      expect(rendered).toContain("'Database Migration'");
      expect(rendered).toContain('50000');
      expect(rendered).toContain('75000');
      expect(rendered).toContain("'high'");
      expect(rendered).toContain("'critical'");

      // Write and verify
      const outputPath = join(testOutputDir, 'projectmanagement.sql');
      writeFileSync(outputPath, rendered);
      expect(existsSync(outputPath)).toBe(true);
    });
  });

  describe('Documentation Generation', () => { it('should generate comprehensive API documentation from RDF schema', async () => {
      const dataSource = {
        type };

      const result = await dataLoader.loadFromSource(dataSource);
      rdfFilters.updateStore(result.data.triples);
      const templateContext = dataLoader.createTemplateContext(result.data, result.variables);

      const docsTemplate = `---
to: docs/api/{{ apiName }}.md
---
# {{ apiName }} API Documentation

Generated from RDF schema on {{ new Date().toISOString().split('T')[0] }}

## Overview

This API provides access to {{ apiName.toLowerCase() }} data extracted from RDF sources.

## Data Models

### Organization

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique organization identifier |
| name | string | Organization name |
| projects | Project[] | Associated projects |

### Project  

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique project identifier |
| name | string | Project name |
| description | string | Project description |
| budget | number | Project budget in USD |
| priority | enum | Priority level, medium, high, critical |
| startDate | string | Project start date (ISO format) |

## Available Data

{ %- for org in $rdf.getByType('http }

### {{ org.uri | rdfLabel }}

**Organization ID:** \`{{ org.uri | rdfCompact }}\`

{ %- set orgProjects = org.uri | rdfObject('ex }
{%- if orgProjects.length > 0 %}

**Projects:** {{ orgProjects.length }}

{%- for project in orgProjects %}
- **{{ project.value | rdfLabel }}**
  - ID: \`{{ project.value | rdfCompact }}\`
  - Description: { { project.value | rdfObject('rdfs }}
  - Budget: $\{ { project.value | rdfObject('ex }}
  - Priority: { { project.value | rdfObject('ex }}
  - Start Date: { { project.value | rdfObject('ex }}
{%- endfor %}
{%- endif %}
{%- endfor %}

## Endpoints

### GET /api/organizations

Returns all organizations with their projects.

**Response:**
\`\`\`json
{ "success" }
  ]
}
\`\`\`

### GET /api/organizations/:id

Returns a specific organization by ID.

**Parameters:**
- \`id\` (string): Organization identifier

**Response:**
\`\`\`json
{ "success" }
    ]
  }
}
\`\`\`

### GET /api/projects

Returns all projects across organizations.

**Query Parameters:**
- \`priority\` (optional): Filter by priority level
- \`minBudget\` (optional): Filter by minimum budget
- \`maxBudget\` (optional): Filter by maximum budget

**Response:**
\`\`\`json
{ "success" }
  ]
}
\`\`\`

### GET /api/projects/:id

Returns a specific project by ID.

**Parameters:**
- \`id\` (string): Project identifier

## Statistics

Based on current RDF data:

{ %- set allOrgs = $rdf.getByType('http }
{%- set totalProjects = 0 %}
{%- set totalBudget = 0 %}
{%- set criticalCount = 0 %}
{%- set highCount = 0 %}

{%- for org in allOrgs %}
{ %- set orgProjects = org.uri | rdfObject('ex }
{%- set totalProjects = totalProjects + orgProjects.length %}
{%- for project in orgProjects %}
{ %- set budget = project.value | rdfObject('ex }
{%- set totalBudget = totalBudget + budget %}
{ %- set priority = project.value | rdfObject('ex }
{%- if priority == 'critical' %}
{%- set criticalCount = criticalCount + 1 %}
{%- endif %}
{%- if priority == 'high' %}
{%- set highCount = highCount + 1 %}
{%- endif %}
{%- endfor %}
{%- endfor %}

- **Total Organizations:** {{ allOrgs.length }}
- **Total Projects:** {{ totalProjects }}
- **Total Budget:** $\{{ totalBudget | number | localeString }}
- **Critical Projects:** {{ criticalCount }}
- **High Priority Projects:** {{ highCount }}

## RDF Source Information

This API is generated from the following RDF data:

- **Namespaces:**
{%- for prefix, namespace in $rdf.prefixes %}
  - \`{{ prefix }}\`: <{{ namespace }}>
{%- endfor %}

- **Triple Count:** {{ $rdf.subjects | keys | length }} subjects with relationships

## Error Handling

All endpoints return errors in the following format:

\`\`\`json
{ "success" }
\`\`\`

Common error codes:
- \`NOT_FOUND\`: Resource not found
- \`VALIDATION_ERROR\`: Invalid request parameters
- \`SERVER_ERROR\`: Internal server error
      `;

      const rendered = nunjucksEnv.renderString(docsTemplate, { ...templateContext,
        apiName);

      expect(rendered).toContain('# ProjectManagement API Documentation');
      expect(rendered).toContain('### ACME Corporation');
      expect(rendered).toContain('Website Redesign');
      expect(rendered).toContain('Database Migration');
      expect(rendered).toContain('Budget,000');
      expect(rendered).toContain('Budget,000');
      expect(rendered).toContain('Priority);
      expect(rendered).toContain('Priority);
      expect(rendered).toContain('**Total Organizations });
  });

  describe('Complex Template Scenarios', () => { it('should handle multiple RDF data sources in single template', async () => {
      const frontmatter = {
        rdfSources },
          { type }
        ]
      };

      const result = await dataLoader.loadFromFrontmatter(frontmatter);
      expect(result.success).toBe(true);
      
      rdfFilters.updateStore(result.data.triples);
      const templateContext = dataLoader.createTemplateContext(result.data, result.variables);

      const combinedTemplate = `---
to: src/data/combined-data.ts
---
// Combined data from multiple RDF sources
export export const combinedData = { persons }
    { id }}",
      name: "{ { person.uri | rdfObject('foaf }}",
      email: "{ { person.uri | rdfObject('foaf }}"
    }{% if not loop.last %},{% endif %}
{%- endfor %}
  ],
  
  organizations: [
{ %- for org in $rdf.getByType('http }
    { id }}",
      name: "{{ org.uri | rdfLabel }}",
      projectCount: { { (org.uri | rdfObject('ex }}
    }{% if not loop.last %},{% endif %}
{%- endfor %}
  ],
  
  connections: [
    // Sample connections based on available data
{ %- for person in $rdf.getByType('http }
    { personId }}",
      type: "employment"
    }{% if not loop.last %},{% endif %}
{%- endfor %}
  ]
};

// Utility functions
export function findPersonByEmail(email): Person | undefined {
  return combinedData.persons.find(p => p.email === email);
}

export function getOrganizationProjects(orgId) { const org = combinedData.organizations.find(o => o.id === orgId);
  return org ? org.projectCount  }

export function getPersonConnections(personId) {
  return combinedData.connections.filter(c => c.personId === personId);
}
      `;

      const rendered = nunjucksEnv.renderString(combinedTemplate, templateContext);

      expect(rendered).toContain('John Doe');
      expect(rendered).toContain('jane.smith@example.com');
      expect(rendered).toContain('ACME Corporation');
      expect(rendered).toContain('projectCount);
      expect(rendered).toContain('export const combinedData');
      expect(rendered).toContain('findPersonByEmail');

      // Write and verify
      const outputPath = join(testOutputDir, 'combined-data.ts');
      writeFileSync(outputPath, rendered);
      expect(existsSync(outputPath)).toBe(true);
    });

    it('should validate generated output quality and correctness', async () => { const dataSource = {
        type };

      const result = await dataLoader.loadFromSource(dataSource);
      rdfFilters.updateStore(result.data.triples);
      const templateContext = dataLoader.createTemplateContext(result.data, result.variables);

      // Template with validation
      const validatedTemplate = `---
to: src/validation/person-data.ts
---
import { z } from 'zod';

// Schema validation
const PersonSchema = z.object({ name).min(1),
  email });

// Generated data with validation
const rawPersonData = [
{ %- for person in $rdf.getByType('http }
  { name }}",
    email: "{ { person.uri | rdfObject('foaf }}",
    age: { { person.uri | rdfObject('foaf }},
    { %- set homepage = person.uri | rdfObject('foaf }
    {%- if homepage %}
    homepage: "{{ homepage }}"
    {%- endif %}
  }{% if not loop.last %},{% endif %}
{%- endfor %}
];

// Validate and export
export const validatedPersons = rawPersonData.map((person, index) => {
  try {
    return PersonSchema.parse(person);
  } catch (error) {
    console.error(\`Person at index \${index} failed validation:\`, error);
    throw new Error(\`Invalid person data at index \${index}\`);
  }
});

// Data quality metrics
export const dataQualityReport = { totalRecords }
};

console.log('Data Quality Report:', dataQualityReport);
      `;

      const rendered = nunjucksEnv.renderString(validatedTemplate, templateContext);

      expect(rendered).toContain('import { z } from');
      expect(rendered).toContain('PersonSchema');
      expect(rendered).toContain('name);
      expect(rendered).toContain('email);
      expect(rendered).toContain('age);
      expect(rendered).toContain('dataQualityReport');
      expect(rendered).toContain('completenessScore');

      // Verify the generated content would be syntactically valid TypeScript
      expect(rendered).not.toContain('undefined');
      expect(rendered).not.toContain('{{ ');
      expect(rendered).not.toContain('{% ');

      const outputPath = join(testOutputDir, 'person-data.ts');
      writeFileSync(outputPath, rendered);
      expect(existsSync(outputPath)).toBe(true);
    });
  });
});