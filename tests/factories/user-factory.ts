import { faker } from '@faker-js/faker';

export interface TestUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  permissions: string[];
  tenant?: string;
  metadata: Record<string, any>;
}

export interface TestSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  permissions: string[];
}

export class UserFactory {
  /**
   * Create a test user
   */
  static createUser(overrides: Partial<TestUser> = {}): TestUser {
    const roles: Array<'admin' | 'user' | 'guest'> = ['admin', 'user', 'guest'];
    
    return {
      id: overrides.id || faker.string.uuid(),
      name: overrides.name || faker.person.fullName(),
      email: overrides.email || faker.internet.email(),
      role: overrides.role || faker.helpers.arrayElement(roles),
      permissions: overrides.permissions || this.createPermissions(),
      tenant: overrides.tenant || faker.string.uuid(),
      metadata: overrides.metadata || {
        createdAt: faker.date.past(),
        lastLogin: faker.date.recent(),
        preferences: {
          theme: faker.helpers.arrayElement(['light', 'dark']),
          language: faker.helpers.arrayElement(['en', 'es', 'fr'])
        }
      },
      ...overrides
    };
  }

  /**
   * Create multiple test users
   */
  static createUsers(count: number = 5): TestUser[] {
    return Array.from({ length: count }, () => this.createUser());
  }

  /**
   * Create admin user
   */
  static createAdmin(overrides: Partial<TestUser> = {}): TestUser {
    return this.createUser({
      role: 'admin',
      permissions: [
        'read:all',
        'write:all',
        'delete:all',
        'admin:users',
        'admin:system'
      ],
      ...overrides
    });
  }

  /**
   * Create regular user
   */
  static createRegularUser(overrides: Partial<TestUser> = {}): TestUser {
    return this.createUser({
      role: 'user',
      permissions: [
        'read:own',
        'write:own',
        'generate:templates'
      ],
      ...overrides
    });
  }

  /**
   * Create guest user
   */
  static createGuestUser(overrides: Partial<TestUser> = {}): TestUser {
    return this.createUser({
      role: 'guest',
      permissions: ['read:public'],
      ...overrides
    });
  }

  /**
   * Create test session
   */
  static createSession(userId?: string, overrides: Partial<TestSession> = {}): TestSession {
    return {
      id: overrides.id || faker.string.uuid(),
      userId: userId || faker.string.uuid(),
      token: overrides.token || faker.string.alphanumeric(64),
      expiresAt: overrides.expiresAt || faker.date.future(),
      permissions: overrides.permissions || this.createPermissions(),
      ...overrides
    };
  }

  /**
   * Create permissions array
   */
  static createPermissions(role?: 'admin' | 'user' | 'guest'): string[] {
    const basePermissions = [
      'read:templates',
      'read:generators'
    ];

    switch (role) {
      case 'admin':
        return [
          ...basePermissions,
          'read:all',
          'write:all',
          'delete:all',
          'admin:users',
          'admin:system',
          'admin:templates',
          'admin:generators'
        ];
      
      case 'user':
        return [
          ...basePermissions,
          'read:own',
          'write:own',
          'generate:templates',
          'create:generators'
        ];
      
      case 'guest':
        return basePermissions;
      
      default:
        return faker.helpers.arrayElements([
          'read:templates',
          'read:generators',
          'read:own',
          'write:own',
          'generate:templates',
          'create:generators'
        ]);
    }
  }

  /**
   * Create multi-tenant scenarios
   */
  static createMultiTenantScenarios() {
    const tenantA = faker.string.uuid();
    const tenantB = faker.string.uuid();

    return {
      tenantA: {
        id: tenantA,
        users: [
          this.createUser({ tenant: tenantA }),
          this.createUser({ tenant: tenantA }),
          this.createAdmin({ tenant: tenantA })
        ]
      },
      tenantB: {
        id: tenantB,
        users: [
          this.createUser({ tenant: tenantB }),
          this.createUser({ tenant: tenantB })
        ]
      },
      sharedUser: this.createUser({ tenant: undefined }) // Cross-tenant user
    };
  }

  /**
   * Create security test scenarios
   */
  static createSecurityScenarios() {
    return {
      sqlInjection: this.createUser({
        name: "'; DROP TABLE users; --",
        email: "test@evil.com"
      }),
      
      xssAttempt: this.createUser({
        name: "<script>alert('xss')</script>",
        email: "test@evil.com"
      }),
      
      pathTraversal: this.createUser({
        name: "../../../etc/passwd",
        email: "test@evil.com"
      }),
      
      oversizedData: this.createUser({
        name: 'A'.repeat(10000),
        email: 'B'.repeat(1000) + '@evil.com'
      }),

      maliciousMetadata: this.createUser({
        metadata: {
          __proto__: { admin: true },
          constructor: { prototype: { admin: true } }
        }
      })
    };
  }

  /**
   * Create authentication scenarios
   */
  static createAuthScenarios() {
    const user = this.createUser();
    
    return {
      validSession: this.createSession(user.id, {
        expiresAt: faker.date.future()
      }),
      
      expiredSession: this.createSession(user.id, {
        expiresAt: faker.date.past()
      }),
      
      invalidToken: this.createSession(user.id, {
        token: 'invalid-token'
      }),
      
      missingPermissions: this.createSession(user.id, {
        permissions: []
      }),

      elevatedPermissions: this.createSession(user.id, {
        permissions: ['admin:all']
      })
    };
  }
}

// Convenience exports
export const {
  createUser,
  createUsers,
  createAdmin,
  createRegularUser,
  createGuestUser,
  createSession,
  createPermissions,
  createMultiTenantScenarios,
  createSecurityScenarios,
  createAuthScenarios
} = UserFactory;