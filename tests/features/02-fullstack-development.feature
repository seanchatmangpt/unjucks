Feature: Full-Stack Application Development
  As a full-stack developer
  I want to scaffold complete applications with integrated components
  So that I can rapidly prototype and build production-ready systems

  Background:
    Given I have unjucks configured for full-stack development
    And I have access to MCP swarm coordination
    And my project supports multiple technology stacks

  Scenario: Scaffolding a complete CRUD application
    Given I want to build a task management application
    When I run "unjucks generate app taskmanager --stack=MEAN --withAuth --withTests --database=mongodb"
    Then a complete project structure should be created
    And the backend should include Express.js API endpoints
    And the frontend should include Angular components
    And MongoDB schemas should be generated
    And authentication middleware should be integrated
    And comprehensive test suites should be created
    And Docker configuration should be included

  Scenario: Creating a microservices architecture
    Given I need a distributed system architecture
    When I run "unjucks generate microservice user-service --withAPI --withDatabase --withDocker --messageBroker=rabbitmq"
    Then a containerized service should be created
    And REST API endpoints should be generated
    And database models and migrations should be included
    And message queue integration should be configured
    And health check endpoints should be implemented
    And service discovery configuration should be added

  Scenario: Building a GraphQL API with subscriptions
    Given I want to create a real-time application
    When I run "unjucks generate graphql-api social-feed --withSubscriptions --withDataLoader --database=postgresql"
    Then GraphQL schema definitions should be created
    And resolvers with DataLoader optimization should be generated
    And subscription endpoints for real-time updates should be implemented
    And PostgreSQL integration should be configured
    And authentication guards should be added to sensitive operations

  Scenario: Creating a Progressive Web App
    Given I need a mobile-first web application
    When I run "unjucks generate pwa ecommerce --withServiceWorker --withPushNotifications --withOfflineSync"
    Then a PWA manifest should be generated
    And service worker for caching should be implemented
    And push notification service should be configured
    And offline data synchronization should be set up
    And responsive design components should be created

  Scenario: Generating a serverless application
    Given I want to deploy on AWS Lambda
    When I run "unjucks generate serverless inventory-api --provider=aws --withDynamoDB --withCognito --runtime=nodejs18"
    Then serverless.yml configuration should be created
    And Lambda function handlers should be generated
    And DynamoDB table definitions should be included
    And Cognito authentication should be configured
    And API Gateway routes should be defined
    And CloudFormation resources should be specified

  Scenario: Building a real-time collaboration platform
    Given I need multiple users to collaborate in real-time
    When I run "unjucks generate collaboration-app document-editor --withWebSockets --withOT --withPresence"
    Then WebSocket server configuration should be created
    And operational transformation logic should be implemented
    And user presence tracking should be set up
    And conflict resolution mechanisms should be included
    And collaborative editing UI components should be generated

  Scenario: Creating a multi-tenant SaaS application
    Given I need to support multiple organizations
    When I run "unjucks generate saas project-manager --withTenancy --withBilling --withRBAC --withAnalytics"
    Then tenant isolation middleware should be implemented
    And billing and subscription management should be configured
    And role-based access control should be set up
    And analytics tracking should be integrated
    And tenant-specific database schemas should be created

  Scenario: Generating a machine learning pipeline
    Given I need to process and analyze data
    When I run "unjucks generate ml-pipeline recommendation-engine --withDataPreprocessing --withModelTraining --withAPI"
    Then data preprocessing scripts should be created
    And model training pipelines should be generated
    And ML model serving API should be implemented
    And data validation and monitoring should be included
    And experiment tracking should be configured

  Scenario: Building a blockchain application
    Given I want to create a decentralized application
    When I run "unjucks generate dapp voting-system --blockchain=ethereum --withSmartContracts --withWeb3"
    Then smart contract templates should be generated
    And Web3 integration should be configured
    And MetaMask connection should be implemented
    And contract deployment scripts should be created
    And decentralized frontend should be built

  Scenario: Creating an event-driven architecture
    Given I need asynchronous processing capabilities
    When I run "unjucks generate event-system order-processing --withEventSourcing --withCQRS --withSagas"
    Then event store implementation should be created
    And command and query handlers should be generated
    And saga orchestration should be configured
    And event replay mechanisms should be implemented
    And projection builders should be created

  Scenario: Integrating with external APIs and services
    Given my application needs third-party integrations
    When I run "unjucks generate integrations payment-gateway --providers=stripe,paypal --withWebhooks --withRetry"
    Then API client wrappers should be generated
    And webhook handlers should be implemented
    And retry mechanisms with exponential backoff should be configured
    And rate limiting should be implemented
    And error handling and logging should be comprehensive

  Scenario: Building a content management system
    Given I need a flexible content platform
    When I run "unjucks generate cms blog-platform --withEditor --withMedia --withSEO --withMultilingual"
    Then rich text editor integration should be created
    And media upload and management should be implemented
    And SEO optimization features should be included
    And multi-language support should be configured
    And content versioning should be set up