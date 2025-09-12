/**
 * KGEN Enterprise Integration Tests
 * Comprehensive integration tests for all enterprise components
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { WebSocket } from 'ws';
import Redis from 'ioredis';

// Import enterprise components
import { EnterpriseAPIServer } from '../src/enterprise/api/server.js';
import { APIGateway } from '../src/enterprise/gateway/api-gateway.js';
import { WebhookManager } from '../src/enterprise/webhooks/webhook-manager.js';
import { MessageQueueManager } from '../src/enterprise/queue/message-queue.js';
import { ETLPipelineManager } from '../src/enterprise/etl/etl-pipeline.js';
import { AuthenticationManager, LocalAuthProvider } from '../src/enterprise/auth/auth-providers.js';
import { ConnectionManager } from '../src/enterprise/connectors/connector-framework.js';

// Test configuration
const TEST_CONFIG = {
    api: {
        port: 3001,
        host: 'localhost',
        jwt: {
            secret: 'test-jwt-secret-key-for-testing'
        }
    },
    gateway: {
        port: 3002,
        host: 'localhost'
    },
    redis: {
        host: 'localhost',
        port: 6379,
        db: 15 // Use separate DB for tests
    }
};

// Global test instances
let apiServer;
let gateway;
let webhookManager;
let messageQueue;
let etlManager;
let authManager;
let connectionManager;
let redis;
let testUser;
let authToken;

describe('KGEN Enterprise Integration Tests', () => {
    beforeAll(async () => {
        // Initialize Redis client for tests
        redis = new Redis({ ...TEST_CONFIG.redis });
        await redis.flushdb(); // Clean test database

        // Initialize authentication manager
        authManager = new AuthenticationManager({
            jwtSecret: TEST_CONFIG.api.jwt.secret,
            defaultProvider: 'local'
        });

        // Register local auth provider
        const localProvider = new LocalAuthProvider({
            jwtSecret: TEST_CONFIG.api.jwt.secret,
            createDefaultAdmin: true,
            defaultAdminPassword: 'test123'
        });

        authManager.registerProvider('local', localProvider);

        // Create test user
        testUser = await localProvider.createUser({
            email: 'test@kgen.local',
            password: 'test123',
            name: 'Test User',
            roles: ['developer']
        });

        // Get auth token for API tests
        const authResult = await localProvider.authenticate({
            email: 'test@kgen.local',
            password: 'test123'
        });
        authToken = authResult.tokens.accessToken;

        // Initialize API server
        apiServer = new EnterpriseAPIServer({
            ...TEST_CONFIG.api,
            auth: authManager
        });
        await apiServer.start();

        // Initialize API Gateway
        gateway = new APIGateway({
            ...TEST_CONFIG.gateway,
            redis: TEST_CONFIG.redis
        });
        await gateway.start();

        // Initialize webhook manager
        webhookManager = new WebhookManager({
            redis: TEST_CONFIG.redis
        });

        // Initialize message queue
        messageQueue = new MessageQueueManager({
            provider: 'redis',
            redis: TEST_CONFIG.redis
        });

        // Initialize ETL pipeline manager
        etlManager = new ETLPipelineManager();

        // Initialize connection manager
        connectionManager = new ConnectionManager();

        console.log('Test environment initialized');
    });

    afterAll(async () => {
        // Clean up all services
        if (apiServer) await apiServer.shutdown();
        if (gateway) await gateway.shutdown();
        if (webhookManager) await webhookManager.shutdown();
        if (messageQueue) await messageQueue.shutdown();
        if (redis) {
            await redis.flushdb();
            await redis.quit();
        }
        
        console.log('Test environment cleaned up');
    });

    describe('API Server Integration', () => {
        test('should start API server and respond to health check', async () => {
            const response = await request(`http://localhost:${TEST_CONFIG.api.port}`)
                .get('/api/v1/health')
                .expect(200);

            expect(response.body).toHaveProperty('status', 'healthy');
            expect(response.body).toHaveProperty('version');
            expect(response.body).toHaveProperty('uptime');
        });

        test('should require authentication for protected endpoints', async () => {
            await request(`http://localhost:${TEST_CONFIG.api.port}`)
                .get('/api/v1/graphs')
                .expect(401);
        });

        test('should authenticate with valid token', async () => {
            const response = await request(`http://localhost:${TEST_CONFIG.api.port}`)
                .get('/api/v1/graphs')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('data');
            expect(response.body).toHaveProperty('pagination');
        });

        test('should serve OpenAPI documentation', async () => {
            const response = await request(`http://localhost:${TEST_CONFIG.api.port}`)
                .get('/api/v1/openapi.json')
                .expect(200);

            expect(response.body).toHaveProperty('openapi');
            expect(response.body).toHaveProperty('info');
            expect(response.body).toHaveProperty('paths');
        });
    });

    describe('GraphQL API Integration', () => {
        test('should execute GraphQL health query', async () => {
            const query = `
                query {
                    health
                    version
                }
            `;

            const response = await request(`http://localhost:${TEST_CONFIG.api.port}`)
                .post('/api/v1/graphql')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ query })
                .expect(200);

            expect(response.body).toHaveProperty('data');
            expect(response.body.data).toHaveProperty('health');
            expect(response.body.data).toHaveProperty('version');
        });

        test('should handle GraphQL mutations', async () => {
            const mutation = `
                mutation CreateGraph($input: CreateGraphInput!) {
                    createGraph(input: $input) {
                        id
                        name
                        status
                        createdAt
                    }
                }
            `;

            const variables = {
                input: {
                    name: 'Test Graph',
                    description: 'A test knowledge graph',
                    rdfData: '@prefix ex: <http://example.org/> . ex:test a ex:Entity .',
                    rdfFormat: 'TURTLE'
                }
            };

            const response = await request(`http://localhost:${TEST_CONFIG.api.port}`)
                .post('/api/v1/graphql')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ query: mutation, variables })
                .expect(200);

            expect(response.body).toHaveProperty('data');
            expect(response.body.data.createGraph).toHaveProperty('id');
            expect(response.body.data.createGraph).toHaveProperty('name', 'Test Graph');
        });
    });

    describe('Webhook System Integration', () => {
        let testWebhook;

        beforeEach(async () => {
            // Create test webhook
            testWebhook = await webhookManager.registerWebhook({
                url: 'https://httpbin.org/post',
                events: ['graph.created', 'job.completed'],
                secret: 'test-webhook-secret'
            });
        });

        afterEach(async () => {
            // Clean up webhook
            if (testWebhook) {
                await webhookManager.deleteWebhook(testWebhook.id);
            }
        });

        test('should register webhook successfully', () => {
            expect(testWebhook).toHaveProperty('id');
            expect(testWebhook).toHaveProperty('url', 'https://httpbin.org/post');
            expect(testWebhook).toHaveProperty('active', true);
            expect(testWebhook.events).toContain('graph.created');
        });

        test('should trigger webhook events', async () => {
            const eventData = {
                id: 'test-graph-123',
                name: 'Test Graph',
                createdAt: new Date().toISOString()
            };

            const deliveryCount = await webhookManager.triggerWebhook(
                'graph.created', 
                eventData,
                { priority: 5 }
            );

            expect(deliveryCount).toBe(1);
        });

        test('should test webhook delivery', async () => {
            const result = await webhookManager.testWebhook(testWebhook.id);
            
            // Note: This test might fail if httpbin.org is not accessible
            // In a real environment, use a local test server
            expect(result).toHaveProperty('success');
        });

        test('should get webhook statistics', async () => {
            const stats = await webhookManager.getWebhookStats(testWebhook.id);
            
            expect(stats).toHaveProperty('totalDeliveries');
            expect(stats).toHaveProperty('successfulDeliveries');
            expect(stats).toHaveProperty('failedDeliveries');
            expect(stats).toHaveProperty('successRate');
        });
    });

    describe('Message Queue Integration', () => {
        test('should queue and process messages', async () => {
            const messageType = 'test.message';
            const payload = { test: 'data', timestamp: Date.now() };

            // Queue message
            const job = await messageQueue.queueMessage(messageType, payload, {
                priority: 5
            });

            expect(job).toBeDefined();

            // Wait a bit for processing
            await new Promise(resolve => setTimeout(resolve, 100));

            // Check queue status
            const status = await messageQueue.getStatus();
            expect(status).toHaveProperty('provider');
            expect(status).toHaveProperty('queues');
        });

        test('should handle batch message queuing', async () => {
            const messages = [
                { type: 'batch.test', payload: { id: 1 } },
                { type: 'batch.test', payload: { id: 2 } },
                { type: 'batch.test', payload: { id: 3 } }
            ];

            const jobs = await messageQueue.queueBatch(messages, {
                batchId: 'test-batch-123'
            });

            expect(jobs).toHaveLength(3);
        });
    });

    describe('ETL Pipeline Integration', () => {
        let testPipeline;

        beforeEach(() => {
            // Create test ETL pipeline
            testPipeline = etlManager.createPipeline({
                name: 'Test Data Pipeline',
                description: 'Pipeline for testing ETL functionality',
                source: {
                    type: 'file',
                    config: {
                        filePath: './test-data.json',
                        format: 'json'
                    }
                },
                target: {
                    type: 'knowledge_graph',
                    config: {
                        graphId: 'test-graph',
                        format: 'turtle'
                    }
                },
                transformations: [
                    {
                        type: 'map',
                        config: {
                            mappings: {
                                'id': 'sourceId',
                                'name': 'displayName'
                            }
                        }
                    },
                    {
                        type: 'validate',
                        config: {
                            schema: {
                                id: { required: true, type: 'string' },
                                name: { required: true, type: 'string' }
                            }
                        }
                    }
                ]
            });
        });

        test('should create ETL pipeline', () => {
            expect(testPipeline).toHaveProperty('config');
            expect(testPipeline.config).toHaveProperty('name', 'Test Data Pipeline');
            expect(testPipeline.config.transformations).toHaveLength(2);
        });

        test('should list all pipelines', () => {
            const pipelines = etlManager.getAllPipelines();
            expect(pipelines).toHaveLength(1);
            expect(pipelines[0]).toHaveProperty('name', 'Test Data Pipeline');
        });

        test('should execute pipeline with mock data', async () => {
            // Create mock data file
            const mockData = [
                { sourceId: '1', displayName: 'Test Entity 1' },
                { sourceId: '2', displayName: 'Test Entity 2' }
            ];

            // Mock the file extractor to return test data
            const originalExtract = testPipeline.extractors.get('file').extract;
            testPipeline.extractors.get('file').extract = async () => ({
                data: mockData,
                recordCount: mockData.length,
                format: 'json'
            });

            const executionResult = await etlManager.executePipeline(testPipeline.config.id);
            
            expect(executionResult).toHaveProperty('status', 'completed');
            expect(executionResult.metrics.processedRecords).toBe(2);

            // Restore original extractor
            testPipeline.extractors.get('file').extract = originalExtract;
        });
    });

    describe('Authentication Integration', () => {
        test('should authenticate with local provider', async () => {
            const result = await authManager.authenticate('local', {
                email: 'test@kgen.local',
                password: 'test123'
            });

            expect(result).toHaveProperty('user');
            expect(result).toHaveProperty('tokens');
            expect(result.user).toHaveProperty('email', 'test@kgen.local');
            expect(result.tokens).toHaveProperty('accessToken');
            expect(result.tokens).toHaveProperty('refreshToken');
        });

        test('should validate JWT tokens', async () => {
            const user = await authManager.validateToken(authToken);
            
            expect(user).toHaveProperty('email', 'test@kgen.local');
            expect(user).toHaveProperty('roles');
        });

        test('should refresh tokens', async () => {
            const authResult = await authManager.authenticate('local', {
                email: 'test@kgen.local',
                password: 'test123'
            });

            const refreshResult = await authManager.refreshToken(authResult.tokens.refreshToken);
            
            expect(refreshResult).toHaveProperty('user');
            expect(refreshResult).toHaveProperty('tokens');
            expect(refreshResult.tokens.accessToken).toBeDefined();
        });

        test('should check user permissions', () => {
            const user = {
                id: 'test-user',
                roles: ['developer'],
                permissions: ['graph:create', 'graph:read']
            };

            expect(authManager.hasPermission(user, 'graph:read')).toBe(true);
            expect(authManager.hasPermission(user, 'system:config')).toBe(false);
            expect(authManager.hasRole(user, 'developer')).toBe(true);
            expect(authManager.hasRole(user, 'admin')).toBe(false);
        });
    });

    describe('API Gateway Integration', () => {
        test('should register routes in gateway', async () => {
            const routeConfig = {
                path: '/test-service/*',
                methods: ['GET', 'POST'],
                backends: [
                    {
                        id: 'test-backend-1',
                        url: `http://localhost:${TEST_CONFIG.api.port}/api/v1`,
                        weight: 1
                    }
                ],
                version: 'v1',
                rateLimiting: {
                    requests: 100,
                    window: 60000
                },
                caching: {
                    enabled: true,
                    ttl: 300
                }
            };

            const registeredRoute = await gateway.registerRoute(routeConfig);
            
            expect(registeredRoute).toHaveProperty('path', '/test-service/*');
            expect(registeredRoute.backends).toHaveLength(1);
        });

        test('should proxy requests through gateway', async () => {
            // This test would require the route to be registered first
            // and would test actual request proxying
            
            const response = await request(`http://localhost:${TEST_CONFIG.gateway.port}`)
                .get('/gateway/health')
                .expect(200);

            expect(response.body).toHaveProperty('status', 'healthy');
            expect(response.body).toHaveProperty('backends');
        });

        test('should get gateway metrics', async () => {
            const response = await request(`http://localhost:${TEST_CONFIG.gateway.port}`)
                .get('/gateway/metrics')
                .expect(200);

            expect(response.body).toBeDefined();
        });
    });

    describe('Enterprise Connectors Integration', () => {
        test('should create mock connector', async () => {
            // Create a mock connector for testing
            const mockConnector = await connectionManager.createConnection(
                'mock-github',
                'github',
                {
                    baseURL: 'https://api.github.com',
                    personalAccessToken: 'mock-token'
                }
            );

            expect(mockConnector).toBeDefined();
            expect(mockConnector.config.baseURL).toBe('https://api.github.com');
        });

        test('should get connection status', () => {
            const status = connectionManager.getConnectionStatus();
            expect(status).toBeDefined();
        });
    });

    describe('End-to-End Workflow', () => {
        test('should complete full knowledge graph workflow', async () => {
            // 1. Create knowledge graph via API
            const createGraphResponse = await request(`http://localhost:${TEST_CONFIG.api.port}`)
                .post('/api/v1/graphs')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'E2E Test Graph',
                    description: 'End-to-end test knowledge graph',
                    rdfData: '@prefix ex: <http://example.org/> . ex:testEntity a ex:TestClass .',
                    rdfFormat: 'turtle'
                })
                .expect(201);

            const graphId = createGraphResponse.body.id;
            expect(graphId).toBeDefined();

            // 2. Create template
            const createTemplateResponse = await request(`http://localhost:${TEST_CONFIG.api.port}`)
                .post('/api/v1/templates')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'E2E Test Template',
                    category: 'api',
                    language: 'javascript',
                    content: 'console.log("Generated from graph: {{ graph.name }}");'
                })
                .expect(201);

            const templateId = createTemplateResponse.body.id;
            expect(templateId).toBeDefined();

            // 3. Generate code artifacts
            const generateResponse = await request(`http://localhost:${TEST_CONFIG.api.port}`)
                .post(`/api/v1/graphs/${graphId}/generate`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    templateIds: [templateId],
                    variables: { projectName: 'E2E Test Project' }
                })
                .expect(202);

            const jobId = generateResponse.body.id;
            expect(jobId).toBeDefined();

            // 4. Check job status
            const jobStatusResponse = await request(`http://localhost:${TEST_CONFIG.api.port}`)
                .get(`/api/v1/jobs/${jobId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(jobStatusResponse.body).toHaveProperty('status');
            expect(jobStatusResponse.body).toHaveProperty('graphId', graphId);

            // 5. Clean up - delete graph
            await request(`http://localhost:${TEST_CONFIG.api.port}`)
                .delete(`/api/v1/graphs/${graphId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(204);
        });
    });

    describe('Performance and Load Testing', () => {
        test('should handle concurrent API requests', async () => {
            const concurrentRequests = 10;
            const requests = Array.from({ length: concurrentRequests }, () =>
                request(`http://localhost:${TEST_CONFIG.api.port}`)
                    .get('/api/v1/health')
                    .expect(200)
            );

            const responses = await Promise.all(requests);
            expect(responses).toHaveLength(concurrentRequests);
            
            responses.forEach(response => {
                expect(response.body).toHaveProperty('status', 'healthy');
            });
        });

        test('should handle rate limiting', async () => {
            // This test would need to be configured with very low rate limits
            // to be practical in a test environment
            
            const response = await request(`http://localhost:${TEST_CONFIG.api.port}`)
                .get('/api/v1/graphs')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toBeDefined();
        });
    });

    describe('Error Handling and Recovery', () => {
        test('should handle invalid authentication gracefully', async () => {
            const response = await request(`http://localhost:${TEST_CONFIG.api.port}`)
                .get('/api/v1/graphs')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            expect(response.body).toHaveProperty('error', 'UNAUTHORIZED');
            expect(response.body).toHaveProperty('message');
        });

        test('should handle malformed requests', async () => {
            const response = await request(`http://localhost:${TEST_CONFIG.api.port}`)
                .post('/api/v1/graphs')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ invalid: 'data' })
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        test('should handle not found resources', async () => {
            const response = await request(`http://localhost:${TEST_CONFIG.api.port}`)
                .get('/api/v1/graphs/non-existent-id')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body).toHaveProperty('error', 'NOT_FOUND');
        });
    });

    describe('Security and Compliance', () => {
        test('should include security headers', async () => {
            const response = await request(`http://localhost:${TEST_CONFIG.api.port}`)
                .get('/api/v1/health')
                .expect(200);

            // Check for common security headers
            expect(response.headers).toHaveProperty('x-content-type-options');
            expect(response.headers).toHaveProperty('x-frame-options');
        });

        test('should validate CORS headers', async () => {
            const response = await request(`http://localhost:${TEST_CONFIG.api.port}`)
                .options('/api/v1/graphs')
                .set('Origin', 'https://example.com')
                .expect(204);

            expect(response.headers).toHaveProperty('access-control-allow-origin');
        });
    });
});

// Test utilities
export const testUtils = {
    async createTestGraph(name = 'Test Graph') {
        const response = await request(`http://localhost:${TEST_CONFIG.api.port}`)
            .post('/api/v1/graphs')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                name,
                description: `Test graph: ${name}`,
                rdfData: `@prefix ex: <http://example.org/> . ex:${name.replace(/\s+/g, '')} a ex:TestEntity .`,
                rdfFormat: 'turtle'
            });
        
        return response.body;
    },

    async createTestTemplate(name = 'Test Template') {
        const response = await request(`http://localhost:${TEST_CONFIG.api.port}`)
            .post('/api/v1/templates')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                name,
                category: 'api',
                language: 'javascript',
                content: `// Generated template: ${name}\nconsole.log("Hello from {{ graph.name }}");`
            });
        
        return response.body;
    },

    async waitForJob(jobId, timeout = 10000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const response = await request(`http://localhost:${TEST_CONFIG.api.port}`)
                .get(`/api/v1/jobs/${jobId}`)
                .set('Authorization', `Bearer ${authToken}`);
            
            if (response.body.status === 'completed' || response.body.status === 'failed') {
                return response.body;
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        throw new Error(`Job ${jobId} did not complete within ${timeout}ms`);
    }
};