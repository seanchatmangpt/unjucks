import { bench, describe } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import nunjucks from 'nunjucks';

// Configure Nunjucks environment
const nunjucksEnv = new nunjucks.Environment(
  new nunjucks.FileSystemLoader('tests/fixtures')
);

describe('Template Generation Benchmarks', () => {
  
  bench('Simple template rendering', async () => {
    const template = 'Hello {{ name }}! Welcome to {{ platform }}.';
    const data = {
      name: 'Fortune 5 User',
      platform: 'Unjucks'
    };
    
    nunjucksEnv.renderString(template, data);
  }, {
    iterations: 10000,
    warmupIterations: 1000
  });

  bench('Complex template with loops and conditionals', async () => {
    const template = `
{% for user in users %}
  {% if user.active %}
    <div class="user-card">
      <h2>{{ user.name }}</h2>
      <p>Email: {{ user.email }}</p>
      {% if user.roles %}
        <ul>
        {% for role in user.roles %}
          <li>{{ role }}</li>
        {% endfor %}
        </ul>
      {% endif %}
    </div>
  {% endif %}
{% endfor %}`;

    const data = {
      users: Array.from({ length: 100 }, (_, i) => ({
        name: `User ${i}`,
        email: `user${i}@example.com`,
        active: i % 2 === 0,
        roles: i % 3 === 0 ? ['admin', 'user'] : ['user']
      }))
    };
    
    nunjucksEnv.renderString(template, data);
  }, {
    iterations: 1000,
    warmupIterations: 100
  });

  bench('Large dataset template rendering', async () => {
    const template = `
<table>
  <thead>
    <tr>
      <th>ID</th>
      <th>Name</th>
      <th>Department</th>
      <th>Salary</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    {% for employee in employees %}
    <tr>
      <td>{{ employee.id }}</td>
      <td>{{ employee.name }}</td>
      <td>{{ employee.department }}</td>
      <td>{{ employee.salary | currency }}</td>
      <td>{{ employee.status }}</td>
    </tr>
    {% endfor %}
  </tbody>
</table>`;

    // Add custom filter
    nunjucksEnv.addFilter('currency', function(value) {
      return '$' + value.toLocaleString();
    });

    const data = {
      employees: Array.from({ length: 10000 }, (_, i) => ({
        id: i + 1,
        name: `Employee ${i + 1}`,
        department: ['Engineering', 'Sales', 'Marketing', 'HR'][i % 4],
        salary: 50000 + (i % 100) * 1000,
        status: i % 10 === 0 ? 'Inactive' : 'Active'
      }))
    };
    
    nunjucksEnv.renderString(template, data);
  }, {
    iterations: 100,
    warmupIterations: 10
  });

  bench('Template compilation and caching', async () => {
    const templateString = `
{% macro renderField(field) %}
  <div class="field">
    <label>{{ field.label }}</label>
    {% if field.type === 'select' %}
      <select name="{{ field.name }}">
        {% for option in field.options %}
          <option value="{{ option.value }}">{{ option.label }}</option>
        {% endfor %}
      </select>
    {% elif field.type === 'textarea' %}
      <textarea name="{{ field.name }}">{{ field.value }}</textarea>
    {% else %}
      <input type="{{ field.type }}" name="{{ field.name }}" value="{{ field.value }}">
    {% endif %}
  </div>
{% endmacro %}

<form>
  {% for field in fields %}
    {{ renderField(field) }}
  {% endfor %}
  <button type="submit">Submit</button>
</form>`;

    const data = {
      fields: [
        { name: 'firstName', label: 'First Name', type: 'text', value: '' },
        { name: 'lastName', label: 'Last Name', type: 'text', value: '' },
        { name: 'email', label: 'Email', type: 'email', value: '' },
        { 
          name: 'country', 
          label: 'Country', 
          type: 'select',
          options: [
            { value: 'us', label: 'United States' },
            { value: 'ca', label: 'Canada' },
            { value: 'uk', label: 'United Kingdom' }
          ]
        },
        { name: 'bio', label: 'Biography', type: 'textarea', value: '' }
      ]
    };
    
    // Test template compilation and rendering
    const compiledTemplate = nunjucks.compile(templateString, nunjucksEnv);
    compiledTemplate.render(data);
  }, {
    iterations: 5000,
    warmupIterations: 500
  });

  bench('File-based template loading', async () => {
    // Create a temporary template file
    const templateDir = 'tests/tmp/benchmark-templates';
    await fs.ensureDir(templateDir);
    
    const templatePath = path.join(templateDir, 'benchmark-template.njk');
    const templateContent = `
<!DOCTYPE html>
<html>
<head>
  <title>{{ title }}</title>
  <meta charset="utf-8">
</head>
<body>
  <header>
    <h1>{{ title }}</h1>
    <nav>
      {% for item in navigation %}
        <a href="{{ item.url }}">{{ item.label }}</a>
      {% endfor %}
    </nav>
  </header>
  
  <main>
    {% for section in content %}
      <section>
        <h2>{{ section.title }}</h2>
        <p>{{ section.description }}</p>
        {% if section.items %}
          <ul>
            {% for item in section.items %}
              <li>{{ item }}</li>
            {% endfor %}
          </ul>
        {% endif %}
      </section>
    {% endfor %}
  </main>
  
  <footer>
    <p>&copy; {{ year }} {{ company }}</p>
  </footer>
</body>
</html>`;
    
    await fs.writeFile(templatePath, templateContent);
    
    // Configure file loader
    const fileLoader = new nunjucks.FileSystemLoader(templateDir);
    const fileEnv = new nunjucks.Environment(fileLoader);
    
    const data = {
      title: 'Fortune 5 Performance Test',
      year: this.getDeterministicDate().getFullYear(),
      company: 'Unjucks Corp',
      navigation: [
        { url: '/', label: 'Home' },
        { url: '/about', label: 'About' },
        { url: '/contact', label: 'Contact' }
      ],
      content: Array.from({ length: 20 }, (_, i) => ({
        title: `Section ${i + 1}`,
        description: `This is the description for section ${i + 1}`,
        items: Array.from({ length: 5 }, (_, j) => `Item ${j + 1} in section ${i + 1}`)
      }))
    };
    
    fileEnv.render('benchmark-template.njk', data);
    
    // Cleanup
    await fs.remove(templateDir);
  }, {
    iterations: 1000,
    warmupIterations: 100
  });

  bench('Concurrent template rendering', async () => {
    const template = `
{% for item in items %}
  <div class="item-{{ loop.index }}">
    <h3>{{ item.title }}</h3>
    <p>{{ item.description }}</p>
    <span class="metadata">Created: {{ item.created | date }}</span>
  </div>
{% endfor %}`;

    // Add date filter
    nunjucksEnv.addFilter('date', function(date) {
      return new Date(date).toLocaleDateString();
    });

    const createData = (id) => ({
      items: Array.from({ length: 100 }, (_, i) => ({
        title: `Item ${id}-${i}`,
        description: `Description for item ${id}-${i}`,
        created: this.getDeterministicTimestamp() - (i * 1000 * 60 * 60) // Hours ago
      }))
    });

    // Render multiple templates concurrently
    const concurrentTasks = Array.from({ length: 10 }, (_, i) =>
      nunjucksEnv.renderString(template, createData(i))
    );
    
    await Promise.all(concurrentTasks);
  }, {
    iterations: 100,
    warmupIterations: 10
  });

  bench('Memory-intensive template operations', async () => {
    // Create a large nested data structure
    const createNestedData = (depth, breadth) => {
      if (depth === 0) {
        return `Data at depth 0 - ${Math.random()}`;
      }
      
      const data = {};
      for (let i = 0; i < breadth; i++) {
        data[`item_${i}`] = createNestedData(depth - 1, breadth);
      }
      return data;
    };

    const template = `
{% macro renderData(data, level = 0) %}
  {% if data is string %}
    <span class="data-value">{{ data }}</span>
  {% else %}
    <ul class="level-{{ level }}">
      {% for key, value in data %}
        <li>
          <strong>{{ key }}:</strong>
          {{ renderData(value, level + 1) }}
        </li>
      {% endfor %}
    </ul>
  {% endif %}
{% endmacro %}

<div class="nested-data">
  {{ renderData(nestedData) }}
</div>`;

    const data = {
      nestedData: createNestedData(4, 3) // 4 levels deep, 3 items per level
    };
    
    nunjucksEnv.renderString(template, data);
  }, {
    iterations: 50,
    warmupIterations: 5
  });
});