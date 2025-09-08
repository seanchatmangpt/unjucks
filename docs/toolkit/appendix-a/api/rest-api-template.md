# REST API Specification Template

## Document Information

| Field | Value |
|-------|-------|
| API Name | `[API_NAME]` |
| API Version | `[API_VERSION]` |
| Document Version | `[DOC_VERSION]` |
| Last Updated | `[DATE]` |
| Authors | `[AUTHOR_NAMES]` |
| Base URL | `[BASE_URL]` |

## Table of Contents

1. [Overview](#1-overview)
2. [Authentication](#2-authentication)
3. [Common Patterns](#3-common-patterns)
4. [Endpoints](#4-endpoints)
5. [Data Models](#5-data-models)
6. [Error Handling](#6-error-handling)
7. [Rate Limiting](#7-rate-limiting)
8. [Examples](#8-examples)

## 1. Overview

### 1.1 Purpose
`[API_PURPOSE_DESCRIPTION]`

### 1.2 API Principles
- RESTful design following HTTP semantics
- JSON request/response format
- Stateless communication
- Resource-based URLs
- Proper HTTP status codes

### 1.3 Base URL
```
Production: [PROD_BASE_URL]
Staging: [STAGING_BASE_URL]
Development: [DEV_BASE_URL]
```

### 1.4 Version Information
- Current Version: `[CURRENT_VERSION]`
- Supported Versions: `[SUPPORTED_VERSIONS]`
- Deprecation Policy: `[DEPRECATION_POLICY]`

## 2. Authentication

### 2.1 Authentication Methods

#### 2.1.1 Bearer Token Authentication
```http
Authorization: Bearer <access_token>
```

#### 2.1.2 API Key Authentication
```http
X-API-Key: <api_key>
```

### 2.2 Token Management

#### Obtain Access Token
```http
POST /auth/token
Content-Type: application/json

{
  "grant_type": "client_credentials",
  "client_id": "your_client_id",
  "client_secret": "your_client_secret"
}
```

#### Response
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "read write"
}
```

### 2.3 Authorization Scopes
- `read`: Read access to resources
- `write`: Create and update resources
- `delete`: Delete resources
- `admin`: Administrative operations

## 3. Common Patterns

### 3.1 Request Headers
```http
Content-Type: application/json
Authorization: Bearer <token>
Accept: application/json
X-API-Version: v1
X-Request-ID: <unique_request_id>
```

### 3.2 Response Headers
```http
Content-Type: application/json
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
X-Request-ID: <unique_request_id>
```

### 3.3 Pagination
#### Request Parameters
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `sort`: Sort field
- `order`: Sort direction (asc/desc)

#### Response Format
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8,
    "has_next": true,
    "has_prev": false
  },
  "links": {
    "self": "/api/v1/resources?page=1&limit=20",
    "next": "/api/v1/resources?page=2&limit=20",
    "prev": null,
    "first": "/api/v1/resources?page=1&limit=20",
    "last": "/api/v1/resources?page=8&limit=20"
  }
}
```

### 3.4 Filtering and Searching
- `filter[field]`: Filter by field value
- `search`: Full-text search
- `fields`: Select specific fields to return

Example:
```
GET /api/v1/users?filter[status]=active&search=john&fields=id,name,email
```

## 4. Endpoints

### 4.1 Resource: `[RESOURCE_NAME]`

#### 4.1.1 List `[RESOURCE_PLURAL]`
```http
GET /api/v1/[resource_plural]
```

**Description**: Retrieve a paginated list of `[RESOURCE_PLURAL]`.

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| page | integer | No | Page number (default: 1) |
| limit | integer | No | Items per page (default: 20) |
| filter[`field`] | string | No | Filter by field value |
| sort | string | No | Sort field |
| order | string | No | Sort order (asc/desc) |

**Response**: `200 OK`
```json
{
  "data": [
    {
      "id": 1,
      "name": "Example Resource",
      "description": "Resource description",
      "status": "active",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

#### 4.1.2 Get `[RESOURCE_SINGULAR]`
```http
GET /api/v1/[resource_plural]/{id}
```

**Description**: Retrieve a specific `[RESOURCE_SINGULAR]` by ID.

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | integer | Yes | Resource ID |
| fields | string | No | Comma-separated list of fields to include |

**Response**: `200 OK`
```json
{
  "data": {
    "id": 1,
    "name": "Example Resource",
    "description": "Resource description",
    "status": "active",
    "metadata": {
      "key": "value"
    },
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

#### 4.1.3 Create `[RESOURCE_SINGULAR]`
```http
POST /api/v1/[resource_plural]
```

**Description**: Create a new `[RESOURCE_SINGULAR]`.

**Request Body**:
```json
{
  "name": "New Resource",
  "description": "Resource description",
  "status": "active",
  "metadata": {
    "key": "value"
  }
}
```

**Validation Rules**:
- `name`: Required, string, 1-255 characters
- `description`: Optional, string, max 1000 characters
- `status`: Optional, enum [active, inactive], default: active

**Response**: `201 Created`
```json
{
  "data": {
    "id": 2,
    "name": "New Resource",
    "description": "Resource description",
    "status": "active",
    "metadata": {
      "key": "value"
    },
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "message": "Resource created successfully"
}
```

#### 4.1.4 Update `[RESOURCE_SINGULAR]`
```http
PUT /api/v1/[resource_plural]/{id}
PATCH /api/v1/[resource_plural]/{id}
```

**Description**: Update a `[RESOURCE_SINGULAR]`. PUT replaces the entire resource, PATCH updates specific fields.

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | integer | Yes | Resource ID |

**Request Body** (PATCH example):
```json
{
  "status": "inactive",
  "description": "Updated description"
}
```

**Response**: `200 OK`
```json
{
  "data": {
    "id": 1,
    "name": "Example Resource",
    "description": "Updated description",
    "status": "inactive",
    "metadata": {
      "key": "value"
    },
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T01:00:00Z"
  },
  "message": "Resource updated successfully"
}
```

#### 4.1.5 Delete `[RESOURCE_SINGULAR]`
```http
DELETE /api/v1/[resource_plural]/{id}
```

**Description**: Delete a `[RESOURCE_SINGULAR]`.

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | integer | Yes | Resource ID |

**Response**: `204 No Content`

### 4.2 Bulk Operations

#### 4.2.1 Bulk Create
```http
POST /api/v1/[resource_plural]/bulk
```

**Request Body**:
```json
{
  "data": [
    {
      "name": "Resource 1",
      "description": "Description 1"
    },
    {
      "name": "Resource 2",
      "description": "Description 2"
    }
  ]
}
```

#### 4.2.2 Bulk Update
```http
PATCH /api/v1/[resource_plural]/bulk
```

#### 4.2.3 Bulk Delete
```http
DELETE /api/v1/[resource_plural]/bulk
```

**Request Body**:
```json
{
  "ids": [1, 2, 3]
}
```

## 5. Data Models

### 5.1 `[RESOURCE_SINGULAR]` Model
```json
{
  "id": "integer - Unique identifier",
  "name": "string - Resource name (1-255 chars, required)",
  "description": "string - Resource description (max 1000 chars, optional)",
  "status": "enum - Resource status [active, inactive, pending]",
  "metadata": "object - Additional key-value data (optional)",
  "created_at": "string - ISO 8601 datetime (read-only)",
  "updated_at": "string - ISO 8601 datetime (read-only)",
  "created_by": "integer - User ID who created the resource (read-only)",
  "updated_by": "integer - User ID who last updated the resource (read-only)"
}
```

### 5.2 Validation Schema (JSON Schema)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 255
    },
    "description": {
      "type": "string",
      "maxLength": 1000
    },
    "status": {
      "type": "string",
      "enum": ["active", "inactive", "pending"]
    },
    "metadata": {
      "type": "object",
      "additionalProperties": true
    }
  },
  "required": ["name"],
  "additionalProperties": false
}
```

## 6. Error Handling

### 6.1 Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request data is invalid",
    "details": {
      "field_errors": {
        "name": ["Name is required"],
        "email": ["Email must be valid"]
      }
    },
    "request_id": "req_123456",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

### 6.2 HTTP Status Codes
| Code | Name | Description |
|------|------|-------------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Access denied |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict |
| 422 | Unprocessable Entity | Validation errors |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Service temporarily unavailable |

### 6.3 Error Codes
- `VALIDATION_ERROR`: Request validation failed
- `AUTHENTICATION_REQUIRED`: Authentication token missing
- `AUTHENTICATION_FAILED`: Invalid authentication token
- `AUTHORIZATION_FAILED`: Insufficient permissions
- `RESOURCE_NOT_FOUND`: Requested resource doesn't exist
- `RESOURCE_CONFLICT`: Resource already exists or state conflict
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Unexpected server error

## 7. Rate Limiting

### 7.1 Rate Limits
- **Authenticated**: 1000 requests per hour per user
- **Unauthenticated**: 100 requests per hour per IP
- **Burst**: Up to 10 requests per second

### 7.2 Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
Retry-After: 3600
```

### 7.3 Rate Limit Response
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 3600 seconds.",
    "details": {
      "limit": 1000,
      "remaining": 0,
      "reset_at": "2024-01-01T01:00:00Z"
    }
  }
}
```

## 8. Examples

### 8.1 Complete CRUD Example

#### Create a Resource
```bash
curl -X POST https://api.example.com/v1/users \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "status": "active"
  }'
```

#### List Resources with Filtering
```bash
curl -X GET "https://api.example.com/v1/users?filter[status]=active&limit=10" \
  -H "Authorization: Bearer your_token"
```

#### Update a Resource
```bash
curl -X PATCH https://api.example.com/v1/users/123 \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "inactive"
  }'
```

#### Delete a Resource
```bash
curl -X DELETE https://api.example.com/v1/users/123 \
  -H "Authorization: Bearer your_token"
```

### 8.2 Bulk Operations Example
```bash
curl -X POST https://api.example.com/v1/users/bulk \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "data": [
      {
        "name": "User 1",
        "email": "user1@example.com"
      },
      {
        "name": "User 2",
        "email": "user2@example.com"
      }
    ]
  }'
```

---

## Template Usage Notes

### For Unjucks Integration:
```yaml
# frontmatter for REST API spec generation
---
to: docs/api/<%= apiName.toLowerCase() %>-rest-api.md
inject: false
skipIf: exists
---
```

### Variables to Customize:
- Replace all `[PLACEHOLDER]` values with your API specifics
- Adapt resource endpoints to your domain model
- Update authentication methods based on your security requirements
- Modify error codes and status codes as needed

### OpenAPI Integration:
This specification can be converted to OpenAPI 3.0 format using tools like:
- Swagger Editor
- Postman
- Insomnia
- Custom conversion scripts

### Testing Integration:
- Generate Postman collections from this specification
- Create automated API tests using the examples
- Set up contract testing with tools like Pact
- Include performance testing scenarios

### Documentation Maintenance:
- Keep examples up-to-date with actual API behavior
- Version the API specification alongside code changes
- Validate examples against live API regularly
- Update authentication and rate limiting as they evolve