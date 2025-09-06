# Installation & Deployment Guide for Unjucks MCP

## Production Deployment Guide

This comprehensive guide covers production-grade deployment of the Unjucks MCP server for enterprise environments.

## Prerequisites

### System Requirements

**Minimum Requirements:**
- Node.js 18.0+ with ESM support
- 2GB RAM
- 1GB available disk space
- Unix-like OS (Linux, macOS) or Windows 10+

**Recommended for Production:**
- Node.js 20.0+ LTS
- 4GB+ RAM
- 5GB+ available disk space
- Linux server with systemd support
- Load balancer for multiple instances

### Network Requirements

- Outbound internet access for npm packages
- No inbound network access required (stdio transport)
- Optional: monitoring endpoint access (port 3000)

## Installation Methods

### 1. Global NPM Installation

```bash
# Install globally
npm install -g unjucks

# Verify installation
unjucks --version
unjucks-mcp --version

# Test MCP server
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | unjucks-mcp
```

### 2. Docker Installation

**Dockerfile:**
```dockerfile
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install unjucks globally
RUN npm install -g unjucks@latest

# Create non-root user
RUN addgroup -g 1001 -S unjucks && \
    adduser -S unjucks -u 1001 -G unjucks

# Switch to non-root user
USER unjucks

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | unjucks-mcp | grep -q "result" || exit 1

# Expose port for monitoring (optional)
EXPOSE 3000

# Start MCP server
CMD ["unjucks-mcp"]
```

**Build and run:**
```bash
# Build image
docker build -t unjucks-mcp .

# Run container
docker run -d \
  --name unjucks-mcp-server \
  --restart unless-stopped \
  -v /path/to/templates:/templates:ro \
  -v /path/to/output:/output \
  unjucks-mcp

# Test container
docker exec unjucks-mcp-server \
  sh -c 'echo "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}" | unjucks-mcp'
```

### 3. From Source Installation

```bash
# Clone repository
git clone https://github.com/unjs/unjucks.git
cd unjucks

# Install dependencies
npm install

# Build project
npm run build

# Link for global access
npm link

# Verify build
npm run test
npm run test:mcp
```

## Configuration Management

### Environment Variables

Create `/etc/unjucks/config.env`:
```bash
# Core configuration
NODE_ENV=production
DEBUG_UNJUCKS=false

# Templates directory
UNJUCKS_TEMPLATES_DIR=/opt/unjucks/templates

# Performance settings
UNJUCKS_MAX_CONCURRENT_OPS=10
UNJUCKS_CACHE_TTL=300000
UNJUCKS_OPERATION_TIMEOUT=30000

# Security settings
UNJUCKS_MAX_FILE_SIZE=104857600
UNJUCKS_MAX_TEMPLATE_DEPTH=10

# Monitoring
UNJUCKS_ENABLE_METRICS=true
UNJUCKS_METRICS_PORT=3000
UNJUCKS_LOG_LEVEL=info
```

### Configuration File

Create `/etc/unjucks/config.json`:
```json
{
  "server": {
    "name": "unjucks-mcp-production",
    "version": "1.0.0",
    "description": "Production Unjucks MCP Server"
  },
  "templates": {
    "directory": "/opt/unjucks/templates",
    "scanInterval": 300000,
    "maxDepth": 10
  },
  "security": {
    "maxFileSize": 104857600,
    "maxConcurrentOps": 10,
    "operationTimeout": 30000,
    "allowedPaths": [
      "/opt/unjucks/output",
      "/tmp/unjucks"
    ],
    "forbiddenPaths": [
      "/etc",
      "/root",
      "/sys",
      "/proc"
    ]
  },
  "performance": {
    "caching": {
      "enabled": true,
      "templateScan": 300000,
      "generatorList": 60000,
      "fileSystem": 30000
    },
    "batching": {
      "enabled": true,
      "maxBatchSize": 10,
      "batchTimeout": 5000
    }
  },
  "monitoring": {
    "enabled": true,
    "port": 3000,
    "path": "/metrics",
    "interval": 60000
  }
}
```

## Systemd Service Setup

### Service Configuration

Create `/etc/systemd/system/unjucks-mcp.service`:
```ini
[Unit]
Description=Unjucks MCP Server
Documentation=https://github.com/unjs/unjucks
After=network.target
Wants=network.target

[Service]
Type=simple
User=unjucks
Group=unjucks
WorkingDirectory=/opt/unjucks
ExecStart=/usr/local/bin/unjucks-mcp
ExecReload=/bin/kill -HUP $MAINPID
KillMode=process
Restart=on-failure
RestartSec=10
TimeoutStopSec=30

# Environment
Environment=NODE_ENV=production
EnvironmentFile=-/etc/unjucks/config.env

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/unjucks/output /tmp/unjucks
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true

# Resource limits
LimitNOFILE=65536
LimitNPROC=32768
MemoryMax=2G
TasksMax=4096

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=unjucks-mcp

[Install]
WantedBy=multi-user.target
```

### Service Management

```bash
# Create user for service
sudo useradd --system --shell /bin/false --home-dir /opt/unjucks unjucks

# Create directories
sudo mkdir -p /opt/unjucks/{templates,output,logs}
sudo chown -R unjucks:unjucks /opt/unjucks

# Install service
sudo systemctl daemon-reload
sudo systemctl enable unjucks-mcp.service

# Start service
sudo systemctl start unjucks-mcp.service

# Check status
sudo systemctl status unjucks-mcp.service

# View logs
sudo journalctl -u unjucks-mcp.service -f
```

## Load Balancing & High Availability

### HAProxy Configuration

Create `/etc/haproxy/haproxy.cfg`:
```
global
    daemon
    log 127.0.0.1:514 local0
    chroot /var/lib/haproxy
    stats socket /run/haproxy/admin.sock mode 660 level admin
    stats timeout 30s
    user haproxy
    group haproxy

defaults
    mode http
    log global
    option httplog
    option dontlognull
    timeout connect 5000
    timeout client 50000
    timeout server 50000

# MCP Server Pool
backend unjucks_mcp_servers
    balance roundrobin
    option httpchk GET /health
    server mcp1 127.0.0.1:3001 check
    server mcp2 127.0.0.1:3002 check
    server mcp3 127.0.0.1:3003 check

# Frontend for load balancing
frontend unjucks_mcp_frontend
    bind *:3000
    default_backend unjucks_mcp_servers

# Statistics
frontend stats
    bind *:8404
    stats enable
    stats uri /stats
    stats refresh 30s
```

### Multiple Instance Setup

**Instance 1 Service** (`/etc/systemd/system/unjucks-mcp@.service`):
```ini
[Unit]
Description=Unjucks MCP Server Instance %i
After=network.target

[Service]
Type=simple
User=unjucks
Group=unjucks
WorkingDirectory=/opt/unjucks
ExecStart=/usr/local/bin/unjucks-mcp --port=300%i
Environment=NODE_ENV=production
Environment=UNJUCKS_INSTANCE_ID=%i
EnvironmentFile=-/etc/unjucks/config.env

[Install]
WantedBy=multi-user.target
```

**Start multiple instances:**
```bash
# Start 3 instances
sudo systemctl enable unjucks-mcp@{1,2,3}.service
sudo systemctl start unjucks-mcp@{1,2,3}.service

# Check all instances
sudo systemctl status unjucks-mcp@*.service
```

## Monitoring & Observability

### Prometheus Integration

**Metrics endpoint configuration:**
```typescript
// Add to MCP server startup
import express from 'express';
import { register, collectDefaultMetrics } from 'prom-client';

const metricsApp = express();
collectDefaultMetrics();

// Custom metrics
const mcpRequestsTotal = new Counter({
  name: 'unjucks_mcp_requests_total',
  help: 'Total number of MCP requests',
  labelNames: ['method', 'tool', 'status']
});

const mcpRequestDuration = new Histogram({
  name: 'unjucks_mcp_request_duration_seconds', 
  help: 'Duration of MCP requests in seconds',
  labelNames: ['method', 'tool']
});

metricsApp.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

const port = process.env.UNJUCKS_METRICS_PORT || 3000;
metricsApp.listen(port, () => {
  console.log(`Metrics server listening on port ${port}`);
});
```

### Grafana Dashboard

**Dashboard JSON configuration:**
```json
{
  "dashboard": {
    "title": "Unjucks MCP Server",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(unjucks_mcp_requests_total[5m])",
            "legendFormat": "{{method}} {{tool}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph", 
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(unjucks_mcp_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(unjucks_mcp_requests_total{status=\"error\"}[5m])",
            "legendFormat": "Error rate"
          }
        ]
      }
    ]
  }
}
```

### Log Management

**Structured logging configuration:**
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.UNJUCKS_LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'unjucks-mcp' },
  transports: [
    new winston.transports.File({ 
      filename: '/opt/unjucks/logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: '/opt/unjucks/logs/combined.log' 
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

**Logrotate configuration** (`/etc/logrotate.d/unjucks-mcp`):
```
/opt/unjucks/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 unjucks unjucks
    postrotate
        systemctl reload unjucks-mcp
    endscript
}
```

## Security Hardening

### File System Permissions

```bash
# Set secure permissions
sudo chmod 750 /opt/unjucks
sudo chmod 755 /opt/unjucks/templates
sudo chmod 755 /opt/unjucks/output
sudo chmod 700 /opt/unjucks/logs

# Set SELinux contexts (if applicable)
sudo setsebool -P httpd_can_network_connect 1
sudo semanage fcontext -a -t httpd_exec_t "/opt/unjucks/bin/unjucks-mcp"
sudo restorecon -R /opt/unjucks
```

### Firewall Configuration

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow from 10.0.0.0/8 to any port 3000 comment 'MCP metrics'
sudo ufw deny 3000 comment 'Block external MCP access'

# iptables (RHEL/CentOS)
sudo iptables -A INPUT -s 10.0.0.0/8 -p tcp --dport 3000 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3000 -j DROP
```

### AppArmor Profile

Create `/etc/apparmor.d/unjucks-mcp`:
```
#include <tunables/global>

/usr/local/bin/unjucks-mcp {
  #include <abstractions/base>
  #include <abstractions/nameservice>

  # Allow execution
  /usr/local/bin/unjucks-mcp mr,
  /usr/bin/node ix,

  # Allow reading templates
  /opt/unjucks/templates/** r,
  
  # Allow writing output
  /opt/unjucks/output/** rw,
  
  # Allow temporary files
  /tmp/** rw,
  
  # Deny sensitive paths
  deny /etc/** r,
  deny /root/** r,
  deny /proc/sys/** r,
  
  # Allow logging
  /opt/unjucks/logs/** w,
}
```

## Backup & Recovery

### Automated Backup Script

Create `/opt/unjucks/bin/backup.sh`:
```bash
#!/bin/bash
set -euo pipefail

# Configuration
BACKUP_DIR="/opt/unjucks/backups"
S3_BUCKET="s3://your-backup-bucket/unjucks"
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="unjucks-backup-$TIMESTAMP.tar.gz"

# Create backup
tar -czf "$BACKUP_DIR/$BACKUP_FILE" \
  --exclude='*.log' \
  --exclude='tmp/*' \
  /opt/unjucks/templates \
  /opt/unjucks/output \
  /etc/unjucks

# Upload to S3 (optional)
if command -v aws &> /dev/null; then
  aws s3 cp "$BACKUP_DIR/$BACKUP_FILE" "$S3_BUCKET/"
fi

# Cleanup old backups
find "$BACKUP_DIR" -name "unjucks-backup-*.tar.gz" \
  -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $BACKUP_FILE"
```

### Cron Job Setup

```bash
# Edit crontab for unjucks user
sudo -u unjucks crontab -e

# Add backup job (daily at 2 AM)
0 2 * * * /opt/unjucks/bin/backup.sh >> /opt/unjucks/logs/backup.log 2>&1
```

### Recovery Procedure

```bash
#!/bin/bash
# Recovery script: /opt/unjucks/bin/recovery.sh

set -euo pipefail

BACKUP_FILE="$1"
TEMP_DIR="/tmp/unjucks-recovery-$$"

if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Stop service
sudo systemctl stop unjucks-mcp

# Create recovery directory
mkdir -p "$TEMP_DIR"

# Extract backup
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Restore files
sudo cp -r "$TEMP_DIR/opt/unjucks/templates" /opt/unjucks/
sudo cp -r "$TEMP_DIR/opt/unjucks/output" /opt/unjucks/
sudo cp -r "$TEMP_DIR/etc/unjucks" /etc/

# Fix permissions
sudo chown -R unjucks:unjucks /opt/unjucks
sudo chown -R root:root /etc/unjucks

# Start service
sudo systemctl start unjucks-mcp

# Cleanup
rm -rf "$TEMP_DIR"

echo "Recovery completed from: $BACKUP_FILE"
```

## Performance Tuning

### Node.js Optimization

```bash
# Add to service environment
NODE_OPTIONS="--max-old-space-size=2048 --optimize-for-size"
UV_THREADPOOL_SIZE=16
```

### OS-Level Tuning

Add to `/etc/sysctl.conf`:
```
# Network optimizations
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_max_syn_backlog = 65535

# File descriptor limits
fs.file-max = 2097152

# Memory management
vm.swappiness = 1
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
```

### Monitoring Commands

```bash
# Check service status
sudo systemctl status unjucks-mcp

# Monitor resource usage
top -p $(pgrep unjucks-mcp)
htop -p $(pgrep unjucks-mcp)

# Memory usage
sudo pmap -x $(pgrep unjucks-mcp)

# Network connections  
sudo netstat -tulpn | grep unjucks-mcp

# File descriptors
sudo lsof -p $(pgrep unjucks-mcp) | wc -l

# Log analysis
sudo journalctl -u unjucks-mcp -f --since "1 hour ago"
```

## Troubleshooting Guide

### Common Issues

**1. Service Won't Start**
```bash
# Check systemd logs
sudo journalctl -u unjucks-mcp --lines=50

# Check configuration
unjucks-mcp --validate-config

# Test manually
sudo -u unjucks unjucks-mcp --dry-run
```

**2. High Memory Usage**
```bash
# Enable memory monitoring
NODE_OPTIONS="--inspect=0.0.0.0:9229" unjucks-mcp

# Generate heap dump
kill -USR2 $(pgrep unjucks-mcp)

# Analyze with clinic.js
npx clinic doctor -- unjucks-mcp
```

**3. Performance Issues**
```bash
# Enable profiling
NODE_OPTIONS="--prof" unjucks-mcp

# Generate flame graph
npx clinic flame -- unjucks-mcp

# Monitor event loop
npx clinic bubbleprof -- unjucks-mcp
```

This comprehensive deployment guide ensures robust, secure, and scalable production deployment of the Unjucks MCP server.