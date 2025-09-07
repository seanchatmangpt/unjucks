import { Pool } from 'pg';
import { dbManager } from '../config/database.js';
import { env } from '../config/environment.js';

/**
 * @typedef {Object} TenantContext
 * @property {string} tenantId
 * @property {string} tenantSlug
 * @property {string} schema
 * @property {string[]} permissions
 * @property {Object} quotas
 * @property {number} quotas.apiCallsPerHour
 * @property {number} quotas.storageLimit
 * @property {number} quotas.userLimit
 * @property {Object} quotas.currentUsage
 * @property {number} quotas.currentUsage.apiCalls
 * @property {number} quotas.currentUsage.storage
 * @property {number} quotas.currentUsage.users
 */

class TenantManager {
  constructor() {
    /** @type {Map<string, TenantContext>} */
    this.tenantCache = new Map();
    /** @type {Map<string, number>} */
    this.cacheExpiry = new Map();
    this.CACHE_TTL = 300000; // 5 minutes
  }

  /**
   * Get tenant by slug
   * @param {string} slug - Tenant slug
   * @returns {Promise<TenantContext|null>} Tenant context or null
   */
  async getTenantBySlug(slug) {
    // Check cache first
    const cached = this.tenantCache.get(slug);
    const expiry = this.cacheExpiry.get(slug);
    
    if (cached && expiry && expiry > Date.now()) {
      return cached;
    }

    try {
      const query = `
        SELECT 
          t.id as tenant_id,
          t.slug as tenant_slug,
          t.schema_name,
          t.permissions,
          tq.api_calls_per_hour,
          tq.storage_limit_mb,
          tq.user_limit,
          COALESCE(tu.api_calls_used, 0) as api_calls_used,
          COALESCE(tu.storage_used_mb, 0) as storage_used,
          COALESCE(tu.user_count, 0) as user_count
        FROM tenants t
        JOIN tenant_quotas tq ON t.id = tq.tenant_id
        LEFT JOIN tenant_usage tu ON t.id = tu.tenant_id
        WHERE t.slug = $1 AND t.is_active = true
      `;

      const result = await dbManager.postgres.query(query, [slug]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      /** @type {TenantContext} */
      const tenant = {
        tenantId: row.tenant_id,
        tenantSlug: row.tenant_slug,
        schema: row.schema_name,
        permissions: Array.isArray(row.permissions) ? row.permissions : [],
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

      // Cache the result
      this.tenantCache.set(slug, tenant);
      this.cacheExpiry.set(slug, Date.now() + this.CACHE_TTL);

      return tenant;
    } catch (error) {
      console.error('Error fetching tenant:', error);
      return null;
    }
  }

  /**
   * Get tenant by domain
   * @param {string} domain - Domain name
   * @returns {Promise<TenantContext|null>} Tenant context or null
   */
  async getTenantByDomain(domain) {
    try {
      const query = `
        SELECT t.slug
        FROM tenants t
        JOIN tenant_domains td ON t.id = td.tenant_id
        WHERE td.domain = $1 AND t.is_active = true
      `;

      const result = await dbManager.postgres.query(query, [domain]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.getTenantBySlug(result.rows[0].slug);
    } catch (error) {
      console.error('Error fetching tenant by domain:', error);
      return null;
    }
  }

  /**
   * Create tenant-specific database connection
   * @param {TenantContext} tenant - Tenant context
   * @returns {Promise<Pool>} Tenant database pool
   */
  async createTenantConnection(tenant) {
    const tenantPool = new Pool({
      ...dbManager.postgres.options,
      schema: tenant.schema,
      application_name: `unjucks-tenant-${tenant.tenantSlug}`,
    });

    // Set search path for tenant isolation
    tenantPool.on('connect', async (client) => {
      await client.query(`SET search_path TO "${tenant.schema}", public`);
    });

    return tenantPool;
  }

  /**
   * Clear tenant cache
   * @param {string} [slug] - Specific slug to clear, or clear all if undefined
   */
  clearCache(slug) {
    if (slug) {
      this.tenantCache.delete(slug);
      this.cacheExpiry.delete(slug);
    } else {
      this.tenantCache.clear();
      this.cacheExpiry.clear();
    }
  }
}

const tenantManager = new TenantManager();

/**
 * Tenant resolution middleware
 * @type {import('express').RequestHandler}
 */
export const resolveTenant = async (req, res, next) => {
  try {
    let tenant = null;

    // Method 1: Extract from subdomain
    const host = req.get('host') || '';
    const subdomain = host.split('.')[0];
    
    if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
      tenant = await tenantManager.getTenantBySlug(subdomain);
    }

    // Method 2: Extract from custom domain
    if (!tenant) {
      tenant = await tenantManager.getTenantByDomain(host);
    }

    // Method 3: Extract from header (for API calls)
    if (!tenant) {
      const tenantHeader = req.get('X-Tenant-Slug');
      if (tenantHeader) {
        tenant = await tenantManager.getTenantBySlug(tenantHeader);
      }
    }

    // Method 4: Extract from path parameter
    if (!tenant && req.params.tenantSlug) {
      tenant = await tenantManager.getTenantBySlug(req.params.tenantSlug);
    }

    if (!tenant) {
      return res.status(404).json({
        error: 'TENANT_NOT_FOUND',
        message: 'Tenant not found or inactive',
        code: 'E_TENANT_404',
      });
    }

    // Create tenant-specific database connection
    const tenantDb = await tenantManager.createTenantConnection(tenant);

    // Attach to request
    req.tenant = tenant;
    req.tenantDb = tenantDb;

    next();
  } catch (error) {
    console.error('Tenant resolution error:', error);
    res.status(500).json({
      error: 'TENANT_RESOLUTION_ERROR',
      message: 'Failed to resolve tenant',
      code: 'E_TENANT_500',
    });
  }
};

/**
 * Quota enforcement middleware
 * @type {import('express').RequestHandler}
 */
export const enforceQuotas = async (req, res, next) => {
  if (!req.tenant) {
    return next();
  }

  const { quotas } = req.tenant;

  try {
    // Check API rate limits
    if (quotas.currentUsage.apiCalls >= quotas.apiCallsPerHour) {
      return res.status(429).json({
        error: 'QUOTA_EXCEEDED',
        message: 'API rate limit exceeded',
        code: 'E_RATE_LIMIT_429',
        retryAfter: 3600, // 1 hour
      });
    }

    // Check storage limits (for upload endpoints)
    if (req.route?.path.includes('upload') && 
        quotas.currentUsage.storage >= quotas.storageLimit) {
      return res.status(413).json({
        error: 'STORAGE_QUOTA_EXCEEDED',
        message: 'Storage quota exceeded',
        code: 'E_STORAGE_413',
      });
    }

    // Increment API call counter (async, non-blocking)
    setImmediate(async () => {
      try {
        await dbManager.postgres.query(
          'UPDATE tenant_usage SET api_calls_used = api_calls_used + 1 WHERE tenant_id = $1',
          [req.tenant.tenantId]
        );
      } catch (error) {
        console.error('Failed to update API usage:', error);
      }
    });

    next();
  } catch (error) {
    console.error('Quota enforcement error:', error);
    next();
  }
};

/**
 * Schema validation middleware
 * @type {import('express').RequestHandler}
 */
export const validateTenantSchema = async (req, res, next) => {
  if (!req.tenant || !req.tenantDb) {
    return next();
  }

  try {
    // Verify schema exists and is accessible
    const result = await req.tenantDb.query(
      'SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1',
      [req.tenant.schema]
    );

    if (result.rows.length === 0) {
      return res.status(500).json({
        error: 'SCHEMA_NOT_FOUND',
        message: 'Tenant schema not found',
        code: 'E_SCHEMA_500',
      });
    }

    next();
  } catch (error) {
    console.error('Schema validation error:', error);
    res.status(500).json({
      error: 'SCHEMA_VALIDATION_ERROR',
      message: 'Failed to validate tenant schema',
      code: 'E_SCHEMA_VALIDATION_500',
    });
  }
};

/**
 * Cleanup middleware for connection pools
 * @type {import('express').RequestHandler}
 */
export const cleanupTenantConnections = (req, res, next) => {
  const cleanup = () => {
    if (req.tenantDb) {
      // Close tenant-specific connection pool after response
      setImmediate(() => {
        req.tenantDb?.end().catch(console.error);
      });
    }
  };

  res.on('finish', cleanup);
  res.on('close', cleanup);
  next();
};

export { tenantManager };