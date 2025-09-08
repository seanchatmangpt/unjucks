# Getting Started with Spec-Driven Development

This guide will walk you through creating your first spec-driven project with Unjucks in under 10 minutes.

## 🎯 Prerequisites

- Node.js 18+ installed
- Basic understanding of YAML
- Unjucks CLI installed (`npm install -g unjucks`)

## 📝 Step 1: Create Your First Specification

Let's create a simple REST API specification:

```bash
# Create a new project directory
mkdir my-api-project
cd my-api-project

# Initialize a new specification
unjucks create-spec --interactive
```

This will create a `api.spec.yaml` file:

```yaml
# api.spec.yaml
apiVersion: unjucks.dev/v1
kind: RestAPI
metadata:
  name: user-management-api
  description: Simple user management REST API
  version: 1.0.0

spec:
  framework: express
  language: typescript
  database: postgresql
  
  entities:
    - name: User
      fields:
        - name: id
          type: uuid
          primaryKey: true
        - name: email
          type: string
          unique: true
          validation: email
        - name: name
          type: string
          required: true
        - name: createdAt
          type: datetime
          default: now
        - name: updatedAt
          type: datetime
          default: now
          onUpdate: now

  endpoints:
    - path: /users
      method: GET
      description: List all users
      response:
        type: array
        items: User
    
    - path: /users
      method: POST
      description: Create a new user
      body: User
      response: User
    
    - path: /users/:id
      method: GET
      description: Get user by ID
      parameters:
        - name: id
          type: uuid
          required: true
      response: User
    
    - path: /users/:id
      method: PUT
      description: Update user
      parameters:
        - name: id
          type: uuid
          required: true
      body: User
      response: User
    
    - path: /users/:id
      method: DELETE
      description: Delete user
      parameters:
        - name: id
          type: uuid
          required: true
      response:
        type: object
        properties:
          message: string

  middleware:
    - cors
    - helmet
    - morgan
    - express.json

  testing:
    framework: jest
    coverage: 80
    e2e: supertest
```

## 🏗️ Step 2: Generate Code from Specification

Now generate your complete API structure:

```bash
# Generate the entire project
unjucks generate-from-spec api.spec.yaml --output ./src

# Or generate specific components
unjucks generate-from-spec api.spec.yaml --components models,routes --output ./src
```

This generates:

```
src/
├── models/
│   ├── User.ts
│   └── index.ts
├── routes/
│   ├── users.ts
│   └── index.ts
├── middleware/
│   └── index.ts
├── controllers/
│   └── userController.ts
├── services/
│   └── userService.ts
├── types/
│   └── api.ts
├── config/
│   └── database.ts
├── app.ts
└── server.ts
```

## 🔍 Step 3: Examine Generated Code

Let's look at the generated User model:

```typescript
// src/models/User.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { IsEmail, IsNotEmpty, IsUUID } from 'class-validator';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID()
  id: string;

  @Column({ unique: true })
  @IsEmail()
  email: string;

  @Column()
  @IsNotEmpty()
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

And the generated routes:

```typescript
// src/routes/users.ts
import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { validate } from '../middleware/validation';
import { User } from '../models/User';

const router = Router();
const userController = new UserController();

/**
 * @route GET /users
 * @desc List all users
 * @access Public
 */
router.get('/', userController.getAllUsers);

/**
 * @route POST /users
 * @desc Create a new user
 * @access Public
 */
router.post('/', validate(User), userController.createUser);

/**
 * @route GET /users/:id
 * @desc Get user by ID
 * @access Public
 */
router.get('/:id', userController.getUserById);

/**
 * @route PUT /users/:id
 * @desc Update user
 * @access Public
 */
router.put('/:id', validate(User), userController.updateUser);

/**
 * @route DELETE /users/:id
 * @desc Delete user
 * @access Public
 */
router.delete('/:id', userController.deleteUser);

export default router;
```

## 🧪 Step 4: Generate Tests

Generate comprehensive tests for your API:

```bash
# Generate tests based on specification
unjucks generate-tests api.spec.yaml --output ./tests
```

This creates:

```typescript
// tests/user.test.ts
import request from 'supertest';
import { app } from '../src/app';
import { User } from '../src/models/User';

describe('User API', () => {
  describe('GET /users', () => {
    it('should return all users', async () => {
      const response = await request(app)
        .get('/users')
        .expect(200);
      
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /users', () => {
    it('should create a new user', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com'
      };

      const response = await request(app)
        .post('/users')
        .send(userData)
        .expect(201);

      expect(response.body.name).toBe(userData.name);
      expect(response.body.email).toBe(userData.email);
      expect(response.body.id).toBeDefined();
    });

    it('should validate email format', async () => {
      const invalidUser = {
        name: 'John Doe',
        email: 'invalid-email'
      };

      await request(app)
        .post('/users')
        .send(invalidUser)
        .expect(400);
    });
  });

  // ... more tests
});
```

## ⚡ Step 5: Run Your Application

```bash
# Install dependencies
npm install

# Run database migrations (if applicable)
npm run migrate

# Start development server
npm run dev

# Run tests
npm run test
```

## 🔄 Step 6: Iterate and Refine

As your requirements change, simply update your specification and regenerate:

```bash
# Update api.spec.yaml (add new fields, endpoints, etc.)
# Then regenerate
unjucks generate-from-spec api.spec.yaml --output ./src --merge
```

The `--merge` flag ensures existing custom code is preserved.

## 🤖 Step 7: AI-Powered Enhancement

Use AI to enhance your specifications:

```bash
# Analyze and suggest improvements
unjucks analyze-spec api.spec.yaml --suggestions

# Generate documentation
unjucks generate-docs api.spec.yaml --format openapi

# Optimize for performance
unjucks optimize-spec api.spec.yaml --criteria performance
```

## 🎉 What You've Learned

In just a few minutes, you've:

1. ✅ Created a complete API specification
2. ✅ Generated a full TypeScript Express application
3. ✅ Automatically created comprehensive tests
4. ✅ Set up a development workflow
5. ✅ Learned how to iterate with spec changes

## 🚀 Next Steps

Now that you have the basics, explore:

- **[Specification Format](./specification-format.md)** - Learn advanced spec features
- **[Integration Guide](./integration-guide.md)** - Integrate with existing projects
- **[AI Workflows](./ai-workflows.md)** - Leverage AI for spec generation
- **[Examples](./examples/)** - See real-world specifications

## 💡 Pro Tips

1. **Start Simple** - Begin with basic entities and endpoints
2. **Version Your Specs** - Keep specifications in version control
3. **Use Validation** - Always validate specs before generation
4. **Preserve Custom Code** - Use merge strategies for existing code
5. **Document Decisions** - Add comments to your specifications
6. **Test Specifications** - Write tests for your spec logic

## 🆘 Troubleshooting

### Common Issues

**Specification validation errors:**
```bash
# Check spec syntax and format
unjucks validate-spec api.spec.yaml --verbose
```

**Generation failures:**
```bash
# Use debug mode to see detailed error information
unjucks generate-from-spec api.spec.yaml --debug
```

**Merge conflicts:**
```bash
# Preview changes before merging
unjucks generate-from-spec api.spec.yaml --dry-run --merge
```

### Getting Help

- Check the [CLI Reference](./cli-reference.md) for all available commands
- Visit [Examples](./examples/) for common patterns
- See [Best Practices](./best-practices.md) for proven approaches

---

*Ready to dive deeper? Continue with the [Specification Format](./specification-format.md) guide to master advanced spec features.*