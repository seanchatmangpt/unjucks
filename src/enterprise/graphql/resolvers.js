/**
 * KGEN Enterprise GraphQL Resolvers
 * Comprehensive resolver implementation for all GraphQL operations
 */

import { GraphQLScalarType } from 'graphql';
import { Kind } from 'graphql/language';
import { PubSub, withFilter } from 'graphql-subscriptions';

// Import data access layer
import { GraphService } from '../services/graph.service.js';
import { TemplateService } from '../services/template.service.js';
import { JobService } from '../services/job.service.js';
import { WebhookService } from '../services/webhook.service.js';
import { IntegrationService } from '../services/integration.service.js';
import { ETLService } from '../services/etl.service.js';
import { MetricsService } from '../services/metrics.service.js';

// Create PubSub instance for subscriptions
const pubsub = new PubSub();

// Custom scalar type resolvers
const DateTimeScalar = new GraphQLScalarType({
    name: 'DateTime',
    description: 'Date custom scalar type',
    serialize(value) {
        return new Date(value).toISOString();
    },
    parseValue(value) {
        return new Date(value);
    },
    parseLiteral(ast) {
        if (ast.kind === Kind.STRING) {
            return new Date(ast.value);
        }
        return null;
    },
});

const JSONScalar = new GraphQLScalarType({
    name: 'JSON',
    description: 'JSON custom scalar type',
    serialize(value) {
        return value;
    },
    parseValue(value) {
        return value;
    },
    parseLiteral(ast) {
        switch (ast.kind) {
            case Kind.STRING:
            case Kind.BOOLEAN:
                return ast.value;
            case Kind.INT:
            case Kind.FLOAT:
                return parseFloat(ast.value);
            case Kind.OBJECT:
                return parseObject(ast);
            case Kind.LIST:
                return ast.values.map(parseLiteral);
            default:
                return null;
        }
    },
});

function parseObject(ast) {
    const value = Object.create(null);
    ast.fields.forEach((field) => {
        value[field.name.value] = parseLiteral(field.value);
    });
    return value;
}

function parseLiteral(ast) {
    switch (ast.kind) {
        case Kind.STRING:
        case Kind.BOOLEAN:
            return ast.value;
        case Kind.INT:
        case Kind.FLOAT:
            return parseFloat(ast.value);
        case Kind.OBJECT:
            return parseObject(ast);
        case Kind.LIST:
            return ast.values.map(parseLiteral);
        default:
            return null;
    }
}

// Helper functions
const requireAuth = (context) => {
    if (!context.user) {
        throw new Error('Authentication required');
    }
    return context.user;
};

const requirePermission = (context, permission) => {
    const user = requireAuth(context);
    if (!user.permissions || !user.permissions.includes(permission)) {
        throw new Error(`Permission denied: ${permission} required`);
    }
    return user;
};

const applyPagination = (data, pagination) => {
    const { page = 1, limit = 20 } = pagination || {};
    const offset = (page - 1) * limit;
    const total = data.length;
    const totalPages = Math.ceil(total / limit);
    
    return {
        nodes: data.slice(offset, offset + limit),
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrevious: page > 1
        }
    };
};

// Root resolver object
export const rootResolver = {
    // Scalar resolvers
    DateTime: DateTimeScalar,
    JSON: JSONScalar,

    // Query resolvers
    Query: {
        // Knowledge Graph queries
        async graph(_, { id }, context) {
            requireAuth(context);
            return await GraphService.findById(id);
        },

        async graphs(_, { pagination, filters, sort }, context) {
            requireAuth(context);
            const graphs = await GraphService.findAll({ filters, sort });
            return applyPagination(graphs, pagination);
        },

        async searchGraphs(_, { query, pagination }, context) {
            requireAuth(context);
            const graphs = await GraphService.search(query);
            return applyPagination(graphs, pagination);
        },

        // Template queries
        async template(_, { id }, context) {
            requireAuth(context);
            return await TemplateService.findById(id);
        },

        async templates(_, { category, language, pagination }, context) {
            requireAuth(context);
            const templates = await TemplateService.findAll({ category, language });
            return applyPagination(templates, pagination);
        },

        async searchTemplates(_, { query, pagination }, context) {
            requireAuth(context);
            const templates = await TemplateService.search(query);
            return applyPagination(templates, pagination);
        },

        // Job queries
        async job(_, { id }, context) {
            requireAuth(context);
            return await JobService.findById(id);
        },

        async jobs(_, { graphId, status, pagination }, context) {
            requireAuth(context);
            const jobs = await JobService.findAll({ graphId, status });
            return applyPagination(jobs, pagination);
        },

        // Webhook queries
        async webhook(_, { id }, context) {
            requirePermission(context, 'webhook:read');
            return await WebhookService.findById(id);
        },

        async webhooks(_, { pagination }, context) {
            requirePermission(context, 'webhook:read');
            const webhooks = await WebhookService.findAll();
            return applyPagination(webhooks, pagination);
        },

        // Integration queries
        async integrations(_, __, context) {
            requirePermission(context, 'integration:read');
            return await IntegrationService.getAvailableIntegrations();
        },

        async integrationConnections(_, __, context) {
            requirePermission(context, 'integration:read');
            return await IntegrationService.getConnections(context.user.id);
        },

        async integrationConnection(_, { id }, context) {
            requirePermission(context, 'integration:read');
            return await IntegrationService.getConnection(id);
        },

        // ETL queries
        async etlPipeline(_, { id }, context) {
            requirePermission(context, 'etl:read');
            return await ETLService.findPipelineById(id);
        },

        async etlPipelines(_, { pagination }, context) {
            requirePermission(context, 'etl:read');
            const pipelines = await ETLService.findAllPipelines();
            return applyPagination(pipelines, pagination);
        },

        async etlExecution(_, { id }, context) {
            requirePermission(context, 'etl:read');
            return await ETLService.findExecutionById(id);
        },

        async etlExecutions(_, { pipelineId, status, pagination }, context) {
            requirePermission(context, 'etl:read');
            const executions = await ETLService.findExecutions({ pipelineId, status });
            return applyPagination(executions, pagination);
        },

        // Analytics and metrics
        async systemMetrics(_, { timeRange }, context) {
            requirePermission(context, 'metrics:read');
            return await MetricsService.getSystemMetrics(timeRange);
        },

        async userActivity(_, { userId }, context) {
            const user = requireAuth(context);
            const targetUserId = userId || user.id;
            
            // Users can only see their own activity unless they have admin permission
            if (targetUserId !== user.id && !user.permissions.includes('admin')) {
                throw new Error('Permission denied');
            }
            
            return await MetricsService.getUserActivity(targetUserId);
        },

        // Health and status
        health() {
            return {
                status: 'healthy',
                timestamp: this.getDeterministicDate().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage()
            };
        },

        version() {
            return process.env.npm_package_version || '1.0.0';
        }
    },

    // Mutation resolvers
    Mutation: {
        // Knowledge Graph mutations
        async createGraph(_, { input }, context) {
            requirePermission(context, 'graph:create');
            const graph = await GraphService.create({ ...input, userId: context.user.id });
            
            // Publish subscription event
            pubsub.publish('GRAPH_CREATED', { graphCreated: graph });
            
            return graph;
        },

        async updateGraph(_, { id, input }, context) {
            requirePermission(context, 'graph:update');
            const graph = await GraphService.update(id, input);
            
            // Publish subscription event
            pubsub.publish('GRAPH_UPDATED', { 
                graphUpdated: graph,
                graphId: id 
            });
            
            return graph;
        },

        async deleteGraph(_, { id }, context) {
            requirePermission(context, 'graph:delete');
            await GraphService.delete(id);
            
            // Publish subscription event
            pubsub.publish('GRAPH_DELETED', { graphDeleted: id });
            
            return true;
        },

        // Generation mutations
        async generateArtifacts(_, { graphId, input }, context) {
            requirePermission(context, 'job:create');
            const job = await JobService.create({
                graphId,
                ...input,
                userId: context.user.id
            });

            // Start the generation job
            JobService.startGeneration(job.id).then(() => {
                pubsub.publish('JOB_COMPLETED', {
                    jobCompleted: job,
                    graphId
                });
            });

            return job;
        },

        async cancelJob(_, { id }, context) {
            requirePermission(context, 'job:update');
            const job = await JobService.cancel(id);
            
            // Publish subscription event
            pubsub.publish('JOB_STATUS_UPDATED', {
                jobStatusUpdated: job,
                jobId: id
            });
            
            return job;
        },

        // Template mutations
        async createTemplate(_, { input }, context) {
            requirePermission(context, 'template:create');
            return await TemplateService.create({ ...input, userId: context.user.id });
        },

        async updateTemplate(_, { id, input }, context) {
            requirePermission(context, 'template:update');
            return await TemplateService.update(id, input);
        },

        async deleteTemplate(_, { id }, context) {
            requirePermission(context, 'template:delete');
            await TemplateService.delete(id);
            return true;
        },

        // Webhook mutations
        async createWebhook(_, { input }, context) {
            requirePermission(context, 'webhook:create');
            return await WebhookService.create({ ...input, userId: context.user.id });
        },

        async updateWebhook(_, { id, input }, context) {
            requirePermission(context, 'webhook:update');
            return await WebhookService.update(id, input);
        },

        async deleteWebhook(_, { id }, context) {
            requirePermission(context, 'webhook:delete');
            await WebhookService.delete(id);
            return true;
        },

        async testWebhook(_, { id }, context) {
            requirePermission(context, 'webhook:test');
            return await WebhookService.test(id);
        },

        // Integration mutations
        async connectIntegration(_, { type, input }, context) {
            requirePermission(context, 'integration:create');
            return await IntegrationService.connect(type, {
                ...input,
                userId: context.user.id
            });
        },

        async disconnectIntegration(_, { id }, context) {
            requirePermission(context, 'integration:delete');
            await IntegrationService.disconnect(id);
            return true;
        },

        async syncIntegration(_, { id }, context) {
            requirePermission(context, 'integration:sync');
            await IntegrationService.sync(id);
            return true;
        },

        // ETL mutations
        async createETLPipeline(_, { input }, context) {
            requirePermission(context, 'etl:create');
            return await ETLService.createPipeline({ ...input, userId: context.user.id });
        },

        async updateETLPipeline(_, { id, input }, context) {
            requirePermission(context, 'etl:update');
            return await ETLService.updatePipeline(id, input);
        },

        async deleteETLPipeline(_, { id }, context) {
            requirePermission(context, 'etl:delete');
            await ETLService.deletePipeline(id);
            return true;
        },

        async executeETLPipeline(_, { id }, context) {
            requirePermission(context, 'etl:execute');
            const execution = await ETLService.executePipeline(id);
            
            // Publish subscription event
            pubsub.publish('ETL_EXECUTION_STATUS_UPDATED', {
                etlExecutionStatusUpdated: execution,
                pipelineId: id
            });
            
            return execution;
        },

        // Batch operations
        async batchCreateGraphs(_, { inputs }, context) {
            requirePermission(context, 'graph:create');
            const graphs = await Promise.all(
                inputs.map(input => 
                    GraphService.create({ ...input, userId: context.user.id })
                )
            );
            
            // Publish subscription events for each created graph
            graphs.forEach(graph => {
                pubsub.publish('GRAPH_CREATED', { graphCreated: graph });
            });
            
            return graphs;
        },

        async batchDeleteGraphs(_, { ids }, context) {
            requirePermission(context, 'graph:delete');
            await Promise.all(ids.map(id => GraphService.delete(id)));
            
            // Publish subscription events for each deleted graph
            ids.forEach(id => {
                pubsub.publish('GRAPH_DELETED', { graphDeleted: id });
            });
            
            return true;
        },

        async batchGenerateArtifacts(_, { requests }, context) {
            requirePermission(context, 'job:create');
            const jobs = await Promise.all(
                requests.map(request =>
                    JobService.create({ ...request, userId: context.user.id })
                )
            );
            
            // Start generation jobs
            jobs.forEach(job => {
                JobService.startGeneration(job.id).then(() => {
                    pubsub.publish('JOB_COMPLETED', {
                        jobCompleted: job,
                        graphId: job.graphId
                    });
                });
            });
            
            return jobs;
        }
    },

    // Subscription resolvers
    Subscription: {
        jobStatusUpdated: {
            subscribe: withFilter(
                () => pubsub.asyncIterator(['JOB_STATUS_UPDATED']),
                (payload, variables) => {
                    return !variables.jobId || payload.jobId === variables.jobId;
                }
            )
        },

        jobCompleted: {
            subscribe: withFilter(
                () => pubsub.asyncIterator(['JOB_COMPLETED']),
                (payload, variables) => {
                    return !variables.graphId || payload.graphId === variables.graphId;
                }
            )
        },

        graphCreated: {
            subscribe: () => pubsub.asyncIterator(['GRAPH_CREATED'])
        },

        graphUpdated: {
            subscribe: withFilter(
                () => pubsub.asyncIterator(['GRAPH_UPDATED']),
                (payload, variables) => {
                    return !variables.graphId || payload.graphId === variables.graphId;
                }
            )
        },

        graphDeleted: {
            subscribe: () => pubsub.asyncIterator(['GRAPH_DELETED'])
        },

        webhookTriggered: {
            subscribe: withFilter(
                () => pubsub.asyncIterator(['WEBHOOK_TRIGGERED']),
                (payload, variables) => {
                    return !variables.webhookId || payload.webhookId === variables.webhookId;
                }
            )
        },

        etlExecutionStatusUpdated: {
            subscribe: withFilter(
                () => pubsub.asyncIterator(['ETL_EXECUTION_STATUS_UPDATED']),
                (payload, variables) => {
                    return !variables.pipelineId || payload.pipelineId === variables.pipelineId;
                }
            )
        },

        metricsUpdated: {
            subscribe: () => pubsub.asyncIterator(['METRICS_UPDATED'])
        }
    },

    // Field resolvers
    KnowledgeGraph: {
        async templates(parent, _, context) {
            return await TemplateService.findByGraphId(parent.id);
        },

        async jobs(parent, _, context) {
            return await JobService.findByGraphId(parent.id);
        },

        size(parent) {
            const bytes = parent.tripleCount * 150; // Rough estimate
            if (bytes < 1024) return `${bytes} B`;
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
            if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
            return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        },

        async lastGenerated(parent, _, context) {
            const lastJob = await JobService.getLastCompletedJob(parent.id);
            return lastJob?.completedAt;
        }
    },

    Template: {
        async jobs(parent, _, context) {
            return await JobService.findByTemplateId(parent.id);
        },

        async usageCount(parent, _, context) {
            return await JobService.getTemplateUsageCount(parent.id);
        },

        async lastUsed(parent, _, context) {
            const lastJob = await JobService.getLastJobForTemplate(parent.id);
            return lastJob?.startedAt;
        }
    },

    GenerationJob: {
        async graph(parent, _, context) {
            return await GraphService.findById(parent.graphId);
        },

        async templates(parent, _, context) {
            return await TemplateService.findByIds(parent.templateIds);
        },

        duration(parent) {
            if (!parent.startedAt || !parent.completedAt) return null;
            return new Date(parent.completedAt) - new Date(parent.startedAt);
        },

        artifactCount(parent) {
            return parent.results?.length || 0;
        }
    },

    Webhook: {
        async triggerCount(parent, _, context) {
            return await WebhookService.getTriggerCount(parent.id);
        },

        async successRate(parent, _, context) {
            return await WebhookService.getSuccessRate(parent.id);
        }
    },

    IntegrationConnection: {
        async syncCount(parent, _, context) {
            return await IntegrationService.getSyncCount(parent.id);
        },

        async errorCount(parent, _, context) {
            return await IntegrationService.getErrorCount(parent.id);
        }
    },

    ETLPipeline: {
        async runCount(parent, _, context) {
            return await ETLService.getRunCount(parent.id);
        },

        async successRate(parent, _, context) {
            return await ETLService.getSuccessRate(parent.id);
        }
    },

    ETLExecution: {
        async pipeline(parent, _, context) {
            return await ETLService.findPipelineById(parent.pipelineId);
        },

        duration(parent) {
            if (!parent.startedAt || !parent.completedAt) return null;
            return new Date(parent.completedAt) - new Date(parent.startedAt);
        },

        successRate(parent) {
            if (!parent.recordsProcessed) return null;
            return parent.recordsSuccessful / parent.recordsProcessed;
        }
    }
};

// Export PubSub instance for use in services
export { pubsub };