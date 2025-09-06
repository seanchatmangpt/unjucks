# Database Templates

This directory contains Unjucks templates for generating database schemas, migrations, and seed data for interview platform applications.

## Template Structure

```
_templates/database/
├── schema/
│   ├── config.yml           # Template configuration for schemas
│   ├── table.sql.ejs        # Main table schema template
│   └── indexes.sql.ejs      # Performance indexes template
├── migrations/
│   ├── config.yml           # Template configuration for migrations
│   └── migration.sql.ejs    # Database migration template
├── seeds/
│   ├── config.yml           # Template configuration for seeds
│   └── seed.sql.ejs         # Data seeding template
└── README.md               # This documentation
```

## Usage Examples

### Generate Database Schema

```bash
# Generate users table schema
unjucks generate database/schema table --tableName=users --dialect=postgresql

# Generate interview sessions table
unjucks generate database/schema table --tableName=interview_sessions --dialect=sqlite

# Generate with custom columns
unjucks generate database/schema table --tableName=custom_table --columns='[{"name":"title","type":"VARCHAR(255)","nullable":false}]' --dialect=postgresql
```

### Generate Migration

```bash
# Create table migration
unjucks generate database/migrations migration --migrationName=create_users_table --migrationType=create_table --tableName=users --timestamp=$(date +%Y%m%d%H%M%S)

# Add column migration
unjucks generate database/migrations migration --migrationName=add_email_to_users --migrationType=add_column --tableName=users --columnName=email --columnType="VARCHAR(255)" --nullable=false

# Add index migration
unjucks generate database/migrations migration --migrationName=add_user_email_index --migrationType=add_index --tableName=users --indexName=idx_users_email --columns='["email"]'
```

### Generate Seed Data

```bash
# Generate user seed data
unjucks generate database/seeds seed --seedName=users --seedType=users --environment=development

# Generate exercise seed data
unjucks generate database/seeds seed --seedName=sample_exercises --seedType=drill_exercises --environment=production

# Generate interview sessions
unjucks generate database/seeds seed --seedName=test_sessions --seedType=interview_sessions --environment=development
```

## Supported Table Types

### Core Tables

1. **users** - User accounts and authentication
   - Username, email, password management
   - Profile information and preferences
   - Role-based access control
   - Account verification and status

2. **interview_sessions** - Interview management
   - Session state tracking
   - Interviewer assignment
   - Timing and scheduling
   - Session recordings and notes

3. **code_submissions** - Code analysis and storage
   - Multi-language code submissions
   - Automated analysis results
   - Performance metrics
   - AI scoring and evaluation

4. **feedback_reports** - AI and human feedback
   - Comprehensive feedback generation
   - Scoring breakdowns
   - Review workflow
   - Confidence scoring

5. **drill_exercises** - Coding challenges
   - Problem statements and constraints
   - Multi-language starter code
   - Test case management
   - Difficulty and categorization

6. **rubric_scores** - Detailed evaluations
   - Multi-dimensional scoring
   - Percentile rankings
   - Grade assignments
   - Evaluator tracking

### Analytics Tables

7. **user_analytics** - Performance over time
   - Skill progression tracking
   - Engagement metrics
   - Streak and goal tracking

8. **session_metrics** - Detailed session data
   - Timing breakdown
   - Interaction patterns
   - Technical performance

9. **progress_tracking** - Learning path management
   - XP and level systems
   - Milestone tracking
   - Weakness identification

10. **usage_statistics** - Platform analytics
    - Daily active users
    - Feature usage patterns
    - System performance metrics

## Database Features

### Multi-Database Support
- **PostgreSQL**: Full featured with advanced constraints, triggers, and concurrent indexes
- **SQLite**: Lightweight with compatibility adaptations for development and testing

### Performance Optimization
- Strategic indexing for common query patterns
- Composite indexes for multi-column searches
- Partial indexes where supported (PostgreSQL)
- Query performance analysis templates

### Data Integrity
- Foreign key constraints with proper cascade behavior
- Check constraints for data validation
- Unique constraints for business rules
- NOT NULL constraints for required fields

### Audit Trail
- Standard `created_at` and `updated_at` timestamps
- Creator and updater tracking
- PostgreSQL automatic update triggers

### JSON Support
- Flexible JSON columns for configuration data
- Metadata storage for extensibility
- Dynamic form data and preferences

## Migration Types

1. **create_table** - New table creation with full schema
2. **add_column** - Add single column with proper indexing
3. **drop_column** - Remove column (PostgreSQL direct, SQLite recreate)
4. **add_index** - Performance index creation
5. **drop_index** - Index removal
6. **add_foreign_key** - Relationship constraints
7. **custom** - Custom SQL operations

## Seed Data Types

1. **users** - Sample user accounts for testing
2. **drill_exercises** - Common interview problems
3. **interview_sessions** - Sample interview data
4. **categories** - Exercise categorization
5. **custom** - Application-specific data

## Environment Considerations

### Development
- Rich sample data for testing
- Multiple user roles and scenarios
- Comprehensive exercise library

### Production
- Minimal essential data only
- Security-focused configurations
- Performance-optimized settings

## Best Practices

### Schema Design
- Use meaningful table and column names
- Implement proper normalization
- Plan for scalability and performance
- Include comprehensive constraints

### Migration Strategy
- Always backup before migrations
- Test migrations on development first
- Use descriptive migration names with timestamps
- Include rollback procedures

### Indexing Strategy
- Index frequently queried columns
- Consider composite indexes for multi-column queries
- Monitor index usage and remove unused indexes
- Use partial indexes for filtered queries

### Data Seeding
- Environment-specific seed data
- Use realistic sample data for testing
- Include edge cases and boundary conditions
- Maintain referential integrity

## Generated Files

Templates generate SQL files optimized for your chosen database dialect:

- **Schemas**: `database/schema/{tableName}.sql`
- **Migrations**: `database/migrations/{timestamp}_{migrationName}.sql`
- **Seeds**: `database/seeds/{seedName}.sql`
- **Indexes**: `database/schema/{tableName}-indexes.sql`

## Integration

These templates integrate with:
- Database migration tools (Knex.js, Sequelize, etc.)
- ORM frameworks (Prisma, TypeORM, etc.)
- CI/CD pipelines for automated deployments
- Development workflow tools

## Customization

Templates support extensive customization through variables:
- Database dialect selection
- Column definitions and constraints
- Index specifications
- Seed data configuration
- Environment-specific settings

For advanced customization, modify the EJS templates directly while maintaining the established patterns and structure.