# Blue-Green Deployment Runbook

## 📋 Overview

This runbook provides step-by-step procedures for executing blue-green deployments, handling failures, and performing rollbacks.

## 🎯 Pre-Deployment Checklist

### ✅ Prerequisites
- [ ] Deployment version is properly tagged and tested
- [ ] Infrastructure health verified (both blue and green environments)
- [ ] Database migration strategy determined (if applicable)
- [ ] Monitoring and alerting systems operational
- [ ] Rollback plan documented and tested
- [ ] Stakeholders notified of deployment window

### 🔍 Environment Validation
```bash
# Check current active slot
curl -f https://{environment}.unjucks.app/health

# Verify target slot readiness  
curl -f https://{environment}.unjucks.app/{target-slot}/health

# Check infrastructure capacity
# AWS: aws elbv2 describe-target-health
# Azure: az network traffic-manager endpoint show
# GCP: gcloud compute backend-services get-health
```

## 🚀 Deployment Execution

### Phase 1: Preparation (5-10 minutes)
1. **Backup Current State**
   ```bash
   # Database backup (if migrations required)
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
   
   # Configuration backup
   kubectl get configmap app-config -o yaml > config_backup.yml
   ```

2. **Deploy to Target Slot**
   ```bash
   # Trigger GitHub Actions workflow
   gh workflow run blue-green-deployment.yml \
     -f environment=production \
     -f version=20250101.120000-abcd1234
   ```

### Phase 2: Health Validation (10-15 minutes)
1. **Application Health Checks**
   - `/health` - Basic application health
   - `/health/db` - Database connectivity
   - `/health/cache` - Cache connectivity  
   - `/health/dependencies` - External service health
   - `/ready` - Application readiness
   - `/metrics` - Performance metrics

2. **Performance Validation**
   ```bash
   # Load test target slot
   ab -n 1000 -c 10 https://{environment}.unjucks.app/{target-slot}/health
   
   # Expected: >99% success rate, <500ms avg response time
   ```

### Phase 3: Traffic Migration (15-30 minutes)
1. **Gradual Traffic Switch**
   - 10% traffic → Wait 2 minutes → Monitor
   - 50% traffic → Wait 5 minutes → Monitor
   - 100% traffic → Wait 5 minutes → Validate

2. **Monitoring Points**
   - Error rate < 1%
   - Response time < 500ms
   - No spike in 5xx errors
   - External dependency health maintained

## 🚨 Incident Response

### Health Check Failures
```bash
# Immediate actions:
1. Check application logs
   kubectl logs -f deployment/app-{target-slot}

2. Verify database connectivity
   psql $DATABASE_URL -c "SELECT 1;"

3. Check external dependencies
   curl -f https://api.external-service.com/health

# If issues persist > 5 minutes: ROLLBACK
```

### Performance Degradation
```bash
# Signs of degradation:
- Response time > 500ms sustained for 2+ minutes
- Error rate > 5% for 1+ minute  
- Memory/CPU usage > 90% for 3+ minutes

# Actions:
1. Scale up target slot resources
2. If no improvement in 3 minutes: ROLLBACK
```

### Traffic Switch Failures
```bash
# Load balancer not responding:
1. Check load balancer health
2. Verify target group registration
3. Validate network connectivity
4. ROLLBACK if unresolvable in 5 minutes
```

## 🔄 Rollback Procedures

### Automatic Rollback Triggers
- Health check failure > 5 consecutive attempts
- Error rate > 5% for > 1 minute
- Response time degradation > 100% baseline

### Manual Rollback Process
```bash
# 1. Immediate traffic revert
gh workflow run blue-green-deployment.yml \
  -f environment=production \
  -f version=rollback \
  -f target-slot={original-slot}

# 2. Verify rollback health
for i in {1..10}; do
  curl -f https://{environment}.unjucks.app/health && echo "OK" || echo "FAIL"
  sleep 10
done

# 3. Database rollback (if migrations applied)
psql $DATABASE_URL < backup_timestamp.sql
```

### Rollback Validation
- [ ] Application responding normally
- [ ] Error rate < 1%  
- [ ] Response time back to baseline
- [ ] Database integrity verified
- [ ] All external integrations working

## 📊 Post-Deployment

### Success Validation
```bash
# 30-minute observation period
- Monitor error rates
- Validate performance metrics
- Check business metrics
- Verify all integrations
```

### Cleanup Tasks
- [ ] Clean up old deployment artifacts
- [ ] Update documentation
- [ ] Archive deployment logs
- [ ] Send deployment report to stakeholders
- [ ] Schedule post-mortem (if issues occurred)

## 🔧 Troubleshooting

### Common Issues

**Database Connection Failures**
```bash
# Check connection pool status
curl https://{environment}.unjucks.app/health/db

# Verify database migrations
psql $DATABASE_URL -c "\dt"
```

**Load Balancer Issues**  
```bash
# AWS
aws elbv2 describe-target-health --target-group-arn {arn}

# Azure  
az network traffic-manager endpoint show --name {endpoint}

# GCP
gcloud compute backend-services get-health {service-name}
```

**DNS Propagation Delays**
```bash
# Check DNS resolution
dig {environment}.unjucks.app

# Flush local DNS cache
sudo dscacheutil -flushcache  # macOS
sudo systemctl restart systemd-resolved  # Linux
```

## 📞 Escalation

### Contact Information
- **On-call Engineer**: [Slack: @oncall-engineer]
- **Platform Team**: [Slack: #platform-team]  
- **Database Team**: [Slack: #database-team]
- **Security Team**: [Slack: #security-team]

### Escalation Triggers
- Rollback failures
- Database corruption
- Security vulnerabilities discovered
- Extended downtime (>15 minutes)

## 📈 Metrics and SLIs

### Key Metrics
- **Deployment Success Rate**: >99%
- **Deployment Duration**: <45 minutes  
- **Rollback Time**: <5 minutes
- **Zero Downtime**: 100% uptime during deployment

### Dashboard Links
- [Deployment Dashboard](https://monitoring.unjucks.app/deployments)
- [Application Performance](https://monitoring.unjucks.app/performance)
- [Infrastructure Health](https://monitoring.unjucks.app/infrastructure)

---

**Last Updated**: 2025-01-09  
**Version**: 2.0  
**Owner**: Blue-Green Deployment Engineer