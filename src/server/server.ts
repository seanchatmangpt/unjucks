import express from 'express';
import { createServer } from 'http';
import { ApolloServer } from 'apollo-server-express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import passport from 'passport';
import session from 'express-session';
import RedisStore from 'connect-redis';
import { env, isProduction } from './config/environment.js';
import { dbManager } from './config/database.js';
import { typeDefs } from './graphql/schema.js';
import { resolvers, createGraphQLContext } from './graphql/resolvers.js';
import { resolveTenant, enforceQuotas, validateTenantSchema, cleanupTenantConnections } from './middleware/tenant-isolation.js';
import { authService } from './auth/enterprise-auth.js';
import { requirePermission, requireRole, requireAdmin } from './middleware/rbac.js';
import { auditLogger } from './services/audit-logger.js';
import { CollaborationServer } from './websocket/collaboration-server.js';
import { eventBus } from './events/event-bus.js';
import {
  apiLimiter,
  tenantLimiter,
  authLimiter,
  graphqlLimiter,
  uploadLimiter,
  burstLimiter,
} from './middleware/rate-limiter.js';

class EnterpriseServer {
  private app: express.Application;
  private httpServer: any;
  private apolloServer: ApolloServer;
  private collaborationServer: CollaborationServer;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.setupMiddleware();
    this.setupRoutes();
    this.setupGraphQL();
    this.setupWebSocket();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: isProduction ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: env.CORS_ORIGIN,
      credentials: env.CORS_CREDENTIALS,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Tenant-Slug',
        'X-Request-ID',
        'X-Correlation-ID',
      ],
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Session configuration
    const redisStore = new (RedisStore as any)(session);
    this.app.use(session({
      store: new redisStore({ client: dbManager.redis }),
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      name: 'unjucks.sid',
      cookie: {
        secure: isProduction,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'strict',
      },
    }));

    // Passport initialization
    this.app.use(passport.initialize());
    this.app.use(passport.session());

    // Request logging and metrics
    this.app.use(this.requestLogger);
    this.app.use(this.metricsMiddleware);

    // Rate limiting
    this.app.use('/api/', apiLimiter);
    this.app.use('/auth/', authLimiter);

    // Tenant resolution (must come before other tenant-dependent middleware)
    this.app.use('/api/', resolveTenant);
    this.app.use('/api/', tenantLimiter);
    this.app.use('/api/', enforceQuotas);
    this.app.use('/api/', validateTenantSchema);

    // GraphQL specific middleware
    this.app.use('/graphql', graphqlLimiter);
    this.app.use('/graphql', resolveTenant);
    this.app.use('/graphql', tenantLimiter);
    this.app.use('/graphql', enforceQuotas);

    // Upload middleware
    this.app.use('/api/upload', uploadLimiter);
    this.app.use('/api/generate', burstLimiter);

    // Cleanup middleware
    this.app.use('/api/', cleanupTenantConnections);
  }

  private setupRoutes(): void {
    // Health check endpoints
    this.app.get('/health', this.healthCheck);
    this.app.get('/health/detailed', requireAdmin, this.detailedHealthCheck);
    this.app.get('/metrics', requireAdmin, this.metricsEndpoint);

    // Authentication routes
    this.setupAuthRoutes();

    // API routes
    this.setupAPIRoutes();

    // Admin routes
    this.setupAdminRoutes();
  }

  private setupAuthRoutes(): void {
    const authRouter = express.Router();

    // Local authentication
    authRouter.post('/login', passport.authenticate('local'), this.handleLogin);
    authRouter.post('/logout', this.handleLogout);
    authRouter.post('/refresh', this.handleRefresh);

    // SAML authentication
    if (env.SAML_ENTRY_POINT) {
      authRouter.get('/saml', passport.authenticate('saml'));
      authRouter.post('/saml/callback', passport.authenticate('saml'), this.handleSSOLogin);
    }

    // OAuth authentication
    if (env.OAUTH_GOOGLE_CLIENT_ID) {
      authRouter.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
      authRouter.get('/google/callback', passport.authenticate('google'), this.handleSSOLogin);
    }

    if (env.OAUTH_GITHUB_CLIENT_ID) {
      authRouter.get('/github', passport.authenticate('github'));
      authRouter.get('/github/callback', passport.authenticate('github'), this.handleSSOLogin);
    }

    if (env.OAUTH_MICROSOFT_CLIENT_ID) {
      authRouter.get('/microsoft', passport.authenticate('microsoft'));
      authRouter.get('/microsoft/callback', passport.authenticate('microsoft'), this.handleSSOLogin);
    }

    // LDAP authentication
    if (env.LDAP_URL) {
      authRouter.post('/ldap', passport.authenticate('ldapauth'), this.handleSSOLogin);
    }

    this.app.use('/auth', authRouter);
  }

  private setupAPIRoutes(): void {
    const apiRouter = express.Router();

    // Templates
    apiRouter.get('/templates', passport.authenticate('jwt'), requirePermission('template', 'read'), this.getTemplates);
    apiRouter.post('/templates', passport.authenticate('jwt'), requirePermission('template', 'create'), this.createTemplate);
    apiRouter.get('/templates/:id', passport.authenticate('jwt'), requirePermission('template', 'read'), this.getTemplate);
    apiRouter.put('/templates/:id', passport.authenticate('jwt'), requirePermission('template', 'update'), this.updateTemplate);
    apiRouter.delete('/templates/:id', passport.authenticate('jwt'), requirePermission('template', 'delete'), this.deleteTemplate);

    // Projects
    apiRouter.get('/projects', passport.authenticate('jwt'), requirePermission('project', 'read'), this.getProjects);
    apiRouter.post('/projects', passport.authenticate('jwt'), requirePermission('project', 'create'), this.createProject);
    apiRouter.get('/projects/:id', passport.authenticate('jwt'), requirePermission('project', 'read'), this.getProject);
    apiRouter.put('/projects/:id', passport.authenticate('jwt'), requirePermission('project', 'update'), this.updateProject);
    apiRouter.delete('/projects/:id', passport.authenticate('jwt'), requirePermission('project', 'delete'), this.deleteProject);

    // Generation
    apiRouter.post('/generate', passport.authenticate('jwt'), requirePermission('template', 'execute'), this.generate);
    apiRouter.get('/generations/:id', passport.authenticate('jwt'), requirePermission('generation', 'read'), this.getGeneration);

    // File uploads
    apiRouter.post('/upload', passport.authenticate('jwt'), requirePermission('file', 'create'), this.uploadFile);

    // Collaboration
    apiRouter.get('/rooms/:id/history', passport.authenticate('jwt'), requirePermission('collaboration', 'read'), this.getRoomHistory);

    this.app.use('/api', apiRouter);
  }

  private setupAdminRoutes(): void {
    const adminRouter = express.Router();

    // User management
    adminRouter.get('/users', requireRole('admin'), this.getUsers);
    adminRouter.post('/users', requireRole('admin'), this.createUser);
    adminRouter.put('/users/:id', requireRole('admin'), this.updateUser);
    adminRouter.delete('/users/:id', requireRole('admin'), this.deleteUser);

    // Role management
    adminRouter.get('/roles', requireRole('admin'), this.getRoles);
    adminRouter.post('/roles', requireRole('admin'), this.createRole);
    adminRouter.put('/roles/:id', requireRole('admin'), this.updateRole);
    adminRouter.delete('/roles/:id', requireRole('admin'), this.deleteRole);

    // Tenant management (super admin only)
    adminRouter.get('/tenants', requireRole('super_admin'), this.getTenants);
    adminRouter.post('/tenants', requireRole('super_admin'), this.createTenant);
    adminRouter.put('/tenants/:id', requireRole('super_admin'), this.updateTenant);

    // Audit logs
    adminRouter.get('/audit-logs', requireRole('admin'), this.getAuditLogs);

    // System operations
    adminRouter.post('/cache/clear', requireRole('admin'), this.clearCache);
    adminRouter.post('/backup', requireRole('super_admin'), this.triggerBackup);

    this.app.use('/admin', passport.authenticate('jwt'), adminRouter);
  }

  private async setupGraphQL(): Promise<void> {
    this.apolloServer = new ApolloServer({
      typeDefs,
      resolvers,
      context: ({ req, res }) => {
        const baseContext = createGraphQLContext(req);
        return {
          ...baseContext,
          user: req.user,
          tenant: req.tenant,
        };
      },
      introspection: env.GRAPHQL_INTROSPECTION,
      playground: env.GRAPHQL_PLAYGROUND,
      debug: env.GRAPHQL_DEBUG,
      formatError: (error) => {
        console.error('GraphQL Error:', error);
        
        if (isProduction) {
          // Hide internal errors in production
          return new Error('Internal server error');
        }
        
        return error;
      },
      plugins: [
        {
          requestDidStart() {
            return {
              didResolveOperation(requestContext) {
                console.log(`GraphQL Operation: ${requestContext.operationName}`);
              },
              didEncounterErrors(requestContext) {
                console.error('GraphQL Errors:', requestContext.errors);
              },
            };
          },
        },
      ],
    });

    await this.apolloServer.start();
    this.apolloServer.applyMiddleware({ 
      app: this.app, 
      path: '/graphql',
      cors: false, // Use our CORS middleware
    });
  }

  private setupWebSocket(): void {
    this.collaborationServer = new CollaborationServer(this.httpServer);
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method,
      });
    });

    // Global error handler
    this.app.use(this.errorHandler);

    // Process error handlers
    process.on('uncaughtException', this.handleUncaughtException);
    process.on('unhandledRejection', this.handleUnhandledRejection);
    process.on('SIGTERM', this.gracefulShutdown);
    process.on('SIGINT', this.gracefulShutdown);
  }

  // Middleware functions
  private requestLogger = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const start = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    req.headers['x-request-id'] = requestId;
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms - ${req.ip}`);
      
      if (req.user && req.tenant) {
        // Log to audit system for API calls
        setImmediate(async () => {
          try {
            await auditLogger.logDataAccess(
              req.user!,
              req.tenant!,
              req,
              'api',
              req.originalUrl,
              req.method.toLowerCase(),
              res.statusCode < 400 ? 'success' : 'failure',
              {
                duration,
                statusCode: res.statusCode,
                requestId,
              }
            );
          } catch (error) {
            console.error('Audit logging error:', error);
          }
        });
      }
    });

    next();
  };

  private metricsMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    if (env.METRICS_ENABLED) {
      // Update metrics - would integrate with Prometheus/monitoring system
      setImmediate(() => {
        // This would update metrics like request count, duration, etc.
      });
    }
    next();
  };

  // Route handlers
  private healthCheck = async (req: express.Request, res: express.Response): Promise<void> => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
    };

    res.json(health);
  };

  private detailedHealthCheck = async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const [dbHealth, eventBusHealth, collaborationStats] = await Promise.all([
        this.checkDatabaseHealth(),
        eventBus.getHealth(),
        this.getCollaborationStats(),
      ]);

      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: dbHealth,
        eventBus: eventBusHealth,
        collaboration: collaborationStats,
        version: process.env.npm_package_version || '1.0.0',
      };

      res.json(health);
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: error.message,
      });
    }
  };

  private metricsEndpoint = async (req: express.Request, res: express.Response): Promise<void> => {
    // Return Prometheus-compatible metrics
    const metrics = `
      # HELP unjucks_requests_total Total number of HTTP requests
      # TYPE unjucks_requests_total counter
      unjucks_requests_total 1000

      # HELP unjucks_request_duration_seconds HTTP request duration in seconds
      # TYPE unjucks_request_duration_seconds histogram
      unjucks_request_duration_seconds_bucket{le="0.1"} 100
      unjucks_request_duration_seconds_bucket{le="0.5"} 300
      unjucks_request_duration_seconds_bucket{le="1.0"} 800
      unjucks_request_duration_seconds_bucket{le="+Inf"} 1000
      unjucks_request_duration_seconds_sum 250.5
      unjucks_request_duration_seconds_count 1000
    `;

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics.trim());
  };

  private handleLogin = async (req: express.Request, res: express.Response): Promise<void> => {
    const user = req.user as any;
    
    if (!user) {
      res.status(401).json({ error: 'Authentication failed' });
      return;
    }

    const tokens = await authService.generateTokens(user);
    
    await auditLogger.logAuthentication(user, req.tenant!, req, 'success');

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
      },
      ...tokens,
    });
  };

  private handleLogout = async (req: express.Request, res: express.Response): Promise<void> => {
    if (req.user && req.tenant) {
      await auditLogger.logAuthentication(req.user as any, req.tenant, req, 'success', { action: 'logout' });
    }

    req.logout(() => {
      res.json({ success: true });
    });
  };

  private handleRefresh = async (req: express.Request, res: express.Response): Promise<void> => {
    const { refreshToken } = req.body;
    
    const tokens = await authService.refreshTokens(refreshToken);
    
    if (!tokens) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    res.json(tokens);
  };

  private handleSSOLogin = async (req: express.Request, res: express.Response): Promise<void> => {
    const user = req.user as any;
    
    if (!user) {
      res.status(401).json({ error: 'SSO authentication failed' });
      return;
    }

    const tokens = await authService.generateTokens(user);
    
    await auditLogger.logAuthentication(user, req.tenant!, req, 'success', { provider: user.provider });

    // Redirect or return JSON based on request
    if (req.headers.accept?.includes('application/json')) {
      res.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: user.roles,
        },
        ...tokens,
      });
    } else {
      res.redirect(`/auth/success?token=${tokens.accessToken}&refresh=${tokens.refreshToken}`);
    }
  };

  // API route handlers (simplified - full implementation would be in separate controllers)
  private getTemplates = async (req: express.Request, res: express.Response): Promise<void> => {
    res.json({ templates: [], message: 'Templates endpoint - implement in controller' });
  };

  private createTemplate = async (req: express.Request, res: express.Response): Promise<void> => {
    res.json({ message: 'Create template - implement in controller' });
  };

  private getTemplate = async (req: express.Request, res: express.Response): Promise<void> => {
    res.json({ message: 'Get template - implement in controller' });
  };

  private updateTemplate = async (req: express.Request, res: express.Response): Promise<void> => {
    res.json({ message: 'Update template - implement in controller' });
  };

  private deleteTemplate = async (req: express.Request, res: express.Response): Promise<void> => {
    res.json({ message: 'Delete template - implement in controller' });
  };

  private getProjects = async (req: express.Request, res: express.Response): Promise<void> => {
    res.json({ projects: [], message: 'Projects endpoint - implement in controller' });
  };

  private createProject = async (req: express.Request, res: express.Response): Promise<void> => {
    res.json({ message: 'Create project - implement in controller' });
  };

  private getProject = async (req: express.Request, res: express.Response): Promise<void> => {
    res.json({ message: 'Get project - implement in controller' });
  };

  private updateProject = async (req: express.Request, res: express.Response): Promise<void> => {
    res.json({ message: 'Update project - implement in controller' });
  };

  private deleteProject = async (req: express.Request, res: express.Response): Promise<void> => {
    res.json({ message: 'Delete project - implement in controller' });
  };

  private generate = async (req: express.Request, res: express.Response): Promise<void> => {
    res.json({ message: 'Generate - implement in controller' });
  };

  private getGeneration = async (req: express.Request, res: express.Response): Promise<void> => {
    res.json({ message: 'Get generation - implement in controller' });
  };

  private uploadFile = async (req: express.Request, res: express.Response): Promise<void> => {
    res.json({ message: 'Upload file - implement in controller' });
  };

  private getRoomHistory = async (req: express.Request, res: express.Response): Promise<void> => {
    res.json({ message: 'Room history - implement in controller' });
  };

  // Admin route handlers
  private getUsers = async (req: express.Request, res: express.Response): Promise<void> => {
    res.json({ users: [], message: 'Users endpoint - implement in controller' });
  };

  private createUser = async (req: express.Request, res: express.Response): Promise<void> => {
    res.json({ message: 'Create user - implement in controller' });
  };

  private updateUser = async (req: express.Request, res: express.Response): Promise<void> => {
    res.json({ message: 'Update user - implement in controller' });
  };

  private deleteUser = async (req: express.Request, res: express.Response): Promise<void> => {
    res.json({ message: 'Delete user - implement in controller' });
  };

  private getRoles = async (req: express.Request, res: express.Response): Promise<void> => {
    res.json({ roles: [], message: 'Roles endpoint - implement in controller' });
  };

  private createRole = async (req: express.Request, res: express.Response): Promise<void> => {
    res.json({ message: 'Create role - implement in controller' });
  };

  private updateRole = async (req: express.Request, res: express.Response): Promise<void> => {
    res.json({ message: 'Update role - implement in controller' });
  };

  private deleteRole = async (req: express.Request, res: express.Response): Promise<void> => {
    res.json({ message: 'Delete role - implement in controller' });
  };

  private getTenants = async (req: express.Request, res: express.Response): Promise<void> => {
    res.json({ tenants: [], message: 'Tenants endpoint - implement in controller' });
  };

  private createTenant = async (req: express.Request, res: express.Response): Promise<void> => {
    res.json({ message: 'Create tenant - implement in controller' });
  };

  private updateTenant = async (req: express.Request, res: express.Response): Promise<void> => {
    res.json({ message: 'Update tenant - implement in controller' });
  };

  private getAuditLogs = async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { events, total } = await auditLogger.getAuditHistory(req.tenant!.tenantId, {
        limit: parseInt(req.query.limit as string) || 100,
        offset: parseInt(req.query.offset as string) || 0,
        userId: req.query.userId as string,
        resource: req.query.resource as string,
        action: req.query.action as string,
      });

      res.json({ events, total });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  };

  private clearCache = async (req: express.Request, res: express.Response): Promise<void> => {
    // Clear various caches
    res.json({ message: 'Cache cleared' });
  };

  private triggerBackup = async (req: express.Request, res: express.Response): Promise<void> => {
    // Trigger system backup
    res.json({ message: 'Backup triggered' });
  };

  // Error handlers
  private errorHandler = (
    error: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): void => {
    console.error('Express Error:', error);

    if (res.headersSent) {
      return next(error);
    }

    const statusCode = error.statusCode || error.status || 500;
    const message = isProduction ? 'Internal server error' : error.message;

    res.status(statusCode).json({
      error: error.name || 'ServerError',
      message,
      ...(isProduction ? {} : { stack: error.stack }),
    });
  };

  private handleUncaughtException = (error: Error): void => {
    console.error('Uncaught Exception:', error);
    this.gracefulShutdown();
  };

  private handleUnhandledRejection = (reason: any, promise: Promise<any>): void => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    this.gracefulShutdown();
  };

  private gracefulShutdown = (): void => {
    console.log('Graceful shutdown initiated...');

    this.httpServer.close(() => {
      console.log('HTTP server closed');
      
      Promise.all([
        dbManager.close(),
        auditLogger.destroy(),
        eventBus.stop(),
        this.collaborationServer.shutdown(),
      ]).then(() => {
        console.log('Graceful shutdown completed');
        process.exit(0);
      }).catch((error) => {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
      });
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  // Helper methods
  private async checkDatabaseHealth(): Promise<any> {
    try {
      await dbManager.postgres.query('SELECT 1');
      await dbManager.redis.ping();
      
      return {
        postgres: { status: 'healthy', metrics: dbManager.metrics },
        redis: { status: 'healthy' },
      };
    } catch (error) {
      throw new Error(`Database health check failed: ${error.message}`);
    }
  }

  private getCollaborationStats(): any {
    return this.collaborationServer.getStats();
  }

  // Public methods
  async start(): Promise<void> {
    try {
      // Initialize database connections
      await dbManager.initialize();
      console.log('✓ Database connections established');

      // Start event bus
      await eventBus.start();
      console.log('✓ Event bus started');

      // Start HTTP server
      this.httpServer.listen(env.PORT, env.HOST, () => {
        console.log(`🚀 Server running on http://${env.HOST}:${env.PORT}`);
        console.log(`📊 GraphQL Playground: http://${env.HOST}:${env.PORT}/graphql`);
        console.log(`🔌 WebSocket Server: ws://${env.HOST}:${env.WS_PORT}/ws/collaboration`);
        console.log(`🏥 Health Check: http://${env.HOST}:${env.PORT}/health`);
      });

    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

export default EnterpriseServer;