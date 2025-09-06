import { Request, Response, NextFunction } from 'express';
import { User } from '../auth/enterprise-auth.js';
import { dbManager } from '../config/database.js';

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystemRole: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
      permissions?: string[];
    }
  }
}

class RBACEngine {
  private permissionCache = new Map<string, Permission[]>();
  private roleCache = new Map<string, Role>();
  private readonly CACHE_TTL = 300000; // 5 minutes

  async getUserPermissions(userId: string, tenantId: string): Promise<Permission[]> {
    const cacheKey = `${userId}:${tenantId}`;
    
    if (this.permissionCache.has(cacheKey)) {
      return this.permissionCache.get(cacheKey)!;
    }

    try {
      const query = `
        SELECT DISTINCT
          p.id,
          p.name,
          p.resource,
          p.action,
          p.conditions
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN roles r ON rp.role_id = r.id
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = $1 
          AND (r.tenant_id = $2 OR r.tenant_id IS NULL)
          AND ur.is_active = true
          AND r.is_active = true
        ORDER BY p.resource, p.action
      `;

      const result = await dbManager.postgres.query(query, [userId, tenantId]);
      
      const permissions: Permission[] = result.rows.map(row => ({
        id: row.id,
        name: row.name,
        resource: row.resource,
        action: row.action,
        conditions: row.conditions,
      }));

      // Cache permissions
      this.permissionCache.set(cacheKey, permissions);
      setTimeout(() => this.permissionCache.delete(cacheKey), this.CACHE_TTL);

      return permissions;
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      return [];
    }
  }

  async hasPermission(
    userId: string,
    tenantId: string,
    resource: string,
    action: string,
    context?: Record<string, any>
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId, tenantId);
    
    const matchingPermission = permissions.find(p => 
      p.resource === resource && p.action === action
    );

    if (!matchingPermission) {
      return false;
    }

    // Check conditions if they exist
    if (matchingPermission.conditions && context) {
      return this.evaluateConditions(matchingPermission.conditions, context);
    }

    return true;
  }

  private evaluateConditions(conditions: Record<string, any>, context: Record<string, any>): boolean {
    try {
      // Simple condition evaluation - can be extended with more complex logic
      for (const [key, value] of Object.entries(conditions)) {
        switch (key) {
          case 'owner_only':
            if (value && context.ownerId !== context.userId) {
              return false;
            }
            break;
          
          case 'tenant_only':
            if (value && context.resourceTenantId !== context.userTenantId) {
              return false;
            }
            break;
          
          case 'status_in':
            if (Array.isArray(value) && !value.includes(context.status)) {
              return false;
            }
            break;
          
          case 'time_restriction':
            if (value.start && value.end) {
              const now = new Date();
              const start = new Date(value.start);
              const end = new Date(value.end);
              if (now < start || now > end) {
                return false;
              }
            }
            break;

          default:
            // Custom condition evaluation can be added here
            break;
        }
      }

      return true;
    } catch (error) {
      console.error('Error evaluating conditions:', error);
      return false;
    }
  }

  async createRole(tenantId: string, roleData: {
    name: string;
    description: string;
    permissions: string[];
  }): Promise<Role> {
    const client = await dbManager.postgres.connect();
    
    try {
      await client.query('BEGIN');

      // Create role
      const roleResult = await client.query(`
        INSERT INTO roles (tenant_id, name, description, is_system_role, is_active)
        VALUES ($1, $2, $3, false, true)
        RETURNING id
      `, [tenantId, roleData.name, roleData.description]);

      const roleId = roleResult.rows[0].id;

      // Assign permissions
      if (roleData.permissions.length > 0) {
        const permissionValues = roleData.permissions.map((permId, index) => 
          `($1, $${index + 2})`
        ).join(', ');
        
        await client.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ${permissionValues}
        `, [roleId, ...roleData.permissions]);
      }

      await client.query('COMMIT');

      // Fetch and return the complete role
      const role = await this.getRoleById(roleId);
      if (!role) {
        throw new Error('Failed to retrieve created role');
      }

      return role;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async assignRole(userId: string, roleId: string): Promise<void> {
    await dbManager.postgres.query(`
      INSERT INTO user_roles (user_id, role_id, assigned_at, is_active)
      VALUES ($1, $2, NOW(), true)
      ON CONFLICT (user_id, role_id) 
      DO UPDATE SET is_active = true, assigned_at = NOW()
    `, [userId, roleId]);

    // Clear permission cache for this user
    const keys = Array.from(this.permissionCache.keys()).filter(key => 
      key.startsWith(`${userId}:`)
    );
    keys.forEach(key => this.permissionCache.delete(key));
  }

  async revokeRole(userId: string, roleId: string): Promise<void> {
    await dbManager.postgres.query(
      'UPDATE user_roles SET is_active = false WHERE user_id = $1 AND role_id = $2',
      [userId, roleId]
    );

    // Clear permission cache for this user
    const keys = Array.from(this.permissionCache.keys()).filter(key => 
      key.startsWith(`${userId}:`)
    );
    keys.forEach(key => this.permissionCache.delete(key));
  }

  private async getRoleById(id: string): Promise<Role | null> {
    if (this.roleCache.has(id)) {
      return this.roleCache.get(id)!;
    }

    try {
      const query = `
        SELECT 
          r.*,
          array_agg(
            json_build_object(
              'id', p.id,
              'name', p.name,
              'resource', p.resource,
              'action', p.action,
              'conditions', p.conditions
            )
          ) FILTER (WHERE p.id IS NOT NULL) as permissions
        FROM roles r
        LEFT JOIN role_permissions rp ON r.id = rp.role_id
        LEFT JOIN permissions p ON rp.permission_id = p.id
        WHERE r.id = $1
        GROUP BY r.id
      `;

      const result = await dbManager.postgres.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const role: Role = {
        id: row.id,
        name: row.name,
        description: row.description,
        permissions: row.permissions || [],
        isSystemRole: row.is_system_role,
      };

      // Cache role
      this.roleCache.set(id, role);
      setTimeout(() => this.roleCache.delete(id), this.CACHE_TTL);

      return role;
    } catch (error) {
      console.error('Error fetching role:', error);
      return null;
    }
  }

  clearCache(): void {
    this.permissionCache.clear();
    this.roleCache.clear();
  }
}

const rbac = new RBACEngine();

// Middleware factory for permission checking
export const requirePermission = (resource: string, action: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'User must be authenticated',
        code: 'E_AUTH_401',
      });
    }

    if (!req.tenant) {
      return res.status(400).json({
        error: 'TENANT_REQUIRED',
        message: 'Tenant context required',
        code: 'E_TENANT_400',
      });
    }

    try {
      const context = {
        userId: req.user.id,
        userTenantId: req.user.tenantId,
        resourceTenantId: req.tenant.tenantId,
        ownerId: req.params.userId || req.body.userId,
        status: req.body.status,
        ...req.body.context,
      };

      const hasPermission = await rbac.hasPermission(
        req.user.id,
        req.user.tenantId,
        resource,
        action,
        context
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: 'INSUFFICIENT_PERMISSIONS',
          message: `Access denied: ${action} on ${resource}`,
          code: 'E_RBAC_403',
          required: { resource, action },
        });
      }

      // Attach user permissions to request for use in controllers
      req.permissions = await rbac.getUserPermissions(req.user.id, req.user.tenantId)
        .then(perms => perms.map(p => `${p.resource}:${p.action}`));

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({
        error: 'PERMISSION_CHECK_ERROR',
        message: 'Failed to verify permissions',
        code: 'E_RBAC_500',
      });
    }
  };
};

// Middleware for role checking
export const requireRole = (roleName: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'User must be authenticated',
        code: 'E_AUTH_401',
      });
    }

    if (!req.user.roles.includes(roleName)) {
      return res.status(403).json({
        error: 'INSUFFICIENT_ROLE',
        message: `Role '${roleName}' required`,
        code: 'E_ROLE_403',
        required: roleName,
        current: req.user.roles,
      });
    }

    next();
  };
};

// Middleware for multiple role checking (OR logic)
export const requireAnyRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'User must be authenticated',
        code: 'E_AUTH_401',
      });
    }

    const hasAnyRole = roles.some(role => req.user!.roles.includes(role));
    
    if (!hasAnyRole) {
      return res.status(403).json({
        error: 'INSUFFICIENT_ROLE',
        message: `One of these roles required: ${roles.join(', ')}`,
        code: 'E_ROLE_403',
        required: roles,
        current: req.user.roles,
      });
    }

    next();
  };
};

// Admin-only middleware
export const requireAdmin = requireRole('admin');

// Super admin middleware
export const requireSuperAdmin = requireRole('super_admin');

export { rbac };