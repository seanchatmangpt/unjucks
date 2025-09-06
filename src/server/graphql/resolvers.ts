import { AuthenticationError, ForbiddenError, UserInputError } from 'apollo-server-express';
import { GraphQLScalarType } from 'graphql';
import { Kind } from 'graphql/language';
import DataLoader from 'dataloader';
import { User } from '../auth/enterprise-auth.js';
import { TenantContext } from '../middleware/tenant-isolation.js';
import { dbManager } from '../config/database.js';
import { auditLogger } from '../services/audit-logger.js';

// Context interface
export interface GraphQLContext {
  user?: User;
  tenant?: TenantContext;
  req: any;
  dataloaders: {
    users: DataLoader<string, User>;
    templates: DataLoader<string, any>;
    projects: DataLoader<string, any>;
    tenants: DataLoader<string, TenantContext>;
    permissions: DataLoader<string, any[]>;
  };
}

// Scalar types
const DateTimeType = new GraphQLScalarType({
  name: 'DateTime',
  serialize: (value: any) => value.toISOString(),
  parseValue: (value: any) => new Date(value),
  parseLiteral: (ast) => {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    return null;
  },
});

const JSONType = new GraphQLScalarType({
  name: 'JSON',
  serialize: (value: any) => value,
  parseValue: (value: any) => value,
  parseLiteral: (ast) => {
    switch (ast.kind) {
      case Kind.STRING:
      case Kind.BOOLEAN:
        return ast.value;
      case Kind.INT:
      case Kind.FLOAT:
        return parseFloat(ast.value);
      case Kind.OBJECT:
        const value = Object.create(null);
        ast.fields.forEach((field) => {
          value[field.name.value] = parseLiteral(field.value);
        });
        return value;
      case Kind.LIST:
        return ast.values.map(parseLiteral);
      default:
        return null;
    }
  },
});

// DataLoader factory functions
function createUserLoader(): DataLoader<string, User> {
  return new DataLoader(async (ids: readonly string[]) => {
    const query = `
      SELECT 
        u.*,
        array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL) as roles,
        array_agg(DISTINCT p.name) FILTER (WHERE p.name IS NOT NULL) as permissions
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN permissions p ON rp.permission_id = p.id
      WHERE u.id = ANY($1) AND u.is_active = true
      GROUP BY u.id
    `;

    const result = await dbManager.postgres.query(query, [Array.from(ids)]);
    const userMap = new Map(result.rows.map(row => [row.id, mapUserData(row)]));
    
    return ids.map(id => userMap.get(id) || null);
  });
}

function createTemplateLoader(): DataLoader<string, any> {
  return new DataLoader(async (ids: readonly string[]) => {
    const query = `
      SELECT t.*, u.first_name, u.last_name, u.email as author_email
      FROM templates t
      JOIN users u ON t.author_id = u.id
      WHERE t.id = ANY($1)
    `;

    const result = await dbManager.postgres.query(query, [Array.from(ids)]);
    const templateMap = new Map(result.rows.map(row => [row.id, row]));
    
    return ids.map(id => templateMap.get(id) || null);
  });
}

function createProjectLoader(): DataLoader<string, any> {
  return new DataLoader(async (ids: readonly string[]) => {
    const query = `
      SELECT p.*, u.first_name, u.last_name, u.email as owner_email
      FROM projects p
      JOIN users u ON p.owner_id = u.id
      WHERE p.id = ANY($1)
    `;

    const result = await dbManager.postgres.query(query, [Array.from(ids)]);
    const projectMap = new Map(result.rows.map(row => [row.id, row]));
    
    return ids.map(id => projectMap.get(id) || null);
  });
}

function createTenantLoader(): DataLoader<string, TenantContext> {
  return new DataLoader(async (ids: readonly string[]) => {
    const query = `
      SELECT 
        t.*,
        tq.api_calls_per_hour,
        tq.storage_limit_mb,
        tq.user_limit,
        COALESCE(tu.api_calls_used, 0) as api_calls_used,
        COALESCE(tu.storage_used_mb, 0) as storage_used,
        COALESCE(tu.user_count, 0) as user_count
      FROM tenants t
      JOIN tenant_quotas tq ON t.id = tq.tenant_id
      LEFT JOIN tenant_usage tu ON t.id = tu.tenant_id
      WHERE t.id = ANY($1) AND t.is_active = true
    `;

    const result = await dbManager.postgres.query(query, [Array.from(ids)]);
    const tenantMap = new Map(result.rows.map(row => [row.id, mapTenantData(row)]));
    
    return ids.map(id => tenantMap.get(id) || null);
  });
}

function createPermissionLoader(): DataLoader<string, any[]> {
  return new DataLoader(async (userIds: readonly string[]) => {
    const query = `
      SELECT 
        ur.user_id,
        array_agg(
          json_build_object(
            'id', p.id,
            'name', p.name,
            'resource', p.resource,
            'action', p.action,
            'conditions', p.conditions
          )
        ) as permissions
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE ur.user_id = ANY($1) AND ur.is_active = true
      GROUP BY ur.user_id
    `;

    const result = await dbManager.postgres.query(query, [Array.from(userIds)]);
    const permissionMap = new Map(result.rows.map(row => [row.user_id, row.permissions || []]));
    
    return userIds.map(id => permissionMap.get(id) || []);
  });
}

// Helper functions
function mapUserData(row: any): User {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    tenantId: row.tenant_id,
    roles: row.roles || [],
    permissions: row.permissions || [],
    provider: row.provider,
    isActive: row.is_active,
    lastLoginAt: row.last_login_at,
    metadata: row.metadata,
  };
}

function mapTenantData(row: any): TenantContext {
  return {
    tenantId: row.id,
    tenantSlug: row.slug,
    schema: row.schema_name,
    permissions: [],
    quotas: {
      apiCallsPerHour: row.api_calls_per_hour,
      storageLimit: row.storage_limit_mb,
      userLimit: row.user_limit,
      currentUsage: {
        apiCalls: row.api_calls_used,
        storage: row.storage_used,
        users: row.user_count,
      },
    },
  };
}

// Authentication helpers
function requireAuth(user?: User): User {
  if (!user) {
    throw new AuthenticationError('Authentication required');
  }
  return user;
}

function requireRole(user: User, role: string): void {
  if (!user.roles.includes(role)) {
    throw new ForbiddenError(`Role '${role}' required`);
  }
}

function requireTenant(tenant?: TenantContext): TenantContext {
  if (!tenant) {
    throw new UserInputError('Tenant context required');
  }
  return tenant;
}

// Main resolvers
export const resolvers = {
  DateTime: DateTimeType,
  JSON: JSONType,

  Query: {
    // User & Auth
    me: async (_: any, __: any, context: GraphQLContext) => {
      const user = requireAuth(context.user);
      return context.dataloaders.users.load(user.id);
    },

    user: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      const user = requireAuth(context.user);
      requireRole(user, 'admin');
      return context.dataloaders.users.load(id);
    },

    users: async (_: any, { first = 20, after }: { first?: number; after?: string }, context: GraphQLContext) => {
      const user = requireAuth(context.user);
      requireRole(user, 'admin');
      const tenant = requireTenant(context.tenant);

      const offset = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;
      const query = `
        SELECT u.*
        FROM users u
        WHERE u.tenant_id = $1 AND u.is_active = true
        ORDER BY u.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await dbManager.postgres.query(query, [tenant.tenantId, first, offset]);
      return Promise.all(result.rows.map(row => context.dataloaders.users.load(row.id)));
    },

    // Tenants
    tenant: async (_: any, __: any, context: GraphQLContext) => {
      const tenant = requireTenant(context.tenant);
      return context.dataloaders.tenants.load(tenant.tenantId);
    },

    tenants: async (_: any, __: any, context: GraphQLContext) => {
      const user = requireAuth(context.user);
      requireRole(user, 'super_admin');

      const query = 'SELECT * FROM tenants WHERE is_active = true ORDER BY created_at DESC';
      const result = await dbManager.postgres.query(query);
      
      return Promise.all(result.rows.map(row => context.dataloaders.tenants.load(row.id)));
    },

    // Templates
    template: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      requireAuth(context.user);
      return context.dataloaders.templates.load(id);
    },

    templates: async (
      _: any,
      { first = 20, after, category, type, status, search }: {
        first?: number;
        after?: string;
        category?: string;
        type?: string;
        status?: string;
        search?: string;
      },
      context: GraphQLContext
    ) => {
      requireAuth(context.user);
      const tenant = requireTenant(context.tenant);

      const offset = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;
      const conditions: string[] = ['t.tenant_id = $1'];
      const values: any[] = [tenant.tenantId];
      let paramIndex = 2;

      if (category) {
        conditions.push(`t.category = $${paramIndex}`);
        values.push(category);
        paramIndex++;
      }

      if (type) {
        conditions.push(`t.type = $${paramIndex}`);
        values.push(type);
        paramIndex++;
      }

      if (status) {
        conditions.push(`t.status = $${paramIndex}`);
        values.push(status);
        paramIndex++;
      }

      if (search) {
        conditions.push(`(t.name ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`);
        values.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM templates t WHERE ${whereClause}`;
      const countResult = await dbManager.postgres.query(countQuery, values);
      const totalCount = parseInt(countResult.rows[0].count);

      // Get templates
      const templatesQuery = `
        SELECT t.*
        FROM templates t
        WHERE ${whereClause}
        ORDER BY t.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const templatesResult = await dbManager.postgres.query(templatesQuery, [
        ...values,
        first,
        offset,
      ]);

      const templates = await Promise.all(
        templatesResult.rows.map(row => context.dataloaders.templates.load(row.id))
      );

      const edges = templates.map((template, index) => ({
        node: template,
        cursor: Buffer.from((offset + index).toString()).toString('base64'),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: offset + first < totalCount,
          hasPreviousPage: offset > 0,
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
        },
        totalCount,
      };
    },

    // Projects
    project: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      requireAuth(context.user);
      return context.dataloaders.projects.load(id);
    },

    projects: async (
      _: any,
      { first = 20, after, search }: {
        first?: number;
        after?: string;
        search?: string;
      },
      context: GraphQLContext
    ) => {
      const user = requireAuth(context.user);
      const tenant = requireTenant(context.tenant);

      const offset = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;
      const conditions: string[] = ['p.tenant_id = $1'];
      const values: any[] = [tenant.tenantId];
      let paramIndex = 2;

      // Add search condition
      if (search) {
        conditions.push(`(p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`);
        values.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM projects p WHERE ${whereClause}`;
      const countResult = await dbManager.postgres.query(countQuery, values);
      const totalCount = parseInt(countResult.rows[0].count);

      // Get projects
      const projectsQuery = `
        SELECT p.*
        FROM projects p
        WHERE ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const projectsResult = await dbManager.postgres.query(projectsQuery, [
        ...values,
        first,
        offset,
      ]);

      const projects = await Promise.all(
        projectsResult.rows.map(row => context.dataloaders.projects.load(row.id))
      );

      const edges = projects.map((project, index) => ({
        node: project,
        cursor: Buffer.from((offset + index).toString()).toString('base64'),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: offset + first < totalCount,
          hasPreviousPage: offset > 0,
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
        },
        totalCount,
      };
    },

    // Audit Logs
    auditLogs: async (
      _: any,
      { filter, first = 50, after }: {
        filter?: any;
        first?: number;
        after?: string;
      },
      context: GraphQLContext
    ) => {
      const user = requireAuth(context.user);
      requireRole(user, 'admin');
      const tenant = requireTenant(context.tenant);

      const offset = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;
      const conditions: string[] = ['al.tenant_id = $1'];
      const values: any[] = [tenant.tenantId];
      let paramIndex = 2;

      if (filter) {
        if (filter.userId) {
          conditions.push(`al.user_id = $${paramIndex}`);
          values.push(filter.userId);
          paramIndex++;
        }

        if (filter.resource) {
          conditions.push(`al.resource = $${paramIndex}`);
          values.push(filter.resource);
          paramIndex++;
        }

        if (filter.action) {
          conditions.push(`al.action = $${paramIndex}`);
          values.push(filter.action);
          paramIndex++;
        }

        if (filter.category) {
          conditions.push(`al.category = $${paramIndex}`);
          values.push(filter.category);
          paramIndex++;
        }

        if (filter.severity) {
          conditions.push(`al.severity = $${paramIndex}`);
          values.push(filter.severity);
          paramIndex++;
        }

        if (filter.startDate) {
          conditions.push(`al.timestamp >= $${paramIndex}`);
          values.push(filter.startDate);
          paramIndex++;
        }

        if (filter.endDate) {
          conditions.push(`al.timestamp <= $${paramIndex}`);
          values.push(filter.endDate);
          paramIndex++;
        }
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM audit_logs al WHERE ${whereClause}`;
      const countResult = await dbManager.postgres.query(countQuery, values);
      const totalCount = parseInt(countResult.rows[0].count);

      // Get audit logs
      const logsQuery = `
        SELECT al.*, u.first_name, u.last_name, u.email
        FROM audit_logs al
        JOIN users u ON al.user_id = u.id
        WHERE ${whereClause}
        ORDER BY al.timestamp DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const logsResult = await dbManager.postgres.query(logsQuery, [
        ...values,
        first,
        offset,
      ]);

      const auditLogs = logsResult.rows.map(row => ({
        id: row.id,
        user: {
          id: row.user_id,
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.email,
        },
        action: row.action,
        resource: row.resource,
        resourceId: row.resource_id,
        details: row.details,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        severity: row.severity.toUpperCase(),
        category: row.category.toUpperCase(),
        outcome: row.outcome.toUpperCase(),
        timestamp: row.timestamp,
      }));

      const edges = auditLogs.map((log, index) => ({
        node: log,
        cursor: Buffer.from((offset + index).toString()).toString('base64'),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: offset + first < totalCount,
          hasPreviousPage: offset > 0,
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
        },
        totalCount,
      };
    },

    // System
    systemHealth: async (_: any, __: any, context: GraphQLContext) => {
      const user = requireAuth(context.user);
      requireRole(user, 'admin');

      const dbMetrics = dbManager.metrics;
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: {
          postgres: {
            connected: true,
            activeConnections: dbMetrics.pgActiveConnections,
            idleConnections: dbMetrics.pgIdleConnections,
            lastHealthCheck: dbMetrics.lastHealthCheck,
          },
          redis: {
            connected: dbMetrics.redisConnected,
          },
        },
        memory: process.memoryUsage(),
        uptime: process.uptime(),
      };
    },

    systemMetrics: async (_: any, __: any, context: GraphQLContext) => {
      const user = requireAuth(context.user);
      requireRole(user, 'admin');

      // This would typically integrate with monitoring systems
      return {
        timestamp: new Date().toISOString(),
        requests: {
          total: 0, // Would come from metrics system
          errors: 0,
          averageResponseTime: 0,
        },
        resources: {
          cpu: 0,
          memory: process.memoryUsage(),
          disk: 0,
        },
        database: dbManager.metrics,
      };
    },
  },

  Mutation: {
    // Authentication
    login: async (_: any, { email, password }: { email: string; password: string }, context: GraphQLContext) => {
      // This would integrate with the enterprise auth service
      throw new Error('Login mutation not implemented - use auth endpoints');
    },

    // Templates
    createTemplate: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      const user = requireAuth(context.user);
      const tenant = requireTenant(context.tenant);

      const client = await dbManager.postgres.connect();
      
      try {
        await client.query('BEGIN');

        // Create template
        const templateResult = await client.query(`
          INSERT INTO templates (tenant_id, author_id, name, description, type, category, tags, metadata, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'DRAFT')
          RETURNING id
        `, [
          tenant.tenantId,
          user.id,
          input.name,
          input.description,
          input.type,
          input.category,
          JSON.stringify(input.tags || []),
          JSON.stringify(input.metadata || {}),
        ]);

        const templateId = templateResult.rows[0].id;

        // Create template files
        for (const file of input.files) {
          await client.query(`
            INSERT INTO template_files (template_id, path, content, encoding, frontmatter, size, checksum)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            templateId,
            file.path,
            file.content,
            file.encoding || 'utf8',
            JSON.stringify(file.frontmatter || {}),
            Buffer.byteLength(file.content, 'utf8'),
            'sha256-placeholder', // Would calculate actual checksum
          ]);
        }

        // Create template variables
        for (const variable of input.variables) {
          await client.query(`
            INSERT INTO template_variables (template_id, name, type, description, default_value, required, validation, options)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            templateId,
            variable.name,
            variable.type,
            variable.description,
            variable.defaultValue,
            variable.required,
            JSON.stringify(variable.validation || {}),
            JSON.stringify(variable.options || []),
          ]);
        }

        await client.query('COMMIT');

        // Audit log
        await auditLogger.logDataAccess(
          user,
          tenant,
          context.req,
          'template',
          templateId,
          'create',
          'success',
          { templateName: input.name, type: input.type }
        );

        return context.dataloaders.templates.load(templateId);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    // Generate
    generate: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      const user = requireAuth(context.user);
      const tenant = requireTenant(context.tenant);

      // This would integrate with the generation service
      const generationId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create generation record
      await dbManager.postgres.query(`
        INSERT INTO generations (id, template_id, project_id, author_id, variables, status)
        VALUES ($1, $2, $3, $4, $5, 'running')
      `, [
        generationId,
        input.templateId,
        input.projectId,
        user.id,
        JSON.stringify(input.variables),
      ]);

      // Audit log
      await auditLogger.logDataAccess(
        user,
        tenant,
        context.req,
        'generation',
        generationId,
        'create',
        'success',
        { templateId: input.templateId, projectId: input.projectId }
      );

      // Return mock result - would be replaced with actual generation logic
      return {
        generation: {
          id: generationId,
          status: 'running',
          createdAt: new Date(),
        },
        files: [],
        summary: {
          filesGenerated: 0,
          totalSize: 0,
          duration: 0,
          warnings: [],
          errors: [],
        },
      };
    },
  },

  // Field resolvers
  User: {
    fullName: (parent: any) => `${parent.firstName} ${parent.lastName}`,
    tenant: (parent: any, _: any, context: GraphQLContext) => 
      context.dataloaders.tenants.load(parent.tenantId),
  },

  Template: {
    author: (parent: any, _: any, context: GraphQLContext) =>
      context.dataloaders.users.load(parent.author_id),
    tenant: (parent: any, _: any, context: GraphQLContext) =>
      context.dataloaders.tenants.load(parent.tenant_id),
  },

  Project: {
    owner: (parent: any, _: any, context: GraphQLContext) =>
      context.dataloaders.users.load(parent.owner_id),
    tenant: (parent: any, _: any, context: GraphQLContext) =>
      context.dataloaders.tenants.load(parent.tenant_id),
  },

  AuditLog: {
    user: (parent: any, _: any, context: GraphQLContext) =>
      context.dataloaders.users.load(parent.userId),
  },
};

// Context factory
export function createGraphQLContext(req: any): Omit<GraphQLContext, 'user' | 'tenant'> {
  return {
    req,
    dataloaders: {
      users: createUserLoader(),
      templates: createTemplateLoader(),
      projects: createProjectLoader(),
      tenants: createTenantLoader(),
      permissions: createPermissionLoader(),
    },
  };
}