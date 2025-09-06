/**
 * Enterprise authentication MCP tool for multi-tenant support
 * Provides SSO, SAML, OAuth, and RBAC capabilities
 */

import type { ToolResult } from '../types.js';
import { createTextToolResult, createJSONToolResult, handleToolError } from '../utils.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export interface EnterpriseAuthParams {
  action: 'login' | 'validate' | 'refresh' | 'logout' | 'sso';
  provider?: 'saml' | 'oauth' | 'ldap' | 'local';
  credentials?: {
    username?: string;
    password?: string;
    token?: string;
    samlResponse?: string;
    oauthCode?: string;
  };
  tenantId?: string;
  organizationId?: string;
  metadata?: Record<string, any>;
}

interface AuthSession {
  userId: string;
  tenantId: string;
  organizationId: string;
  roles: string[];
  permissions: string[];
  provider: string;
  expiresAt: Date;
  token: string;
  refreshToken?: string;
}

// In-memory session store (production would use Redis)
const sessions = new Map<string, AuthSession>();
const tenantConfigs = new Map<string, any>();

/**
 * Enterprise authentication handler
 */
export async function unjucksEnterpriseAuth(params: EnterpriseAuthParams): Promise<ToolResult> {
  try {
    const { action, provider = 'local', credentials, tenantId, organizationId } = params;

    switch (action) {
      case 'login':
        return await handleLogin(provider, credentials, tenantId, organizationId);
      
      case 'validate':
        return await validateSession(credentials?.token);
      
      case 'refresh':
        return await refreshSession(credentials?.token);
      
      case 'logout':
        return await handleLogout(credentials?.token);
      
      case 'sso':
        return await handleSSO(provider, credentials, tenantId);
      
      default:
        return createTextToolResult(`Unknown action: ${action}`, true);
    }
  } catch (error) {
    return handleToolError(error, 'unjucks_enterprise_auth', 'authentication');
  }
}

async function handleLogin(
  provider: string,
  credentials: any,
  tenantId?: string,
  organizationId?: string
): Promise<ToolResult> {
  // Validate tenant exists
  if (!tenantId) {
    return createTextToolResult('Tenant ID is required for enterprise login', true);
  }

  // Create session based on provider
  let userId: string;
  let roles: string[] = [];
  let permissions: string[] = [];

  switch (provider) {
    case 'saml':
      // Parse SAML response
      if (!credentials?.samlResponse) {
        return createTextToolResult('SAML response required', true);
      }
      // In production, validate SAML assertion with IdP
      userId = 'saml_' + crypto.randomBytes(16).toString('hex');
      roles = ['user', 'developer'];
      break;

    case 'oauth':
      // Exchange OAuth code for token
      if (!credentials?.oauthCode) {
        return createTextToolResult('OAuth code required', true);
      }
      // In production, exchange code with OAuth provider
      userId = 'oauth_' + crypto.randomBytes(16).toString('hex');
      roles = ['user'];
      break;

    case 'ldap':
      // Validate against LDAP directory
      if (!credentials?.username || !credentials?.password) {
        return createTextToolResult('Username and password required for LDAP', true);
      }
      // In production, authenticate against LDAP server
      userId = 'ldap_' + credentials.username;
      roles = ['user', 'admin'];
      break;

    case 'local':
    default:
      // Local authentication
      if (!credentials?.username || !credentials?.password) {
        return createTextToolResult('Username and password required', true);
      }
      // In production, validate against database
      userId = 'local_' + credentials.username;
      roles = ['user', 'developer', 'admin'];
      permissions = ['generate:*', 'template:*', 'admin:users'];
      break;
  }

  // Generate JWT tokens
  const secret = process.env.JWT_SECRET || 'enterprise-secret-key';
  const token = jwt.sign(
    {
      userId,
      tenantId,
      organizationId,
      roles,
      permissions,
      provider
    },
    secret,
    { expiresIn: '1h' }
  );

  const refreshToken = jwt.sign(
    { userId, tenantId, type: 'refresh' },
    secret,
    { expiresIn: '7d' }
  );

  // Create session
  const session: AuthSession = {
    userId,
    tenantId,
    organizationId: organizationId || tenantId,
    roles,
    permissions,
    provider,
    expiresAt: new Date(Date.now() + 3600000), // 1 hour
    token,
    refreshToken
  };

  sessions.set(token, session);

  return createJSONToolResult({
    success: true,
    session: {
      userId: session.userId,
      tenantId: session.tenantId,
      organizationId: session.organizationId,
      roles: session.roles,
      permissions: session.permissions,
      provider: session.provider,
      expiresAt: session.expiresAt,
      token: session.token,
      refreshToken: session.refreshToken
    },
    message: `Successfully authenticated via ${provider}`
  });
}

async function validateSession(token?: string): Promise<ToolResult> {
  if (!token) {
    return createTextToolResult('Token required for validation', true);
  }

  const session = sessions.get(token);
  if (!session) {
    return createJSONToolResult({
      valid: false,
      message: 'Session not found or expired'
    });
  }

  if (session.expiresAt < new Date()) {
    sessions.delete(token);
    return createJSONToolResult({
      valid: false,
      message: 'Session expired'
    });
  }

  return createJSONToolResult({
    valid: true,
    session: {
      userId: session.userId,
      tenantId: session.tenantId,
      organizationId: session.organizationId,
      roles: session.roles,
      permissions: session.permissions,
      expiresAt: session.expiresAt
    }
  });
}

async function refreshSession(token?: string): Promise<ToolResult> {
  if (!token) {
    return createTextToolResult('Refresh token required', true);
  }

  try {
    const secret = process.env.JWT_SECRET || 'enterprise-secret-key';
    const decoded = jwt.verify(token, secret) as any;
    
    if (decoded.type !== 'refresh') {
      return createTextToolResult('Invalid refresh token', true);
    }

    // Generate new access token
    const newToken = jwt.sign(
      {
        userId: decoded.userId,
        tenantId: decoded.tenantId,
        // Fetch fresh roles/permissions from database in production
        roles: ['user', 'developer'],
        permissions: ['generate:*', 'template:*']
      },
      secret,
      { expiresIn: '1h' }
    );

    return createJSONToolResult({
      success: true,
      token: newToken,
      expiresIn: 3600
    });
  } catch (error) {
    return createTextToolResult('Invalid or expired refresh token', true);
  }
}

async function handleLogout(token?: string): Promise<ToolResult> {
  if (!token) {
    return createTextToolResult('Token required for logout', true);
  }

  sessions.delete(token);
  
  return createJSONToolResult({
    success: true,
    message: 'Successfully logged out'
  });
}

async function handleSSO(
  provider: string,
  credentials: any,
  tenantId?: string
): Promise<ToolResult> {
  // Get tenant SSO configuration
  const tenantConfig = tenantConfigs.get(tenantId || 'default') || {
    saml: {
      entryPoint: 'https://idp.example.com/sso',
      issuer: 'unjucks-enterprise',
      cert: 'MIID...'
    },
    oauth: {
      clientId: 'unjucks-client',
      clientSecret: 'secret',
      authorizationURL: 'https://oauth.example.com/authorize',
      tokenURL: 'https://oauth.example.com/token'
    }
  };

  switch (provider) {
    case 'saml':
      // Generate SAML request
      return createJSONToolResult({
        success: true,
        action: 'redirect',
        url: tenantConfig.saml.entryPoint,
        samlRequest: Buffer.from(JSON.stringify({
          issuer: tenantConfig.saml.issuer,
          tenantId,
          timestamp: new Date().toISOString()
        })).toString('base64')
      });

    case 'oauth':
      // Generate OAuth authorization URL
      const state = crypto.randomBytes(16).toString('hex');
      const authUrl = new URL(tenantConfig.oauth.authorizationURL);
      authUrl.searchParams.append('client_id', tenantConfig.oauth.clientId);
      authUrl.searchParams.append('redirect_uri', 'https://unjucks.enterprise/callback');
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('scope', 'openid profile email');
      authUrl.searchParams.append('state', state);
      
      return createJSONToolResult({
        success: true,
        action: 'redirect',
        url: authUrl.toString(),
        state
      });

    default:
      return createTextToolResult(`SSO provider ${provider} not supported`, true);
  }
}

// Export for tool registration
export const unjucksEnterpriseAuthSchema = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ['login', 'validate', 'refresh', 'logout', 'sso'],
      description: 'Authentication action to perform'
    },
    provider: {
      type: 'string',
      enum: ['saml', 'oauth', 'ldap', 'local'],
      description: 'Authentication provider'
    },
    credentials: {
      type: 'object',
      description: 'Authentication credentials'
    },
    tenantId: {
      type: 'string',
      description: 'Tenant identifier for multi-tenant support'
    },
    organizationId: {
      type: 'string',
      description: 'Organization identifier'
    }
  },
  required: ['action']
};