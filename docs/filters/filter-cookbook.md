# Filter Cookbook

Real-world examples and recipes for common development patterns using Unjucks filters.

## Component Generation Patterns

### React Component with TypeScript

Generate a complete React component with proper naming conventions and structure.

```njk
---
to: src/components/{{ componentName | pascalCase }}/{{ componentName | pascalCase }}.tsx
inject: false
skip_if: '{{ not componentName }}'
---
import React from 'react';
import styles from './{{ componentName | pascalCase }}.module.css';

export interface {{ componentName | pascalCase }}Props {
  /** {{ componentName | humanize }} title */
  title?: string;
  /** {{ componentName | humanize }} description */
  description?: string;
  /** Whether the {{ componentName | humanize }} is active */
  isActive?: boolean;
  /** Click handler */
  onClick?: () => void;
}

/**
 * {{ componentName | humanize | titleCase }} component
 * 
 * Generated on {{ now() | formatDate('YYYY-MM-DD HH:mm:ss') }}
 * @example
 * ```tsx
 * <{{ componentName | pascalCase }}
 *   title="{{ componentName | humanize | titleCase }}"
 *   isActive={true}
 *   onClick={() => console.log('clicked')}
 * />
 * ```
 */
export const {{ componentName | pascalCase }}: React.FC<{{ componentName | pascalCase }}Props> = ({
  title = '{{ componentName | humanize | titleCase }}',
  description = '{{ '' | fakeText(1) | replace('.', '') }}',
  isActive = false,
  onClick
}) => {
  return (
    <div 
      className={`${styles.{{ componentName | camelCase }}} ${isActive ? styles.active : ''}`}
      onClick={onClick}
      data-testid="{{ componentName | kebabCase }}"
    >
      <h2 className={styles.title}>{title}</h2>
      {description && (
        <p className={styles.description}>{description}</p>
      )}
      <div className={styles.metadata}>
        <span>ID: {{ '' | fakeUuid | truncate(8, '') }}</span>
        <span>Created: {{ now() | formatDate('MMM D, YYYY') }}</span>
      </div>
    </div>
  );
};

{{ componentName | pascalCase }}.displayName = '{{ componentName | pascalCase }}';

export default {{ componentName | pascalCase }};
```

### Vue 3 Composition API Component

```njk
---
to: src/components/{{ componentName | pascalCase }}/{{ componentName | pascalCase }}.vue
inject: false
skip_if: '{{ not withVue }}'
---
<template>
  <div class="{{ componentName | kebabCase }}-component" :class="{ active: isActive }">
    <header class="{{ componentName | kebabCase }}__header">
      <h2>{{ title || '{{ componentName | humanize | titleCase }}' }}</h2>
      <span class="component-id">{{ componentId }}</span>
    </header>
    
    <main class="{{ componentName | kebabCase }}__content">
      <slot name="content">
        <p>{{ description }}</p>
      </slot>
    </main>
    
    <footer class="{{ componentName | kebabCase }}__footer">
      <button @click="handleAction" :disabled="!isActive">
        {{ actionLabel }}
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

export interface {{ componentName | pascalCase }}Props {
  title?: string;
  description?: string;
  isActive?: boolean;
  actionLabel?: string;
}

const props = withDefaults(defineProps<{{ componentName | pascalCase }}Props>(), {
  title: '{{ componentName | humanize | titleCase }}',
  description: '{{ '' | fakeText(1) }}',
  isActive: false,
  actionLabel: 'Action'
});

const emit = defineEmits<{
  action: [payload: { id: string; timestamp: string }];
}>();

// Reactive state
const componentId = ref('{{ '' | fakeUuid | truncate(8, '') }}');
const createdAt = ref('{{ now() | dateIso }}');

// Computed properties
const displayTitle = computed(() => 
  props.title || '{{ componentName | humanize | titleCase }}'
);

const metadata = computed(() => ({
  id: componentId.value,
  created: '{{ now() | formatDate('YYYY-MM-DD') }}',
  slug: '{{ componentName | kebabCase }}',
  constant: '{{ componentName | constantCase }}'
}));

// Methods
const handleAction = () => {
  emit('action', {
    id: componentId.value,
    timestamp: new Date().toISOString()
  });
};

onMounted(() => {
  console.log('{{ componentName | pascalCase }} mounted:', metadata.value);
});
</script>

<style scoped lang="scss">
.{{ componentName | kebabCase }}-component {
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  padding: 1rem;
  
  &.active {
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
  
  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    
    h2 {
      margin: 0;
      color: #333;
      font-size: 1.25rem;
    }
    
    .component-id {
      font-family: monospace;
      font-size: 0.75rem;
      color: #666;
      background: #f8f9fa;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }
  }
  
  &__content {
    margin-bottom: 1rem;
    
    p {
      margin: 0;
      color: #666;
      line-height: 1.5;
    }
  }
  
  &__footer {
    display: flex;
    justify-content: flex-end;
    
    button {
      padding: 0.5rem 1rem;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      
      &:hover:not(:disabled) {
        background: #0056b3;
      }
      
      &:disabled {
        background: #6c757d;
        cursor: not-allowed;
      }
    }
  }
}
</style>
```

## API Scaffolding Patterns

### Express.js REST API Routes

Generate complete REST API endpoints with validation and error handling.

```njk
---
to: src/routes/{{ resourceName | kebabCase }}.routes.ts
inject: false
skip_if: '{{ not resourceName }}'
---
import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { {{ resourceName | pascalCase }}Service } from '../services/{{ resourceName | kebabCase }}.service';
import { auth, authorize } from '../middleware/auth';
import { asyncHandler } from '../utils/async-handler';

const router = express.Router();
const {{ resourceName | camelCase }}Service = new {{ resourceName | pascalCase }}Service();

// Validation rules
const {{ resourceName | camelCase }}Validations = {
  create: [
    body('name')
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be between 1 and 100 characters'),
    body('description')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Description cannot exceed 500 characters'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean')
  ],
  
  update: [
    param('id').isUUID().withMessage('Invalid {{ resourceName | humanize }} ID'),
    body('name')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be between 1 and 100 characters'),
    body('description')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Description cannot exceed 500 characters')
  ],
  
  findById: [
    param('id').isUUID().withMessage('Invalid {{ resourceName | humanize }} ID')
  ],
  
  list: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('sortBy')
      .optional()
      .isIn(['name', 'createdAt', 'updatedAt'])
      .withMessage('Invalid sort field')
  ]
};

/**
 * @route   GET /api/{{ resourceName | kebabCase }}
 * @desc    Get all {{ resourceName | humanize | lower }} records
 * @access  Private
 */
router.get('/',
  auth,
  {{ resourceName | camelCase }}Validations.list,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { page = 1, limit = 10, sortBy = 'createdAt' } = req.query;
    
    const result = await {{ resourceName | camelCase }}Service.findAll({
      page: Number(page),
      limit: Number(limit),
      sortBy: String(sortBy),
      userId: req.user.id
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      meta: {
        total: result.total,
        page: Number(page),
        limit: Number(limit),
        generated: '{{ now() | dateIso }}'
      }
    });
  })
);

/**
 * @route   GET /api/{{ resourceName | kebabCase }}/:id
 * @desc    Get {{ resourceName | humanize | lower }} by ID
 * @access  Private
 */
router.get('/:id',
  auth,
  {{ resourceName | camelCase }}Validations.findById,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {{ resourceName | camelCase }} = await {{ resourceName | camelCase }}Service.findById(req.params.id, req.user.id);
    
    if (!{{ resourceName | camelCase }}) {
      return res.status(404).json({
        success: false,
        message: '{{ resourceName | humanize }} not found'
      });
    }

    res.json({
      success: true,
      data: {{ resourceName | camelCase }}
    });
  })
);

/**
 * @route   POST /api/{{ resourceName | kebabCase }}
 * @desc    Create new {{ resourceName | humanize | lower }}
 * @access  Private
 */
router.post('/',
  auth,
  {{ resourceName | camelCase }}Validations.create,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {{ resourceName | camelCase }}Data = {
      ...req.body,
      userId: req.user.id,
      id: '{{ '' | fakeUuid }}', // Will be overridden by database
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const {{ resourceName | camelCase }} = await {{ resourceName | camelCase }}Service.create({{ resourceName | camelCase }}Data);

    res.status(201).json({
      success: true,
      data: {{ resourceName | camelCase }},
      message: '{{ resourceName | humanize }} created successfully'
    });
  })
);

/**
 * @route   PUT /api/{{ resourceName | kebabCase }}/:id
 * @desc    Update {{ resourceName | humanize | lower }}
 * @access  Private
 */
router.put('/:id',
  auth,
  {{ resourceName | camelCase }}Validations.update,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {{ resourceName | camelCase }} = await {{ resourceName | camelCase }}Service.update(req.params.id, req.body, req.user.id);
    
    if (!{{ resourceName | camelCase }}) {
      return res.status(404).json({
        success: false,
        message: '{{ resourceName | humanize }} not found'
      });
    }

    res.json({
      success: true,
      data: {{ resourceName | camelCase }},
      message: '{{ resourceName | humanize }} updated successfully'
    });
  })
);

/**
 * @route   DELETE /api/{{ resourceName | kebabCase }}/:id
 * @desc    Delete {{ resourceName | humanize | lower }}
 * @access  Private
 */
router.delete('/:id',
  auth,
  authorize(['admin', 'owner']),
  {{ resourceName | camelCase }}Validations.findById,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const deleted = await {{ resourceName | camelCase }}Service.delete(req.params.id, req.user.id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: '{{ resourceName | humanize }} not found'
      });
    }

    res.json({
      success: true,
      message: '{{ resourceName | humanize }} deleted successfully'
    });
  })
);

export { router as {{ resourceName | camelCase }}Routes };

// Export route info for documentation
export const {{ resourceName | constantCase }}_ROUTES = {
  base: '/api/{{ resourceName | kebabCase }}',
  endpoints: {
    list: 'GET /api/{{ resourceName | kebabCase }}',
    create: 'POST /api/{{ resourceName | kebabCase }}',
    findById: 'GET /api/{{ resourceName | kebabCase }}/:id',
    update: 'PUT /api/{{ resourceName | kebabCase }}/:id',
    delete: 'DELETE /api/{{ resourceName | kebabCase }}/:id'
  },
  generated: '{{ now() | formatDate('YYYY-MM-DD HH:mm:ss') }}'
};
```

### GraphQL Schema and Resolvers

```njk
---
to: src/graphql/schemas/{{ entityName | kebabCase }}.schema.ts
inject: false
---
import { gql } from 'apollo-server-express';

export const {{ entityName | camelCase }}TypeDefs = gql`
  type {{ entityName | pascalCase }} {
    id: ID!
    name: String!
    description: String
    slug: String!
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    createdBy: User!
  }
  
  input {{ entityName | pascalCase }}Input {
    name: String!
    description: String
    isActive: Boolean = true
  }
  
  input {{ entityName | pascalCase }}UpdateInput {
    name: String
    description: String
    isActive: Boolean
  }
  
  input {{ entityName | pascalCase }}FilterInput {
    name: String
    isActive: Boolean
    createdAfter: DateTime
    createdBefore: DateTime
  }
  
  type {{ entityName | pascalCase }}Connection {
    edges: [{{ entityName | pascalCase }}Edge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }
  
  type {{ entityName | pascalCase }}Edge {
    node: {{ entityName | pascalCase }}!
    cursor: String!
  }
  
  extend type Query {
    {{ entityName | camelCase }}(id: ID!): {{ entityName | pascalCase }}
    {{ entityName | camelCase | pluralize }}(
      first: Int = 10
      after: String
      filter: {{ entityName | pascalCase }}FilterInput
      orderBy: {{ entityName | pascalCase }}OrderBy
    ): {{ entityName | pascalCase }}Connection!
  }
  
  extend type Mutation {
    create{{ entityName | pascalCase }}(input: {{ entityName | pascalCase }}Input!): {{ entityName | pascalCase }}!
    update{{ entityName | pascalCase }}(id: ID!, input: {{ entityName | pascalCase }}UpdateInput!): {{ entityName | pascalCase }}!
    delete{{ entityName | pascalCase }}(id: ID!): Boolean!
  }
  
  extend type Subscription {
    {{ entityName | camelCase }}Updated(id: ID!): {{ entityName | pascalCase }}!
    {{ entityName | camelCase }}Created: {{ entityName | pascalCase }}!
  }
  
  enum {{ entityName | pascalCase }}OrderBy {
    NAME_ASC
    NAME_DESC
    CREATED_AT_ASC
    CREATED_AT_DESC
    UPDATED_AT_ASC
    UPDATED_AT_DESC
  }
`;
```

## Database Migration Patterns

### SQL Migration with Rollback

```njk
---
to: migrations/{{ now() | formatDate('YYYYMMDD_HHmmss') }}_create_{{ tableName | snakeCase }}_table.sql
inject: false
---
-- Migration: Create {{ tableName | humanize }} table
-- Generated: {{ now() | formatDate('YYYY-MM-DD HH:mm:ss') }}
-- Table: {{ tableName | snakeCase }}

-- =========================================
-- UP MIGRATION
-- =========================================

CREATE TABLE IF NOT EXISTS {{ tableName | snakeCase }} (
{% for field in fields %}
  {{ field.name | snakeCase }} {{ field.type | upper }}{% if field.constraints %} {{ field.constraints | join(' ') }}{% endif %}{% if not field.nullable and field.name !== 'id' %} NOT NULL{% endif %}{% if field.default %} DEFAULT {{ field.default }}{% endif %},
{% endfor %}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  PRIMARY KEY (id){% if indexes %},{% endif %}
{% for index in indexes %}
  {% if index.type === 'unique' %}CONSTRAINT {{ tableName | snakeCase }}_{{ index.columns | join('_') }}_unique UNIQUE ({{ index.columns | join(', ') }}){% endif %}{% if not loop.last %},{% endif %}
{% endfor %}
);

-- Create indexes
{% for index in indexes %}
{% if index.type !== 'unique' %}
CREATE {% if index.type === 'btree' %}INDEX{% else %}{{ index.type | upper }} INDEX{% endif %} 
IF NOT EXISTS idx_{{ tableName | snakeCase }}_{{ index.columns | join('_') }}
ON {{ tableName | snakeCase }} {% if index.type === 'btree' %}({{ index.columns | join(', ') }}){% else %}USING {{ index.type }} ({{ index.columns | join(', ') }}){% endif %};
{% endif %}
{% endfor %}

-- Add foreign key constraints
{% for fk in foreignKeys %}
ALTER TABLE {{ tableName | snakeCase }}
ADD CONSTRAINT fk_{{ tableName | snakeCase }}_{{ fk.column | snakeCase }}
FOREIGN KEY ({{ fk.column | snakeCase }}) 
REFERENCES {{ fk.references.table | snakeCase }}({{ fk.references.column | snakeCase }})
{% if fk.onDelete %}ON DELETE {{ fk.onDelete | upper }}{% endif %}
{% if fk.onUpdate %}ON UPDATE {{ fk.onUpdate | upper }}{% endif %};
{% endfor %}

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp
  BEFORE UPDATE ON {{ tableName | snakeCase }}
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- Insert sample data (if specified)
{% if sampleData %}
INSERT INTO {{ tableName | snakeCase }} (
{% for field in sampleData[0] | keys %}
  {{ field | snakeCase }}{% if not loop.last %},{% endif %}
{% endfor %}
) VALUES
{% for record in sampleData %}
(
{% for field, value in record %}
  {% if value is string %}'{{ value | replace("'", "''") }}'{% else %}{{ value }}{% endif %}{% if not loop.last %},{% endif %}
{% endfor %}
){% if not loop.last %},{% endif %}
{% endfor %};
{% endif %}

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON {{ tableName | snakeCase }} TO {{ dbUser | default('app_user') }};
GRANT USAGE, SELECT ON SEQUENCE {{ tableName | snakeCase }}_id_seq TO {{ dbUser | default('app_user') }};

-- =========================================
-- DOWN MIGRATION (ROLLBACK)
-- =========================================

/*
-- To rollback this migration, run:

-- Drop foreign key constraints
{% for fk in foreignKeys %}
ALTER TABLE {{ tableName | snakeCase }} DROP CONSTRAINT IF EXISTS fk_{{ tableName | snakeCase }}_{{ fk.column | snakeCase }};
{% endfor %}

-- Drop indexes
{% for index in indexes %}
{% if index.type !== 'unique' %}
DROP INDEX IF EXISTS idx_{{ tableName | snakeCase }}_{{ index.columns | join('_') }};
{% endif %}
{% endfor %}

-- Drop trigger and function
DROP TRIGGER IF EXISTS set_timestamp ON {{ tableName | snakeCase }};
DROP FUNCTION IF EXISTS trigger_set_timestamp();

-- Drop table
DROP TABLE IF EXISTS {{ tableName | snakeCase }};

*/
```

### Prisma Schema Generation

```njk
---
to: prisma/schema/{{ modelName | kebabCase }}.prisma
inject: true
append_to: '// Models'
---
model {{ modelName | pascalCase }} {
  id          String   @id @default(cuid())
{% for field in fields %}
  {{ field.name | camelCase }}     {{ field.type }}{% if field.optional %}?{% endif %}{% if field.default %} @default({{ field.default }}){% endif %}{% if field.unique %} @unique{% endif %}
{% endfor %}
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
{% for relation in relations %}
  
  // Relation: {{ relation.name | humanize }}
  {{ relation.field | camelCase }}   {{ relation.type }}{% if relation.optional %}?{% endif %} @relation("{{ modelName | pascalCase }}{{ relation.type }}")
  {{ relation.field | camelCase }}Id String{% if relation.optional %}?{% endif %} @map("{{ relation.field | snakeCase }}_id")
{% endfor %}

  @@map("{{ modelName | tableize }}")
  @@index([createdAt])
{% for field in fields %}
{% if field.indexed %}
  @@index([{{ field.name | camelCase }}])
{% endif %}
{% endfor %}
}
```

## Test File Generation Patterns

### Jest Unit Tests

```njk
---
to: src/{{ modulePath | default('') }}/{{ testFileName | kebabCase }}.test.ts
inject: false
---
import { {{ className | pascalCase }} } from './{{ fileName | kebabCase }}';
{% if withMocks %}
import { jest } from '@jest/globals';
{% endif %}

describe('{{ className | pascalCase }}', () => {
  // Test data
  const mockData = {
    id: '{{ '' | fakeUuid }}',
    name: '{{ '' | fakeName }}',
    email: '{{ '' | fakeEmail }}',
    createdAt: '{{ now() | dateIso }}',
    updatedAt: '{{ now() | dateIso }}'
  };
  
  const invalidData = {
    id: '',
    name: '',
    email: 'invalid-email',
    createdAt: 'invalid-date'
  };

{% if withMocks %}
  // Mocks
  const mockService = {
    find: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  };
{% endif %}

  beforeEach(() => {
{% if withMocks %}
    jest.clearAllMocks();
{% endif %}
  });

  describe('constructor', () => {
    it('should create instance with default values', () => {
      const instance = new {{ className | pascalCase }}();
      
      expect(instance).toBeInstanceOf({{ className | pascalCase }});
      expect(instance.id).toBeUndefined();
      expect(instance.createdAt).toBeUndefined();
    });

    it('should create instance with provided data', () => {
      const instance = new {{ className | pascalCase }}(mockData);
      
      expect(instance.id).toBe(mockData.id);
      expect(instance.name).toBe(mockData.name);
      expect(instance.email).toBe(mockData.email);
      expect(instance.createdAt).toBe(mockData.createdAt);
    });
  });

  describe('validation', () => {
    it('should validate valid data', () => {
      const instance = new {{ className | pascalCase }}(mockData);
      
      expect(instance.isValid()).toBe(true);
      expect(instance.getErrors()).toHaveLength(0);
    });

    it('should reject invalid data', () => {
      const instance = new {{ className | pascalCase }}(invalidData);
      
      expect(instance.isValid()).toBe(false);
      expect(instance.getErrors().length).toBeGreaterThan(0);
    });

{% for field in fields %}
{% if field.required %}
    it('should require {{ field.name | camelCase }}', () => {
      const dataWithoutField = { ...mockData };
      delete dataWithoutField.{{ field.name | camelCase }};
      
      const instance = new {{ className | pascalCase }}(dataWithoutField);
      
      expect(instance.isValid()).toBe(false);
      expect(instance.getErrors()).toContain('{{ field.name | camelCase }} is required');
    });
{% endif %}
{% endfor %}
  });

  describe('methods', () => {
{% for method in methods %}
    describe('{{ method.name | camelCase }}', () => {
      it('should {{ method.description | default('work correctly') | lower }}', async () => {
        const instance = new {{ className | pascalCase }}(mockData);
        
{% if method.async %}
        const result = await instance.{{ method.name | camelCase }}({{ method.params | default('') }});
{% else %}
        const result = instance.{{ method.name | camelCase }}({{ method.params | default('') }});
{% endif %}
        
        expect(result).toBeDefined();
        // Add more specific assertions based on method behavior
      });

      it('should handle errors gracefully', async () => {
        const instance = new {{ className | pascalCase }}(mockData);
        
        // Test error scenarios
        await expect(
          instance.{{ method.name | camelCase }}(null)
        ).rejects.toThrow();
      });
    });
{% endfor %}
  });

  describe('integration', () => {
    it('should work with {{ serviceName | pascalCase }}Service', async () => {
{% if withMocks %}
      mockService.create.mockResolvedValue(mockData);
      
      const service = new {{ serviceName | pascalCase }}Service(mockService);
      const result = await service.create(mockData);
      
      expect(mockService.create).toHaveBeenCalledWith(mockData);
      expect(result).toEqual(mockData);
{% else %}
      // Integration test implementation
      expect(true).toBe(true);
{% endif %}
    });
  });

  describe('edge cases', () => {
    it('should handle empty data', () => {
      const instance = new {{ className | pascalCase }}({});
      
      expect(instance).toBeInstanceOf({{ className | pascalCase }});
      expect(instance.isValid()).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(() => new {{ className | pascalCase }}(null)).not.toThrow();
      expect(() => new {{ className | pascalCase }}(undefined)).not.toThrow();
    });

    it('should handle large datasets', () => {
      const largeData = {
        ...mockData,
        description: '{{ '' | fakeText(100) }}' // Very long text
      };
      
      const instance = new {{ className | pascalCase }}(largeData);
      expect(instance).toBeInstanceOf({{ className | pascalCase }});
    });
  });

  describe('performance', () => {
    it('should create instances quickly', () => {
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        new {{ className | pascalCase }}(mockData);
      }
      
      const end = performance.now();
      expect(end - start).toBeLessThan(100); // Should complete in under 100ms
    });
  });
});

// Test data factory
export const {{ className | camelCase }}TestFactory = {
  create: (overrides = {}) => ({
    id: '{{ '' | fakeUuid }}',
    name: '{{ '' | fakeName }}',
    email: '{{ '' | fakeEmail }}',
    createdAt: '{{ now() | dateIso }}',
    updatedAt: '{{ now() | dateIso }}',
    ...overrides
  }),
  
  createMultiple: (count = 5, overrides = {}) => {
    return Array.from({ length: count }, (_, index) => ({
      id: '{{ '' | fakeUuid }}',
      name: `{{ '' | fakeName }} ${index + 1}`,
      email: `user${index + 1}@{{ '' | fakeEmail | split('@') | last }}`,
      createdAt: '{{ now() | dateAdd(index, 'minutes') | dateIso }}',
      updatedAt: '{{ now() | dateAdd(index, 'minutes') | dateIso }}',
      ...overrides
    }));
  }
};
```

### Cypress E2E Tests

```njk
---
to: cypress/e2e/{{ featureName | kebabCase }}.cy.ts
inject: false
---
describe('{{ featureName | humanize | titleCase }}', () => {
  const testData = {
    valid{{ entityName | pascalCase }}: {
      id: '{{ '' | fakeUuid }}',
      name: '{{ '' | fakeName }}',
      email: '{{ '' | fakeEmail }}',
      description: '{{ '' | fakeText(1) }}'
    }
  };

  beforeEach(() => {
    // Setup
    cy.visit('/{{ routePath | default(featureName | kebabCase) }}');
    cy.intercept('GET', '/api/{{ entityName | kebabCase }}*', { fixture: '{{ entityName | kebabCase }}-list.json' }).as('get{{ entityName | pascalCase | pluralize }}');
    cy.intercept('POST', '/api/{{ entityName | kebabCase }}', { fixture: '{{ entityName | kebabCase }}-created.json' }).as('create{{ entityName | pascalCase }}');
    cy.intercept('PUT', '/api/{{ entityName | kebabCase }}/*', { fixture: '{{ entityName | kebabCase }}-updated.json' }).as('update{{ entityName | pascalCase }}');
    cy.intercept('DELETE', '/api/{{ entityName | kebabCase }}/*', { statusCode: 204 }).as('delete{{ entityName | pascalCase }}');
  });

  describe('Page Load', () => {
    it('should display {{ featureName | humanize | lower }} page correctly', () => {
      cy.get('[data-testid="{{ featureName | kebabCase }}-page"]').should('be.visible');
      cy.get('h1').should('contain.text', '{{ featureName | humanize | titleCase }}');
      cy.wait('@get{{ entityName | pascalCase | pluralize }}');
    });

    it('should show loading state initially', () => {
      cy.get('[data-testid="loading-spinner"]').should('be.visible');
      cy.wait('@get{{ entityName | pascalCase | pluralize }}');
      cy.get('[data-testid="loading-spinner"]').should('not.exist');
    });
  });

  describe('List View', () => {
    it('should display {{ entityName | humanize | lower }} list', () => {
      cy.wait('@get{{ entityName | pascalCase | pluralize }}');
      cy.get('[data-testid="{{ entityName | kebabCase }}-list"]').should('be.visible');
      cy.get('[data-testid="{{ entityName | kebabCase }}-item"]').should('have.length.at.least', 1);
    });

    it('should handle empty list', () => {
      cy.intercept('GET', '/api/{{ entityName | kebabCase }}*', { body: { data: [], total: 0 } }).as('getEmpty{{ entityName | pascalCase | pluralize }}');
      cy.reload();
      cy.wait('@getEmpty{{ entityName | pascalCase | pluralize }}');
      cy.get('[data-testid="empty-state"]').should('be.visible');
      cy.get('[data-testid="empty-state"]').should('contain.text', 'No {{ entityName | humanize | lower }}s found');
    });

    it('should support pagination', () => {
      cy.wait('@get{{ entityName | pascalCase | pluralize }}');
      cy.get('[data-testid="pagination"]').should('be.visible');
      cy.get('[data-testid="next-page"]').click();
      cy.wait('@get{{ entityName | pascalCase | pluralize }}');
      cy.url().should('include', 'page=2');
    });
  });

  describe('Create {{ entityName | humanize }}', () => {
    it('should open create modal', () => {
      cy.get('[data-testid="create-{{ entityName | kebabCase }}-button"]').click();
      cy.get('[data-testid="create-{{ entityName | kebabCase }}-modal"]').should('be.visible');
      cy.get('[data-testid="modal-title"]').should('contain.text', 'Create {{ entityName | humanize }}');
    });

    it('should create new {{ entityName | humanize | lower }}', () => {
      cy.get('[data-testid="create-{{ entityName | kebabCase }}-button"]').click();
      
      // Fill form
      cy.get('[data-testid="name-input"]').type(testData.valid{{ entityName | pascalCase }}.name);
      cy.get('[data-testid="email-input"]').type(testData.valid{{ entityName | pascalCase }}.email);
      cy.get('[data-testid="description-input"]').type(testData.valid{{ entityName | pascalCase }}.description);
      
      // Submit
      cy.get('[data-testid="submit-button"]').click();
      cy.wait('@create{{ entityName | pascalCase }}');
      
      // Verify
      cy.get('[data-testid="success-message"]').should('be.visible');
      cy.get('[data-testid="create-{{ entityName | kebabCase }}-modal"]').should('not.exist');
    });

    it('should validate required fields', () => {
      cy.get('[data-testid="create-{{ entityName | kebabCase }}-button"]').click();
      cy.get('[data-testid="submit-button"]').click();
      
      cy.get('[data-testid="name-error"]').should('be.visible');
      cy.get('[data-testid="name-error"]').should('contain.text', 'Name is required');
    });

    it('should validate email format', () => {
      cy.get('[data-testid="create-{{ entityName | kebabCase }}-button"]').click();
      cy.get('[data-testid="email-input"]').type('invalid-email');
      cy.get('[data-testid="submit-button"]').click();
      
      cy.get('[data-testid="email-error"]').should('be.visible');
      cy.get('[data-testid="email-error"]').should('contain.text', 'Please enter a valid email');
    });
  });

  describe('Edit {{ entityName | humanize }}', () => {
    it('should open edit modal', () => {
      cy.wait('@get{{ entityName | pascalCase | pluralize }}');
      cy.get('[data-testid="{{ entityName | kebabCase }}-item"]').first().within(() => {
        cy.get('[data-testid="edit-button"]').click();
      });
      
      cy.get('[data-testid="edit-{{ entityName | kebabCase }}-modal"]').should('be.visible');
      cy.get('[data-testid="modal-title"]').should('contain.text', 'Edit {{ entityName | humanize }}');
    });

    it('should update {{ entityName | humanize | lower }}', () => {
      cy.wait('@get{{ entityName | pascalCase | pluralize }}');
      cy.get('[data-testid="{{ entityName | kebabCase }}-item"]').first().within(() => {
        cy.get('[data-testid="edit-button"]').click();
      });
      
      // Update form
      cy.get('[data-testid="name-input"]').clear().type('Updated Name');
      cy.get('[data-testid="submit-button"]').click();
      cy.wait('@update{{ entityName | pascalCase }}');
      
      // Verify
      cy.get('[data-testid="success-message"]').should('be.visible');
      cy.get('[data-testid="edit-{{ entityName | kebabCase }}-modal"]').should('not.exist');
    });
  });

  describe('Delete {{ entityName | humanize }}', () => {
    it('should delete {{ entityName | humanize | lower }}', () => {
      cy.wait('@get{{ entityName | pascalCase | pluralize }}');
      cy.get('[data-testid="{{ entityName | kebabCase }}-item"]').first().within(() => {
        cy.get('[data-testid="delete-button"]').click();
      });
      
      // Confirm deletion
      cy.get('[data-testid="confirm-delete-modal"]').should('be.visible');
      cy.get('[data-testid="confirm-delete-button"]').click();
      cy.wait('@delete{{ entityName | pascalCase }}');
      
      // Verify
      cy.get('[data-testid="success-message"]').should('be.visible');
      cy.get('[data-testid="confirm-delete-modal"]').should('not.exist');
    });

    it('should cancel deletion', () => {
      cy.wait('@get{{ entityName | pascalCase | pluralize }}');
      cy.get('[data-testid="{{ entityName | kebabCase }}-item"]').first().within(() => {
        cy.get('[data-testid="delete-button"]').click();
      });
      
      cy.get('[data-testid="cancel-delete-button"]').click();
      cy.get('[data-testid="confirm-delete-modal"]').should('not.exist');
    });
  });

  describe('Search and Filter', () => {
    it('should search {{ entityName | humanize | lower }}s', () => {
      cy.wait('@get{{ entityName | pascalCase | pluralize }}');
      cy.get('[data-testid="search-input"]').type('test');
      cy.get('[data-testid="search-button"]').click();
      
      cy.wait('@get{{ entityName | pascalCase | pluralize }}');
      cy.url().should('include', 'search=test');
    });

    it('should filter by status', () => {
      cy.wait('@get{{ entityName | pascalCase | pluralize }}');
      cy.get('[data-testid="status-filter"]').select('active');
      
      cy.wait('@get{{ entityName | pascalCase | pluralize }}');
      cy.url().should('include', 'status=active');
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard navigable', () => {
      cy.wait('@get{{ entityName | pascalCase | pluralize }}');
      cy.get('body').tab();
      cy.focused().should('have.attr', 'data-testid', 'create-{{ entityName | kebabCase }}-button');
    });

    it('should have proper ARIA labels', () => {
      cy.get('[data-testid="create-{{ entityName | kebabCase }}-button"]')
        .should('have.attr', 'aria-label', 'Create new {{ entityName | humanize | lower }}');
      
      cy.get('[data-testid="{{ entityName | kebabCase }}-list"]')
        .should('have.attr', 'role', 'list');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', () => {
      cy.intercept('GET', '/api/{{ entityName | kebabCase }}*', { statusCode: 500 }).as('getError');
      cy.reload();
      cy.wait('@getError');
      
      cy.get('[data-testid="error-message"]').should('be.visible');
      cy.get('[data-testid="error-message"]').should('contain.text', 'Unable to load {{ entityName | humanize | lower }}s');
    });

    it('should handle network errors', () => {
      cy.intercept('GET', '/api/{{ entityName | kebabCase }}*', { forceNetworkError: true }).as('getNetworkError');
      cy.reload();
      cy.wait('@getNetworkError');
      
      cy.get('[data-testid="error-message"]').should('be.visible');
      cy.get('[data-testid="retry-button"]').should('be.visible');
    });
  });
});
```

This cookbook provides comprehensive, real-world patterns for generating components, APIs, database schemas, and tests with proper filter usage and naming conventions.