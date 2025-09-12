/**
 * Test Data Factory - Comprehensive test data management system
 */

import { faker } from '@faker-js/faker';
import fs from 'fs-extra';
import path from 'path';
import { randomUUID } from 'crypto';

/**
 * Base Factory class for creating test data
 */
class BaseFactory {
  constructor(model = {}) {
    this.model = model;
    this.sequences = new Map();
  }

  /**
   * Generate a sequence number
   */
  sequence(name) {
    const current = this.sequences.get(name) || 0;
    const next = current + 1;
    this.sequences.set(name, next);
    return next;
  }

  /**
   * Generate multiple instances
   */
  createMany(count, overrides = {}) {
    return Array.from({ length: count }, (_, index) => 
      this.create({ ...overrides, _index: index })
    );
  }

  /**
   * Create with associations
   */
  createWithAssociations(associations = {}) {
    const data = this.create();
    return { ...data, ...associations };
  }

  /**
   * Abstract create method
   */
  create(overrides = {}) {
    throw new Error('Create method must be implemented by subclass');
  }
}

/**
 * User Factory
 */
export class UserFactory extends BaseFactory {
  create(overrides = {}) {
    const userId = this.sequence('user');
    return {
      id: overrides.id || userId,
      uuid: overrides.uuid || randomUUID(),
      email: overrides.email || faker.internet.email(),
      firstName: overrides.firstName || faker.person.firstName(),
      lastName: overrides.lastName || faker.person.lastName(),
      username: overrides.username || faker.internet.userName(),
      avatar: overrides.avatar || faker.image.avatar(),
      birthDate: overrides.birthDate || faker.date.birthdate(),
      phone: overrides.phone || faker.phone.number(),
      address: overrides.address || {
        street: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        zipCode: faker.location.zipCode(),
        country: faker.location.country()
      },
      preferences: overrides.preferences || {
        theme: faker.helpers.arrayElement(['light', 'dark']),
        language: faker.helpers.arrayElement(['en', 'es', 'fr', 'de']),
        notifications: faker.datatype.boolean()
      },
      metadata: overrides.metadata || {
        loginCount: faker.number.int({ min: 0, max: 100 }),
        lastLogin: faker.date.recent(),
        ipAddress: faker.internet.ip(),
        userAgent: faker.internet.userAgent()
      },
      createdAt: overrides.createdAt || faker.date.past(),
      updatedAt: overrides.updatedAt || faker.date.recent(),
      isActive: overrides.isActive !== undefined ? overrides.isActive : true,
      role: overrides.role || faker.helpers.arrayElement(['user', 'admin', 'moderator']),
      ...overrides
    };
  }

  /**
   * Create admin user
   */
  createAdmin(overrides = {}) {
    return this.create({
      role: 'admin',
      email: 'admin@example.com',
      isActive: true,
      ...overrides
    });
  }

  /**
   * Create inactive user
   */
  createInactive(overrides = {}) {
    return this.create({
      isActive: false,
      ...overrides
    });
  }
}

/**
 * Project Factory
 */
export class ProjectFactory extends BaseFactory {
  create(overrides = {}) {
    const projectId = this.sequence('project');
    return {
      id: overrides.id || projectId,
      uuid: overrides.uuid || randomUUID(),
      name: overrides.name || faker.company.name(),
      slug: overrides.slug || faker.lorem.slug(),
      description: overrides.description || faker.lorem.paragraph(),
      status: overrides.status || faker.helpers.arrayElement(['active', 'inactive', 'archived']),
      priority: overrides.priority || faker.helpers.arrayElement(['low', 'medium', 'high', 'critical']),
      type: overrides.type || faker.helpers.arrayElement(['web', 'mobile', 'desktop', 'api']),
      tags: overrides.tags || faker.helpers.arrayElements(['react', 'node', 'typescript', 'jest'], { min: 1, max: 3 }),
      repository: overrides.repository || {
        url: faker.internet.url(),
        branch: faker.helpers.arrayElement(['main', 'develop', 'staging']),
        lastCommit: faker.git.commitSha()
      },
      configuration: overrides.configuration || {
        buildCommand: 'npm run build',
        testCommand: 'npm test',
        deployCommand: 'npm run deploy',
        environment: faker.helpers.arrayElement(['development', 'staging', 'production'])
      },
      metrics: overrides.metrics || {
        linesOfCode: faker.number.int({ min: 1000, max: 100000 }),
        testCoverage: faker.number.float({ min: 60, max: 100, fractionDigits: 2 }),
        buildTime: faker.number.int({ min: 30, max: 300 })
      },
      ownerId: overrides.ownerId || faker.number.int({ min: 1, max: 100 }),
      teamMembers: overrides.teamMembers || faker.helpers.arrayElements(
        Array.from({ length: 10 }, (_, i) => i + 1), { min: 1, max: 5 }
      ),
      startDate: overrides.startDate || faker.date.past(),
      endDate: overrides.endDate || faker.date.future(),
      createdAt: overrides.createdAt || faker.date.past(),
      updatedAt: overrides.updatedAt || faker.date.recent(),
      ...overrides
    };
  }

  /**
   * Create web project
   */
  createWebProject(overrides = {}) {
    return this.create({
      type: 'web',
      tags: ['react', 'typescript', 'vite'],
      configuration: {
        buildCommand: 'npm run build',
        testCommand: 'npm test',
        deployCommand: 'npm run deploy:web'
      },
      ...overrides
    });
  }

  /**
   * Create API project
   */
  createApiProject(overrides = {}) {
    return this.create({
      type: 'api',
      tags: ['node', 'express', 'typescript'],
      configuration: {
        buildCommand: 'npm run build',
        testCommand: 'npm run test:api',
        deployCommand: 'npm run deploy:api'
      },
      ...overrides
    });
  }
}

/**
 * Template Factory
 */
export class TemplateFactory extends BaseFactory {
  create(overrides = {}) {
    const templateId = this.sequence('template');
    const category = overrides.category || faker.helpers.arrayElement([
      'component', 'page', 'api', 'service', 'model', 'test'
    ]);
    
    return {
      id: overrides.id || templateId,
      name: overrides.name || faker.hacker.noun(),
      category,
      description: overrides.description || faker.lorem.sentence(),
      template: overrides.template || this.generateTemplateContent(category),
      frontmatter: overrides.frontmatter || this.generateFrontmatter(category),
      variables: overrides.variables || this.generateVariables(category),
      examples: overrides.examples || this.generateExamples(category),
      tags: overrides.tags || faker.helpers.arrayElements([
        'react', 'vue', 'angular', 'typescript', 'javascript', 'node', 'express'
      ], { min: 1, max: 4 }),
      author: overrides.author || faker.person.fullName(),
      version: overrides.version || faker.system.semver(),
      isPublic: overrides.isPublic !== undefined ? overrides.isPublic : faker.datatype.boolean(),
      downloadCount: overrides.downloadCount || faker.number.int({ min: 0, max: 10000 }),
      rating: overrides.rating || faker.number.float({ min: 1, max: 5, fractionDigits: 1 }),
      metadata: overrides.metadata || {
        complexity: faker.helpers.arrayElement(['simple', 'medium', 'complex']),
        framework: faker.helpers.arrayElement(['react', 'vue', 'angular', 'vanilla']),
        language: faker.helpers.arrayElement(['javascript', 'typescript'])
      },
      createdAt: overrides.createdAt || faker.date.past(),
      updatedAt: overrides.updatedAt || faker.date.recent(),
      ...overrides
    };
  }

  generateTemplateContent(category) {
    const templates = {
      component: `---
to: <%= path %>/components/<%= name %>.jsx
---
import React from 'react';

const <%= name %> = ({ children, ...props }) => {
  return (
    <div className="<%= name.toLowerCase() %>" {...props}>
      {children}
    </div>
  );
};

export default <%= name %>;`,
      page: `---
to: <%= path %>/pages/<%= name %>.jsx
---
import React from 'react';
import { Head } from 'next/head';

const <%= name %>Page = () => {
  return (
    <>
      <Head>
        <title><%= title %></title>
      </Head>
      <main>
        <h1><%= title %></h1>
        <p>Welcome to the <%= name %> page!</p>
      </main>
    </>
  );
};

export default <%= name %>Page;`,
      api: `---
to: <%= path %>/api/<%= name %>.js
---
export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      // Handle GET request
      res.status(200).json({ message: '<%= name %> API endpoint' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(\`Method \${req.method} Not Allowed\`);
  }
}`,
      service: `---
to: <%= path %>/services/<%= name %>.service.js
---
class <%= name %>Service {
  constructor() {
    this.data = [];
  }

  async getAll() {
    return this.data;
  }

  async getById(id) {
    return this.data.find(item => item.id === id);
  }

  async create(item) {
    const newItem = { ...item, id: this.getDeterministicTimestamp() };
    this.data.push(newItem);
    return newItem;
  }

  async update(id, updates) {
    const index = this.data.findIndex(item => item.id === id);
    if (index !== -1) {
      this.data[index] = { ...this.data[index], ...updates };
      return this.data[index];
    }
    return null;
  }

  async delete(id) {
    const index = this.data.findIndex(item => item.id === id);
    if (index !== -1) {
      return this.data.splice(index, 1)[0];
    }
    return null;
  }
}

export default <%= name %>Service;`,
      model: `---
to: <%= path %>/models/<%= name %>.model.js
---
import { Schema, model } from 'mongoose';

const <%= name.toLowerCase() %>Schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export default model('<%= name %>', <%= name.toLowerCase() %>Schema);`,
      test: `---
to: <%= path %>/tests/<%= name %>.test.js
---
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import <%= name %> from '../<%= name %>';

describe('<%= name %>', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  it('should create instance', () => {
    const instance = new <%= name %>();
    expect(instance).toBeDefined();
  });

  it('should handle basic operations', () => {
    // Test basic functionality
    expect(true).toBe(true);
  });
});`
    };

    return templates[category] || templates.component;
  }

  generateFrontmatter(category) {
    const frontmatter = {
      component: {
        to: '<%= path %>/components/<%= name %>.jsx',
        inject: false,
        skip_if: '<%= exists %>',
        unless: '<%= force %>'
      },
      page: {
        to: '<%= path %>/pages/<%= name %>.jsx',
        inject: false,
        skip_if: '<%= exists %>'
      },
      api: {
        to: '<%= path %>/api/<%= name %>.js',
        inject: false
      },
      service: {
        to: '<%= path %>/services/<%= name %>.service.js',
        inject: false
      },
      model: {
        to: '<%= path %>/models/<%= name %>.model.js',
        inject: false
      },
      test: {
        to: '<%= path %>/tests/<%= name %>.test.js',
        inject: false
      }
    };

    return frontmatter[category] || frontmatter.component;
  }

  generateVariables(category) {
    const variables = {
      component: ['name', 'path', 'exists', 'force'],
      page: ['name', 'path', 'title'],
      api: ['name', 'path'],
      service: ['name', 'path'],
      model: ['name', 'path'],
      test: ['name', 'path']
    };

    return variables[category] || variables.component;
  }

  generateExamples(category) {
    const examples = {
      component: [
        'unjucks generate component Button --path=src',
        'unjucks generate component Modal --path=src/components --force'
      ],
      page: [
        'unjucks generate page About --path=pages --title="About Us"',
        'unjucks generate page Contact --path=src/pages'
      ],
      api: [
        'unjucks generate api users --path=api',
        'unjucks generate api auth --path=api/auth'
      ],
      service: [
        'unjucks generate service UserService --path=src',
        'unjucks generate service AuthService --path=services'
      ],
      model: [
        'unjucks generate model User --path=models',
        'unjucks generate model Product --path=src/models'
      ],
      test: [
        'unjucks generate test UserService --path=tests',
        'unjucks generate test api --path=tests/integration'
      ]
    };

    return examples[category] || examples.component;
  }
}

/**
 * Test Run Factory
 */
export class TestRunFactory extends BaseFactory {
  create(overrides = {}) {
    const runId = this.sequence('testrun');
    const status = overrides.status || faker.helpers.arrayElement([
      'pending', 'running', 'passed', 'failed', 'cancelled'
    ]);
    
    return {
      id: overrides.id || runId,
      uuid: overrides.uuid || randomUUID(),
      name: overrides.name || faker.lorem.words(3),
      status,
      suite: overrides.suite || faker.helpers.arrayElement([
        'unit', 'integration', 'e2e', 'performance'
      ]),
      environment: overrides.environment || faker.helpers.arrayElement([
        'local', 'ci', 'staging', 'production'
      ]),
      configuration: overrides.configuration || {
        timeout: faker.number.int({ min: 5000, max: 60000 }),
        parallel: faker.datatype.boolean(),
        coverage: faker.datatype.boolean(),
        browser: faker.helpers.arrayElement(['chrome', 'firefox', 'safari'])
      },
      metrics: overrides.metrics || {
        totalTests: faker.number.int({ min: 10, max: 500 }),
        passedTests: faker.number.int({ min: 5, max: 450 }),
        failedTests: faker.number.int({ min: 0, max: 50 }),
        skippedTests: faker.number.int({ min: 0, max: 20 }),
        duration: faker.number.int({ min: 1000, max: 300000 }),
        coverage: faker.number.float({ min: 60, max: 100, fractionDigits: 2 })
      },
      artifacts: overrides.artifacts || {
        reports: [`/reports/test-${runId}.html`],
        screenshots: [`/screenshots/test-${runId}.png`],
        logs: [`/logs/test-${runId}.log`]
      },
      triggeredBy: overrides.triggeredBy || faker.helpers.arrayElement([
        'manual', 'commit', 'schedule', 'api'
      ]),
      branch: overrides.branch || faker.helpers.arrayElement(['main', 'develop', 'feature/test']),
      commit: overrides.commit || faker.git.commitSha(),
      startedAt: overrides.startedAt || faker.date.recent(),
      completedAt: overrides.completedAt || (status === 'running' ? null : faker.date.recent()),
      createdAt: overrides.createdAt || faker.date.past(),
      updatedAt: overrides.updatedAt || faker.date.recent(),
      ...overrides
    };
  }

  /**
   * Create failed test run
   */
  createFailed(overrides = {}) {
    return this.create({
      status: 'failed',
      metrics: {
        totalTests: 100,
        passedTests: 85,
        failedTests: 15,
        skippedTests: 0,
        duration: 45000,
        coverage: 78.5
      },
      ...overrides
    });
  }

  /**
   * Create successful test run
   */
  createPassed(overrides = {}) {
    return this.create({
      status: 'passed',
      metrics: {
        totalTests: 100,
        passedTests: 100,
        failedTests: 0,
        skippedTests: 0,
        duration: 42000,
        coverage: 95.2
      },
      ...overrides
    });
  }
}

/**
 * Fixture Manager - Handles test data persistence and cleanup
 */
export class FixtureManager {
  constructor(baseDir = './tests/fixtures/generated') {
    this.baseDir = baseDir;
    this.factories = {
      user: new UserFactory(),
      project: new ProjectFactory(),
      template: new TemplateFactory(),
      testrun: new TestRunFactory()
    };
  }

  /**
   * Load fixtures from file
   */
  async loadFixtures(name) {
    const filePath = path.join(this.baseDir, `${name}.json`);
    if (await fs.pathExists(filePath)) {
      return await fs.readJson(filePath);
    }
    return [];
  }

  /**
   * Save fixtures to file
   */
  async saveFixtures(name, data) {
    const filePath = path.join(this.baseDir, `${name}.json`);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeJson(filePath, data, { spaces: 2 });
  }

  /**
   * Generate and save test dataset
   */
  async generateTestDataset(name, factory, count = 10, overrides = {}) {
    const factoryInstance = this.factories[factory];
    if (!factoryInstance) {
      throw new Error(`Factory '${factory}' not found`);
    }

    const data = factoryInstance.createMany(count, overrides);
    await this.saveFixtures(name, data);
    return data;
  }

  /**
   * Generate complete test scenario
   */
  async generateScenario(scenarioName, config = {}) {
    const scenario = {
      name: scenarioName,
      createdAt: this.getDeterministicDate().toISOString(),
      config,
      data: {}
    };

    // Generate users
    scenario.data.users = this.factories.user.createMany(
      config.userCount || 5,
      config.userOverrides
    );

    // Generate projects
    scenario.data.projects = this.factories.project.createMany(
      config.projectCount || 3,
      config.projectOverrides
    );

    // Generate templates
    scenario.data.templates = this.factories.template.createMany(
      config.templateCount || 10,
      config.templateOverrides
    );

    // Generate test runs
    scenario.data.testruns = this.factories.testrun.createMany(
      config.testrunCount || 8,
      config.testrunOverrides
    );

    // Save scenario
    await this.saveFixtures(`scenarios/${scenarioName}`, scenario);
    return scenario;
  }

  /**
   * Clean up generated fixtures
   */
  async cleanup() {
    if (await fs.pathExists(this.baseDir)) {
      await fs.remove(this.baseDir);
    }
  }

  /**
   * Reset sequences for factories
   */
  resetSequences() {
    Object.values(this.factories).forEach(factory => {
      factory.sequences.clear();
    });
  }
}

// Export factory instances for direct use
export const userFactory = new UserFactory();
export const projectFactory = new ProjectFactory();
export const templateFactory = new TemplateFactory();
export const testRunFactory = new TestRunFactory();
export const fixtureManager = new FixtureManager();

// Export default fixture manager
export default fixtureManager;