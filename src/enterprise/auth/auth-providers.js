/**
 * KGEN Enterprise Authentication Providers
 * Comprehensive authentication system supporting OAuth, SAML, LDAP, and SSO
 */

import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import { Strategy as SAMLStrategy } from 'passport-saml';
import { Strategy as BearerStrategy } from 'passport-http-bearer';
import ldap from 'ldapjs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { EventEmitter } from 'events';

// Authentication providers
export const AUTH_PROVIDERS = {
    LOCAL: 'local',
    OAUTH2: 'oauth2',
    SAML: 'saml',
    LDAP: 'ldap',
    OPENID: 'openid',
    AZURE_AD: 'azure-ad',
    GOOGLE: 'google',
    GITHUB: 'github',
    OKTA: 'okta',
    API_KEY: 'api-key'
};

// User roles and permissions
export const USER_ROLES = {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    DEVELOPER: 'developer',
    ANALYST: 'analyst',
    VIEWER: 'viewer',
    GUEST: 'guest'
};

export const PERMISSIONS = {
    // Graph permissions
    GRAPH_CREATE: 'graph:create',
    GRAPH_READ: 'graph:read',
    GRAPH_UPDATE: 'graph:update',
    GRAPH_DELETE: 'graph:delete',
    
    // Template permissions
    TEMPLATE_CREATE: 'template:create',
    TEMPLATE_READ: 'template:read',
    TEMPLATE_UPDATE: 'template:update',
    TEMPLATE_DELETE: 'template:delete',
    
    // Job permissions
    JOB_CREATE: 'job:create',
    JOB_READ: 'job:read',
    JOB_CANCEL: 'job:cancel',
    
    // Webhook permissions
    WEBHOOK_CREATE: 'webhook:create',
    WEBHOOK_READ: 'webhook:read',
    WEBHOOK_UPDATE: 'webhook:update',
    WEBHOOK_DELETE: 'webhook:delete',
    WEBHOOK_TEST: 'webhook:test',
    
    // Integration permissions
    INTEGRATION_CREATE: 'integration:create',
    INTEGRATION_READ: 'integration:read',
    INTEGRATION_UPDATE: 'integration:update',
    INTEGRATION_DELETE: 'integration:delete',
    INTEGRATION_SYNC: 'integration:sync',
    
    // ETL permissions
    ETL_CREATE: 'etl:create',
    ETL_READ: 'etl:read',
    ETL_UPDATE: 'etl:update',
    ETL_DELETE: 'etl:delete',
    ETL_EXECUTE: 'etl:execute',
    
    // Admin permissions
    USER_MANAGE: 'user:manage',
    SYSTEM_CONFIG: 'system:config',
    METRICS_READ: 'metrics:read',
    AUDIT_READ: 'audit:read'
};

// Role-based permissions mapping
export const ROLE_PERMISSIONS = {
    [USER_ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
    [USER_ROLES.ADMIN]: [
        ...Object.values(PERMISSIONS).filter(p => !p.includes('system:')),
        PERMISSIONS.USER_MANAGE,
        PERMISSIONS.METRICS_READ,
        PERMISSIONS.AUDIT_READ
    ],
    [USER_ROLES.DEVELOPER]: [
        PERMISSIONS.GRAPH_CREATE, PERMISSIONS.GRAPH_READ, PERMISSIONS.GRAPH_UPDATE,
        PERMISSIONS.TEMPLATE_CREATE, PERMISSIONS.TEMPLATE_READ, PERMISSIONS.TEMPLATE_UPDATE,
        PERMISSIONS.JOB_CREATE, PERMISSIONS.JOB_READ, PERMISSIONS.JOB_CANCEL,
        PERMISSIONS.WEBHOOK_CREATE, PERMISSIONS.WEBHOOK_READ, PERMISSIONS.WEBHOOK_UPDATE,
        PERMISSIONS.INTEGRATION_CREATE, PERMISSIONS.INTEGRATION_READ, PERMISSIONS.INTEGRATION_SYNC,
        PERMISSIONS.ETL_CREATE, PERMISSIONS.ETL_READ, PERMISSIONS.ETL_UPDATE, PERMISSIONS.ETL_EXECUTE
    ],
    [USER_ROLES.ANALYST]: [
        PERMISSIONS.GRAPH_READ, PERMISSIONS.TEMPLATE_READ,
        PERMISSIONS.JOB_CREATE, PERMISSIONS.JOB_READ,
        PERMISSIONS.INTEGRATION_READ, PERMISSIONS.INTEGRATION_SYNC,
        PERMISSIONS.ETL_READ, PERMISSIONS.ETL_EXECUTE,
        PERMISSIONS.METRICS_READ
    ],
    [USER_ROLES.VIEWER]: [
        PERMISSIONS.GRAPH_READ, PERMISSIONS.TEMPLATE_READ,
        PERMISSIONS.JOB_READ, PERMISSIONS.INTEGRATION_READ,
        PERMISSIONS.ETL_READ, PERMISSIONS.METRICS_READ
    ],
    [USER_ROLES.GUEST]: [
        PERMISSIONS.GRAPH_READ, PERMISSIONS.TEMPLATE_READ
    ]
};

/**
 * Base Authentication Provider
 */
export class BaseAuthProvider extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.name = config.name || 'unknown';
        this.enabled = config.enabled !== false;
    }

    async authenticate(credentials) {
        throw new Error('authenticate() method must be implemented by provider');
    }

    async refreshToken(refreshToken) {
        throw new Error('refreshToken() method must be implemented by provider');
    }

    async revokeToken(token) {
        // Optional implementation
        return true;
    }

    async getUserInfo(token) {
        throw new Error('getUserInfo() method must be implemented by provider');
    }

    generateTokens(user) {
        const accessToken = jwt.sign(
            {
                sub: user.id,
                email: user.email,
                roles: user.roles,
                permissions: this.getUserPermissions(user),
                provider: this.name
            },
            this.config.jwtSecret,
            {
                expiresIn: this.config.accessTokenTTL || '1h',
                issuer: 'kgen-enterprise',
                audience: 'kgen-api'
            }
        );

        const refreshToken = jwt.sign(
            {
                sub: user.id,
                type: 'refresh'
            },
            this.config.jwtSecret,
            {
                expiresIn: this.config.refreshTokenTTL || '7d',
                issuer: 'kgen-enterprise'
            }
        );

        return {
            accessToken,
            refreshToken,
            tokenType: 'Bearer',
            expiresIn: this.parseTokenTTL(this.config.accessTokenTTL || '1h')
        };
    }

    getUserPermissions(user) {
        const permissions = new Set();
        
        for (const role of user.roles || []) {
            const rolePermissions = ROLE_PERMISSIONS[role] || [];
            rolePermissions.forEach(permission => permissions.add(permission));
        }
        
        // Add custom permissions
        if (user.permissions) {
            user.permissions.forEach(permission => permissions.add(permission));
        }
        
        return Array.from(permissions);
    }

    parseTokenTTL(ttl) {
        if (typeof ttl === 'number') return ttl;
        
        const units = { s: 1, m: 60, h: 3600, d: 86400 };
        const match = ttl.match(/^(\d+)([smhd])$/);
        
        if (match) {
            return parseInt(match[1]) * units[match[2]];
        }
        
        return 3600; // Default 1 hour
    }

    validateConfig(requiredFields = []) {
        for (const field of requiredFields) {
            if (!this.config[field]) {
                throw new Error(`Configuration field '${field}' is required for ${this.name} provider`);
            }
        }
    }
}

/**
 * Local Authentication Provider
 */
export class LocalAuthProvider extends BaseAuthProvider {
    constructor(config) {
        super({ ...config, name: 'local' });
        this.users = new Map(); // In production, use database
        this.setupDefaultUsers();
    }

    setupDefaultUsers() {
        // Create default admin user if configured
        if (this.config.createDefaultAdmin) {
            this.createUser({
                id: 'admin',
                email: 'admin@kgen.local',
                password: this.config.defaultAdminPassword || 'admin123',
                roles: [USER_ROLES.SUPER_ADMIN],
                name: 'System Administrator',
                active: true,
                createdAt: this.getDeterministicDate().toISOString()
            });
        }
    }

    async authenticate(credentials) {
        const { email, password } = credentials;
        
        const user = this.findUserByEmail(email);
        if (!user) {
            throw new Error('Invalid credentials');
        }

        if (!user.active) {
            throw new Error('Account is deactivated');
        }

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) {
            throw new Error('Invalid credentials');
        }

        // Update last login
        user.lastLogin = this.getDeterministicDate().toISOString();
        
        this.emit('user:login', { userId: user.id, provider: 'local' });
        
        return {
            user: this.sanitizeUser(user),
            tokens: this.generateTokens(user)
        };
    }

    async refreshToken(refreshToken) {
        try {
            const payload = jwt.verify(refreshToken, this.config.jwtSecret);
            
            if (payload.type !== 'refresh') {
                throw new Error('Invalid refresh token');
            }

            const user = this.findUserById(payload.sub);
            if (!user || !user.active) {
                throw new Error('User not found or inactive');
            }

            return {
                user: this.sanitizeUser(user),
                tokens: this.generateTokens(user)
            };

        } catch (error) {
            throw new Error('Invalid refresh token');
        }
    }

    async createUser(userData) {
        const { password, ...userInfo } = userData;
        
        if (this.findUserByEmail(userInfo.email)) {
            throw new Error('User with this email already exists');
        }

        const passwordHash = await bcrypt.hash(password, 12);
        
        const user = {
            ...userInfo,
            id: userInfo.id || crypto.randomUUID(),
            passwordHash,
            createdAt: userInfo.createdAt || this.getDeterministicDate().toISOString(),
            active: userInfo.active !== false
        };

        this.users.set(user.id, user);
        
        this.emit('user:created', { userId: user.id });
        
        return this.sanitizeUser(user);
    }

    async updateUser(userId, updates) {
        const user = this.findUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        if (updates.password) {
            updates.passwordHash = await bcrypt.hash(updates.password, 12);
            delete updates.password;
        }

        Object.assign(user, {
            ...updates,
            updatedAt: this.getDeterministicDate().toISOString()
        });

        this.emit('user:updated', { userId });
        
        return this.sanitizeUser(user);
    }

    findUserByEmail(email) {
        return Array.from(this.users.values()).find(user => user.email === email);
    }

    findUserById(id) {
        return this.users.get(id);
    }

    sanitizeUser(user) {
        const { passwordHash, ...sanitized } = user;
        return sanitized;
    }

    async getUserInfo(token) {
        try {
            const payload = jwt.verify(token, this.config.jwtSecret);
            const user = this.findUserById(payload.sub);
            
            if (!user) {
                throw new Error('User not found');
            }
            
            return this.sanitizeUser(user);
            
        } catch (error) {
            throw new Error('Invalid token');
        }
    }
}

/**
 * OAuth2 Authentication Provider
 */
export class OAuth2AuthProvider extends BaseAuthProvider {
    constructor(config) {
        super({ ...config, name: config.name || 'oauth2' });
        
        this.validateConfig([
            'clientId',
            'clientSecret',
            'authorizationURL',
            'tokenURL'
        ]);

        this.strategy = new OAuth2Strategy({
            clientID: this.config.clientId,
            clientSecret: this.config.clientSecret,
            authorizationURL: this.config.authorizationURL,
            tokenURL: this.config.tokenURL,
            callbackURL: this.config.callbackURL,
            scope: this.config.scope || ['openid', 'profile', 'email']
        }, this.verifyCallback.bind(this));
    }

    async verifyCallback(accessToken, refreshToken, profile, done) {
        try {
            // Get user info from OAuth provider
            const userInfo = await this.fetchUserProfile(accessToken);
            
            // Map OAuth user to local user format
            const user = await this.mapOAuthUser(userInfo, accessToken, refreshToken);
            
            this.emit('user:oauth_login', { 
                userId: user.id, 
                provider: this.name,
                oauthProvider: this.config.providerName 
            });
            
            done(null, {
                user: this.sanitizeUser(user),
                tokens: this.generateTokens(user)
            });
            
        } catch (error) {
            done(error);
        }
    }

    async fetchUserProfile(accessToken) {
        const axios = require('axios');
        
        const response = await axios.get(this.config.userInfoURL, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });
        
        return response.data;
    }

    async mapOAuthUser(oauthUser, accessToken, refreshToken) {
        // This would typically involve database operations
        const user = {
            id: `oauth_${this.name}_${oauthUser.id || oauthUser.sub}`,
            email: oauthUser.email,
            name: oauthUser.name || `${oauthUser.first_name} ${oauthUser.last_name}`,
            avatar: oauthUser.picture || oauthUser.avatar_url,
            roles: this.determineUserRoles(oauthUser),
            provider: this.name,
            oauthId: oauthUser.id || oauthUser.sub,
            oauthProfile: oauthUser,
            lastLogin: this.getDeterministicDate().toISOString(),
            active: true
        };

        return user;
    }

    determineUserRoles(oauthUser) {
        // Default role assignment logic
        if (this.config.adminEmails && this.config.adminEmails.includes(oauthUser.email)) {
            return [USER_ROLES.ADMIN];
        }
        
        if (this.config.developerDomains) {
            const emailDomain = oauthUser.email.split('@')[1];
            if (this.config.developerDomains.includes(emailDomain)) {
                return [USER_ROLES.DEVELOPER];
            }
        }
        
        return [USER_ROLES.VIEWER];
    }

    sanitizeUser(user) {
        const { oauthProfile, ...sanitized } = user;
        return sanitized;
    }

    getAuthorizationURL(state) {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.callbackURL,
            response_type: 'code',
            scope: Array.isArray(this.config.scope) ? this.config.scope.join(' ') : this.config.scope,
            state: state || crypto.randomUUID()
        });

        return `${this.config.authorizationURL}?${params.toString()}`;
    }

    async exchangeCodeForToken(code, state) {
        const axios = require('axios');
        
        const response = await axios.post(this.config.tokenURL, {
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: this.config.callbackURL
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            }
        });

        return response.data;
    }
}

/**
 * SAML Authentication Provider
 */
export class SAMLAuthProvider extends BaseAuthProvider {
    constructor(config) {
        super({ ...config, name: 'saml' });
        
        this.validateConfig([
            'entryPoint',
            'issuer',
            'cert'
        ]);

        this.strategy = new SAMLStrategy({
            entryPoint: this.config.entryPoint,
            issuer: this.config.issuer,
            cert: this.config.cert,
            callbackUrl: this.config.callbackURL,
            identifierFormat: this.config.identifierFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'
        }, this.verifyCallback.bind(this));
    }

    async verifyCallback(profile, done) {
        try {
            const user = await this.mapSAMLUser(profile);
            
            this.emit('user:saml_login', { 
                userId: user.id, 
                provider: 'saml',
                nameId: profile.nameID 
            });
            
            done(null, {
                user: this.sanitizeUser(user),
                tokens: this.generateTokens(user)
            });
            
        } catch (error) {
            done(error);
        }
    }

    async mapSAMLUser(samlProfile) {
        const user = {
            id: `saml_${Buffer.from(samlProfile.nameID).toString('base64')}`,
            email: samlProfile.nameID,
            name: samlProfile.displayName || 
                  `${samlProfile.firstName || ''} ${samlProfile.lastName || ''}`.trim(),
            roles: this.mapSAMLRoles(samlProfile.roles || []),
            provider: 'saml',
            samlNameId: samlProfile.nameID,
            samlAttributes: samlProfile,
            lastLogin: this.getDeterministicDate().toISOString(),
            active: true
        };

        return user;
    }

    mapSAMLRoles(samlRoles) {
        const roleMapping = this.config.roleMapping || {
            'Admin': USER_ROLES.ADMIN,
            'Developer': USER_ROLES.DEVELOPER,
            'Analyst': USER_ROLES.ANALYST,
            'User': USER_ROLES.VIEWER
        };

        const mappedRoles = samlRoles
            .map(role => roleMapping[role])
            .filter(role => role);

        return mappedRoles.length > 0 ? mappedRoles : [USER_ROLES.VIEWER];
    }

    sanitizeUser(user) {
        const { samlAttributes, ...sanitized } = user;
        return sanitized;
    }

    generateLogoutURL(nameId, sessionIndex) {
        const params = new URLSearchParams({
            SAMLRequest: this.generateLogoutRequest(nameId, sessionIndex)
        });

        return `${this.config.singleLogoutService}?${params.toString()}`;
    }

    generateLogoutRequest(nameId, sessionIndex) {
        // This would generate a proper SAML logout request
        // For simplicity, returning a placeholder
        return Buffer.from(`logout_${nameId}_${sessionIndex}`).toString('base64');
    }
}

/**
 * LDAP Authentication Provider
 */
export class LDAPAuthProvider extends BaseAuthProvider {
    constructor(config) {
        super({ ...config, name: 'ldap' });
        
        this.validateConfig([
            'url',
            'bindDN',
            'bindCredentials',
            'searchBase',
            'searchFilter'
        ]);

        this.client = null;
    }

    async authenticate(credentials) {
        const { username, password } = credentials;
        
        try {
            // Create LDAP client
            this.client = ldap.createClient({
                url: this.config.url,
                timeout: this.config.timeout || 10000,
                connectTimeout: this.config.connectTimeout || 10000
            });

            // Bind with service account
            await this.bindClient();

            // Search for user
            const userDN = await this.findUserDN(username);
            if (!userDN) {
                throw new Error('User not found in LDAP directory');
            }

            // Authenticate user
            await this.authenticateUser(userDN, password);

            // Get user details
            const userDetails = await this.getUserDetails(userDN);
            
            const user = this.mapLDAPUser(userDetails);
            
            this.emit('user:ldap_login', { 
                userId: user.id, 
                provider: 'ldap',
                dn: userDN 
            });

            return {
                user: this.sanitizeUser(user),
                tokens: this.generateTokens(user)
            };

        } finally {
            if (this.client) {
                this.client.unbind();
            }
        }
    }

    async bindClient() {
        return new Promise((resolve, reject) => {
            this.client.bind(this.config.bindDN, this.config.bindCredentials, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async findUserDN(username) {
        return new Promise((resolve, reject) => {
            const searchFilter = this.config.searchFilter.replace('{{username}}', username);
            
            this.client.search(this.config.searchBase, {
                filter: searchFilter,
                scope: 'sub',
                attributes: ['dn']
            }, (err, res) => {
                if (err) {
                    reject(err);
                    return;
                }

                let found = false;
                res.on('searchEntry', (entry) => {
                    if (!found) {
                        found = true;
                        resolve(entry.dn);
                    }
                });

                res.on('end', () => {
                    if (!found) {
                        resolve(null);
                    }
                });

                res.on('error', reject);
            });
        });
    }

    async authenticateUser(userDN, password) {
        return new Promise((resolve, reject) => {
            const testClient = ldap.createClient({ url: this.config.url });
            
            testClient.bind(userDN, password, (err) => {
                testClient.unbind();
                if (err) reject(new Error('Invalid credentials'));
                else resolve();
            });
        });
    }

    async getUserDetails(userDN) {
        return new Promise((resolve, reject) => {
            const attributes = this.config.attributes || [
                'cn', 'mail', 'displayName', 'memberOf', 'department', 'title'
            ];

            this.client.search(userDN, {
                scope: 'base',
                attributes
            }, (err, res) => {
                if (err) {
                    reject(err);
                    return;
                }

                res.on('searchEntry', (entry) => {
                    resolve(entry.object);
                });

                res.on('error', reject);
                res.on('end', () => resolve(null));
            });
        });
    }

    mapLDAPUser(ldapUser) {
        const user = {
            id: `ldap_${Buffer.from(ldapUser.dn).toString('base64')}`,
            email: ldapUser.mail || ldapUser.email,
            name: ldapUser.displayName || ldapUser.cn,
            department: ldapUser.department,
            title: ldapUser.title,
            roles: this.mapLDAPGroups(ldapUser.memberOf || []),
            provider: 'ldap',
            ldapDN: ldapUser.dn,
            lastLogin: this.getDeterministicDate().toISOString(),
            active: true
        };

        return user;
    }

    mapLDAPGroups(memberOf) {
        const groupMapping = this.config.groupMapping || {
            'cn=Admins': USER_ROLES.ADMIN,
            'cn=Developers': USER_ROLES.DEVELOPER,
            'cn=Analysts': USER_ROLES.ANALYST,
            'cn=Users': USER_ROLES.VIEWER
        };

        const groups = Array.isArray(memberOf) ? memberOf : [memberOf];
        const mappedRoles = groups
            .map(group => {
                for (const [ldapGroup, role] of Object.entries(groupMapping)) {
                    if (group.includes(ldapGroup)) {
                        return role;
                    }
                }
                return null;
            })
            .filter(role => role);

        return mappedRoles.length > 0 ? mappedRoles : [USER_ROLES.VIEWER];
    }

    sanitizeUser(user) {
        const { ldapDN, ...sanitized } = user;
        return sanitized;
    }
}

/**
 * API Key Authentication Provider
 */
export class APIKeyAuthProvider extends BaseAuthProvider {
    constructor(config) {
        super({ ...config, name: 'api-key' });
        this.apiKeys = new Map(); // In production, use database
    }

    async authenticate(credentials) {
        const { apiKey } = credentials;
        
        const keyData = this.apiKeys.get(apiKey);
        if (!keyData) {
            throw new Error('Invalid API key');
        }

        if (!keyData.active) {
            throw new Error('API key is deactivated');
        }

        if (keyData.expiresAt && this.getDeterministicDate() > new Date(keyData.expiresAt)) {
            throw new Error('API key has expired');
        }

        // Update last used
        keyData.lastUsed = this.getDeterministicDate().toISOString();
        keyData.usageCount = (keyData.usageCount || 0) + 1;

        const user = this.mapAPIKeyToUser(keyData);
        
        this.emit('user:apikey_auth', { 
            userId: user.id, 
            provider: 'api-key',
            keyId: keyData.id 
        });

        return {
            user: this.sanitizeUser(user),
            tokens: { accessToken: apiKey, tokenType: 'API-Key' }
        };
    }

    async createAPIKey(keyData) {
        const apiKey = keyData.key || this.generateAPIKey();
        
        const keyInfo = {
            id: keyData.id || crypto.randomUUID(),
            key: apiKey,
            name: keyData.name,
            userId: keyData.userId,
            roles: keyData.roles || [USER_ROLES.VIEWER],
            permissions: keyData.permissions || [],
            scopes: keyData.scopes || ['api:access'],
            active: keyData.active !== false,
            expiresAt: keyData.expiresAt,
            createdAt: this.getDeterministicDate().toISOString(),
            usageCount: 0,
            metadata: keyData.metadata || {}
        };

        this.apiKeys.set(apiKey, keyInfo);
        
        this.emit('apikey:created', { keyId: keyInfo.id, userId: keyInfo.userId });
        
        return {
            ...keyInfo,
            key: keyData.showKey !== false ? apiKey : '***' // Mask key unless explicitly requested
        };
    }

    async revokeAPIKey(apiKey) {
        const keyData = this.apiKeys.get(apiKey);
        if (keyData) {
            keyData.active = false;
            keyData.revokedAt = this.getDeterministicDate().toISOString();
            
            this.emit('apikey:revoked', { keyId: keyData.id });
            return true;
        }
        return false;
    }

    generateAPIKey() {
        const prefix = 'kgen';
        const randomBytes = crypto.randomBytes(32).toString('base64')
            .replace(/[+/=]/g, '')
            .substring(0, 40);
        
        return `${prefix}_${randomBytes}`;
    }

    mapAPIKeyToUser(keyData) {
        return {
            id: `apikey_${keyData.id}`,
            email: `apikey+${keyData.id}@kgen.local`,
            name: keyData.name || 'API Key User',
            roles: keyData.roles,
            permissions: keyData.permissions,
            provider: 'api-key',
            apiKeyId: keyData.id,
            scopes: keyData.scopes,
            active: keyData.active
        };
    }

    sanitizeUser(user) {
        const { apiKeyId, ...sanitized } = user;
        return sanitized;
    }
}

/**
 * Authentication Manager
 */
export class AuthenticationManager extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            defaultProvider: 'local',
            multiFactorAuth: false,
            sessionTimeout: '24h',
            passwordPolicy: {
                minLength: 8,
                requireUppercase: true,
                requireLowercase: true,
                requireNumbers: true,
                requireSpecialChars: false
            },
            ...config
        };

        this.providers = new Map();
        this.sessions = new Map();
        
        this.setupPassportStrategies();
    }

    setupPassportStrategies() {
        // JWT Strategy for token validation
        passport.use(new JwtStrategy({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: this.config.jwtSecret,
            issuer: 'kgen-enterprise',
            audience: 'kgen-api'
        }, async (payload, done) => {
            try {
                const provider = this.getProvider(payload.provider);
                const user = await provider.getUserInfo(payload.sub);
                done(null, user);
            } catch (error) {
                done(error, null);
            }
        }));

        // Bearer Strategy for API keys
        passport.use(new BearerStrategy(async (token, done) => {
            try {
                // Try API key authentication
                const apiKeyProvider = this.getProvider('api-key');
                if (apiKeyProvider) {
                    const result = await apiKeyProvider.authenticate({ apiKey: token });
                    done(null, result.user);
                } else {
                    done(null, false);
                }
            } catch (error) {
                done(error, null);
            }
        }));
    }

    registerProvider(name, provider) {
        this.providers.set(name, provider);
        
        // Forward provider events
        provider.on('user:login', (data) => this.emit('user:authenticated', { ...data, provider: name }));
        provider.on('user:oauth_login', (data) => this.emit('user:authenticated', data));
        provider.on('user:saml_login', (data) => this.emit('user:authenticated', data));
        provider.on('user:ldap_login', (data) => this.emit('user:authenticated', data));
        provider.on('user:apikey_auth', (data) => this.emit('user:authenticated', data));
        
        console.log(`Registered authentication provider: ${name}`);
    }

    getProvider(name) {
        return this.providers.get(name);
    }

    async authenticate(providerName, credentials) {
        const provider = this.getProvider(providerName);
        if (!provider) {
            throw new Error(`Authentication provider '${providerName}' not found`);
        }

        if (!provider.enabled) {
            throw new Error(`Authentication provider '${providerName}' is disabled`);
        }

        return await provider.authenticate(credentials);
    }

    async refreshToken(refreshToken) {
        try {
            const payload = jwt.verify(refreshToken, this.config.jwtSecret);
            const provider = this.getProvider(payload.provider || 'local');
            
            if (!provider) {
                throw new Error('Provider not found');
            }

            return await provider.refreshToken(refreshToken);
            
        } catch (error) {
            throw new Error('Invalid refresh token');
        }
    }

    async validateToken(token) {
        return new Promise((resolve, reject) => {
            passport.authenticate('jwt', { session: false }, (err, user, info) => {
                if (err) reject(err);
                else if (user) resolve(user);
                else reject(new Error(info?.message || 'Invalid token'));
            })({ headers: { authorization: `Bearer ${token}` } });
        });
    }

    async validateAPIKey(apiKey) {
        return new Promise((resolve, reject) => {
            passport.authenticate('bearer', { session: false }, (err, user, info) => {
                if (err) reject(err);
                else if (user) resolve(user);
                else reject(new Error(info?.message || 'Invalid API key'));
            })({ headers: { authorization: `Bearer ${apiKey}` } });
        });
    }

    hasPermission(user, permission) {
        return user.permissions && user.permissions.includes(permission);
    }

    hasRole(user, role) {
        return user.roles && user.roles.includes(role);
    }

    hasAnyPermission(user, permissions) {
        return permissions.some(permission => this.hasPermission(user, permission));
    }

    hasAnyRole(user, roles) {
        return roles.some(role => this.hasRole(user, role));
    }

    getProviderConfig(providerName) {
        const provider = this.getProvider(providerName);
        return provider ? {
            name: provider.name,
            enabled: provider.enabled,
            type: provider.constructor.name
        } : null;
    }

    getAllProviders() {
        return Array.from(this.providers.keys()).map(name => 
            this.getProviderConfig(name)
        );
    }

    async createSession(user, metadata = {}) {
        const sessionId = crypto.randomUUID();
        const session = {
            id: sessionId,
            userId: user.id,
            user,
            createdAt: this.getDeterministicDate().toISOString(),
            lastActivity: this.getDeterministicDate().toISOString(),
            metadata: {
                userAgent: metadata.userAgent,
                ipAddress: metadata.ipAddress,
                ...metadata
            }
        };

        this.sessions.set(sessionId, session);
        
        this.emit('session:created', { sessionId, userId: user.id });
        
        return session;
    }

    async getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    async destroySession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            this.sessions.delete(sessionId);
            this.emit('session:destroyed', { sessionId, userId: session.userId });
            return true;
        }
        return false;
    }

    async cleanup() {
        // Clean up expired sessions and tokens
        const now = this.getDeterministicDate();
        const sessionTimeout = this.parseTimeout(this.config.sessionTimeout);
        
        for (const [sessionId, session] of this.sessions) {
            const lastActivity = new Date(session.lastActivity);
            if (now - lastActivity > sessionTimeout) {
                this.destroySession(sessionId);
            }
        }
    }

    parseTimeout(timeout) {
        if (typeof timeout === 'number') return timeout;
        
        const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
        const match = timeout.match(/^(\d+)([smhd])$/);
        
        if (match) {
            return parseInt(match[1]) * units[match[2]];
        }
        
        return 86400000; // Default 24 hours
    }
}

export default {
    BaseAuthProvider,
    LocalAuthProvider,
    OAuth2AuthProvider,
    SAMLAuthProvider,
    LDAPAuthProvider,
    APIKeyAuthProvider,
    AuthenticationManager,
    AUTH_PROVIDERS,
    USER_ROLES,
    PERMISSIONS,
    ROLE_PERMISSIONS
};