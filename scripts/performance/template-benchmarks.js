#!/usr/bin/env node

/**
 * Template Performance Benchmarks
 * Measures template generation speed, throughput, and resource usage
 */

const { performance, PerformanceObserver } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');
const cluster = require('cluster');
const os = require('os');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Import unjucks core
const unjucks = require('../../src/index.js');

class TemplateBenchmark {
  constructor(options = {}) {
    this.options = {
      type: 'simple',
      concurrency: 1,
      iterations: 1000,
      warmupRuns: 100,
      outputFormat: 'json',
      outputFile: null,
      enableGC: true,
      ...options
    };
    
    this.results = {
      metadata: {
        timestamp: this.getDeterministicDate().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        templateType: this.options.type,
        concurrency: this.options.concurrency,
        iterations: this.options.iterations
      },
      metrics: {},
      rawTimings: [],
      memoryUsage: [],
      errors: []
    };

    this.setupPerformanceObserver();
  }

  setupPerformanceObserver() {
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name.startsWith('template-')) {
          this.results.rawTimings.push({
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime,
            entryType: entry.entryType
          });
        }
      }
    });
    obs.observe({ entryTypes: ['measure'] });
  }

  async generateTestTemplates() {
    const templatesDir = path.join(process.cwd(), 'tests', 'fixtures', 'performance');
    await fs.mkdir(templatesDir, { recursive: true });

    const templates = {
      simple: {
        'simple.txt.njk': 'Hello {{ name }}! Your age is {{ age }}.',
        'config.json': JSON.stringify({ 
          name: 'Simple Template',
          variables: { name: 'string', age: 'number' }
        })
      },
      
      complex: {
        'complex.html.njk': `
<!DOCTYPE html>
<html>
<head>
  <title>{{ title | title }}</title>
  <meta name="description" content="{{ description | escape }}">
</head>
<body>
  <h1>{{ title }}</h1>
  
  {% if users.length > 0 %}
    <ul class="users">
    {% for user in users %}
      <li class="user-item" data-id="{{ user.id }}">
        <h3>{{ user.name | title }}</h3>
        <p>{{ user.email | lower }}</p>
        
        {% if user.roles %}
          <div class="roles">
          {% for role in user.roles %}
            <span class="role {{ role | dashify }}">{{ role | title }}</span>
          {% endfor %}
          </div>
        {% endif %}
        
        {% if user.settings %}
          <div class="settings">
            <p>Theme: {{ user.settings.theme | default('light') }}</p>
            <p>Language: {{ user.settings.language | default('en') }}</p>
            <p>Notifications: {{ user.settings.notifications | ternary('enabled', 'disabled') }}</p>
          </div>
        {% endif %}
      </li>
    {% endfor %}
    </ul>
  {% else %}
    <p class="no-users">No users found.</p>
  {% endif %}
  
  <footer>
    <p>Generated at {{ timestamp | dateFormat('YYYY-MM-DD HH:mm:ss') }}</p>
    <p>Total users: {{ users.length }}</p>
  </footer>
</body>
</html>`,
        'config.json': JSON.stringify({
          name: 'Complex Template',
          variables: {
            title: 'string',
            description: 'string',
            users: 'array',
            timestamp: 'date'
          }
        })
      },

      nested: {
        'nested.md.njk': `
# {{ project.name }}

{{ project.description }}

## Team Members

{% for team in project.teams %}
### {{ team.name }}

{% for member in team.members %}
- **{{ member.name }}** ({{ member.role }})
  - Email: {{ member.email }}
  - Skills: {{ member.skills | join(', ') }}
  
  {% if member.projects %}
  #### Recent Projects
  {% for project in member.projects %}
  - {{ project.name }} ({{ project.status }})
    {% if project.technologies %}
    - Technologies: {{ project.technologies | join(', ') }}
    {% endif %}
    {% if project.metrics %}
    - Performance: {{ project.metrics.performance }}%
    - Coverage: {{ project.metrics.coverage }}%
    {% endif %}
  {% endfor %}
  {% endif %}
{% endfor %}

#### Team Statistics
- Total Members: {{ team.members.length }}
- Average Experience: {{ team.members | map('experience') | mean }} years
- Primary Technologies: {{ team.members | map('skills') | flatten | unique | join(', ') }}

{% endfor %}

## Project Summary

- **Total Teams**: {{ project.teams.length }}
- **Total Members**: {{ project.teams | map('members') | flatten | length }}
- **Project Status**: {{ project.status | title }}
- **Last Updated**: {{ project.lastUpdated | dateFormat('MMMM DD, YYYY') }}`,
        'config.json': JSON.stringify({
          name: 'Nested Template',
          variables: {
            project: 'object'
          }
        })
      },

      conditional: {
        'conditional.json.njk': `{
  "user": {
    "id": {{ user.id }},
    "name": "{{ user.name | escape }}",
    "email": "{{ user.email | lower }}",
    {% if user.profile %}
    "profile": {
      {% if user.profile.bio %}"bio": "{{ user.profile.bio | escape }}",{% endif %}
      {% if user.profile.avatar %}"avatar": "{{ user.profile.avatar }}",{% endif %}
      {% if user.profile.location %}"location": "{{ user.profile.location }}",{% endif %}
      {% if user.profile.website %}"website": "{{ user.profile.website }}",{% endif %}
      "verified": {{ user.profile.verified | ternary('true', 'false') }}
    },
    {% endif %}
    {% if user.preferences %}
    "preferences": {
      "theme": "{{ user.preferences.theme | default('auto') }}",
      "language": "{{ user.preferences.language | default('en') }}",
      "timezone": "{{ user.preferences.timezone | default('UTC') }}",
      "notifications": {
        {% if user.preferences.notifications %}
        {% for key, value in user.preferences.notifications %}
        "{{ key }}": {{ value | ternary('true', 'false') }}{% if not loop.last %},{% endif %}
        {% endfor %}
        {% endif %}
      }
    },
    {% endif %}
    {% if user.roles and user.roles.length > 0 %}
    "roles": [
      {% for role in user.roles %}
      {
        "name": "{{ role.name }}",
        "permissions": [
          {% for permission in role.permissions %}
          "{{ permission }}"{% if not loop.last %},{% endif %}
          {% endfor %}
        ]
      }{% if not loop.last %},{% endif %}
      {% endfor %}
    ],
    {% endif %}
    "metadata": {
      "createdAt": "{{ user.createdAt | dateFormat('YYYY-MM-DDTHH:mm:ss.SSSZ') }}",
      "updatedAt": "{{ user.updatedAt | dateFormat('YYYY-MM-DDTHH:mm:ss.SSSZ') }}",
      "lastLoginAt": {% if user.lastLoginAt %}"{{ user.lastLoginAt | dateFormat('YYYY-MM-DDTHH:mm:ss.SSSZ') }}"{% else %}null{% endif %},
      "isActive": {{ user.isActive | ternary('true', 'false') }},
      "loginCount": {{ user.loginCount | default(0) }}
    }
  }
}`,
        'config.json': JSON.stringify({
          name: 'Conditional Template',
          variables: {
            user: 'object'
          }
        })
      }
    };

    // Write templates
    for (const [type, files] of Object.entries(templates)) {
      const typeDir = path.join(templatesDir, type);
      await fs.mkdir(typeDir, { recursive: true });
      
      for (const [filename, content] of Object.entries(files)) {
        await fs.writeFile(path.join(typeDir, filename), content);
      }
    }

    return templatesDir;
  }

  generateTestData(type, size = 'medium') {
    const baseData = {
      simple: {
        small: { name: 'John', age: 30 },
        medium: { name: 'John Doe', age: 30 },
        large: { name: 'John Doe Smith', age: 30 }
      },
      
      complex: {
        small: {
          title: 'User Dashboard',
          description: 'Simple user dashboard',
          timestamp: this.getDeterministicDate(),
          users: Array.from({ length: 10 }, (_, i) => ({
            id: i + 1,
            name: `User ${i + 1}`,
            email: `user${i + 1}@example.com`,
            roles: ['user'],
            settings: { theme: 'light', language: 'en', notifications: true }
          }))
        },
        medium: {
          title: 'Advanced User Management Dashboard',
          description: 'Comprehensive user management system with roles and permissions',
          timestamp: this.getDeterministicDate(),
          users: Array.from({ length: 100 }, (_, i) => ({
            id: i + 1,
            name: `User ${i + 1}`,
            email: `user${i + 1}@example.com`,
            roles: ['user', 'admin', 'moderator'][i % 3] ? [['user', 'admin', 'moderator'][i % 3]] : ['user'],
            settings: {
              theme: ['light', 'dark'][i % 2],
              language: ['en', 'es', 'fr'][i % 3],
              notifications: i % 2 === 0
            }
          }))
        },
        large: {
          title: 'Enterprise User Management Dashboard',
          description: 'Large-scale enterprise user management system with complex role hierarchies',
          timestamp: this.getDeterministicDate(),
          users: Array.from({ length: 1000 }, (_, i) => ({
            id: i + 1,
            name: `User ${i + 1}`,
            email: `user${i + 1}@example.com`,
            roles: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, () => 
              ['user', 'admin', 'moderator', 'supervisor', 'manager'][Math.floor(Math.random() * 5)]
            ),
            settings: {
              theme: ['light', 'dark', 'auto'][i % 3],
              language: ['en', 'es', 'fr', 'de', 'ja'][i % 5],
              notifications: i % 2 === 0
            }
          }))
        }
      },

      nested: {
        small: {
          project: {
            name: 'Simple Project',
            description: 'A simple test project',
            status: 'active',
            lastUpdated: this.getDeterministicDate(),
            teams: [
              {
                name: 'Development',
                members: [
                  {
                    name: 'Alice Johnson',
                    role: 'Developer',
                    email: 'alice@example.com',
                    experience: 3,
                    skills: ['JavaScript', 'React'],
                    projects: [
                      { name: 'Project A', status: 'completed', technologies: ['React', 'Node.js'], metrics: { performance: 95, coverage: 88 } }
                    ]
                  }
                ]
              }
            ]
          }
        },
        medium: {
          project: {
            name: 'Medium Scale Project',
            description: 'A medium-scale development project',
            status: 'active',
            lastUpdated: this.getDeterministicDate(),
            teams: Array.from({ length: 3 }, (_, teamIndex) => ({
              name: ['Development', 'QA', 'DevOps'][teamIndex],
              members: Array.from({ length: 5 }, (_, memberIndex) => ({
                name: `Team Member ${teamIndex}-${memberIndex}`,
                role: ['Developer', 'Tester', 'Engineer'][memberIndex % 3],
                email: `member${teamIndex}${memberIndex}@example.com`,
                experience: Math.floor(Math.random() * 10) + 1,
                skills: ['JavaScript', 'Python', 'Docker', 'React', 'Node.js'].slice(0, Math.floor(Math.random() * 3) + 2),
                projects: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, projIndex) => ({
                  name: `Project ${teamIndex}-${memberIndex}-${projIndex}`,
                  status: ['active', 'completed', 'on-hold'][projIndex % 3],
                  technologies: ['React', 'Node.js', 'Python', 'Docker'].slice(0, Math.floor(Math.random() * 3) + 1),
                  metrics: {
                    performance: Math.floor(Math.random() * 20) + 80,
                    coverage: Math.floor(Math.random() * 30) + 70
                  }
                }))
              }))
            }))
          }
        },
        large: {
          project: {
            name: 'Enterprise Scale Project',
            description: 'Large enterprise development project with multiple teams',
            status: 'active',
            lastUpdated: this.getDeterministicDate(),
            teams: Array.from({ length: 10 }, (_, teamIndex) => ({
              name: `Team ${teamIndex + 1}`,
              members: Array.from({ length: 15 }, (_, memberIndex) => ({
                name: `Team Member ${teamIndex}-${memberIndex}`,
                role: ['Developer', 'Senior Developer', 'Tech Lead', 'Architect', 'Tester', 'DevOps Engineer'][memberIndex % 6],
                email: `member${teamIndex}${memberIndex}@enterprise.com`,
                experience: Math.floor(Math.random() * 15) + 1,
                skills: ['JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Docker', 'Kubernetes', 'React', 'Vue', 'Angular', 'Node.js', 'Spring Boot'].slice(0, Math.floor(Math.random() * 6) + 3),
                projects: Array.from({ length: Math.floor(Math.random() * 5) + 2 }, (_, projIndex) => ({
                  name: `Project ${teamIndex}-${memberIndex}-${projIndex}`,
                  status: ['active', 'completed', 'on-hold', 'planning'][projIndex % 4],
                  technologies: ['React', 'Vue', 'Angular', 'Node.js', 'Python', 'Java', 'Go', 'Docker', 'Kubernetes'].slice(0, Math.floor(Math.random() * 5) + 2),
                  metrics: {
                    performance: Math.floor(Math.random() * 20) + 80,
                    coverage: Math.floor(Math.random() * 30) + 70
                  }
                }))
              }))
            }))
          }
        }
      },

      conditional: {
        small: {
          user: {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            profile: {
              bio: 'Software developer',
              avatar: 'avatar.jpg',
              verified: true
            },
            preferences: {
              theme: 'dark',
              language: 'en',
              notifications: { email: true, push: false }
            },
            roles: [{ name: 'user', permissions: ['read'] }],
            createdAt: this.getDeterministicDate(),
            updatedAt: this.getDeterministicDate(),
            lastLoginAt: this.getDeterministicDate(),
            isActive: true,
            loginCount: 42
          }
        },
        medium: {
          user: {
            id: 1,
            name: 'John Doe Smith',
            email: 'john.smith@example.com',
            profile: {
              bio: 'Senior Software Developer with 10+ years of experience in full-stack development',
              avatar: 'https://example.com/avatars/john-smith.jpg',
              location: 'San Francisco, CA',
              website: 'https://johnsmith.dev',
              verified: true
            },
            preferences: {
              theme: 'dark',
              language: 'en',
              timezone: 'America/Los_Angeles',
              notifications: {
                email: true,
                push: false,
                sms: true,
                desktop: false,
                marketing: false,
                security: true
              }
            },
            roles: [
              { name: 'user', permissions: ['read', 'write'] },
              { name: 'admin', permissions: ['read', 'write', 'delete', 'manage_users'] }
            ],
            createdAt: new Date('2020-01-15T10:30:00Z'),
            updatedAt: this.getDeterministicDate(),
            lastLoginAt: this.getDeterministicDate(),
            isActive: true,
            loginCount: 1337
          }
        },
        large: {
          user: {
            id: 1,
            name: 'Johnathan Doe Smith Williams',
            email: 'johnathan.williams@enterprise.example.com',
            profile: {
              bio: 'Enterprise Software Architect and Technical Lead with 15+ years of experience in designing and implementing large-scale distributed systems. Specializes in microservices architecture, cloud computing, and DevOps practices.',
              avatar: 'https://cdn.enterprise.example.com/avatars/johnathan-williams.jpg',
              location: 'San Francisco, California, United States',
              website: 'https://johnathan-williams.dev',
              verified: true
            },
            preferences: {
              theme: 'auto',
              language: 'en-US',
              timezone: 'America/Los_Angeles',
              notifications: {
                email: true,
                push: false,
                sms: true,
                desktop: true,
                marketing: false,
                security: true,
                project_updates: true,
                team_mentions: true,
                critical_alerts: true,
                weekly_digest: true
              }
            },
            roles: [
              { name: 'user', permissions: ['read', 'write', 'comment'] },
              { name: 'admin', permissions: ['read', 'write', 'delete', 'manage_users', 'manage_roles', 'manage_settings'] },
              { name: 'architect', permissions: ['read', 'write', 'design', 'review', 'approve'] },
              { name: 'tech_lead', permissions: ['read', 'write', 'assign', 'review', 'mentor'] }
            ],
            createdAt: new Date('2018-03-20T08:15:30Z'),
            updatedAt: this.getDeterministicDate(),
            lastLoginAt: this.getDeterministicDate(),
            isActive: true,
            loginCount: 5432
          }
        }
      }
    };

    return baseData[type][size];
  }

  async warmupRuns() {
    console.log(`Running ${this.options.warmupRuns} warmup iterations...`);
    
    const templatesDir = await this.generateTestTemplates();
    const templatePath = path.join(templatesDir, this.options.type);
    const testData = this.generateTestData(this.options.type, 'small');

    for (let i = 0; i < this.options.warmupRuns; i++) {
      try {
        await unjucks.generate(templatePath, testData, { silent: true });
      } catch (error) {
        // Ignore warmup errors
      }
    }

    console.log('Warmup completed.');
  }

  async runSingleIteration(iteration, templatesDir, testData) {
    const templatePath = path.join(templatesDir, this.options.type);
    
    performance.mark(`template-start-${iteration}`);
    const memBefore = process.memoryUsage();
    
    try {
      const result = await unjucks.generate(templatePath, testData, { silent: true });
      
      performance.mark(`template-end-${iteration}`);
      performance.measure(
        `template-generation-${iteration}`,
        `template-start-${iteration}`,
        `template-end-${iteration}`
      );
      
      const memAfter = process.memoryUsage();
      
      this.results.memoryUsage.push({
        iteration,
        before: memBefore,
        after: memAfter,
        delta: {
          rss: memAfter.rss - memBefore.rss,
          heapUsed: memAfter.heapUsed - memBefore.heapUsed,
          heapTotal: memAfter.heapTotal - memBefore.heapTotal,
          external: memAfter.external - memBefore.external
        }
      });

      return {
        success: true,
        size: result ? result.length : 0,
        iteration
      };
    } catch (error) {
      this.results.errors.push({
        iteration,
        error: error.message,
        stack: error.stack
      });
      
      return {
        success: false,
        error: error.message,
        iteration
      };
    }
  }

  async runBenchmark() {
    console.log(`Starting template benchmark: ${this.options.type} (concurrency: ${this.options.concurrency})`);
    
    await this.warmupRuns();
    
    if (this.options.enableGC && global.gc) {
      global.gc();
    }

    const templatesDir = await this.generateTestTemplates();
    const testData = this.generateTestData(this.options.type, 'medium');
    
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    if (this.options.concurrency === 1) {
      // Sequential execution
      for (let i = 0; i < this.options.iterations; i++) {
        await this.runSingleIteration(i, templatesDir, testData);
        
        if (i % 100 === 0) {
          console.log(`Completed ${i}/${this.options.iterations} iterations`);
        }
      }
    } else {
      // Concurrent execution
      const chunks = Math.ceil(this.options.iterations / this.options.concurrency);
      const promises = [];
      
      for (let chunk = 0; chunk < this.options.concurrency; chunk++) {
        const chunkPromises = [];
        const startIdx = chunk * chunks;
        const endIdx = Math.min(startIdx + chunks, this.options.iterations);
        
        for (let i = startIdx; i < endIdx; i++) {
          chunkPromises.push(this.runSingleIteration(i, templatesDir, testData));
        }
        
        promises.push(Promise.all(chunkPromises));
      }
      
      await Promise.all(promises);
    }
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    
    this.calculateMetrics(startTime, endTime, startMemory, endMemory);
    
    console.log(`Benchmark completed in ${(endTime - startTime).toFixed(2)}ms`);
    return this.results;
  }

  calculateMetrics(startTime, endTime, startMemory, endMemory) {
    const totalTime = endTime - startTime;
    const successfulRuns = this.results.rawTimings.length;
    const failedRuns = this.results.errors.length;
    
    const timings = this.results.rawTimings.map(t => t.duration);
    timings.sort((a, b) => a - b);
    
    this.results.metrics = {
      performance: {
        totalTime,
        totalIterations: this.options.iterations,
        successfulRuns,
        failedRuns,
        successRate: (successfulRuns / this.options.iterations) * 100,
        
        // Timing metrics
        averageTime: timings.reduce((a, b) => a + b, 0) / timings.length,
        medianTime: timings[Math.floor(timings.length / 2)],
        minTime: Math.min(...timings),
        maxTime: Math.max(...timings),
        p95Time: timings[Math.floor(timings.length * 0.95)],
        p99Time: timings[Math.floor(timings.length * 0.99)],
        
        // Throughput metrics
        throughputPerSecond: (successfulRuns / totalTime) * 1000,
        iterationsPerSecond: (this.options.iterations / totalTime) * 1000,
        
        // Concurrency metrics
        concurrencyLevel: this.options.concurrency,
        parallelEfficiency: this.options.concurrency > 1 ? 
          (this.options.iterations / this.options.concurrency) / (totalTime / 1000) : null
      },
      
      memory: {
        initial: startMemory,
        final: endMemory,
        delta: {
          rss: endMemory.rss - startMemory.rss,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          external: endMemory.external - startMemory.external
        },
        
        // Memory usage during iterations
        peakHeapUsed: Math.max(...this.results.memoryUsage.map(m => m.after.heapUsed)),
        averageHeapUsed: this.results.memoryUsage.reduce((sum, m) => sum + m.after.heapUsed, 0) / this.results.memoryUsage.length,
        memoryEfficiency: startMemory.heapUsed / endMemory.heapUsed,
        
        // Memory leak indicators
        heapGrowthRate: (endMemory.heapUsed - startMemory.heapUsed) / this.options.iterations,
        suspectedLeaks: this.results.memoryUsage.filter(m => 
          m.delta.heapUsed > (startMemory.heapUsed * 0.1) // Growth > 10% of initial heap
        ).length
      },
      
      quality: {
        errorRate: (failedRuns / this.options.iterations) * 100,
        consistency: {
          standardDeviation: this.calculateStandardDeviation(timings),
          coefficientOfVariation: this.calculateCoefficientOfVariation(timings)
        }
      }
    };
  }

  calculateStandardDeviation(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
    return Math.sqrt(avgSquaredDiff);
  }

  calculateCoefficientOfVariation(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = this.calculateStandardDeviation(values);
    return stdDev / mean;
  }

  async saveResults() {
    if (this.options.outputFile) {
      const outputPath = path.resolve(this.options.outputFile);
      
      if (this.options.outputFormat === 'json') {
        await fs.writeFile(outputPath, JSON.stringify(this.results, null, 2));
      } else if (this.options.outputFormat === 'csv') {
        const csv = this.generateCSVReport();
        await fs.writeFile(outputPath, csv);
      }
      
      console.log(`Results saved to: ${outputPath}`);
    }
  }

  generateCSVReport() {
    const headers = [
      'templateType', 'concurrency', 'iterations', 'successfulRuns', 'failedRuns',
      'totalTime', 'averageTime', 'medianTime', 'p95Time', 'p99Time',
      'throughputPerSecond', 'peakHeapUsed', 'heapGrowthRate', 'errorRate'
    ];
    
    const row = [
      this.options.type,
      this.options.concurrency,
      this.options.iterations,
      this.results.metrics.performance.successfulRuns,
      this.results.metrics.performance.failedRuns,
      this.results.metrics.performance.totalTime,
      this.results.metrics.performance.averageTime,
      this.results.metrics.performance.medianTime,
      this.results.metrics.performance.p95Time,
      this.results.metrics.performance.p99Time,
      this.results.metrics.performance.throughputPerSecond,
      this.results.metrics.memory.peakHeapUsed,
      this.results.metrics.memory.heapGrowthRate,
      this.results.metrics.quality.errorRate
    ];
    
    return [headers.join(','), row.join(',')].join('\n');
  }
}

// CLI Interface
async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('type', {
      alias: 't',
      type: 'string',
      choices: ['simple', 'complex', 'nested', 'conditional'],
      default: 'simple',
      describe: 'Template type to benchmark'
    })
    .option('concurrency', {
      alias: 'c',
      type: 'number',
      default: 1,
      describe: 'Concurrency level for parallel execution'
    })
    .option('iterations', {
      alias: 'i',
      type: 'number',
      default: 1000,
      describe: 'Number of iterations to run'
    })
    .option('warmup', {
      alias: 'w',
      type: 'number',
      default: 100,
      describe: 'Number of warmup runs'
    })
    .option('output-format', {
      type: 'string',
      choices: ['json', 'csv'],
      default: 'json',
      describe: 'Output format for results'
    })
    .option('output-file', {
      alias: 'o',
      type: 'string',
      describe: 'Output file path for results'
    })
    .option('enable-gc', {
      type: 'boolean',
      default: true,
      describe: 'Enable garbage collection between runs'
    })
    .help()
    .argv;

  try {
    const benchmark = new TemplateBenchmark({
      type: argv.type,
      concurrency: argv.concurrency,
      iterations: argv.iterations,
      warmupRuns: argv.warmup,
      outputFormat: argv.outputFormat,
      outputFile: argv.outputFile,
      enableGC: argv.enableGc
    });

    const results = await benchmark.runBenchmark();
    await benchmark.saveResults();

    console.log('\n=== Benchmark Results ===');
    console.log(`Template Type: ${argv.type}`);
    console.log(`Concurrency: ${argv.concurrency}`);
    console.log(`Iterations: ${argv.iterations}`);
    console.log(`Success Rate: ${results.metrics.performance.successRate.toFixed(2)}%`);
    console.log(`Average Time: ${results.metrics.performance.averageTime.toFixed(2)}ms`);
    console.log(`Throughput: ${results.metrics.performance.throughputPerSecond.toFixed(2)} ops/sec`);
    console.log(`Memory Growth: ${(results.metrics.memory.heapGrowthRate / 1024 / 1024).toFixed(2)} MB/iteration`);

  } catch (error) {
    console.error('Benchmark failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { TemplateBenchmark };