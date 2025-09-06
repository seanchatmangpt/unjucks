import { z } from 'zod';

// Environment schema validation
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  
  // Database - PostgreSQL
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_SSL_ENABLED: z.coerce.boolean().default(false),
  DB_POOL_MAX: z.coerce.number().default(20),
  DB_POOL_MIN: z.coerce.number().default(5),
  DB_IDLE_TIMEOUT: z.coerce.number().default(30000),
  DB_CONNECTION_TIMEOUT: z.coerce.number().default(10000),
  DB_STATEMENT_TIMEOUT: z.coerce.number().default(30000),
  DB_QUERY_TIMEOUT: z.coerce.number().default(30000),
  DB_HEALTH_CHECK_INTERVAL: z.coerce.number().default(30000),

  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  REDIS_MAX_RETRIES: z.coerce.number().default(3),
  REDIS_RETRY_DELAY: z.coerce.number().default(100),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // SAML
  SAML_ENTRY_POINT: z.string().url().optional(),
  SAML_ISSUER: z.string().optional(),
  SAML_CERT: z.string().optional(),
  SAML_PRIVATE_KEY: z.string().optional(),

  // OAuth
  OAUTH_GOOGLE_CLIENT_ID: z.string().optional(),
  OAUTH_GOOGLE_CLIENT_SECRET: z.string().optional(),
  OAUTH_GITHUB_CLIENT_ID: z.string().optional(),
  OAUTH_GITHUB_CLIENT_SECRET: z.string().optional(),
  OAUTH_MICROSOFT_CLIENT_ID: z.string().optional(),
  OAUTH_MICROSOFT_CLIENT_SECRET: z.string().optional(),

  // LDAP
  LDAP_URL: z.string().optional(),
  LDAP_BIND_DN: z.string().optional(),
  LDAP_BIND_CREDENTIALS: z.string().optional(),
  LDAP_SEARCH_BASE: z.string().optional(),
  LDAP_SEARCH_FILTER: z.string().default('(uid={{username}})'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(1000),
  RATE_LIMIT_SKIP_SUCCESS: z.coerce.boolean().default(false),

  // CORS
  CORS_ORIGIN: z.string().or(z.array(z.string())).default('*'),
  CORS_CREDENTIALS: z.coerce.boolean().default(true),

  // Audit Logging
  AUDIT_LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  SIEM_WEBHOOK_URL: z.string().url().optional(),
  SIEM_API_KEY: z.string().optional(),

  // WebSocket
  WS_PORT: z.coerce.number().default(3001),
  WS_HEARTBEAT_INTERVAL: z.coerce.number().default(30000),
  WS_MAX_CONNECTIONS: z.coerce.number().default(10000),

  // GraphQL
  GRAPHQL_PLAYGROUND: z.coerce.boolean().default(false),
  GRAPHQL_INTROSPECTION: z.coerce.boolean().default(false),
  GRAPHQL_DEBUG: z.coerce.boolean().default(false),

  // Event Bus
  EVENT_BUS_TYPE: z.enum(['redis', 'rabbitmq', 'kafka']).default('redis'),
  RABBITMQ_URL: z.string().optional(),
  KAFKA_BROKERS: z.string().optional(),

  // Monitoring
  METRICS_ENABLED: z.coerce.boolean().default(true),
  HEALTH_CHECK_PATH: z.string().default('/health'),
  PROMETHEUS_ENDPOINT: z.string().default('/metrics'),

  // Security
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  SESSION_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(32),

  // File Storage
  UPLOAD_MAX_SIZE: z.coerce.number().default(10485760), // 10MB
  STORAGE_TYPE: z.enum(['local', 's3', 'gcs']).default('local'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
});

// Parse and validate environment variables
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

// Environment utilities
export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

export const config = {
  server: {
    port: env.PORT,
    host: env.HOST,
    nodeEnv: env.NODE_ENV,
  },
  database: {
    postgres: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
    },
    redis: {
      url: env.REDIS_URL,
    },
  },
  auth: {
    jwt: {
      secret: env.JWT_SECRET,
      expiresIn: env.JWT_EXPIRES_IN,
      refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    },
    bcryptRounds: env.BCRYPT_ROUNDS,
  },
  security: {
    sessionSecret: env.SESSION_SECRET,
    csrfSecret: env.CSRF_SECRET,
    encryptionKey: env.ENCRYPTION_KEY,
  },
} as const;