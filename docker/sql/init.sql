-- =============================================================================
-- UNJUCKS CLEANROOM TESTING DATABASE INITIALIZATION
-- PostgreSQL Schema for Testing Environment
-- =============================================================================

-- Create testing database if not exists
SELECT 'CREATE DATABASE unjucks_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'unjucks_test');

-- Connect to test database
\c unjucks_test;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "hstore";

-- =============================================================================
-- TESTING SCHEMAS
-- =============================================================================

-- Core testing schema
CREATE SCHEMA IF NOT EXISTS testing;
CREATE SCHEMA IF NOT EXISTS semantic_web;
CREATE SCHEMA IF NOT EXISTS performance;
CREATE SCHEMA IF NOT EXISTS audit;

-- Set default schema
SET search_path TO testing, public;

-- =============================================================================
-- TESTING TABLES
-- =============================================================================

-- Test execution tracking
CREATE TABLE IF NOT EXISTS testing.test_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_suite VARCHAR(255) NOT NULL,
    test_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance metrics tracking
CREATE TABLE IF NOT EXISTS performance.metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id UUID REFERENCES testing.test_executions(id),
    metric_name VARCHAR(255) NOT NULL,
    metric_value DECIMAL(15,6) NOT NULL,
    unit VARCHAR(50),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tags JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security scan results
CREATE TABLE IF NOT EXISTS audit.security_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    vulnerability_count INTEGER DEFAULT 0,
    high_severity_count INTEGER DEFAULT 0,
    scan_results JSONB DEFAULT '{}',
    scan_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Semantic web test data
CREATE TABLE IF NOT EXISTS semantic_web.triples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject VARCHAR(255) NOT NULL,
    predicate VARCHAR(255) NOT NULL,
    object TEXT NOT NULL,
    graph VARCHAR(255) DEFAULT 'default',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Code generation test tracking
CREATE TABLE IF NOT EXISTS testing.generation_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    generator_name VARCHAR(255) NOT NULL,
    template_name VARCHAR(255) NOT NULL,
    generation_time_ms INTEGER,
    files_generated INTEGER DEFAULT 0,
    success BOOLEAN DEFAULT FALSE,
    error_details TEXT,
    output_size_bytes INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Test execution indexes
CREATE INDEX IF NOT EXISTS idx_test_executions_suite ON testing.test_executions(test_suite);
CREATE INDEX IF NOT EXISTS idx_test_executions_status ON testing.test_executions(status);
CREATE INDEX IF NOT EXISTS idx_test_executions_start_time ON testing.test_executions(start_time);

-- Performance metrics indexes
CREATE INDEX IF NOT EXISTS idx_metrics_test_id ON performance.metrics(test_id);
CREATE INDEX IF NOT EXISTS idx_metrics_name ON performance.metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON performance.metrics(timestamp);

-- Security scan indexes
CREATE INDEX IF NOT EXISTS idx_security_scans_type ON audit.security_scans(scan_type);
CREATE INDEX IF NOT EXISTS idx_security_scans_severity ON audit.security_scans(severity);
CREATE INDEX IF NOT EXISTS idx_security_scans_timestamp ON audit.security_scans(scan_timestamp);

-- Semantic web indexes
CREATE INDEX IF NOT EXISTS idx_triples_subject ON semantic_web.triples(subject);
CREATE INDEX IF NOT EXISTS idx_triples_predicate ON semantic_web.triples(predicate);
CREATE INDEX IF NOT EXISTS idx_triples_graph ON semantic_web.triples(graph);

-- Generation test indexes
CREATE INDEX IF NOT EXISTS idx_generation_tests_generator ON testing.generation_tests(generator_name);
CREATE INDEX IF NOT EXISTS idx_generation_tests_template ON testing.generation_tests(template_name);
CREATE INDEX IF NOT EXISTS idx_generation_tests_success ON testing.generation_tests(success);

-- =============================================================================
-- VIEWS FOR REPORTING
-- =============================================================================

-- Test execution summary view
CREATE OR REPLACE VIEW testing.test_summary AS
SELECT 
    test_suite,
    COUNT(*) as total_tests,
    COUNT(*) FILTER (WHERE status = 'passed') as passed_tests,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_tests,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_tests,
    ROUND(AVG(duration_ms), 2) as avg_duration_ms,
    MAX(duration_ms) as max_duration_ms,
    MIN(start_time) as first_test_start,
    MAX(end_time) as last_test_end
FROM testing.test_executions
GROUP BY test_suite;

-- Performance metrics summary view
CREATE OR REPLACE VIEW performance.metrics_summary AS
SELECT 
    metric_name,
    unit,
    COUNT(*) as measurement_count,
    ROUND(AVG(metric_value), 4) as avg_value,
    ROUND(MIN(metric_value), 4) as min_value,
    ROUND(MAX(metric_value), 4) as max_value,
    ROUND(STDDEV(metric_value), 4) as std_deviation
FROM performance.metrics
GROUP BY metric_name, unit;

-- Security scan summary view
CREATE OR REPLACE VIEW audit.security_summary AS
SELECT 
    scan_type,
    COUNT(*) as total_scans,
    SUM(vulnerability_count) as total_vulnerabilities,
    SUM(high_severity_count) as total_high_severity,
    MAX(scan_timestamp) as last_scan
FROM audit.security_scans
GROUP BY scan_type;

-- =============================================================================
-- FUNCTIONS FOR TESTING
-- =============================================================================

-- Function to record test execution
CREATE OR REPLACE FUNCTION testing.record_test_execution(
    p_test_suite VARCHAR(255),
    p_test_name VARCHAR(255),
    p_status VARCHAR(50),
    p_duration_ms INTEGER DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    test_id UUID;
BEGIN
    INSERT INTO testing.test_executions (
        test_suite, test_name, status, end_time, duration_ms, error_message, metadata
    ) VALUES (
        p_test_suite, p_test_name, p_status, 
        CASE WHEN p_status != 'pending' THEN NOW() ELSE NULL END,
        p_duration_ms, p_error_message, p_metadata
    ) RETURNING id INTO test_id;
    
    RETURN test_id;
END;
$$ LANGUAGE plpgsql;

-- Function to record performance metric
CREATE OR REPLACE FUNCTION performance.record_metric(
    p_test_id UUID,
    p_metric_name VARCHAR(255),
    p_metric_value DECIMAL(15,6),
    p_unit VARCHAR(50) DEFAULT NULL,
    p_tags JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    metric_id UUID;
BEGIN
    INSERT INTO performance.metrics (
        test_id, metric_name, metric_value, unit, tags
    ) VALUES (
        p_test_id, p_metric_name, p_metric_value, p_unit, p_tags
    ) RETURNING id INTO metric_id;
    
    RETURN metric_id;
END;
$$ LANGUAGE plpgsql;

-- Function to clean old test data
CREATE OR REPLACE FUNCTION testing.cleanup_old_data(
    p_days_to_keep INTEGER DEFAULT 30
) RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete old test executions
    DELETE FROM testing.test_executions 
    WHERE created_at < NOW() - INTERVAL '1 day' * p_days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Clean up orphaned metrics
    DELETE FROM performance.metrics 
    WHERE test_id NOT IN (SELECT id FROM testing.test_executions);
    
    -- Clean up old security scans
    DELETE FROM audit.security_scans 
    WHERE created_at < NOW() - INTERVAL '1 day' * p_days_to_keep;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SAMPLE TEST DATA
-- =============================================================================

-- Insert sample test data for validation
INSERT INTO testing.test_executions (test_suite, test_name, status, duration_ms) VALUES
('unit', 'template-rendering', 'passed', 125),
('unit', 'file-generation', 'passed', 89),
('integration', 'cli-commands', 'passed', 456),
('integration', 'semantic-web', 'passed', 234),
('e2e', 'full-workflow', 'passed', 1234);

-- Insert sample performance metrics
INSERT INTO performance.metrics (test_id, metric_name, metric_value, unit) 
SELECT id, 'memory_usage_mb', 128.5, 'MB' FROM testing.test_executions LIMIT 1;

INSERT INTO performance.metrics (test_id, metric_name, metric_value, unit) 
SELECT id, 'cpu_usage_percent', 15.3, '%' FROM testing.test_executions LIMIT 1;

-- Insert sample semantic web data
INSERT INTO semantic_web.triples (subject, predicate, object) VALUES
('urn:unjucks:test:1', 'rdf:type', 'unjucks:Test'),
('urn:unjucks:test:1', 'unjucks:name', 'Sample Test'),
('urn:unjucks:test:1', 'unjucks:status', 'passed');

-- =============================================================================
-- GRANTS AND PERMISSIONS
-- =============================================================================

-- Grant permissions to test user
GRANT USAGE ON SCHEMA testing TO unjucks_test;
GRANT USAGE ON SCHEMA performance TO unjucks_test;
GRANT USAGE ON SCHEMA semantic_web TO unjucks_test;
GRANT USAGE ON SCHEMA audit TO unjucks_test;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA testing TO unjucks_test;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA performance TO unjucks_test;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA semantic_web TO unjucks_test;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA audit TO unjucks_test;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA testing TO unjucks_test;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA performance TO unjucks_test;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA semantic_web TO unjucks_test;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA audit TO unjucks_test;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA testing TO unjucks_test;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA performance TO unjucks_test;

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

SELECT 'Unjucks cleanroom testing database initialized successfully' AS status;