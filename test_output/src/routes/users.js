const express = require('express');
const rateLimit = require('express-rate-limit');
const { authMiddleware } = require('../middleware/auth');
const { rbacMiddleware } = require('../middleware/rbac');
const { UsersController } = require('../controllers/UsersController');
const { asyncHandler } = require('../utils/async-handler');
const logger = require('../utils/logger');

const router = express.Router();
const controller = new UsersController();


// Rate limiting configuration
const createRateLimit = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { error: message },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      endpoint: req.path,
      method: req.method
    });
    res.status(429).json({ error: message });
  }
});

// Different rate limits for different operations
const listRateLimit = createRateLimit(15 * 60 * 1000, 100, 'Too many list requests'); // 100 per 15min
const createRateLimit = createRateLimit(15 * 60 * 1000, 10, 'Too many create requests'); // 10 per 15min
const updateRateLimit = createRateLimit(15 * 60 * 1000, 20, 'Too many update requests'); // 20 per 15min
const deleteRateLimit = createRateLimit(15 * 60 * 1000, 5, 'Too many delete requests'); // 5 per 15min



// Apply authentication to all routes
router.use(authMiddleware);


// Request logging middleware
router.use((req, res, next) => {
  logger.info(`Users API request`, {
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});




/**
 * @swagger
 * /api//User:
 *   get:
 *     summary: List User
 *     description: Get paginated list of User
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 
 */
router.get('/', 
  listRateLimit,
  rbacMiddleware('User:read'),
  asyncHandler(controller.list.bind(controller))
);

/**
 * @swagger
 * /api//User/{id}:
 *   get:
 *     summary: Get User by ID
 *     description: Retrieve a specific User by its ID
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 */
router.get('/:id', 
  listRateLimit,
  rbacMiddleware('User:read'),
  asyncHandler(controller.show.bind(controller))
);





/**
 * @swagger
 * /api//User:
 *   post:
 *     summary: Create new User
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/', 
  createRateLimit,
  rbacMiddleware('User:create'),
  asyncHandler(controller.create.bind(controller))
);



/**
 * @swagger
 * /api//User/{id}:
 *   put:
 *     summary: Update User
 *     description: Update an existing User
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUser'
 *     responses:
 *       200:
 *         description: Updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.put('/:id', 
  updateRateLimit,
  rbacMiddleware('User:update'),
  asyncHandler(controller.update.bind(controller))
);





/**
 * @swagger
 * /api//User/{id}:
 *   delete:
 *     summary: Delete User
 *     description: Delete an existing User
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Deleted successfully
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.delete('/:id', 
  deleteRateLimit,
  rbacMiddleware('User:delete'),
  asyncHandler(controller.delete.bind(controller))
);


// Error handling middleware specific to this route
router.use((error, req, res, next) => {
  logger.error(`Users API error`, {
    error: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    ip: req.ip
  });
  next(error);
});

module.exports = router;