// MongoDB Test Database Initialization
// Sets up test collections and users for Unjucks testing

// Switch to test database
db = db.getSiblingDB('unjucks_test');

// Create test user with read/write permissions
db.createUser({
  user: 'test_user',
  pwd: 'test_password',
  roles: [
    {
      role: 'readWrite',
      db: 'unjucks_test'
    }
  ]
});

// Create read-only user for monitoring
db.createUser({
  user: 'test_readonly',
  pwd: 'readonly_password',
  roles: [
    {
      role: 'read',
      db: 'unjucks_test'
    }
  ]
});

// Create test collections
db.createCollection('test_templates', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'content'],
      properties: {
        name: {
          bsonType: 'string',
          description: 'Template name must be a string and is required'
        },
        content: {
          bsonType: 'string',
          description: 'Template content must be a string and is required'
        },
        variables: {
          bsonType: 'object',
          description: 'Template variables must be an object'
        },
        metadata: {
          bsonType: 'object',
          description: 'Template metadata must be an object'
        },
        tags: {
          bsonType: 'array',
          items: {
            bsonType: 'string'
          },
          description: 'Tags must be an array of strings'
        },
        createdAt: {
          bsonType: 'date',
          description: 'Creation date must be a date'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'Update date must be a date'
        }
      }
    }
  }
});

db.createCollection('test_generators', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['templateId', 'name'],
      properties: {
        templateId: {
          bsonType: 'objectId',
          description: 'Template ID must be an ObjectId and is required'
        },
        name: {
          bsonType: 'string',
          description: 'Generator name must be a string and is required'
        },
        outputPath: {
          bsonType: 'string',
          description: 'Output path must be a string'
        },
        status: {
          bsonType: 'string',
          enum: ['pending', 'running', 'completed', 'failed'],
          description: 'Status must be one of: pending, running, completed, failed'
        },
        result: {
          bsonType: 'object',
          description: 'Result must be an object'
        },
        createdAt: {
          bsonType: 'date',
          description: 'Creation date must be a date'
        }
      }
    }
  }
});

db.createCollection('test_configs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['key', 'value'],
      properties: {
        key: {
          bsonType: 'string',
          description: 'Config key must be a string and is required'
        },
        value: {
          description: 'Config value is required'
        },
        environment: {
          bsonType: 'string',
          description: 'Environment must be a string'
        },
        createdAt: {
          bsonType: 'date',
          description: 'Creation date must be a date'
        }
      }
    }
  }
});

db.createCollection('test_performance_data', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['batchId', 'dataType', 'payload'],
      properties: {
        batchId: {
          bsonType: 'int',
          description: 'Batch ID must be an integer and is required'
        },
        dataType: {
          bsonType: 'string',
          description: 'Data type must be a string and is required'
        },
        payload: {
          bsonType: 'object',
          description: 'Payload must be an object and is required'
        },
        processingTime: {
          bsonType: 'int',
          description: 'Processing time must be an integer'
        },
        createdAt: {
          bsonType: 'date',
          description: 'Creation date must be a date'
        }
      }
    }
  }
});

// Create indexes for performance
db.test_templates.createIndex({ 'name': 1 }, { unique: true });
db.test_templates.createIndex({ 'createdAt': 1 });
db.test_templates.createIndex({ 'tags': 1 });

db.test_generators.createIndex({ 'templateId': 1 });
db.test_generators.createIndex({ 'status': 1 });
db.test_generators.createIndex({ 'createdAt': 1 });

db.test_configs.createIndex({ 'key': 1 }, { unique: true });
db.test_configs.createIndex({ 'environment': 1 });

db.test_performance_data.createIndex({ 'batchId': 1 });
db.test_performance_data.createIndex({ 'dataType': 1 });
db.test_performance_data.createIndex({ 'createdAt': 1 });

// Insert initial test configuration
const now = new Date();
db.test_configs.insertMany([
  {
    key: 'max_template_size',
    value: 1048576,
    environment: 'test',
    createdAt: now
  },
  {
    key: 'max_generators_per_template',
    value: 100,
    environment: 'test',
    createdAt: now
  },
  {
    key: 'default_timeout',
    value: 30000,
    environment: 'test',
    createdAt: now
  },
  {
    key: 'parallel_generation_limit',
    value: 10,
    environment: 'test',
    createdAt: now
  },
  {
    key: 'database_initialized',
    value: true,
    environment: 'test',
    createdAt: now
  }
]);

// Insert sample test templates
db.test_templates.insertMany([
  {
    name: 'basic-component',
    content: '// Basic component template\nexport default function {{ componentName }}() {\n  return <div>{{ componentName }}</div>;\n}',
    variables: {
      componentName: 'string'
    },
    metadata: {
      type: 'react-component',
      framework: 'react'
    },
    tags: ['react', 'component', 'basic'],
    createdAt: now,
    updatedAt: now
  },
  {
    name: 'api-route',
    content: '// API route template\nexport default function handler(req, res) {\n  // {{ routeName }} implementation\n  res.status(200).json({ message: "{{ routeName }} endpoint" });\n}',
    variables: {
      routeName: 'string'
    },
    metadata: {
      type: 'api-route',
      framework: 'next.js'
    },
    tags: ['api', 'route', 'next.js'],
    createdAt: now,
    updatedAt: now
  },
  {
    name: 'test-file',
    content: '// Test file template\nimport { test, expect } from "vitest";\n\ntest("{{ testName }}", () => {\n  // Test implementation\n  expect(true).toBe(true);\n});',
    variables: {
      testName: 'string'
    },
    metadata: {
      type: 'test',
      framework: 'vitest'
    },
    tags: ['test', 'vitest', 'unit'],
    createdAt: now,
    updatedAt: now
  }
]);

// Insert sample performance test data
const performanceData = [];
for (let i = 1; i <= 1000; i++) {
  performanceData.push({
    batchId: (i % 100) + 1,
    dataType: 'test_generation',
    payload: {
      templateName: `template_${(i % 50) + 1}`,
      variables: {
        index: i,
        timestamp: now
      },
      complexity: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low'
    },
    processingTime: Math.floor(Math.random() * 1000) + 100,
    createdAt: new Date(now.getTime() + i * 1000)
  });
}
db.test_performance_data.insertMany(performanceData);

// Create health check function
db.system.js.save({
  _id: 'healthCheck',
  value: function() {
    const templateCount = db.test_templates.countDocuments();
    const generatorCount = db.test_generators.countDocuments();
    const configCount = db.test_configs.countDocuments();
    
    return {
      status: 'healthy',
      details: {
        database: 'unjucks_test',
        timestamp: new Date(),
        collections: {
          templates: templateCount,
          generators: generatorCount,
          configs: configCount
        },
        indexes: {
          templates: db.test_templates.getIndexes().length,
          generators: db.test_generators.getIndexes().length,
          configs: db.test_configs.getIndexes().length
        }
      }
    };
  }
});

print('MongoDB test database initialized successfully');