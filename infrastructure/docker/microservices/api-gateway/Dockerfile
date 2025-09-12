# Multi-stage build for KGEN API Gateway Service
# Production-ready container with security hardening and optimization

# Build stage
FROM node:18-alpine3.18 AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    ca-certificates

# Set working directory
WORKDIR /app

# Copy package files for dependency resolution
COPY package*.json ./
COPY yarn.lock* ./

# Install dependencies with yarn for better caching
RUN yarn install --frozen-lockfile --production=false

# Copy source code
COPY src/ ./src/
COPY config/ ./config/
COPY public/ ./public/

# Build the application
RUN yarn build

# Production stage
FROM node:18-alpine3.18 AS production

# Set metadata
LABEL org.opencontainers.image.title="KGEN API Gateway"
LABEL org.opencontainers.image.description="Cloud-native API Gateway for KGEN multi-tenant platform"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.authors="KGEN Platform Team"
LABEL org.opencontainers.image.source="https://github.com/kgen-platform/kgen"
LABEL org.opencontainers.image.licenses="MIT"

# Install production dependencies and security updates
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates \
    tzdata && \
    rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S kgen && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G kgen -g kgen kgen

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY yarn.lock* ./

# Install production dependencies only
RUN yarn install --frozen-lockfile --production=true && \
    yarn cache clean

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/config ./config

# Copy additional configuration files
COPY docker/microservices/api-gateway/config/production.json ./config/
COPY docker/microservices/api-gateway/scripts/healthcheck.js ./scripts/
COPY docker/microservices/api-gateway/scripts/startup.sh ./scripts/

# Make scripts executable
RUN chmod +x scripts/*.sh

# Set ownership to non-root user
RUN chown -R kgen:kgen /app

# Switch to non-root user
USER kgen

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
ENV LOG_LEVEL=info
ENV HEALTHCHECK_PORT=8081

# Expose ports
EXPOSE 8080 8081

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node scripts/healthcheck.js

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["scripts/startup.sh"]

# Security hardening
RUN rm -rf /tmp/* /var/tmp/* /root/.npm /usr/local/lib/node_modules/npm/docs \
    /usr/local/lib/node_modules/npm/man /usr/local/lib/node_modules/npm/html