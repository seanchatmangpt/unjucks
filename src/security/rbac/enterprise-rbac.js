/**
 * Enterprise Role-Based Access Control (RBAC) System
 * Advanced RBAC with hierarchical roles, dynamic permissions, and fine-grained access control
 */

import { EventEmitter } from 'events';
import consola from 'consola';
import { Store, Parser, Writer } from 'n3';
import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';

class EnterpriseRBAC extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Role Hierarchy Configuration
      hierarchical: true,
      maxRoleDepth: 5,
      inheritPermissions: true,
      cascadeRevocation: true,
      
      // Permission System
      permissionFormat: 'resource:action:condition',
      wildcardSupport: true,
      contextualPermissions: true,
      temporaryPermissions: true,
      
      // Dynamic Access Control
      dynamicRoles: true,
      conditionEngine: true,
      attributeBasedAccess: true,
      
      // Security Features
      permissionCaching: true,
      cacheTimeout: 300000, // 5 minutes
      auditAllDecisions: true,
      enforceMinimumPrivilege: true,
      
      // Compliance Features
      separationOfDuties: true,
      dualApproval: false,
      accessReviews: true,
      reviewInterval: 2592000000, // 30 days
      
      // Organization Structure
      organizationalUnits: true,
      locationBasedAccess: false,
      timeBasedAccess: false,
      
      ...config
    };
    
    this.logger = consola.withTag('enterprise-rbac');
    this.state = 'initialized';
    
    // Core RBAC Components
    this.roles = new Map();
    this.permissions = new Map();
    this.users = new Map();
    this.resources = new Map();
    this.policies = new Map();
    
    // Hierarchical Structure
    this.roleHierarchy = new Map();
    this.organizationalUnits = new Map();
    
    // Dynamic Features
    this.conditions = new Map();
    this.contexts = new Map();
    this.temporaryGrants = new Map();
    
    // Caching and Performance
    this.permissionCache = new Map();
    this.decisionCache = new Map();
    
    // Audit and Compliance
    this.accessDecisions = [];
    this.roleAssignments = [];
    this.permissionGrants = [];
    this.accessReviews = new Map();
    
    // RDF Store for Complex Queries
    this.rdfStore = new Store();
    this.rdfParser = new Parser();
    this.rdfWriter = new Writer();
    
    // Metrics
    this.metrics = {
      accessChecks: 0,
      accessGranted: 0,
      accessDenied: 0,
      roleAssignments: 0,
      permissionGrants: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }
  
  /**
   * Initialize RBAC system
   */
  async initialize() {
    try {
      this.logger.info('🔐 Initializing Enterprise RBAC system...');
      
      // Load existing RBAC configuration
      await this._loadRBACConfiguration();
      
      // Initialize built-in roles and permissions
      await this._initializeBuiltinRoles();
      
      // Setup RDF ontology
      await this._setupRBACOntology();
      
      // Load organizational structure
      await this._loadOrganizationalStructure();
      
      // Start maintenance processes
      this._startMaintenanceProcesses();
      
      this.state = 'ready';
      this.logger.success('✅ Enterprise RBAC system initialized');
      
      return {
        status: 'ready',
        roles: this.roles.size,
        permissions: this.permissions.size,
        users: this.users.size
      };
      
    } catch (error) {
      this.state = 'error';
      this.logger.error('❌ Failed to initialize Enterprise RBAC:', error);
      throw error;
    }
  }
  
  /**
   * Create new role
   */
  async createRole(roleData) {
    try {
      const {
        name,
        displayName,
        description,
        permissions = [],
        parentRoles = [],
        organizationalUnit,
        conditions = [],
        metadata = {}
      } = roleData;
      
      if (this.roles.has(name)) {
        throw new Error(`Role '${name}' already exists`);
      }
      
      // Validate role hierarchy
      if (this.config.hierarchical) {
        await this._validateRoleHierarchy(parentRoles);
      }
      
      const role = {
        name,
        displayName: displayName || name,
        description,
        permissions: new Set(permissions),
        parentRoles: new Set(parentRoles),
        childRoles: new Set(),
        organizationalUnit,
        conditions: new Map(),
        metadata,
        createdAt: this.getDeterministicDate(),
        createdBy: roleData.createdBy,
        lastModified: this.getDeterministicDate(),
        active: true
      };
      
      // Process conditions
      for (const condition of conditions) {
        role.conditions.set(condition.name, condition);
      }
      
      // Update hierarchy
      if (this.config.hierarchical) {
        for (const parentName of parentRoles) {
          const parent = this.roles.get(parentName);
          if (parent) {
            parent.childRoles.add(name);
            this.roleHierarchy.set(`${parentName}->${name}`, {
              parent: parentName,
              child: name,
              createdAt: this.getDeterministicDate()
            });
          }
        }
      }
      
      this.roles.set(name, role);
      
      // Add to RDF store
      await this._addRoleToRDF(role);
      
      // Save configuration
      await this._saveRBACConfiguration();
      
      this.emit('role:created', { name, createdBy: roleData.createdBy });
      
      return role;
      
    } catch (error) {
      this.logger.error(`Failed to create role '${roleData.name}':`, error);
      throw error;
    }
  }
  
  /**
   * Create new permission
   */
  async createPermission(permissionData) {
    try {
      const {
        name,
        displayName,
        description,
        resource,
        action,
        conditions = [],
        scope = 'global',
        metadata = {}
      } = permissionData;
      
      if (this.permissions.has(name)) {
        throw new Error(`Permission '${name}' already exists`);
      }
      
      const permission = {
        name,
        displayName: displayName || name,
        description,
        resource,
        action,
        conditions: new Map(),
        scope,
        metadata,
        createdAt: this.getDeterministicDate(),
        createdBy: permissionData.createdBy,
        active: true
      };
      
      // Process conditions
      for (const condition of conditions) {
        permission.conditions.set(condition.name, condition);
      }
      
      this.permissions.set(name, permission);
      
      // Add to RDF store
      await this._addPermissionToRDF(permission);
      
      // Save configuration
      await this._saveRBACConfiguration();
      
      this.emit('permission:created', { name, createdBy: permissionData.createdBy });
      
      return permission;
      
    } catch (error) {
      this.logger.error(`Failed to create permission '${permissionData.name}':`, error);
      throw error;
    }
  }
  
  /**
   * Assign role to user
   */
  async assignRole(userId, roleName, options = {}) {
    try {
      const {
        assignedBy,
        expiresAt,
        conditions = [],
        organizationalUnit,
        justification
      } = options;
      
      const role = this.roles.get(roleName);
      if (!role) {
        throw new Error(`Role '${roleName}' not found`);
      }
      
      if (!this.users.has(userId)) {
        this.users.set(userId, {
          id: userId,
          roles: new Set(),
          permissions: new Set(),
          organizationalUnit,
          conditions: new Map(),
          createdAt: this.getDeterministicDate()
        });
      }
      
      const user = this.users.get(userId);
      
      // Check for conflicts (Separation of Duties)
      if (this.config.separationOfDuties) {
        await this._checkSeparationOfDuties(userId, roleName);
      }
      
      // Create assignment record
      const assignment = {
        userId,
        roleName,
        assignedBy,
        assignedAt: this.getDeterministicDate(),
        expiresAt,
        conditions: new Map(),
        organizationalUnit: organizationalUnit || user.organizationalUnit,
        justification,
        active: true
      };
      
      // Process conditions
      for (const condition of conditions) {
        assignment.conditions.set(condition.name, condition);
      }
      
      user.roles.add(roleName);
      
      // Store assignment for audit
      this.roleAssignments.push(assignment);
      this.metrics.roleAssignments++;
      
      // Clear permission cache for user
      this._clearUserCache(userId);
      
      // Add to RDF store
      await this._addAssignmentToRDF(assignment);
      
      // Save configuration
      await this._saveRBACConfiguration();
      
      this.emit('role:assigned', {
        userId,
        roleName,
        assignedBy,
        expiresAt
      });
      
      return assignment;
      
    } catch (error) {
      this.logger.error(`Failed to assign role '${roleName}' to user '${userId}':`, error);
      throw error;
    }
  }
  
  /**
   * Grant permission to user or role
   */
  async grantPermission(target, targetType, permissionName, options = {}) {
    try {
      const {
        grantedBy,
        expiresAt,
        conditions = [],
        scope,
        justification
      } = options;
      
      const permission = this.permissions.get(permissionName);
      if (!permission) {
        throw new Error(`Permission '${permissionName}' not found`);
      }
      
      const grant = {
        target,
        targetType, // 'user' or 'role'
        permissionName,
        grantedBy,
        grantedAt: this.getDeterministicDate(),
        expiresAt,
        conditions: new Map(),
        scope: scope || permission.scope,
        justification,
        active: true
      };
      
      // Process conditions
      for (const condition of conditions) {
        grant.conditions.set(condition.name, condition);
      }
      
      if (targetType === 'user') {
        if (!this.users.has(target)) {
          this.users.set(target, {
            id: target,
            roles: new Set(),
            permissions: new Set(),
            conditions: new Map(),
            createdAt: this.getDeterministicDate()
          });
        }
        
        this.users.get(target).permissions.add(permissionName);
        this._clearUserCache(target);
        
      } else if (targetType === 'role') {
        const role = this.roles.get(target);
        if (!role) {
          throw new Error(`Role '${target}' not found`);
        }
        
        role.permissions.add(permissionName);
        
        // Clear cache for all users with this role
        for (const [userId, user] of this.users.entries()) {
          if (user.roles.has(target)) {
            this._clearUserCache(userId);
          }
        }
      }
      
      // Store grant for audit
      this.permissionGrants.push(grant);
      this.metrics.permissionGrants++;
      
      // Add to RDF store
      await this._addGrantToRDF(grant);
      
      // Save configuration
      await this._saveRBACConfiguration();
      
      this.emit('permission:granted', {
        target,
        targetType,
        permissionName,
        grantedBy
      });
      
      return grant;
      
    } catch (error) {
      this.logger.error(`Failed to grant permission '${permissionName}':`, error);
      throw error;
    }
  }
  
  /**
   * Check if user has permission
   */
  async checkPermission(userId, permissionName, context = {}) {
    try {
      this.metrics.accessChecks++;
      
      const startTime = this.getDeterministicTimestamp();
      
      // Check cache first
      const cacheKey = this._generateCacheKey(userId, permissionName, context);
      if (this.config.permissionCaching && this.decisionCache.has(cacheKey)) {
        this.metrics.cacheHits++;
        const cached = this.decisionCache.get(cacheKey);
        
        if (this.getDeterministicTimestamp() < cached.expiresAt) {
          this._recordAccessDecision({
            userId,
            permissionName,
            result: cached.result,
            reason: 'cached',
            responseTime: this.getDeterministicTimestamp() - startTime,
            context
          });
          
          return cached.result;
        } else {
          this.decisionCache.delete(cacheKey);
        }
      }
      
      this.metrics.cacheMisses++;
      
      const user = this.users.get(userId);
      if (!user) {
        const result = this._createAccessDecision(false, 'user_not_found');
        this._recordAccessDecision({
          userId,
          permissionName,
          result,
          reason: 'user_not_found',
          responseTime: this.getDeterministicTimestamp() - startTime,
          context
        });
        return result;
      }
      
      const permission = this.permissions.get(permissionName);
      if (!permission) {
        const result = this._createAccessDecision(false, 'permission_not_found');
        this._recordAccessDecision({
          userId,
          permissionName,
          result,
          reason: 'permission_not_found',
          responseTime: this.getDeterministicTimestamp() - startTime,
          context
        });
        return result;
      }
      
      let hasPermission = false;
      let grantSource = null;
      const reasons = [];
      
      // Check direct user permissions
      if (user.permissions.has(permissionName)) {
        hasPermission = true;
        grantSource = 'direct';
        reasons.push('direct_permission');
      }
      
      // Check role-based permissions
      if (!hasPermission) {
        const rolePermissions = await this._getRolePermissions(Array.from(user.roles));
        if (rolePermissions.has(permissionName)) {
          hasPermission = true;
          grantSource = 'role';
          reasons.push('role_based');
        }
      }
      
      // Check hierarchical permissions (if enabled)
      if (!hasPermission && this.config.hierarchical && this.config.inheritPermissions) {
        const inheritedPermissions = await this._getInheritedPermissions(Array.from(user.roles));
        if (inheritedPermissions.has(permissionName)) {
          hasPermission = true;
          grantSource = 'inherited';
          reasons.push('inherited');
        }
      }
      
      // Check dynamic permissions
      if (!hasPermission && this.config.dynamicRoles) {
        const dynamicResult = await this._checkDynamicPermissions(userId, permissionName, context);
        if (dynamicResult.granted) {
          hasPermission = true;
          grantSource = 'dynamic';
          reasons.push('dynamic');
        }
      }
      
      // Apply conditions and constraints
      if (hasPermission) {
        const conditionsResult = await this._evaluateConditions(userId, permissionName, context);
        if (!conditionsResult.satisfied) {
          hasPermission = false;
          reasons.push('conditions_failed');
        }
      }
      
      // Check temporal constraints
      if (hasPermission) {
        const temporalResult = await this._checkTemporalConstraints(userId, permissionName);
        if (!temporalResult.valid) {
          hasPermission = false;
          reasons.push('temporal_constraint');
        }
      }
      
      // Apply attribute-based access control
      if (hasPermission && this.config.attributeBasedAccess) {
        const abacResult = await this._evaluateAttributeBasedAccess(userId, permissionName, context);
        if (!abacResult.allowed) {
          hasPermission = false;
          reasons.push('abac_denied');
        }
      }
      
      const result = this._createAccessDecision(
        hasPermission,
        reasons.join(', '),
        grantSource,
        context
      );
      
      // Cache the result
      if (this.config.permissionCaching) {
        this.decisionCache.set(cacheKey, {
          result,
          expiresAt: this.getDeterministicTimestamp() + this.config.cacheTimeout
        });
      }
      
      // Record decision for audit
      this._recordAccessDecision({
        userId,
        permissionName,
        result,
        reason: reasons.join(', '),
        responseTime: this.getDeterministicTimestamp() - startTime,
        context
      });
      
      // Update metrics
      if (hasPermission) {
        this.metrics.accessGranted++;
      } else {
        this.metrics.accessDenied++;
      }
      
      return result;
      
    } catch (error) {
      this.logger.error(`Permission check failed for user '${userId}' and permission '${permissionName}':`, error);
      
      const result = this._createAccessDecision(false, 'check_failed');
      this._recordAccessDecision({
        userId,
        permissionName,
        result,
        reason: 'error: ' + error.message,
        responseTime: this.getDeterministicTimestamp() - startTime,
        context,
        error: true
      });
      
      return result;
    }
  }
  
  /**
   * Get user's effective permissions
   */
  async getUserPermissions(userId, includeInherited = true) {
    try {
      const user = this.users.get(userId);
      if (!user) {
        return { permissions: new Set(), roles: new Set() };
      }
      
      const effectivePermissions = new Set(user.permissions);
      const userRoles = Array.from(user.roles);
      
      // Add role-based permissions
      const rolePermissions = await this._getRolePermissions(userRoles);
      rolePermissions.forEach(p => effectivePermissions.add(p));
      
      // Add inherited permissions
      if (includeInherited && this.config.hierarchical) {
        const inheritedPermissions = await this._getInheritedPermissions(userRoles);
        inheritedPermissions.forEach(p => effectivePermissions.add(p));
      }
      
      return {
        permissions: effectivePermissions,
        roles: new Set(userRoles),
        directPermissions: new Set(user.permissions),
        roleBasedPermissions: rolePermissions,
        inheritedPermissions: includeInherited ? 
          await this._getInheritedPermissions(userRoles) : new Set()
      };
      
    } catch (error) {
      this.logger.error(`Failed to get permissions for user '${userId}':`, error);
      throw error;
    }
  }
  
  /**
   * Revoke role from user
   */
  async revokeRole(userId, roleName, options = {}) {
    try {
      const { revokedBy, reason } = options;
      
      const user = this.users.get(userId);
      if (!user || !user.roles.has(roleName)) {
        throw new Error(`User '${userId}' does not have role '${roleName}'`);
      }
      
      user.roles.delete(roleName);
      
      // Handle cascading revocation
      if (this.config.cascadeRevocation) {
        await this._cascadeRoleRevocation(userId, roleName);
      }
      
      // Record revocation
      this.roleAssignments.push({
        userId,
        roleName,
        revokedBy,
        revokedAt: this.getDeterministicDate(),
        reason,
        action: 'revoke'
      });
      
      // Clear cache
      this._clearUserCache(userId);
      
      // Save configuration
      await this._saveRBACConfiguration();
      
      this.emit('role:revoked', { userId, roleName, revokedBy });
      
    } catch (error) {
      this.logger.error(`Failed to revoke role '${roleName}' from user '${userId}':`, error);
      throw error;
    }
  }
  
  /**
   * Get RBAC metrics and status
   */
  getMetrics() {
    return {
      ...this.metrics,
      roles: this.roles.size,
      permissions: this.permissions.size,
      users: this.users.size,
      hierarchyRelations: this.roleHierarchy.size,
      cachedDecisions: this.decisionCache.size,
      accessDecisions: this.accessDecisions.length,
      organizationalUnits: this.organizationalUnits.size
    };
  }
  
  /**
   * Generate access report
   */
  async generateAccessReport(options = {}) {
    try {
      const {
        userId,
        period = '30d',
        includeDecisions = true,
        includeRoles = true,
        includePermissions = true
      } = options;
      
      const report = {
        generatedAt: this.getDeterministicDate(),
        period,
        scope: userId ? 'user' : 'system'
      };
      
      if (userId) {
        // User-specific report
        const user = this.users.get(userId);
        if (!user) {
          throw new Error(`User '${userId}' not found`);
        }
        
        report.user = {
          id: userId,
          roles: Array.from(user.roles),
          directPermissions: Array.from(user.permissions),
          effectivePermissions: includePermissions ? 
            Array.from((await this.getUserPermissions(userId)).permissions) : []
        };
        
        if (includeDecisions) {
          report.accessDecisions = this._getAccessDecisionsForUser(userId, period);
        }
        
      } else {
        // System-wide report
        report.system = {
          totalUsers: this.users.size,
          totalRoles: this.roles.size,
          totalPermissions: this.permissions.size,
          metrics: this.getMetrics()
        };
        
        if (includeDecisions) {
          report.accessDecisions = this._getAccessDecisionsForPeriod(period);
        }
      }
      
      return report;
      
    } catch (error) {
      this.logger.error('Failed to generate access report:', error);
      throw error;
    }
  }
  
  // Private methods
  
  async _validateRoleHierarchy(parentRoles) {
    for (const parentName of parentRoles) {
      if (!this.roles.has(parentName)) {
        throw new Error(`Parent role '${parentName}' not found`);
      }
      
      // Check for circular dependencies
      if (await this._wouldCreateCircularDependency(parentName, parentRoles)) {
        throw new Error('Circular role dependency detected');
      }
      
      // Check depth limit
      const depth = await this._getRoleDepth(parentName);
      if (depth >= this.config.maxRoleDepth) {
        throw new Error(`Role hierarchy depth limit (${this.config.maxRoleDepth}) exceeded`);
      }
    }
  }
  
  async _getRolePermissions(roleNames) {
    const permissions = new Set();
    
    for (const roleName of roleNames) {
      const role = this.roles.get(roleName);
      if (role && role.active) {
        role.permissions.forEach(p => permissions.add(p));
      }
    }
    
    return permissions;
  }
  
  async _getInheritedPermissions(roleNames) {
    const permissions = new Set();
    
    for (const roleName of roleNames) {
      const parentRoles = await this._getParentRoles(roleName);
      const parentPermissions = await this._getRolePermissions(Array.from(parentRoles));
      parentPermissions.forEach(p => permissions.add(p));
    }
    
    return permissions;
  }
  
  async _getParentRoles(roleName) {
    const role = this.roles.get(roleName);
    const parents = new Set();
    
    if (role) {
      role.parentRoles.forEach(parent => parents.add(parent));
      
      // Recursively get parent's parents
      for (const parent of role.parentRoles) {
        const grandParents = await this._getParentRoles(parent);
        grandParents.forEach(gp => parents.add(gp));
      }
    }
    
    return parents;
  }
  
  async _checkDynamicPermissions(userId, permissionName, context) {
    // Implement dynamic permission logic based on context
    // This could include location, time, device, etc.
    
    if (context.location && this.config.locationBasedAccess) {
      // Location-based access control
    }
    
    if (context.timestamp && this.config.timeBasedAccess) {
      // Time-based access control
    }
    
    return { granted: false, reason: 'No dynamic rules matched' };
  }
  
  async _evaluateConditions(userId, permissionName, context) {
    // Evaluate permission conditions
    const permission = this.permissions.get(permissionName);
    
    if (!permission || permission.conditions.size === 0) {
      return { satisfied: true };
    }
    
    for (const [name, condition] of permission.conditions) {
      const result = await this._evaluateCondition(condition, userId, context);
      if (!result.satisfied) {
        return { satisfied: false, failedCondition: name };
      }
    }
    
    return { satisfied: true };
  }
  
  async _evaluateCondition(condition, userId, context) {
    switch (condition.type) {
      case 'time_range':
        return this._evaluateTimeRangeCondition(condition, context);
      case 'ip_range':
        return this._evaluateIPRangeCondition(condition, context);
      case 'attribute':
        return this._evaluateAttributeCondition(condition, userId, context);
      default:
        return { satisfied: true };
    }
  }
  
  _evaluateTimeRangeCondition(condition, context) {
    if (!context.timestamp) {
      return { satisfied: true };
    }
    
    const now = new Date(context.timestamp);
    const startTime = new Date(condition.startTime);
    const endTime = new Date(condition.endTime);
    
    const satisfied = now >= startTime && now <= endTime;
    return { satisfied };
  }
  
  _evaluateIPRangeCondition(condition, context) {
    if (!context.ipAddress) {
      return { satisfied: true };
    }
    
    // Simplified IP range check - implement proper CIDR logic in production
    const allowed = condition.allowedRanges.some(range => 
      context.ipAddress.startsWith(range)
    );
    
    return { satisfied: allowed };
  }
  
  _evaluateAttributeCondition(condition, userId, context) {
    const user = this.users.get(userId);
    if (!user) {
      return { satisfied: false };
    }
    
    const attributeValue = user.metadata?.[condition.attribute] || 
                          context[condition.attribute];
    
    if (!attributeValue) {
      return { satisfied: false };
    }
    
    switch (condition.operator) {
      case 'equals':
        return { satisfied: attributeValue === condition.value };
      case 'contains':
        return { satisfied: attributeValue.includes(condition.value) };
      case 'greater_than':
        return { satisfied: attributeValue > condition.value };
      default:
        return { satisfied: true };
    }
  }
  
  async _checkTemporalConstraints(userId, permissionName) {
    // Check if any time-based constraints apply
    const user = this.users.get(userId);
    
    // Check temporary grants
    const temporaryGrants = this.temporaryGrants.get(userId) || [];
    const relevantGrant = temporaryGrants.find(grant => 
      grant.permissionName === permissionName && grant.active
    );
    
    if (relevantGrant) {
      if (this.getDeterministicTimestamp() > relevantGrant.expiresAt.getTime()) {
        relevantGrant.active = false;
        return { valid: false, reason: 'temporary_grant_expired' };
      }
    }
    
    return { valid: true };
  }
  
  async _evaluateAttributeBasedAccess(userId, permissionName, context) {
    // Implement ABAC logic
    // This would typically involve policy evaluation engines
    return { allowed: true };
  }
  
  async _checkSeparationOfDuties(userId, roleName) {
    const role = this.roles.get(roleName);
    if (!role) return;
    
    const user = this.users.get(userId);
    if (!user) return;
    
    // Check for conflicting roles
    const conflictingRoles = role.metadata?.conflictsWith || [];
    
    for (const conflictingRole of conflictingRoles) {
      if (user.roles.has(conflictingRole)) {
        throw new Error(
          `Separation of duties violation: Role '${roleName}' conflicts with '${conflictingRole}'`
        );
      }
    }
  }
  
  _createAccessDecision(granted, reason, grantSource = null, context = {}) {
    return {
      granted,
      reason,
      grantSource,
      timestamp: this.getDeterministicDate(),
      context: { ...context },
      decisionId: this._generateDecisionId()
    };
  }
  
  _recordAccessDecision(decision) {
    if (this.config.auditAllDecisions) {
      this.accessDecisions.push(decision);
      
      // Keep only recent decisions to prevent memory issues
      if (this.accessDecisions.length > 10000) {
        this.accessDecisions.splice(0, 1000);
      }
    }
  }
  
  _generateCacheKey(userId, permissionName, context) {
    const contextStr = JSON.stringify(context, Object.keys(context).sort());
    return createHash('sha256')
      .update(`${userId}:${permissionName}:${contextStr}`)
      .digest('hex');
  }
  
  _generateDecisionId() {
    return createHash('sha256')
      .update(`${this.getDeterministicTimestamp()}:${Math.random()}`)
      .digest('hex').substring(0, 16);
  }
  
  _clearUserCache(userId) {
    for (const [key, value] of this.decisionCache.entries()) {
      if (key.startsWith(`${userId}:`)) {
        this.decisionCache.delete(key);
      }
    }
  }
  
  async _wouldCreateCircularDependency(parentName, newParents) {
    // Check if adding these parents would create a circular dependency
    // This is a simplified check - implement full cycle detection in production
    return false;
  }
  
  async _getRoleDepth(roleName, visited = new Set()) {
    if (visited.has(roleName)) {
      return 0; // Circular reference, return 0 to prevent infinite recursion
    }
    
    visited.add(roleName);
    const role = this.roles.get(roleName);
    
    if (!role || role.parentRoles.size === 0) {
      return 0;
    }
    
    let maxDepth = 0;
    for (const parent of role.parentRoles) {
      const depth = await this._getRoleDepth(parent, new Set(visited));
      maxDepth = Math.max(maxDepth, depth + 1);
    }
    
    return maxDepth;
  }
  
  async _cascadeRoleRevocation(userId, roleName) {
    // Implement cascading revocation logic
    // This might involve removing dependent permissions or roles
  }
  
  _getAccessDecisionsForUser(userId, period) {
    const periodMs = this._parsePeriod(period);
    const cutoff = this.getDeterministicTimestamp() - periodMs;
    
    return this.accessDecisions.filter(decision => 
      decision.userId === userId &&
      new Date(decision.timestamp).getTime() > cutoff
    );
  }
  
  _getAccessDecisionsForPeriod(period) {
    const periodMs = this._parsePeriod(period);
    const cutoff = this.getDeterministicTimestamp() - periodMs;
    
    return this.accessDecisions.filter(decision => 
      new Date(decision.timestamp).getTime() > cutoff
    );
  }
  
  _parsePeriod(period) {
    const match = period.match(/^(\d+)([hdwmy])$/);
    if (!match) return 30 * 24 * 60 * 60 * 1000; // Default 30 days
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'w': return value * 7 * 24 * 60 * 60 * 1000;
      case 'm': return value * 30 * 24 * 60 * 60 * 1000;
      case 'y': return value * 365 * 24 * 60 * 60 * 1000;
      default: return 30 * 24 * 60 * 60 * 1000;
    }
  }
  
  async _loadRBACConfiguration() {
    try {
      const configPath = path.join(process.cwd(), 'config', 'security', 'rbac-config.json');
      const data = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(data);
      
      // Load roles
      if (config.roles) {
        for (const [name, roleData] of Object.entries(config.roles)) {
          this.roles.set(name, {
            ...roleData,
            permissions: new Set(roleData.permissions),
            parentRoles: new Set(roleData.parentRoles),
            childRoles: new Set(roleData.childRoles),
            conditions: new Map(Object.entries(roleData.conditions || {}))
          });
        }
      }
      
      // Load permissions
      if (config.permissions) {
        for (const [name, permissionData] of Object.entries(config.permissions)) {
          this.permissions.set(name, {
            ...permissionData,
            conditions: new Map(Object.entries(permissionData.conditions || {}))
          });
        }
      }
      
      // Load users
      if (config.users) {
        for (const [id, userData] of Object.entries(config.users)) {
          this.users.set(id, {
            ...userData,
            roles: new Set(userData.roles),
            permissions: new Set(userData.permissions),
            conditions: new Map(Object.entries(userData.conditions || {}))
          });
        }
      }
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.warn('Failed to load RBAC configuration:', error.message);
      }
    }
  }
  
  async _saveRBACConfiguration() {
    try {
      const configPath = path.join(process.cwd(), 'config', 'security', 'rbac-config.json');
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      
      const config = {
        roles: Object.fromEntries(
          Array.from(this.roles.entries()).map(([name, role]) => [name, {
            ...role,
            permissions: Array.from(role.permissions),
            parentRoles: Array.from(role.parentRoles),
            childRoles: Array.from(role.childRoles),
            conditions: Object.fromEntries(role.conditions)
          }])
        ),
        permissions: Object.fromEntries(
          Array.from(this.permissions.entries()).map(([name, permission]) => [name, {
            ...permission,
            conditions: Object.fromEntries(permission.conditions)
          }])
        ),
        users: Object.fromEntries(
          Array.from(this.users.entries()).map(([id, user]) => [id, {
            ...user,
            roles: Array.from(user.roles),
            permissions: Array.from(user.permissions),
            conditions: Object.fromEntries(user.conditions)
          }])
        ),
        lastUpdated: this.getDeterministicDate()
      };
      
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      
    } catch (error) {
      this.logger.error('Failed to save RBAC configuration:', error);
    }
  }
  
  async _initializeBuiltinRoles() {
    // Create built-in system roles if they don't exist
    const builtinRoles = [
      {
        name: 'system_admin',
        displayName: 'System Administrator',
        description: 'Full system access',
        permissions: ['*']
      },
      {
        name: 'security_admin',
        displayName: 'Security Administrator',
        description: 'Security management access',
        permissions: ['security:*', 'audit:*']
      },
      {
        name: 'user_admin',
        displayName: 'User Administrator',
        description: 'User and role management',
        permissions: ['user:*', 'role:read']
      },
      {
        name: 'viewer',
        displayName: 'Viewer',
        description: 'Read-only access',
        permissions: ['read:*']
      }
    ];
    
    for (const roleData of builtinRoles) {
      if (!this.roles.has(roleData.name)) {
        await this.createRole({ ...roleData, createdBy: 'system' });
      }
    }
  }
  
  async _setupRBACOntology() {
    // Setup RDF ontology for complex RBAC queries
    const ontology = `
      @prefix rbac: <http://kgen.security/rbac#> .
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      
      rbac:Role rdf:type rdfs:Class .
      rbac:Permission rdf:type rdfs:Class .
      rbac:User rdf:type rdfs:Class .
      
      rbac:hasPermission rdf:type rdf:Property .
      rbac:hasRole rdf:type rdf:Property .
      rbac:inheritsFrom rdf:type rdf:Property .
    `;
    
    const quads = this.rdfParser.parse(ontology);
    this.rdfStore.addQuads(quads);
  }
  
  async _loadOrganizationalStructure() {
    // Load organizational units and structure
  }
  
  async _addRoleToRDF(role) {
    // Add role information to RDF store for complex queries
  }
  
  async _addPermissionToRDF(permission) {
    // Add permission information to RDF store
  }
  
  async _addAssignmentToRDF(assignment) {
    // Add assignment information to RDF store
  }
  
  async _addGrantToRDF(grant) {
    // Add permission grant to RDF store
  }
  
  _startMaintenanceProcesses() {
    // Clean expired cache entries every 5 minutes
    setInterval(() => {
      const now = this.getDeterministicTimestamp();
      for (const [key, value] of this.decisionCache.entries()) {
        if (now > value.expiresAt) {
          this.decisionCache.delete(key);
        }
      }
    }, 300000);
    
    // Clean old access decisions every hour
    setInterval(() => {
      const cutoff = this.getDeterministicTimestamp() - (7 * 24 * 60 * 60 * 1000); // 7 days
      this.accessDecisions = this.accessDecisions.filter(decision => 
        new Date(decision.timestamp).getTime() > cutoff
      );
    }, 3600000);
    
    // Check for expired temporary grants every minute
    setInterval(() => {
      const now = this.getDeterministicTimestamp();
      for (const [userId, grants] of this.temporaryGrants.entries()) {
        const activeGrants = grants.filter(grant => {
          if (now > grant.expiresAt.getTime()) {
            grant.active = false;
            this.emit('temporary-grant:expired', { userId, grant });
            return false;
          }
          return grant.active;
        });
        
        if (activeGrants.length !== grants.length) {
          this.temporaryGrants.set(userId, activeGrants);
          this._clearUserCache(userId);
        }
      }
    }, 60000);
  }
  
  /**
   * Shutdown RBAC system
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down Enterprise RBAC system...');
      
      // Save current state
      await this._saveRBACConfiguration();
      
      // Clear all data
      this.roles.clear();
      this.permissions.clear();
      this.users.clear();
      this.decisionCache.clear();
      this.temporaryGrants.clear();
      
      this.state = 'shutdown';
      this.logger.success('Enterprise RBAC system shutdown complete');
      
    } catch (error) {
      this.logger.error('Error during RBAC shutdown:', error);
      throw error;
    }
  }
}

export default EnterpriseRBAC;