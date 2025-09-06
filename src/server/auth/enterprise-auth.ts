import { Strategy as SamlStrategy } from 'passport-saml';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import { Strategy as LdapStrategy } from 'passport-ldapauth';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as LocalStrategy } from 'passport-local';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { env } from '../config/environment.js';
import { dbManager } from '../config/database.js';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  provider: 'local' | 'saml' | 'google' | 'github' | 'microsoft' | 'ldap';
  isActive: boolean;
  lastLoginAt?: Date;
  metadata?: Record<string, any>;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

class EnterpriseAuthService {
  constructor() {
    this.configurePassportStrategies();
  }

  private configurePassportStrategies(): void {
    // JWT Strategy
    passport.use(new JwtStrategy({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: env.JWT_SECRET,
      issuer: 'unjucks-enterprise',
      audience: 'unjucks-api',
    }, async (payload, done) => {
      try {
        const user = await this.getUserById(payload.sub);
        return done(null, user || false);
      } catch (error) {
        return done(error, false);
      }
    }));

    // Local Strategy
    passport.use(new LocalStrategy({
      usernameField: 'email',
      passwordField: 'password',
    }, async (email, password, done) => {
      try {
        const user = await this.validateLocalUser(email, password);
        return done(null, user || false);
      } catch (error) {
        return done(error, false);
      }
    }));

    // SAML Strategy
    if (env.SAML_ENTRY_POINT && env.SAML_CERT) {
      passport.use(new SamlStrategy({
        entryPoint: env.SAML_ENTRY_POINT,
        issuer: env.SAML_ISSUER || 'unjucks-enterprise',
        cert: env.SAML_CERT,
        privateKey: env.SAML_PRIVATE_KEY,
        signatureAlgorithm: 'sha256',
      }, async (profile, done) => {
        try {
          const user = await this.handleSamlUser(profile);
          return done(null, user);
        } catch (error) {
          return done(error, false);
        }
      }));
    }

    // Google OAuth Strategy
    if (env.OAUTH_GOOGLE_CLIENT_ID && env.OAUTH_GOOGLE_CLIENT_SECRET) {
      passport.use(new GoogleStrategy({
        clientID: env.OAUTH_GOOGLE_CLIENT_ID,
        clientSecret: env.OAUTH_GOOGLE_CLIENT_SECRET,
        callbackURL: '/auth/google/callback',
        scope: ['profile', 'email'],
      }, async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await this.handleOAuthUser(profile, 'google');
          return done(null, user);
        } catch (error) {
          return done(error, false);
        }
      }));
    }

    // GitHub OAuth Strategy
    if (env.OAUTH_GITHUB_CLIENT_ID && env.OAUTH_GITHUB_CLIENT_SECRET) {
      passport.use(new GitHubStrategy({
        clientID: env.OAUTH_GITHUB_CLIENT_ID,
        clientSecret: env.OAUTH_GITHUB_CLIENT_SECRET,
        callbackURL: '/auth/github/callback',
      }, async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await this.handleOAuthUser(profile, 'github');
          return done(null, user);
        } catch (error) {
          return done(error, false);
        }
      }));
    }

    // Microsoft OAuth Strategy
    if (env.OAUTH_MICROSOFT_CLIENT_ID && env.OAUTH_MICROSOFT_CLIENT_SECRET) {
      passport.use(new MicrosoftStrategy({
        clientID: env.OAUTH_MICROSOFT_CLIENT_ID,
        clientSecret: env.OAUTH_MICROSOFT_CLIENT_SECRET,
        callbackURL: '/auth/microsoft/callback',
        scope: ['user.read'],
      }, async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await this.handleOAuthUser(profile, 'microsoft');
          return done(null, user);
        } catch (error) {
          return done(error, false);
        }
      }));
    }

    // LDAP Strategy
    if (env.LDAP_URL && env.LDAP_BIND_DN) {
      passport.use(new LdapStrategy({
        server: {
          url: env.LDAP_URL,
          bindDN: env.LDAP_BIND_DN,
          bindCredentials: env.LDAP_BIND_CREDENTIALS,
          searchBase: env.LDAP_SEARCH_BASE,
          searchFilter: env.LDAP_SEARCH_FILTER,
        },
      }, async (profile, done) => {
        try {
          const user = await this.handleLdapUser(profile);
          return done(null, user);
        } catch (error) {
          return done(error, false);
        }
      }));
    }
  }

  async generateTokens(user: User): Promise<AuthTokens> {
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.roles,
      permissions: user.permissions,
      iss: 'unjucks-enterprise',
      aud: 'unjucks-api',
    };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    });

    const refreshToken = jwt.sign({ sub: user.id }, env.JWT_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    });

    // Store refresh token
    await this.storeRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      expiresIn: 24 * 60 * 60 * 1000, // 24 hours in ms
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens | null> {
    try {
      const decoded = jwt.verify(refreshToken, env.JWT_SECRET) as any;
      
      // Verify refresh token exists in database
      const isValid = await this.verifyRefreshToken(decoded.sub, refreshToken);
      if (!isValid) {
        return null;
      }

      const user = await this.getUserById(decoded.sub);
      if (!user || !user.isActive) {
        return null;
      }

      // Revoke old refresh token
      await this.revokeRefreshToken(refreshToken);

      return this.generateTokens(user);
    } catch (error) {
      console.error('Refresh token error:', error);
      return null;
    }
  }

  private async validateLocalUser(email: string, password: string): Promise<User | null> {
    try {
      const query = `
        SELECT u.*, array_agg(DISTINCT r.name) as roles, array_agg(DISTINCT p.name) as permissions
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        LEFT JOIN role_permissions rp ON r.id = rp.role_id
        LEFT JOIN permissions p ON rp.permission_id = p.id
        WHERE u.email = $1 AND u.provider = 'local' AND u.is_active = true
        GROUP BY u.id
      `;

      const result = await dbManager.postgres.query(query, [email]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const userData = result.rows[0];
      const isValidPassword = await bcrypt.compare(password, userData.password_hash);
      
      if (!isValidPassword) {
        return null;
      }

      // Update last login
      await this.updateLastLogin(userData.id);

      return this.mapUserData(userData);
    } catch (error) {
      console.error('Local authentication error:', error);
      return null;
    }
  }

  private async handleSamlUser(profile: any): Promise<User> {
    const email = profile.email || profile.nameID;
    const firstName = profile.firstName || profile.givenName || '';
    const lastName = profile.lastName || profile.surname || '';

    return this.createOrUpdateUser({
      email,
      firstName,
      lastName,
      provider: 'saml',
      externalId: profile.nameID,
      metadata: profile,
    });
  }

  private async handleOAuthUser(profile: any, provider: string): Promise<User> {
    const email = profile.emails?.[0]?.value || profile.email;
    const firstName = profile.name?.givenName || profile.given_name || '';
    const lastName = profile.name?.familyName || profile.family_name || '';

    return this.createOrUpdateUser({
      email,
      firstName,
      lastName,
      provider: provider as any,
      externalId: profile.id,
      metadata: profile,
    });
  }

  private async handleLdapUser(profile: any): Promise<User> {
    const email = profile.mail || profile.email;
    const firstName = profile.givenName || profile.cn || '';
    const lastName = profile.sn || profile.surname || '';

    return this.createOrUpdateUser({
      email,
      firstName,
      lastName,
      provider: 'ldap',
      externalId: profile.dn,
      metadata: profile,
    });
  }

  private async createOrUpdateUser(userData: {
    email: string;
    firstName: string;
    lastName: string;
    provider: User['provider'];
    externalId: string;
    metadata: any;
  }): Promise<User> {
    const client = await dbManager.postgres.connect();
    
    try {
      await client.query('BEGIN');

      // Check if user exists
      const existingUser = await client.query(
        'SELECT * FROM users WHERE email = $1',
        [userData.email]
      );

      let userId: string;

      if (existingUser.rows.length > 0) {
        // Update existing user
        const updateResult = await client.query(`
          UPDATE users SET
            first_name = $2,
            last_name = $3,
            provider = $4,
            external_id = $5,
            metadata = $6,
            last_login_at = NOW()
          WHERE email = $1
          RETURNING id
        `, [
          userData.email,
          userData.firstName,
          userData.lastName,
          userData.provider,
          userData.externalId,
          JSON.stringify(userData.metadata),
        ]);
        
        userId = updateResult.rows[0].id;
      } else {
        // Create new user
        const insertResult = await client.query(`
          INSERT INTO users (email, first_name, last_name, provider, external_id, metadata, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, true)
          RETURNING id
        `, [
          userData.email,
          userData.firstName,
          userData.lastName,
          userData.provider,
          userData.externalId,
          JSON.stringify(userData.metadata),
        ]);
        
        userId = insertResult.rows[0].id;

        // Assign default role
        await client.query(
          'INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = $2',
          [userId, 'user']
        );
      }

      await client.query('COMMIT');

      // Fetch complete user data
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('Failed to retrieve user after creation/update');
      }

      return user;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async getUserById(id: string): Promise<User | null> {
    try {
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
        WHERE u.id = $1 AND u.is_active = true
        GROUP BY u.id
      `;

      const result = await dbManager.postgres.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapUserData(result.rows[0]);
    } catch (error) {
      console.error('Get user by ID error:', error);
      return null;
    }
  }

  private mapUserData(userData: any): User {
    return {
      id: userData.id,
      email: userData.email,
      firstName: userData.first_name,
      lastName: userData.last_name,
      tenantId: userData.tenant_id,
      roles: userData.roles || [],
      permissions: userData.permissions || [],
      provider: userData.provider,
      isActive: userData.is_active,
      lastLoginAt: userData.last_login_at,
      metadata: userData.metadata,
    };
  }

  private async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    await dbManager.postgres.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, refreshToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)] // 7 days
    );
  }

  private async verifyRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
    const result = await dbManager.postgres.query(
      'SELECT 1 FROM refresh_tokens WHERE user_id = $1 AND token = $2 AND expires_at > NOW()',
      [userId, refreshToken]
    );
    
    return result.rows.length > 0;
  }

  private async revokeRefreshToken(refreshToken: string): Promise<void> {
    await dbManager.postgres.query(
      'DELETE FROM refresh_tokens WHERE token = $1',
      [refreshToken]
    );
  }

  private async updateLastLogin(userId: string): Promise<void> {
    await dbManager.postgres.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [userId]
    );
  }
}

export const authService = new EnterpriseAuthService();