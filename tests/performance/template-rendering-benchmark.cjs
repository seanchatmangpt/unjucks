#!/usr/bin/env node

const { performance } = require('perf_hooks');
const fs = require('fs/promises');
const path = require('path');
const nunjucks = require('nunjucks');

class TemplateRenderingBenchmark {
  constructor() {
    this.env = new nunjucks.Environment(new nunjucks.FileSystemLoader(path.join(__dirname, 'templates')));
    this.results = {
      simpleTemplate: {},
      complexTemplate: {},
      largeDataset: {},
      manySmallTemplates: {},
      templateInheritance: {},
      macrosAndFilters: {}
    };
  }

  async measureRenderingPerformance(testName, iterations, renderFn) {
    console.log(`🎨 Benchmarking ${testName} (${iterations} iterations)...`);
    
    const startMemory = process.memoryUsage();
    const startTime = performance.now();
    
    try {
      const results = [];
      for (let i = 0; i < iterations; i++) {
        const result = await renderFn(i);
        results.push(result);
      }
      
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      
      const duration = endTime - startTime;
      const avgDuration = duration / iterations;
      const throughput = iterations / (duration / 1000);
      
      const result = {
        iterations,
        totalDuration: duration,
        avgDuration,
        throughput,
        memoryDelta: endMemory.rss - startMemory.rss,
        totalSize: results.reduce((sum, r) => sum + (r?.length || 0), 0)
      };
      
      this.results[testName] = result;
      console.log(`✅ ${testName}: ${Math.round(avgDuration)}ms avg, ${Math.round(throughput)} renders/sec`);
      
      return result;
    } catch (error) {
      console.error(`❌ ${testName} failed:`, error.message);
      this.results[testName] = { error: error.message };
      return null;
    }
  }

  async benchmarkSimpleTemplate() {
    const template = 'Hello {{ name }}! Today is {{ date }}.';
    
    return this.measureRenderingPerformance('simpleTemplate', 10000, async (i) => {
      return this.env.renderString(template, {
        name: `User${i}`,
        date: new Date().toISOString()
      });
    });
  }

  async benchmarkComplexTemplate() {
    const template = `
      <html>
        <head><title>{{ title }}</title></head>
        <body>
          <h1>{{ title }}</h1>
          <nav>
            {% for link in navigation %}
              <a href="{{ link.url }}" class="{{ 'active' if link.active else '' }}">
                {{ link.title }}
              </a>
            {% endfor %}
          </nav>
          <main>
            {% for post in posts %}
              <article class="post">
                <h2>{{ post.title }}</h2>
                <meta>By {{ post.author }} on {{ post.date | date('Y-m-d') }}</meta>
                <div class="content">
                  {{ post.content | markdown | safe }}
                </div>
                <div class="tags">
                  {% for tag in post.tags %}
                    <span class="tag tag-{{ tag | lower }}">{{ tag }}</span>
                  {% endfor %}
                </div>
              </article>
            {% endfor %}
          </main>
        </body>
      </html>
    `;
    
    return this.measureRenderingPerformance('complexTemplate', 1000, async (i) => {
      return this.env.renderString(template, {
        title: `Blog Post ${i}`,
        navigation: [
          { url: '/', title: 'Home', active: i % 3 === 0 },
          { url: '/about', title: 'About', active: false },
          { url: '/contact', title: 'Contact', active: false }
        ],
        posts: Array.from({ length: 10 }, (_, j) => ({
          title: `Post ${j}`,
          author: `Author ${j % 3}`,
          date: new Date(2023, i % 12, j % 28),
          content: `# Post Content ${j}\n\nThis is **sample** content for post ${j}.`.repeat(5),
          tags: [`tag${j % 5}`, `category${j % 3}`]
        }))
      });
    });
  }

  async benchmarkLargeDataset() {
    const template = `
      <table>
        <thead>
          <tr>
            {% for col in columns %}
              <th>{{ col }}</th>
            {% endfor %}
          </tr>
        </thead>
        <tbody>
          {% for row in data %}
            <tr class="{{ 'even' if loop.index0 % 2 == 0 else 'odd' }}">
              {% for cell in row %}
                <td>{{ cell }}</td>
              {% endfor %}
            </tr>
          {% endfor %}
        </tbody>
      </table>
    `;
    
    const largeDataset = {
      columns: Array.from({ length: 20 }, (_, i) => `Column ${i + 1}`),
      data: Array.from({ length: 5000 }, (_, i) => 
        Array.from({ length: 20 }, (_, j) => `Cell ${i}-${j}`)
      )
    };
    
    return this.measureRenderingPerformance('largeDataset', 10, async (i) => {
      return this.env.renderString(template, largeDataset);
    });
  }

  async benchmarkManySmallTemplates() {
    const templates = Array.from({ length: 100 }, (_, i) => 
      `Template ${i}: {{ value${i} }} - {{ common }}`
    );
    
    return this.measureRenderingPerformance('manySmallTemplates', 1000, async (i) => {
      const templateIndex = i % templates.length;
      const data = {
        [`value${templateIndex}`]: `Value for ${i}`,
        common: `Common data ${i}`
      };
      
      return this.env.renderString(templates[templateIndex], data);
    });
  }

  async benchmarkTemplateInheritance() {
    const baseTemplate = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>{% block title %}Default Title{% endblock %}</title>
        </head>
        <body>
          <header>{% block header %}Default Header{% endblock %}</header>
          <main>{% block content %}Default Content{% endblock %}</main>
          <footer>{% block footer %}Default Footer{% endblock %}</footer>
        </body>
      </html>
    `;
    
    const childTemplate = `
      {% extends "base.html" %}
      
      {% block title %}{{ pageTitle }}{% endblock %}
      
      {% block header %}
        <h1>{{ pageTitle }}</h1>
        <nav>{{ navigation | safe }}</nav>
      {% endblock %}
      
      {% block content %}
        {% for item in items %}
          <div class="item">
            <h2>{{ item.title }}</h2>
            <p>{{ item.description }}</p>
          </div>
        {% endfor %}
      {% endblock %}
    `;
    
    // Setup templates in memory
    this.env.addGlobal('base.html', baseTemplate);
    
    return this.measureRenderingPerformance('templateInheritance', 1000, async (i) => {
      return this.env.renderString(childTemplate, {
        pageTitle: `Page ${i}`,
        navigation: '<a href="/">Home</a> <a href="/about">About</a>',
        items: Array.from({ length: 10 }, (_, j) => ({
          title: `Item ${j}`,
          description: `Description for item ${j} on page ${i}`
        }))
      });
    });
  }

  async benchmarkMacrosAndFilters() {
    const template = `
      {% macro renderCard(title, content, tags) %}
        <div class="card">
          <h3>{{ title | title }}</h3>
          <div class="content">{{ content | truncate(200) }}</div>
          <div class="tags">
            {% for tag in tags %}
              <span class="tag">{{ tag | upper }}</span>
            {% endfor %}
          </div>
        </div>
      {% endmacro %}
      
      <div class="cards">
        {% for card in cards %}
          {{ renderCard(card.title, card.content, card.tags) }}
        {% endfor %}
      </div>
    `;
    
    return this.measureRenderingPerformance('macrosAndFilters', 1000, async (i) => {
      return this.env.renderString(template, {
        cards: Array.from({ length: 20 }, (_, j) => ({
          title: `card title ${j} for iteration ${i}`,
          content: `This is the content for card ${j}. `.repeat(20),
          tags: [`tag${j % 5}`, `category${j % 3}`, `type${j % 4}`]
        }))
      });
    });
  }

  async runAllBenchmarks() {
    console.log('🎨 Starting Template Rendering Benchmarks...\n');
    
    await this.benchmarkSimpleTemplate();
    await this.benchmarkComplexTemplate();
    await this.benchmarkLargeDataset();
    await this.benchmarkManySmallTemplates();
    await this.benchmarkTemplateInheritance();
    await this.benchmarkMacrosAndFilters();
    
    this.generateReport();
    
    return this.results;
  }

  generateReport() {
    console.log('\n📊 Template Rendering Benchmark Report:');
    console.log('========================================');
    
    const sortedResults = Object.entries(this.results)
      .filter(([_, result]) => !result.error)
      .sort((a, b) => a[1].avgDuration - b[1].avgDuration);
    
    console.log('\nPerformance Ranking (fastest to slowest):');
    sortedResults.forEach(([name, result], index) => {
      const memory = Math.round(result.memoryDelta / 1024 / 1024);
      console.log(`${index + 1}. ${name}: ${Math.round(result.avgDuration)}ms avg (${Math.round(result.throughput)} renders/sec, ${memory}MB)`);
    });
    
    // Performance analysis
    const fastest = sortedResults[0];
    const slowest = sortedResults[sortedResults.length - 1];
    
    if (fastest && slowest) {
      const speedDiff = slowest[1].avgDuration / fastest[1].avgDuration;
      console.log(`\n🏎️  Fastest: ${fastest[0]} (${Math.round(fastest[1].avgDuration)}ms)`);
      console.log(`🐌 Slowest: ${slowest[0]} (${Math.round(slowest[1].avgDuration)}ms, ${speedDiff.toFixed(1)}x slower)`);
    }
  }

  async saveResults() {
    const resultsPath = path.join(__dirname, 'results', 'template-rendering-benchmark.json');
    await fs.mkdir(path.dirname(resultsPath), { recursive: true });
    
    const fullResults = {
      timestamp: new Date().toISOString(),
      environment: 'clean-room',
      nunjucksVersion: require('nunjucks/package.json').version,
      nodeVersion: process.version,
      results: this.results
    };
    
    await fs.writeFile(resultsPath, JSON.stringify(fullResults, null, 2));
    console.log(`💾 Results saved to: ${resultsPath}`);
    
    return fullResults;
  }
}

// Run if called directly
if (require.main === module) {
  const benchmark = new TemplateRenderingBenchmark();
  benchmark.runAllBenchmarks()
    .then(() => benchmark.saveResults())
    .catch(console.error);
}

module.exports = TemplateRenderingBenchmark;