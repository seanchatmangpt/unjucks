-- KGEN PostgreSQL Initialization Script
-- This script sets up the initial database schema and configuration

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create KGEN database if it doesn't exist (handled by POSTGRES_DB)
-- CREATE DATABASE IF NOT EXISTS kgen;

-- Use the KGEN database
\c kgen;

-- Create RDF triples table with optimized indexes
CREATE TABLE IF NOT EXISTS rdf_triples (
    id BIGSERIAL PRIMARY KEY,
    subject TEXT NOT NULL,
    predicate TEXT NOT NULL,
    object TEXT NOT NULL,
    object_type VARCHAR(20) NOT NULL DEFAULT 'literal',
    object_datatype TEXT,
    object_language VARCHAR(10),
    graph_name TEXT DEFAULT 'default',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(subject, predicate, object, graph_name)
);

-- Create indexes for RDF triples table
CREATE INDEX IF NOT EXISTS idx_rdf_subject ON rdf_triples(subject);
CREATE INDEX IF NOT EXISTS idx_rdf_predicate ON rdf_triples(predicate);
CREATE INDEX IF NOT EXISTS idx_rdf_object ON rdf_triples(object);
CREATE INDEX IF NOT EXISTS idx_rdf_graph ON rdf_triples(graph_name);
CREATE INDEX IF NOT EXISTS idx_rdf_spo ON rdf_triples(subject, predicate, object);
CREATE INDEX IF NOT EXISTS idx_rdf_type ON rdf_triples(object_type);
CREATE INDEX IF NOT EXISTS idx_rdf_datatype ON rdf_triples(object_datatype) WHERE object_datatype IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rdf_language ON rdf_triples(object_language) WHERE object_language IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rdf_created ON rdf_triples(created_at);

-- Create GIN index for full-text search on object values
CREATE INDEX IF NOT EXISTS idx_rdf_object_gin ON rdf_triples USING gin(object gin_trgm_ops);

-- Create namespaces table
CREATE TABLE IF NOT EXISTS namespaces (
    id SERIAL PRIMARY KEY,
    prefix VARCHAR(50) NOT NULL UNIQUE,
    uri TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert common namespaces
INSERT INTO namespaces (prefix, uri, description) VALUES
('rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'RDF Vocabulary')
ON CONFLICT (prefix) DO NOTHING;

INSERT INTO namespaces (prefix, uri, description) VALUES
('rdfs', 'http://www.w3.org/2000/01/rdf-schema#', 'RDF Schema')
ON CONFLICT (prefix) DO NOTHING;

INSERT INTO namespaces (prefix, uri, description) VALUES
('owl', 'http://www.w3.org/2002/07/owl#', 'OWL Web Ontology Language')
ON CONFLICT (prefix) DO NOTHING;

INSERT INTO namespaces (prefix, uri, description) VALUES
('xsd', 'http://www.w3.org/2001/XMLSchema#', 'XML Schema Datatypes')
ON CONFLICT (prefix) DO NOTHING;

INSERT INTO namespaces (prefix, uri, description) VALUES
('foaf', 'http://xmlns.com/foaf/0.1/', 'Friend of a Friend')
ON CONFLICT (prefix) DO NOTHING;

INSERT INTO namespaces (prefix, uri, description) VALUES
('dcterms', 'http://purl.org/dc/terms/', 'Dublin Core Terms')
ON CONFLICT (prefix) DO NOTHING;

INSERT INTO namespaces (prefix, uri, description) VALUES
('skos', 'http://www.w3.org/2004/02/skos/core#', 'Simple Knowledge Organization System')
ON CONFLICT (prefix) DO NOTHING;

INSERT INTO namespaces (prefix, uri, description) VALUES
('sh', 'http://www.w3.org/ns/shacl#', 'Shapes Constraint Language')
ON CONFLICT (prefix) DO NOTHING;

-- Create SHACL shapes table
CREATE TABLE IF NOT EXISTS shacl_shapes (
    id SERIAL PRIMARY KEY,
    shape_id TEXT NOT NULL UNIQUE,
    shape_name TEXT,
    shape_data JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for SHACL shapes
CREATE INDEX IF NOT EXISTS idx_shacl_shape_id ON shacl_shapes(shape_id);
CREATE INDEX IF NOT EXISTS idx_shacl_active ON shacl_shapes(is_active);
CREATE INDEX IF NOT EXISTS idx_shacl_data_gin ON shacl_shapes USING gin(shape_data);

-- Create validation results table
CREATE TABLE IF NOT EXISTS validation_results (
    id BIGSERIAL PRIMARY KEY,
    data_hash VARCHAR(64) NOT NULL,
    shape_id TEXT NOT NULL,
    conforms BOOLEAN NOT NULL,
    violations JSONB,
    validation_time INTEGER, -- milliseconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Create indexes for validation results
CREATE INDEX IF NOT EXISTS idx_validation_hash_shape ON validation_results(data_hash, shape_id);
CREATE INDEX IF NOT EXISTS idx_validation_expires ON validation_results(expires_at);
CREATE INDEX IF NOT EXISTS idx_validation_conforms ON validation_results(conforms);

-- Create query cache table
CREATE TABLE IF NOT EXISTS query_cache (
    id BIGSERIAL PRIMARY KEY,
    query_hash VARCHAR(64) NOT NULL UNIQUE,
    query_text TEXT NOT NULL,
    result_data JSONB NOT NULL,
    result_size INTEGER,
    execution_time INTEGER, -- milliseconds
    hit_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create indexes for query cache
CREATE INDEX IF NOT EXISTS idx_query_cache_expires ON query_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_query_cache_accessed ON query_cache(last_accessed);
CREATE INDEX IF NOT EXISTS idx_query_cache_hash ON query_cache(query_hash);

-- Create system metrics table
CREATE TABLE IF NOT EXISTS system_metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC NOT NULL,
    metric_labels JSONB,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for system metrics
CREATE INDEX IF NOT EXISTS idx_metrics_name_time ON system_metrics(metric_name, recorded_at);
CREATE INDEX IF NOT EXISTS idx_metrics_recorded ON system_metrics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_metrics_labels_gin ON system_metrics USING gin(metric_labels);

-- Create users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255),
    roles JSONB DEFAULT '["user"]',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for users
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Create API keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    key_id UUID DEFAULT uuid_generate_v4() UNIQUE,
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(100),
    description TEXT,
    user_id INTEGER REFERENCES users(id),
    scopes JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    last_used TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for API keys
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires ON api_keys(expires_at);

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    api_key_id INTEGER REFERENCES api_keys(id),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_id TEXT,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for audit log
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_ip ON audit_log(ip_address);

-- Create function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_rdf_triples_updated_at 
    BEFORE UPDATE ON rdf_triples 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_namespaces_updated_at 
    BEFORE UPDATE ON namespaces 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shacl_shapes_updated_at 
    BEFORE UPDATE ON shacl_shapes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to clean expired records
CREATE OR REPLACE FUNCTION cleanup_expired_records()
RETURNS void AS $$
BEGIN
    -- Clean expired validation results
    DELETE FROM validation_results WHERE expires_at < NOW();
    
    -- Clean expired query cache
    DELETE FROM query_cache WHERE expires_at < NOW();
    
    -- Clean old system metrics (keep last 30 days)
    DELETE FROM system_metrics WHERE recorded_at < NOW() - INTERVAL '30 days';
    
    -- Clean old audit logs (keep last 90 days)
    DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '90 days';
    
    RAISE NOTICE 'Cleanup completed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a view for RDF triple statistics
CREATE OR REPLACE VIEW rdf_statistics AS
SELECT 
    COUNT(*) as total_triples,
    COUNT(DISTINCT subject) as unique_subjects,
    COUNT(DISTINCT predicate) as unique_predicates,
    COUNT(DISTINCT object) as unique_objects,
    COUNT(DISTINCT graph_name) as unique_graphs,
    COUNT(CASE WHEN object_type = 'literal' THEN 1 END) as literal_objects,
    COUNT(CASE WHEN object_type = 'uri' THEN 1 END) as uri_objects,
    COUNT(CASE WHEN object_language IS NOT NULL THEN 1 END) as language_tagged_literals,
    COUNT(CASE WHEN object_datatype IS NOT NULL THEN 1 END) as datatype_literals
FROM rdf_triples;

-- Create a view for system health
CREATE OR REPLACE VIEW system_health AS
SELECT 
    'database' as component,
    'healthy' as status,
    jsonb_build_object(
        'total_tables', (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'),
        'rdf_triples', (SELECT count(*) FROM rdf_triples),
        'database_size', pg_size_pretty(pg_database_size(current_database())),
        'last_vacuum', (SELECT max(last_vacuum) FROM pg_stat_user_tables)
    ) as details,
    NOW() as checked_at;

-- Grant permissions to kgen user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO kgen;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO kgen;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO kgen;

-- Set default search path
ALTER USER kgen SET search_path = public;

-- Insert initial admin user (password: 'admin' - change in production!)
INSERT INTO users (username, email, password_hash, full_name, roles) VALUES
('admin', 'admin@kgen.local', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LBNb2OXq9lLBJPKzO', 'System Administrator', '["admin", "user"]')
ON CONFLICT (username) DO NOTHING;

-- Log initialization completion
DO $$
BEGIN
    RAISE NOTICE 'KGEN PostgreSQL initialization completed at %', NOW();
    RAISE NOTICE 'Database: %', current_database();
    RAISE NOTICE 'Version: %', version();
END $$;