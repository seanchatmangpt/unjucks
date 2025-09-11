/**
 * Role-Based Access Control (RBAC) Manager
 * 
 * Enterprise-grade RBAC implementation with hierarchical roles,
 * fine-grained permissions, and dynamic policy evaluation.
 */

import { EventEmitter } from 'events';
import consola from 'consola';

export class RBACManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // RBAC Configuration
      enableHierarchicalRoles: true,
      enableDynamicRoles: false,
      enableTemporaryPermissions: true,
      enableResourceScoping: true,
      
      // Permission inheritance
      enablePermissionInheritance: true,
      maxRoleHierarchyDepth: 5,
      
      // Caching
      enablePermissionCaching: true,
      cacheTimeout: 300000, // 5 minutes
      
      // Constraints
      maxRolesPerUser: 10,
      maxPermissionsPerRole: 100,
      
      ...config
    };
    
    this.logger = consola.withTag('rbac-manager');
    this.status = 'uninitialized';
    
    // RBAC data structures
    this.roles = new Map();
    this.permissions = new Map();
    this.userRoles = new Map();
    this.roleHierarchy = new Map();
    this.resourcePolicies = new Map();
    this.temporaryPermissions = new Map();
    
    // Caching
    this.permissionCache = new Map();
    this.evaluationCache = new Map();
    
    // Metrics
    this.metrics = {
      authorizationChecks: 0,
      cacheHits: 0,
      cacheMisses: 0,
      roleAssignments: 0,
      permissionGrants: 0,
      violations: 0
    };
  }

  /**
   * Initialize RBAC manager
   */
  async initialize() {
    try {
      this.logger.info('Initializing RBAC manager...');
      this.status = 'initializing';
      
      // Load default roles and permissions
      await this._loadDefaultRoles();
      await this._loadDefaultPermissions();
      await this._setupRoleHierarchy();
      
      // Setup cleanup tasks
      if (this.config.enablePermissionCaching) {
        this._setupCacheCleanup();
      }
      
      this.status = 'ready';
      this.logger.success('RBAC manager initialized successfully');
      
      this.emit('rbac:initialized', {
        roles: this.roles.size,
        permissions: this.permissions.size,
        timestamp: new Date()
      });
      
      return {
        status: 'success',
        roles: this.roles.size,
        permissions: this.permissions.size
      };
      
    } catch (error) {
      this.status = 'error';
      this.logger.error('RBAC manager initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create a new role
   */
  async createRole(roleDefinition) {
    try {
      this.logger.info(`Creating role: ${roleDefinition.name}`);
      
      // Validate role definition
      this._validateRoleDefinition(roleDefinition);
      
      const role = {
        id: roleDefinition.id || this._generateRoleId(),
        name: roleDefinition.name,
        description: roleDefinition.description || '',
        permissions: roleDefinition.permissions || [],
        constraints: roleDefinition.constraints || {},
        metadata: roleDefinition.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'active'
      };
      
      // Check for duplicate role names
      if (this._roleNameExists(role.name)) {
        throw new Error(`Role with name '${role.name}' already exists`);
      }
      
      // Validate permissions exist
      for (const permission of role.permissions) {
        if (!this.permissions.has(permission)) {
          throw new Error(`Permission '${permission}' does not exist`);
        }
      }
      
      // Store role
      this.roles.set(role.id, role);
      
      // Clear caches
      this._clearPermissionCaches();
      
      this.emit('role:created', { roleId: role.id, roleName: role.name });
      
      this.logger.success(`Role created: ${role.name} (${role.id})`);
      
      return role;
      
    } catch (error) {
      this.logger.error('Role creation failed:', error);
      throw error;
    }
  }

  /**
   * Create a new permission
   */
  async createPermission(permissionDefinition) {
    try {
      this.logger.info(`Creating permission: ${permissionDefinition.name}`);
      
      const permission = {
        id: permissionDefinition.id || this._generatePermissionId(),
        name: permissionDefinition.name,
        description: permissionDefinition.description || '',
        resource: permissionDefinition.resource || '*',
        action: permissionDefinition.action || 'read',
        conditions: permissionDefinition.conditions || [],
        metadata: permissionDefinition.metadata || {},
        createdAt: new Date(),
        status: 'active'
      };
      
      // Check for duplicate permission names
      if (this._permissionNameExists(permission.name)) {
        throw new Error(`Permission with name '${permission.name}' already exists`);
      }
      
      // Store permission
      this.permissions.set(permission.id, permission);
      
      this.emit('permission:created', { 
        permissionId: permission.id, 
        permissionName: permission.name 
      });
      
      this.logger.success(`Permission created: ${permission.name} (${permission.id})`);
      
      return permission;
      
    } catch (error) {
      this.logger.error('Permission creation failed:', error);
      throw error;
    }
  }

  /**
   * Assign role to user
   */
  async assignRole(userId, roleId, options = {}) {
    try {
      this.logger.info(`Assigning role ${roleId} to user ${userId}`);
      
      // Validate inputs
      if (!this.roles.has(roleId)) {
        throw new Error(`Role '${roleId}' does not exist`);
      }
      
      const role = this.roles.get(roleId);
      if (role.status !== 'active') {
        throw new Error(`Role '${role.name}' is not active`);
      }
      
      // Get current user roles
      const userRoles = this.userRoles.get(userId) || [];
      
      // Check for role assignment limits
      if (userRoles.length >= this.config.maxRolesPerUser) {
        throw new Error(`User cannot have more than ${this.config.maxRolesPerUser} roles`);
      }
      
      // Check if role already assigned
      if (userRoles.some(ur => ur.roleId === roleId)) {
        throw new Error(`Role '${role.name}' is already assigned to user`);
      }
      
      // Create role assignment
      const assignment = {
        roleId,
        assignedAt: new Date(),
        assignedBy: options.assignedBy,
        expiresAt: options.expiresAt,
        conditions: options.conditions || [],
        metadata: options.metadata || {}
      };
      
      // Add to user roles
      userRoles.push(assignment);
      this.userRoles.set(userId, userRoles);
      this.metrics.roleAssignments++;
      
      // Clear user's permission cache
      this._clearUserPermissionCache(userId);
      
      this.emit('role:assigned', {
        userId,
        roleId,
        roleName: role.name,
        assignment
      });
      
      this.logger.success(`Role ${role.name} assigned to user ${userId}`);
      
      return assignment;
      
    } catch (error) {
      this.logger.error('Role assignment failed:', error);
      throw error;
    }
  }

  /**
   * Remove role from user
   */
  async revokeRole(userId, roleId, reason = 'manual_revocation') {
    try {
      this.logger.info(`Revoking role ${roleId} from user ${userId}`);
      
      const userRoles = this.userRoles.get(userId) || [];
      const roleIndex = userRoles.findIndex(ur => ur.roleId === roleId);
      
      if (roleIndex === -1) {
        throw new Error(`Role '${roleId}' is not assigned to user`);
      }
      
      // Remove role assignment
      const removedAssignment = userRoles.splice(roleIndex, 1)[0];
      this.userRoles.set(userId, userRoles);
      
      // Clear user's permission cache
      this._clearUserPermissionCache(userId);
      
      this.emit('role:revoked', {
        userId,
        roleId,
        reason,
        assignment: removedAssignment
      });
      
      this.logger.success(`Role ${roleId} revoked from user ${userId}`);
      
      return removedAssignment;
      
    } catch (error) {
      this.logger.error('Role revocation failed:', error);
      throw error;
    }
  }

  /**
   * Authorize user access to resource
   */
  async authorize(user, operation, resource, context = {}) {
    try {
      this.metrics.authorizationChecks++;
      
      this.logger.debug(`Authorization check: ${user.id} -> ${operation} on ${resource.type}/${resource.id}`);
      
      // Create authorization context
      const authContext = {
        user,
        operation,
        resource,
        context,
        timestamp: new Date()
      };
      
      // Check cache first
      const cacheKey = this._generateAuthCacheKey(authContext);
      if (this.config.enablePermissionCaching && this.evaluationCache.has(cacheKey)) {
        const cachedResult = this.evaluationCache.get(cacheKey);
        if (Date.now() - cachedResult.timestamp < this.config.cacheTimeout) {
          this.metrics.cacheHits++;
          return cachedResult.result;
        }
      }
      
      this.metrics.cacheMisses++;
      
      // Get user's effective permissions
      const userPermissions = await this.getUserPermissions(user.id);
      
      // Evaluate permissions against the request
      const authResult = await this._evaluateAuthorization(authContext, userPermissions);
      
      // Cache result
      if (this.config.enablePermissionCaching) {
        this.evaluationCache.set(cacheKey, {
          result: authResult,
          timestamp: Date.now()
        });
      }
      
      // Log authorization result
      this.emit('authorization:evaluated', {
        userId: user.id,
        operation,
        resource: resource.type,
        authorized: authResult.authorized,
        reason: authResult.reason
      });
      
      if (!authResult.authorized) {
        this.metrics.violations++;
        this.logger.warn(`Authorization denied: ${user.id} -> ${operation} on ${resource.type}/${resource.id}: ${authResult.reason}`);
      }
      
      return authResult;
      
    } catch (error) {
      this.logger.error('Authorization failed:', error);
      throw error;
    }
  }

  /**
   * Authorize high security operations
   */
  async authorizeHighSecurity(user, operation, resource, additionalContext = {}) {
    try {
      this.logger.info(`High security authorization: ${user.id} -> ${operation}`);
      
      // Standard authorization first
      const standardAuth = await this.authorize(user, operation, resource, additionalContext);
      if (!standardAuth.authorized) {
        return standardAuth;
      }
      
      // Additional high security checks
      const highSecurityChecks = [
        this._checkHighSecurityRole(user),
        this._checkRecentAuthentication(user, additionalContext),
        this._checkSecurityClearance(user, resource),
        this._checkTimeBasedRestrictions(user, operation)
      ];
      
      const checkResults = await Promise.all(highSecurityChecks);
      const failedChecks = checkResults.filter(result => !result.passed);
      
      if (failedChecks.length > 0) {
        const reasons = failedChecks.map(check => check.reason).join(', ');
        
        this.emit('high_security:denied', {
          userId: user.id,
          operation,
          failedChecks: failedChecks.length,
          reasons
        });
        
        return {
          authorized: false,
          reason: `High security requirements not met: ${reasons}`,
          requiredChecks: failedChecks.map(check => check.requirement)
        };
      }
      
      this.emit('high_security:granted', {
        userId: user.id,
        operation,
        timestamp: new Date()
      });
      
      return {
        authorized: true,
        securityLevel: 'high',
        grantedAt: new Date()
      };
      
    } catch (error) {
      this.logger.error('High security authorization failed:', error);
      throw error;
    }
  }

  /**
   * Get user's effective permissions
   */
  async getUserPermissions(userId) {
    try {
      // Check cache first
      if (this.config.enablePermissionCaching && this.permissionCache.has(userId)) {
        const cached = this.permissionCache.get(userId);
        if (Date.now() - cached.timestamp < this.config.cacheTimeout) {
          return cached.permissions;
        }
      }
      
      const userRoles = this.userRoles.get(userId) || [];
      const effectivePermissions = new Set();
      
      // Collect permissions from assigned roles
      for (const roleAssignment of userRoles) {
        // Check if assignment is still valid
        if (this._isRoleAssignmentValid(roleAssignment)) {
          const role = this.roles.get(roleAssignment.roleId);
          if (role && role.status === 'active') {
            // Add role permissions
            for (const permissionId of role.permissions) {
              effectivePermissions.add(permissionId);
            }
            
            // Add inherited permissions if hierarchy is enabled
            if (this.config.enableHierarchicalRoles) {
              const inheritedPermissions = await this._getInheritedPermissions(role.id);
              for (const permission of inheritedPermissions) {
                effectivePermissions.add(permission);
              }
            }
          }
        }
      }
      
      // Add temporary permissions
      const tempPermissions = this.temporaryPermissions.get(userId) || [];
      const validTempPermissions = tempPermissions.filter(tp => tp.expiresAt > new Date());
      for (const tempPerm of validTempPermissions) {
        effectivePermissions.add(tempPerm.permissionId);
      }
      
      // Convert to permission objects
      const permissions = Array.from(effectivePermissions)
        .map(permId => this.permissions.get(permId))
        .filter(Boolean);
      
      // Cache result
      if (this.config.enablePermissionCaching) {
        this.permissionCache.set(userId, {
          permissions,
          timestamp: Date.now()
        });
      }
      
      return permissions;
      
    } catch (error) {
      this.logger.error('Get user permissions failed:', error);
      throw error;
    }
  }

  /**
   * Grant temporary permission to user
   */
  async grantTemporaryPermission(userId, permissionId, duration, grantedBy, reason) {
    try {
      if (!this.config.enableTemporaryPermissions) {
        throw new Error('Temporary permissions are not enabled');
      }
      
      this.logger.info(`Granting temporary permission ${permissionId} to user ${userId} for ${duration}ms`);
      
      const permission = this.permissions.get(permissionId);
      if (!permission) {
        throw new Error(`Permission '${permissionId}' does not exist`);
      }
      
      const tempPermission = {
        permissionId,
        userId,
        grantedAt: new Date(),
        expiresAt: new Date(Date.now() + duration),
        grantedBy,
        reason,
        id: this._generateTempPermissionId()
      };
      
      const userTempPerms = this.temporaryPermissions.get(userId) || [];
      userTempPerms.push(tempPermission);
      this.temporaryPermissions.set(userId, userTempPerms);
      
      // Clear user's permission cache
      this._clearUserPermissionCache(userId);
      
      this.metrics.permissionGrants++;
      
      this.emit('permission:temporary_granted', {
        userId,
        permissionId,
        duration,
        grantedBy,
        reason
      });
      
      // Schedule automatic cleanup
      setTimeout(() => {
        this._cleanupExpiredTemporaryPermissions();
      }, duration);
      
      return tempPermission;
      
    } catch (error) {
      this.logger.error('Temporary permission grant failed:', error);
      throw error;
    }
  }

  /**
   * Get RBAC status and metrics
   */
  getStatus() {
    return {
      status: this.status,
      metrics: { ...this.metrics },
      configuration: {
        enableHierarchicalRoles: this.config.enableHierarchicalRoles,
        enableDynamicRoles: this.config.enableDynamicRoles,
        enableTemporaryPermissions: this.config.enableTemporaryPermissions,
        enableResourceScoping: this.config.enableResourceScoping
      },
      statistics: {
        totalRoles: this.roles.size,
        totalPermissions: this.permissions.size,
        totalUserRoles: this.userRoles.size,
        cacheSize: this.permissionCache.size,
        evaluationCacheSize: this.evaluationCache.size
      }
    };
  }

  /**
   * Shutdown RBAC manager
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down RBAC manager...');
      
      // Clear caches
      this.permissionCache.clear();
      this.evaluationCache.clear();
      
      // Clear intervals
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      
      this.removeAllListeners();
      this.status = 'shutdown';
      
      this.logger.success('RBAC manager shutdown completed');
      
    } catch (error) {
      this.logger.error('RBAC manager shutdown failed:', error);
      throw error;
    }
  }

  // Private methods

  async _loadDefaultRoles() {
    const defaultRoles = [
      {
        id: 'admin',
        name: 'Administrator',
        description: 'Full system administrator access',
        permissions: ['admin:*', 'user:*', 'system:*'],
        constraints: { requireMFA: true }
      },
      {
        id: 'user',
        name: 'Standard User',
        description: 'Standard user access',
        permissions: ['user:read', 'user:write', 'template:read'],
        constraints: {}
      },
      {
        id: 'analyst',
        name: 'Data Analyst',
        description: 'Data analysis and reporting access',
        permissions: ['user:read', 'data:read', 'report:create', 'template:read'],
        constraints: {}
      },
      {
        id: 'developer',
        name: 'Developer',
        description: 'Template and code development access',
        permissions: ['user:read', 'template:*', 'code:write', 'debug:read'],
        constraints: {}
      }
    ];
    
    for (const roleData of defaultRoles) {
      if (!this.roles.has(roleData.id)) {
        const role = {
          ...roleData,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'active'
        };
        this.roles.set(role.id, role);
      }
    }
  }

  async _loadDefaultPermissions() {
    const defaultPermissions = [
      // Admin permissions
      { id: 'admin:*', name: 'admin:*', description: 'Full admin access', resource: '*', action: '*' },
      { id: 'user:*', name: 'user:*', description: 'Full user management', resource: 'user', action: '*' },
      { id: 'system:*', name: 'system:*', description: 'Full system access', resource: 'system', action: '*' },
      
      // User permissions
      { id: 'user:read', name: 'user:read', description: 'Read user data', resource: 'user', action: 'read' },
      { id: 'user:write', name: 'user:write', description: 'Write user data', resource: 'user', action: 'write' },
      
      // Template permissions
      { id: 'template:*', name: 'template:*', description: 'Full template access', resource: 'template', action: '*' },
      { id: 'template:read', name: 'template:read', description: 'Read templates', resource: 'template', action: 'read' },
      { id: 'template:write', name: 'template:write', description: 'Write templates', resource: 'template', action: 'write' },
      
      // Data permissions
      { id: 'data:read', name: 'data:read', description: 'Read data', resource: 'data', action: 'read' },
      { id: 'data:write', name: 'data:write', description: 'Write data', resource: 'data', action: 'write' },
      
      // Code permissions
      { id: 'code:write', name: 'code:write', description: 'Write code', resource: 'code', action: 'write' },
      { id: 'debug:read', name: 'debug:read', description: 'Read debug info', resource: 'debug', action: 'read' },
      
      // Report permissions
      { id: 'report:create', name: 'report:create', description: 'Create reports', resource: 'report', action: 'create' }
    ];
    
    for (const permData of defaultPermissions) {
      if (!this.permissions.has(permData.id)) {
        const permission = {
          ...permData,
          conditions: [],
          metadata: {},
          createdAt: new Date(),
          status: 'active'
        };
        this.permissions.set(permission.id, permission);
      }
    }
  }

  async _setupRoleHierarchy() {
    if (!this.config.enableHierarchicalRoles) return;
    
    // Setup role inheritance: admin > developer > analyst > user
    this.roleHierarchy.set('admin', []);
    this.roleHierarchy.set('developer', ['admin']);
    this.roleHierarchy.set('analyst', ['developer', 'admin']);
    this.roleHierarchy.set('user', ['analyst', 'developer', 'admin']);
  }

  _setupCacheCleanup() {
    this.cleanupInterval = setInterval(() => {
      this._cleanupExpiredCaches();
      this._cleanupExpiredTemporaryPermissions();
    }, 60000); // Every minute
  }

  _validateRoleDefinition(roleDefinition) {
    if (!roleDefinition.name || typeof roleDefinition.name !== 'string') {
      throw new Error('Role name is required and must be a string');
    }
    
    if (roleDefinition.permissions && !Array.isArray(roleDefinition.permissions)) {
      throw new Error('Role permissions must be an array');
    }
    
    if (roleDefinition.permissions && roleDefinition.permissions.length > this.config.maxPermissionsPerRole) {
      throw new Error(`Role cannot have more than ${this.config.maxPermissionsPerRole} permissions`);
    }
  }

  _roleNameExists(name) {
    return Array.from(this.roles.values()).some(role => role.name === name);
  }

  _permissionNameExists(name) {
    return Array.from(this.permissions.values()).some(permission => permission.name === name);
  }

  _generateRoleId() {
    return `role_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _generatePermissionId() {
    return `perm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _generateTempPermissionId() {
    return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _generateAuthCacheKey(authContext) {
    const { user, operation, resource } = authContext;
    return `auth_${user.id}_${operation}_${resource.type}_${resource.id || '*'}`;
  }

  _clearPermissionCaches() {
    this.permissionCache.clear();
    this.evaluationCache.clear();
  }

  _clearUserPermissionCache(userId) {
    this.permissionCache.delete(userId);
    
    // Clear related evaluation cache entries
    for (const [key] of this.evaluationCache.entries()) {
      if (key.startsWith(`auth_${userId}_`)) {
        this.evaluationCache.delete(key);
      }
    }
  }

  _isRoleAssignmentValid(assignment) {
    // Check expiration
    if (assignment.expiresAt && assignment.expiresAt < new Date()) {
      return false;
    }
    
    // Check conditions (placeholder - implement actual condition evaluation)
    return true;
  }

  async _getInheritedPermissions(roleId) {
    const inheritedPermissions = new Set();
    const parentRoles = this.roleHierarchy.get(roleId) || [];
    
    for (const parentRoleId of parentRoles) {
      const parentRole = this.roles.get(parentRoleId);
      if (parentRole && parentRole.status === 'active') {
        for (const permission of parentRole.permissions) {
          inheritedPermissions.add(permission);
        }
      }
    }
    
    return Array.from(inheritedPermissions);
  }

  async _evaluateAuthorization(authContext, userPermissions) {
    const { operation, resource } = authContext;
    
    // Check for wildcard permissions
    const hasWildcard = userPermissions.some(p => 
      p.name === '*' || 
      p.name === `${resource.type}:*` ||
      (p.resource === '*' && p.action === '*')
    );
    
    if (hasWildcard) {
      return {
        authorized: true,
        reason: 'Wildcard permission granted',
        permissions: ['*']
      };
    }
    
    // Check for specific permissions
    const matchingPermissions = userPermissions.filter(permission => {
      return this._permissionMatches(permission, resource, operation);
    });
    
    if (matchingPermissions.length === 0) {
      return {
        authorized: false,
        reason: 'No matching permissions found',
        requiredPermission: `${resource.type}:${operation}`
      };
    }
    
    // Evaluate conditions on matching permissions
    for (const permission of matchingPermissions) {
      const conditionResult = await this._evaluatePermissionConditions(
        permission, 
        authContext
      );
      
      if (!conditionResult.satisfied) {
        return {
          authorized: false,
          reason: `Permission condition not satisfied: ${conditionResult.reason}`,
          failedConditions: conditionResult.failedConditions
        };
      }
    }
    
    return {
      authorized: true,
      reason: 'Permission granted',
      matchingPermissions: matchingPermissions.map(p => p.name)
    };
  }

  _permissionMatches(permission, resource, operation) {
    // Check resource match
    const resourceMatch = permission.resource === '*' || 
                         permission.resource === resource.type ||
                         permission.name.startsWith(`${resource.type}:`);
    
    // Check action match
    const actionMatch = permission.action === '*' || 
                       permission.action === operation ||
                       permission.name.endsWith(`:${operation}`) ||
                       permission.name.endsWith(':*');
    
    return resourceMatch && actionMatch;
  }

  async _evaluatePermissionConditions(permission, authContext) {
    // Evaluate permission conditions
    for (const condition of permission.conditions || []) {
      const result = await this._evaluateCondition(condition, authContext);
      if (!result.satisfied) {
        return {
          satisfied: false,
          reason: result.reason,
          failedConditions: [condition]
        };
      }
    }
    
    return { satisfied: true };
  }

  async _evaluateCondition(condition, authContext) {
    // Implement condition evaluation logic
    // This is a placeholder - implement actual condition types
    switch (condition.type) {
      case 'time_based':
        return this._evaluateTimeCondition(condition, authContext);
      case 'location_based':
        return this._evaluateLocationCondition(condition, authContext);
      case 'resource_based':
        return this._evaluateResourceCondition(condition, authContext);
      default:
        return { satisfied: true };
    }
  }

  _evaluateTimeCondition(condition, authContext) {
    // Implement time-based condition evaluation
    return { satisfied: true };
  }

  _evaluateLocationCondition(condition, authContext) {
    // Implement location-based condition evaluation
    return { satisfied: true };
  }

  _evaluateResourceCondition(condition, authContext) {
    // Implement resource-based condition evaluation
    return { satisfied: true };
  }

  async _checkHighSecurityRole(user) {
    const userRoles = this.userRoles.get(user.id) || [];
    const hasHighSecurityRole = userRoles.some(assignment => {
      const role = this.roles.get(assignment.roleId);
      return role && (role.name === 'Administrator' || role.constraints?.requireMFA);
    });
    
    return {
      passed: hasHighSecurityRole,
      reason: hasHighSecurityRole ? null : 'High security role required',
      requirement: 'high_security_role'
    };
  }

  async _checkRecentAuthentication(user, context) {
    // Check if user authenticated recently (within last 30 minutes)
    const recentThreshold = 30 * 60 * 1000; // 30 minutes
    const lastAuth = context.lastAuthentication || user.lastAuthentication;
    
    if (!lastAuth) {
      return {
        passed: false,
        reason: 'No recent authentication found',
        requirement: 'recent_authentication'
      };
    }
    
    const isRecent = (Date.now() - new Date(lastAuth).getTime()) < recentThreshold;
    
    return {
      passed: isRecent,
      reason: isRecent ? null : 'Recent authentication required',
      requirement: 'recent_authentication'
    };
  }

  async _checkSecurityClearance(user, resource) {
    const userClearance = user.clearanceLevel || 'INTERNAL';
    const resourceClassification = resource.classification || 'INTERNAL';
    
    const clearanceHierarchy = {
      'PUBLIC': 0,
      'INTERNAL': 1,
      'CONFIDENTIAL': 2,
      'RESTRICTED': 3
    };
    
    const userLevel = clearanceHierarchy[userClearance] || 1;
    const resourceLevel = clearanceHierarchy[resourceClassification] || 1;
    
    const hasClearance = userLevel >= resourceLevel;
    
    return {
      passed: hasClearance,
      reason: hasClearance ? null : `Insufficient security clearance: ${userClearance} < ${resourceClassification}`,
      requirement: 'security_clearance'
    };
  }

  async _checkTimeBasedRestrictions(user, operation) {
    // Check if operation is allowed at current time
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    
    // Example: Restrict certain operations outside business hours
    const restrictedOperations = ['delete', 'export', 'backup'];
    const businessHours = hour >= 6 && hour <= 22; // 6 AM to 10 PM
    const businessDay = day >= 1 && day <= 5; // Monday to Friday
    
    if (restrictedOperations.includes(operation) && (!businessHours || !businessDay)) {
      return {
        passed: false,
        reason: 'Operation restricted outside business hours',
        requirement: 'business_hours'
      };
    }
    
    return { passed: true };
  }

  _cleanupExpiredCaches() {
    const now = Date.now();
    
    // Clean permission cache
    for (const [userId, cached] of this.permissionCache.entries()) {
      if (now - cached.timestamp > this.config.cacheTimeout) {
        this.permissionCache.delete(userId);
      }
    }
    
    // Clean evaluation cache
    for (const [key, cached] of this.evaluationCache.entries()) {
      if (now - cached.timestamp > this.config.cacheTimeout) {
        this.evaluationCache.delete(key);
      }
    }
  }

  _cleanupExpiredTemporaryPermissions() {
    const now = new Date();
    
    for (const [userId, tempPerms] of this.temporaryPermissions.entries()) {
      const validPerms = tempPerms.filter(tp => tp.expiresAt > now);
      
      if (validPerms.length !== tempPerms.length) {
        this.temporaryPermissions.set(userId, validPerms);
        this._clearUserPermissionCache(userId);
      }
    }
  }
}

export default RBACManager;