# Faker.js Integration Usage Guide

This document demonstrates how to use the integrated faker.js functionality in Unjucks templates.

## Basic Faker Filters

### Personal Data
```njk
Name: {{ fakeName() }}
Email: {{ fakeEmail() }}
Phone: {{ fakePhone() }}
```

### Location Data
```njk
Address: {{ fakeAddress() }}
City: {{ fakeCity() }}
```

### Business Data
```njk
Company: {{ fakeCompany() }}
```

### Technical Data
```njk
UUID: {{ fakeUuid() }}
Random Number: {{ fakeNumber(1, 100) }}
```

### Content Generation
```njk
Short Text: {{ fakeText(2) }}
Paragraph: {{ fakeParagraph() }}
```

### Dates and Booleans
```njk
Random Date: {{ fakeDate() }}
Date Range: {{ fakeDate('2020-01-01', '2025-12-31') }}
Boolean: {{ fakeBoolean() }}
```

### Array Selection
```njk
Color: {{ fakeArrayElement(['red', 'blue', 'green', 'yellow']) }}
Status: {{ fakeArrayElement(['active', 'inactive', 'pending']) }}
```

## Advanced Features

### Deterministic Generation (Seeding)
```njk
{# Set seed for reproducible results #}
{{ fakeSeed(12345) }}
User 1: {{ fakeName() }}
User 2: {{ fakeName() }}

{# Reset with same seed - will generate same sequence #}
{{ fakeSeed(12345) }}
User 1 (again): {{ fakeName() }}
User 2 (again): {{ fakeName() }}
```

### Locale Configuration
```njk
{# Set locale for localized data #}
{{ fakeLocale('es') }}
Spanish Name: {{ fakeName() }}

{{ fakeLocale('fr') }}
French Name: {{ fakeName() }}

{{ fakeLocale('en') }}
English Name: {{ fakeName() }}
```

### Schema-Based Generation
```njk
{# Generate complex objects from schema #}
{% set userSchema = {
  name: 'name',
  email: 'email',
  age: {type: 'number', min: 18, max: 65},
  bio: {type: 'text', sentences: 2},
  skills: ['JavaScript', 'Python', 'Java', 'Go'],
  isActive: 'boolean',
  profile: {
    company: 'company',
    address: 'address',
    phone: 'phone'
  }
} %}

{{ fakeSchema(userSchema) | dump }}
```

## Template Examples

### User Profile Template
```njk
---
to: src/data/user-<%= fakeNumber(1000, 9999) %>.js
---
export const user = {
  id: '<%= fakeUuid() %>',
  name: '<%= fakeName() %>',
  email: '<%= fakeEmail() %>',
  age: <%= fakeNumber(18, 65) %>,
  bio: '<%= fakeText(2) %>',
  company: '<%= fakeCompany() %>',
  address: '<%= fakeAddress() %>',
  city: '<%= fakeCity() %>',
  phone: '<%= fakePhone() %>',
  isActive: <%= fakeBoolean() %>,
  joinDate: '<%= fakeDate('2020-01-01', '2024-12-31').toISOString() %>',
  preferences: {
    theme: '<%= fakeArrayElement(['light', 'dark']) %>',
    language: '<%= fakeArrayElement(['en', 'es', 'fr', 'de']) %>',
    notifications: <%= fakeBoolean() %>
  }
};
```

### Test Data Array
```njk
---
to: tests/fixtures/users.js
---
<%= fakeSeed(54321) %>
export const testUsers = [
<% for i in range(1, 11) %>
  {
    id: <%= i %>,
    name: '<%= fakeName() %>',
    email: '<%= fakeEmail() %>',
    role: '<%= fakeArrayElement(['admin', 'user', 'guest']) %>',
    isActive: <%= fakeBoolean() %>,
    createdAt: '<%= fakeDate('2023-01-01', '2024-12-31').toISOString() %>'
  }<%= ',' if i < 10 else '' %>
<% endfor %>
];
```

### Mock API Response
```njk
---
to: mocks/api/users.json
---
{
  "data": [
<% for i in range(1, 21) %>
    {
      "id": <%= fakeNumber(1, 10000) %>,
      "name": "<%= fakeName() %>",
      "email": "<%= fakeEmail() %>",
      "avatar": "https://i.pravatar.cc/150?u=<%= fakeUuid() %>",
      "company": "<%= fakeCompany() %>",
      "location": "<%= fakeCity() %>",
      "bio": "<%= fakeText(1) %>",
      "joinDate": "<%= fakeDate('2020-01-01', '2024-12-31').toISOString().split('T')[0] %>",
      "isVerified": <%= fakeBoolean() %>,
      "status": "<%= fakeArrayElement(['online', 'offline', 'away']) %>"
    }<%= ',' if i < 20 else '' %>
<% endfor %>
  ],
  "pagination": {
    "total": <%= fakeNumber(100, 1000) %>,
    "page": 1,
    "perPage": 20,
    "hasNext": <%= fakeBoolean() %>
  }
}
```

### Database Seeder
```njk
---
to: database/seeders/<%= name | snakeCase %>_seeder.js
---
const { faker } = require('@faker-js/faker');

// Configure faker for consistent seeding
<%= fakeSeed(12345) %>
faker.seed(12345);

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const users = [];
    
    for (let i = 0; i < <%= count || 100 %>; i++) {
      users.push({
        id: '<%= fakeUuid() %>',
        name: '<%= fakeName() %>',
        email: '<%= fakeEmail() %>',
        phone: '<%= fakePhone() %>',
        address: '<%= fakeAddress() %>',
        city: '<%= fakeCity() %>',
        company: '<%= fakeCompany() %>',
        bio: '<%= fakeText(2) %>',
        isActive: <%= fakeBoolean() %>,
        createdAt: new Date('<%= fakeDate('2020-01-01', '2024-12-31').toISOString() %>'),
        updatedAt: new Date()
      });
    }
    
    await queryInterface.bulkInsert('Users', users, {});
  },
  
  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Users', null, {});
  }
};
```

## Configuration Helper

You can configure faker globally in templates:

```njk
{# Configure faker with options #}
{{ configureFaker({seed: 12345, locale: 'en'}) }}

{# Now all faker functions will use this configuration #}
Name: {{ fakeName() }}
Email: {{ fakeEmail() }}
```

## CLI Usage Examples

Generate fake user data:
```bash
unjucks generate example fake-data-demo --name="test-data" 
```

Generate with specific count:
```bash
unjucks generate user profile --count=50 --seed=12345
```

## Best Practices

1. **Use Seeds for Testing**: Always set a seed when generating test data to ensure reproducible results.
2. **Validate Generated Data**: Use appropriate validation in your tests to ensure fake data meets your requirements.
3. **Locale Consistency**: Set locale early in templates if you need localized data.
4. **Schema Validation**: When using `fakeSchema()`, ensure your schema matches your data requirements.
5. **Performance**: For large datasets, consider generating data in chunks or using streams.

## Error Handling

All faker filters include error handling and will return sensible defaults if faker.js encounters issues:

- `fakeName()` falls back to "John Doe"
- `fakeEmail()` falls back to "user@example.com"  
- `fakeUuid()` generates a UUID using fallback algorithm
- `fakeNumber()` uses Math.random() as fallback
- etc.

This ensures your templates always generate valid output even if faker.js has issues.