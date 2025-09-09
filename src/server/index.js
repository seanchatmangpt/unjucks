#!/usr/bin/env node

import EnterpriseServer from './server.js';
import { env, isProduction } from './config/environment.js';
import { initializeMonitoring } from '../monitoring/index.js';
import logger from '../lib/observability/logger.js';

// Set Node.js process title
process.title = 'unjucks-enterprise-server';

// Initialize monitoring systems first
let monitoring;
try {
  monitoring = await initializeMonitoring();
  logger.info('🔍 Production monitoring systems initialized successfully');
} catch (error) {
  logger.error('Failed to initialize monitoring systems', error);
  // Continue without monitoring - log to console as fallback
  console.error('WARNING: Monitoring systems failed to initialize:', error.message);
}

// Create and start the server
const server = new EnterpriseServer();

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  logger.info(`🛑 Received ${signal}, initiating graceful shutdown...`);
  
  try {
    // Stop server first
    if (server && server.stop) {
      await server.stop();
    }
    
    // Stop monitoring systems
    if (monitoring && monitoring.stop) {
      await monitoring.stop();
    }
    
    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', error);
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

// Start the server
server.start().catch((error) => {
  logger.fatal('Failed to start enterprise server', error);
  process.exit(1);
});

// Log startup message
console.log(`
🚀 Unjucks Enterprise Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Environment: ${env.NODE_ENV}
Mode: ${isProduction ? 'Production' : 'Development'}
Version: ${process.env.npm_package_version || '1.0.0'}

Server Features:
✓ Multi-tenant isolation
✓ Enterprise authentication (SAML/OAuth/LDAP)
✓ Role-based access control
✓ Audit logging with SIEM integration
✓ Real-time collaboration WebSockets
✓ GraphQL API with DataLoader optimization
✓ Rate limiting and quota management
✓ Database connection pooling
✓ Event bus for microservices
✓ Production monitoring & observability
✓ OpenTelemetry distributed tracing
✓ Structured logging with correlation IDs
✓ Kubernetes health/readiness/liveness probes
✓ Prometheus metrics & Grafana dashboards
✓ SLI/SLO tracking & error alerting
✓ Real-time performance monitoring

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

export default server;