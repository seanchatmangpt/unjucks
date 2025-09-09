# Environment Variables Reference

**Target Audience**: Platform Engineering, DevOps Teams  
**Security Classification**: Confidential  
**Last Updated**: September 2025

## Overview

This document provides a comprehensive reference for all environment variables required for Unjucks production deployment. Variables are categorized by system component and security requirements.

## Security Classifications

| Classification | Description | Storage Method |
|---|---|---|
| **🔴 SECRET** | Passwords, keys, tokens | Secrets manager only |
| **🟡 SENSITIVE** | Internal URLs, IDs | Encrypted config |
| **🟢 PUBLIC** | Timeouts, limits, flags | Plain text config |

## Core Server Configuration

### Application Server
```bash
# 🟢 Runtime Environment
NODE_ENV=production              # Environment: production, staging, development
PORT=3000                       # Application port (default: 3000)
HOST=0.0.0.0                    # Bind address (use 0.0.0.0 for containers)

# 🟢 Node.js Optimization
NODE_OPTIONS="--max-old-space-size=2048 --max-http-header-size=16384"
UV_THREADPOOL_SIZE=16           # Thread pool size for file operations
NPM_CONFIG_UPDATE_NOTIFIER=false
NPM_CONFIG_FUND=false
FORCE_COLOR=0                   # Disable colors in production logs
```

### Process Management
```bash
# 🟢 Process Settings  
PM2_INSTANCES=max               # PM2 cluster instances (or specific number)
PM2_MAX_MEMORY_RESTART=2048M    # Auto-restart on memory limit
PM2_KILL_TIMEOUT=5000          # Graceful shutdown timeout (ms)
PM2_LISTEN_TIMEOUT=8000        # Startup timeout (ms)
PM2_MIN_UPTIME=10000           # Minimum uptime before considering stable (ms)
```

## Database Configuration

### PostgreSQL Primary Database
```bash
# 🟡 Connection Settings
DB_HOST=prod-db-cluster.internal.company.com  # Primary database host
DB_PORT=5432                                  # PostgreSQL port
DB_NAME=unjucks_prod                         # Database name
DB_USER=unjucks_app                          # Application database user

# 🔴 Authentication
DB_PASSWORD=${SECRET_DB_PASSWORD}             # From secrets manager
DB_SSL_CERT=${SECRET_DB_SSL_CERT}            # Client SSL certificate
DB_SSL_KEY=${SECRET_DB_SSL_KEY}              # Client SSL private key
DB_SSL_CA=${SECRET_DB_SSL_CA}                # Certificate Authority

# 🟢 Connection Pool Settings
DB_POOL_MAX=20                               # Maximum connections per instance
DB_POOL_MIN=5                                # Minimum connections maintained
DB_IDLE_TIMEOUT=30000                        # Idle connection timeout (ms)
DB_CONNECTION_TIMEOUT=10000                  # Connection establishment timeout (ms)
DB_STATEMENT_TIMEOUT=30000                   # SQL statement timeout (ms)
DB_QUERY_TIMEOUT=30000                       # Individual query timeout (ms)

# 🟢 SSL Configuration
DB_SSL_ENABLED=true                          # Enable SSL/TLS encryption
DB_SSL_REJECT_UNAUTHORIZED=true              # Reject invalid certificates
DB_SSL_MODE=require                          # SSL mode: require, prefer, disable

# 🟢 Health Monitoring
DB_HEALTH_CHECK_INTERVAL=30000               # Health check frequency (ms)
DB_MAX_RETRIES=3                            # Maximum connection retry attempts
DB_RETRY_DELAY=1000                         # Delay between retries (ms)
```

### PostgreSQL Read Replicas
```bash
# 🟡 Read Replica Configuration
DB_READ_HOST=prod-db-replica.internal.company.com
DB_READ_PORT=5432
DB_READ_USER=unjucks_readonly
DB_READ_PASSWORD=${SECRET_DB_READ_PASSWORD}   # From secrets manager
DB_READ_POOL_MAX=10                          # Lower pool size for read replicas
```

### Redis Cache Layer
```bash
# 🟡 Redis Cluster Configuration
REDIS_URL=redis://prod-redis-cluster.internal.company.com:6379
REDIS_SENTINEL_HOSTS=sentinel1:26379,sentinel2:26379,sentinel3:26379
REDIS_SENTINEL_NAME=unjucks-redis-cluster

# 🔴 Authentication
REDIS_PASSWORD=${SECRET_REDIS_PASSWORD}       # Redis AUTH password
REDIS_TLS_CERT=${SECRET_REDIS_TLS_CERT}      # Client TLS certificate
REDIS_TLS_KEY=${SECRET_REDIS_TLS_KEY}        # Client TLS private key

# 🟢 Connection Settings
REDIS_MAX_RETRIES=3                          # Maximum retry attempts
REDIS_RETRY_DELAY=100                        # Base retry delay (ms)
REDIS_CONNECT_TIMEOUT=5000                   # Connection timeout (ms)
REDIS_COMMAND_TIMEOUT=5000                   # Command execution timeout (ms)
REDIS_LAZY_CONNECT=true                      # Connect on first command
REDIS_KEEP_ALIVE=30000                       # TCP keep-alive interval (ms)

# 🟢 Clustering Options
REDIS_ENABLE_READY_CHECK=true                # Wait for cluster ready state
REDIS_REDIS_OPTIONS_RETRY_DELAY_ON_CLUSTER_DOWN=100
REDIS_REDIS_OPTIONS_RETRY_DELAY_ON_FAIL_OVER=100
REDIS_MAX_REDIRECTIONS=16                    # Maximum cluster redirections
```

## Security Configuration

### Authentication & Authorization
```bash
# 🔴 JWT Configuration
JWT_SECRET=${SECRET_JWT_KEY}                 # 256-bit signing key from secrets manager
JWT_ALGORITHM=HS256                          # Signing algorithm
JWT_EXPIRES_IN=24h                          # Access token lifetime
JWT_REFRESH_EXPIRES_IN=7d                   # Refresh token lifetime
JWT_ISSUER=unjucks-prod                     # JWT issuer claim
JWT_AUDIENCE=unjucks-api                    # JWT audience claim

# 🔴 Session Management
SESSION_SECRET=${SECRET_SESSION_KEY}         # 256-bit session signing key
SESSION_MAX_AGE=86400000                    # Session lifetime (24h in ms)
SESSION_ROLLING=true                        # Extend session on activity
SESSION_SAVE_UNINITIALIZED=false           # Don't save empty sessions
SESSION_SECURE=true                         # Require HTTPS
SESSION_HTTP_ONLY=true                      # Prevent XSS access
SESSION_SAME_SITE=strict                    # CSRF protection

# 🔴 Encryption Keys
ENCRYPTION_KEY=${SECRET_ENCRYPTION_KEY}      # 256-bit AES encryption key
CSRF_SECRET=${SECRET_CSRF_KEY}              # CSRF protection key
BCRYPT_ROUNDS=12                            # Password hashing rounds (12-15)
```

### Enterprise SSO Integration
```bash
# 🟡 SAML 2.0 Configuration
SAML_ENTRY_POINT=${SAML_IDP_URL}            # Identity provider login URL
SAML_ISSUER=urn:unjucks:prod                # Service provider entity ID
SAML_CALLBACK_URL=https://unjucks.company.com/auth/saml/callback
SAML_LOGOUT_URL=https://unjucks.company.com/auth/logout

# 🔴 SAML Certificates
SAML_CERT=${SECRET_SAML_X509_CERT}          # X.509 certificate for signature validation
SAML_PRIVATE_KEY=${SECRET_SAML_PRIVATE_KEY} # Private key for request signing
SAML_DECRYPT_CERT=${SECRET_SAML_DECRYPT_CERT} # Certificate for assertion decryption

# 🟢 SAML Settings
SAML_SIGNATURE_ALGORITHM=sha256             # Signature algorithm
SAML_DIGEST_ALGORITHM=sha256                # Digest algorithm
SAML_WANT_ASSERTION_SIGNED=true            # Require signed assertions
SAML_WANT_RESPONSE_SIGNED=true             # Require signed responses
SAML_DISABLE_REQUESTED_AUTHN_CONTEXT=false # Enable authentication context
```

### OAuth 2.0 Providers
```bash
# 🟡 Google OAuth
OAUTH_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
OAUTH_GOOGLE_CLIENT_SECRET=${SECRET_GOOGLE_CLIENT_SECRET}
OAUTH_GOOGLE_CALLBACK_URL=https://unjucks.company.com/auth/google/callback

# 🟡 Microsoft Azure AD
OAUTH_MICROSOFT_CLIENT_ID=${MICROSOFT_CLIENT_ID}
OAUTH_MICROSOFT_CLIENT_SECRET=${SECRET_MICROSOFT_CLIENT_SECRET}
OAUTH_MICROSOFT_TENANT_ID=${MICROSOFT_TENANT_ID}
OAUTH_MICROSOFT_CALLBACK_URL=https://unjucks.company.com/auth/microsoft/callback

# 🟡 GitHub Enterprise
OAUTH_GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
OAUTH_GITHUB_CLIENT_SECRET=${SECRET_GITHUB_CLIENT_SECRET}
OAUTH_GITHUB_CALLBACK_URL=https://unjucks.company.com/auth/github/callback
OAUTH_GITHUB_ENTERPRISE_URL=https://github.company.com
```

### LDAP/Active Directory
```bash
# 🟡 LDAP Configuration
LDAP_URL=ldaps://ad.company.com:636         # LDAP server URL (use LDAPS)
LDAP_BIND_DN=${LDAP_SERVICE_ACCOUNT_DN}     # Service account distinguished name
LDAP_BIND_CREDENTIALS=${SECRET_LDAP_PASSWORD} # Service account password

# 🟢 LDAP Search Configuration
LDAP_SEARCH_BASE=ou=users,dc=company,dc=com # User search base DN
LDAP_SEARCH_FILTER=(sAMAccountName={{username}}) # User search filter
LDAP_SEARCH_SCOPE=sub                       # Search scope: base, one, sub
LDAP_GROUP_SEARCH_BASE=ou=groups,dc=company,dc=com
LDAP_GROUP_SEARCH_FILTER=(member={{dn}})    # Group membership filter

# 🟢 LDAP Connection Settings
LDAP_TIMEOUT=5000                           # Connection timeout (ms)
LDAP_RECONNECT=true                         # Auto-reconnect on failure
LDAP_TLS_OPTIONS_REJECT_UNAUTHORIZED=true   # Validate TLS certificates
LDAP_POOL_SIZE=10                          # Connection pool size
```

## Network & Security

### Rate Limiting
```bash
# 🟢 Global Rate Limiting
RATE_LIMIT_WINDOW_MS=900000                 # 15-minute window
RATE_LIMIT_MAX_REQUESTS=1000                # Requests per window per IP
RATE_LIMIT_SKIP_SUCCESS=false               # Count successful requests
RATE_LIMIT_SKIP_FAILED=false                # Count failed requests
RATE_LIMIT_HEADERS=true                     # Include rate limit headers

# 🟢 API-Specific Limits
API_RATE_LIMIT_WINDOW_MS=60000              # 1-minute window for API
API_RATE_LIMIT_MAX_REQUESTS=100             # API requests per minute
AUTH_RATE_LIMIT_WINDOW_MS=900000            # 15-minute window for auth
AUTH_RATE_LIMIT_MAX_REQUESTS=5              # Auth attempts per window
```

### CORS Configuration
```bash
# 🟡 Cross-Origin Resource Sharing
CORS_ORIGIN=https://app.company.com,https://admin.company.com
CORS_METHODS=GET,POST,PUT,DELETE,PATCH,OPTIONS
CORS_ALLOWED_HEADERS=Content-Type,Authorization,X-Requested-With,X-API-Key
CORS_CREDENTIALS=true                       # Allow credentials
CORS_MAX_AGE=86400                         # Preflight cache duration (24h)
CORS_PREFLIGHTCONTINUE=false               # Don't pass preflight to next handler
CORS_OPTIONS_SUCCESS_STATUS=204            # Success status for OPTIONS
```

### Content Security Policy
```bash
# 🟢 CSP Configuration
CSP_DEFAULT_SRC="'self'"                   # Default source policy
CSP_SCRIPT_SRC="'self' 'unsafe-inline' https://cdn.company.com"
CSP_STYLE_SRC="'self' 'unsafe-inline' https://fonts.googleapis.com"
CSP_IMG_SRC="'self' data: https:"          # Image sources
CSP_CONNECT_SRC="'self' https://api.company.com wss://ws.company.com"
CSP_FONT_SRC="'self' https://fonts.gstatic.com"
CSP_OBJECT_SRC="'none'"                    # Disable plugins
CSP_MEDIA_SRC="'self'"                     # Media sources
CSP_FRAME_SRC="'none'"                     # Disable frames
```

## File Storage & CDN

### Local Storage
```bash
# 🟢 Local File Storage
STORAGE_TYPE=local                          # Storage backend: local, s3, gcs
UPLOAD_MAX_SIZE=10485760                   # 10MB max upload size
UPLOAD_ALLOWED_TYPES=jpg,jpeg,png,pdf,docx,txt
UPLOAD_PATH=/app/data/uploads               # Local storage directory
UPLOAD_TEMP_PATH=/app/data/temp            # Temporary upload directory
```

### AWS S3 Configuration
```bash
# 🟡 AWS S3 Settings
STORAGE_TYPE=s3
S3_BUCKET=${S3_PROD_BUCKET}                # Production S3 bucket
S3_REGION=${AWS_REGION}                    # AWS region
S3_ACL=private                             # Default ACL for objects
S3_FORCE_PATH_STYLE=false                  # Use virtual-hosted style URLs

# 🔴 AWS Credentials
AWS_ACCESS_KEY_ID=${SECRET_AWS_ACCESS_KEY}
AWS_SECRET_ACCESS_KEY=${SECRET_AWS_SECRET_KEY}
AWS_ROLE_ARN=${AWS_ROLE_ARN}               # For role-based access

# 🟢 S3 Options
S3_UPLOAD_TIMEOUT=60000                    # Upload timeout (ms)
S3_MAX_FILE_SIZE=104857600                 # 100MB max file size
S3_MULTIPART_THRESHOLD=26214400            # 25MB multipart threshold
S3_MULTIPART_CHUNK_SIZE=5242880            # 5MB chunk size
```

### Google Cloud Storage
```bash
# 🟡 GCS Configuration
STORAGE_TYPE=gcs
GCS_BUCKET=${GCS_PROD_BUCKET}              # Production GCS bucket
GCS_PROJECT_ID=${GCP_PROJECT_ID}           # GCP project ID

# 🔴 GCS Credentials
GCS_KEY_FILE=${SECRET_GCS_KEY_FILE}        # Service account key file path
GOOGLE_APPLICATION_CREDENTIALS=${SECRET_GCS_KEY_FILE}
```

## Monitoring & Observability

### Application Metrics
```bash
# 🟢 Prometheus Metrics
METRICS_ENABLED=true                        # Enable metrics collection
PROMETHEUS_ENDPOINT=/metrics                # Metrics endpoint path
METRICS_PREFIX=unjucks_                     # Metric name prefix
METRICS_DEFAULT_LABELS=env=production,service=unjucks

# 🟢 Custom Metrics
CUSTOM_METRICS_ENABLED=true                # Enable business metrics
PERFORMANCE_METRICS_ENABLED=true           # Enable performance tracking
DATABASE_METRICS_ENABLED=true              # Enable database metrics
REDIS_METRICS_ENABLED=true                 # Enable Redis metrics
```

### Health Checks
```bash
# 🟢 Health Check Configuration
HEALTH_CHECK_PATH=/health                   # Health check endpoint
HEALTH_CHECK_TIMEOUT=5000                  # Health check timeout (ms)
HEALTH_CHECK_INTERVAL=30000                # Internal health check interval
DEEP_HEALTH_CHECKS=true                    # Include dependency checks

# 🟢 Dependency Health Checks
DB_HEALTH_CHECK_ENABLED=true               # Database health check
REDIS_HEALTH_CHECK_ENABLED=true            # Redis health check
EXTERNAL_API_HEALTH_CHECK_ENABLED=true     # External service checks
```

### Logging Configuration
```bash
# 🟢 Log Settings
LOG_LEVEL=info                             # Log level: error, warn, info, debug
LOG_FORMAT=json                            # Log format: json, text
LOG_TIMESTAMP=true                         # Include timestamps
LOG_COLORS=false                           # Disable colors in production

# 🟢 Structured Logging
LOG_INCLUDE_PID=true                       # Include process ID
LOG_INCLUDE_HOSTNAME=true                  # Include hostname
LOG_INCLUDE_LEVEL=true                     # Include log level
LOG_INCLUDE_TIMESTAMP=true                 # Include timestamp
LOG_INCLUDE_REQUEST_ID=true                # Include request correlation ID

# 🟡 External Log Shipping
SYSLOG_HOST=syslog.company.com             # Syslog server
SYSLOG_PORT=514                            # Syslog port
SYSLOG_PROTOCOL=udp                        # Syslog protocol: udp, tcp
ELASTICSEARCH_URL=https://elastic.company.com:9200
LOGSTASH_HOST=logstash.company.com
LOGSTASH_PORT=5044
```

### SIEM Integration
```bash
# 🟡 Security Information and Event Management
SIEM_ENABLED=true                          # Enable SIEM integration
SIEM_WEBHOOK_URL=${SECRET_SIEM_WEBHOOK}    # SIEM webhook endpoint
SIEM_API_KEY=${SECRET_SIEM_API_KEY}        # SIEM API key
SIEM_BATCH_SIZE=100                        # Events per batch
SIEM_FLUSH_INTERVAL=60000                  # Flush interval (ms)

# 🟢 Audit Logging
AUDIT_LOG_LEVEL=info                       # Audit log level
AUDIT_LOG_ENABLED=true                     # Enable audit logging
AUDIT_LOG_INCLUDE_REQUEST_BODY=false       # Log request bodies (PII risk)
AUDIT_LOG_INCLUDE_RESPONSE_BODY=false      # Log response bodies (PII risk)
AUDIT_RETENTION_DAYS=2557                  # 7 years retention
```

## Event Processing & Messaging

### Event Bus Configuration
```bash
# 🟢 Event Bus Selection
EVENT_BUS_TYPE=redis                       # Options: redis, rabbitmq, kafka
EVENT_RETRY_ATTEMPTS=3                     # Max retry attempts
EVENT_RETRY_DELAY=1000                     # Retry delay (ms)
EVENT_DEAD_LETTER_ENABLED=true             # Enable dead letter queue

# 🟡 RabbitMQ Configuration (if EVENT_BUS_TYPE=rabbitmq)
RABBITMQ_URL=amqp://user:pass@rabbitmq.company.com:5672
RABBITMQ_VHOST=/production                 # Virtual host
RABBITMQ_EXCHANGE=unjucks-events           # Exchange name
RABBITMQ_QUEUE_PREFIX=unjucks-prod-        # Queue prefix
RABBITMQ_PERSISTENT=true                   # Persistent messages

# 🟡 Apache Kafka Configuration (if EVENT_BUS_TYPE=kafka)
KAFKA_BROKERS=kafka1.company.com:9092,kafka2.company.com:9092
KAFKA_CLIENT_ID=unjucks-prod               # Kafka client ID
KAFKA_GROUP_ID=unjucks-consumer-group      # Consumer group ID
KAFKA_TOPIC_PREFIX=unjucks-prod-           # Topic prefix
KAFKA_PARTITION_COUNT=3                    # Default partition count
KAFKA_REPLICATION_FACTOR=3                 # Replication factor
```

### WebSocket Configuration
```bash
# 🟢 WebSocket Server
WS_ENABLED=true                            # Enable WebSocket support
WS_PORT=3001                               # WebSocket port
WS_PATH=/ws                                # WebSocket endpoint path
WS_HEARTBEAT_INTERVAL=30000                # Heartbeat interval (ms)
WS_MAX_CONNECTIONS=10000                   # Maximum concurrent connections
WS_MAX_PAYLOAD_SIZE=1048576                # 1MB max message size

# 🟢 WebSocket Security
WS_CORS_ORIGIN=https://app.company.com     # WebSocket CORS origin
WS_AUTH_REQUIRED=true                      # Require authentication
WS_RATE_LIMIT_ENABLED=true                 # Enable rate limiting
WS_RATE_LIMIT_POINTS=100                   # Points per connection
WS_RATE_LIMIT_DURATION=60                  # Rate limit window (seconds)
```

## GraphQL Configuration

### GraphQL Server
```bash
# 🟢 GraphQL Settings
GRAPHQL_ENABLED=true                       # Enable GraphQL endpoint
GRAPHQL_PATH=/graphql                      # GraphQL endpoint path
GRAPHQL_PLAYGROUND=false                   # Disable playground in production
GRAPHQL_INTROSPECTION=false               # Disable introspection in production
GRAPHQL_DEBUG=false                       # Disable debug mode in production

# 🟢 GraphQL Security
GRAPHQL_DEPTH_LIMIT=10                    # Query depth limit
GRAPHQL_COMPLEXITY_LIMIT=1000             # Query complexity limit
GRAPHQL_RATE_LIMIT_ENABLED=true           # Enable GraphQL rate limiting
GRAPHQL_RATE_LIMIT_MAX=100                # Max queries per minute
GRAPHQL_QUERY_TIMEOUT=30000               # Query timeout (ms)

# 🟢 GraphQL Caching
GRAPHQL_CACHE_ENABLED=true                # Enable query caching
GRAPHQL_CACHE_TTL=300                     # Cache TTL (seconds)
GRAPHQL_PERSISTED_QUERIES=true            # Enable persisted queries
```

## Multi-Tenancy Configuration

### Tenant Isolation
```bash
# 🟢 Multi-Tenant Settings
MULTI_TENANT_ENABLED=true                 # Enable multi-tenancy
TENANT_ISOLATION_MODE=database            # Options: database, schema, row
DEFAULT_TENANT_ID=default                 # Default tenant identifier
TENANT_HEADER_NAME=X-Tenant-ID            # HTTP header for tenant ID

# 🟢 Tenant Database Configuration
TENANT_DB_PREFIX=tenant_                  # Database prefix for tenant DBs
TENANT_MIGRATION_AUTO=true                # Auto-migrate tenant databases
TENANT_MAX_CONNECTIONS_PER_TENANT=5       # Max DB connections per tenant
```

## Development & Debugging

### Development Mode Variables (staging/dev only)
```bash
# 🟢 Development Settings (NOT for production)
DEBUG_ENABLED=false                       # Enable debug logging
DEBUG_NAMESPACE=unjucks:*                 # Debug namespace pattern
STACK_TRACE_ENABLED=false                 # Include stack traces in errors
PRETTY_PRINT_LOGS=false                   # Pretty print log output
HOT_RELOAD_ENABLED=false                  # Enable hot reloading
SOURCE_MAPS_ENABLED=false                 # Include source maps
```

## Semantic Web Features

### RDF/Turtle Configuration
```bash
# 🟢 Semantic Web Features
RDF_ENABLED=true                          # Enable RDF processing
RDF_SERIALIZATION_FORMAT=turtle           # Default format: turtle, json-ld, n-triples
RDF_BASE_URI=https://unjucks.company.com/rdf/
RDF_NAMESPACE_PREFIX=unjucks              # Default namespace prefix
RDF_VALIDATION_ENABLED=true               # Validate RDF data
RDF_REASONING_ENABLED=false               # Enable OWL reasoning (resource intensive)

# 🟢 SPARQL Configuration
SPARQL_ENDPOINT_ENABLED=true              # Enable SPARQL endpoint
SPARQL_ENDPOINT_PATH=/sparql              # SPARQL endpoint path
SPARQL_UPDATE_ENABLED=false               # Disable updates in production
SPARQL_QUERY_TIMEOUT=30000                # SPARQL query timeout (ms)
SPARQL_RESULT_LIMIT=1000                  # Maximum result set size
```

## Environment-Specific Configurations

### Production Environment
```bash
# 🟢 Production-Specific Settings
NODE_ENV=production
DEBUG=false
LOG_LEVEL=warn
METRICS_ENABLED=true
HEALTH_CHECKS_ENABLED=true
SECURITY_HEADERS_ENABLED=true
COMPRESSION_ENABLED=true
CACHE_ENABLED=true
```

### Staging Environment
```bash
# 🟢 Staging-Specific Settings
NODE_ENV=staging
DEBUG=false
LOG_LEVEL=info
METRICS_ENABLED=true
HEALTH_CHECKS_ENABLED=true
SECURITY_HEADERS_ENABLED=true
COMPRESSION_ENABLED=true
CACHE_ENABLED=true
```

### Development Environment
```bash
# 🟢 Development-Specific Settings
NODE_ENV=development
DEBUG=true
LOG_LEVEL=debug
METRICS_ENABLED=false
HEALTH_CHECKS_ENABLED=false
SECURITY_HEADERS_ENABLED=false
COMPRESSION_ENABLED=false
CACHE_ENABLED=false
HOT_RELOAD_ENABLED=true
```

## Secrets Management

### AWS Secrets Manager Integration
```bash
# 🟢 Secrets Manager Configuration
SECRETS_PROVIDER=aws-secrets-manager      # Options: aws-secrets-manager, azure-key-vault, hashicorp-vault
AWS_SECRETS_REGION=${AWS_REGION}
AWS_SECRETS_PREFIX=prod/unjucks/          # Prefix for secret names
SECRETS_CACHE_TTL=300                     # Cache secrets for 5 minutes
SECRETS_ROTATION_ENABLED=true             # Enable automatic rotation
```

### Azure Key Vault Integration
```bash
# 🟡 Azure Key Vault Configuration (alternative)
SECRETS_PROVIDER=azure-key-vault
AZURE_KEY_VAULT_URL=https://unjucks-prod.vault.azure.net/
AZURE_CLIENT_ID=${AZURE_CLIENT_ID}
AZURE_CLIENT_SECRET=${SECRET_AZURE_CLIENT_SECRET}
AZURE_TENANT_ID=${AZURE_TENANT_ID}
```

### HashiCorp Vault Integration
```bash
# 🟡 HashiCorp Vault Configuration (alternative)
SECRETS_PROVIDER=hashicorp-vault
VAULT_URL=https://vault.company.com:8200
VAULT_TOKEN=${SECRET_VAULT_TOKEN}
VAULT_MOUNT_PATH=secret/unjucks/prod/
VAULT_AUTH_METHOD=aws                     # Options: token, aws, kubernetes
```

## Configuration Validation

### Required Variables Checklist
- [ ] `NODE_ENV=production`
- [ ] `DB_HOST` and `DB_PASSWORD` configured
- [ ] `REDIS_URL` and `REDIS_PASSWORD` configured
- [ ] `JWT_SECRET` (minimum 256 bits)
- [ ] `SESSION_SECRET` (minimum 256 bits)
- [ ] `ENCRYPTION_KEY` (minimum 256 bits)
- [ ] SSL certificates configured for HTTPS
- [ ] Authentication provider configured (SAML/OAuth/LDAP)
- [ ] Monitoring endpoints enabled
- [ ] Log shipping configured
- [ ] Secrets stored in secrets manager

### Security Variables Validation
```bash
# Validate secret lengths
echo "${JWT_SECRET}" | wc -c              # Should be >= 32 characters
echo "${SESSION_SECRET}" | wc -c          # Should be >= 32 characters
echo "${ENCRYPTION_KEY}" | wc -c          # Should be >= 32 characters

# Validate database SSL
psql "${DB_CONNECTION_STRING}" -c "SELECT ssl_is_used();" # Should return 't'

# Validate Redis authentication
redis-cli -u "${REDIS_URL}" ping          # Should require authentication
```

---

**⚠️ Security Notice**: This document contains sensitive configuration information. Access should be restricted to authorized personnel only. All secret values must be stored in approved secrets management systems and never in plain text configuration files.

**Next Steps**: 
- Review [production-deployment-guide.md](./production-deployment-guide.md) for deployment procedures
- See [security-hardening.md](./security-hardening.md) for additional security measures
- Check [infrastructure-requirements.md](./infrastructure-requirements.md) for sizing guidelines