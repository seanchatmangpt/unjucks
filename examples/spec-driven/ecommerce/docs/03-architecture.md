# E-commerce Platform Architecture

## 1. System Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Load Balancer                          │
└─────────────────┬───────────────────────────────────────────────┘
                  │
┌─────────────────┴───────────────────────────────────────────────┐
│                        API Gateway                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │ Rate Limit  │ │    Auth     │ │   Routing   │ │  Logging    ││
│  │   Service   │ │  Service    │ │   Service   │ │  Service    ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────┬───────────────────────────────────────────────┘
                  │
┌─────────────────┴───────────────────────────────────────────────┐
│                    Microservices Layer                          │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐ │
│ │   Product    │ │     User     │ │    Order     │ │ Payment  │ │
│ │   Service    │ │   Service    │ │   Service    │ │ Service  │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘ │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐ │
│ │ Notification │ │  Analytics   │ │  Inventory   │ │ Shipping │ │
│ │   Service    │ │   Service    │ │   Service    │ │ Service  │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘ │
└─────────────────┬───────────────────────────────────────────────┘
                  │
┌─────────────────┴───────────────────────────────────────────────┐
│                       Data Layer                                │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐ │
│ │ PostgreSQL   │ │    Redis     │ │Elasticsearch │ │   S3     │ │
│ │  (Primary)   │ │   (Cache)    │ │  (Search)    │ │(Storage) │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

**Frontend:**
- React 18 with TypeScript
- Next.js for SSR/SSG
- Tailwind CSS for styling
- React Query for state management
- PWA capabilities

**Backend:**
- Node.js with TypeScript
- Express.js framework
- GraphQL with Apollo Server
- REST APIs for external integrations
- Docker containerization

**Data Storage:**
- PostgreSQL (primary database)
- Redis (caching and sessions)
- Elasticsearch (search engine)
- Amazon S3 (file storage)
- InfluxDB (metrics and analytics)

**Infrastructure:**
- AWS Cloud Platform
- Kubernetes orchestration
- Docker containers
- CloudFront CDN
- Application Load Balancer

## 2. Microservices Architecture

### 2.1 Service Boundaries

```typescript
interface ServiceBoundaries {
  ProductService: {
    responsibilities: [
      "Product catalog management",
      "Category hierarchy",
      "Product search and filtering",
      "Inventory tracking",
      "Price management"
    ],
    database: "products_db",
    apis: ["REST", "GraphQL"],
    events: ["ProductCreated", "ProductUpdated", "StockChanged"]
  },
  
  UserService: {
    responsibilities: [
      "User authentication",
      "Profile management", 
      "Address book",
      "Preferences",
      "Access control"
    ],
    database: "users_db",
    apis: ["REST", "GraphQL"],
    events: ["UserRegistered", "ProfileUpdated", "LoginAttempt"]
  },
  
  OrderService: {
    responsibilities: [
      "Order processing",
      "Order status tracking",
      "Order history",
      "Returns and refunds"
    ],
    database: "orders_db", 
    apis: ["REST", "GraphQL"],
    events: ["OrderPlaced", "OrderUpdated", "OrderCanceled"]
  },
  
  PaymentService: {
    responsibilities: [
      "Payment processing",
      "Transaction management",
      "Refund processing",
      "Payment method storage"
    ],
    database: "payments_db",
    apis: ["REST"],
    events: ["PaymentProcessed", "RefundIssued", "PaymentFailed"]
  }
}
```

### 2.2 Data Architecture

#### 2.2.1 Database Schema Design

**Products Database (PostgreSQL)**
```sql
-- Core product information
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id),
  vendor_id UUID REFERENCES vendors(id),
  base_price DECIMAL(10,2) NOT NULL,
  current_price DECIMAL(10,2) NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  weight DECIMAL(8,3),
  dimensions JSONB,
  attributes JSONB,
  images JSONB,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT positive_price CHECK (base_price > 0),
  CONSTRAINT positive_stock CHECK (stock_quantity >= 0)
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_vendor ON products(vendor_id);
CREATE INDEX idx_products_price ON products(current_price);
CREATE INDEX idx_products_stock ON products(stock_quantity);
CREATE INDEX idx_products_search ON products USING gin(to_tsvector('english', name || ' ' || description));
```

**Orders Database (PostgreSQL)**
```sql
-- Order management
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  subtotal DECIMAL(12,2) NOT NULL,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  shipping_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  shipping_address JSONB NOT NULL,
  billing_address JSONB NOT NULL,
  payment_method JSONB,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT positive_amounts CHECK (
    subtotal >= 0 AND 
    tax_amount >= 0 AND 
    shipping_amount >= 0 AND 
    total_amount >= 0
  )
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  product_sku VARCHAR(100) NOT NULL,
  product_name VARCHAR(500) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,
  product_options JSONB,
  
  CONSTRAINT positive_quantity CHECK (quantity > 0),
  CONSTRAINT positive_price CHECK (unit_price > 0)
);
```

#### 2.2.2 Caching Strategy (Redis)

```typescript
interface CacheStrategy {
  layers: {
    L1: {
      type: "In-Memory",
      ttl: "5 minutes",
      size: "500MB per service",
      useCase: "Frequently accessed data"
    },
    L2: {
      type: "Redis",
      ttl: "1 hour",
      size: "10GB cluster",
      useCase: "Cross-service shared data"
    },
    L3: {
      type: "CDN",
      ttl: "24 hours", 
      useCase: "Static assets and public data"
    }
  },
  
  cacheKeys: {
    products: "product:{id}",
    categories: "category:{id}:children",
    user_profile: "user:{id}:profile",
    shopping_cart: "cart:{user_id}",
    session: "session:{session_id}",
    search_results: "search:{query_hash}",
    inventory: "inventory:{product_id}"
  },
  
  invalidationPatterns: {
    product_update: ["product:*", "search:*", "category:*"],
    user_update: ["user:{id}:*"],
    order_placed: ["cart:{user_id}", "inventory:*"],
    stock_change: ["product:{id}", "inventory:{id}", "search:*"]
  }
}
```

### 2.3 Event-Driven Architecture

#### 2.3.1 Event Schema

```typescript
interface DomainEvent {
  id: string;
  aggregateId: string;
  eventType: string;
  eventVersion: string;
  timestamp: Date;
  data: Record<string, any>;
  metadata: {
    correlationId: string;
    causationId?: string;
    userId?: string;
    source: string;
  };
}

// Example Events
interface ProductCreatedEvent extends DomainEvent {
  eventType: 'ProductCreated';
  data: {
    productId: string;
    sku: string;
    name: string;
    categoryId: string;
    vendorId: string;
    price: number;
    stock: number;
  };
}

interface OrderPlacedEvent extends DomainEvent {
  eventType: 'OrderPlaced';
  data: {
    orderId: string;
    customerId: string;
    items: OrderItem[];
    total: number;
    paymentMethod: string;
    shippingAddress: Address;
  };
}
```

#### 2.3.2 Event Handlers

```typescript
@EventHandler('OrderPlaced')
class OrderPlacedHandler {
  constructor(
    private inventoryService: InventoryService,
    private notificationService: NotificationService,
    private shippingService: ShippingService
  ) {}
  
  async handle(event: OrderPlacedEvent): Promise<void> {
    const { orderId, customerId, items } = event.data;
    
    // Reserve inventory
    await Promise.all(
      items.map(item => 
        this.inventoryService.reserveStock(item.productId, item.quantity)
      )
    );
    
    // Send confirmation email
    await this.notificationService.sendOrderConfirmation(customerId, orderId);
    
    // Create shipping label
    await this.shippingService.createShippingLabel(orderId);
    
    // Notify vendors
    const vendors = this.groupItemsByVendor(items);
    await Promise.all(
      vendors.map(vendor => 
        this.notificationService.notifyVendorNewOrder(vendor.id, orderId)
      )
    );
  }
}
```

## 3. Security Architecture

### 3.1 Authentication & Authorization

```typescript
interface SecurityArchitecture {
  authentication: {
    method: "OAuth 2.0 + OpenID Connect",
    providers: ["Google", "Facebook", "Apple", "Email/Password"],
    tokenFormat: "JWT",
    tokenExpiry: {
      accessToken: "15 minutes",
      refreshToken: "30 days"
    },
    mfa: {
      enabled: true,
      methods: ["TOTP", "SMS", "Email"]
    }
  },
  
  authorization: {
    model: "RBAC (Role-Based Access Control)",
    roles: ["Customer", "Vendor", "Admin", "Support"],
    permissions: ["read", "write", "delete", "admin"],
    enforcement: "API Gateway + Service Level"
  },
  
  dataProtection: {
    encryption: {
      atRest: "AES-256-GCM",
      inTransit: "TLS 1.3",
      database: "Transparent Data Encryption"
    },
    pii: {
      classification: "GDPR Compliant",
      anonymization: "Hash + Salt for analytics",
      retention: "7 years (configurable)"
    }
  }
}
```

### 3.2 API Security

```typescript
// Rate limiting configuration
const rateLimitConfig = {
  global: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // requests per window
    standardHeaders: true,
    legacyHeaders: false
  },
  
  byEndpoint: {
    '/api/auth/login': { max: 10, windowMs: 15 * 60 * 1000 },
    '/api/auth/register': { max: 5, windowMs: 60 * 60 * 1000 },
    '/api/orders': { max: 100, windowMs: 15 * 60 * 1000 },
    '/api/search': { max: 500, windowMs: 15 * 60 * 1000 }
  },
  
  byUser: {
    authenticated: { max: 2000, windowMs: 15 * 60 * 1000 },
    anonymous: { max: 500, windowMs: 15 * 60 * 1000 }
  }
};

// Input validation middleware
class ValidationMiddleware {
  static validateRequest(schema: Joi.Schema) {
    return (req: Request, res: Response, next: NextFunction) => {
      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation Error',
          details: error.details.map(d => d.message)
        });
      }
      req.body = value;
      next();
    };
  }
}
```

## 4. Performance Architecture

### 4.1 Scalability Patterns

```typescript
interface ScalabilityArchitecture {
  horizontalScaling: {
    services: {
      productService: { minReplicas: 3, maxReplicas: 20 },
      orderService: { minReplicas: 2, maxReplicas: 15 },
      userService: { minReplicas: 2, maxReplicas: 10 },
      paymentService: { minReplicas: 2, maxReplicas: 8 }
    },
    triggers: [
      { metric: "CPU", threshold: "70%", scaleUp: 2 },
      { metric: "Memory", threshold: "80%", scaleUp: 1 },
      { metric: "RequestRate", threshold: "1000/min", scaleUp: 3 }
    ]
  },
  
  loadBalancing: {
    algorithm: "WeightedRoundRobin",
    healthChecks: {
      interval: "30s",
      timeout: "5s",
      unhealthyThreshold: 3,
      healthyThreshold: 2
    },
    sessionAffinity: false // Use Redis for sessions
  },
  
  databaseScaling: {
    readReplicas: 3,
    writeSharding: {
      strategy: "Range-based on tenant_id",
      shards: 4
    },
    connectionPooling: {
      min: 5,
      max: 20,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 600000
    }
  }
}
```

### 4.2 Caching Architecture

```typescript
class CacheManager {
  private l1Cache: Map<string, CacheEntry> = new Map();
  private l2Cache: Redis.Redis;
  
  async get<T>(key: string, fallback: () => Promise<T>, ttl: number = 3600): Promise<T> {
    // L1 Cache (In-Memory)
    const l1Entry = this.l1Cache.get(key);
    if (l1Entry && !this.isExpired(l1Entry)) {
      return l1Entry.value as T;
    }
    
    // L2 Cache (Redis)
    const l2Value = await this.l2Cache.get(key);
    if (l2Value) {
      const value = JSON.parse(l2Value) as T;
      this.setL1Cache(key, value, Math.min(ttl, 300)); // Max 5min in L1
      return value;
    }
    
    // Fallback to source
    const value = await fallback();
    
    // Store in both caches
    await this.l2Cache.setex(key, ttl, JSON.stringify(value));
    this.setL1Cache(key, value, Math.min(ttl, 300));
    
    return value;
  }
  
  async invalidate(pattern: string): Promise<void> {
    // Invalidate L1 cache
    for (const key of this.l1Cache.keys()) {
      if (this.matchesPattern(key, pattern)) {
        this.l1Cache.delete(key);
      }
    }
    
    // Invalidate L2 cache
    const keys = await this.l2Cache.keys(pattern);
    if (keys.length > 0) {
      await this.l2Cache.del(...keys);
    }
  }
}
```

## 5. Monitoring & Observability

### 5.1 Metrics Architecture

```typescript
interface MonitoringArchitecture {
  metrics: {
    business: [
      "orders_per_minute",
      "revenue_per_hour", 
      "cart_abandonment_rate",
      "conversion_rate",
      "average_order_value"
    ],
    technical: [
      "request_latency_p95",
      "error_rate_5xx",
      "database_connection_pool_usage",
      "cache_hit_ratio",
      "queue_depth"
    ],
    infrastructure: [
      "cpu_usage_percent",
      "memory_usage_percent",
      "disk_io_utilization",
      "network_bandwidth_usage"
    ]
  },
  
  alerting: {
    critical: [
      { metric: "error_rate_5xx", threshold: "> 1%", action: "PagerDuty" },
      { metric: "request_latency_p95", threshold: "> 1000ms", action: "Slack" },
      { metric: "payment_failure_rate", threshold: "> 5%", action: "PagerDuty" }
    ],
    warning: [
      { metric: "cpu_usage_percent", threshold: "> 80%", action: "Email" },
      { metric: "cache_hit_ratio", threshold: "< 70%", action: "Slack" }
    ]
  },
  
  logging: {
    levels: ["ERROR", "WARN", "INFO", "DEBUG"],
    structure: "JSON",
    retention: {
      error: "90 days",
      application: "30 days", 
      access: "7 days"
    },
    sampling: {
      debug: "1%",
      info: "10%",
      warn: "100%",
      error: "100%"
    }
  }
}
```

### 5.2 Distributed Tracing

```typescript
// OpenTelemetry configuration
const tracing = getNodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'ecommerce-platform',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  }),
  spanProcessors: [
    new BatchSpanProcessor(new OTLPTraceExporter({
      url: 'https://jaeger-collector:14268/api/traces',
    })),
  ],
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
    }),
    new HttpInstrumentation({
      ignoreIncomingRequestHook: (req) => {
        return req.url?.includes('/health') || false;
      },
    }),
    new ExpressInstrumentation(),
    new RedisInstrumentation(),
    new PgInstrumentation(),
  ],
});

// Custom span creation
class TracingService {
  static async traceAsyncOperation<T>(
    name: string,
    operation: (span: Span) => Promise<T>,
    attributes?: Record<string, any>
  ): Promise<T> {
    const tracer = trace.getTracer('ecommerce-platform');
    return tracer.startActiveSpan(name, { attributes }, async (span) => {
      try {
        const result = await operation(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }
}
```

This architecture design provides a comprehensive blueprint for implementing the e-commerce platform, addressing scalability, security, performance, and observability requirements while maintaining clean separation of concerns and enabling future growth.