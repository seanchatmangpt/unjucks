# Database Migration Strategies for Blue-Green Deployments

## 📋 Overview

Database migrations in blue-green deployments require special consideration to maintain zero-downtime and ensure both blue and green environments can operate simultaneously during the transition period.

## 🎯 Migration Strategies

### 1. Forward-Compatible Migrations ✅ Recommended

#### 🔍 Strategy Overview
Forward-compatible migrations ensure that both old and new application versions can work with the same database schema during the transition period.

#### ✅ Principles
- **Additive Only**: Only add new columns, tables, indexes
- **Backward Compatible**: Old code continues to work
- **Forward Compatible**: New code works immediately
- **No Breaking Changes**: No drops, renames, or type changes

#### 📋 Implementation Process
```sql
-- Phase 1: Add new columns (NULL or with defaults)
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN verification_token VARCHAR(255);

-- Phase 2: Add new indexes (use CONCURRENTLY for zero-downtime)
CREATE INDEX CONCURRENTLY idx_users_email_verified 
ON users(email_verified) WHERE email_verified = true;

-- Phase 3: Add new tables (if needed)
CREATE TABLE user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    preference_key VARCHAR(255) NOT NULL,
    preference_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 🔄 Deployment Flow
```yaml
deployment_phases:
  1. schema_migration:
     - Add new columns/tables/indexes
     - Deploy to database before application
     
  2. blue_green_deployment:
     - Deploy new application code
     - Both versions work with new schema
     
  3. data_migration:
     - Populate new columns
     - Migrate data in background
     
  4. cleanup_phase:
     - Remove old columns/tables (next deployment cycle)
     - Update constraints
```

### 2. Shadow Database Strategy

#### 🔍 Strategy Overview
Use a shadow database to test migrations and validate compatibility before applying to production.

#### 📋 Implementation
```bash
#!/bin/bash
# Shadow database migration script

create_shadow_database() {
  local prod_db=$1
  local shadow_db="shadow_$(date +%s)_$RANDOM"
  
  echo "🌑 Creating shadow database: $shadow_db"
  
  # Create shadow database
  createdb "$shadow_db" || {
    echo "❌ Failed to create shadow database"
    return 1
  }
  
  # Copy production data
  echo "📋 Copying production data to shadow database..."
  pg_dump --no-owner --no-privileges "$prod_db" | \
    psql -v ON_ERROR_STOP=1 "$shadow_db" || {
    echo "❌ Failed to copy production data"
    dropdb "$shadow_db"
    return 1
  }
  
  echo "shadow_db_name=$shadow_db" >> $GITHUB_OUTPUT
}

test_migrations_on_shadow() {
  local shadow_db=$1
  
  echo "📝 Testing migrations on shadow database..."
  
  # Apply pending migrations
  DATABASE_URL="postgresql:///$shadow_db" \
    bundle exec rails db:migrate || {
    echo "❌ Migration failed on shadow database"
    return 1
  }
  
  # Run application tests
  echo "🧪 Running tests against shadow database..."
  DATABASE_URL="postgresql:///$shadow_db" \
    bundle exec rails test:models || {
    echo "❌ Tests failed against shadow database"
    return 1
  }
  
  # Performance testing
  echo "⚡ Running performance tests..."
  DATABASE_URL="postgresql:///$shadow_db" \
    bundle exec rails performance:test || {
    echo "❌ Performance tests failed"
    return 1
  }
  
  echo "✅ Shadow database testing completed successfully"
}

apply_migrations_to_production() {
  local prod_db=$1
  local shadow_db=$2
  
  echo "🚀 Applying migrations to production..."
  
  # Create backup before migration
  backup_file="backup_$(date +%Y%m%d_%H%M%S).sql"
  pg_dump "$prod_db" > "$backup_file" || {
    echo "❌ Failed to create backup"
    return 1
  }
  
  # Apply migrations
  bundle exec rails db:migrate || {
    echo "❌ Production migration failed"
    echo "🔄 Restore from backup: psql $prod_db < $backup_file"
    return 1
  }
  
  # Cleanup shadow database
  dropdb "$shadow_db"
  
  echo "✅ Production migration completed successfully"
}
```

### 3. Dual-Write Strategy

#### 🔍 Strategy Overview
During migration, write to both old and new schema structures simultaneously, then gradually migrate reads.

#### 📋 Implementation Pattern
```ruby
# Ruby/Rails example of dual-write pattern

class User < ApplicationRecord
  # Migration phase: write to both old and new columns
  before_save :sync_email_fields
  
  private
  
  def sync_email_fields
    # Write to both old and new email fields during transition
    if email_changed?
      self.legacy_email = email  # Old column
      self.email_address = email # New column
    end
    
    # Sync verification status
    if email_verified_changed?
      self.verified = email_verified # Legacy column
    end
  end
end

# Data migration background job
class EmailFieldMigrationJob < ApplicationJob
  def perform
    # Migrate data in batches to avoid locking
    User.where(email_address: nil).find_in_batches(batch_size: 1000) do |batch|
      batch.each do |user|
        user.update_columns(
          email_address: user.legacy_email,
          email_verified: user.verified
        )
      end
      
      # Small delay to avoid overwhelming the database
      sleep(0.1)
    end
  end
end
```

#### 🔄 Dual-Write Phases
```yaml
phase_1_preparation:
  - Add new columns/tables
  - Deploy dual-write application code
  - Start background data migration
  
phase_2_validation:
  - Verify data consistency
  - Test read operations on new schema
  - Monitor performance impact
  
phase_3_migration:
  - Switch reads to new schema
  - Continue dual-write for safety
  - Validate application functionality
  
phase_4_cleanup:
  - Remove dual-write code
  - Drop old columns/tables
  - Update indexes and constraints
```

## 🛡️ Safety Mechanisms

### Pre-Migration Checks
```bash
#!/bin/bash
# Pre-migration safety checks

pre_migration_checks() {
  local db_url=$1
  
  echo "🔍 Running pre-migration safety checks..."
  
  # Check database connectivity
  psql "$db_url" -c "SELECT 1;" || {
    echo "❌ Database connection failed"
    return 1
  }
  
  # Check database size and free space
  db_size=$(psql "$db_url" -t -c "SELECT pg_size_pretty(pg_database_size(current_database()));")
  echo "📊 Database size: $db_size"
  
  # Check for long-running transactions
  long_running=$(psql "$db_url" -t -c "
    SELECT COUNT(*) FROM pg_stat_activity 
    WHERE state = 'active' 
    AND query_start < now() - interval '5 minutes';
  ")
  
  if [ "$long_running" -gt 0 ]; then
    echo "⚠️ Warning: $long_running long-running transactions detected"
    echo "Consider waiting for them to complete"
  fi
  
  # Check for table locks
  locks=$(psql "$db_url" -t -c "
    SELECT COUNT(*) FROM pg_locks l
    JOIN pg_stat_all_tables t ON l.relation = t.relid
    WHERE l.mode LIKE '%ExclusiveLock%';
  ")
  
  if [ "$locks" -gt 0 ]; then
    echo "⚠️ Warning: $locks exclusive locks detected"
    return 1
  fi
  
  echo "✅ Pre-migration checks passed"
}
```

### Migration Monitoring
```sql
-- Monitor migration progress
CREATE OR REPLACE FUNCTION migration_progress_monitor()
RETURNS TABLE (
  table_name text,
  total_rows bigint,
  migrated_rows bigint,
  progress_percent numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.table_name::text,
    t.total_rows,
    COALESCE(m.migrated_rows, 0) as migrated_rows,
    ROUND(
      (COALESCE(m.migrated_rows, 0)::numeric / t.total_rows::numeric) * 100, 
      2
    ) as progress_percent
  FROM (
    SELECT 
      'users'::text as table_name,
      COUNT(*)::bigint as total_rows
    FROM users
  ) t
  LEFT JOIN (
    SELECT 
      'users'::text as table_name,
      COUNT(*)::bigint as migrated_rows
    FROM users 
    WHERE email_address IS NOT NULL
  ) m ON t.table_name = m.table_name;
END;
$$ LANGUAGE plpgsql;
```

### Rollback Procedures
```bash
#!/bin/bash
# Database rollback procedures

create_rollback_point() {
  local db_url=$1
  local rollback_id="rollback_$(date +%Y%m%d_%H%M%S)"
  
  echo "💾 Creating rollback point: $rollback_id"
  
  # Create database backup
  pg_dump "$db_url" > "${rollback_id}.sql" || {
    echo "❌ Failed to create rollback point"
    return 1
  }
  
  # Store rollback metadata
  cat > "${rollback_id}.meta" << EOF
{
  "rollback_id": "$rollback_id",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "database_size": "$(psql "$db_url" -t -c 'SELECT pg_size_pretty(pg_database_size(current_database()));')",
  "migrations_applied": $(psql "$db_url" -t -c "SELECT COUNT(*) FROM schema_migrations;"),
  "tables_count": $(psql "$db_url" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
}
EOF
  
  echo "rollback_point=$rollback_id" >> $GITHUB_OUTPUT
  echo "✅ Rollback point created successfully"
}

execute_rollback() {
  local db_url=$1
  local rollback_id=$2
  
  echo "🚨 Executing database rollback to: $rollback_id"
  
  # Verify rollback file exists
  if [ ! -f "${rollback_id}.sql" ]; then
    echo "❌ Rollback file not found: ${rollback_id}.sql"
    return 1
  fi
  
  # Create backup of current state before rollback
  current_backup="pre_rollback_$(date +%Y%m%d_%H%M%S).sql"
  pg_dump "$db_url" > "$current_backup"
  
  # Terminate active connections
  psql "$db_url" -c "
    SELECT pg_terminate_backend(pid) 
    FROM pg_stat_activity 
    WHERE datname = current_database() 
    AND pid <> pg_backend_pid();
  "
  
  # Drop and recreate database
  db_name=$(echo "$db_url" | sed 's/.*\///')
  dropdb "$db_name"
  createdb "$db_name"
  
  # Restore from rollback point
  psql "$db_url" < "${rollback_id}.sql" || {
    echo "❌ Rollback failed"
    return 1
  }
  
  echo "✅ Database rollback completed successfully"
  echo "💾 Current state backed up to: $current_backup"
}
```

## 🔄 Migration Patterns by Database Type

### PostgreSQL Patterns
```sql
-- Safe column addition
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;

-- Safe index creation (non-blocking)
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);

-- Safe constraint addition
ALTER TABLE users ADD CONSTRAINT check_email_format 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') NOT VALID;

-- Validate constraint in background
ALTER TABLE users VALIDATE CONSTRAINT check_email_format;

-- Safe data type expansion
ALTER TABLE users ALTER COLUMN phone_number TYPE VARCHAR(20);
```

### MySQL Patterns
```sql
-- Safe column addition
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;

-- Online DDL for MySQL 5.7+
ALTER TABLE users ADD INDEX idx_users_email (email), ALGORITHM=INPLACE, LOCK=NONE;

-- Safe data migration
UPDATE users SET email_verified = TRUE 
WHERE email IS NOT NULL AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

### MongoDB Patterns
```javascript
// Safe field addition
db.users.updateMany(
  { email_verified: { $exists: false } },
  { $set: { email_verified: false } }
);

// Safe index creation
db.users.createIndex({ "email": 1 }, { background: true });

// Safe data migration with batching
function migrateEmailVerification() {
  let batch = db.users.find({ 
    email_verified: { $exists: false },
    email: { $exists: true }
  }).limit(1000);
  
  while (batch.hasNext()) {
    let updates = [];
    batch.forEach(user => {
      updates.push({
        updateOne: {
          filter: { _id: user._id },
          update: { $set: { email_verified: true } }
        }
      });
    });
    
    if (updates.length > 0) {
      db.users.bulkWrite(updates);
    }
    
    batch = db.users.find({ 
      email_verified: { $exists: false },
      email: { $exists: true }
    }).limit(1000);
  }
}
```

## 📊 Migration Validation

### Data Consistency Checks
```sql
-- Validate data consistency after migration
WITH migration_validation AS (
  SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as has_email,
    COUNT(CASE WHEN email_address IS NOT NULL THEN 1 END) as has_new_email,
    COUNT(CASE WHEN email = email_address THEN 1 END) as matching_emails
  FROM users
)
SELECT 
  *,
  CASE 
    WHEN has_email = matching_emails THEN '✅ VALID'
    ELSE '❌ INCONSISTENT'
  END as validation_status
FROM migration_validation;
```

### Performance Impact Assessment
```bash
#!/bin/bash
# Assess migration performance impact

measure_performance_impact() {
  local db_url=$1
  
  echo "📊 Measuring migration performance impact..."
  
  # Measure query performance before and after
  for query in "SELECT COUNT(*) FROM users" "SELECT * FROM users LIMIT 100" "SELECT * FROM users WHERE email LIKE '%@example.com'"; do
    echo "Testing query: $query"
    
    # Measure execution time
    start_time=$(date +%s%N)
    psql "$db_url" -c "$query" > /dev/null
    end_time=$(date +%s%N)
    
    duration=$(( (end_time - start_time) / 1000000 ))  # Convert to milliseconds
    echo "Execution time: ${duration}ms"
  done
  
  # Check database statistics
  psql "$db_url" -c "
    SELECT 
      schemaname,
      tablename,
      n_tup_ins as inserts,
      n_tup_upd as updates,
      n_tup_del as deletes,
      n_live_tup as live_tuples,
      n_dead_tup as dead_tuples
    FROM pg_stat_user_tables 
    ORDER BY n_live_tup DESC;
  "
}
```

## 📋 Best Practices Checklist

### ✅ Pre-Migration
- [ ] Create comprehensive database backup
- [ ] Test migration on staging environment
- [ ] Validate migration scripts in shadow database
- [ ] Ensure backward compatibility
- [ ] Plan rollback procedures
- [ ] Schedule maintenance window (if needed)
- [ ] Notify stakeholders

### ✅ During Migration
- [ ] Monitor migration progress
- [ ] Watch for performance impacts
- [ ] Validate data consistency
- [ ] Keep rollback option ready
- [ ] Monitor application health
- [ ] Check for lock contention

### ✅ Post-Migration
- [ ] Validate data integrity
- [ ] Run performance tests
- [ ] Monitor error rates
- [ ] Verify application functionality
- [ ] Update documentation
- [ ] Archive migration artifacts
- [ ] Plan cleanup phase

---

**Last Updated**: 2025-01-09  
**Version**: 2.0  
**Maintained By**: Blue-Green Deployment Engineer