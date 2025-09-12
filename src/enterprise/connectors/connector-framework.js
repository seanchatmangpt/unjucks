/**
 * KGEN Enterprise Connector Framework
 * Extensible framework for integrating with external enterprise systems
 */

import { EventEmitter } from 'events';
import axios from 'axios';
import { OAuth2Strategy } from 'passport-oauth2';
import { BasicStrategy } from 'passport-http';
import crypto from 'crypto';

// Base connector class
export class BaseConnector extends EventEmitter {
    constructor(config) {
        super();
        
        this.config = {
            retryAttempts: 3,
            timeout: 30000,
            rateLimit: {
                requests: 100,
                window: 60000 // 1 minute
            },
            ...config
        };
        
        this.authenticated = false;
        this.credentials = null;
        this.rateLimiter = new Map();
        
        this.setupAxiosDefaults();
    }

    setupAxiosDefaults() {
        this.httpClient = axios.create({
            timeout: this.config.timeout,
            headers: {
                'User-Agent': 'KGEN-Connector/1.0'
            }
        });

        // Request interceptor for authentication and rate limiting
        this.httpClient.interceptors.request.use(
            async (config) => {
                // Check rate limit
                await this.checkRateLimit();
                
                // Add authentication
                if (this.authenticated && this.credentials) {
                    config = await this.addAuthentication(config);
                }
                
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor for error handling and token refresh
        this.httpClient.interceptors.response.use(
            (response) => response,
            async (error) => {
                if (error.response?.status === 401 && this.canRefreshToken()) {
                    try {
                        await this.refreshToken();
                        return this.httpClient.request(error.config);
                    } catch (refreshError) {
                        this.emit('authentication:failed', refreshError);
                        throw refreshError;
                    }
                }
                throw error;
            }
        );
    }

    async connect(credentials) {
        throw new Error('connect() method must be implemented by connector');
    }

    async disconnect() {
        this.authenticated = false;
        this.credentials = null;
        this.emit('disconnected');
    }

    async testConnection() {
        throw new Error('testConnection() method must be implemented by connector');
    }

    async sync() {
        throw new Error('sync() method must be implemented by connector');
    }

    async addAuthentication(config) {
        // Override in specific connectors
        return config;
    }

    canRefreshToken() {
        return false; // Override in specific connectors
    }

    async refreshToken() {
        throw new Error('refreshToken() method must be implemented by connector');
    }

    async checkRateLimit() {
        const now = this.getDeterministicTimestamp();
        const windowStart = now - this.config.rateLimit.window;
        
        // Clean old requests
        const requests = this.rateLimiter.get('requests') || [];
        const validRequests = requests.filter(time => time > windowStart);
        
        if (validRequests.length >= this.config.rateLimit.requests) {
            const waitTime = requests[0] + this.config.rateLimit.window - now;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        validRequests.push(now);
        this.rateLimiter.set('requests', validRequests);
    }

    async retryOperation(operation, attempts = this.config.retryAttempts) {
        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                if (attempt === attempts) {
                    throw error;
                }
                
                const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, delay));
                
                this.emit('retry', { attempt, error: error.message });
            }
        }
    }

    validateConfig(requiredFields = []) {
        for (const field of requiredFields) {
            if (!this.config[field]) {
                throw new Error(`Configuration field '${field}' is required`);
            }
        }
    }

    encryptSensitiveData(data, key) {
        const cipher = crypto.createCipher('aes-256-cbc', key);
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }

    decryptSensitiveData(encryptedData, key) {
        const decipher = crypto.createDecipher('aes-256-cbc', key);
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    }
}

// Salesforce Connector
export class SalesforceConnector extends BaseConnector {
    constructor(config) {
        super({
            baseURL: 'https://login.salesforce.com',
            apiVersion: 'v58.0',
            ...config
        });

        this.validateConfig(['clientId', 'clientSecret']);
    }

    async connect(credentials) {
        const { username, password, securityToken } = credentials;
        
        try {
            const response = await this.httpClient.post('/services/oauth2/token', {
                grant_type: 'password',
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
                username,
                password: password + securityToken
            }, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            this.credentials = response.data;
            this.authenticated = true;
            
            // Update base URL to instance URL
            this.httpClient.defaults.baseURL = response.data.instance_url;
            
            this.emit('connected', { instanceUrl: response.data.instance_url });
            
            return {
                success: true,
                instanceUrl: response.data.instance_url,
                tokenType: response.data.token_type
            };
            
        } catch (error) {
            this.emit('connection:failed', error);
            throw new Error(`Salesforce connection failed: ${error.message}`);
        }
    }

    async addAuthentication(config) {
        if (this.credentials?.access_token) {
            config.headers.Authorization = `${this.credentials.token_type} ${this.credentials.access_token}`;
        }
        return config;
    }

    async testConnection() {
        try {
            const response = await this.httpClient.get(`/services/data/v${this.config.apiVersion}/sobjects/`);
            return {
                success: true,
                objectCount: Object.keys(response.data.sobjects).length
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getObjects(objectType = 'Account', limit = 10) {
        const response = await this.httpClient.get(
            `/services/data/v${this.config.apiVersion}/query/`,
            {
                params: {
                    q: `SELECT Id, Name FROM ${objectType} LIMIT ${limit}`
                }
            }
        );
        return response.data;
    }

    async createObject(objectType, data) {
        const response = await this.httpClient.post(
            `/services/data/v${this.config.apiVersion}/sobjects/${objectType}/`,
            data
        );
        return response.data;
    }

    async sync() {
        // Implement Salesforce-specific sync logic
        const objects = await this.getObjects('Account', 100);
        this.emit('sync:progress', { type: 'Account', count: objects.records.length });
        return { synced: objects.records.length };
    }
}

// HubSpot Connector
export class HubSpotConnector extends BaseConnector {
    constructor(config) {
        super({
            baseURL: 'https://api.hubapi.com',
            ...config
        });

        this.validateConfig(['apiKey']);
    }

    async connect(credentials) {
        this.credentials = { apiKey: credentials.apiKey };
        this.authenticated = true;
        
        // Test the connection
        const testResult = await this.testConnection();
        if (!testResult.success) {
            throw new Error('HubSpot API key validation failed');
        }
        
        this.emit('connected');
        return { success: true };
    }

    async addAuthentication(config) {
        if (this.credentials?.apiKey) {
            config.headers.Authorization = `Bearer ${this.credentials.apiKey}`;
        }
        return config;
    }

    async testConnection() {
        try {
            const response = await this.httpClient.get('/contacts/v1/lists/all/contacts/all');
            return { success: true, contactCount: response.data['has-more'] ? '1000+' : response.data.contacts.length };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getContacts(limit = 100) {
        const response = await this.httpClient.get('/contacts/v1/lists/all/contacts/all', {
            params: { count: limit }
        });
        return response.data;
    }

    async createContact(contactData) {
        const response = await this.httpClient.post('/contacts/v1/contact', {
            properties: contactData
        });
        return response.data;
    }

    async sync() {
        const contacts = await this.getContacts(100);
        this.emit('sync:progress', { type: 'Contact', count: contacts.contacts.length });
        return { synced: contacts.contacts.length };
    }
}

// GitHub Connector
export class GitHubConnector extends BaseConnector {
    constructor(config) {
        super({
            baseURL: 'https://api.github.com',
            ...config
        });
    }

    async connect(credentials) {
        if (credentials.personalAccessToken) {
            this.credentials = { token: credentials.personalAccessToken };
        } else if (credentials.oauth) {
            // Handle OAuth flow
            this.credentials = credentials.oauth;
        }
        
        this.authenticated = true;
        
        const testResult = await this.testConnection();
        if (!testResult.success) {
            throw new Error('GitHub authentication failed');
        }
        
        this.emit('connected');
        return { success: true };
    }

    async addAuthentication(config) {
        if (this.credentials?.token) {
            config.headers.Authorization = `token ${this.credentials.token}`;
        }
        return config;
    }

    async testConnection() {
        try {
            const response = await this.httpClient.get('/user');
            return { 
                success: true, 
                user: response.data.login,
                publicRepos: response.data.public_repos
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getRepositories(org, limit = 50) {
        const endpoint = org ? `/orgs/${org}/repos` : '/user/repos';
        const response = await this.httpClient.get(endpoint, {
            params: { per_page: limit, sort: 'updated' }
        });
        return response.data;
    }

    async createWebhook(owner, repo, webhookConfig) {
        const response = await this.httpClient.post(`/repos/${owner}/${repo}/hooks`, {
            name: 'web',
            active: true,
            events: webhookConfig.events || ['push'],
            config: {
                url: webhookConfig.url,
                content_type: 'json',
                secret: webhookConfig.secret
            }
        });
        return response.data;
    }

    async sync() {
        const repos = await this.getRepositories(null, 100);
        this.emit('sync:progress', { type: 'Repository', count: repos.length });
        return { synced: repos.length };
    }
}

// SAP Connector (Basic implementation)
export class SAPConnector extends BaseConnector {
    constructor(config) {
        super({
            protocol: 'http',
            host: config.host,
            port: config.port || 8000,
            client: config.client || '100',
            ...config
        });

        this.validateConfig(['host', 'username', 'password']);
    }

    async connect(credentials) {
        // SAP connection typically involves session management
        // This is a simplified implementation
        try {
            const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
            
            this.httpClient.defaults.headers.common['Authorization'] = `Basic ${auth}`;
            this.httpClient.defaults.baseURL = `${this.config.protocol}://${this.config.host}:${this.config.port}`;
            
            const testResult = await this.testConnection();
            if (!testResult.success) {
                throw new Error('SAP connection test failed');
            }
            
            this.authenticated = true;
            this.credentials = credentials;
            
            this.emit('connected');
            return { success: true };
            
        } catch (error) {
            this.emit('connection:failed', error);
            throw new Error(`SAP connection failed: ${error.message}`);
        }
    }

    async testConnection() {
        try {
            // Test with a simple system info call
            const response = await this.httpClient.get('/sap/bc/rest/system/info');
            return { success: true, systemInfo: response.data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async sync() {
        // Implement SAP-specific sync logic
        this.emit('sync:progress', { type: 'SAP Objects', count: 0 });
        return { synced: 0 };
    }
}

// Connector Factory
export class ConnectorFactory {
    static connectorTypes = {
        salesforce: SalesforceConnector,
        hubspot: HubSpotConnector,
        github: GitHubConnector,
        sap: SAPConnector
    };

    static create(type, config) {
        const ConnectorClass = this.connectorTypes[type.toLowerCase()];
        if (!ConnectorClass) {
            throw new Error(`Unsupported connector type: ${type}`);
        }
        return new ConnectorClass(config);
    }

    static getSupportedTypes() {
        return Object.keys(this.connectorTypes);
    }

    static register(type, connectorClass) {
        this.connectorTypes[type.toLowerCase()] = connectorClass;
    }
}

// Connection Manager
export class ConnectionManager extends EventEmitter {
    constructor() {
        super();
        this.connections = new Map();
        this.connectionConfigs = new Map();
    }

    async createConnection(id, type, config) {
        try {
            const connector = ConnectorFactory.create(type, config);
            
            // Set up event forwarding
            connector.on('connected', () => this.emit('connection:established', { id, type }));
            connector.on('disconnected', () => this.emit('connection:lost', { id, type }));
            connector.on('sync:progress', (data) => this.emit('sync:progress', { id, type, ...data }));
            
            this.connections.set(id, connector);
            this.connectionConfigs.set(id, { type, config });
            
            return connector;
            
        } catch (error) {
            this.emit('connection:failed', { id, type, error: error.message });
            throw error;
        }
    }

    getConnection(id) {
        return this.connections.get(id);
    }

    async removeConnection(id) {
        const connector = this.connections.get(id);
        if (connector) {
            await connector.disconnect();
            this.connections.delete(id);
            this.connectionConfigs.delete(id);
            return true;
        }
        return false;
    }

    async syncAll() {
        const results = [];
        for (const [id, connector] of this.connections) {
            if (connector.authenticated) {
                try {
                    const result = await connector.sync();
                    results.push({ id, success: true, result });
                } catch (error) {
                    results.push({ id, success: false, error: error.message });
                }
            }
        }
        return results;
    }

    getConnectionStatus() {
        const status = {};
        for (const [id, connector] of this.connections) {
            const config = this.connectionConfigs.get(id);
            status[id] = {
                type: config.type,
                authenticated: connector.authenticated,
                connected: connector.authenticated
            };
        }
        return status;
    }

    async healthCheck() {
        const results = {};
        for (const [id, connector] of this.connections) {
            if (connector.authenticated) {
                results[id] = await connector.testConnection();
            } else {
                results[id] = { success: false, error: 'Not authenticated' };
            }
        }
        return results;
    }
}

export default {
    BaseConnector,
    SalesforceConnector,
    HubSpotConnector,
    GitHubConnector,
    SAPConnector,
    ConnectorFactory,
    ConnectionManager
};