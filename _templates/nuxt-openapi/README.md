---
to: "{{ outputDir }}/README.md"
inject: false
skipIf: "!generateDocs"
---
# {{ appName || "OpenAPI Nuxt Application" }}

{{ appDescription || "Generated from OpenAPI specification using Unjucks templates" }}

## 🚀 Features

- **Type-safe API Client**: Auto-generated TypeScript types and composables
- **Server API Routes**: Nuxt server API routes with validation and authentication
- **Interactive API Testing**: Vue pages for testing API endpoints
- **Authentication**: Built-in support for {{ authProvider | upper }} authentication
- **RDF Integration**: Semantic annotations using Turtle/RDF metadata
{% if enableStreaming %}- **Streaming Support**: Real-time data streaming{% endif %}
{% if enableCaching %}- **Smart Caching**: Intelligent response caching{% endif %}
{% if enableRealtime %}- **WebSocket Support**: Real-time updates{% endif %}
{% if enablePWA %}- **PWA Ready**: Progressive Web App capabilities{% endif %}

## 🏗️ Generated Structure

```
{{ outputDir }}/
├── composables/           # Auto-generated API composables
│   └── use*.ts
├── server/api/           # Nuxt server API routes
│   └── *.{get,post,put,delete}.ts
├── types/                # TypeScript type definitions
│   └── *.ts
├── middleware/           # Authentication middleware
│   └── *.ts
├── pages/api-test/       # API testing interfaces
│   └── *.vue
├── plugins/              # API client plugin
│   └── {{ pluginName | kebabCase }}.client.ts
├── utils/                # Utility functions
│   └── api-utils.ts
├── schemas/              # RDF/Turtle schemas
│   └── openapi.ttl
└── nuxt.config.ts        # Nuxt configuration
```

## 🛠️ Setup

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
```

### Environment Variables

Create a `.env` file with the following variables:

```env
# API Configuration
API_BASE_URL={{ baseUrl || "http://localhost:3001" }}

{% if authProvider === 'jwt' %}
# JWT Authentication
JWT_SECRET=your-jwt-secret-here
{% elif authProvider === 'oauth2' %}
# OAuth2 Configuration
OAUTH_CLIENT_ID=your-oauth-client-id
OAUTH_CLIENT_SECRET=your-oauth-client-secret
OAUTH_AUTH_URL=https://auth.provider.com/oauth/authorize
OAUTH_TOKEN_URL=https://auth.provider.com/oauth/token
{% elif authProvider === 'apiKey' %}
# API Key Configuration
API_KEY_SECRET=your-api-key-secret
{% elif authProvider === 'openIdConnect' %}
# OpenID Connect Configuration
OPENID_CONNECT_URL=https://auth.provider.com/.well-known/openid_configuration
{% endif %}

{% if enableRealtime %}
# WebSocket Configuration
WEBSOCKET_URL=ws://localhost:3001
{% endif %}

{% if enableOpenTelemetry %}
# Telemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
{% endif %}
```

## 🚀 Development

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

### Generated API Usage

#### Using Composables

```typescript
// Auto-generated composable usage
{% if operationId %}
const { data, error, pending, execute } = use{{ operationId | pascalCase }}()

// Execute the operation
await execute({
  // Parameters based on OpenAPI spec
})

// Reactive version
const params = ref({ id: '123' })
const { data } = use{{ operationId | pascalCase }}Reactive(params)
{% endif %}
```

#### Using the API Client

```typescript
// Direct API client usage
const { $api } = useNuxtApp()

// Make requests
const response = await $api.get('/users')
const user = await $api.post('/users', { name: 'John', email: 'john@example.com' })
```

{% if enableStreaming %}
#### Streaming Responses

```typescript
const { $api } = useNuxtApp()

await $api.stream('/events', {
  onData: (chunk) => {
    console.log('Received:', chunk)
  },
  onError: (error) => {
    console.error('Stream error:', error)
  },
  onComplete: () => {
    console.log('Stream completed')
  }
})
```
{% endif %}

{% if enableRealtime %}
#### WebSocket Connection

```typescript
const { $api } = useNuxtApp()

const ws = $api.connectWebSocket('/notifications', {
  onMessage: (data) => {
    console.log('Received:', data)
  },
  onOpen: () => {
    console.log('Connected')
  },
  onClose: () => {
    console.log('Disconnected')
  }
})
```
{% endif %}

## 🔐 Authentication

{% if authProvider === 'jwt' %}
### JWT Authentication

```typescript
const { $auth } = useNuxtApp()

// Login
await $auth.login({ email: 'user@example.com', password: 'password' })

// Check authentication status
if ($auth.isAuthenticated()) {
  console.log('User is logged in')
}

// Get current user
const user = $auth.getUser()

// Logout
$auth.logout()
```
{% elif authProvider === 'oauth2' %}
### OAuth2 Authentication

```typescript
const { $auth } = useNuxtApp()

// Get authorization URL
const authUrl = $auth.getAuthorizationUrl({
  scopes: ['read', 'write'],
  state: '/dashboard'
})

// Redirect to OAuth provider
navigateTo(authUrl, { external: true })
```
{% elif authProvider === 'apiKey' %}
### API Key Authentication

```typescript
const { $auth } = useNuxtApp()

// Set API key
$auth.setAPIKey('your-api-key-here')

// Check if authenticated
if ($auth.isAuthenticated()) {
  console.log('API key is set')
}
```
{% endif %}

## 🧪 API Testing

Navigate to `/api-test` to access the interactive API testing interface. Each generated endpoint has a dedicated testing page with:

- **Form-based input**: Easy parameter and body input
- **JSON editor**: Raw JSON editing capability
- **Response viewer**: Formatted response display
- **Code examples**: cURL, JavaScript, and composable examples
- **Schema documentation**: Interactive schema browser

## 📊 Type Safety

All API responses and requests are fully typed based on your OpenAPI specification:

```typescript
// Types are automatically generated
import type { {{ schemaName || "User" }} } from '~/types/{{ schemaName | kebabCase || "user" }}'

// Type-safe operations
const user: {{ schemaName || "User" }} = await $api.get('/user/123')

// Validation functions
import { validate{{ schemaName || "User" }}, is{{ schemaName || "User" }} } from '~/types/{{ schemaName | kebabCase || "user" }}'

// Runtime validation
const result = validate{{ schemaName || "User" }}(data)
if (!result.valid) {
  console.error('Validation errors:', result.errors)
}

// Type guards
if (is{{ schemaName || "User" }}(data)) {
  // data is now typed as {{ schemaName || "User" }}
}
```

## 🔧 Configuration

### Template Configuration

The templates were generated with the following configuration:

```yaml
operationId: "{{ operationId || 'N/A' }}"
schemaName: "{{ schemaName || 'N/A' }}"
outputDir: "{{ outputDir || '.' }}"
baseUrl: "{{ baseUrl || '/api' }}"
authProvider: "{{ authProvider || 'none' }}"
uiFramework: "{{ uiFramework || 'nuxt-ui' }}"
enableStreaming: {{ enableStreaming | default(false) | tojson }}
enableCaching: {{ enableCaching | default(true) | tojson }}
enableRealtime: {{ enableRealtime | default(false) | tojson }}
generateTests: {{ generateTests | default(false) | tojson }}
```

### Nuxt Configuration

Key Nuxt modules and features:

{% if uiFramework === 'nuxt-ui' %}
- **@nuxt/ui**: Modern UI component library
{% endif %}
- **@pinia/nuxt**: State management
- **@vueuse/nuxt**: Composition utilities
{% if enablePWA %}
- **@vite-pwa/nuxt**: Progressive Web App
{% endif %}
{% if enableOpenTelemetry %}
- **@nuxt/telemetry**: Performance monitoring
{% endif %}

## 📚 RDF/Semantic Features

{% if enableSemanticAnnotations %}
This application includes semantic annotations using RDF/Turtle:

- **Schema definitions**: OpenAPI schemas mapped to RDF ontologies
- **Semantic queries**: SPARQL-like querying of API metadata
- **Linked data**: JSON-LD output for machine-readable API documentation

### RDF Schema

The OpenAPI specification is represented in RDF using the schema at `schemas/openapi.ttl`.

### Semantic Queries

```typescript
// Query operations by tag
const operations = rdf.operations.filter(op => op.tags.includes('users'))

// Query schemas by type
const objectSchemas = rdf.schemas.filter(schema => schema.type === 'object')
```
{% endif %}

## 🚀 Deployment

### Static Generation

```bash
# Generate static site
pnpm generate

# Deploy to static hosting (Vercel, Netlify, etc.)
```

### Server Deployment

```bash
# Build for server deployment
pnpm build

# Start production server
pnpm start
```

{% if generateDockerfile %}
### Docker Deployment

```bash
# Build Docker image
docker build -t {{ appName | kebabCase }} .

# Run container
docker run -p 3000:3000 {{ appName | kebabCase }}
```
{% endif %}

### Environment-Specific Builds

{% if generateNitroPreset %}
This project is configured for **{{ generateNitroPreset }}** deployment.

{% if generateNitroPreset === 'vercel' %}
Deploy to Vercel:
```bash
vercel --prod
```
{% elif generateNitroPreset === 'netlify' %}
Deploy to Netlify:
```bash
netlify deploy --prod
```
{% elif generateNitroPreset === 'cloudflare' %}
Deploy to Cloudflare Pages:
```bash
wrangler pages publish dist
```
{% endif %}
{% endif %}

## 🧪 Testing

{% if generateTests %}
### Running Tests

```bash
# Unit tests
pnpm test:unit

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e

# All tests
pnpm test
```

### Test Structure

- `tests/unit/`: Unit tests for composables and utilities
- `tests/integration/`: API integration tests
- `tests/e2e/`: End-to-end browser tests
{% endif %}

## 📈 Performance

### Optimization Features

{% if enableCaching %}
- **Response Caching**: Intelligent caching of API responses
{% endif %}
{% if enableOptimisticUpdates %}
- **Optimistic Updates**: UI updates before server confirmation
{% endif %}
- **Code Splitting**: Automatic code splitting for better performance
- **Tree Shaking**: Dead code elimination
{% if enablePWA %}
- **Service Worker**: Offline support and caching
{% endif %}

### Monitoring

{% if enableMetrics %}
Performance metrics are automatically collected and can be viewed in:

- Browser DevTools
- Server logs
- External monitoring services (if configured)
{% endif %}

## 🔍 Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Check environment variables
   - Verify token expiration
   - Ensure correct scopes/permissions

2. **CORS Issues**
   - Configure server CORS settings
   - Check API base URL

3. **Type Errors**
   - Regenerate types if OpenAPI spec changed
   - Check TypeScript configuration

### Debug Mode

Enable debug logging:

```bash
DEBUG=true pnpm dev
```

## 🤝 Contributing

This project was generated from OpenAPI specifications. To make changes:

1. Update the OpenAPI specification
2. Regenerate the templates using Unjucks
3. Test the generated code
4. Submit changes to the specification repository

## 📄 License

{{ license || "Generated code - see original OpenAPI specification for license terms" }}

---

**Generated by [Unjucks](https://github.com/unjs/unjucks)** - The next-generation code generator
**Template Version**: {{ templateVersion || "1.0.0" }}
**Generated At**: {{ generatedAt || new Date().toISOString() }}