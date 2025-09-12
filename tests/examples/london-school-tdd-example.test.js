/**
 * London School TDD Example - Template Generation Service
 * Demonstrates behavior verification and outside-in development
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMock, expect as expectMock, verifyAll, resetAll } from '../helpers/enhanced-mock-framework.js';
import { PropertyTestHelper } from '../helpers/property-test-helper.js';
import { AsyncTestHelper } from '../helpers/async-test-helper.js';
import { createTestEnvironment, cleanupTestEnvironment, getTestHelpers } from '../helpers/test-environment-manager.js';
import { storeInMemory, retrieveFromMemory } from '../helpers/test-coordination-hooks.js';

describe('London School TDD - Template Generation Service', () => {
  let templateService;
  let mockFileWriter;
  let mockTemplateRenderer;
  let mockVariableValidator;
  let mockNotificationService;
  let propertyHelper;
  let asyncHelper;
  let environmentId;

  beforeEach(async () => {
    // Reset all mocks
    resetAll();
    
    // Create test environment
    environmentId = await createTestEnvironment('template-generation-test');
    
    // Initialize helpers
    propertyHelper = new PropertyTestHelper({ numRuns: 20 });
    asyncHelper = new AsyncTestHelper({ defaultTimeout: 2000 });
    
    // Create mocks for collaborators (London School approach)
    mockFileWriter = createMock('FileWriter', {
      writeFile: { async: true, returnValue: { success: true, path: '/output/file.js' } },
      createDirectory: { async: true, returnValue: true },
      fileExists: { async: true, returnValue: false }
    });
    
    mockTemplateRenderer = createMock('TemplateRenderer', {
      render: { async: true, returnValue: 'rendered content' },
      parseTemplate: { returnValue: { variables: ['name', 'description'] } },
      validateSyntax: { returnValue: { valid: true } }
    });
    
    mockVariableValidator = createMock('VariableValidator', {
      validate: { returnValue: { valid: true, errors: [] } },
      getRequiredVariables: { returnValue: ['name'] },
      sanitizeValue: { implementation: (value) => String(value).trim() }
    });
    
    mockNotificationService = createMock('NotificationService', {
      notifySuccess: { async: true, returnValue: true },
      notifyError: { async: true, returnValue: true }
    });
    
    // Create the service under test with mocked dependencies
    templateService = new TemplateGenerationService(
      mockFileWriter,
      mockTemplateRenderer,
      mockVariableValidator,
      mockNotificationService
    );
  });

  afterEach(async () => {
    await propertyHelper.cleanup();
    await asyncHelper.cleanup();
    await cleanupTestEnvironment(environmentId);
    resetAll();
  });

  describe('generateFromTemplate - Outside-In Behavior', () => {
    it('should orchestrate the complete template generation workflow', async () => {
      // Arrange - Setup the collaboration expectations
      const templatePath = 'component/basic.njk';
      const outputPath = '/output';
      const variables = { name: 'UserProfile', description: 'User profile component' };
      
      expectMock('TemplateRenderer', 'parseTemplate')
        .toBeCalledWith(templatePath)
        .toBeCalledTimes(1);
        
      expectMock('VariableValidator', 'validate')
        .toBeCalledWith(variables, ['name'])
        .toBeCalledTimes(1);
        
      expectMock('TemplateRenderer', 'render')
        .toBeCalledWith(templatePath, variables)
        .toBeCalledTimes(1);
        
      expectMock('FileWriter', 'writeFile')
        .toBeCalledWith('/output/user-profile.js', 'rendered content')
        .toBeCalledTimes(1);
        
      expectMock('NotificationService', 'notifySuccess')
        .toBeCalledTimes(1);

      // Act - Execute the behavior
      const result = await templateService.generateFromTemplate(
        templatePath, 
        outputPath, 
        variables
      );

      // Assert - Verify the collaboration and outcome
      expect(result.success).toBe(true);
      expect(result.generatedFiles).toHaveLength(1);
      expect(result.generatedFiles[0]).toBe('/output/user-profile.js');
      
      // Verify all mock interactions occurred as expected
      verifyAll();
    });

    it('should handle validation failures by notifying and not generating files', async () => {
      // Arrange - Setup validation failure scenario
      const variables = { description: 'Missing name' }; // Invalid: missing required 'name'
      
      // Configure validator to fail
      mockVariableValidator.validate = () => ({ 
        valid: false, 
        errors: ['Required variable "name" is missing'] 
      });
      
      expectMock('VariableValidator', 'validate')
        .toBeCalledTimes(1);
        
      expectMock('NotificationService', 'notifyError')
        .toBeCalledWith('Validation failed: Required variable "name" is missing')
        .toBeCalledTimes(1);
        
      // Template rendering and file writing should NOT happen
      expectMock('TemplateRenderer', 'render')
        .toBeCalledTimes(0);
        
      expectMock('FileWriter', 'writeFile')
        .toBeCalledTimes(0);

      // Act & Assert
      const result = await templateService.generateFromTemplate(
        'component/basic.njk',
        '/output',
        variables
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Required variable "name" is missing');
      
      verifyAll();
    });

    it('should verify interaction order in the generation pipeline', async () => {
      // Arrange
      const templatePath = 'component/basic.njk';
      const variables = { name: 'TestComponent' };

      // Act
      await templateService.generateFromTemplate(templatePath, '/output', variables);

      // Assert - Verify the correct sequence of operations
      // 1. Parse template first
      // 2. Validate variables second  
      // 3. Render template third
      // 4. Write file fourth
      // 5. Notify success last
      
      expect(mockTemplateRenderer._getCalls('parseTemplate')[0].sequence)
        .toBeLessThan(mockVariableValidator._getCalls('validate')[0].sequence);
        
      expect(mockVariableValidator._getCalls('validate')[0].sequence)
        .toBeLessThan(mockTemplateRenderer._getCalls('render')[0].sequence);
        
      expect(mockTemplateRenderer._getCalls('render')[0].sequence)
        .toBeLessThan(mockFileWriter._getCalls('writeFile')[0].sequence);
        
      expect(mockFileWriter._getCalls('writeFile')[0].sequence)
        .toBeLessThan(mockNotificationService._getCalls('notifySuccess')[0].sequence);
    });
  });

  describe('Property-based Testing with Mocks', () => {
    it('should maintain behavior invariants across different inputs', async () => {
      await propertyHelper.runProperty(
        async ({ templatePath, variables }) => {
          // Reset mocks for each property test iteration
          resetAll();
          
          // Configure fresh mocks
          const freshMockRenderer = createMock('TemplateRenderer', {
            parseTemplate: { returnValue: { variables: Object.keys(variables) } },
            render: { async: true, returnValue: 'mock rendered content' }
          });
          
          const freshMockValidator = createMock('VariableValidator', {
            validate: { returnValue: { valid: true, errors: [] } },
            getRequiredVariables: { returnValue: Object.keys(variables) }
          });
          
          const freshMockWriter = createMock('FileWriter', {
            writeFile: { async: true, returnValue: { success: true, path: '/mock/path' } }
          });
          
          const freshMockNotifier = createMock('NotificationService', {
            notifySuccess: { async: true, returnValue: true }
          });
          
          const service = new TemplateGenerationService(
            freshMockWriter,
            freshMockRenderer,  
            freshMockValidator,
            freshMockNotifier
          );

          // Property: Valid inputs should always result in successful generation
          const result = await service.generateFromTemplate(templatePath, '/output', variables);
          
          // Invariant: Success means all collaborators were called appropriately
          if (result.success) {
            expect(freshMockRenderer._hasBeenCalled('parseTemplate')).toBe(true);
            expect(freshMockValidator._hasBeenCalled('validate')).toBe(true);
            expect(freshMockRenderer._hasBeenCalled('render')).toBe(true);
            expect(freshMockWriter._hasBeenCalled('writeFile')).toBe(true);
            expect(freshMockNotifier._hasBeenCalled('notifySuccess')).toBe(true);
          }
          
          return true;
        },
        require('fast-check').record({
          templatePath: require('fast-check').string({ minLength: 1, maxLength: 50 }),
          variables: propertyHelper.arbitraryTemplateVariables()
        }),
        { numRuns: 25 }
      );
    });
  });

  describe('Async Behavior Testing', () => {
    it('should handle concurrent template generation requests', async () => {
      // Create multiple generation requests
      const requests = Array.from({ length: 5 }, (_, i) => ({
        templatePath: `template-${i}.njk`,
        outputPath: `/output-${i}`,
        variables: { name: `Component${i}`, index: i }
      }));

      // Execute concurrent generations
      const operations = requests.map(req => 
        () => templateService.generateFromTemplate(req.templatePath, req.outputPath, req.variables)
      );

      const result = await asyncHelper.executeParallel(operations, {
        concurrency: 3,
        timeout: 5000
      });

      // Verify all operations completed successfully
      expect(result.successCount).toBe(5);
      expect(result.errorCount).toBe(0);

      // Verify each collaboration happened
      requests.forEach((_, i) => {
        expect(mockTemplateRenderer._hasBeenCalledWith('parseTemplate', `template-${i}.njk`)).toBe(true);
        expect(mockFileWriter._hasBeenCalledWith('writeFile', `/output-${i}/component${i}.js`, 'rendered content')).toBe(true);
      });
    });

    it('should handle timeout scenarios gracefully', async () => {
      // Configure renderer to simulate slow operation
      mockTemplateRenderer.render = () => new Promise(resolve => 
        setTimeout(() => resolve('slow render'), 3000)
      );

      const startTime = this.getDeterministicTimestamp();
      
      try {
        await asyncHelper.withTimeout(
          () => templateService.generateFromTemplate('slow-template.njk', '/output', { name: 'Test' }),
          1000,
          'template-generation'
        );
        
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        const duration = this.getDeterministicTimestamp() - startTime;
        expect(error.message).toContain('timeout');
        expect(duration).toBeLessThan(1500); // Should timeout around 1000ms
        
        // Verify error notification was called
        expect(mockNotificationService._hasBeenCalledWith('notifyError', expect.stringContaining('timeout'))).toBe(true);
      }
    });
  });

  describe('Cross-test Communication', () => {
    it('should share generation results across test instances', async () => {
      // Store generation config in shared memory
      await storeInMemory('generation-config', {
        defaultTemplate: 'component/basic.njk',
        outputPath: '/shared-output',
        commonVariables: { author: 'Test Suite', version: '1.0.0' }
      });

      // Execute generation
      const result = await templateService.generateFromTemplate(
        'component/basic.njk',
        '/output',
        { name: 'SharedComponent', description: 'Shared test component' }
      );

      // Store results for other tests to verify
      await storeInMemory('last-generation-result', {
        success: result.success,
        files: result.generatedFiles,
        timestamp: this.getDeterministicTimestamp()
      });

      // Verify generation succeeded
      expect(result.success).toBe(true);
      
      // Retrieve and verify shared data
      const storedConfig = await retrieveFromMemory('generation-config');
      expect(storedConfig.data.defaultTemplate).toBe('component/basic.njk');
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from file writing failures', async () => {
      // Configure file writer to fail initially
      let writeAttempts = 0;
      mockFileWriter.writeFile = async () => {
        writeAttempts++;
        if (writeAttempts === 1) {
          throw new Error('Permission denied');
        }
        return { success: true, path: '/output/recovered.js' };
      };

      // Use async helper with retry capability
      const result = await asyncHelper.withExponentialBackoff(
        () => templateService.generateFromTemplate('component/basic.njk', '/output', { name: 'Recovery' }),
        { maxAttempts: 3, baseDelay: 100 }
      );

      expect(result.success).toBe(true);
      expect(writeAttempts).toBe(2); // Failed once, succeeded on retry
      
      // Verify error and success notifications
      expect(mockNotificationService._hasBeenCalled('notifyError')).toBe(true);
      expect(mockNotificationService._hasBeenCalled('notifySuccess')).toBe(true);
    });
  });
});

/**
 * Template Generation Service Implementation
 * This is the system under test, demonstrating London School TDD principles
 */
class TemplateGenerationService {
  constructor(fileWriter, templateRenderer, variableValidator, notificationService) {
    this.fileWriter = fileWriter;
    this.templateRenderer = templateRenderer;
    this.variableValidator = variableValidator;
    this.notificationService = notificationService;
  }

  async generateFromTemplate(templatePath, outputPath, variables) {
    try {
      // 1. Parse template to understand structure
      const templateInfo = this.templateRenderer.parseTemplate(templatePath);
      
      // 2. Validate provided variables
      const requiredVars = this.variableValidator.getRequiredVariables(templateInfo);
      const validation = this.variableValidator.validate(variables, requiredVars);
      
      if (!validation.valid) {
        const errorMessage = `Validation failed: ${validation.errors.join(', ')}`;
        await this.notificationService.notifyError(errorMessage);
        return {
          success: false,
          errors: validation.errors,
          generatedFiles: []
        };
      }

      // 3. Render template with variables
      const renderedContent = await this.templateRenderer.render(templatePath, variables);
      
      // 4. Generate output filename
      const fileName = this.generateFileName(variables.name || 'generated');
      const fullPath = `${outputPath}/${fileName}.js`;
      
      // 5. Write file
      const writeResult = await this.fileWriter.writeFile(fullPath, renderedContent);
      
      if (!writeResult.success) {
        throw new Error(`Failed to write file: ${fullPath}`);
      }
      
      // 6. Notify success
      await this.notificationService.notifySuccess(`Generated: ${fullPath}`);
      
      return {
        success: true,
        generatedFiles: [fullPath],
        errors: []
      };
      
    } catch (error) {
      await this.notificationService.notifyError(error.message);
      return {
        success: false,
        errors: [error.message],
        generatedFiles: []
      };
    }
  }

  generateFileName(name) {
    return name
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');
  }
}