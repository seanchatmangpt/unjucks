# KGEN Knowledge Graph Engine
# Multi-stage production Docker build

# Build stage
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates

# Create app user
RUN addgroup -g 1001 -S kgen && \
    adduser -S kgen -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application
COPY --from=builder --chown=kgen:kgen /app/src ./src
COPY --from=builder --chown=kgen:kgen /app/bin ./bin
COPY --from=builder --chown=kgen:kgen /app/_templates ./_templates
COPY --chown=kgen:kgen ./docker/kgen/docker-entrypoint.sh /usr/local/bin/

# Set permissions
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    chmod +x bin/unjucks.cjs && \
    chmod +x src/cli/index.js

# Create directories
RUN mkdir -p logs uploads temp && \
    chown -R kgen:kgen logs uploads temp

# Switch to non-root user
USER kgen

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["docker-entrypoint.sh"]