/**
 * Test Database Utility
 * Provides deterministic database state for testing
 */

import Database from 'better-sqlite3';
import { resolve } from 'path';
import fs from 'fs-extra';

export class TestDatabase {
  constructor() {
    this.dbPath = ':memory:'; // In-memory database for speed
    this.db = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    this.db = new Database(this.dbPath);
    
    // Enable foreign keys and WAL mode for consistency
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
    
    // Create test schema
    await this.createSchema();
    
    this.initialized = true;
  }

  async createSchema() {
    // Knowledge graph tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        properties TEXT, -- JSON blob
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        checksum TEXT
      );
      
      CREATE TABLE IF NOT EXISTS relationships (
        id TEXT PRIMARY KEY,
        subject_id TEXT NOT NULL,
        predicate TEXT NOT NULL,
        object_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subject_id) REFERENCES entities(id),
        FOREIGN KEY (object_id) REFERENCES entities(id)
      );
      
      CREATE TABLE IF NOT EXISTS triples (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        predicate TEXT NOT NULL,
        object TEXT NOT NULL,
        graph_context TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        checksum TEXT
      );
      
      CREATE TABLE IF NOT EXISTS operations (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        input_hash TEXT,
        output_hash TEXT,
        metadata TEXT, -- JSON blob
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS test_fixtures (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT, -- JSON blob
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indices for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_relationships_subject ON relationships(subject_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_predicate ON relationships(predicate);
      CREATE INDEX IF NOT EXISTS idx_triples_subject ON triples(subject);
      CREATE INDEX IF NOT EXISTS idx_operations_type ON operations(type);
      CREATE INDEX IF NOT EXISTS idx_operations_status ON operations(status);
    `);
  }

  async reset() {
    if (!this.db) return;
    
    // Clear all tables while preserving schema
    const tables = ['entities', 'relationships', 'triples', 'operations', 'test_fixtures'];
    
    for (const table of tables) {
      this.db.exec(`DELETE FROM ${table}`);
    }
    
    // Reset any auto-increment sequences
    this.db.exec(`DELETE FROM sqlite_sequence WHERE name IN (${tables.map(t => `'${t}'`).join(', ')})`);
  }

  async cleanup() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.initialized = false;
  }

  // Helper methods for test data creation

  insertEntity(entity) {
    const stmt = this.db.prepare(`
      INSERT INTO entities (id, type, properties, checksum)
      VALUES (?, ?, ?, ?)
    `);
    
    const checksum = this.calculateChecksum(entity);
    return stmt.run(
      entity.id,
      entity.type,
      JSON.stringify(entity.properties || {}),
      checksum
    );
  }

  insertTriple(triple) {
    const stmt = this.db.prepare(`
      INSERT INTO triples (id, subject, predicate, object, graph_context, checksum)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const id = triple.id || `${triple.subject}-${triple.predicate}-${triple.object}`;
    const checksum = this.calculateChecksum(triple);
    
    return stmt.run(
      id,
      triple.subject,
      triple.predicate,
      triple.object,
      triple.graph_context || 'default',
      checksum
    );
  }

  insertOperation(operation) {
    const stmt = this.db.prepare(`
      INSERT INTO operations (id, type, status, input_hash, output_hash, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    return stmt.run(
      operation.id,
      operation.type,
      operation.status,
      operation.input_hash,
      operation.output_hash,
      JSON.stringify(operation.metadata || {})
    );
  }

  // Query methods

  getEntity(id) {
    const stmt = this.db.prepare('SELECT * FROM entities WHERE id = ?');
    const row = stmt.get(id);
    
    if (row) {
      row.properties = JSON.parse(row.properties || '{}');
    }
    
    return row;
  }

  getTriples(subject = null, predicate = null, object = null) {
    let query = 'SELECT * FROM triples WHERE 1=1';
    const params = [];
    
    if (subject) {
      query += ' AND subject = ?';
      params.push(subject);
    }
    
    if (predicate) {
      query += ' AND predicate = ?';
      params.push(predicate);
    }
    
    if (object) {
      query += ' AND object = ?';
      params.push(object);
    }
    
    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  getOperations(type = null, status = null) {
    let query = 'SELECT * FROM operations WHERE 1=1';
    const params = [];
    
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params);
    
    return rows.map(row => ({
      ...row,
      metadata: JSON.parse(row.metadata || '{}')
    }));
  }

  // Determinism helpers

  calculateChecksum(data) {
    const crypto = require('crypto');
    const serialized = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  verifyDataIntegrity() {
    // Verify all checksums match
    const entities = this.db.prepare('SELECT * FROM entities').all();
    const triples = this.db.prepare('SELECT * FROM triples').all();
    
    const results = {
      entities: { total: entities.length, valid: 0, invalid: [] },
      triples: { total: triples.length, valid: 0, invalid: [] }
    };
    
    // Check entity checksums
    for (const entity of entities) {
      const data = {
        id: entity.id,
        type: entity.type,
        properties: JSON.parse(entity.properties || '{}')
      };
      
      const expectedChecksum = this.calculateChecksum(data);
      if (expectedChecksum === entity.checksum) {
        results.entities.valid++;
      } else {
        results.entities.invalid.push({
          id: entity.id,
          expected: expectedChecksum,
          actual: entity.checksum
        });
      }
    }
    
    // Check triple checksums
    for (const triple of triples) {
      const data = {
        subject: triple.subject,
        predicate: triple.predicate,
        object: triple.object,
        graph_context: triple.graph_context
      };
      
      const expectedChecksum = this.calculateChecksum(data);
      if (expectedChecksum === triple.checksum) {
        results.triples.valid++;
      } else {
        results.triples.invalid.push({
          id: triple.id,
          expected: expectedChecksum,
          actual: triple.checksum
        });
      }
    }
    
    return results;
  }

  // Test data seeding

  async seedTestData() {
    // Insert sample entities
    this.insertEntity({
      id: 'entity:person:1',
      type: 'Person',
      properties: {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com'
      }
    });
    
    this.insertEntity({
      id: 'entity:organization:1',
      type: 'Organization',
      properties: {
        name: 'ACME Corp',
        industry: 'Technology'
      }
    });
    
    // Insert sample triples
    this.insertTriple({
      subject: 'entity:person:1',
      predicate: 'worksFor',
      object: 'entity:organization:1',
      graph_context: 'employment'
    });
    
    this.insertTriple({
      subject: 'entity:person:1',
      predicate: 'hasName',
      object: '"John Doe"',
      graph_context: 'personal'
    });
  }
}