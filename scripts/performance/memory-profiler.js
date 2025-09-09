#!/usr/bin/env node

/**
 * Memory Profiler & Leak Detection
 * Comprehensive memory analysis during template operations
 */

const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');
const v8 = require('v8');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Try to load optional dependencies
let memwatch, heapdump;
try {
  memwatch = require('memwatch-next');
} catch (e) {
  console.warn('memwatch-next not available, skipping some memory analysis features');
}

try {
  heapdump = require('heapdump');
} catch (e) {
  console.warn('heapdump not available, heap dump features disabled');
}

const unjucks = require('../../src/index.js');

class MemoryProfiler {
  constructor(options = {}) {
    this.options = {
      duration: 300, // seconds
      samples: 100,
      outputDir: 'memory-profiles',
      detectLeaks: true,
      heapSnapshots: true,
      gcAnalysis: true,
      templateTypes: ['simple', 'complex', 'nested', 'conditional'],
      ...options
    };

    this.profiles = [];
    this.leaks = [];
    this.gcStats = [];
    this.heapDiffs = [];
    this.snapshots = [];
    
    this.setupMemoryMonitoring();
  }

  setupMemoryMonitoring() {
    if (memwatch) {
      // Memory leak detection
      memwatch.on('leak', (info) => {
        console.warn('Memory leak detected:', info);
        this.leaks.push({
          timestamp: new Date().toISOString(),
          info,
          memoryUsage: process.memoryUsage()
        });
      });

      // Garbage collection stats
      memwatch.on('stats', (stats) => {
        this.gcStats.push({
          timestamp: new Date().toISOString(),
          ...stats,
          memoryUsage: process.memoryUsage()
        });
      });
    }

    // V8 heap statistics
    if (v8.getHeapStatistics) {
      this.v8HeapStats = v8.getHeapStatistics;
    }
  }

  async createOutputDirectory() {
    await fs.mkdir(this.options.outputDir, { recursive: true });
  }

  async generateTestData() {
    return {
      simple: { name: 'John Doe', age: 30 },
      
      complex: {
        title: 'Memory Test Dashboard',
        description: 'Testing memory usage patterns',
        timestamp: new Date(),
        users: Array.from({ length: 1000 }, (_, i) => ({
          id: i + 1,
          name: `User ${i + 1}`,
          email: `user${i + 1}@example.com`,
          roles: ['user', 'admin'][i % 2] ? [['user', 'admin'][i % 2]] : ['user'],
          settings: {
            theme: ['light', 'dark'][i % 2],
            language: ['en', 'es'][i % 2],
            notifications: i % 2 === 0
          }
        }))
      },
      
      nested: {
        project: {
          name: 'Memory Test Project',
          description: 'Testing nested template memory usage',
          status: 'active',
          lastUpdated: new Date(),
          teams: Array.from({ length: 10 }, (_, teamIndex) => ({
            name: `Team ${teamIndex + 1}`,
            members: Array.from({ length: 20 }, (_, memberIndex) => ({
              name: `Member ${teamIndex}-${memberIndex}`,
              role: ['Developer', 'Tester'][memberIndex % 2],
              email: `member${teamIndex}${memberIndex}@example.com`,
              experience: Math.floor(Math.random() * 10) + 1,
              skills: ['JavaScript', 'Python', 'Docker', 'React'].slice(0, Math.floor(Math.random() * 3) + 1),
              projects: Array.from({ length: 5 }, (_, projIndex) => ({
                name: `Project ${teamIndex}-${memberIndex}-${projIndex}`,
                status: 'active',
                technologies: ['React', 'Node.js'],
                metrics: { performance: 95, coverage: 88 }
              }))
            }))
          }))
        }
      },
      
      conditional: {
        user: {
          id: 1,
          name: 'Memory Test User',
          email: 'test@example.com',
          profile: {
            bio: 'Testing memory usage in conditional templates',
            avatar: 'avatar.jpg',
            verified: true
          },
          preferences: {
            theme: 'dark',
            language: 'en',
            notifications: { email: true, push: false }
          },
          roles: Array.from({ length: 10 }, (_, i) => ({
            name: `Role ${i}`,
            permissions: Array.from({ length: 20 }, (_, j) => `permission_${i}_${j}`)
          })),
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
          loginCount: 1000
        }
      }
    };
  }

  async createTestTemplates() {
    const templatesDir = path.join(process.cwd(), 'tests', 'fixtures', 'memory-test');
    await fs.mkdir(templatesDir, { recursive: true });

    const templates = {
      simple: 'Hello {{ name }}! Age: {{ age }}',
      
      complex: `
<div class="dashboard">
  <h1>{{ title }}</h1>
  <p>{{ description }}</p>
  
  {% for user in users %}
  <div class="user" data-id="{{ user.id }}">
    <h3>{{ user.name }}</h3>
    <p>{{ user.email }}</p>
    {% for role in user.roles %}
      <span class="role">{{ role }}</span>
    {% endfor %}
    <div class="settings">
      <span>{{ user.settings.theme }}</span>
      <span>{{ user.settings.language }}</span>
    </div>
  </div>
  {% endfor %}
</div>`,

      nested: `
# {{ project.name }}
{{ project.description }}

{% for team in project.teams %}
## {{ team.name }}
{% for member in team.members %}
### {{ member.name }} ({{ member.role }})
- Email: {{ member.email }}
- Skills: {{ member.skills | join(', ') }}
{% for project in member.projects %}
#### {{ project.name }}
- Status: {{ project.status }}
- Technologies: {{ project.technologies | join(', ') }}
- Performance: {{ project.metrics.performance }}%
{% endfor %}
{% endfor %}
{% endfor %}`,

      conditional: `
{
  "user": {
    "id": {{ user.id }},
    "name": "{{ user.name }}",
    {% if user.profile %}
    "profile": {
      "bio": "{{ user.profile.bio }}",
      "verified": {{ user.profile.verified | ternary('true', 'false') }}
    },
    {% endif %}
    {% if user.roles %}
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
    "isActive": {{ user.isActive | ternary('true', 'false') }}
  }
}`
    };

    for (const [type, content] of Object.entries(templates)) {
      const templatePath = path.join(templatesDir, `${type}.njk`);
      await fs.writeFile(templatePath, content);
    }

    return templatesDir;
  }

  async takeHeapSnapshot(label) {
    if (!heapdump) return null;

    const filename = `heap-${label}-${Date.now()}.heapsnapshot`;
    const filepath = path.join(this.options.outputDir, filename);
    
    return new Promise((resolve, reject) => {
      heapdump.writeSnapshot(filepath, (err, filename) => {
        if (err) {
          reject(err);
        } else {
          console.log(`Heap snapshot saved: ${filename}`);
          this.snapshots.push({
            label,
            filename,
            timestamp: new Date().toISOString(),
            memoryUsage: process.memoryUsage(),
            heapStats: this.v8HeapStats ? this.v8HeapStats() : null
          });
          resolve(filename);
        }
      });
    });
  }

  async profileMemoryUsage() {
    const testData = await this.generateTestData();
    const templatesDir = await this.createTestTemplates();
    
    console.log(`Starting memory profiling for ${this.options.duration} seconds...`);
    
    const startTime = Date.now();
    const endTime = startTime + (this.options.duration * 1000);
    const sampleInterval = (this.options.duration * 1000) / this.options.samples;
    
    let sampleCount = 0;
    let templateOperationCount = 0;

    // Initial heap snapshot
    if (this.options.heapSnapshots) {
      await this.takeHeapSnapshot('initial');
    }

    // Start heap diff if memwatch available
    let hd;
    if (memwatch) {
      hd = new memwatch.HeapDiff();
    }

    const memoryMonitoringInterval = setInterval(async () => {
      const timestamp = new Date().toISOString();
      const memUsage = process.memoryUsage();
      const heapStats = this.v8HeapStats ? this.v8HeapStats() : null;
      
      this.profiles.push({
        timestamp,
        sampleNumber: sampleCount++,
        templateOperations: templateOperationCount,
        memory: memUsage,
        heapStatistics: heapStats,
        uptime: process.uptime()
      });

      // Take periodic heap snapshots
      if (this.options.heapSnapshots && sampleCount % 20 === 0) {
        await this.takeHeapSnapshot(`sample-${sampleCount}`);
      }

      if (Date.now() >= endTime) {
        clearInterval(memoryMonitoringInterval);
        clearInterval(templateOperationInterval);
        await this.finalizeProfile(hd);
      }
    }, sampleInterval);

    // Continuous template operations
    const templateOperationInterval = setInterval(async () => {
      try {
        const templateType = this.options.templateTypes[templateOperationCount % this.options.templateTypes.length];
        const templatePath = path.join(templatesDir, `${templateType}.njk`);
        const data = testData[templateType];
        
        await unjucks.renderString(await fs.readFile(templatePath, 'utf8'), data);
        templateOperationCount++;
        
        // Force garbage collection periodically if available
        if (global.gc && templateOperationCount % 100 === 0) {
          global.gc();
        }
      } catch (error) {
        console.error(`Template operation error:`, error);
      }
    }, 10); // Aggressive template operations every 10ms

    return new Promise((resolve) => {
      const checkCompletion = setInterval(() => {
        if (Date.now() >= endTime) {
          clearInterval(checkCompletion);
          resolve();
        }
      }, 100);
    });
  }

  async finalizeProfile(heapDiff) {
    console.log('Finalizing memory profile...');

    // Final heap snapshot
    if (this.options.heapSnapshots) {
      await this.takeHeapSnapshot('final');
    }

    // Heap diff analysis
    if (heapDiff) {
      const diff = heapDiff.end();
      this.heapDiffs.push({
        timestamp: new Date().toISOString(),
        diff
      });
      
      console.log('Heap diff summary:');
      console.log(`  Objects allocated: ${diff.change.size_bytes > 0 ? '+' : ''}${diff.change.size_bytes} bytes`);
      console.log(`  Details: ${diff.change.details.length} allocation details`);
    }

    // Force final garbage collection
    if (global.gc) {
      global.gc();
    }
  }

  analyzeMemoryPatterns() {
    if (this.profiles.length === 0) {
      throw new Error('No memory profiles collected');
    }

    const memoryUsages = this.profiles.map(p => p.memory);
    const heapUsages = memoryUsages.map(m => m.heapUsed);
    const rssUsages = memoryUsages.map(m => m.rss);

    const analysis = {
      summary: {
        totalSamples: this.profiles.length,
        duration: this.options.duration,
        templateOperations: this.profiles[this.profiles.length - 1]?.templateOperations || 0
      },
      
      heap: {
        initial: heapUsages[0],
        final: heapUsages[heapUsages.length - 1],
        peak: Math.max(...heapUsages),
        average: heapUsages.reduce((a, b) => a + b, 0) / heapUsages.length,
        growth: heapUsages[heapUsages.length - 1] - heapUsages[0],
        growthRate: (heapUsages[heapUsages.length - 1] - heapUsages[0]) / this.options.duration,
        volatility: this.calculateVolatility(heapUsages)
      },
      
      rss: {
        initial: rssUsages[0],
        final: rssUsages[rssUsages.length - 1],
        peak: Math.max(...rssUsages),
        average: rssUsages.reduce((a, b) => a + b, 0) / rssUsages.length,
        growth: rssUsages[rssUsages.length - 1] - rssUsages[0],
        growthRate: (rssUsages[rssUsages.length - 1] - rssUsages[0]) / this.options.duration
      },
      
      leaks: {
        detected: this.leaks.length,
        details: this.leaks
      },
      
      gc: {
        events: this.gcStats.length,
        details: this.gcStats
      },
      
      snapshots: {
        count: this.snapshots.length,
        files: this.snapshots.map(s => s.filename)
      }
    };

    // Memory leak indicators
    analysis.indicators = {
      suspectedLeak: analysis.heap.growthRate > (1024 * 1024), // > 1MB/sec growth
      highVolatility: analysis.heap.volatility > 0.2,
      excessiveGrowth: analysis.heap.growth > (analysis.heap.initial * 2), // > 200% growth
      gcPressure: analysis.gc.events > (this.options.duration * 2) // > 2 GC events per second
    };

    return analysis;
  }

  calculateVolatility(values) {
    if (values.length < 2) return 0;
    
    const changes = [];
    for (let i = 1; i < values.length; i++) {
      changes.push(Math.abs(values[i] - values[i - 1]) / values[i - 1]);
    }
    
    return changes.reduce((a, b) => a + b, 0) / changes.length;
  }

  async generateReport() {
    const analysis = this.analyzeMemoryPatterns();
    
    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        options: this.options
      },
      analysis,
      rawProfiles: this.profiles,
      heapDiffs: this.heapDiffs,
      snapshots: this.snapshots
    };

    // Save detailed report
    await fs.writeFile(
      path.join(this.options.outputDir, 'memory-analysis.json'),
      JSON.stringify(report, null, 2)
    );

    // Generate summary report
    const summary = {
      status: 'completed',
      memoryHealth: this.assessMemoryHealth(analysis),
      keyMetrics: {
        heapGrowth: `${(analysis.heap.growth / 1024 / 1024).toFixed(2)} MB`,
        growthRate: `${(analysis.heap.growthRate / 1024).toFixed(2)} KB/sec`,
        peakUsage: `${(analysis.heap.peak / 1024 / 1024).toFixed(2)} MB`,
        leaksDetected: analysis.leaks.detected,
        volatility: `${(analysis.heap.volatility * 100).toFixed(1)}%`
      },
      recommendations: this.generateRecommendations(analysis)
    };

    await fs.writeFile(
      path.join(this.options.outputDir, 'memory-summary.json'),
      JSON.stringify(summary, null, 2)
    );

    return { analysis, summary };
  }

  assessMemoryHealth(analysis) {
    const indicators = analysis.indicators;
    const issues = Object.values(indicators).filter(Boolean).length;
    
    if (issues === 0) return 'excellent';
    if (issues <= 1) return 'good';
    if (issues <= 2) return 'warning';
    return 'critical';
  }

  generateRecommendations(analysis) {
    const recommendations = [];
    
    if (analysis.indicators.suspectedLeak) {
      recommendations.push({
        type: 'memory-leak',
        severity: 'high',
        message: 'Suspected memory leak detected - investigate heap snapshots',
        action: 'Analyze heap diff and snapshots for retained objects'
      });
    }
    
    if (analysis.indicators.highVolatility) {
      recommendations.push({
        type: 'memory-volatility',
        severity: 'medium',
        message: 'High memory usage volatility detected',
        action: 'Consider implementing object pooling or caching strategies'
      });
    }
    
    if (analysis.indicators.excessiveGrowth) {
      recommendations.push({
        type: 'memory-growth',
        severity: 'high',
        message: 'Excessive memory growth during operations',
        action: 'Review template caching and object lifecycle management'
      });
    }
    
    if (analysis.indicators.gcPressure) {
      recommendations.push({
        type: 'gc-pressure',
        severity: 'medium',
        message: 'High garbage collection pressure',
        action: 'Optimize object allocation patterns and consider tuning GC'
      });
    }
    
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'healthy',
        severity: 'info',
        message: 'Memory usage patterns appear healthy',
        action: 'Continue monitoring for regressions'
      });
    }
    
    return recommendations;
  }
}

// CLI Interface
async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('duration', {
      alias: 'd',
      type: 'number',
      default: 300,
      describe: 'Profiling duration in seconds'
    })
    .option('samples', {
      alias: 's',
      type: 'number',
      default: 100,
      describe: 'Number of memory samples to collect'
    })
    .option('output-dir', {
      alias: 'o',
      type: 'string',
      default: 'memory-profiles',
      describe: 'Output directory for profiles and snapshots'
    })
    .option('detect-leaks', {
      type: 'boolean',
      default: true,
      describe: 'Enable memory leak detection'
    })
    .option('heap-snapshots', {
      type: 'boolean',
      default: true,
      describe: 'Take heap snapshots during profiling'
    })
    .help()
    .argv;

  try {
    const profiler = new MemoryProfiler({
      duration: argv.duration,
      samples: argv.samples,
      outputDir: argv.outputDir,
      detectLeaks: argv.detectLeaks,
      heapSnapshots: argv.heapSnapshots
    });

    await profiler.createOutputDirectory();
    await profiler.profileMemoryUsage();
    const { analysis, summary } = await profiler.generateReport();

    console.log('\n=== Memory Profile Summary ===');
    console.log(`Status: ${summary.status}`);
    console.log(`Memory Health: ${summary.memoryHealth}`);
    console.log(`Heap Growth: ${summary.keyMetrics.heapGrowth}`);
    console.log(`Growth Rate: ${summary.keyMetrics.growthRate}`);
    console.log(`Peak Usage: ${summary.keyMetrics.peakUsage}`);
    console.log(`Leaks Detected: ${summary.keyMetrics.leaksDetected}`);
    console.log(`Memory Volatility: ${summary.keyMetrics.volatility}`);

    if (summary.recommendations.length > 0) {
      console.log('\n=== Recommendations ===');
      summary.recommendations.forEach(rec => {
        console.log(`[${rec.severity.toUpperCase()}] ${rec.message}`);
        console.log(`  Action: ${rec.action}`);
      });
    }

    // Exit with error code if critical issues detected
    if (summary.memoryHealth === 'critical') {
      console.error('\nCritical memory issues detected!');
      process.exit(1);
    }

  } catch (error) {
    console.error('Memory profiling failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { MemoryProfiler };