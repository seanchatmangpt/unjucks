export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  organizationId: string
  avatar?: string
  lastActive: Date
  permissions: Permission[]
}

export interface Organization {
  id: string
  name: string
  slug: string
  domain: string
  plan: 'starter' | 'pro' | 'enterprise'
  users: User[]
  settings: OrganizationSettings
  metrics: OrganizationMetrics
}

export interface UserRole {
  id: string
  name: string
  permissions: Permission[]
  organizationId: string
}

export interface Permission {
  resource: string
  actions: string[]
}

export interface OrganizationSettings {
  allowedDomains: string[]
  ssoEnabled: boolean
  auditRetention: number
  apiLimits: ApiLimits
}

export interface ApiLimits {
  requestsPerMinute: number
  requestsPerHour: number
  requestsPerDay: number
}

export interface OrganizationMetrics {
  activeUsers: number
  apiRequests: number
  templatesGenerated: number
  storageUsed: number
  costThisMonth: number
}

export interface Template {
  id: string
  name: string
  description: string
  category: string
  language: string
  framework?: string
  tags: string[]
  author: User
  organizationId: string
  isPublic: boolean
  downloads: number
  rating: number
  reviews: TemplateReview[]
  files: TemplateFile[]
  variables: TemplateVariable[]
  createdAt: Date
  updatedAt: Date
}

export interface TemplateFile {
  path: string
  content: string
  type: 'template' | 'config' | 'asset'
}

export interface TemplateVariable {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  default?: any
  required: boolean
  validation?: string
}

export interface TemplateReview {
  id: string
  userId: string
  rating: number
  comment: string
  createdAt: Date
}

export interface CodeGeneration {
  id: string
  templateId: string
  userId: string
  organizationId: string
  variables: Record<string, any>
  status: 'pending' | 'generating' | 'completed' | 'failed'
  output?: GeneratedFile[]
  error?: string
  createdAt: Date
  completedAt?: Date
}

export interface GeneratedFile {
  path: string
  content: string
  language: string
}

export interface AuditLog {
  id: string
  userId: string
  organizationId: string
  action: string
  resource: string
  resourceId: string
  metadata: Record<string, any>
  ipAddress: string
  userAgent: string
  timestamp: Date
}

export interface CollaborationSession {
  id: string
  templateId: string
  participants: CollaborationParticipant[]
  createdAt: Date
  lastActivity: Date
}

export interface CollaborationParticipant {
  userId: string
  user: User
  cursor?: { line: number; column: number }
  selection?: { start: { line: number; column: number }; end: { line: number; column: number } }
  isActive: boolean
  joinedAt: Date
}

export interface Metric {
  name: string
  value: number
  change?: number
  changeType?: 'increase' | 'decrease'
  trend?: number[]
  unit?: string
}

export interface DashboardWidget {
  id: string
  type: 'metric' | 'chart' | 'table' | 'activity'
  title: string
  size: 'sm' | 'md' | 'lg' | 'xl'
  data: any
  refreshInterval?: number
}

export interface ApiEndpoint {
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  summary: string
  description: string
  parameters: ApiParameter[]
  responses: ApiResponse[]
  examples: ApiExample[]
}

export interface ApiParameter {
  name: string
  in: 'path' | 'query' | 'header' | 'body'
  type: string
  required: boolean
  description: string
  example?: any
}

export interface ApiResponse {
  status: number
  description: string
  schema?: any
  example?: any
}

export interface ApiExample {
  name: string
  request: any
  response: any
}