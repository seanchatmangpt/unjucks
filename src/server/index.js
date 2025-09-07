#!/usr/bin/env node

import EnterpriseServer from './server.js';
import { env, isProduction } from './config/environment.js';

// Set Node.js process title
process.title = 'unjucks-enterprise-server';

// Create and start the server
const server = new EnterpriseServer();

// Start the server
server.start().catch((error) => {
  console.error('Failed to start enterprise server:', error);
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
✓ Production monitoring

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

export default server;