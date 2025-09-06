import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  scalar DateTime
  scalar JSON
  scalar Upload

  # Directives
  directive @auth(requires: [Role!]) on FIELD_DEFINITION
  directive @rateLimit(max: Int!, window: String!) on FIELD_DEFINITION
  directive @tenant on FIELD_DEFINITION

  # Enums
  enum Role {
    USER
    ADMIN
    SUPER_ADMIN
    MANAGER
    DEVELOPER
  }

  enum PermissionAction {
    CREATE
    READ
    UPDATE
    DELETE
    MANAGE
    EXECUTE
  }

  enum PermissionResource {
    TEMPLATE
    GENERATOR
    PROJECT
    USER
    TENANT
    AUDIT_LOG
    SYSTEM
  }

  enum AuditSeverity {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  enum AuditCategory {
    AUTH
    DATA
    ADMIN
    SYSTEM
    SECURITY
  }

  enum AuditOutcome {
    SUCCESS
    FAILURE
    ERROR
  }

  enum TemplateStatus {
    DRAFT
    PUBLISHED
    ARCHIVED
    DEPRECATED
  }

  enum GeneratorType {
    FILE
    DIRECTORY
    COMPONENT
    SERVICE
    API
    FULL_STACK
  }

  # Base Types
  type User {
    id: ID!
    email: String!
    firstName: String!
    lastName: String!
    fullName: String!
    roles: [Role!]!
    permissions: [String!]!
    isActive: Boolean!
    lastLoginAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
    tenant: Tenant!
    projects: [Project!]! @auth(requires: [USER])
    templates: [Template!]! @auth(requires: [USER])
  }

  type Tenant {
    id: ID!
    name: String!
    slug: String!
    domain: String
    schema: String!
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    quotas: TenantQuotas!
    usage: TenantUsage!
    users: [User!]! @auth(requires: [ADMIN])
    projects: [Project!]! @auth(requires: [USER])
    templates: [Template!]! @auth(requires: [USER])
  }

  type TenantQuotas {
    apiCallsPerHour: Int!
    storageLimit: Int!
    userLimit: Int!
    templateLimit: Int!
    projectLimit: Int!
  }

  type TenantUsage {
    apiCalls: Int!
    storage: Int!
    users: Int!
    templates: Int!
    projects: Int!
    lastUpdated: DateTime!
  }

  type Template {
    id: ID!
    name: String!
    description: String
    version: String!
    type: GeneratorType!
    status: TemplateStatus!
    category: String
    tags: [String!]!
    files: [TemplateFile!]!
    variables: [TemplateVariable!]!
    metadata: JSON
    author: User!
    tenant: Tenant!
    downloads: Int!
    rating: Float
    reviews: [TemplateReview!]!
    createdAt: DateTime!
    updatedAt: DateTime!
    publishedAt: DateTime
  }

  type TemplateFile {
    id: ID!
    path: String!
    content: String!
    encoding: String!
    size: Int!
    checksum: String!
    frontmatter: JSON
    template: Template!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type TemplateVariable {
    id: ID!
    name: String!
    type: String!
    description: String
    defaultValue: String
    required: Boolean!
    validation: JSON
    options: [String!]
    template: Template!
  }

  type TemplateReview {
    id: ID!
    rating: Int!
    comment: String
    author: User!
    template: Template!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Project {
    id: ID!
    name: String!
    description: String
    repository: String
    branch: String
    path: String
    isPrivate: Boolean!
    owner: User!
    tenant: Tenant!
    templates: [Template!]!
    collaborators: [ProjectCollaborator!]!
    generations: [Generation!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type ProjectCollaborator {
    id: ID!
    user: User!
    project: Project!
    role: String!
    permissions: [String!]!
    joinedAt: DateTime!
  }

  type Generation {
    id: ID!
    template: Template!
    project: Project!
    variables: JSON!
    output: [GeneratedFile!]!
    status: String!
    author: User!
    createdAt: DateTime!
    completedAt: DateTime
    errorMessage: String
  }

  type GeneratedFile {
    id: ID!
    path: String!
    content: String!
    size: Int!
    checksum: String!
    generation: Generation!
    createdAt: DateTime!
  }

  type AuditLog {
    id: ID!
    user: User!
    action: String!
    resource: String!
    resourceId: String
    details: JSON!
    ipAddress: String!
    userAgent: String!
    severity: AuditSeverity!
    category: AuditCategory!
    outcome: AuditOutcome!
    timestamp: DateTime!
  }

  type Permission {
    id: ID!
    name: String!
    resource: PermissionResource!
    action: PermissionAction!
    conditions: JSON
  }

  type RoleDefinition {
    id: ID!
    name: String!
    description: String!
    permissions: [Permission!]!
    isSystemRole: Boolean!
    tenant: Tenant
  }

  # Connection Types for Pagination
  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  type TemplateConnection {
    edges: [TemplateEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type TemplateEdge {
    node: Template!
    cursor: String!
  }

  type ProjectConnection {
    edges: [ProjectEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ProjectEdge {
    node: Project!
    cursor: String!
  }

  type AuditLogConnection {
    edges: [AuditLogEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type AuditLogEdge {
    node: AuditLog!
    cursor: String!
  }

  # Input Types
  input CreateTemplateInput {
    name: String!
    description: String
    type: GeneratorType!
    category: String
    tags: [String!]
    files: [TemplateFileInput!]!
    variables: [TemplateVariableInput!]!
    metadata: JSON
  }

  input TemplateFileInput {
    path: String!
    content: String!
    encoding: String = "utf8"
    frontmatter: JSON
  }

  input TemplateVariableInput {
    name: String!
    type: String!
    description: String
    defaultValue: String
    required: Boolean = false
    validation: JSON
    options: [String!]
  }

  input UpdateTemplateInput {
    name: String
    description: String
    category: String
    tags: [String!]
    metadata: JSON
    status: TemplateStatus
  }

  input CreateProjectInput {
    name: String!
    description: String
    repository: String
    branch: String
    path: String
    isPrivate: Boolean = false
  }

  input UpdateProjectInput {
    name: String
    description: String
    repository: String
    branch: String
    path: String
    isPrivate: Boolean
  }

  input GenerateInput {
    templateId: ID!
    projectId: ID
    variables: JSON!
    outputPath: String
  }

  input AuditLogFilter {
    userId: ID
    resource: String
    action: String
    category: AuditCategory
    severity: AuditSeverity
    startDate: DateTime
    endDate: DateTime
  }

  input CreateRoleInput {
    name: String!
    description: String!
    permissions: [ID!]!
  }

  input AssignRoleInput {
    userId: ID!
    roleId: ID!
  }

  # Responses
  type AuthPayload {
    user: User!
    token: String!
    refreshToken: String!
    expiresIn: Int!
  }

  type GenerationResult {
    generation: Generation!
    files: [GeneratedFile!]!
    summary: GenerationSummary!
  }

  type GenerationSummary {
    filesGenerated: Int!
    totalSize: Int!
    duration: Int!
    warnings: [String!]
    errors: [String!]
  }

  # Subscription Types
  type CollaborationEvent {
    type: String!
    roomId: String!
    userId: ID!
    data: JSON!
    timestamp: DateTime!
  }

  type SystemEvent {
    type: String!
    severity: String!
    message: String!
    timestamp: DateTime!
    metadata: JSON
  }

  # Query Root
  type Query {
    # User & Auth
    me: User @auth(requires: [USER])
    user(id: ID!): User @auth(requires: [ADMIN])
    users(first: Int, after: String): [User!]! @auth(requires: [ADMIN])

    # Tenants
    tenant: Tenant! @tenant
    tenants: [Tenant!]! @auth(requires: [SUPER_ADMIN])

    # Templates
    template(id: ID!): Template @auth(requires: [USER])
    templates(
      first: Int = 20
      after: String
      category: String
      type: GeneratorType
      status: TemplateStatus
      search: String
    ): TemplateConnection! @auth(requires: [USER]) @tenant

    # Projects
    project(id: ID!): Project @auth(requires: [USER])
    projects(
      first: Int = 20
      after: String
      search: String
    ): ProjectConnection! @auth(requires: [USER]) @tenant

    # Generations
    generation(id: ID!): Generation @auth(requires: [USER])
    generations(
      projectId: ID
      templateId: ID
      first: Int = 20
      after: String
    ): [Generation!]! @auth(requires: [USER])

    # Audit Logs
    auditLogs(
      filter: AuditLogFilter
      first: Int = 50
      after: String
    ): AuditLogConnection! @auth(requires: [ADMIN]) @tenant

    # Permissions & Roles
    permissions: [Permission!]! @auth(requires: [ADMIN])
    roles: [RoleDefinition!]! @auth(requires: [ADMIN]) @tenant
    role(id: ID!): RoleDefinition @auth(requires: [ADMIN])

    # System
    systemHealth: JSON @auth(requires: [ADMIN])
    systemMetrics: JSON @auth(requires: [ADMIN])
    collaborationStats: JSON @auth(requires: [ADMIN])
  }

  # Mutation Root
  type Mutation {
    # Authentication
    login(email: String!, password: String!): AuthPayload!
    refreshToken(refreshToken: String!): AuthPayload!
    logout: Boolean!

    # Templates
    createTemplate(input: CreateTemplateInput!): Template! @auth(requires: [USER]) @rateLimit(max: 10, window: "1h")
    updateTemplate(id: ID!, input: UpdateTemplateInput!): Template! @auth(requires: [USER])
    publishTemplate(id: ID!): Template! @auth(requires: [USER])
    archiveTemplate(id: ID!): Template! @auth(requires: [USER])
    deleteTemplate(id: ID!): Boolean! @auth(requires: [USER])
    
    # Template Reviews
    reviewTemplate(templateId: ID!, rating: Int!, comment: String): TemplateReview! @auth(requires: [USER])

    # Projects
    createProject(input: CreateProjectInput!): Project! @auth(requires: [USER]) @rateLimit(max: 5, window: "1h")
    updateProject(id: ID!, input: UpdateProjectInput!): Project! @auth(requires: [USER])
    deleteProject(id: ID!): Boolean! @auth(requires: [USER])
    addCollaborator(projectId: ID!, userId: ID!, role: String!): ProjectCollaborator! @auth(requires: [USER])
    removeCollaborator(projectId: ID!, userId: ID!): Boolean! @auth(requires: [USER])

    # Generation
    generate(input: GenerateInput!): GenerationResult! @auth(requires: [USER]) @rateLimit(max: 20, window: "1h")

    # Admin Operations
    createRole(input: CreateRoleInput!): RoleDefinition! @auth(requires: [ADMIN])
    updateRole(id: ID!, input: CreateRoleInput!): RoleDefinition! @auth(requires: [ADMIN])
    deleteRole(id: ID!): Boolean! @auth(requires: [ADMIN])
    assignRole(input: AssignRoleInput!): Boolean! @auth(requires: [ADMIN])
    revokeRole(userId: ID!, roleId: ID!): Boolean! @auth(requires: [ADMIN])

    # User Management
    updateUser(id: ID!, input: JSON!): User! @auth(requires: [ADMIN])
    deactivateUser(id: ID!): Boolean! @auth(requires: [ADMIN])
    activateUser(id: ID!): Boolean! @auth(requires: [ADMIN])

    # System
    clearCache: Boolean! @auth(requires: [ADMIN])
    triggerBackup: Boolean! @auth(requires: [SUPER_ADMIN])
  }

  # Subscription Root
  type Subscription {
    # Collaboration
    collaborationEvents(roomId: String!): CollaborationEvent! @auth(requires: [USER])
    
    # System Events
    systemEvents: SystemEvent! @auth(requires: [ADMIN])
    
    # Generation Progress
    generationProgress(generationId: ID!): JSON! @auth(requires: [USER])
    
    # User Activity
    userActivity(userId: ID): JSON @auth(requires: [ADMIN])
  }
`;