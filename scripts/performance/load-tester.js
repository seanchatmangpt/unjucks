#!/usr/bin/env node

/**
 * Load Testing & Concurrency Framework
 * Tests unjucks performance under various load scenarios
 */

const fs = require('fs').promises;
const path = require('path');
const cluster = require('cluster');
const os = require('os');
const { performance } = require('perf_hooks');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const unjucks = require('../../src/index.js');

class LoadTester {
  constructor(options = {}) {
    this.options = {
      scenario: 'sustained',
      workers: os.cpus().length,
      duration: 180, // seconds
      rampUp: 30, // seconds
      targetRPS: 100, // requests per second
      concurrency: 10,
      templateTypes: ['simple', 'complex', 'nested', 'conditional'],
      outputFile: null,
      ...options
    };

    this.results = {
      metadata: {
        timestamp: new Date().toISOString(),
        scenario: this.options.scenario,
        workers: this.options.workers,
        duration: this.options.duration,
        targetRPS: this.options.targetRPS,
        nodeVersion: process.version,
        platform: process.platform,
        cpus: os.cpus().length
      },
      phases: [],
      metrics: {},
      errors: [],
      latencies: [],
      throughput: []
    };

    this.activeWorkers = new Map();
    this.isRunning = false;
  }

  async prepareTestEnvironment() {
    // Create test templates
    const templatesDir = path.join(process.cwd(), 'tests', 'fixtures', 'load-test');
    await fs.mkdir(templatesDir, { recursive: true });

    const templates = {
      simple: {
        template: 'Hello {{ name }}! Time: {{ timestamp | dateFormat("HH:mm:ss") }}',
        data: { name: 'LoadTest', timestamp: new Date() }
      },
      
      complex: {
        template: `
<div class="load-test-dashboard">
  <header>
    <h1>{{ title }}</h1>
    <p>{{ description }}</p>
    <time>{{ timestamp | dateFormat("YYYY-MM-DD HH:mm:ss") }}</time>
  </header>
  
  <main>
    {% if items.length > 0 %}
      <ul class="items">
        {% for item in items %}
        <li class="item" data-id="{{ item.id }}">
          <h3>{{ item.name | title }}</h3>
          <p>{{ item.description | truncate(100) }}</p>
          
          {% if item.tags %}
          <div class="tags">
            {% for tag in item.tags %}
            <span class="tag {{ tag | dashify }}">{{ tag | title }}</span>
            {% endfor %}
          </div>
          {% endif %}
          
          {% if item.metadata %}
          <div class="metadata">
            <span>Created: {{ item.metadata.created | dateFormat("MM/DD/YYYY") }}</span>
            <span>Status: {{ item.metadata.status | title }}</span>
            {% if item.metadata.score %}
            <span>Score: {{ item.metadata.score | number(2) }}</span>
            {% endif %}
          </div>
          {% endif %}
        </li>
        {% endfor %}
      </ul>
    {% else %}
      <p class="no-items">No items found.</p>
    {% endif %}
  </main>
  
  <footer>
    <p>Total: {{ items.length }} items</p>
    <p>Generated: {{ timestamp | dateFormat("HH:mm:ss") }}</p>
  </footer>
</div>`,
        data: {
          title: 'Load Test Dashboard',
          description: 'Testing concurrent template rendering',
          timestamp: new Date(),
          items: Array.from({ length: 50 }, (_, i) => ({
            id: i + 1,
            name: `Item ${i + 1}`,
            description: `Description for item ${i + 1} with some additional content to test rendering performance`,
            tags: ['tag1', 'tag2', 'tag3'].slice(0, Math.floor(Math.random() * 3) + 1),
            metadata: {
              created: new Date(Date.now() - Math.random() * 86400000),
              status: ['active', 'pending', 'completed'][Math.floor(Math.random() * 3)],
              score: Math.random() * 100
            }
          }))
        }
      },
      
      nested: {
        template: `
# {{ project.name }}

## Overview
{{ project.description }}

## Teams
{% for team in project.teams %}
### {{ team.name }}
**Lead:** {{ team.lead.name }} ({{ team.lead.email }})

#### Members
{% for member in team.members %}
- **{{ member.name }}** - {{ member.role }}
  - Skills: {{ member.skills | join(', ') }}
  - Experience: {{ member.experience }} years
  
  {% if member.projects %}
  ##### Recent Projects
  {% for project in member.projects %}
  - {{ project.name }} ({{ project.status }})
    - Duration: {{ project.duration }} weeks
    - Technologies: {{ project.technologies | join(', ') }}
    {% if project.metrics %}
    - Performance: {{ project.metrics.performance }}%
    - Quality: {{ project.metrics.quality }}/10
    {% endif %}
  {% endfor %}
  {% endif %}
{% endfor %}

#### Team Statistics
- **Total Members:** {{ team.members.length }}
- **Average Experience:** {{ team.members | map('experience') | mean }} years
- **Primary Skills:** {{ team.members | map('skills') | flatten | unique | slice(0, 5) | join(', ') }}
- **Active Projects:** {{ team.members | map('projects') | flatten | filter('status', 'active') | length }}

---
{% endfor %}

## Project Summary
- **Teams:** {{ project.teams.length }}
- **Total Members:** {{ project.teams | map('members') | flatten | length }}
- **Status:** {{ project.status | title }}
- **Last Updated:** {{ project.lastUpdated | dateFormat("MMMM DD, YYYY") }}`,
        data: {
          project: {
            name: 'Load Test Project',
            description: 'Testing nested template performance under load',
            status: 'active',
            lastUpdated: new Date(),
            teams: Array.from({ length: 5 }, (_, teamIndex) => ({
              name: `Team ${teamIndex + 1}`,
              lead: {
                name: `Lead ${teamIndex}`,
                email: `lead${teamIndex}@example.com`
              },
              members: Array.from({ length: 8 }, (_, memberIndex) => ({
                name: `Member ${teamIndex}-${memberIndex}`,
                role: ['Developer', 'Designer', 'Tester', 'DevOps'][memberIndex % 4],
                experience: Math.floor(Math.random() * 10) + 1,
                skills: ['JavaScript', 'Python', 'React', 'Docker', 'AWS', 'Node.js'].slice(0, Math.floor(Math.random() * 4) + 2),
                projects: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, projIndex) => ({
                  name: `Project ${teamIndex}-${memberIndex}-${projIndex}`,
                  status: ['active', 'completed', 'on-hold'][projIndex % 3],
                  duration: Math.floor(Math.random() * 20) + 4,
                  technologies: ['React', 'Node.js', 'Python', 'Docker'].slice(0, Math.floor(Math.random() * 3) + 1),
                  metrics: {
                    performance: Math.floor(Math.random() * 20) + 80,
                    quality: Math.floor(Math.random() * 3) + 8
                  }
                }))
              }))
            }))
          }
        }
      },
      
      conditional: {
        template: `
{
  "loadTest": {
    "id": {{ test.id }},
    "name": "{{ test.name | escape }}",
    "scenario": "{{ test.scenario }}",
    
    {% if test.config %}
    "configuration": {
      {% if test.config.workers %}"workers": {{ test.config.workers }},{% endif %}
      {% if test.config.duration %}"duration": {{ test.config.duration }},{% endif %}
      {% if test.config.rps %}"targetRPS": {{ test.config.rps }},{% endif %}
      {% if test.config.concurrency %}"concurrency": {{ test.config.concurrency }},{% endif %}
      {% if test.config.rampUp %}"rampUpTime": {{ test.config.rampUp }}{% endif %}
    },
    {% endif %}
    
    {% if test.results %}
    "results": {
      {% if test.results.latency %}
      "latency": {
        "average": {{ test.results.latency.avg }},
        "median": {{ test.results.latency.median }},
        "p95": {{ test.results.latency.p95 }},
        "p99": {{ test.results.latency.p99 }}
      },
      {% endif %}
      
      {% if test.results.throughput %}
      "throughput": {
        "requestsPerSecond": {{ test.results.throughput.rps }},
        "totalRequests": {{ test.results.throughput.total }},
        "successRate": {{ test.results.throughput.successRate }}
      },
      {% endif %}
      
      {% if test.results.errors and test.results.errors.length > 0 %}
      "errors": [
        {% for error in test.results.errors %}
        {
          "type": "{{ error.type }}",
          "message": "{{ error.message | escape }}",
          "count": {{ error.count }},
          "percentage": {{ error.percentage }}
        }{% if not loop.last %},{% endif %}
        {% endfor %}
      ],
      {% endif %}
      
      "status": "{{ test.results.status }}",
      "completedAt": "{{ test.results.completedAt | dateFormat("YYYY-MM-DDTHH:mm:ss.SSSZ") }}"
    },
    {% endif %}
    
    "metadata": {
      "createdAt": "{{ test.createdAt | dateFormat("YYYY-MM-DDTHH:mm:ss.SSSZ") }}",
      "environment": {
        "nodeVersion": "{{ test.environment.nodeVersion }}",
        "platform": "{{ test.environment.platform }}",
        "cpus": {{ test.environment.cpus }},
        "memory": {{ test.environment.memory }}
      }
    }
  }
}`,
        data: {
          test: {
            id: Math.floor(Math.random() * 10000),
            name: 'Conditional Template Load Test',
            scenario: 'complex',
            config: {
              workers: 4,
              duration: 180,
              rps: 100,
              concurrency: 10,
              rampUp: 30
            },
            results: {
              latency: {
                avg: Math.random() * 50 + 10,
                median: Math.random() * 40 + 8,
                p95: Math.random() * 100 + 50,
                p99: Math.random() * 200 + 100
              },
              throughput: {
                rps: Math.random() * 200 + 50,
                total: Math.floor(Math.random() * 10000) + 1000,
                successRate: Math.random() * 5 + 95
              },
              errors: [
                { type: 'timeout', message: 'Request timeout', count: 5, percentage: 0.5 },
                { type: 'template', message: 'Template error', count: 2, percentage: 0.2 }
              ],
              status: 'completed',
              completedAt: new Date()
            },
            createdAt: new Date(),
            environment: {
              nodeVersion: process.version,
              platform: process.platform,
              cpus: os.cpus().length,
              memory: Math.floor(os.totalmem() / 1024 / 1024)
            }
          }
        }
      }
    };

    for (const [type, { template, data }] of Object.entries(templates)) {
      await fs.writeFile(path.join(templatesDir, `${type}.njk`), template);
      await fs.writeFile(path.join(templatesDir, `${type}-data.json`), JSON.stringify(data, null, 2));
    }

    return templatesDir;
  }

  async runLoadTest() {
    console.log(`Starting load test: ${this.options.scenario}`);
    console.log(`Workers: ${this.options.workers}, Duration: ${this.options.duration}s, Target RPS: ${this.options.targetRPS}`);
    
    const templatesDir = await this.prepareTestEnvironment();
    
    this.isRunning = true;
    const startTime = Date.now();
    
    // Run the appropriate scenario
    switch (this.options.scenario) {
      case 'burst':
        await this.runBurstScenario(templatesDir);
        break;
      case 'sustained':
        await this.runSustainedScenario(templatesDir);
        break;
      case 'gradual':
        await this.runGradualScenario(templatesDir);
        break;
      case 'spike':
        await this.runSpikeScenario(templatesDir);
        break;
      default:
        throw new Error(`Unknown scenario: ${this.options.scenario}`);
    }
    
    const endTime = Date.now();
    this.results.metadata.actualDuration = (endTime - startTime) / 1000;
    
    await this.calculateMetrics();
    this.isRunning = false;
    
    console.log('Load test completed');
    return this.results;
  }

  async runBurstScenario(templatesDir) {
    console.log('Running burst scenario...');
    
    const phase = {
      name: 'burst',
      startTime: Date.now(),
      workers: [],
      results: []
    };

    // Create all workers at once and hit with maximum load
    const workers = await this.createWorkers(this.options.workers, templatesDir);
    phase.workers = workers.map(w => w.id);

    // Burst all requests immediately
    const requestsPerWorker = Math.ceil((this.options.targetRPS * this.options.duration) / this.options.workers);
    
    const workerPromises = workers.map(async (worker) => {
      return this.sendWorkerRequests(worker, requestsPerWorker, 0); // No delay between requests
    });

    const workerResults = await Promise.all(workerPromises);
    phase.results = workerResults.flat();
    phase.endTime = Date.now();
    
    this.results.phases.push(phase);
    await this.terminateWorkers(workers);
  }

  async runSustainedScenario(templatesDir) {
    console.log('Running sustained scenario...');
    
    const phase = {
      name: 'sustained',
      startTime: Date.now(),
      workers: [],
      results: []
    };

    const workers = await this.createWorkers(this.options.workers, templatesDir);
    phase.workers = workers.map(w => w.id);

    // Sustained load with even distribution
    const requestsPerWorker = Math.ceil((this.options.targetRPS * this.options.duration) / this.options.workers);
    const delayBetweenRequests = Math.max(1, Math.floor(1000 / (this.options.targetRPS / this.options.workers)));
    
    const workerPromises = workers.map(async (worker) => {
      return this.sendWorkerRequests(worker, requestsPerWorker, delayBetweenRequests);
    });

    const workerResults = await Promise.all(workerPromises);
    phase.results = workerResults.flat();
    phase.endTime = Date.now();
    
    this.results.phases.push(phase);
    await this.terminateWorkers(workers);
  }

  async runGradualScenario(templatesDir) {
    console.log('Running gradual ramp-up scenario...');
    
    const rampUpDuration = this.options.rampUp * 1000; // Convert to ms
    const mainDuration = (this.options.duration - this.options.rampUp) * 1000;
    const steps = 10;
    const stepDuration = rampUpDuration / steps;

    // Ramp-up phase
    for (let step = 1; step <= steps; step++) {
      const phase = {
        name: `ramp-up-step-${step}`,
        startTime: Date.now(),
        workers: [],
        results: []
      };

      const workersForStep = Math.ceil((this.options.workers * step) / steps);
      const rpsForStep = Math.ceil((this.options.targetRPS * step) / steps);
      
      const workers = await this.createWorkers(workersForStep, templatesDir);
      phase.workers = workers.map(w => w.id);

      const requestsPerWorker = Math.ceil((rpsForStep * (stepDuration / 1000)) / workersForStep);
      const delayBetweenRequests = Math.max(1, Math.floor(1000 / (rpsForStep / workersForStep)));

      const workerPromises = workers.map(async (worker) => {
        return this.sendWorkerRequests(worker, requestsPerWorker, delayBetweenRequests);
      });

      const workerResults = await Promise.all(workerPromises);
      phase.results = workerResults.flat();
      phase.endTime = Date.now();
      
      this.results.phases.push(phase);
      await this.terminateWorkers(workers);
      
      console.log(`Ramp-up step ${step}/${steps} completed (${workersForStep} workers, ${rpsForStep} RPS)`);
    }

    // Sustained phase
    const sustainedPhase = {
      name: 'sustained',
      startTime: Date.now(),
      workers: [],
      results: []
    };

    const workers = await this.createWorkers(this.options.workers, templatesDir);
    sustainedPhase.workers = workers.map(w => w.id);

    const requestsPerWorker = Math.ceil((this.options.targetRPS * (mainDuration / 1000)) / this.options.workers);
    const delayBetweenRequests = Math.max(1, Math.floor(1000 / (this.options.targetRPS / this.options.workers)));

    const workerPromises = workers.map(async (worker) => {
      return this.sendWorkerRequests(worker, requestsPerWorker, delayBetweenRequests);
    });

    const workerResults = await Promise.all(workerPromises);
    sustainedPhase.results = workerResults.flat();
    sustainedPhase.endTime = Date.now();
    
    this.results.phases.push(sustainedPhase);
    await this.terminateWorkers(workers);
  }

  async runSpikeScenario(templatesDir) {
    console.log('Running spike scenario...');
    
    const normalRPS = Math.floor(this.options.targetRPS * 0.3);
    const spikeRPS = this.options.targetRPS * 3;
    const spikeDuration = Math.floor(this.options.duration * 0.2); // 20% of total time
    const normalDuration = Math.floor((this.options.duration - spikeDuration) / 2);

    // Normal load phase 1
    await this.runPhase('normal-1', templatesDir, normalRPS, normalDuration);
    
    // Spike phase
    await this.runPhase('spike', templatesDir, spikeRPS, spikeDuration);
    
    // Normal load phase 2
    await this.runPhase('normal-2', templatesDir, normalRPS, normalDuration);
  }

  async runPhase(phaseName, templatesDir, targetRPS, duration) {
    const phase = {
      name: phaseName,
      startTime: Date.now(),
      workers: [],
      results: []
    };

    const workers = await this.createWorkers(this.options.workers, templatesDir);
    phase.workers = workers.map(w => w.id);

    const requestsPerWorker = Math.ceil((targetRPS * duration) / this.options.workers);
    const delayBetweenRequests = Math.max(1, Math.floor(1000 / (targetRPS / this.options.workers)));

    const workerPromises = workers.map(async (worker) => {
      return this.sendWorkerRequests(worker, requestsPerWorker, delayBetweenRequests);
    });

    const workerResults = await Promise.all(workerPromises);
    phase.results = workerResults.flat();
    phase.endTime = Date.now();
    
    this.results.phases.push(phase);
    await this.terminateWorkers(workers);
    
    console.log(`Phase ${phaseName} completed (${targetRPS} RPS for ${duration}s)`);
  }

  async createWorkers(count, templatesDir) {
    const workers = [];
    
    for (let i = 0; i < count; i++) {
      const worker = new Worker(__filename, {
        workerData: {
          workerId: i,
          templatesDir,
          templateTypes: this.options.templateTypes
        }
      });
      
      worker.id = i;
      workers.push(worker);
      this.activeWorkers.set(i, worker);
    }
    
    return workers;
  }

  async sendWorkerRequests(worker, requestCount, delayMs) {
    return new Promise((resolve, reject) => {
      const results = [];
      let completedRequests = 0;
      
      const messageHandler = (message) => {
        if (message.type === 'result') {
          results.push(message.data);
          completedRequests++;
          
          if (completedRequests >= requestCount) {
            worker.off('message', messageHandler);
            resolve(results);
          }
        } else if (message.type === 'error') {
          worker.off('message', messageHandler);
          reject(new Error(message.error));
        }
      };
      
      worker.on('message', messageHandler);
      
      // Send requests to worker
      worker.postMessage({
        type: 'start',
        requestCount,
        delayMs
      });
    });
  }

  async terminateWorkers(workers) {
    const terminationPromises = workers.map(worker => {
      return new Promise((resolve) => {
        worker.postMessage({ type: 'terminate' });
        worker.on('exit', resolve);
      });
    });
    
    await Promise.all(terminationPromises);
    
    workers.forEach(worker => {
      this.activeWorkers.delete(worker.id);
    });
  }

  async calculateMetrics() {
    const allResults = this.results.phases.flatMap(phase => phase.results);
    
    if (allResults.length === 0) {
      throw new Error('No results to analyze');
    }

    // Separate successful and failed requests
    const successfulResults = allResults.filter(r => r.success);
    const failedResults = allResults.filter(r => !r.success);
    
    // Calculate latency metrics
    const latencies = successfulResults.map(r => r.duration);
    latencies.sort((a, b) => a - b);
    
    const totalDuration = this.results.metadata.actualDuration || this.options.duration;
    
    this.results.metrics = {
      requests: {
        total: allResults.length,
        successful: successfulResults.length,
        failed: failedResults.length,
        successRate: (successfulResults.length / allResults.length) * 100
      },
      
      latency: {
        average: latencies.reduce((a, b) => a + b, 0) / latencies.length,
        median: latencies[Math.floor(latencies.length / 2)],
        min: Math.min(...latencies),
        max: Math.max(...latencies),
        p90: latencies[Math.floor(latencies.length * 0.90)],
        p95: latencies[Math.floor(latencies.length * 0.95)],
        p99: latencies[Math.floor(latencies.length * 0.99)]
      },
      
      throughput: {
        requestsPerSecond: allResults.length / totalDuration,
        successfulRequestsPerSecond: successfulResults.length / totalDuration,
        avgResponseTime: latencies.reduce((a, b) => a + b, 0) / latencies.length
      },
      
      errors: this.analyzeErrors(failedResults),
      
      phases: this.results.phases.map(phase => ({
        name: phase.name,
        duration: (phase.endTime - phase.startTime) / 1000,
        requests: phase.results.length,
        averageLatency: phase.results.filter(r => r.success).reduce((sum, r) => sum + r.duration, 0) / phase.results.filter(r => r.success).length || 0,
        rps: phase.results.length / ((phase.endTime - phase.startTime) / 1000)
      }))
    };
  }

  analyzeErrors(failedResults) {
    const errorCounts = {};
    
    failedResults.forEach(result => {
      const errorType = result.error?.type || 'unknown';
      if (!errorCounts[errorType]) {
        errorCounts[errorType] = {
          count: 0,
          messages: new Set()
        };
      }
      errorCounts[errorType].count++;
      errorCounts[errorType].messages.add(result.error?.message || 'Unknown error');
    });
    
    return Object.entries(errorCounts).map(([type, data]) => ({
      type,
      count: data.count,
      percentage: (data.count / (failedResults.length || 1)) * 100,
      sampleMessages: Array.from(data.messages).slice(0, 3)
    }));
  }

  async saveResults() {
    if (this.options.outputFile) {
      await fs.writeFile(this.options.outputFile, JSON.stringify(this.results, null, 2));
      console.log(`Results saved to: ${this.options.outputFile}`);
    }
  }
}

// Worker thread code
if (!isMainThread) {
  const { workerId, templatesDir, templateTypes } = workerData;
  
  const templateCache = {};
  const dataCache = {};
  
  // Load templates and data
  async function loadTemplates() {
    for (const type of templateTypes) {
      try {
        templateCache[type] = await fs.readFile(path.join(templatesDir, `${type}.njk`), 'utf8');
        dataCache[type] = JSON.parse(await fs.readFile(path.join(templatesDir, `${type}-data.json`), 'utf8'));
      } catch (error) {
        console.error(`Worker ${workerId} failed to load template ${type}:`, error);
      }
    }
  }
  
  async function executeRequest() {
    const templateType = templateTypes[Math.floor(Math.random() * templateTypes.length)];
    const template = templateCache[templateType];
    const data = { ...dataCache[templateType] };
    
    // Add some randomness to data
    data.timestamp = new Date();
    data.workerId = workerId;
    data.requestId = Math.random().toString(36).substring(7);
    
    const startTime = performance.now();
    
    try {
      const result = await unjucks.renderString(template, data);
      const endTime = performance.now();
      
      return {
        success: true,
        duration: endTime - startTime,
        templateType,
        outputSize: result.length,
        workerId,
        timestamp: Date.now()
      };
    } catch (error) {
      const endTime = performance.now();
      
      return {
        success: false,
        duration: endTime - startTime,
        templateType,
        workerId,
        timestamp: Date.now(),
        error: {
          type: error.constructor.name,
          message: error.message
        }
      };
    }
  }
  
  parentPort.on('message', async (message) => {
    if (message.type === 'start') {
      await loadTemplates();
      
      const { requestCount, delayMs } = message;
      
      for (let i = 0; i < requestCount; i++) {
        if (delayMs > 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
        const result = await executeRequest();
        parentPort.postMessage({ type: 'result', data: result });
      }
    } else if (message.type === 'terminate') {
      process.exit(0);
    }
  });
}

// CLI Interface
async function main() {
  if (!isMainThread) return; // Skip CLI when running as worker
  
  const argv = yargs(hideBin(process.argv))
    .option('scenario', {
      alias: 's',
      type: 'string',
      choices: ['burst', 'sustained', 'gradual', 'spike'],
      default: 'sustained',
      describe: 'Load testing scenario'
    })
    .option('workers', {
      alias: 'w',
      type: 'number',
      default: os.cpus().length,
      describe: 'Number of worker threads'
    })
    .option('duration', {
      alias: 'd',
      type: 'number',
      default: 180,
      describe: 'Test duration in seconds'
    })
    .option('ramp-up', {
      alias: 'r',
      type: 'number',
      default: 30,
      describe: 'Ramp-up time in seconds (for gradual scenario)'
    })
    .option('target-rps', {
      alias: 't',
      type: 'number',
      default: 100,
      describe: 'Target requests per second'
    })
    .option('output', {
      alias: 'o',
      type: 'string',
      describe: 'Output file for results'
    })
    .help()
    .argv;

  try {
    const loadTester = new LoadTester({
      scenario: argv.scenario,
      workers: argv.workers,
      duration: argv.duration,
      rampUp: argv.rampUp,
      targetRPS: argv.targetRps,
      outputFile: argv.output
    });

    const results = await loadTester.runLoadTest();
    await loadTester.saveResults();

    console.log('\n=== Load Test Results ===');
    console.log(`Scenario: ${results.metadata.scenario}`);
    console.log(`Total Requests: ${results.metrics.requests.total}`);
    console.log(`Success Rate: ${results.metrics.requests.successRate.toFixed(2)}%`);
    console.log(`Average Latency: ${results.metrics.latency.average.toFixed(2)}ms`);
    console.log(`P95 Latency: ${results.metrics.latency.p95.toFixed(2)}ms`);
    console.log(`Throughput: ${results.metrics.throughput.requestsPerSecond.toFixed(2)} RPS`);

    if (results.metrics.errors.length > 0) {
      console.log('\n=== Errors ===');
      results.metrics.errors.forEach(error => {
        console.log(`${error.type}: ${error.count} (${error.percentage.toFixed(2)}%)`);
      });
    }

  } catch (error) {
    console.error('Load test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { LoadTester };