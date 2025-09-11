/**
 * Sample Test Data for KGEN Testing
 * Provides consistent, reusable test data fixtures
 */

export const samplePersons = {
  johnDoe: {
    id: 'person:john_doe',
    type: 'Person',
    properties: {
      name: 'John Doe',
      age: 30,
      email: 'john.doe@example.com',
      department: 'Engineering',
      skills: ['JavaScript', 'Python', 'RDF'],
      startDate: '2020-01-15'
    }
  },
  
  janeSmith: {
    id: 'person:jane_smith',
    type: 'Person',
    properties: {
      name: 'Jane Smith',
      age: 28,
      email: 'jane.smith@example.com',
      department: 'Data Science',
      skills: ['Python', 'R', 'Machine Learning'],
      startDate: '2021-03-10'
    }
  },
  
  bobJohnson: {
    id: 'person:bob_johnson',
    type: 'Person',
    properties: {
      name: 'Bob Johnson',
      age: 35,
      email: 'bob.johnson@example.com',
      department: 'Management',
      skills: ['Leadership', 'Strategy', 'Project Management'],
      startDate: '2018-07-20'
    }
  }
};

export const sampleOrganizations = {
  acmeCorp: {
    id: 'org:acme_corp',
    type: 'Organization',
    properties: {
      name: 'ACME Corporation',
      industry: 'Technology',
      foundedYear: 2010,
      headquarters: 'San Francisco, CA',
      employees: 500,
      revenue: 50000000
    }
  },
  
  techInnovators: {
    id: 'org:tech_innovators',
    type: 'Organization',
    properties: {
      name: 'Tech Innovators Inc',
      industry: 'Software',
      foundedYear: 2015,
      headquarters: 'Austin, TX',
      employees: 200,
      revenue: 20000000
    }
  }
};

export const sampleProjects = {
  knowledgeGraph: {
    id: 'project:knowledge_graph',
    type: 'Project',
    properties: {
      name: 'Knowledge Graph Platform',
      status: 'active',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      budget: 1000000,
      priority: 'high',
      phase: 'development'
    }
  },
  
  aiAssistant: {
    id: 'project:ai_assistant',
    type: 'Project',
    properties: {
      name: 'AI Assistant System',
      status: 'planning',
      startDate: '2024-06-01',
      endDate: '2025-05-31',
      budget: 2000000,
      priority: 'medium',
      phase: 'design'
    }
  }
};

export const sampleRelationships = [
  {
    subject: 'person:john_doe',
    predicate: 'worksFor',
    object: 'org:acme_corp',
    context: 'employment'
  },
  {
    subject: 'person:jane_smith',
    predicate: 'worksFor',
    object: 'org:acme_corp',
    context: 'employment'
  },
  {
    subject: 'person:bob_johnson',
    predicate: 'worksFor',
    object: 'org:acme_corp',
    context: 'employment'
  },
  {
    subject: 'person:john_doe',
    predicate: 'participatesIn',
    object: 'project:knowledge_graph',
    context: 'project_assignment'
  },
  {
    subject: 'person:jane_smith',
    predicate: 'participatesIn',
    object: 'project:knowledge_graph',
    context: 'project_assignment'
  },
  {
    subject: 'person:bob_johnson',
    predicate: 'manages',
    object: 'project:knowledge_graph',
    context: 'project_management'
  },
  {
    subject: 'project:knowledge_graph',
    predicate: 'belongsTo',
    object: 'org:acme_corp',
    context: 'ownership'
  }
];

export const sampleRDFTurtle = `
@prefix ex: <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

# Persons
ex:john_doe a ex:Person, foaf:Person ;
    foaf:name "John Doe" ;
    ex:hasAge "30"^^xsd:integer ;
    foaf:mbox <mailto:john.doe@example.com> ;
    ex:hasDepartment "Engineering" ;
    ex:hasSkill "JavaScript", "Python", "RDF" ;
    ex:startDate "2020-01-15"^^xsd:date ;
    ex:worksFor ex:acme_corp ;
    ex:participatesIn ex:knowledge_graph .

ex:jane_smith a ex:Person, foaf:Person ;
    foaf:name "Jane Smith" ;
    ex:hasAge "28"^^xsd:integer ;
    foaf:mbox <mailto:jane.smith@example.com> ;
    ex:hasDepartment "Data Science" ;
    ex:hasSkill "Python", "R", "Machine Learning" ;
    ex:startDate "2021-03-10"^^xsd:date ;
    ex:worksFor ex:acme_corp ;
    ex:participatesIn ex:knowledge_graph .

ex:bob_johnson a ex:Person, foaf:Person ;
    foaf:name "Bob Johnson" ;
    ex:hasAge "35"^^xsd:integer ;
    foaf:mbox <mailto:bob.johnson@example.com> ;
    ex:hasDepartment "Management" ;
    ex:hasSkill "Leadership", "Strategy", "Project Management" ;
    ex:startDate "2018-07-20"^^xsd:date ;
    ex:worksFor ex:acme_corp ;
    ex:manages ex:knowledge_graph .

# Organizations
ex:acme_corp a ex:Organization ;
    ex:hasName "ACME Corporation" ;
    ex:hasIndustry "Technology" ;
    ex:foundedYear "2010"^^xsd:integer ;
    ex:hasHeadquarters "San Francisco, CA" ;
    ex:hasEmployeeCount "500"^^xsd:integer ;
    ex:hasRevenue "50000000"^^xsd:decimal .

# Projects
ex:knowledge_graph a ex:Project ;
    ex:hasName "Knowledge Graph Platform" ;
    ex:hasStatus "active" ;
    ex:startDate "2024-01-01"^^xsd:date ;
    ex:endDate "2024-12-31"^^xsd:date ;
    ex:hasBudget "1000000"^^xsd:decimal ;
    ex:hasPriority "high" ;
    ex:hasPhase "development" ;
    ex:belongsTo ex:acme_corp .
`;

export const sampleSHACLShapes = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

# Person Shape
ex:PersonShape a sh:NodeShape ;
    sh:targetClass ex:Person ;
    sh:property [
        sh:path foaf:name ;
        sh:datatype xsd:string ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:minLength 2 ;
        sh:maxLength 100 ;
    ] ;
    sh:property [
        sh:path ex:hasAge ;
        sh:datatype xsd:integer ;
        sh:minCount 0 ;
        sh:maxCount 1 ;
        sh:minInclusive 0 ;
        sh:maxInclusive 150 ;
    ] ;
    sh:property [
        sh:path foaf:mbox ;
        sh:nodeKind sh:IRI ;
        sh:minCount 0 ;
        sh:maxCount 1 ;
        sh:pattern "^mailto:[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$" ;
    ] ;
    sh:property [
        sh:path ex:hasDepartment ;
        sh:datatype xsd:string ;
        sh:in ( "Engineering" "Data Science" "Management" "Sales" "Marketing" "HR" ) ;
    ] .

# Organization Shape
ex:OrganizationShape a sh:NodeShape ;
    sh:targetClass ex:Organization ;
    sh:property [
        sh:path ex:hasName ;
        sh:datatype xsd:string ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:minLength 1 ;
        sh:maxLength 200 ;
    ] ;
    sh:property [
        sh:path ex:hasIndustry ;
        sh:datatype xsd:string ;
        sh:in ( "Technology" "Healthcare" "Finance" "Education" "Manufacturing" "Retail" ) ;
    ] ;
    sh:property [
        sh:path ex:foundedYear ;
        sh:datatype xsd:integer ;
        sh:minInclusive 1800 ;
        sh:maxInclusive 2024 ;
    ] ;
    sh:property [
        sh:path ex:hasEmployeeCount ;
        sh:datatype xsd:integer ;
        sh:minInclusive 1 ;
    ] .

# Project Shape
ex:ProjectShape a sh:NodeShape ;
    sh:targetClass ex:Project ;
    sh:property [
        sh:path ex:hasName ;
        sh:datatype xsd:string ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path ex:hasStatus ;
        sh:datatype xsd:string ;
        sh:in ( "planning" "active" "on-hold" "completed" "cancelled" ) ;
    ] ;
    sh:property [
        sh:path ex:startDate ;
        sh:datatype xsd:date ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path ex:hasBudget ;
        sh:datatype xsd:decimal ;
        sh:minInclusive 0 ;
    ] .
`;

export const sampleSPARQLQueries = {
  getAllPersons: `
    PREFIX ex: <http://example.org/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    
    SELECT ?person ?name ?department WHERE {
      ?person a ex:Person .
      ?person foaf:name ?name .
      ?person ex:hasDepartment ?department .
    }
    ORDER BY ?name
  `,
  
  getPersonsByDepartment: `
    PREFIX ex: <http://example.org/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    
    SELECT ?person ?name WHERE {
      ?person a ex:Person .
      ?person foaf:name ?name .
      ?person ex:hasDepartment "Engineering" .
    }
  `,
  
  getProjectParticipants: `
    PREFIX ex: <http://example.org/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    
    SELECT ?project ?projectName ?person ?personName WHERE {
      ?project a ex:Project .
      ?project ex:hasName ?projectName .
      ?person ex:participatesIn ?project .
      ?person foaf:name ?personName .
    }
  `,
  
  getOrganizationalHierarchy: `
    PREFIX ex: <http://example.org/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    
    SELECT ?manager ?managerName ?subordinate ?subordinateName WHERE {
      ?manager ex:manages ?project .
      ?manager foaf:name ?managerName .
      ?subordinate ex:participatesIn ?project .
      ?subordinate foaf:name ?subordinateName .
      FILTER (?manager != ?subordinate)
    }
  `,
  
  getSkillsAnalysis: `
    PREFIX ex: <http://example.org/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    
    SELECT ?skill (COUNT(?person) as ?count) WHERE {
      ?person a ex:Person .
      ?person ex:hasSkill ?skill .
    }
    GROUP BY ?skill
    ORDER BY DESC(?count)
  `
};

export const sampleReasoningRules = [
  {
    name: 'employee-classification',
    description: 'If a person works for an organization, they are an employee',
    condition: '?person ex:worksFor ?org',
    conclusion: '?person a ex:Employee'
  },
  {
    name: 'manager-classification',
    description: 'If a person manages a project, they are a manager',
    condition: '?person ex:manages ?project',
    conclusion: '?person a ex:Manager'
  },
  {
    name: 'senior-employee-classification',
    description: 'If an employee is also a manager, they are a senior employee',
    condition: '?person a ex:Employee . ?person a ex:Manager',
    conclusion: '?person a ex:SeniorEmployee'
  },
  {
    name: 'project-team-membership',
    description: 'If a person participates in a project and the project belongs to an org, the person is a team member',
    condition: '?person ex:participatesIn ?project . ?project ex:belongsTo ?org',
    conclusion: '?person ex:isMemberOf ?org'
  },
  {
    name: 'technical-expert-classification',
    description: 'If a person has technical skills and works in engineering, they are a technical expert',
    condition: '?person ex:hasSkill ?skill . ?person ex:hasDepartment "Engineering" . FILTER(regex(?skill, "(JavaScript|Python|RDF|Machine Learning)"))',
    conclusion: '?person a ex:TechnicalExpert'
  }
];

export const sampleTemplates = {
  personClass: `
/**
 * {{ entity.type }} class generated from knowledge graph
 * Generated at: {{ metadata.generatedAt }}
 */
class {{ entity.name | capitalize | replace(' ', '') }} {
  constructor(data = {}) {
    {% for property, value in entity.properties %}
    this.{{ property }} = data.{{ property }} || {{ value | jsonEncode }};
    {% endfor %}
    this.id = data.id || '{{ entity.id }}';
  }
  
  // Getters
  {% for property in entity.properties %}
  get{{ property | capitalize }}() {
    return this.{{ property }};
  }
  
  {% endfor %}
  
  // Setters
  {% for property in entity.properties %}
  set{{ property | capitalize }}(value) {
    this.{{ property }} = value;
    return this;
  }
  
  {% endfor %}
  
  // Validation
  validate() {
    const errors = [];
    
    {% if entity.properties.name %}
    if (!this.name || this.name.length < 2) {
      errors.push('Name must be at least 2 characters long');
    }
    {% endif %}
    
    {% if entity.properties.email %}
    if (this.email && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(this.email)) {
      errors.push('Invalid email format');
    }
    {% endif %}
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  // Serialization
  toJSON() {
    return {
      id: this.id,
      type: '{{ entity.type }}',
      {% for property in entity.properties %}
      {{ property }}: this.{{ property }},
      {% endfor %}
    };
  }
  
  toString() {
    return \`{{ entity.type }}: \${this.name || this.id}\`;
  }
}

module.exports = {{ entity.name | capitalize | replace(' ', '') }};
  `,
  
  apiController: `
/**
 * {{ entity.type }} API Controller
 * Generated from knowledge graph schema
 */
const express = require('express');
const router = express.Router();
const {{ entity.name | capitalize | replace(' ', '') }} = require('../models/{{ entity.name | lower | replace(' ', '-') }}');

// GET /api/{{ entity.name | lower | pluralize }}
router.get('/', async (req, res) => {
  try {
    const items = await {{ entity.name | capitalize | replace(' ', '') }}.findAll(req.query);
    res.json({
      success: true,
      data: items,
      count: items.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/{{ entity.name | lower | pluralize }}/:id
router.get('/:id', async (req, res) => {
  try {
    const item = await {{ entity.name | capitalize | replace(' ', '') }}.findById(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Not found'
      });
    }
    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/{{ entity.name | lower | pluralize }}
router.post('/', async (req, res) => {
  try {
    const {{ entity.name | lower }} = new {{ entity.name | capitalize | replace(' ', '') }}(req.body);
    
    const validation = {{ entity.name | lower }}.validate();
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }
    
    const savedItem = await {{ entity.name | lower }}.save();
    res.status(201).json({
      success: true,
      data: savedItem
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
  `,
  
  testSuite: `
/**
 * {{ entity.type }} Test Suite
 * Generated from knowledge graph
 */
const {{ entity.name | capitalize | replace(' ', '') }} = require('../src/{{ entity.name | lower | replace(' ', '-') }}');

describe('{{ entity.name | capitalize | replace(' ', '') }}', () => {
  let {{ entity.name | lower | replace(' ', '') }};

  beforeEach(() => {
    {{ entity.name | lower | replace(' ', '') }} = new {{ entity.name | capitalize | replace(' ', '') }}({
      {% for property, value in entity.properties %}
      {{ property }}: {{ value | jsonEncode }},
      {% endfor %}
    });
  });

  describe('Constructor', () => {
    it('should create instance with default values', () => {
      const instance = new {{ entity.name | capitalize | replace(' ', '') }}();
      expect(instance).toBeInstanceOf({{ entity.name | capitalize | replace(' ', '') }});
    });

    it('should create instance with provided data', () => {
      {% for property, value in entity.properties %}
      expect({{ entity.name | lower | replace(' ', '') }}.{{ property }}).toBe({{ value | jsonEncode }});
      {% endfor %}
    });
  });

  describe('Getters', () => {
    {% for property in entity.properties %}
    it('should get {{ property }}', () => {
      expect({{ entity.name | lower | replace(' ', '') }}.get{{ property | capitalize }}()).toBe({{ entity.name | lower | replace(' ', '') }}.{{ property }});
    });

    {% endfor %}
  });

  describe('Setters', () => {
    {% for property in entity.properties %}
    it('should set {{ property }}', () => {
      const newValue = 'new_{{ property }}_value';
      const result = {{ entity.name | lower | replace(' ', '') }}.set{{ property | capitalize }}(newValue);
      
      expect({{ entity.name | lower | replace(' ', '') }}.{{ property }}).toBe(newValue);
      expect(result).toBe({{ entity.name | lower | replace(' ', '') }}); // Fluent interface
    });

    {% endfor %}
  });

  describe('Validation', () => {
    it('should validate valid data', () => {
      const validation = {{ entity.name | lower | replace(' ', '') }}.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    {% if entity.properties.name %}
    it('should reject invalid name', () => {
      {{ entity.name | lower | replace(' ', '') }}.setName('a'); // Too short
      const validation = {{ entity.name | lower | replace(' ', '') }}.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Name must be at least 2 characters long');
    });
    {% endif %}

    {% if entity.properties.email %}
    it('should reject invalid email', () => {
      {{ entity.name | lower | replace(' ', '') }}.setEmail('invalid-email');
      const validation = {{ entity.name | lower | replace(' ', '') }}.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Invalid email format');
    });
    {% endif %}
  });

  describe('Serialization', () => {
    it('should serialize to JSON', () => {
      const json = {{ entity.name | lower | replace(' ', '') }}.toJSON();
      
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('type', '{{ entity.type }}');
      {% for property in entity.properties %}
      expect(json).toHaveProperty('{{ property }}');
      {% endfor %}
    });

    it('should have string representation', () => {
      const str = {{ entity.name | lower | replace(' ', '') }}.toString();
      expect(str).toBe('{{ entity.type }}: {{ entity.properties.name || entity.id }}');
    });
  });
});
  `
};

export const performanceTestData = {
  smallDataset: {
    entities: 10,
    relationships: 20,
    expectedProcessingTime: 1000 // ms
  },
  
  mediumDataset: {
    entities: 100,
    relationships: 200,
    expectedProcessingTime: 5000 // ms
  },
  
  largeDataset: {
    entities: 1000,
    relationships: 2000,
    expectedProcessingTime: 30000 // ms
  }
};

export const complianceTestData = {
  gdprScenarios: [
    {
      name: 'Personal Data Processing',
      dataSubjectId: 'gdpr-subject-001',
      legalBasis: 'consent',
      processingPurpose: 'knowledge_graph_generation',
      dataCategories: ['personal', 'contact'],
      retentionPeriod: '6years'
    },
    {
      name: 'Right to Erasure',
      dataSubjectId: 'gdpr-subject-002',
      action: 'erasure',
      reason: 'consent_withdrawn'
    },
    {
      name: 'Data Portability',
      dataSubjectId: 'gdpr-subject-003',
      action: 'export',
      format: 'json'
    }
  ],
  
  soxScenarios: [
    {
      name: 'Financial Data Processing',
      dataType: 'financial',
      auditTrailRequired: true,
      approvalRequired: true,
      retentionPeriod: '7years'
    }
  ],
  
  hipaaScenarios: [
    {
      name: 'Healthcare Information',
      dataType: 'phi',
      encryptionRequired: true,
      accessLogging: true,
      retentionPeriod: '6years'
    }
  ]
};