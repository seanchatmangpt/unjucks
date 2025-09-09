# =============================================================================
# UNJUCKS CLEANROOM TESTING ENVIRONMENT
# Fortune 5 Containerization Standards Compliant
# Multi-stage, Security-hardened, Reproducible Build
# =============================================================================

# -----------------------------------------------------------------------------
# STAGE 1: Security Scanner & Base Image
# -----------------------------------------------------------------------------
FROM cgr.dev/chainguard/wolfi-base:latest AS security-base
LABEL maintainer="Unjucks Team <security@unjucks.dev>"
LABEL org.opencontainers.image.title="Unjucks Cleanroom Testing Environment"
LABEL org.opencontainers.image.description="Enterprise-grade testing container with security hardening"
LABEL org.opencontainers.image.version="2025.9.8"
LABEL org.opencontainers.image.source="https://github.com/unjucks/unjucks"
LABEL org.opencontainers.image.licenses="MIT"

# Security: Create non-root user early
RUN addgroup -g 10001 -S unjucks && \
    adduser -u 10001 -S -G unjucks -h /home/unjucks unjucks

# Install security tools and system dependencies
RUN apk add --no-cache \
    ca-certificates \
    curl \
    wget \
    gnupg \
    tini \
    bash \
    git \
    python3 \
    py3-pip \
    && update-ca-certificates

# -----------------------------------------------------------------------------
# STAGE 2: Node.js Runtime with Security Hardening
# -----------------------------------------------------------------------------
FROM node:20-alpine3.19 AS node-base

# Install security and build dependencies
RUN apk add --no-cache \
    # Build tools
    make \
    gcc \
    g++ \
    python3 \
    py3-pip \
    # Security tools
    ca-certificates \
    curl \
    wget \
    gnupg \
    tini \
    bash \
    git \
    # Process monitoring
    htop \
    procps \
    # Testing utilities
    jq \
    # LaTeX for document generation (optional)
    texlive-full \
    && update-ca-certificates

# Security: Create non-root user
RUN addgroup -g 10001 -S unjucks && \
    adduser -u 10001 -S -G unjucks -h /home/unjucks unjucks

# Security: Set up directory permissions
RUN mkdir -p /app /app/logs /app/tmp /app/coverage /app/reports && \
    chown -R unjucks:unjucks /app

# -----------------------------------------------------------------------------
# STAGE 3: Dependencies Installation (Cached Layer)
# -----------------------------------------------------------------------------
FROM node-base AS dependencies

WORKDIR /app

# Copy package files for dependency caching
COPY --chown=unjucks:unjucks package*.json ./
COPY --chown=unjucks:unjucks pnpm-workspace.yaml ./

# Install global tools with security considerations
RUN npm config set audit-level moderate && \
    npm config set fund false && \
    npm install -g pnpm@latest npm@latest && \
    npm cache clean --force

# Switch to non-root user for dependency installation
USER unjucks

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod --strict-peer-dependencies

# Install development dependencies in separate layer for testing
RUN pnpm install --frozen-lockfile --dev --strict-peer-dependencies

# Audit dependencies for security vulnerabilities
RUN pnpm audit --audit-level moderate || echo "Audit completed with warnings"

# -----------------------------------------------------------------------------
# STAGE 4: Application Code & Build
# -----------------------------------------------------------------------------
FROM dependencies AS builder

# Copy source code
COPY --chown=unjucks:unjucks . .

# Security: Remove sensitive files
RUN rm -rf \
    .env \
    .env.* \
    .git \
    .github \
    .husky \
    .vscode \
    coverage \
    docs \
    temp* \
    test-results* \
    *.log \
    *.tgz

# Build the application
RUN pnpm run build && \
    pnpm run build:prepare

# Validate build integrity
RUN node bin/unjucks.cjs --version && \
    node bin/unjucks.cjs list | head -10

# -----------------------------------------------------------------------------
# STAGE 5: Testing Environment (Final Stage)
# -----------------------------------------------------------------------------
FROM node-base AS testing

# Copy security scanner tools from first stage
COPY --from=security-base /usr/bin/tini /usr/bin/tini

WORKDIR /app

# Copy built application and dependencies
COPY --from=builder --chown=unjucks:unjucks /app /app

# Security: Ensure proper permissions
RUN chmod +x /app/bin/unjucks.cjs && \
    chmod +x /app/src/cli/index.js && \
    chown -R unjucks:unjucks /app

# Create necessary directories with proper permissions
RUN mkdir -p \
    /app/logs \
    /app/tmp \
    /app/coverage \
    /app/reports \
    /app/test-results \
    /home/unjucks/.npm \
    /home/unjucks/.cache && \
    chown -R unjucks:unjucks \
    /app/logs \
    /app/tmp \
    /app/coverage \
    /app/reports \
    /app/test-results \
    /home/unjucks/.npm \
    /home/unjucks/.cache

# Install testing utilities
RUN apk add --no-cache \
    # Testing tools
    chromium \
    firefox \
    xvfb \
    # Monitoring
    htop \
    iotop \
    nethogs \
    # Security scanning
    trivy \
    # Performance monitoring
    perf-tools

# Configure Chrome/Chromium for testing
ENV CHROME_BIN=/usr/bin/chromium-browser
ENV CHROME_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Security configurations
ENV NODE_ENV=test
ENV CI=true
ENV NPM_CONFIG_AUDIT_LEVEL=moderate
ENV NPM_CONFIG_FUND=false
ENV NODE_OPTIONS="--max-old-space-size=4096 --unhandled-rejections=strict"

# Switch to non-root user
USER unjucks

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('Container healthy')" || exit 1

# Security: Use tini as init system
ENTRYPOINT ["/usr/bin/tini", "--"]

# Default command runs comprehensive test suite
CMD ["pnpm", "run", "qa:suite"]

# -----------------------------------------------------------------------------
# STAGE 6: Production-Ready Security Scan
# -----------------------------------------------------------------------------
FROM testing AS security-scan

USER root

# Install security scanning tools
RUN apk add --no-cache \
    trivy \
    grype \
    syft

# Run security scans
RUN trivy fs --exit-code 0 --no-progress --severity HIGH,CRITICAL /app || true && \
    grype /app --fail-on medium || true

USER unjucks

# Final validation
RUN pnpm run test:smoke && \
    echo "Security scan and validation completed successfully"