const { Model } = require('objection');
const Joi = require('joi');

/**
 * Order Model
 * 
 * Represents orders table in the database
 */
class Order extends Model {
  /**
   * Table name in database
   */
  static get tableName() {
    return 'orders';
  }

  /**
   * JSON Schema for validation
   */
  static get jsonSchema() {
    return {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },
        status: { type: 'string', enum: ['active', 'inactive'] },
        
        // Timestamps
        
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
        
        
        // Soft deletes
        
        deleted_at: { type: ['string', 'null'], format: 'date-time' },
        
      }
    };
  }

  /**
   * Model relationships
   */
  static get relationMappings() {
    return {
      // Define relationships here based on your schema
    };
  }

  /**
   * Before insert hook
   */
  $beforeInsert() {
    
    this.created_at = new Date().toISOString();
    this.updated_at = new Date().toISOString();
    
  }

  /**
   * Before update hook
   */
  $beforeUpdate() {
    
    this.updated_at = new Date().toISOString();
    
  }

  /**
   * Query modifiers
   */
  static get modifiers() {
    return {
      // Active records only (if soft deletes enabled)
      
      active(query) {
        query.whereNull('deleted_at');
      },
      

      // Filter by status
      byStatus(query, status) {
        query.where('status', status);
      }
    };
  }

  /**
   * Find active records
   */
  static findActive() {
    return this.query().modify('active');
  }

  /**
   * Soft delete (if enabled)
   */
  
  async softDelete() {
    return await this.$query().patch({
      deleted_at: new Date().toISOString()
    });
  }
  
}

module.exports = Order;