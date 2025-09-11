# KGEN Production Deployment
# Multi-stage build for optimized production image

# Stage 1: Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git python3 make g++

# Copy package files
COPY package*.json ./
COPY packages/*/package.json ./packages/*/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build all packages
RUN npm run build

# Stage 2: Production stage
FROM node:18-alpine AS production

# Install system dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates \
    && addgroup -g 1001 -S kgen \
    && adduser -S kgen -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=kgen:kgen /app/packages/kgen-cli ./packages/kgen-cli
COPY --from=builder --chown=kgen:kgen /app/packages/kgen-core ./packages/kgen-core
COPY --from=builder --chown=kgen:kgen /app/packages/kgen-templates ./packages/kgen-templates
COPY --from=builder --chown=kgen:kgen /app/packages/kgen-rules ./packages/kgen-rules
COPY --from=builder --chown=kgen:kgen /app/package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Create necessary directories
RUN mkdir -p /app/.kgen/cache /app/.kgen/state /app/templates /app/rules /app/output \
    && chown -R kgen:kgen /app/.kgen /app/templates /app/rules /app/output

# Switch to non-root user
USER kgen

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD kgen --version || exit 1

# Set default command
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "packages/kgen-cli/bin/kgen.js"]

# Metadata
LABEL org.opencontainers.image.title="KGEN"
LABEL org.opencontainers.image.description="Knowledge Graph to Artifact Compilation Tool"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="KGEN Team"
LABEL org.opencontainers.image.source="https://github.com/kgen/kgen"