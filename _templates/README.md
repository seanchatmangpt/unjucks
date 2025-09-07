# Unjucks Template Examples

This directory contains functional template examples that demonstrate the core capabilities of the Unjucks generator system.

## Available Templates

### 1. React Component Template (`component/react`)
Generates a complete React component with TypeScript support.

**Usage:**
```bash
unjucks generate component react --componentName=UserProfile --withProps --withStyles --withTests
```

**Generated Files:**
- `src/components/{ComponentName}/{ComponentName}.tsx` - Main component file
- `src/components/{ComponentName}/{ComponentName}.module.css` - CSS modules (if withStyles=true)
- `src/components/{ComponentName}/{ComponentName}.test.tsx` - Test file (if withTests=true)
- `src/components/{ComponentName}/index.ts` - Export file

**Template Variables:**
- `componentName` (required) - Component name in PascalCase
- `description` (optional) - Component description
- `withProps` (boolean) - Include TypeScript props interface
- `withState` (boolean) - Include React state management
- `withStyles` (boolean) - Include CSS modules
- `withTests` (boolean) - Include test files
- `properties` (array) - Component properties configuration

### 2. Express API Template (`api/express`)
Generates a complete REST API with CRUD operations, validation, and documentation.

**Usage:**
```bash
unjucks generate api express --entityName=User --withDatabase --withAuth --withValidation
```

**Generated Files:**
- `src/controllers/{Entity}Controller.ts` - REST controller with CRUD operations
- `src/routes/{entity}Routes.ts` - Express routes with Swagger documentation
- `src/validators/{entity}Validator.ts` - Joi validation schemas (if withValidation=true)

**Template Variables:**
- `entityName` (required) - Entity name (singular)
- `withDatabase` (boolean) - Include Sequelize integration
- `withAuth` (boolean) - Include authentication middleware
- `withValidation` (boolean) - Include Joi validation
- `withLogging` (boolean) - Include logging
- `withPagination` (boolean) - Include pagination support
- `fields` (array) - Entity field definitions

### 3. Sequelize Model Template (`model/sequelize`)
Generates Sequelize models with migrations and associations.

**Usage:**
```bash
unjucks generate model sequelize --modelName=User --withTimestamps --withSoftDeletes
```

**Generated Files:**
- `src/models/{Model}.ts` - Sequelize model with TypeScript interfaces
- `src/migrations/{timestamp}-create-{model}.ts` - Database migration

**Template Variables:**
- `modelName` (required) - Model name
- `withTimestamps` (boolean) - Include createdAt/updatedAt
- `withSoftDeletes` (boolean) - Include deletedAt for soft deletes
- `withAssociations` (boolean) - Include model relationships
- `fields` (array) - Model field definitions
- `indexes` (array) - Database indexes
- `associations` (array) - Model relationships

### 4. Vitest Test Template (`test/vitest`)
Generates comprehensive unit and integration tests.

**Usage:**
```bash
unjucks generate test vitest --testName=UserService --testSubject=UserService --testType=unit
```

**Generated Files:**
- `tests/unit/{test-name}.test.ts` - Unit test file
- `tests/integration/{test-name}.integration.test.ts` - Integration test file

**Template Variables:**
- `testName` (required) - Test name
- `testSubject` (required) - What is being tested
- `testType` (unit|integration) - Type of test
- `withMocks` (boolean) - Include mocking support
- `withPerformance` (boolean) - Include performance tests
- `withDatabase` (boolean) - Include database testing (integration only)
- `withApi` (boolean) - Include API testing (integration only)

## Template Features

### Advanced Nunjucks Features Used
- **Frontmatter Configuration**: Each template uses YAML frontmatter to specify file paths and injection rules
- **Conditional Generation**: Templates use `skipIf` conditions for optional files
- **String Filters**: Templates use built-in filters like `pascalCase`, `camelCase`, `kebabCase`
- **Template Variables**: Dynamic configuration through variables and prompts
- **Template Inheritance**: Shared patterns and components

### File Operation Modes
- **Create**: Generate new files with `to:` field
- **Skip Conditions**: Use `skipIf:` to conditionally generate files
- **Dynamic Paths**: File paths use template variables for flexibility

### Best Practices Demonstrated
- **TypeScript Support**: All templates generate TypeScript-compatible code
- **Test Coverage**: Components include comprehensive test files
- **Documentation**: Generated code includes JSDoc comments
- **Error Handling**: Templates include proper error handling patterns
- **Security**: Input validation and sanitization
- **Performance**: Optimized code patterns and lazy loading

## Interactive Mode

All templates support interactive mode with prompts:

```bash
unjucks generate component react
# Will prompt for all required and optional parameters
```

## Customization

Templates can be customized by:

1. **Modifying Variables**: Update the `prompt.js` files to add/remove variables
2. **Adding Files**: Create new `.njk` template files in the generator directory
3. **Custom Filters**: Add custom Nunjucks filters for specific transformations
4. **Frontmatter Options**: Use different file operation modes (inject, append, prepend, etc.)

## Example Usage Scenarios

### Generate a Complete Feature
```bash
# 1. Generate the model
unjucks generate model sequelize --modelName=Product --withTimestamps

# 2. Generate the API
unjucks generate api express --entityName=Product --withDatabase --withValidation

# 3. Generate the React component
unjucks generate component react --componentName=ProductList --withProps --withStyles

# 4. Generate tests
unjucks generate test vitest --testName=ProductAPI --testType=integration --withDatabase --withApi
```

### Quick Prototype
```bash
# Generate minimal components for rapid prototyping
unjucks generate component react --componentName=QuickWidget --withProps=false --withTests=false
unjucks generate api express --entityName=Widget --withDatabase=false --withAuth=false
```

## Validation

All templates include:
- **Input Validation**: Required field validation and type checking
- **Output Validation**: Generated code follows TypeScript standards
- **Security Validation**: SQL injection prevention and input sanitization
- **Performance Validation**: Efficient code patterns and resource management

These templates serve as both functional examples and starting points for creating your own custom generators that leverage the full power of the Unjucks system.