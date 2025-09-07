{% if databaseType === 'postgresql' %}import { Pool, QueryResult } from 'pg';
import { BaseModel } from '../base/BaseModel.js';

export interface {{ modelName }}Data {
  id?: number;
  {% for field in fields %}{{ field.name }}{% if not field.required %}?{% endif %}: {{ field.type === 'string' ? 'string' : field.type === 'number' ? 'number' : field.type === 'boolean' ? 'boolean' : field.type === 'date' ? 'Date' : 'any' }};
  {% endfor %}{% if withTimestamps %}created_at?: Date;
  updated_at?: Date;{% endif %}{% if withSoftDelete %}
  deleted_at?: Date | null;{% endif %}
}

export interface {{ modelName }}Filters {
  {% for field in fields %}{{ field.name }}?: {{ field.type === 'string' ? 'string' : field.type === 'number' ? 'number' : field.type === 'boolean' ? 'boolean' : 'any' }};
  {% endfor %}{% if withSoftDelete %}include_deleted?: boolean;{% endif %}
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'ASC' | 'DESC';
}

export class {{ modelName }}Model extends BaseModel {
  protected tableName = '{{ tableName }}';
  
  constructor(pool: Pool) {
    super(pool);
  }

  /**
   * Create a new {{ modelName | lower }}
   */
  async create(data: Omit<{{ modelName }}Data, 'id'{% if withTimestamps %} | 'created_at' | 'updated_at'{% endif %}>): Promise<{{ modelName }}Data> {
    const fields = [{% for field in fields %}'{{ field.name }}'{% if not loop.last %}, {% endif %}{% endfor %}];
    const values = [{% for field in fields %}data.{{ field.name }}{% if not loop.last %}, {% endif %}{% endfor %}];
    const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');

    const query = `
      INSERT INTO {{ tableName }} (${fields.join(', ')}{% if withTimestamps %}, created_at, updated_at{% endif %})
      VALUES (${placeholders}{% if withTimestamps %}, NOW(), NOW(){% endif %})
      RETURNING *
    `;

    const result: QueryResult<{{ modelName }}Data> = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Find {{ modelName | lower }} by ID
   */
  async findById(id: number): Promise<{{ modelName }}Data | null> {
    const query = `
      SELECT * FROM {{ tableName }}
      WHERE id = $1{% if withSoftDelete %} AND deleted_at IS NULL{% endif %}
    `;

    const result: QueryResult<{{ modelName }}Data> = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find all {{ tableName }} with filtering and pagination
   */
  async findAll(filters: {{ modelName }}Filters = {}): Promise<{
    data: {{ modelName }}Data[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      {% for field in fields %}{{ field.name }},
      {% endfor %}{% if withSoftDelete %}include_deleted = false,{% endif %}
      page = 1,
      limit = 10,
      sort_by = 'id',
      sort_order = 'DESC'
    } = filters;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    {% for field in fields %}if ({{ field.name }} !== undefined) {
      conditions.push(`{{ field.name }} = $${++paramCount}`);
      values.push({{ field.name }});
    }
    {% endfor %}
    {% if withSoftDelete %}if (!include_deleted) {
      conditions.push('deleted_at IS NULL');
    }{% endif %}

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM {{ tableName }} ${whereClause}`;
    const countResult = await this.pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);

    // Get data
    const dataQuery = `
      SELECT * FROM {{ tableName }}
      ${whereClause}
      ORDER BY ${sort_by} ${sort_order}
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    values.push(limit, offset);

    const dataResult: QueryResult<{{ modelName }}Data> = await this.pool.query(dataQuery, values);

    return {
      data: dataResult.rows,
      total,
      page,
      limit
    };
  }

  /**
   * Update {{ modelName | lower }} by ID
   */
  async update(id: number, data: Partial<{{ modelName }}Data>): Promise<{{ modelName }}Data | null> {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    {% for field in fields %}if (data.{{ field.name }} !== undefined) {
      updateFields.push(`{{ field.name }} = $${++paramCount}`);
      values.push(data.{{ field.name }});
    }
    {% endfor %}

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    {% if withTimestamps %}updateFields.push(`updated_at = NOW()`);{% endif %}
    values.push(id);

    const query = `
      UPDATE {{ tableName }}
      SET ${updateFields.join(', ')}
      WHERE id = $${++paramCount}{% if withSoftDelete %} AND deleted_at IS NULL{% endif %}
      RETURNING *
    `;

    const result: QueryResult<{{ modelName }}Data> = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete {{ modelName | lower }} by ID
   */
  async delete(id: number): Promise<boolean> {
    {% if withSoftDelete %}const query = `
      UPDATE {{ tableName }}
      SET deleted_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
    `;{% else %}const query = `
      DELETE FROM {{ tableName }}
      WHERE id = $1
      RETURNING id
    `;{% endif %}

    const result = await this.pool.query(query, [id]);
    return result.rowCount > 0;
  }

  {% if withSoftDelete %}/**
   * Permanently delete {{ modelName | lower }} by ID
   */
  async hardDelete(id: number): Promise<boolean> {
    const query = `DELETE FROM {{ tableName }} WHERE id = $1 RETURNING id`;
    const result = await this.pool.query(query, [id]);
    return result.rowCount > 0;
  }

  /**
   * Restore soft-deleted {{ modelName | lower }} by ID
   */
  async restore(id: number): Promise<{{ modelName }}Data | null> {
    const query = `
      UPDATE {{ tableName }}
      SET deleted_at = NULL{% if withTimestamps %}, updated_at = NOW(){% endif %}
      WHERE id = $1 AND deleted_at IS NOT NULL
      RETURNING *
    `;

    const result: QueryResult<{{ modelName }}Data> = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }{% endif %}

  {% for field in fields %}{% if field.unique %}/**
   * Find {{ modelName | lower }} by {{ field.name }}
   */
  async findBy{{ field.name | pascalCase }}({{ field.name }}: {{ field.type === 'string' ? 'string' : field.type === 'number' ? 'number' : 'any' }}): Promise<{{ modelName }}Data | null> {
    const query = `
      SELECT * FROM {{ tableName }}
      WHERE {{ field.name }} = $1{% if withSoftDelete %} AND deleted_at IS NULL{% endif %}
    `;

    const result: QueryResult<{{ modelName }}Data> = await this.pool.query(query, [{{ field.name }}]);
    return result.rows[0] || null;
  }
  {% endif %}{% endfor %}

  /**
   * Check if {{ modelName | lower }} exists by ID
   */
  async exists(id: number): Promise<boolean> {
    const query = `
      SELECT 1 FROM {{ tableName }}
      WHERE id = $1{% if withSoftDelete %} AND deleted_at IS NULL{% endif %}
      LIMIT 1
    `;

    const result = await this.pool.query(query, [id]);
    return result.rowCount > 0;
  }

  /**
   * Get {{ tableName }} statistics
   */
  async getStats(): Promise<{
    total: number;
    {% if withSoftDelete %}active: number;
    deleted: number;{% endif %}
    {% if withTimestamps %}recent: number;{% endif %}
  }> {
    const queries = [
      'SELECT COUNT(*) as total FROM {{ tableName }}',
      {% if withSoftDelete %}'SELECT COUNT(*) as active FROM {{ tableName }} WHERE deleted_at IS NULL',
      'SELECT COUNT(*) as deleted FROM {{ tableName }} WHERE deleted_at IS NOT NULL',{% endif %}
      {% if withTimestamps %}'SELECT COUNT(*) as recent FROM {{ tableName }} WHERE created_at >= NOW() - INTERVAL \'30 days\'{% if withSoftDelete %} AND deleted_at IS NULL{% endif %}'{% endif %}
    ];

    const results = await Promise.all(
      queries.map(query => this.pool.query(query))
    );

    return {
      total: parseInt(results[0].rows[0].total),
      {% if withSoftDelete %}active: parseInt(results[1].rows[0].active),
      deleted: parseInt(results[2].rows[0].deleted),{% endif %}
      {% if withTimestamps %}recent: parseInt(results[{% if withSoftDelete %}3{% else %}1{% endif %}].rows[0].recent){% endif %}
    };
  }
}

{% elif databaseType === 'mongodb' %}import { Collection, MongoClient, ObjectId, Filter, UpdateFilter } from 'mongodb';
import { BaseModel } from '../base/BaseModel.js';

export interface {{ modelName }}Data {
  _id?: ObjectId;
  {% for field in fields %}{{ field.name }}{% if not field.required %}?{% endif %}: {{ field.type === 'string' ? 'string' : field.type === 'number' ? 'number' : field.type === 'boolean' ? 'boolean' : field.type === 'date' ? 'Date' : 'any' }};
  {% endfor %}{% if withTimestamps %}createdAt?: Date;
  updatedAt?: Date;{% endif %}{% if withSoftDelete %}
  deletedAt?: Date | null;{% endif %}
}

export class {{ modelName }}Model extends BaseModel {
  private collection: Collection<{{ modelName }}Data>;
  
  constructor(client: MongoClient, database: string) {
    super(client);
    this.collection = client.db(database).collection('{{ tableName }}');
  }

  async create(data: Omit<{{ modelName }}Data, '_id'{% if withTimestamps %} | 'createdAt' | 'updatedAt'{% endif %}>): Promise<{{ modelName }}Data> {
    const document = {
      ...data,
      {% if withTimestamps %}createdAt: new Date(),
      updatedAt: new Date(){% endif %}
    };

    const result = await this.collection.insertOne(document as {{ modelName }}Data);
    return { ...document, _id: result.insertedId };
  }

  async findById(id: string | ObjectId): Promise<{{ modelName }}Data | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const filter: Filter<{{ modelName }}Data> = { 
      _id: objectId{% if withSoftDelete %},
      deletedAt: { $exists: false }{% endif %}
    };

    return await this.collection.findOne(filter);
  }

  // Additional MongoDB methods...
}
{% endif %}