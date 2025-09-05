@advanced @api
Feature: Programmatic API Integration
  As a developer integrating Unjucks into applications
  I want a comprehensive programmatic API with parity to CLI features
  So that I can embed code generation seamlessly into development workflows

  Background:
    Given the Unjucks programmatic API is available
    And the following API client is initialized:
      """javascript
      import { UnjucksAPI, GeneratorManager, TemplateEngine } from 'unjucks/api';
      
      const api = new UnjucksAPI({
        projectRoot: './my-project',
        configPath: './unjucks.config.ts',
        logLevel: 'info'
      });
      """

  @api-parity
  Scenario: Complete CLI-to-API parity
    Given all CLI commands have programmatic equivalents
    When I use the API to perform operations equivalent to CLI commands:
      | cli_command                                    | api_method                              |
      | unjucks list                                   | api.listGenerators()                    |
      | unjucks help command citty                     | api.getGeneratorHelp('command', 'citty') |
      | unjucks generate command citty --name User     | api.generate('command', 'citty', {name: 'User'}) |
      | unjucks inject auth middleware --target app.js | api.inject('auth', 'middleware', {target: 'app.js'}) |
    Then API methods should provide identical functionality to CLI
    And API responses should include the same data as CLI output
    And API should support all CLI flags and options programmatically

  @async-operations
  Scenario: Asynchronous operation support
    Given long-running generation operations
    When I initiate async operations via API:
      ```javascript
      const operation = await api.generateAsync('large-project', 'microservices', {
        services: ['user', 'order', 'payment', 'notification'],
        includeTests: true,
        includeDocs: true
      });
      ```
    Then operations should return immediately with operation handles
    And I should be able to monitor progress via callbacks or promises
    And I should be able to cancel operations gracefully
    And operation status should be queryable at any time

  @event-hooks-system
  Scenario: Comprehensive event hooks system
    Given the API supports event hooks for generation lifecycle
    When I register event hooks for various stages:
      ```javascript
      api.on('beforeGeneration', (context) => {
        console.log('Starting generation:', context.generator);
      });
      
      api.on('fileCreated', (file) => {
        console.log('Created:', file.path);
      });
      
      api.on('generationComplete', (result) => {
        console.log('Completed:', result.filesCreated.length, 'files');
      });
      
      api.on('error', (error) => {
        console.error('Generation error:', error);
      });
      ```
    Then hooks should be called at appropriate lifecycle stages
    And hook context should include relevant data for each stage
    And hooks should be able to modify generation behavior
    And error hooks should provide detailed error information

  @custom-filters-plugins
  Scenario: Custom filters and plugins system
    Given the ability to extend Unjucks with custom functionality
    When I register custom filters and plugins:
      ```javascript
      // Custom filter registration
      api.registerFilter('slugify', (text) => {
        return text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      });
      
      // Custom plugin registration
      api.registerPlugin('typescript-validator', {
        beforeGeneration: (context) => {
          // Validate TypeScript-specific templates
        },
        afterGeneration: (result) => {
          // Run TypeScript compiler checks
        }
      });
      ```
    Then custom filters should be available in all templates
    And custom plugins should be invoked at appropriate hooks
    And plugins should have access to full generation context
    And plugin errors should be handled gracefully

  @streaming-api
  Scenario: Streaming API for real-time generation
    Given large-scale generation operations
    When I use the streaming API:
      ```javascript
      const stream = api.generateStream('enterprise-app', 'full-stack', {
        modules: ['auth', 'dashboard', 'reports', 'admin']
      });
      
      stream.on('data', (chunk) => {
        // Real-time progress updates
        updateProgressBar(chunk.progress);
      });
      
      stream.on('file', (file) => {
        // Individual file completion
        console.log('Generated:', file.path);
      });
      ```
    Then generation progress should be streamed in real-time
    And individual file completions should be reported immediately
    And stream should be backpressure-aware for large operations
    And streaming should support pause/resume functionality

  @batch-api-operations
  Scenario: Batch API operations
    Given multiple generation operations to perform
    When I use batch API operations:
      ```javascript
      const batch = api.createBatch();
      
      batch.add('generate', 'model', 'user', { name: 'User' });
      batch.add('generate', 'controller', 'api', { name: 'UserController' });
      batch.add('generate', 'test', 'unit', { target: 'User' });
      batch.add('inject', 'route', 'express', { controller: 'UserController' });
      
      const results = await batch.execute({ parallel: true });
      ```
    Then batch operations should execute efficiently
    And parallelization should be configurable
    And batch results should be aggregated and returned
    And partial failures should be handled gracefully

  @api-configuration-management
  Scenario: Dynamic configuration management
    Given the need for runtime configuration changes
    When I modify configuration via API:
      ```javascript
      // Update configuration
      await api.updateConfig({
        templatePaths: ['./custom-templates', './shared-templates'],
        outputPath: './generated',
        variables: {
          author: 'John Doe',
          license: 'MIT'
        }
      });
      
      // Get current configuration
      const config = await api.getConfig();
      ```
    Then configuration changes should take effect immediately
    And configuration should be validated before application
    And configuration history should be maintained for rollback
    And config changes should trigger appropriate cache invalidation

  @api-error-handling
  Scenario: Comprehensive API error handling
    Given various error conditions during API operations
    When API operations encounter errors:
      | error_type                | error_condition              |
      | ValidationError           | Invalid template parameters  |
      | GenerationError          | Template rendering failure   |
      | FileSystemError          | Permission denied            |
      | NetworkError             | Remote template unavailable  |
      | ConfigurationError       | Invalid configuration        |
    Then errors should be properly typed and structured
    And error messages should be user-friendly and actionable
    And error context should include relevant debugging information
    And error recovery suggestions should be provided

  @api-caching-control
  Scenario: Programmatic cache control
    Given cached templates and generation results
    When I control caching via API:
      ```javascript
      // Clear specific cache
      await api.cache.clear('templates');
      await api.cache.clear('generation-results');
      
      // Get cache statistics
      const stats = await api.cache.getStats();
      
      // Configure cache behavior
      await api.cache.configure({
        maxSize: '500MB',
        ttl: '1h',
        strategy: 'lru'
      });
      ```
    Then cache operations should complete successfully
    And cache statistics should provide useful metrics
    And cache configuration should be applied correctly
    And cache performance should be optimized

  @api-workspace-management
  Scenario: Workspace and project management
    Given multiple projects and workspaces
    When I manage workspaces via API:
      ```javascript
      // Create workspace
      const workspace = await api.createWorkspace({
        name: 'my-project',
        path: './projects/my-project',
        template: 'nodejs-api'
      });
      
      // Switch workspace context
      await api.setActiveWorkspace('my-project');
      
      // List available workspaces
      const workspaces = await api.listWorkspaces();
      ```
    Then workspace operations should manage project isolation
    And workspace context should affect all subsequent operations
    And workspace metadata should be persisted correctly
    And workspace switching should be seamless

  @api-template-management
  Scenario: Dynamic template management
    Given the need to manage templates programmatically
    When I manage templates via API:
      ```javascript
      // Register remote template
      await api.templates.register('https://github.com/user/templates.git');
      
      // Install template locally
      await api.templates.install('react-component', {
        version: '2.1.0',
        source: 'npm'
      });
      
      // Validate template
      const validation = await api.templates.validate('my-template');
      
      // Get template metadata
      const metadata = await api.templates.getMetadata('react-component');
      ```
    Then template operations should handle remote sources correctly
    And template versions should be managed appropriately
    And template validation should catch common issues
    And template metadata should be comprehensive

  @api-integration-testing
  Scenario: API integration testing support
    Given integration tests for API functionality
    When I create tests using the API:
      ```javascript
      import { createTestEnvironment } from 'unjucks/testing';
      
      const testEnv = await createTestEnvironment({
        isolated: true,
        fixtures: './test-fixtures'
      });
      
      // Test generation
      const result = await testEnv.api.generate('test-generator', 'sample', {
        name: 'TestModel'
      });
      
      // Verify results
      expect(result.filesCreated).toHaveLength(3);
      expect(testEnv.fs.exists('./src/models/TestModel.ts')).toBe(true);
      ```
    Then test environment should provide isolated execution
    And test fixtures should be loaded correctly
    And API operations should work in test context
    And test cleanup should be automatic

  @api-middleware-system
  Scenario: Middleware system for API extensibility
    Given the need to extend API functionality
    When I implement API middleware:
      ```javascript
      // Request middleware
      api.use('request', async (context, next) => {
        console.log('API Request:', context.method, context.params);
        context.startTime = Date.now();
        await next();
      });
      
      // Response middleware
      api.use('response', async (context, next) => {
        await next();
        console.log('API Response time:', Date.now() - context.startTime);
      });
      ```
    Then middleware should be executed in correct order
    And middleware should have access to request/response context
    And middleware should be able to modify behavior
    And middleware errors should be handled appropriately

  @api-documentation-generation
  Scenario: Automatic API documentation generation
    Given the programmatic API with comprehensive methods
    When I generate API documentation:
      ```javascript
      const docs = await api.generateDocumentation({
        format: 'openapi',
        includeExamples: true,
        outputPath: './docs/api.yml'
      });
      ```
    Then API documentation should be generated automatically
    And documentation should include method signatures and examples
    And multiple output formats should be supported
    And documentation should be kept in sync with API changes

  @api-performance-monitoring
  Scenario: Built-in performance monitoring
    Given API operations with performance tracking
    When I monitor API performance:
      ```javascript
      // Enable performance monitoring
      api.enablePerformanceMonitoring();
      
      // Get performance metrics
      const metrics = await api.getPerformanceMetrics({
        timeRange: '1h',
        operations: ['generate', 'inject', 'list']
      });
      
      // Set performance alerts
      api.setPerformanceAlert('generate', {
        maxDuration: 5000, // 5 seconds
        onViolation: (metric) => {
          console.warn('Performance threshold exceeded:', metric);
        }
      });
      ```
    Then performance metrics should be collected automatically
    And metrics should provide actionable insights
    And performance alerts should trigger appropriately
    And monitoring should have minimal performance impact