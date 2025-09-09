-- PostgreSQL Test Database Initialization
-- Sets up test database schema and users for Unjucks testing

-- Create additional test databases for different test scenarios
CREATE DATABASE unjucks_test_integration;
CREATE DATABASE unjucks_test_e2e;
CREATE DATABASE unjucks_test_performance;

-- Create test schemas
\c unjucks_test;

-- Create test user with appropriate permissions
CREATE USER test_readonly WITH ENCRYPTED PASSWORD 'readonly_password';
GRANT CONNECT ON DATABASE unjucks_test TO test_readonly;
GRANT USAGE ON SCHEMA public TO test_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO test_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO test_readonly;

-- Create test tables for template and generator testing
CREATE TABLE IF NOT EXISTS test_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    content TEXT NOT NULL,
    variables JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_generators (
    id SERIAL PRIMARY KEY,
    template_id INTEGER REFERENCES test_templates(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    output_path VARCHAR(500),
    status VARCHAR(50) DEFAULT 'pending',
    result JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_configs (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    environment VARCHAR(50) DEFAULT 'test',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance testing
CREATE INDEX idx_templates_name ON test_templates(name);
CREATE INDEX idx_templates_created_at ON test_templates(created_at);
CREATE INDEX idx_generators_template_id ON test_generators(template_id);
CREATE INDEX idx_generators_status ON test_generators(status);
CREATE INDEX idx_configs_key ON test_configs(key);
CREATE INDEX idx_configs_environment ON test_configs(environment);

-- Create test data views
CREATE VIEW test_template_stats AS
SELECT 
    t.id,
    t.name,
    COUNT(g.id) as generator_count,
    COUNT(CASE WHEN g.status = 'completed' THEN 1 END) as completed_count,
    COUNT(CASE WHEN g.status = 'failed' THEN 1 END) as failed_count,
    MAX(g.created_at) as last_generation
FROM test_templates t
LEFT JOIN test_generators g ON t.id = g.template_id
GROUP BY t.id, t.name;

-- Create functions for test data cleanup
CREATE OR REPLACE FUNCTION cleanup_test_data()
RETURNS void AS $$
BEGIN
    DELETE FROM test_generators WHERE created_at < NOW() - INTERVAL '1 day';
    DELETE FROM test_templates WHERE id NOT IN (SELECT DISTINCT template_id FROM test_generators WHERE template_id IS NOT NULL);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_test_templates_updated_at
    BEFORE UPDATE ON test_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions to test user
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO test_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO test_user;

-- Insert initial test configuration
INSERT INTO test_configs (key, value, environment) VALUES
('max_template_size', '1048576', 'test'),
('max_generators_per_template', '100', 'test'),
('default_timeout', '30000', 'test'),
('parallel_generation_limit', '10', 'test')
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    created_at = NOW();

-- Create performance test table with large dataset simulation
CREATE TABLE IF NOT EXISTS test_performance_data (
    id SERIAL PRIMARY KEY,
    batch_id INTEGER NOT NULL,
    data_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    processing_time INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_performance_batch_id ON test_performance_data(batch_id);
CREATE INDEX idx_performance_data_type ON test_performance_data(data_type);
CREATE INDEX idx_performance_created_at ON test_performance_data(created_at);

-- Insert sample performance test data
INSERT INTO test_performance_data (batch_id, data_type, payload)
SELECT 
    i % 100 + 1 as batch_id,
    'test_generation' as data_type,
    jsonb_build_object(
        'template_name', 'template_' || (i % 50 + 1),
        'variables', jsonb_build_object('index', i, 'timestamp', NOW()),
        'complexity', CASE WHEN i % 3 = 0 THEN 'high' WHEN i % 3 = 1 THEN 'medium' ELSE 'low' END
    ) as payload
FROM generate_series(1, 1000) as i;

-- Create test isolation functions
CREATE OR REPLACE FUNCTION begin_test_transaction()
RETURNS void AS $$
BEGIN
    -- Start a new transaction for test isolation
    SET LOCAL search_path = public;
    SET LOCAL lock_timeout = '30s';
    SET LOCAL statement_timeout = '60s';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION rollback_test_transaction()
RETURNS void AS $$
BEGIN
    -- Rollback changes for test cleanup
    ROLLBACK;
END;
$$ LANGUAGE plpgsql;

-- Create health check function
CREATE OR REPLACE FUNCTION health_check()
RETURNS TABLE(status text, details jsonb) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'healthy'::text as status,
        jsonb_build_object(
            'database', current_database(),
            'user', current_user,
            'timestamp', NOW(),
            'table_count', (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'),
            'template_count', (SELECT COUNT(*) FROM test_templates),
            'generator_count', (SELECT COUNT(*) FROM test_generators)
        ) as details;
END;
$$ LANGUAGE plpgsql;

-- Log successful initialization
INSERT INTO test_configs (key, value, environment) VALUES
('database_initialized', 'true', 'test'),
('initialization_timestamp', to_jsonb(NOW()), 'test')
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    created_at = NOW();