import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics for Fortune 5 scale monitoring
const templateGenerationRate = new Rate('template_generation_success_rate');
const templateGenerationDuration = new Trend('template_generation_duration');
const memoryUsageCounter = new Counter('memory_usage_spikes');
const concurrentOperationsRate = new Rate('concurrent_operations_success_rate');

// Load test configuration for Fortune 5 scale
export const options = {
  stages: [
    // Ramp-up phase
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 500 },   // Scale to 500 users
    { duration: '10m', target: 1000 }, // Scale to 1000 users (Fortune 5 peak)
    { duration: '15m', target: 2000 }, // Scale to 2000 users (stress test)
    { duration: '10m', target: 2000 }, // Sustain peak load
    { duration: '5m', target: 500 },   // Scale down
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    // Fortune 5 scale SLA requirements
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% under 500ms, 99% under 1s
    http_req_failed: ['rate<0.1'], // Error rate under 10%
    template_generation_success_rate: ['rate>0.95'], // 95% success rate
    template_generation_duration: ['p(95)<200'], // 95% of generations under 200ms
    concurrent_operations_success_rate: ['rate>0.90'], // 90% concurrent success
  },
  ext: {
    loadimpact: {
      distribution: {
        'amazon:us:ashburn': { loadZone: 'amazon:us:ashburn', percent: 25 },
        'amazon:eu:dublin': { loadZone: 'amazon:eu:dublin', percent: 25 },
        'amazon:ap:singapore': { loadZone: 'amazon:ap:singapore', percent: 25 },
        'amazon:us:oregon': { loadZone: 'amazon:us:oregon', percent: 25 },
      },
    },
  },
};

// Base URL for the Unjucks service (if running as service)
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test data generators
function generateLargeTemplateData() {
  return {
    users: Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      department: ['Engineering', 'Sales', 'Marketing', 'HR'][i % 4],
      active: Math.random() > 0.1,
      metadata: {
        created: this.getDeterministicTimestamp() - Math.random() * 365 * 24 * 60 * 60 * 1000,
        lastLogin: this.getDeterministicTimestamp() - Math.random() * 30 * 24 * 60 * 60 * 1000,
        permissions: Array.from({ length: Math.floor(Math.random() * 10) }, 
          (_, j) => `permission_${j}`)
      }
    })),
    config: {
      theme: 'enterprise',
      locale: 'en-US',
      features: ['analytics', 'reporting', 'automation', 'security']
    }
  };
}

function generateComplexTemplate() {
  return `
<!DOCTYPE html>
<html lang="{{ config.locale }}">
<head>
  <title>Enterprise Dashboard - {{ config.theme | title }}</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body class="theme-{{ config.theme }}">
  <header class="main-header">
    <h1>User Management System</h1>
    <nav>
      {% for feature in config.features %}
        <a href="/{{ feature }}" class="nav-{{ feature }}">
          {{ feature | title }}
        </a>
      {% endfor %}
    </nav>
  </header>

  <main class="dashboard">
    <section class="user-grid">
      {% for user in users %}
        {% if user.active %}
          <div class="user-card" data-user-id="{{ user.id }}">
            <header class="user-header">
              <h3>{{ user.name }}</h3>
              <span class="department">{{ user.department }}</span>
            </header>
            
            <div class="user-details">
              <p class="email">{{ user.email }}</p>
              <p class="created">
                Joined: {{ user.metadata.created | date('YYYY-MM-DD') }}
              </p>
              <p class="last-login">
                Last seen: {{ user.metadata.lastLogin | timeago }}
              </p>
            </div>

            {% if user.metadata.permissions %}
              <div class="permissions">
                <h4>Permissions</h4>
                <ul>
                  {% for permission in user.metadata.permissions %}
                    <li class="permission-{{ permission | replace('_', '-') }}">
                      {{ permission | replace('_', ' ') | title }}
                    </li>
                  {% endfor %}
                </ul>
              </div>
            {% endif %}

            <footer class="user-actions">
              <button class="btn-edit" data-action="edit" data-user="{{ user.id }}">
                Edit
              </button>
              <button class="btn-disable" data-action="disable" data-user="{{ user.id }}">
                Disable
              </button>
            </footer>
          </div>
        {% endif %}
      {% endfor %}
    </section>

    <aside class="dashboard-stats">
      <div class="stat-card">
        <h3>Total Users</h3>
        <span class="stat-value">{{ users | length }}</span>
      </div>
      
      <div class="stat-card">
        <h3>Active Users</h3>
        <span class="stat-value">
          {{ users | selectattr('active') | list | length }}
        </span>
      </div>

      {% for dept in ['Engineering', 'Sales', 'Marketing', 'HR'] %}
        <div class="stat-card">
          <h3>{{ dept }}</h3>
          <span class="stat-value">
            {{ users | selectattr('department', 'equalto', dept) | list | length }}
          </span>
        </div>
      {% endfor %}
    </aside>
  </main>

  <footer class="main-footer">
    <p>&copy; {{ "now" | date('YYYY') }} Fortune 5 Enterprise System</p>
    <p>Generated at {{ "now" | date('YYYY-MM-DD HH:mm:ss') }}</p>
  </footer>
</body>
</html>`;
}

// Main load test function
export default function () {
  const testStartTime = this.getDeterministicTimestamp();
  
  // Test 1: Simple template generation
  const simpleTemplate = 'Hello {{ name }}, welcome to {{ platform }}!';
  const simpleData = { 
    name: `User-${Math.floor(Math.random() * 10000)}`, 
    platform: 'Unjucks Enterprise' 
  };
  
  // Simulate template generation API call
  const simpleResponse = http.post(`${BASE_URL}/api/render`, JSON.stringify({
    template: simpleTemplate,
    data: simpleData
  }), {
    headers: { 'Content-Type': 'application/json' },
    timeout: '10s'
  });
  
  const simpleSuccess = check(simpleResponse, {
    'simple template status is 200': (r) => r.status === 200,
    'simple template response time < 100ms': (r) => r.timings.duration < 100,
  });
  
  templateGenerationRate.add(simpleSuccess);
  templateGenerationDuration.add(simpleResponse.timings.duration);

  // Test 2: Complex template with large dataset
  const complexTemplate = generateComplexTemplate();
  const complexData = generateLargeTemplateData();
  
  const complexResponse = http.post(`${BASE_URL}/api/render`, JSON.stringify({
    template: complexTemplate,
    data: complexData
  }), {
    headers: { 'Content-Type': 'application/json' },
    timeout: '30s'
  });
  
  const complexSuccess = check(complexResponse, {
    'complex template status is 200': (r) => r.status === 200,
    'complex template response time < 1000ms': (r) => r.timings.duration < 1000,
    'complex template size > 10KB': (r) => r.body.length > 10240,
  });
  
  templateGenerationRate.add(complexSuccess);
  templateGenerationDuration.add(complexResponse.timings.duration);

  // Test 3: Concurrent operations simulation
  const concurrentPromises = [];
  for (let i = 0; i < 5; i++) {
    const concurrentData = {
      id: i,
      timestamp: this.getDeterministicTimestamp(),
      data: Array.from({ length: 100 }, (_, j) => ({ id: j, value: Math.random() }))
    };
    
    concurrentPromises.push(
      http.asyncRequest('POST', `${BASE_URL}/api/render`, JSON.stringify({
        template: '{% for item in data %}{{ item.id }}: {{ item.value | round(2) }}\n{% endfor %}',
        data: concurrentData
      }), {
        headers: { 'Content-Type': 'application/json' },
        timeout: '15s'
      })
    );
  }
  
  // Wait for all concurrent operations
  const concurrentResponses = http.batch(concurrentPromises);
  const concurrentSuccess = concurrentResponses.every(r => r.status === 200);
  concurrentOperationsRate.add(concurrentSuccess);

  // Test 4: Memory stress test
  const memoryStressData = {
    largeArray: Array.from({ length: 10000 }, (_, i) => ({
      id: i,
      content: `Large content block ${i}`.repeat(100),
      nested: {
        level1: { level2: { level3: `Deep nesting ${i}` } }
      }
    }))
  };
  
  const memoryResponse = http.post(`${BASE_URL}/api/render`, JSON.stringify({
    template: `
      {% for item in largeArray %}
        <div>{{ item.id }}: {{ item.nested.level1.level2.level3 }}</div>
      {% endfor %}
    `,
    data: memoryStressData
  }), {
    headers: { 'Content-Type': 'application/json' },
    timeout: '45s'
  });
  
  const memorySuccess = check(memoryResponse, {
    'memory stress status is 200': (r) => r.status === 200,
    'memory stress response time < 5000ms': (r) => r.timings.duration < 5000,
  });
  
  if (!memorySuccess) {
    memoryUsageCounter.add(1);
  }

  // Test 5: File operation simulation
  const fileTemplate = `
    {% for file in files %}
      Generating file: {{ file.name }}
      Size: {{ file.size | filesizeformat }}
      {% if file.content %}
        Content preview: {{ file.content | truncate(100) }}
      {% endif %}
    {% endfor %}
  `;
  
  const fileData = {
    files: Array.from({ length: 50 }, (_, i) => ({
      name: `file-${i}.txt`,
      size: Math.floor(Math.random() * 1000000),
      content: `File content ${i}`.repeat(200)
    }))
  };
  
  const fileResponse = http.post(`${BASE_URL}/api/render`, JSON.stringify({
    template: fileTemplate,
    data: fileData
  }), {
    headers: { 'Content-Type': 'application/json' },
    timeout: '20s'
  });
  
  check(fileResponse, {
    'file operation status is 200': (r) => r.status === 200,
    'file operation response time < 2000ms': (r) => r.timings.duration < 2000,
  });

  // Test execution time tracking
  const testDuration = this.getDeterministicTimestamp() - testStartTime;
  if (testDuration > 10000) { // Alert if test iteration takes more than 10 seconds
    console.warn(`⚠️  Slow test execution: ${testDuration}ms`);
  }

  // Simulate user think time
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

// Setup function (runs once per VU)
export function setup() {
  console.log('🚀 Starting Fortune 5 Scale Load Test');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Test configuration:');
  console.log('- Peak concurrent users: 2000');
  console.log('- Test duration: ~45 minutes');
  console.log('- Global distribution: 4 regions');
  
  // Health check
  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    console.error('❌ Health check failed. Service may be unavailable.');
  } else {
    console.log('✅ Health check passed. Service is ready.');
  }
  
  return { startTime: this.getDeterministicTimestamp() };
}

// Teardown function (runs once after all VUs complete)
export function teardown(data) {
  const totalDuration = this.getDeterministicTimestamp() - data.startTime;
  console.log(`🏁 Load test completed in ${(totalDuration / 1000 / 60).toFixed(2)} minutes`);
  console.log('📊 Check the detailed metrics in your k6 output');
  
  // Generate summary report
  console.log('📈 Performance Summary:');
  console.log('- Template Generation Success Rate: Check metrics');
  console.log('- Memory Usage Spikes: Check counters');
  console.log('- Concurrent Operations: Check success rates');
}