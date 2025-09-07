/**
 * @fileoverview Main type definitions index - converted to JSDoc
 * @module types/index
 */

/**
 * @typedef {Object} User
 * @property {string} id - User unique identifier
 * @property {string} email - User email address
 * @property {string} name - User display name
 * @property {UserRole} role - User role
 * @property {string} organizationId - Organization identifier
 * @property {string} [avatar] - Avatar URL
 * @property {Date} lastActive - Last activity timestamp
 * @property {Permission[]} permissions - User permissions
 */

/**
 * @typedef {Object} Organization
 * @property {string} id - Organization unique identifier
 * @property {string} name - Organization name
 * @property {string} slug - Organization slug
 * @property {string} domain - Organization domain
 * @property {'starter'|'pro'|'enterprise'} plan - Subscription plan
 * @property {User[]} users - Organization users
 * @property {OrganizationSettings} settings - Organization settings
 * @property {OrganizationMetrics} metrics - Organization metrics
 */

/**
 * @typedef {Object} UserRole
 * @property {string} id - Role unique identifier
 * @property {string} name - Role name
 * @property {Permission[]} permissions - Role permissions
 * @property {string} organizationId - Organization identifier
 */

/**
 * @typedef {Object} Permission
 * @property {string} resource - Resource name
 * @property {string[]} actions - Allowed actions
 */

/**
 * @typedef {Object} OrganizationSettings
 * @property {string[]} allowedDomains - Allowed email domains
 * @property {boolean} ssoEnabled - SSO enabled flag
 * @property {number} auditRetention - Audit log retention days
 * @property {ApiLimits} apiLimits - API rate limits
 */

/**
 * @typedef {Object} ApiLimits
 * @property {number} requestsPerMinute - Requests per minute limit
 * @property {number} requestsPerHour - Requests per hour limit
 * @property {number} requestsPerDay - Requests per day limit
 */

/**
 * @typedef {Object} OrganizationMetrics
 * @property {number} activeUsers - Active user count
 * @property {number} apiRequests - API request count
 * @property {number} templatesGenerated - Templates generated count
 * @property {number} storageUsed - Storage used in bytes
 * @property {number} costThisMonth - Current month cost
 */

/**
 * @typedef {Object} Template
 * @property {string} id - Template unique identifier
 * @property {string} name - Template name
 * @property {string} description - Template description
 * @property {string} category - Template category
 * @property {string} language - Programming language
 * @property {string} [framework] - Framework name
 * @property {string[]} tags - Template tags
 * @property {User} author - Template author
 * @property {string} organizationId - Organization identifier
 * @property {boolean} isPublic - Public visibility flag
 * @property {number} downloads - Download count
 * @property {number} rating - Average rating
 * @property {TemplateReview[]} reviews - Template reviews
 * @property {TemplateFile[]} files - Template files
 * @property {TemplateVariable[]} variables - Template variables
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */

/**
 * @typedef {Object} TemplateFile
 * @property {string} path - File path
 * @property {string} content - File content
 * @property {'template'|'config'|'asset'} type - File type
 */

/**
 * @typedef {Object} TemplateVariable
 * @property {string} name - Variable name
 * @property {'string'|'number'|'boolean'|'array'|'object'} type - Variable type
 * @property {string} description - Variable description
 * @property {*} [default] - Default value
 * @property {boolean} required - Required flag
 * @property {string} [validation] - Validation pattern
 */

/**
 * @typedef {Object} TemplateReview
 * @property {string} id - Review unique identifier
 * @property {string} userId - Reviewer user ID
 * @property {number} rating - Review rating (1-5)
 * @property {string} comment - Review comment
 * @property {Date} createdAt - Review timestamp
 */

/**
 * @typedef {Object} CodeGeneration
 * @property {string} id - Generation unique identifier
 * @property {string} templateId - Template identifier
 * @property {string} userId - User identifier
 * @property {string} organizationId - Organization identifier
 * @property {Object.<string, *>} variables - Template variables
 * @property {'pending'|'generating'|'completed'|'failed'} status - Generation status
 * @property {GeneratedFile[]} [output] - Generated files
 * @property {string} [error] - Generation error
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} [completedAt] - Completion timestamp
 */

/**
 * @typedef {Object} GeneratedFile
 * @property {string} path - File path
 * @property {string} content - File content
 * @property {string} language - Programming language
 */

/**
 * @typedef {Object} AuditLog
 * @property {string} id - Log entry unique identifier
 * @property {string} userId - User identifier
 * @property {string} organizationId - Organization identifier
 * @property {string} action - Action performed
 * @property {string} resource - Resource affected
 * @property {string} resourceId - Resource identifier
 * @property {Object.<string, *>} metadata - Additional metadata
 * @property {string} ipAddress - Client IP address
 * @property {string} userAgent - Client user agent
 * @property {Date} timestamp - Action timestamp
 */

/**
 * @typedef {Object} CollaborationSession
 * @property {string} id - Session unique identifier
 * @property {string} templateId - Template identifier
 * @property {CollaborationParticipant[]} participants - Session participants
 * @property {Date} createdAt - Session creation timestamp
 * @property {Date} lastActivity - Last activity timestamp
 */

/**
 * @typedef {Object} CollaborationParticipant
 * @property {string} userId - User identifier
 * @property {User} user - User object
 * @property {Object} [cursor] - Cursor position
 * @property {number} cursor.line - Cursor line
 * @property {number} cursor.column - Cursor column
 * @property {Object} [selection] - Text selection
 * @property {Object} selection.start - Selection start
 * @property {number} selection.start.line - Start line
 * @property {number} selection.start.column - Start column
 * @property {Object} selection.end - Selection end
 * @property {number} selection.end.line - End line
 * @property {number} selection.end.column - End column
 * @property {boolean} isActive - Active status flag
 * @property {Date} joinedAt - Join timestamp
 */

/**
 * @typedef {Object} Metric
 * @property {string} name - Metric name
 * @property {number} value - Metric value
 * @property {number} [change] - Value change
 * @property {'increase'|'decrease'} [changeType] - Change direction
 * @property {number[]} [trend] - Trend data points
 * @property {string} [unit] - Value unit
 */

/**
 * @typedef {Object} DashboardWidget
 * @property {string} id - Widget unique identifier
 * @property {'metric'|'chart'|'table'|'activity'} type - Widget type
 * @property {string} title - Widget title
 * @property {'sm'|'md'|'lg'|'xl'} size - Widget size
 * @property {*} data - Widget data
 * @property {number} [refreshInterval] - Refresh interval in seconds
 */

/**
 * @typedef {Object} ApiEndpoint
 * @property {string} path - Endpoint path
 * @property {'GET'|'POST'|'PUT'|'DELETE'|'PATCH'} method - HTTP method
 * @property {string} summary - Endpoint summary
 * @property {string} description - Endpoint description
 * @property {ApiParameter[]} parameters - Endpoint parameters
 * @property {ApiResponse[]} responses - Possible responses
 * @property {ApiExample[]} examples - Usage examples
 */

/**
 * @typedef {Object} ApiParameter
 * @property {string} name - Parameter name
 * @property {'path'|'query'|'header'|'body'} in - Parameter location
 * @property {string} type - Parameter type
 * @property {boolean} required - Required flag
 * @property {string} description - Parameter description
 * @property {*} [example] - Example value
 */

/**
 * @typedef {Object} ApiResponse
 * @property {number} status - HTTP status code
 * @property {string} description - Response description
 * @property {*} [schema] - Response schema
 * @property {*} [example] - Example response
 */

/**
 * @typedef {Object} ApiExample
 * @property {string} name - Example name
 * @property {*} request - Example request
 * @property {*} response - Example response
 */

export default {};