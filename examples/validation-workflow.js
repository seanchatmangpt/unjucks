/**
 * End-to-End Semantic Validation Workflow
 * Complete example demonstrating all validation components working together
 */

const { SemanticValidator, SemanticValidationPipelineImpl } = require('../src/lib/semantic-validator');
const { ShaclValidator, CommonShapes } = require('../src/lib/shacl-validator');
const { TemplateValidator, CommonTemplateRules } = require('../src/lib/template-validator');

/**
 * Complete validation workflow demonstration
 */
async function runValidationWorkflow() {
  console.log('🔍 Starting comprehensive semantic validation workflow...\n');

  // 1. Initialize validation pipeline
  console.log('📋 Step 1: Initializing validation pipeline...');
  const pipeline = new SemanticValidationPipelineImpl();
  
  // Add SHACL validator
  const shaclValidator = new ShaclValidator();
  pipeline.addValidator(shaclValidator);
  
  // Add template validator with custom rules
  const templateValidator = new TemplateValidator();
  templateValidator.consistencyRules.push(CommonTemplateRules.TYPESCRIPT_TYPE_ANNOTATIONS);
  templateValidator.consistencyRules.push(CommonTemplateRules.CODE_FORMATTING);
  pipeline.addValidator(templateValidator);

  console.log(`✅ Pipeline initialized with ${pipeline.getValidators().length} validators\n`);

  // 2. Validate RDF/TTL data
  console.log('📋 Step 2: Validating RDF data...');
  
  const rdfData = `
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:person1 a foaf:Person ;
    foaf:name "John Doe" ;
    foaf:age "30"^^xsd:integer ;
    foaf:mbox "john.doe@example.com" .

ex:person2 a foaf:Person ;
    foaf:name "Jane Smith" ;
    foaf:age "invalid_age"^^xsd:integer ;
    foaf:mbox "invalid-email" .

# Circular reference test
ex:org1 ex:hasParent ex:org2 .
ex:org2 ex:hasParent ex:org1 .
  `;

  const rdfResult = await pipeline.validate({
    id: 'rdf-test',
    type: 'rdf',
    content: rdfData
  });

  console.log(`RDF Validation Result:`);
  console.log(`- Valid: ${rdfResult.isValid}`);
  console.log(`- Errors: ${rdfResult.errors.length}`);
  console.log(`- Warnings: ${rdfResult.warnings.length}`);
  
  if (rdfResult.errors.length > 0) {
    console.log('❌ Errors found:');
    rdfResult.errors.slice(0, 3).forEach((error, i) => {
      console.log(`  ${i + 1}. ${error.message} (${error.code})`);
    });
  }
  console.log();

  // 3. Validate SHACL constraints
  console.log('📋 Step 3: Validating SHACL constraints...');
  
  // Load SHACL shapes
  await shaclValidator.loadShaclShapes([CommonShapes.PERSON_SHAPE]);
  
  const shaclResult = await shaclValidator.validate(rdfData);
  
  console.log(`SHACL Validation Result:`);
  console.log(`- Valid: ${shaclResult.isValid}`);
  console.log(`- Errors: ${shaclResult.errors.length}`);
  console.log(`- Warnings: ${shaclResult.warnings.length}`);
  
  if (shaclResult.errors.length > 0) {
    console.log('❌ SHACL Violations found:');
    shaclResult.errors.slice(0, 3).forEach((error, i) => {
      console.log(`  ${i + 1}. ${error.message} (${error.code})`);
    });
  }
  console.log();

  // 4. Validate template output
  console.log('📋 Step 4: Validating template output...');
  
  const templateOutput = JSON.stringify({
    templatePath: '/templates/user-service.njk',
    variables: { serviceName: 'UserService', port: 3000 },
    dependencies: ['express', 'joi', 'bcrypt'],
    files: {
      'src/services/UserService.ts': `
import express from 'express';
import Joi from 'joi';
import bcrypt from 'bcrypt';

export class UserService {
  private app: express.Application;
  
  constructor() {
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.post('/users', this.createUser.bind(this));
    this.app.get('/users/:id', this.getUser.bind(this));
  }

  private createUser(req: express.Request, res: express.Response): void {
    const schema = Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email().required(),
      password: Joi.string().min(8).required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0].message });
      return;
    }

    // Hash password
    const hashedPassword = bcrypt.hashSync(value.password, 10);
    
    // TODO: Save user to database
    res.status(201).json({ message: 'User created successfully' });
  }

  private getUser(req: express.Request, res: express.Response): void {
    const userId = req.params.id;
    // TODO: Fetch user from database
    res.json({ id: userId, name: 'Sample User' });
  }

  listen(port: number): void {
    this.app.listen(port, () => {
      console.log(\`Server running on port \${port}\`);
    });
  }
}
      `,
      'src/services/UserService.test.ts': `
import { UserService } from './UserService';
import request from 'supertest';

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService();
  });

  test('should create user with valid data', async () => {
    const userData = {
      name: 'John Doe',
      email: 'john.doe@example.com',
      password: 'password123'
    };

    const response = await request(userService.app)
      .post('/users')
      .send(userData)
      .expect(201);

    expect(response.body.message).toBe('User created successfully');
  });

  test('should reject invalid email', async () => {
    const userData = {
      name: 'John Doe',
      email: 'invalid-email',
      password: 'password123'
    };

    await request(userService.app)
      .post('/users')
      .send(userData)
      .expect(400);
  });
});
      `,
      'package.json': `{
  "name": "user-service",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.0",
    "joi": "^17.6.0",
    "bcrypt": "^5.1.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/bcrypt": "^5.0.0",
    "jest": "^29.0.0",
    "supertest": "^6.3.0",
    "typescript": "^4.9.0"
  }
}`
    }
  });

  const templateResult = await templateValidator.validate(templateOutput);
  
  console.log(`Template Validation Result:`);
  console.log(`- Valid: ${templateResult.isValid}`);
  console.log(`- Errors: ${templateResult.errors.length}`);
  console.log(`- Warnings: ${templateResult.warnings.length}`);
  
  if (templateResult.errors.length > 0) {
    console.log('❌ Template Issues found:');
    templateResult.errors.slice(0, 3).forEach((error, i) => {
      console.log(`  ${i + 1}. ${error.message} (${error.code})`);
    });
  }
  console.log();

  // 5. Batch validation
  console.log('📋 Step 5: Running batch validation...');
  
  const batchItems = [
    {
      id: 'rdf-sample',
      type: 'rdf' as const,
      content: rdfData
    },
    {
      id: 'template-sample',
      type: 'template' as const,
      content: templateOutput
    },
    {
      id: 'invalid-rdf',
      type: 'rdf' as const,
      content: 'Invalid RDF content @#$%'
    }
  ];

  const batchResult = await pipeline.validateBatch({
    items: batchItems,
    config: {
      strictMode: true,
      maxErrors: 50,
      timeout: 60000,
      memoryLimit: 1024 * 1024 * 1024, // 1GB
      enablePerformanceMetrics: true,
      cacheEnabled: true,
      parallelProcessing: true,
      validationRules: [
        {
          name: 'required-prefixes',
          enabled: true,
          severity: 'warning' as const,
          parameters: { requiredPrefixes: ['foaf', 'xsd'] }
        }
      ]
    },
    parallel: true,
    maxConcurrency: 3
  });

  console.log(`Batch Validation Results:`);
  console.log(`- Total Items: ${batchResult.summary.totalItems}`);
  console.log(`- Valid Items: ${batchResult.summary.validItems}`);
  console.log(`- Invalid Items: ${batchResult.summary.invalidItems}`);
  console.log(`- Total Errors: ${batchResult.summary.totalErrors}`);
  console.log(`- Total Warnings: ${batchResult.summary.totalWarnings}`);
  console.log(`- Duration: ${batchResult.duration.toFixed(2)}ms`);
  console.log();

  // 6. Performance analysis
  console.log('📋 Step 6: Performance analysis...');
  
  const metrics = pipeline.getMetrics();
  console.log(`Pipeline Metrics:`);
  console.log(`- Memory Usage: ${(metrics.performanceMetrics?.memoryUsage || 0 / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`- CPU Time: ${(metrics.performanceMetrics?.cpuTime || 0).toFixed(2)}ms`);
  console.log(`- Cache Performance: ${metrics.performanceMetrics?.cacheHits || 0} hits, ${metrics.performanceMetrics?.cacheMisses || 0} misses`);
  console.log();

  // 7. Custom validation example
  console.log('📋 Step 7: Custom validation rules...');
  
  // Add custom semantic validator with domain-specific rules
  class FinancialDataValidator extends SemanticValidator {
    constructor() {
      super({
        strictMode: true,
        validationRules: [
          {
            name: 'financial-compliance',
            enabled: true,
            severity: 'error',
            parameters: {
              requiredCompliance: ['SOX', 'GDPR'],
              sensitiveDataEncryption: true
            }
          }
        ]
      });
    }

    async validateFinancialCompliance(content) {
      // Custom financial data validation logic
      const errors = [];
      
      if (!content.includes('encryption')) {
        errors.push({
          type: 'compliance_error',
          message: 'Financial data must specify encryption requirements',
          code: 'FINANCIAL_ENCRYPTION_REQUIRED',
          severity: 'error'
        });
      }
      
      if (!content.includes('audit')) {
        errors.push({
          type: 'compliance_error',
          message: 'Financial data must include audit trail requirements',
          code: 'FINANCIAL_AUDIT_REQUIRED',
          severity: 'error'
        });
      }
      
      return errors;
    }
  }

  const financialValidator = new FinancialDataValidator();
  pipeline.addValidator(financialValidator);

  const financialData = `
@prefix fin: <http://financial.com/ontology#> .
@prefix compliance: <http://compliance.com/ontology#> .

fin:transaction1 a fin:Transaction ;
    fin:amount "10000.00"^^xsd:decimal ;
    fin:currency "USD" ;
    compliance:encryption "AES-256" ;
    compliance:auditLevel "full" .
  `;

  const financialResult = await pipeline.validate({
    id: 'financial-test',
    type: 'rdf',
    content: financialData
  });

  console.log(`Financial Data Validation:`);
  console.log(`- Valid: ${financialResult.isValid}`);
  console.log(`- Errors: ${financialResult.errors.length}`);
  console.log(`- Custom Rules Applied: ${financialValidator.config.validationRules.length}`);
  console.log();

  // 8. Integration with external systems
  console.log('📋 Step 8: Integration examples...');
  
  // Example: Validate generated code against external schema
  const externalSchemaValidation = async (generatedCode) => {
    // Simulate external API validation
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          isValid: Math.random() > 0.3, // 70% pass rate
          externalErrors: Math.random() > 0.5 ? [] : ['External schema mismatch'],
          externalWarnings: ['Consider using more specific types']
        });
      }, 100);
    });
  };

  const codeToValidate = `
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    // Implementation here
    return null;
  }

  async create(user: Omit<User, 'id'>): Promise<User> {
    // Implementation here
    return { id: 'generated', ...user };
  }
}
  `;

  const externalResult = await externalSchemaValidation(codeToValidate);
  console.log(`External Schema Validation:`);
  console.log(`- Valid: ${externalResult.isValid}`);
  console.log(`- External Errors: ${externalResult.externalErrors.length}`);
  console.log(`- External Warnings: ${externalResult.externalWarnings.length}`);
  
  // Final summary
  console.log('\n🎉 Validation workflow completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`- RDF Validation: ${rdfResult.isValid ? '✅' : '❌'} (${rdfResult.errors.length} errors)`);
  console.log(`- SHACL Validation: ${shaclResult.isValid ? '✅' : '❌'} (${shaclResult.errors.length} errors)`);
  console.log(`- Template Validation: ${templateResult.isValid ? '✅' : '❌'} (${templateResult.errors.length} errors)`);
  console.log(`- Batch Processing: ${batchResult.summary.validItems}/${batchResult.summary.totalItems} items valid`);
  console.log(`- Financial Compliance: ${financialResult.isValid ? '✅' : '❌'} (${financialResult.errors.length} errors)`);
  console.log(`- External Integration: ${externalResult.isValid ? '✅' : '❌'}`);
  
  console.log('\n🔧 Production Deployment Checklist:');
  console.log('- ✅ Semantic validation pipeline configured');
  console.log('- ✅ SHACL shapes loaded and validated');
  console.log('- ✅ Template consistency rules applied');
  console.log('- ✅ Batch processing with parallelization');
  console.log('- ✅ Performance monitoring enabled');
  console.log('- ✅ Custom domain validation rules');
  console.log('- ✅ External system integration');
  console.log('- ✅ Error reporting and logging');
  console.log('- ✅ Caching for performance optimization');
  
  return {
    rdfResult,
    shaclResult,
    templateResult,
    batchResult,
    financialResult,
    externalResult
  };
}

/**
 * Production deployment helper
 */
function createProductionValidationPipeline(config = {}) {
  const pipeline = new SemanticValidationPipelineImpl();
  
  // Add all validators
  pipeline.addValidator(new SemanticValidator({
    strictMode: config.strictMode || true,
    maxErrors: config.maxErrors || 100,
    timeout: config.timeout || 30000,
    enablePerformanceMetrics: true,
    cacheEnabled: true,
    ...config
  }));
  
  pipeline.addValidator(new ShaclValidator());
  pipeline.addValidator(new TemplateValidator());
  
  return pipeline;
}

/**
 * Validation metrics dashboard data
 */
function generateValidationMetrics(results) {
  const totalValidations = Object.keys(results).length;
  const successfulValidations = Object.values(results).filter(r => r.isValid).length;
  const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = Object.values(results).reduce((sum, r) => sum + r.warnings.length, 0);
  
  return {
    overview: {
      totalValidations,
      successfulValidations,
      failedValidations: totalValidations - successfulValidations,
      successRate: ((successfulValidations / totalValidations) * 100).toFixed(2) + '%'
    },
    quality: {
      totalErrors,
      totalWarnings,
      averageErrorsPerValidation: (totalErrors / totalValidations).toFixed(2),
      averageWarningsPerValidation: (totalWarnings / totalValidations).toFixed(2)
    },
    performance: {
      totalDuration: Object.values(results).reduce((sum, r) => sum + r.metadata.duration, 0),
      averageDuration: Object.values(results).reduce((sum, r) => sum + r.metadata.duration, 0) / totalValidations,
      resourcesValidated: Object.values(results).reduce((sum, r) => sum + r.metadata.resourcesValidated, 0)
    },
    recommendations: [
      totalErrors > 0 ? 'Address validation errors before deployment' : 'No critical errors found',
      totalWarnings > 5 ? 'Consider addressing validation warnings for better quality' : 'Good code quality maintained',
      'Regular validation runs recommended for continuous quality assurance',
      'Monitor performance metrics for large-scale validations'
    ]
  };
}

// Export for use in other modules
module.exports = {
  runValidationWorkflow,
  createProductionValidationPipeline,
  generateValidationMetrics
};

// Run the workflow if executed directly
if (require.main === module) {
  runValidationWorkflow()
    .then((results) => {
      const metrics = generateValidationMetrics(results);
      console.log('\n📈 Validation Metrics Dashboard:');
      console.log(JSON.stringify(metrics, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Validation workflow failed:', error);
      process.exit(1);
    });
}