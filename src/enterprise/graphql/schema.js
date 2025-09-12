/**
 * KGEN Enterprise GraphQL Schema
 * Flexible GraphQL API for knowledge graph operations and code generation
 */

import { buildSchema } from 'graphql';

export const schema = buildSchema(`
    # Scalar Types
    scalar DateTime
    scalar JSON
    scalar Upload

    # Enums
    enum RDFFormat {
        TURTLE
        RDFXML
        JSONLD
        NTRIPLES
    }

    enum GraphStatus {
        ACTIVE
        PROCESSING
        ERROR
    }

    enum JobStatus {
        QUEUED
        RUNNING
        COMPLETED
        FAILED
    }

    enum TemplateCategory {
        API
        FRONTEND
        DATABASE
        INFRASTRUCTURE
        TEST
    }

    enum Language {
        JAVASCRIPT
        TYPESCRIPT
        PYTHON
        JAVA
        CSHARP
        GO
    }

    enum WebhookEvent {
        GRAPH_CREATED
        GRAPH_UPDATED
        GRAPH_DELETED
        JOB_COMPLETED
        JOB_FAILED
    }

    enum IntegrationType {
        SALESFORCE
        HUBSPOT
        SAP
        ORACLE
        GITHUB
        JIRA
        SLACK
    }

    enum DataSourceType {
        DATABASE
        API
        FILE
        MESSAGE_QUEUE
    }

    enum TransformationType {
        MAP
        FILTER
        AGGREGATE
        VALIDATE
        ENRICH
    }

    # Input Types
    input CreateGraphInput {
        name: String!
        description: String
        rdfData: String!
        rdfFormat: RDFFormat = TURTLE
        metadata: JSON
    }

    input UpdateGraphInput {
        name: String
        description: String
        rdfData: String
        metadata: JSON
    }

    input GenerateInput {
        templateIds: [ID!]!
        variables: JSON
        outputFormat: String = "individual"
        webhook: String
    }

    input CreateTemplateInput {
        name: String!
        description: String
        category: TemplateCategory!
        language: Language!
        variables: [TemplateVariableInput!]
        content: String!
    }

    input TemplateVariableInput {
        name: String!
        type: String!
        required: Boolean = false
        description: String
        defaultValue: JSON
    }

    input CreateWebhookInput {
        url: String!
        events: [WebhookEvent!]!
        secret: String
    }

    input UpdateWebhookInput {
        url: String
        events: [WebhookEvent!]
        active: Boolean
        secret: String
    }

    input ConnectIntegrationInput {
        name: String!
        config: JSON!
    }

    input DataSourceInput {
        type: DataSourceType!
        config: JSON!
    }

    input DataTargetInput {
        type: DataSourceType!
        config: JSON!
    }

    input TransformationInput {
        type: TransformationType!
        config: JSON!
    }

    input CreateETLPipelineInput {
        name: String!
        description: String
        source: DataSourceInput!
        target: DataTargetInput!
        transformations: [TransformationInput!]
        schedule: String
    }

    input PaginationInput {
        page: Int = 1
        limit: Int = 20
    }

    input FilterInput {
        field: String!
        operator: String!
        value: JSON!
    }

    input SortInput {
        field: String!
        direction: String = "ASC"
    }

    # Object Types
    type KnowledgeGraph {
        id: ID!
        name: String!
        description: String
        rdfFormat: RDFFormat!
        tripleCount: Int!
        status: GraphStatus!
        createdAt: DateTime!
        updatedAt: DateTime!
        metadata: JSON
        
        # Relationships
        templates: [Template!]!
        jobs: [GenerationJob!]!
        
        # Derived fields
        size: String!
        lastGenerated: DateTime
    }

    type Template {
        id: ID!
        name: String!
        description: String
        category: TemplateCategory!
        language: Language!
        variables: [TemplateVariable!]!
        content: String!
        createdAt: DateTime!
        updatedAt: DateTime!
        
        # Relationships
        jobs: [GenerationJob!]!
        
        # Derived fields
        usageCount: Int!
        lastUsed: DateTime
    }

    type TemplateVariable {
        name: String!
        type: String!
        required: Boolean!
        description: String
        defaultValue: JSON
    }

    type GenerationJob {
        id: ID!
        graph: KnowledgeGraph!
        templates: [Template!]!
        status: JobStatus!
        progress: Int!
        variables: JSON
        startedAt: DateTime
        completedAt: DateTime
        results: [GeneratedArtifact!]!
        error: String
        webhook: String
        
        # Derived fields
        duration: Int
        artifactCount: Int!
    }

    type GeneratedArtifact {
        filename: String!
        content: String!
        language: String!
        size: Int!
        checksum: String!
        attestation: Attestation
    }

    type Attestation {
        version: String!
        timestamp: DateTime!
        generator: Generator!
        provenance: Provenance!
        signature: String
    }

    type Generator {
        name: String!
        version: String!
        engine: String!
    }

    type Provenance {
        templates: [String!]!
        rules: [String!]!
        data: [String!]!
    }

    type Webhook {
        id: ID!
        url: String!
        events: [WebhookEvent!]!
        secret: String
        active: Boolean!
        createdAt: DateTime!
        lastTriggered: DateTime
        
        # Derived fields
        triggerCount: Int!
        successRate: Float!
    }

    type Integration {
        type: IntegrationType!
        name: String!
        description: String!
        capabilities: [String!]!
        configSchema: JSON!
        status: String!
    }

    type IntegrationConnection {
        id: ID!
        type: IntegrationType!
        name: String!
        status: String!
        connectedAt: DateTime!
        lastSync: DateTime
        
        # Derived fields
        syncCount: Int!
        errorCount: Int!
    }

    type ETLPipeline {
        id: ID!
        name: String!
        description: String
        source: DataSource!
        target: DataTarget!
        transformations: [Transformation!]!
        schedule: String
        status: String!
        createdAt: DateTime!
        lastRun: DateTime
        
        # Derived fields
        runCount: Int!
        successRate: Float!
    }

    type DataSource {
        type: DataSourceType!
        config: JSON!
    }

    type DataTarget {
        type: DataSourceType!
        config: JSON!
    }

    type Transformation {
        type: TransformationType!
        config: JSON!
    }

    type ETLExecution {
        id: ID!
        pipeline: ETLPipeline!
        status: String!
        startedAt: DateTime!
        completedAt: DateTime
        recordsProcessed: Int
        recordsSuccessful: Int
        recordsFailed: Int
        error: String
        
        # Derived fields
        duration: Int
        successRate: Float
    }

    type PaginationInfo {
        page: Int!
        limit: Int!
        total: Int!
        totalPages: Int!
        hasNext: Boolean!
        hasPrevious: Boolean!
    }

    # Connection types for pagination
    type GraphConnection {
        nodes: [KnowledgeGraph!]!
        pagination: PaginationInfo!
    }

    type TemplateConnection {
        nodes: [Template!]!
        pagination: PaginationInfo!
    }

    type JobConnection {
        nodes: [GenerationJob!]!
        pagination: PaginationInfo!
    }

    type WebhookConnection {
        nodes: [Webhook!]!
        pagination: PaginationInfo!
    }

    # Analytics and metrics types
    type SystemMetrics {
        totalGraphs: Int!
        totalTemplates: Int!
        totalJobs: Int!
        activeWebhooks: Int!
        
        # Performance metrics
        averageGenerationTime: Float!
        successRate: Float!
        
        # Usage metrics over time
        daily: [DailyMetric!]!
        weekly: [WeeklyMetric!]!
        monthly: [MonthlyMetric!]!
    }

    type DailyMetric {
        date: String!
        jobs: Int!
        graphs: Int!
        successRate: Float!
    }

    type WeeklyMetric {
        week: String!
        jobs: Int!
        graphs: Int!
        successRate: Float!
    }

    type MonthlyMetric {
        month: String!
        jobs: Int!
        graphs: Int!
        successRate: Float!
    }

    type UserActivity {
        userId: ID!
        recentGraphs: [KnowledgeGraph!]!
        recentJobs: [GenerationJob!]!
        favoriteTemplates: [Template!]!
        statistics: UserStatistics!
    }

    type UserStatistics {
        totalGraphs: Int!
        totalJobs: Int!
        successfulJobs: Int!
        failedJobs: Int!
        totalArtifacts: Int!
        averageJobDuration: Float!
    }

    # Root Query type
    type Query {
        # Knowledge Graph queries
        graph(id: ID!): KnowledgeGraph
        graphs(
            pagination: PaginationInput
            filters: [FilterInput!]
            sort: [SortInput!]
        ): GraphConnection!
        
        searchGraphs(
            query: String!
            pagination: PaginationInput
        ): GraphConnection!

        # Template queries
        template(id: ID!): Template
        templates(
            category: TemplateCategory
            language: Language
            pagination: PaginationInput
        ): TemplateConnection!
        
        searchTemplates(
            query: String!
            pagination: PaginationInput
        ): TemplateConnection!

        # Job queries
        job(id: ID!): GenerationJob
        jobs(
            graphId: ID
            status: JobStatus
            pagination: PaginationInput
        ): JobConnection!

        # Webhook queries
        webhook(id: ID!): Webhook
        webhooks(pagination: PaginationInput): WebhookConnection!

        # Integration queries
        integrations: [Integration!]!
        integrationConnections: [IntegrationConnection!]!
        integrationConnection(id: ID!): IntegrationConnection

        # ETL queries
        etlPipeline(id: ID!): ETLPipeline
        etlPipelines(pagination: PaginationInput): [ETLPipeline!]!
        etlExecution(id: ID!): ETLExecution
        etlExecutions(
            pipelineId: ID
            status: String
            pagination: PaginationInput
        ): [ETLExecution!]!

        # Analytics and metrics
        systemMetrics(timeRange: String): SystemMetrics!
        userActivity(userId: ID): UserActivity!

        # Health and status
        health: JSON!
        version: String!
    }

    # Root Mutation type
    type Mutation {
        # Knowledge Graph mutations
        createGraph(input: CreateGraphInput!): KnowledgeGraph!
        updateGraph(id: ID!, input: UpdateGraphInput!): KnowledgeGraph!
        deleteGraph(id: ID!): Boolean!
        
        # Generation mutations
        generateArtifacts(graphId: ID!, input: GenerateInput!): GenerationJob!
        cancelJob(id: ID!): GenerationJob!

        # Template mutations
        createTemplate(input: CreateTemplateInput!): Template!
        updateTemplate(id: ID!, input: CreateTemplateInput!): Template!
        deleteTemplate(id: ID!): Boolean!

        # Webhook mutations
        createWebhook(input: CreateWebhookInput!): Webhook!
        updateWebhook(id: ID!, input: UpdateWebhookInput!): Webhook!
        deleteWebhook(id: ID!): Boolean!
        testWebhook(id: ID!): Boolean!

        # Integration mutations
        connectIntegration(
            type: IntegrationType!
            input: ConnectIntegrationInput!
        ): IntegrationConnection!
        disconnectIntegration(id: ID!): Boolean!
        syncIntegration(id: ID!): Boolean!

        # ETL mutations
        createETLPipeline(input: CreateETLPipelineInput!): ETLPipeline!
        updateETLPipeline(id: ID!, input: CreateETLPipelineInput!): ETLPipeline!
        deleteETLPipeline(id: ID!): Boolean!
        executeETLPipeline(id: ID!): ETLExecution!

        # Batch operations
        batchCreateGraphs(inputs: [CreateGraphInput!]!): [KnowledgeGraph!]!
        batchDeleteGraphs(ids: [ID!]!): Boolean!
        batchGenerateArtifacts(
            requests: [GenerateInput!]!
        ): [GenerationJob!]!
    }

    # Root Subscription type for real-time updates
    type Subscription {
        # Job status updates
        jobStatusUpdated(jobId: ID): GenerationJob!
        jobCompleted(graphId: ID): GenerationJob!
        
        # Graph updates
        graphCreated: KnowledgeGraph!
        graphUpdated(graphId: ID): KnowledgeGraph!
        graphDeleted: ID!
        
        # Webhook events
        webhookTriggered(webhookId: ID): JSON!
        
        # ETL pipeline updates
        etlExecutionStatusUpdated(pipelineId: ID): ETLExecution!
        
        # System metrics updates
        metricsUpdated: SystemMetrics!
    }

    # Schema directive for field-level permissions
    directive @auth(requires: String!) on FIELD_DEFINITION
    directive @rateLimit(max: Int!, window: String!) on FIELD_DEFINITION
    directive @cost(complexity: Int!) on FIELD_DEFINITION
`);