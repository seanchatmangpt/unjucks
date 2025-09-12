// Mock data and factories for spec-driven testing

export class MockDataFactory {
  static createSpecification(overrides = {}) {
    return {
      id: `spec-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substr(2, 9)}`,
      name: 'MockSpecification',
      description: 'A mock specification for testing purposes',
      type: 'feature',
      priority: 'medium',
      complexity: 'medium',
      version: 1,
      createdAt: this.getDeterministicDate().toISOString(),
      acceptance: [
        'System should meet functional requirements',
        'System should handle edge cases properly',
        'System should provide appropriate user feedback'
      ],
      ...overrides
    };
  }

  static createPlan(specification, overrides = {}) {
    return {
      id: `plan-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substr(2, 9)}`,
      specificationId: specification.id,
      name: `Plan for ${specification.name}`,
      template: 'default',
      phases: [
        {
          id: 'phase-1',
          name: 'analysis',
          description: 'Requirements analysis',
          estimatedDays: 2,
          dependencies: [],
          resources: { analysts: 1 }
        },
        {
          id: 'phase-2',
          name: 'design',
          description: 'System design',
          estimatedDays: 3,
          dependencies: ['analysis'],
          resources: { architects: 1, designers: 1 }
        },
        {
          id: 'phase-3',
          name: 'implementation',
          description: 'Development',
          estimatedDays: 10,
          dependencies: ['design'],
          resources: { developers: 2 }
        },
        {
          id: 'phase-4',
          name: 'testing',
          description: 'Testing and validation',
          estimatedDays: 5,
          dependencies: ['implementation'],
          resources: { testers: 1, developers: 0.5 }
        },
        {
          id: 'phase-5',
          name: 'deployment',
          description: 'Release preparation',
          estimatedDays: 2,
          dependencies: ['testing'],
          resources: { devops: 1 }
        }
      ],
      totalEstimatedDays: 22,
      createdAt: this.getDeterministicDate().toISOString(),
      status: 'draft',
      ...overrides
    };
  }

  static createTasks(specification, count = 5, overrides = {}) {
    const taskTypes = [
      { category: 'backend', type: 'API endpoint', hours: 8 },
      { category: 'frontend', type: 'UI component', hours: 6 },
      { category: 'backend', type: 'Database schema', hours: 4 },
      { category: 'testing', type: 'Unit tests', hours: 5 },
      { category: 'testing', type: 'Integration tests', hours: 7 },
      { category: 'frontend', type: 'State management', hours: 4 },
      { category: 'backend', type: 'Business logic', hours: 9 },
      { category: 'documentation', type: 'API documentation', hours: 3 }
    ];

    return Array.from({ length: count }, (_, index) => {
      const taskType = taskTypes[index % taskTypes.length];
      return {
        id: `task-${specification.id}-${index + 1}`,
        specificationId: specification.id,
        name: `${taskType.type} for ${specification.name}`,
        description: `Implement ${taskType.type.toLowerCase()} for ${specification.name}`,
        category: taskType.category,
        task_type: taskType.type,
        estimated_hours: taskType.hours,
        priority: index < 2 ? 'high' : index < 4 ? 'medium' : 'low',
        status: 'pending',
        createdAt: this.getDeterministicDate().toISOString(),
        acceptanceCriteria: [
          `${taskType.type} meets functional requirements`,
          `${taskType.type} passes all tests`,
          'Code is reviewed and approved'
        ],
        ...overrides
      };
    });
  }

  static createWorkflow(requirement, overrides = {}) {
    return {
      id: `workflow-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substr(2, 9)}`,
      requirement,
      type: 'complete',
      status: 'running',
      startTime: this.getDeterministicDate().toISOString(),
      phases: [],
      currentPhase: 0,
      deliverables: {},
      metrics: {},
      stakeholders: ['product-manager', 'tech-lead'],
      notifications: [],
      ...overrides
    };
  }

  static createTeamMembers() {
    return [
      {
        id: 'dev-001',
        name: 'Alice Chen',
        role: 'Senior Backend Developer',
        skills: ['backend', 'database', 'api', 'python', 'node.js'],
        maxCapacity: 40,
        currentCapacity: 25,
        preferences: ['backend', 'architecture', 'performance'],
        seniority: 'senior',
        hourlyRate: 85
      },
      {
        id: 'dev-002',
        name: 'Bob Martinez',
        role: 'Frontend Developer',
        skills: ['frontend', 'react', 'typescript', 'css', 'testing'],
        maxCapacity: 40,
        currentCapacity: 32,
        preferences: ['frontend', 'ui', 'accessibility'],
        seniority: 'mid',
        hourlyRate: 70
      },
      {
        id: 'dev-003',
        name: 'Carol Johnson',
        role: 'Full Stack Developer',
        skills: ['backend', 'frontend', 'testing', 'devops', 'javascript'],
        maxCapacity: 40,
        currentCapacity: 20,
        preferences: ['full-stack', 'testing', 'integration'],
        seniority: 'senior',
        hourlyRate: 80
      },
      {
        id: 'qa-001',
        name: 'David Kim',
        role: 'QA Engineer',
        skills: ['testing', 'automation', 'performance', 'security'],
        maxCapacity: 40,
        currentCapacity: 15,
        preferences: ['automation', 'performance', 'api-testing'],
        seniority: 'mid',
        hourlyRate: 65
      },
      {
        id: 'devops-001',
        name: 'Emma Wilson',
        role: 'DevOps Engineer',
        skills: ['devops', 'cloud', 'docker', 'kubernetes', 'monitoring'],
        maxCapacity: 40,
        currentCapacity: 30,
        preferences: ['infrastructure', 'automation', 'monitoring'],
        seniority: 'senior',
        hourlyRate: 90
      }
    ];
  }

  static createQualityGates() {
    return [
      {
        phase: 'specification',
        name: 'Requirements Review',
        criteria: [
          { name: 'Requirements completeness', weight: 0.4 },
          { name: 'Requirements clarity', weight: 0.3 },
          { name: 'Stakeholder approval', weight: 0.3 }
        ],
        threshold: 0.8
      },
      {
        phase: 'design',
        name: 'Architecture Review',
        criteria: [
          { name: 'Design completeness', weight: 0.3 },
          { name: 'Scalability assessment', weight: 0.3 },
          { name: 'Security review', weight: 0.4 }
        ],
        threshold: 0.85
      },
      {
        phase: 'implementation',
        name: 'Code Quality Gate',
        criteria: [
          { name: 'Code review passed', weight: 0.4 },
          { name: 'Test coverage', weight: 0.3 },
          { name: 'Static analysis', weight: 0.3 }
        ],
        threshold: 0.9
      },
      {
        phase: 'testing',
        name: 'Quality Assurance Gate',
        criteria: [
          { name: 'All tests passing', weight: 0.5 },
          { name: 'Performance benchmarks', weight: 0.3 },
          { name: 'Security scan', weight: 0.2 }
        ],
        threshold: 0.95
      },
      {
        phase: 'deployment',
        name: 'Production Readiness',
        criteria: [
          { name: 'Deployment checklist', weight: 0.3 },
          { name: 'Monitoring setup', weight: 0.3 },
          { name: 'Documentation complete', weight: 0.4 }
        ],
        threshold: 0.9
      }
    ];
  }

  static createPerformanceMetrics() {
    return {
      velocity: {
        storyPointsPerSprint: this.randomBetween(25, 45),
        tasksCompletedPerDay: this.randomBetween(3, 8),
        cycleTime: this.randomBetween(2, 6),
        leadTime: this.randomBetween(5, 12),
        throughput: this.randomBetween(20, 35)
      },
      quality: {
        defectDensity: this.randomBetween(0.01, 0.08),
        testCoverage: this.randomBetween(0.85, 0.98),
        codeReviewCoverage: this.randomBetween(0.90, 1.0),
        technicalDebtRatio: this.randomBetween(0.05, 0.15),
        bugEscapeRate: this.randomBetween(0.02, 0.10)
      },
      efficiency: {
        cycleTimeVariability: this.randomBetween(0.8, 0.95),
        waitTimeRatio: this.randomBetween(0.1, 0.25),
        reworkPercentage: this.randomBetween(0.05, 0.15),
        resourceUtilization: this.randomBetween(0.75, 0.95),
        automationCoverage: this.randomBetween(0.60, 0.90)
      },
      predictability: {
        estimationAccuracy: this.randomBetween(0.75, 0.95),
        deliveryPredictability: this.randomBetween(0.80, 0.95),
        scopeCreep: this.randomBetween(0.05, 0.20),
        plannedVsActual: this.randomBetween(0.70, 0.90),
        commitmentReliability: this.randomBetween(0.80, 0.95)
      },
      satisfaction: {
        teamSatisfaction: this.randomBetween(3.5, 4.8),
        stakeholderSatisfaction: this.randomBetween(3.0, 4.5),
        customerSatisfaction: this.randomBetween(3.2, 4.6),
        processImprovement: this.randomBetween(3.0, 4.2),
        workLifeBalance: this.randomBetween(3.5, 4.5)
      }
    };
  }

  static createCodeGenerationFiles(specification) {
    return [
      {
        path: `src/services/${specification.name}.js`,
        content: this.generateServiceClass(specification),
        type: 'service_class'
      },
      {
        path: `src/types/${specification.name}.js`,
        content: this.generateTypeDefinitions(specification),
        type: 'interface'
      },
      {
        path: `tests/services/${specification.name}.test.js`,
        content: this.generateTestFile(specification),
        type: 'test_file'
      },
      {
        path: `src/routes/${specification.name.toLowerCase()}.js`,
        content: this.generateRouteFile(specification),
        type: 'api_routes'
      },
      {
        path: `docs/api/${specification.name.toLowerCase()}.md`,
        content: this.generateApiDocumentation(specification),
        type: 'documentation'
      }
    ];
  }

  static generateServiceClass(specification) {
    return `class ${specification.name} {
  constructor() {
    this.name = '${specification.name}';
    this.description = '${specification.description}';
  }

  // TODO: Implement service methods based on acceptance criteria
  ${specification.acceptance ? specification.acceptance.map(criterion => 
    `// - ${criterion}`
  ).join('\n  ') : ''}

  async initialize() {
    // Initialize service
    return Promise.resolve();
  }

  async validate(data) {
    // Validate input data
    return { valid: true, errors: [] };
  }
}

module.exports = ${specification.name};`;
  }

  static generateTypeDefinitions(specification) {
    return `// Type definitions for ${specification.name}

/**
 * ${specification.description}
 */
const ${specification.name}Types = {
  // TODO: Define types based on specification
};

module.exports = ${specification.name}Types;`;
  }

  static generateTestFile(specification) {
    return `const { describe, it, expect, beforeEach } = require('vitest');
const ${specification.name} = require('../src/services/${specification.name}');

describe('${specification.name}', () => {
  let service;

  beforeEach(() => {
    service = new ${specification.name}();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(service.name).toBe('${specification.name}');
  });

  ${specification.acceptance ? specification.acceptance.map(criterion => 
    `it('should ${criterion.toLowerCase()}', async () => {
    // TODO: Test ${criterion}
    expect(true).toBe(true);
  });`
  ).join('\n\n  ') : ''}
});`;
  }

  static generateRouteFile(specification) {
    const routeName = specification.name.toLowerCase();
    return `const express = require('express');
const ${specification.name} = require('../services/${specification.name}');

const router = express.Router();
const service = new ${specification.name}();

// Routes for ${specification.name}
router.get('/${routeName}', async (req, res) => {
  try {
    // TODO: Implement GET /${routeName}
    res.json({ message: 'Not implemented yet' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/${routeName}', async (req, res) => {
  try {
    // TODO: Implement POST /${routeName}
    res.json({ message: 'Not implemented yet' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;`;
  }

  static generateApiDocumentation(specification) {
    return `# ${specification.name} API

${specification.description}

## Endpoints

### GET /${specification.name.toLowerCase()}
Get all ${specification.name.toLowerCase()} items.

### POST /${specification.name.toLowerCase()}
Create a new ${specification.name.toLowerCase()} item.

## Acceptance Criteria

${specification.acceptance ? specification.acceptance.map(criterion => 
  `- ${criterion}`
).join('\n') : 'No acceptance criteria defined.'}

## Implementation Status

- [ ] Service class implementation
- [ ] API endpoints
- [ ] Unit tests
- [ ] Integration tests
- [ ] Documentation`;
  }

  static createComplianceArtifacts() {
    return {
      gdpr: {
        compliant: true,
        dataProcessingActivities: [
          'User registration data',
          'Session management',
          'Analytics data'
        ],
        dataRetentionPolicies: {
          userData: '7 years',
          sessionData: '30 days',
          analyticsData: '2 years'
        },
        consentManagement: true,
        dataPortability: true,
        rightToErasure: true
      },
      security: {
        compliant: true,
        scanResults: {
          critical: 0,
          high: 1,
          medium: 3,
          low: 7
        },
        authenticationMethods: ['JWT', 'OAuth2'],
        encryptionStandards: ['AES-256', 'TLS 1.3'],
        vulnerabilityAssessment: 'Passed'
      },
      accessibility: {
        compliant: true,
        wcagLevel: 'AA',
        testResults: {
          automated: 'Passed',
          manual: 'Passed',
          userTesting: 'Passed'
        },
        issues: []
      }
    };
  }

  static createBackupPoints() {
    return [
      {
        id: 'backup-spec-001',
        stage: 'specification',
        type: 'version_control',
        timestamp: this.getDeterministicDate().toISOString(),
        size: '1.2MB',
        description: 'Specification backup before changes'
      },
      {
        id: 'backup-code-001',
        stage: 'code_generation',
        type: 'state_snapshot',
        timestamp: this.getDeterministicDate().toISOString(),
        size: '45MB',
        description: 'Code generation state backup'
      },
      {
        id: 'backup-deploy-001',
        stage: 'deployment',
        type: 'automated_rollback',
        timestamp: this.getDeterministicDate().toISOString(),
        size: '120MB',
        description: 'Deployment rollback point'
      },
      {
        id: 'backup-data-001',
        stage: 'data_migration',
        type: 'database_backup',
        timestamp: this.getDeterministicDate().toISOString(),
        size: '2.1GB',
        description: 'Database backup before migration'
      }
    ];
  }

  // Utility methods
  static randomBetween(min, max, decimals = 2) {
    const value = Math.random() * (max - min) + min;
    return decimals > 0 ? Number(value.toFixed(decimals)) : Math.floor(value);
  }

  static randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  static randomBoolean(trueWeight = 0.5) {
    return Math.random() < trueWeight;
  }

  static generateId(prefix = 'mock') {
    return `${prefix}-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static createTimestamp(offsetDays = 0) {
    const date = this.getDeterministicDate();
    date.setDate(date.getDate() + offsetDays);
    return date.toISOString();
  }
}

// Export commonly used mock data sets
export const mockSpecifications = [
  MockDataFactory.createSpecification({
    name: 'UserAuthentication',
    description: 'User authentication and session management',
    priority: 'high'
  }),
  MockDataFactory.createSpecification({
    name: 'PaymentProcessing',
    description: 'Secure payment processing system',
    priority: 'critical',
    complexity: 'high'
  }),
  MockDataFactory.createSpecification({
    name: 'NotificationSystem',
    description: 'Multi-channel notification delivery',
    priority: 'medium'
  })
];

export const mockTeamMembers = MockDataFactory.createTeamMembers();
export const mockQualityGates = MockDataFactory.createQualityGates();
export const mockPerformanceMetrics = MockDataFactory.createPerformanceMetrics();

export default MockDataFactory;