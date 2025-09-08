# Multi-stage Dockerfile for clean test environment
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    git \
    bash \
    findutils \
    curl \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files
COPY ../../package*.json ./
COPY ../../pnpm-lock.yaml* ./

# Install dependencies
RUN npm install --production=false

# Copy source code
COPY ../../src ./src
COPY ../../bin ./bin
COPY ../../_templates ./_templates
COPY ../../templates ./templates
COPY ../../scripts ./scripts

# Copy all tests
COPY ../../tests ./tests

# Make binaries executable
RUN chmod +x bin/unjucks.cjs && \
    chmod +x src/cli/index.js

# Set up test environment
ENV NODE_ENV=test
ENV PATH="/app/bin:$PATH"

# Create test user (non-root for security)
RUN addgroup -g 1001 testuser && \
    adduser -D -u 1001 -G testuser testuser && \
    chown -R testuser:testuser /app

USER testuser

# Run master test orchestrator
CMD ["node", "tests/docker-validation/run-all-tests.js"]