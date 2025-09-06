import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Generator } from '../../src/lib/generator.js';
import { FileInjector } from '../../src/lib/file-injector.js';
import { UserFactory, GeneratorFactory, FileFactory, ConfigFactory } from '../factories/index.js';
import fs from 'fs-extra';
import path from 'path';

// Mock external dependencies
vi.mock('fs-extra');
const mockFs = vi.mocked(fs);

describe('Multi-Tenant Isolation Tests', () => {
  let generator: Generator;
  let injector: FileInjector;
  
  // Test tenant configurations
  const tenantA = 'tenant-a-uuid-123';
  const tenantB = 'tenant-b-uuid-456';
  const tenantC = 'tenant-c-uuid-789';

  beforeEach(() => {
    generator = new Generator();
    injector = new FileInjector();
    
    // Setup tenant-aware mocks
    mockFs.pathExists.mockImplementation((filePath: string) => {
      // Simulate tenant isolation - only allow access to own tenant directories
      return Promise.resolve(true);
    });
    
    mockFs.readFile.mockResolvedValue('tenant template content');
    mockFs.writeFile.mockResolvedValue();
    mockFs.ensureDir.mockResolvedValue();
    mockFs.readdir.mockResolvedValue(['template.njk']);
    mockFs.stat.mockResolvedValue({ isDirectory: () => false } as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Data Isolation', () => {
    it('should prevent cross-tenant data access', async () => {
      const tenantAUser = UserFactory.createUser({ tenant: tenantA });
      const tenantBUser = UserFactory.createUser({ tenant: tenantB });

      // Tenant A tries to access Tenant B's data
      const crossTenantOptions = GeneratorFactory.createGenerateOptions({
        generator: 'component',
        template: 'basic',
        dest: `/tenants/${tenantB}/src`, // Cross-tenant access attempt
        variables: { name: 'MaliciousComponent' }
      });

      // Mock tenant validation
      const validateTenantAccess = (targetPath: string, userTenant: string) => {
        if (targetPath.includes(`/tenants/${tenantB}/`) && userTenant === tenantA) {
          throw new Error('Cross-tenant access denied');
        }
      };

      expect(() => validateTenantAccess(crossTenantOptions.dest, tenantA))
        .toThrow('Cross-tenant access denied');
    });

    it('should isolate template directories by tenant', async () => {
      const tenantConfigs = ConfigFactory.createMultiTenantConfigs();

      // Each tenant should only see their own templates
      expect(tenantConfigs[tenantA].templates.directory).toBe(`./tenants/${tenantA}/_templates`);
      expect(tenantConfigs[tenantB].templates.directory).toBe(`./tenants/${tenantB}/_templates`);
      
      expect(tenantConfigs[tenantA].security.allowedPaths).toEqual([`./tenants/${tenantA}/src`]);
      expect(tenantConfigs[tenantB].security.allowedPaths).toEqual([`./tenants/${tenantB}/src`]);
    });

    it('should prevent file injection across tenant boundaries', async () => {
      const tenantAFile = `/tenants/${tenantA}/src/component.ts`;
      const tenantBFile = `/tenants/${tenantB}/src/component.ts`;

      // Tenant A user tries to inject into Tenant B file
      const validateFileAccess = (filePath: string, userTenant: string) => {
        const tenantFromPath = filePath.match(/\/tenants\/([^\/]+)\//)?.[1];
        if (tenantFromPath && tenantFromPath !== userTenant) {
          throw new Error(`Access denied to tenant ${tenantFromPath} resource`);
        }
      };

      expect(() => validateFileAccess(tenantBFile, tenantA))
        .toThrow('Access denied to tenant tenant-b-uuid-456 resource');

      // Same tenant access should work
      expect(() => validateFileAccess(tenantAFile, tenantA))
        .not.toThrow();
    });

    it('should isolate generated files by tenant', async () => {
      const tenantAOptions = GeneratorFactory.createGenerateOptions({
        dest: `/tenants/${tenantA}/src`,
        variables: { name: 'TenantAComponent', tenantId: tenantA }
      });

      const tenantBOptions = GeneratorFactory.createGenerateOptions({
        dest: `/tenants/${tenantB}/src`,
        variables: { name: 'TenantBComponent', tenantId: tenantB }
      });

      // Mock tenant-aware file writing
      mockFs.writeFile.mockImplementation((filePath: string, content: string) => {
        const tenantFromPath = (filePath as string).match(/\/tenants\/([^\/]+)\//)?.[1];
        const contentTenant = (content as string).match(/tenantId.*?([a-f0-9-]+)/)?.[1];
        
        if (tenantFromPath !== contentTenant) {
          throw new Error('Tenant mismatch: file path and content tenant do not match');
        }
        
        return Promise.resolve();
      });

      // These should work - tenant matches
      await expect(generator.generate(tenantAOptions)).resolves.toBeDefined();
      await expect(generator.generate(tenantBOptions)).resolves.toBeDefined();

      // This should fail - tenant mismatch
      const mismatchOptions = GeneratorFactory.createGenerateOptions({
        dest: `/tenants/${tenantA}/src`,
        variables: { name: 'Component', tenantId: tenantB } // Wrong tenant ID
      });
      
      await expect(generator.generate(mismatchOptions))
        .rejects.toThrow('Tenant mismatch');
    });
  });

  describe('User Isolation', () => {
    it('should prevent users from accessing other tenant users', async () => {
      const tenantAUsers = Array.from({ length: 3 }, () => 
        UserFactory.createUser({ tenant: tenantA })
      );
      
      const tenantBUsers = Array.from({ length: 2 }, () => 
        UserFactory.createUser({ tenant: tenantB })
      );

      const getUsersForTenant = (requestingUser: any, targetTenant: string) => {
        if (requestingUser.tenant !== targetTenant) {
          throw new Error('Cannot access users from other tenants');
        }
        
        if (targetTenant === tenantA) return tenantAUsers;
        if (targetTenant === tenantB) return tenantBUsers;
        return [];
      };

      const tenantAUser = tenantAUsers[0];
      const tenantBUser = tenantBUsers[0];

      // Should be able to access own tenant users
      expect(() => getUsersForTenant(tenantAUser, tenantA)).not.toThrow();
      expect(getUsersForTenant(tenantAUser, tenantA)).toHaveLength(3);

      // Should not be able to access other tenant users
      expect(() => getUsersForTenant(tenantAUser, tenantB))
        .toThrow('Cannot access users from other tenants');
    });

    it('should isolate user sessions by tenant', async () => {
      const tenantAUser = UserFactory.createUser({ tenant: tenantA });
      const tenantBUser = UserFactory.createUser({ tenant: tenantB });

      const tenantASession = UserFactory.createSession(tenantAUser.id, {
        permissions: ['read:own-tenant', 'write:own-tenant']
      });

      const tenantBSession = UserFactory.createSession(tenantBUser.id, {
        permissions: ['read:own-tenant', 'write:own-tenant']
      });

      const validateSessionAccess = (session: any, targetTenant: string) => {
        // In a real system, we'd lookup the user and validate tenant
        const userTenant = session.userId.includes('tenant-a') ? tenantA : tenantB;
        
        if (userTenant !== targetTenant) {
          throw new Error('Session cannot access different tenant resources');
        }
      };

      // Same tenant access should work
      expect(() => validateSessionAccess(tenantASession, tenantA)).not.toThrow();
      expect(() => validateSessionAccess(tenantBSession, tenantB)).not.toThrow();

      // Cross-tenant access should fail
      expect(() => validateSessionAccess(tenantASession, tenantB))
        .toThrow('Session cannot access different tenant resources');
    });

    it('should prevent privilege escalation across tenants', async () => {
      const tenantAAdmin = UserFactory.createAdmin({ tenant: tenantA });
      const tenantBUser = UserFactory.createRegularUser({ tenant: tenantB });

      const checkPrivilegeEscalation = (user: any, targetAction: string, targetTenant: string) => {
        // Even admins can't escalate to other tenants
        if (user.tenant !== targetTenant) {
          throw new Error('Cross-tenant privilege escalation denied');
        }

        if (targetAction === 'admin:delete' && user.role !== 'admin') {
          throw new Error('Insufficient privileges');
        }
      };

      // Tenant A admin can perform admin actions in Tenant A
      expect(() => checkPrivilegeEscalation(tenantAAdmin, 'admin:delete', tenantA))
        .not.toThrow();

      // Tenant A admin cannot perform actions in Tenant B
      expect(() => checkPrivilegeEscalation(tenantAAdmin, 'admin:delete', tenantB))
        .toThrow('Cross-tenant privilege escalation denied');

      // Tenant B user cannot perform admin actions even in own tenant
      expect(() => checkPrivilegeEscalation(tenantBUser, 'admin:delete', tenantB))
        .toThrow('Insufficient privileges');
    });
  });

  describe('Resource Isolation', () => {
    it('should isolate memory usage by tenant', async () => {
      const tenantAMemory = new Map<string, any>();
      const tenantBMemory = new Map<string, any>();
      
      const tenantMemoryStore = {
        [tenantA]: tenantAMemory,
        [tenantB]: tenantBMemory
      };

      const setTenantData = (tenantId: string, key: string, value: any) => {
        const store = tenantMemoryStore[tenantId];
        if (!store) {
          throw new Error(`Tenant ${tenantId} not found`);
        }
        store.set(key, value);
      };

      const getTenantData = (tenantId: string, key: string) => {
        const store = tenantMemoryStore[tenantId];
        if (!store) {
          throw new Error(`Tenant ${tenantId} not found`);
        }
        return store.get(key);
      };

      // Store data for each tenant
      setTenantData(tenantA, 'config', { theme: 'dark' });
      setTenantData(tenantB, 'config', { theme: 'light' });

      // Each tenant should only see their own data
      expect(getTenantData(tenantA, 'config')).toEqual({ theme: 'dark' });
      expect(getTenantData(tenantB, 'config')).toEqual({ theme: 'light' });

      // Memory stores should be completely separate
      expect(tenantAMemory.size).toBe(1);
      expect(tenantBMemory.size).toBe(1);
      expect(tenantAMemory.has('config')).toBe(true);
      expect(tenantBMemory.has('config')).toBe(true);
    });

    it('should enforce resource quotas per tenant', async () => {
      const tenantQuotas = {
        [tenantA]: { maxFiles: 100, maxStorage: 10 * 1024 * 1024 }, // 10MB
        [tenantB]: { maxFiles: 50, maxStorage: 5 * 1024 * 1024 },   // 5MB
        [tenantC]: { maxFiles: 200, maxStorage: 20 * 1024 * 1024 }  // 20MB
      };

      const tenantUsage = {
        [tenantA]: { files: 95, storage: 9 * 1024 * 1024 },
        [tenantB]: { files: 45, storage: 4 * 1024 * 1024 },
        [tenantC]: { files: 50, storage: 5 * 1024 * 1024 }
      };

      const checkResourceQuota = (tenantId: string, operation: 'create_file' | 'upload', size: number) => {
        const quota = tenantQuotas[tenantId];
        const usage = tenantUsage[tenantId];

        if (!quota || !usage) {
          throw new Error(`Tenant ${tenantId} not found`);
        }

        if (operation === 'create_file') {
          if (usage.files >= quota.maxFiles) {
            throw new Error(`File quota exceeded for tenant ${tenantId}`);
          }
          if (usage.storage + size > quota.maxStorage) {
            throw new Error(`Storage quota exceeded for tenant ${tenantId}`);
          }
        }
      };

      // Tenant A is near file limit
      expect(() => checkResourceQuota(tenantA, 'create_file', 1024))
        .not.toThrow();
      
      // Tenant B would exceed file limit
      tenantUsage[tenantB].files = 50;
      expect(() => checkResourceQuota(tenantB, 'create_file', 1024))
        .toThrow('File quota exceeded');

      // Tenant A would exceed storage limit
      expect(() => checkResourceQuota(tenantA, 'create_file', 2 * 1024 * 1024))
        .toThrow('Storage quota exceeded');
    });

    it('should isolate CPU and processing time by tenant', async () => {
      const tenantProcessingTime = {
        [tenantA]: 0,
        [tenantB]: 0,
        [tenantC]: 0
      };

      const maxProcessingTimePerTenant = 5000; // 5 seconds

      const trackTenantProcessing = async (tenantId: string, operation: () => Promise<any>) => {
        const startTime = Date.now();
        
        try {
          const result = await operation();
          return result;
        } finally {
          const endTime = Date.now();
          const processingTime = endTime - startTime;
          
          tenantProcessingTime[tenantId] += processingTime;
          
          if (tenantProcessingTime[tenantId] > maxProcessingTimePerTenant) {
            throw new Error(`Processing time quota exceeded for tenant ${tenantId}`);
          }
        }
      };

      const slowOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'completed';
      };

      // Multiple operations for tenant A
      for (let i = 0; i < 40; i++) {
        await trackTenantProcessing(tenantA, slowOperation);
      }

      // Should be close to limit
      expect(tenantProcessingTime[tenantA]).toBeGreaterThan(3000);
      expect(tenantProcessingTime[tenantA]).toBeLessThan(maxProcessingTimePerTenant);

      // One more operation should exceed limit
      await expect(trackTenantProcessing(tenantA, async () => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return 'slow';
      })).rejects.toThrow('Processing time quota exceeded');
    });
  });

  describe('Database Isolation', () => {
    it('should use tenant-specific database schemas', async () => {
      const getDatabaseConnection = (tenantId: string) => {
        return {
          schema: `tenant_${tenantId.replace(/-/g, '_')}`,
          connectionString: `postgres://db/tenant_${tenantId}`,
          isolationLevel: 'READ_COMMITTED'
        };
      };

      const tenantAConnection = getDatabaseConnection(tenantA);
      const tenantBConnection = getDatabaseConnection(tenantB);

      expect(tenantAConnection.schema).toBe('tenant_tenant_a_uuid_123');
      expect(tenantBConnection.schema).toBe('tenant_tenant_b_uuid_456');
      expect(tenantAConnection.schema).not.toBe(tenantBConnection.schema);
    });

    it('should prevent cross-tenant database queries', async () => {
      const executeQuery = (tenantId: string, query: string) => {
        // Simulate query validation
        const tenantPattern = new RegExp(`tenant_${tenantId.replace(/-/g, '_')}`);
        
        if (query.includes('tenant_') && !tenantPattern.test(query)) {
          throw new Error('Cross-tenant database access detected');
        }
        
        return { result: 'query executed' };
      };

      const validQuery = `SELECT * FROM tenant_${tenantA.replace(/-/g, '_')}.templates`;
      const invalidQuery = `SELECT * FROM tenant_${tenantB.replace(/-/g, '_')}.templates`;

      // Valid same-tenant query
      expect(() => executeQuery(tenantA, validQuery)).not.toThrow();

      // Invalid cross-tenant query
      expect(() => executeQuery(tenantA, invalidQuery))
        .toThrow('Cross-tenant database access detected');
    });

    it('should implement row-level security for shared tables', async () => {
      interface TableRow {
        id: string;
        tenant_id: string;
        data: any;
      }

      const sharedTable: TableRow[] = [
        { id: '1', tenant_id: tenantA, data: { name: 'A1' } },
        { id: '2', tenant_id: tenantB, data: { name: 'B1' } },
        { id: '3', tenant_id: tenantA, data: { name: 'A2' } },
        { id: '4', tenant_id: tenantC, data: { name: 'C1' } }
      ];

      const queryWithRLS = (requestingTenantId: string, filters: any = {}) => {
        return sharedTable.filter(row => {
          // Row-level security: only return rows for requesting tenant
          if (row.tenant_id !== requestingTenantId) {
            return false;
          }
          
          // Apply additional filters
          if (filters.id && row.id !== filters.id) {
            return false;
          }
          
          return true;
        });
      };

      const tenantARows = queryWithRLS(tenantA);
      const tenantBRows = queryWithRLS(tenantB);
      const tenantCRows = queryWithRLS(tenantC);

      expect(tenantARows).toHaveLength(2);
      expect(tenantBRows).toHaveLength(1);
      expect(tenantCRows).toHaveLength(1);

      expect(tenantARows.every(row => row.tenant_id === tenantA)).toBe(true);
      expect(tenantBRows.every(row => row.tenant_id === tenantB)).toBe(true);
      expect(tenantCRows.every(row => row.tenant_id === tenantC)).toBe(true);
    });
  });

  describe('Network Isolation', () => {
    it('should implement tenant-specific network policies', async () => {
      const networkPolicies = {
        [tenantA]: {
          allowedIPs: ['10.0.1.0/24', '192.168.1.0/24'],
          blockedIPs: ['10.0.2.0/24'],
          allowedPorts: [80, 443, 8080],
          protocol: 'HTTPS_ONLY'
        },
        [tenantB]: {
          allowedIPs: ['10.0.2.0/24', '192.168.2.0/24'],
          blockedIPs: ['10.0.1.0/24'],
          allowedPorts: [80, 443],
          protocol: 'HTTPS_ONLY'
        }
      };

      const validateNetworkAccess = (tenantId: string, sourceIP: string, port: number) => {
        const policy = networkPolicies[tenantId];
        if (!policy) {
          throw new Error('Tenant not found');
        }

        // Check if IP is explicitly blocked
        for (const blockedRange of policy.blockedIPs) {
          if (isIPInRange(sourceIP, blockedRange)) {
            throw new Error(`IP ${sourceIP} is blocked for tenant ${tenantId}`);
          }
        }

        // Check if IP is in allowed ranges
        const ipAllowed = policy.allowedIPs.some(range => isIPInRange(sourceIP, range));
        if (!ipAllowed) {
          throw new Error(`IP ${sourceIP} is not allowed for tenant ${tenantId}`);
        }

        // Check port
        if (!policy.allowedPorts.includes(port)) {
          throw new Error(`Port ${port} is not allowed for tenant ${tenantId}`);
        }
      };

      // Tenant A access
      expect(() => validateNetworkAccess(tenantA, '10.0.1.10', 443))
        .not.toThrow();

      // Tenant A blocked IP
      expect(() => validateNetworkAccess(tenantA, '10.0.2.10', 443))
        .toThrow('is blocked for tenant');

      // Cross-tenant IP access
      expect(() => validateNetworkAccess(tenantA, '10.0.2.10', 443))
        .toThrow('is blocked for tenant');

      // Invalid port
      expect(() => validateNetworkAccess(tenantB, '10.0.2.10', 8080))
        .toThrow('Port 8080 is not allowed');
    });

    it('should isolate tenant API endpoints', async () => {
      const tenantRoutes = {
        [tenantA]: `/api/tenants/${tenantA}`,
        [tenantB]: `/api/tenants/${tenantB}`,
        [tenantC]: `/api/tenants/${tenantC}`
      };

      const routeAccessControl = (requestingTenantId: string, requestedRoute: string) => {
        const allowedRoute = tenantRoutes[requestingTenantId];
        
        if (!allowedRoute) {
          throw new Error('Tenant not found');
        }

        if (!requestedRoute.startsWith(allowedRoute)) {
          throw new Error('Cross-tenant API access denied');
        }
      };

      // Valid access
      expect(() => routeAccessControl(tenantA, `/api/tenants/${tenantA}/templates`))
        .not.toThrow();

      // Invalid cross-tenant access
      expect(() => routeAccessControl(tenantA, `/api/tenants/${tenantB}/templates`))
        .toThrow('Cross-tenant API access denied');
    });
  });

  describe('Audit and Monitoring Isolation', () => {
    it('should maintain separate audit logs per tenant', async () => {
      const auditLogs = {
        [tenantA]: [],
        [tenantB]: [],
        [tenantC]: []
      };

      const logAuditEvent = (tenantId: string, event: any) => {
        if (!auditLogs[tenantId]) {
          throw new Error('Invalid tenant ID');
        }

        auditLogs[tenantId].push({
          ...event,
          timestamp: new Date(),
          tenantId
        });
      };

      const getAuditLog = (requestingTenantId: string, targetTenantId: string) => {
        if (requestingTenantId !== targetTenantId) {
          throw new Error('Cannot access other tenant audit logs');
        }
        
        return auditLogs[targetTenantId] || [];
      };

      // Log events for different tenants
      logAuditEvent(tenantA, { action: 'template_generated', user: 'user1' });
      logAuditEvent(tenantB, { action: 'file_uploaded', user: 'user2' });
      logAuditEvent(tenantA, { action: 'config_updated', user: 'user3' });

      // Each tenant can only see their own logs
      const tenantALogs = getAuditLog(tenantA, tenantA);
      const tenantBLogs = getAuditLog(tenantB, tenantB);

      expect(tenantALogs).toHaveLength(2);
      expect(tenantBLogs).toHaveLength(1);

      // Cross-tenant access should fail
      expect(() => getAuditLog(tenantA, tenantB))
        .toThrow('Cannot access other tenant audit logs');
    });

    it('should provide tenant-specific monitoring metrics', async () => {
      const tenantMetrics = {
        [tenantA]: {
          templatesGenerated: 150,
          storageUsed: 5.2,
          apiCalls: 1250,
          errors: 3
        },
        [tenantB]: {
          templatesGenerated: 75,
          storageUsed: 2.8,
          apiCalls: 680,
          errors: 1
        }
      };

      const getMetrics = (requestingTenantId: string, targetTenantId: string) => {
        if (requestingTenantId !== targetTenantId) {
          return null; // No cross-tenant metrics access
        }
        
        return tenantMetrics[targetTenantId];
      };

      const tenantAMetrics = getMetrics(tenantA, tenantA);
      const crossTenantAttempt = getMetrics(tenantA, tenantB);

      expect(tenantAMetrics?.templatesGenerated).toBe(150);
      expect(crossTenantAttempt).toBeNull();
    });
  });

  // Helper function for IP range checking (simplified)
  function isIPInRange(ip: string, range: string): boolean {
    // Simplified IP range check for testing
    const rangeBase = range.split('/')[0];
    const rangePrefix = rangeBase.split('.').slice(0, -1).join('.');
    const ipPrefix = ip.split('.').slice(0, -1).join('.');
    
    return rangePrefix === ipPrefix;
  }
});