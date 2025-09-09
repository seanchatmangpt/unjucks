# Incident Response Runbook

**Target Audience**: SRE, DevOps, On-Call Engineers  
**Severity**: High Priority  
**Last Updated**: September 2025  
**Version**: 2.0

## Emergency Contacts

| Role | Primary | Backup | Escalation |
|------|---------|--------|------------|
| **On-Call Engineer** | +1-555-0123 | +1-555-0124 | +1-555-0125 |
| **Database DBA** | +1-555-0126 | +1-555-0127 | +1-555-0128 |
| **Security Team** | +1-555-0129 | +1-555-0130 | +1-555-0131 |
| **Platform Lead** | +1-555-0132 | +1-555-0133 | +1-555-0134 |
| **CTO** | +1-555-0135 | N/A | N/A |

### Communication Channels
- **Slack**: `#incident-response-prod`
- **Conference Bridge**: +1-555-0199
- **Status Page**: https://status.company.com
- **War Room**: Building A, Conference Room 1

## Incident Classification

### Severity Levels

#### 🔴 **SEV-1: Critical** 
- **Impact**: Complete service unavailability, data loss, security breach
- **Response Time**: Immediate (< 5 minutes)
- **Resolution Target**: 1 hour
- **Notification**: CEO, CTO, All Engineering Leadership

#### 🟠 **SEV-2: High**
- **Impact**: Significant degradation, major features unavailable
- **Response Time**: 15 minutes
- **Resolution Target**: 4 hours
- **Notification**: Engineering Leadership, Product Management

#### 🟡 **SEV-3: Medium**
- **Impact**: Minor feature degradation, workarounds available
- **Response Time**: 1 hour
- **Resolution Target**: 24 hours
- **Notification**: Team leads, On-call engineer

#### 🟢 **SEV-4: Low**
- **Impact**: Minor issues, no user impact
- **Response Time**: Next business day
- **Resolution Target**: 72 hours
- **Notification**: Development team

## Incident Response Process

### Phase 1: Detection & Initial Response (0-5 minutes)

#### 1.1 Incident Detection Sources
- **Automated Alerts**: Prometheus, New Relic, PagerDuty
- **User Reports**: Support tickets, social media
- **Internal Discovery**: Engineering team, QA
- **Third Party**: AWS/GCP status, dependency monitoring

#### 1.2 Immediate Actions
```bash
# Step 1: Acknowledge the incident
curl -X POST https://api.pagerduty.com/incidents/{id}/acknowledge \
  -H "Authorization: Token token=${PAGERDUTY_TOKEN}"

# Step 2: Create incident channel
/incident create-channel production-incident-$(date +%Y%m%d-%H%M)

# Step 3: Initial assessment
kubectl get pods -n production
docker service ls
systemctl status unjucks-app
```

#### 1.3 Initial Triage Questions
- Is the application responding to health checks?
- Are users able to login/authenticate?
- Is data being written to the database?
- Are any error rates elevated?
- Is this affecting all users or a subset?

### Phase 2: Assessment & Communication (5-15 minutes)

#### 2.1 Service Health Check
```bash
# Application health
curl -f https://unjucks.company.com/health || echo "APP DOWN"

# Database connectivity
curl -f https://unjucks.company.com/health/db || echo "DB DOWN"

# Redis connectivity
curl -f https://unjucks.company.com/health/redis || echo "REDIS DOWN"

# Load balancer status
curl -I https://unjucks.company.com || echo "LB DOWN"

# DNS resolution
nslookup unjucks.company.com || echo "DNS ISSUE"
```

#### 2.2 Key Metrics Dashboard
Access monitoring dashboards:
- **Application**: https://grafana.company.com/d/unjucks-app
- **Infrastructure**: https://grafana.company.com/d/unjucks-infra  
- **Database**: https://grafana.company.com/d/unjucks-db
- **Redis**: https://grafana.company.com/d/unjucks-redis

#### 2.3 Log Analysis
```bash
# Application logs (last 15 minutes)
kubectl logs -n production deployment/unjucks-app --since=15m | grep -E "ERROR|FATAL"

# Database logs
tail -f /var/log/postgresql/postgresql.log | grep -E "ERROR|FATAL"

# Redis logs  
tail -f /var/log/redis/redis-server.log | grep -E "WARNING|ERROR"

# Load balancer logs
tail -f /var/log/nginx/error.log | grep -E "error|crit"
```

#### 2.4 Communication
- Update status page with initial findings
- Post in `#incident-response-prod` Slack channel
- Send initial notification email to stakeholders
- Join conference bridge if SEV-1 or SEV-2

### Phase 3: Investigation & Diagnosis (15-30 minutes)

#### 3.1 Application Layer Investigation
```bash
# Check application metrics
curl -s https://unjucks.company.com/metrics | grep -E "http_requests_total|http_request_duration"

# Check for memory leaks
kubectl top pods -n production | grep unjucks

# Check for high CPU usage
kubectl exec -n production deployment/unjucks-app -- top -n 1

# Check application errors
kubectl logs -n production deployment/unjucks-app --since=30m | \
  grep -E "ERROR|Exception|Stack trace"
```

#### 3.2 Database Investigation
```bash
# Check active connections
psql -h db.company.com -U monitoring -c "
  SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active';
"

# Check for long-running queries
psql -h db.company.com -U monitoring -c "
  SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
  FROM pg_stat_activity 
  WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';
"

# Check database locks
psql -h db.company.com -U monitoring -c "
  SELECT blocked_locks.pid AS blocked_pid, blocked_activity.usename AS blocked_user,
         blocking_locks.pid AS blocking_pid, blocking_activity.usename AS blocking_user,
         blocked_activity.query AS blocked_statement,
         blocking_activity.query AS current_statement_in_blocking_process
  FROM pg_catalog.pg_locks blocked_locks
  JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
  JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
  JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
  WHERE NOT blocked_locks.GRANTED;
"

# Check disk space
df -h | grep postgres
```

#### 3.3 Redis Investigation
```bash
# Redis connection test
redis-cli -h redis.company.com ping

# Check Redis memory usage
redis-cli -h redis.company.com info memory | grep used_memory_human

# Check Redis slow queries
redis-cli -h redis.company.com slowlog get 10

# Check Redis client connections
redis-cli -h redis.company.com info clients
```

#### 3.4 Infrastructure Investigation
```bash
# Check node resources
kubectl describe nodes | grep -A 5 "Allocated resources"

# Check network connectivity
ping -c 3 db.company.com
ping -c 3 redis.company.com
ping -c 3 api.company.com

# Check disk space on nodes
kubectl exec -n production deployment/unjucks-app -- df -h

# Check system load
kubectl exec -n production deployment/unjucks-app -- uptime
```

### Phase 4: Immediate Mitigation (30-60 minutes)

#### 4.1 Common Mitigation Actions

##### High CPU/Memory Usage
```bash
# Scale up application instances
kubectl scale deployment/unjucks-app --replicas=6 -n production

# Restart application pods (rolling restart)
kubectl rollout restart deployment/unjucks-app -n production

# Check pod resource limits
kubectl describe deployment unjucks-app -n production | grep -A 10 "Limits"
```

##### Database Issues
```bash
# Kill long-running queries
psql -h db.company.com -U admin -c "
  SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
  WHERE (now() - pg_stat_activity.query_start) > interval '10 minutes'
  AND query NOT LIKE '%IDLE%';
"

# Restart database connections
kubectl rollout restart deployment/unjucks-app -n production

# Switch to read replica (if write operations can be delayed)
# Update DB_HOST to point to read replica temporarily
```

##### Redis Issues
```bash
# Flush Redis cache (if safe)
redis-cli -h redis.company.com flushall

# Restart Redis connection pool
kubectl rollout restart deployment/unjucks-app -n production

# Scale Redis (if using cluster)
# Contact infrastructure team for Redis scaling
```

##### Network/Load Balancer Issues
```bash
# Check load balancer health
curl -I https://unjucks.company.com

# Check SSL certificate expiry
echo | openssl s_client -connect unjucks.company.com:443 2>/dev/null | \
  openssl x509 -noout -dates

# Drain problematic nodes
kubectl drain node-name --ignore-daemonsets --delete-emptydir-data
```

#### 4.2 Emergency Procedures

##### Circuit Breaker Activation
```bash
# Enable maintenance mode (if available)
kubectl patch configmap unjucks-config -n production \
  --patch '{"data":{"MAINTENANCE_MODE":"true"}}'

# Restart to apply changes
kubectl rollout restart deployment/unjucks-app -n production
```

##### Database Failover
```bash
# Manual failover to backup database
# 1. Update DNS or load balancer to point to backup
# 2. Update application config
kubectl patch secret unjucks-secrets -n production \
  --patch '{"data":{"DB_HOST":"YmFja3VwLWRiLmNvbXBhbnkuY29t"}}'  # base64 encoded

# 3. Restart application
kubectl rollout restart deployment/unjucks-app -n production
```

##### Rollback Deployment
```bash
# Check rollout history
kubectl rollout history deployment/unjucks-app -n production

# Rollback to previous version
kubectl rollout undo deployment/unjucks-app -n production

# Rollback to specific revision
kubectl rollout undo deployment/unjucks-app --to-revision=2 -n production
```

### Phase 5: Resolution & Recovery

#### 5.1 Verification Steps
```bash
# Verify application health
curl -f https://unjucks.company.com/health
curl -f https://unjucks.company.com/health/db
curl -f https://unjucks.company.com/health/redis

# Test critical user journeys
# Login flow
curl -X POST https://unjucks.company.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@company.com","password":"test123"}'

# API endpoint test
curl -H "Authorization: Bearer ${TEST_TOKEN}" \
  https://unjucks.company.com/api/templates

# Generate test (core functionality)
curl -X POST https://unjucks.company.com/api/generate \
  -H "Authorization: Bearer ${TEST_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"generator":"component","template":"react","name":"TestComponent"}'
```

#### 5.2 Performance Validation
```bash
# Load test critical endpoints
ab -n 100 -c 10 https://unjucks.company.com/

# Monitor response times
curl -o /dev/null -s -w "%{time_total}\n" https://unjucks.company.com/

# Check error rates in logs
kubectl logs -n production deployment/unjucks-app --since=10m | \
  grep -c ERROR
```

### Phase 6: Post-Incident Activities

#### 6.1 Immediate Cleanup
- Remove emergency configurations
- Scale back to normal instance counts
- Clear maintenance mode flags
- Update monitoring thresholds if needed

#### 6.2 Communication Updates
- Update status page with resolution
- Send all-clear notification
- Post summary in incident channel
- Schedule post-mortem meeting

#### 6.3 Documentation
- Update incident timeline
- Document root cause analysis
- Record lessons learned
- Update runbooks based on findings

## Common Incident Scenarios

### Scenario 1: Database Connection Pool Exhaustion

**Symptoms**: 
- High response times
- "Connection pool exhausted" errors
- Database connection count at maximum

**Investigation**:
```bash
# Check active connections
psql -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"

# Check connection pool metrics
curl -s https://unjucks.company.com/metrics | grep db_pool
```

**Resolution**:
```bash
# Increase pool size temporarily
kubectl patch configmap unjucks-config -n production \
  --patch '{"data":{"DB_POOL_MAX":"40"}}'

# Restart application
kubectl rollout restart deployment/unjucks-app -n production

# Long-term: Optimize queries, implement connection retry logic
```

### Scenario 2: Redis Memory Exhaustion

**Symptoms**:
- Cache miss ratio increasing
- Redis OOM errors
- Session data loss

**Investigation**:
```bash
# Check Redis memory usage
redis-cli info memory

# Check eviction policy
redis-cli config get maxmemory-policy
```

**Resolution**:
```bash
# Clear non-essential cache
redis-cli --scan --pattern "cache:*" | xargs redis-cli del

# Implement TTL on cache keys
redis-cli config set maxmemory-policy allkeys-lru

# Scale Redis cluster
# Contact infrastructure team
```

### Scenario 3: High CPU Usage

**Symptoms**:
- Response times > 2 seconds
- CPU usage > 90%
- Pod resource exhaustion

**Investigation**:
```bash
# Check pod resources
kubectl top pods -n production

# Check application metrics
curl -s https://unjucks.company.com/metrics | grep cpu
```

**Resolution**:
```bash
# Scale horizontally
kubectl scale deployment/unjucks-app --replicas=6 -n production

# Increase resource limits
kubectl patch deployment unjucks-app -n production \
  --patch '{"spec":{"template":{"spec":{"containers":[{"name":"unjucks","resources":{"limits":{"cpu":"2000m","memory":"4Gi"}}}]}}}}'
```

### Scenario 4: Authentication Service Outage

**Symptoms**:
- Users cannot login
- 401/403 errors
- SAML/OAuth failures

**Investigation**:
```bash
# Test authentication endpoints
curl -X POST https://unjucks.company.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@company.com","password":"test"}'

# Check SSO provider status
curl -I https://sso.company.com/health

# Check LDAP connectivity
ldapsearch -x -H ldap://ad.company.com -D "cn=service,dc=company,dc=com" \
  -w password -b "ou=users,dc=company,dc=com" "(uid=test)"
```

**Resolution**:
```bash
# Enable local authentication fallback
kubectl patch configmap unjucks-config -n production \
  --patch '{"data":{"AUTH_LOCAL_ENABLED":"true"}}'

# Restart authentication service
kubectl rollout restart deployment/unjucks-app -n production

# Coordinate with identity team for SSO resolution
```

### Scenario 5: File Storage Issues

**Symptoms**:
- Upload failures
- S3/storage errors
- File retrieval timeouts

**Investigation**:
```bash
# Test file upload
curl -X POST https://unjucks.company.com/api/upload \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@test.txt"

# Check S3 connectivity
aws s3 ls s3://prod-bucket/ --region us-east-1

# Check storage metrics
curl -s https://unjucks.company.com/metrics | grep storage
```

**Resolution**:
```bash
# Switch to local storage temporarily
kubectl patch configmap unjucks-config -n production \
  --patch '{"data":{"STORAGE_TYPE":"local"}}'

# Check AWS service health
curl https://status.aws.amazon.com/

# Contact AWS support if needed
```

## Escalation Procedures

### When to Escalate

#### To Engineering Leadership (15 minutes)
- Unable to identify root cause
- Mitigation attempts unsuccessful
- Impact continues to grow

#### To Executive Team (30 minutes SEV-1, 60 minutes SEV-2)
- Multiple mitigation attempts failed
- Data loss or security breach suspected
- External customer impact significant

#### To External Support (varies)
- AWS/GCP infrastructure issues
- Third-party service outages
- Security incident requiring external forensics

### Escalation Scripts

#### Engineering Leadership
```
Subject: [SEV-X] Production Incident Escalation - Unjucks Platform

Incident: Brief description
Start Time: HH:MM UTC
Duration: X minutes
Impact: User-facing impact description
Actions Taken: Bulleted list of mitigation attempts
Next Steps: What we're trying next
ETA: When we expect resolution or next update

Incident Commander: @engineer
Incident Channel: #incident-response-prod
```

#### Executive Team
```
Subject: [CRITICAL] Production Outage - Unjucks Platform

Executive Summary:
- Unjucks platform experiencing [type] outage since HH:MM UTC
- Impact: [users affected] users unable to [specific functions]
- Financial Impact: Estimated $X/hour
- Customer Communications: Status page updated, support notified
- Resolution ETA: [time] based on current investigation

Incident Commander: [name]
Business Impact: [quantified impact]
Media Risk: [Low/Medium/High]
```

## Recovery Validation Checklist

### Technical Validation
- [ ] All health endpoints returning 200 OK
- [ ] Response times within SLA (95th percentile < 500ms)
- [ ] Error rates below 0.1%
- [ ] Database queries executing normally
- [ ] Cache hit ratios restored
- [ ] File uploads/downloads functional
- [ ] Authentication flows working
- [ ] Core user journeys tested

### Business Validation  
- [ ] Customer support queue cleared
- [ ] No new user reports of issues
- [ ] Revenue impact stopped
- [ ] SLA credits calculated
- [ ] Regulatory notifications sent (if required)

### Communication Validation
- [ ] Status page updated to "All Systems Operational"
- [ ] Stakeholder notifications sent
- [ ] Public communications coordinated with PR team
- [ ] Internal all-clear sent
- [ ] Post-mortem meeting scheduled

## Post-Incident Review Template

### Incident Summary
- **Incident ID**: INC-YYYYMMDD-XXX
- **Start Time**: YYYY-MM-DD HH:MM UTC
- **End Time**: YYYY-MM-DD HH:MM UTC
- **Duration**: X hours Y minutes
- **Severity**: SEV-X
- **Services Affected**: List of affected services

### Timeline
| Time | Event |
|------|-------|
| HH:MM | Initial detection |
| HH:MM | First responder paged |
| HH:MM | Incident declared |
| HH:MM | Mitigation X attempted |
| HH:MM | Root cause identified |
| HH:MM | Resolution implemented |
| HH:MM | Service restored |

### Impact Assessment
- **Users Affected**: Number and percentage
- **Revenue Impact**: Financial estimate
- **SLA Breaches**: Which SLAs were impacted
- **Customer Escalations**: Number of support tickets

### Root Cause Analysis
- **Primary Cause**: Technical root cause
- **Contributing Factors**: What made it worse
- **Detection Gap**: Why wasn't it caught sooner
- **Response Gap**: What slowed resolution

### Action Items
| Item | Owner | Due Date | Priority |
|------|-------|----------|----------|
| Fix immediate cause | @engineer | Date | P0 |
| Improve monitoring | @sre | Date | P1 |
| Update runbook | @oncall | Date | P2 |

### Lessons Learned
- What went well during the incident
- What could have been handled better
- Process improvements needed
- Training needs identified

---

**Emergency Reference**: Keep this runbook accessible during incidents. Print copies should be available in the war room and on-call engineers should have offline access to critical commands and contact information.