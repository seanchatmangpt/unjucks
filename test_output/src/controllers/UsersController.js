const Joi = require('joi');

const logger = require('../utils/logger');

const { UserService } = require('../services/UserService');
const { ApiResponse } = require('../utils/api-response');
const { ApiError } = require('../utils/api-error');
const { validateRequest } = require('../middleware/validation');

/**
 * User API Controller
 * Handles User resource operations with enterprise-grade features
 * 
 * @class UsersController
 */
class UsersController {
  constructor() {
    this.service = new UserService();
    
    this.setupValidationSchemas();
  }

  /**
   * Setup Joi validation schemas
   * @private
   */
  setupValidationSchemas() {
    this.schemas = {
      
      list: Joi.object({
        
        
      }),
      
      show: Joi.object({
        id: Joi.string().uuid().required()
      }),
      
      
      
      create: Joi.object({
        // Add specific fields for User creation
        name: Joi.string().min(2).max(255).required(),
        description: Joi.string().max(1000).optional(),
        status: Joi.string().valid('active', 'inactive').default('active'),
        metadata: Joi.object().optional(),
        // Add more fields as needed for your resource
      }),
      
      
      
      update: Joi.object({
        name: Joi.string().min(2).max(255).optional(),
        description: Joi.string().max(1000).optional(),
        status: Joi.string().valid('active', 'inactive').optional(),
        metadata: Joi.object().optional(),
        // Add more fields as needed for your resource
      }),
      
    };
  }

  
  /**
   * Get all User with pagination and filtering
   * 
   * @swagger
   * /api//User:
   *   get:
   *     summary: List User
   *     description: Get paginated list of User with optional filtering
   *     tags: [User]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       
   *       
   *     responses:
   *       200:
   *         description: Success
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/UserList'
   */
  async list(req, res, next) {
    try {
      

      const { error, value } = this.schemas.list.validate(req.query);
      if (error) {
        throw new ApiError(400, 'Validation Error', error.details);
      }

      

      const result = await this.service.findMany(value);

      

      res.json(ApiResponse.success(result, 'User retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single User by ID
   */
  async show(req, res, next) {
    try {
      

      const { error, value } = this.schemas.show.validate(req.params);
      if (error) {
        throw new ApiError(400, 'Validation Error', error.details);
      }

      

      const result = await this.service.findById(value.id);
      if (!result) {
        throw new ApiError(404, 'User not found');
      }

      

      res.json(ApiResponse.success(result, 'User retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }
  

  
  /**
   * Create new User
   * 
   * @swagger
   * /api//User:
   *   post:
   *     summary: Create User
   *     description: Create a new User
   *     tags: [User]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateUser'
   *     responses:
   *       201:
   *         description: Created successfully
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   */
  async create(req, res, next) {
    try {
      

      const { error, value } = this.schemas.create.validate(req.body);
      if (error) {
        throw new ApiError(400, 'Validation Error', error.details);
      }

      // Add user context if authenticated
      
      const createData = {
        ...value,
        created_by: req.user?.id,
        tenant_id: req.user?.tenant_id
      };
      

      const result = await this.service.create(createData);

      

      logger.info(`User created`, { id: result.id , userId: req.user?.id });

      res.status(201).json(ApiResponse.success(result, 'User created successfully'));
    } catch (error) {
      next(error);
    }
  }
  

  
  /**
   * Update existing User
   */
  async update(req, res, next) {
    try {
      

      const { error: idError, value: idValue } = this.schemas.show.validate(req.params);
      if (idError) {
        throw new ApiError(400, 'Invalid ID format', idError.details);
      }

      const { error, value } = this.schemas.update.validate(req.body);
      if (error) {
        throw new ApiError(400, 'Validation Error', error.details);
      }

      // Check if resource exists
      const existing = await this.service.findById(idValue.id);
      if (!existing) {
        throw new ApiError(404, 'User not found');
      }

      // Add update metadata
      const updateData = {
        ...value,
        updated_by: req.user?.id,
        updated_at: new Date()
      };

      const result = await this.service.update(idValue.id, updateData);

      

      logger.info(`User updated`, { id: idValue.id , userId: req.user?.id });

      res.json(ApiResponse.success(result, 'User updated successfully'));
    } catch (error) {
      next(error);
    }
  }
  

  
  /**
   * Delete User
   */
  async delete(req, res, next) {
    try {
      

      const { error, value } = this.schemas.show.validate(req.params);
      if (error) {
        throw new ApiError(400, 'Invalid ID format', error.details);
      }

      // Check if resource exists
      const existing = await this.service.findById(value.id);
      if (!existing) {
        throw new ApiError(404, 'User not found');
      }

      await this.service.delete(value.id);

      

      logger.info(`User deleted`, { id: value.id , userId: req.user?.id });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
  

  

  
}

module.exports = { UsersController };