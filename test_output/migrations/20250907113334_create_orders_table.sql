
--  Migration
-- Created: 2025-09-07 18:33:34
-- Table: orders
-- Model: Order

-- ============================================================================
-- CREATE ORDERS TABLE
-- ============================================================================


CREATE TABLE orders (

    -- Primary Key
    
    
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    
    

    -- Core Business Fields
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) CHECK (status IN ('active', 'inactive', 'pending', 'archived')) DEFAULT 'active',
    

    -- Custom Fields (add your specific fields here)
    

    -- Metadata and Configuration
    
    metadata NVARCHAR(MAX),
    config NVARCHAR(MAX),
    

    

    
    -- Timestamps
    
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    
    

    
    -- Soft Delete
    
    deleted_at TIMESTAMP NULL,
    deleted_by BIGINT NULL,
    
    

    -- Audit Fields
    
    created_by BIGINT,
    updated_by BIGINT,
    version INTEGER DEFAULT 1
    

    
);







-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================



-- ============================================================================
-- GRANT PERMISSIONS (Adjust as needed for your security model)
-- ============================================================================

-- Grant permissions to application user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON orders TO app_user;
-- 

-- Grant read-only permissions to reporting user
-- GRANT SELECT ON orders TO reporting_user;
-- 

-- Migration completed successfully
-- Table: orders
-- Features: timestamps, soft-deletes, 