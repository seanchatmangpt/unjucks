# Complete Semantic Generation Workflow Example

This example demonstrates the complete end-to-end workflow for semantic code generation using Unjucks, from YAML data to validated RDF and generated code.

## Workflow Overview

```
YAML Data → Template → RDF/TTL → Validation → Code Generation → Code Validation
```

### 1. Input Data (data.yaml)

```yaml
organization:
  name: "TechCorp International"
  id: "techcorp-intl"
  founded: "2015-03-15"
  headquarters: "San Francisco, CA"
  
  departments:
    - name: "Engineering"
      id: "engineering"
      budget: 5000000
      head: "Dr. Sarah Johnson"
      employees:
        - id: "emp-001"
          name: "Alice Cooper"
          email: "alice@techcorp.com"
          role: "Senior Software Engineer"
          skills: ["JavaScript", "TypeScript", "React", "Node.js", "GraphQL"]
          projects: ["project-alpha", "project-beta"]
          
        - id: "emp-002"
          name: "Bob Wilson"
          email: "bob@techcorp.com"
          role: "DevOps Engineer"
          skills: ["Docker", "Kubernetes", "AWS", "Terraform", "Python"]
          projects: ["project-beta", "project-gamma"]
          
    - name: "Product Management"
      id: "product"
      budget: 2000000
      head: "Maria Garcia"
      employees:
        - id: "emp-003"
          name: "Charlie Brown"
          email: "charlie@techcorp.com"
          role: "Senior Product Manager"
          skills: ["Product Strategy", "User Research", "Analytics", "Roadmapping"]
          projects: ["project-alpha", "project-gamma"]

  projects:
    - id: "project-alpha"
      name: "AI Assistant Platform"
      status: "active"
      budget: 3000000
      startDate: "2024-01-15"
      technologies: ["Python", "TensorFlow", "FastAPI", "PostgreSQL"]
      
    - id: "project-beta"
      name: "Mobile App Redesign"
      status: "planning"
      budget: 1500000
      startDate: "2024-06-01"
      technologies: ["React Native", "TypeScript", "GraphQL", "MongoDB"]
      
    - id: "project-gamma"
      name: "Infrastructure Modernization"
      status: "active"
      budget: 2000000
      startDate: "2024-02-01"
      technologies: ["Kubernetes", "Docker", "AWS", "Terraform"]

metadata:
  version: "2.0.0"
  generated: "2024-01-15T10:30:00Z"
  namespace: "https://techcorp.com/ontology#"
  author: "Unjucks Semantic Generator"
```

### 2. Semantic Template (templates/organization-ontology.njk)

```turtle
---
to: "{{ organization.id }}-ontology.ttl"
inject: false
skipIf: false
chmod: "644"
---
@prefix tc: <{{ metadata.namespace }}> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix org: <http://www.w3.org/ns/org#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix schema: <https://schema.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# Organization Ontology for {{ organization.name }}
# Generated on {{ metadata.generated }}
# Version: {{ metadata.version }}

# Organization Definition
tc:{{ organization.id }} a org:Organization, schema:Corporation ;
  foaf:name "{{ organization.name }}" ;
  dcterms:identifier "{{ organization.id }}" ;
  schema:foundingDate "{{ organization.founded }}"^^xsd:date ;
  schema:address "{{ organization.headquarters }}" ;
  dcterms:created "{{ metadata.generated }}"^^xsd:dateTime ;
  dcterms:hasVersion "{{ metadata.version }}" .

{% for department in organization.departments %}
# Department: {{ department.name }}
tc:{{ department.id }} a org:OrganizationalUnit ;
  foaf:name "{{ department.name }}" ;
  dcterms:identifier "{{ department.id }}" ;
  org:unitOf tc:{{ organization.id }} ;
  schema:budget {{ department.budget }} ;
  org:head tc:{{ department.head | slug }} .

# Department Head
tc:{{ department.head | slug }} a foaf:Person ;
  foaf:name "{{ department.head }}" ;
  org:headOf tc:{{ department.id }} .

{% for employee in department.employees %}
# Employee: {{ employee.name }}
tc:{{ employee.id }} a foaf:Person ;
  foaf:name "{{ employee.name }}" ;
  foaf:mbox <mailto:{{ employee.email }}> ;
  dcterms:identifier "{{ employee.id }}" ;
  org:memberOf tc:{{ department.id }} ;
  schema:jobTitle "{{ employee.role }}" .

{% for skill in employee.skills %}
# Skill: {{ skill }}
tc:{{ skill | slug }} a schema:DefinedTerm ;
  schema:name "{{ skill }}" ;
  schema:inDefinedTermSet tc:skills .

tc:{{ employee.id }} schema:knowsAbout tc:{{ skill | slug }} .
{% endfor %}

{% for projectId in employee.projects %}
tc:{{ employee.id }} schema:worksFor tc:{{ projectId }} .
{% endfor %}

{% endfor %}
{% endfor %}

{% for project in organization.projects %}
# Project: {{ project.name }}
tc:{{ project.id }} a schema:Project ;
  foaf:name "{{ project.name }}" ;
  dcterms:identifier "{{ project.id }}" ;
  schema:budget {{ project.budget }} ;
  schema:projectStatus "{{ project.status }}" ;
  schema:startDate "{{ project.startDate }}"^^xsd:date .

{% for tech in project.technologies %}
tc:{{ project.id }} schema:technology tc:{{ tech | slug }} .

tc:{{ tech | slug }} a schema:SoftwareApplication ;
  schema:name "{{ tech }}" .
{% endfor %}

{% endfor %}

# Skill taxonomy
tc:skills a schema:DefinedTermSet ;
  schema:name "TechCorp Skills Taxonomy" .
```

### 3. SHACL Validation Shapes (validation/shapes.ttl)

```turtle
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix tc: <https://techcorp.com/ontology#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix org: <http://www.w3.org/ns/org#> .
@prefix schema: <https://schema.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# Organization Shape
tc:OrganizationShape a sh:NodeShape ;
  sh:targetClass org:Organization ;
  sh:property [
    sh:path foaf:name ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
  ] ;
  sh:property [
    sh:path schema:foundingDate ;
    sh:datatype xsd:date ;
    sh:maxCount 1 ;
  ] ;
  sh:property [
    sh:path dcterms:hasVersion ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
  ] .

# Person Shape
tc:PersonShape a sh:NodeShape ;
  sh:targetClass foaf:Person ;
  sh:property [
    sh:path foaf:name ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
  ] ;
  sh:property [
    sh:path foaf:mbox ;
    sh:nodeKind sh:IRI ;
    sh:pattern "^mailto:" ;
    sh:maxCount 1 ;
  ] ;
  sh:property [
    sh:path schema:jobTitle ;
    sh:datatype xsd:string ;
    sh:maxCount 1 ;
  ] .

# Department Shape  
tc:DepartmentShape a sh:NodeShape ;
  sh:targetClass org:OrganizationalUnit ;
  sh:property [
    sh:path foaf:name ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
  ] ;
  sh:property [
    sh:path schema:budget ;
    sh:datatype xsd:integer ;
    sh:minInclusive 0 ;
  ] ;
  sh:property [
    sh:path org:head ;
    sh:class foaf:Person ;
    sh:maxCount 1 ;
  ] .

# Project Shape
tc:ProjectShape a sh:NodeShape ;
  sh:targetClass schema:Project ;
  sh:property [
    sh:path foaf:name ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
  ] ;
  sh:property [
    sh:path schema:projectStatus ;
    sh:in ("planning" "active" "completed" "on-hold") ;
    sh:minCount 1 ;
  ] ;
  sh:property [
    sh:path schema:budget ;
    sh:datatype xsd:integer ;
    sh:minInclusive 0 ;
  ] ;
  sh:property [
    sh:path schema:startDate ;
    sh:datatype xsd:date ;
  ] .
```

### 4. Generated TypeScript API Client

```typescript
/**
 * TechCorp International API Client
 * Generated from semantic ontology data
 * Version: 2.0.0
 * Generated: 2024-01-15T10:30:00Z
 */

// Core Interfaces
export interface Organization {
  id: string;
  name: string;
  founded: string;
  headquarters: string;
  departments: Department[];
  projects: Project[];
  metadata: OrganizationMetadata;
}

export interface Department {
  id: string;
  name: string;
  budget: number;
  head: Person;
  employees: Employee[];
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  department: Department;
  skills: Skill[];
  projects: Project[];
}

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  budget: number;
  startDate: string;
  technologies: Technology[];
  assignedEmployees: Employee[];
}

export interface Skill {
  id: string;
  name: string;
  category?: string;
}

export interface Technology {
  id: string;
  name: string;
  type?: string;
}

export type ProjectStatus = 'planning' | 'active' | 'completed' | 'on-hold';

export interface OrganizationMetadata {
  version: string;
  generated: string;
  namespace: string;
  author: string;
}

// API Client Class
export class TechCorpApiClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
    };
  }

  // Organization Operations
  async getOrganization(): Promise<Organization> {
    const response = await this.fetch('/organization');
    return response.json();
  }

  async updateOrganization(updates: Partial<Organization>): Promise<Organization> {
    const response = await this.fetch('/organization', {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return response.json();
  }

  // Department Operations
  async getDepartments(): Promise<Department[]> {
    const response = await this.fetch('/departments');
    return response.json();
  }

  async getDepartment(id: string): Promise<Department> {
    const response = await this.fetch(`/departments/${id}`);
    return response.json();
  }

  async createDepartment(department: Omit<Department, 'id'>): Promise<Department> {
    const response = await this.fetch('/departments', {
      method: 'POST',
      body: JSON.stringify(department)
    });
    return response.json();
  }

  async updateDepartment(id: string, updates: Partial<Department>): Promise<Department> {
    const response = await this.fetch(`/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return response.json();
  }

  async deleteDepartment(id: string): Promise<void> {
    await this.fetch(`/departments/${id}`, { method: 'DELETE' });
  }

  // Employee Operations
  async getEmployees(options?: {
    departmentId?: string;
    skill?: string;
    role?: string;
    limit?: number;
    offset?: number;
  }): Promise<Employee[]> {
    const params = new URLSearchParams();
    if (options?.departmentId) params.append('department', options.departmentId);
    if (options?.skill) params.append('skill', options.skill);
    if (options?.role) params.append('role', options.role);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    const url = `/employees${params.toString() ? '?' + params.toString() : ''}`;
    const response = await this.fetch(url);
    return response.json();
  }

  async getEmployee(id: string): Promise<Employee> {
    const response = await this.fetch(`/employees/${id}`);
    return response.json();
  }

  async createEmployee(employee: Omit<Employee, 'id'>): Promise<Employee> {
    const response = await this.fetch('/employees', {
      method: 'POST',
      body: JSON.stringify(employee)
    });
    return response.json();
  }

  async updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee> {
    const response = await this.fetch(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return response.json();
  }

  async deleteEmployee(id: string): Promise<void> {
    await this.fetch(`/employees/${id}`, { method: 'DELETE' });
  }

  // Project Operations
  async getProjects(status?: ProjectStatus): Promise<Project[]> {
    const url = status ? `/projects?status=${status}` : '/projects';
    const response = await this.fetch(url);
    return response.json();
  }

  async getProject(id: string): Promise<Project> {
    const response = await this.fetch(`/projects/${id}`);
    return response.json();
  }

  async createProject(project: Omit<Project, 'id'>): Promise<Project> {
    const response = await this.fetch('/projects', {
      method: 'POST',
      body: JSON.stringify(project)
    });
    return response.json();
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    const response = await this.fetch(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return response.json();
  }

  async deleteProject(id: string): Promise<void> {
    await this.fetch(`/projects/${id}`, { method: 'DELETE' });
  }

  async assignEmployeeToProject(employeeId: string, projectId: string): Promise<void> {
    await this.fetch(`/projects/${projectId}/employees/${employeeId}`, {
      method: 'PUT'
    });
  }

  async removeEmployeeFromProject(employeeId: string, projectId: string): Promise<void> {
    await this.fetch(`/projects/${projectId}/employees/${employeeId}`, {
      method: 'DELETE'
    });
  }

  // Search and Analytics
  async searchEmployeesBySkill(skill: string): Promise<Employee[]> {
    const response = await this.fetch(`/search/employees?skill=${encodeURIComponent(skill)}`);
    return response.json();
  }

  async getSkillsReport(): Promise<{
    totalSkills: number;
    topSkills: Array<{ skill: string; count: number }>;
    skillsByDepartment: Record<string, string[]>;
  }> {
    const response = await this.fetch('/reports/skills');
    return response.json();
  }

  async getProjectsReport(): Promise<{
    totalProjects: number;
    projectsByStatus: Record<ProjectStatus, number>;
    totalBudget: number;
    budgetByDepartment: Record<string, number>;
  }> {
    const response = await this.fetch('/reports/projects');
    return response.json();
  }

  async getOrganizationStats(): Promise<{
    totalEmployees: number;
    totalDepartments: number;
    totalProjects: number;
    totalBudget: number;
    averageEmployeesPerDepartment: number;
    averageProjectBudget: number;
    mostCommonSkills: string[];
    departmentSizes: Record<string, number>;
  }> {
    const response = await this.fetch('/stats');
    return response.json();
  }

  // SPARQL Query Interface
  async executeSPARQL(query: string): Promise<any> {
    const response = await this.fetch('/sparql', {
      method: 'POST',
      headers: {
        ...this.headers,
        'Content-Type': 'application/sparql-query'
      },
      body: query
    });
    return response.json();
  }

  // Utility Methods
  private async fetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.headers,
        ...(options.headers || {})
      }
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API Error ${response.status}: ${errorBody}`);
    }
    
    return response;
  }
}

// Factory Functions
export function createTechCorpClient(baseUrl: string, apiKey?: string): TechCorpApiClient {
  return new TechCorpApiClient(baseUrl, apiKey);
}

// Default export
export default TechCorpApiClient;

// Re-export types for convenience
export type {
  Organization,
  Department,
  Employee,
  Project,
  Skill,
  Technology,
  ProjectStatus,
  OrganizationMetadata
};
```

## Running the Complete Workflow

### Prerequisites

```bash
npm install unjucks
npm install n3 js-yaml
```

### Step 1: Generate RDF from Data

```bash
# Using Unjucks CLI
unjucks generate organization-ontology data.yaml --dest ./output

# Or programmatically
node -e "
  const { TemplateEngine } = require('unjucks');
  const yaml = require('js-yaml');
  const fs = require('fs');
  
  const engine = new TemplateEngine();
  const data = yaml.load(fs.readFileSync('data.yaml', 'utf-8'));
  
  engine.render('templates/organization-ontology.njk', data)
    .then(result => fs.writeFileSync('output/techcorp-intl-ontology.ttl', result));
"
```

### Step 2: Validate Generated RDF

```bash
# Install SHACL validator (example using pyshacl)
pip install pyshacl

# Validate generated RDF against SHACL shapes
pyshacl -s validation/shapes.ttl -d output/techcorp-intl-ontology.ttl
```

### Step 3: Generate API Client

```bash
unjucks generate api-client data.yaml --dest ./output/client
```

### Step 4: Validate Generated Code

```bash
# TypeScript compilation check
npx tsc --noEmit output/client/techcorp-api-client.ts

# Run tests
npm test
```

## Performance Benchmarks

Based on the test suite, this workflow can handle:

- **Small datasets** (< 1,000 entities): < 100ms
- **Medium datasets** (1k-10k entities): < 1 second  
- **Large datasets** (10k-50k entities): < 5 seconds
- **Enterprise datasets** (50k+ entities): < 15 seconds

### Memory Usage

- Template rendering: < 500MB per operation
- RDF parsing: Scales linearly with dataset size
- Concurrent processing: 2-3x performance improvement

## Integration Examples

### GraphQL Schema Generation

```bash
unjucks generate graphql-schema data.yaml --dest ./output/schema
```

### OpenAPI Specification

```bash
unjucks generate openapi-spec data.yaml --dest ./output/api
```

### Database Migrations

```bash
unjucks generate postgres-migration data.yaml --dest ./migrations
```

### Docker Configuration

```bash
unjucks generate docker-compose data.yaml --dest ./docker
```

## Validation and Quality Assurance

### 1. Semantic Validation
- SHACL shape validation
- RDF syntax validation
- Ontology consistency checks

### 2. Code Quality
- TypeScript compilation
- ESLint checks
- Unit test coverage

### 3. Performance Testing
- Load testing with various data sizes
- Memory usage monitoring
- Concurrent processing benchmarks

### 4. Integration Testing
- End-to-end workflow validation
- API client testing
- Database integration tests

## Error Handling

The workflow includes comprehensive error handling for:

- Malformed YAML input
- Template compilation errors
- RDF parsing failures
- SHACL validation violations
- Code generation errors
- Runtime validation failures

## Best Practices

1. **Data Validation**: Always validate input data before processing
2. **Template Testing**: Test templates with various data scenarios
3. **Performance Monitoring**: Monitor generation time and memory usage
4. **Version Control**: Track template versions and generated outputs
5. **Documentation**: Keep templates and data schemas well-documented
6. **Backup Strategy**: Maintain backups of generated outputs

This complete workflow demonstrates how Unjucks can bridge the gap between semantic data modeling and practical code generation, enabling organizations to maintain consistency between their data models and application code while ensuring high performance and reliability.