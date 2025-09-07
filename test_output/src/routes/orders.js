const express = require('express');

const { authMiddleware } = require('../middleware/auth');

const { OrdersController } = require('../controllers/OrdersController');
const { asyncHandler } = require('../utils/async-handler');
const logger = require('../utils/logger');

const router = express.Router();
const controller = new OrdersController();




// Apply authentication to all routes
router.use(authMiddleware);


// Request logging middleware
router.use((req, res, next) => {
  logger.info(`Orders API request`, {
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
 * /api//Order:
 *   get:
 *     summary: List Order
 *     description: Get paginated list of Order
 *     tags: [Order]
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
 *                     $ref: '#/components/schemas/Order'
 *                 
 */
router.get('/', 
  
  
  asyncHandler(controller.list.bind(controller))
);

/**
 * @swagger
 * /api//Order/{id}:
 *   get:
 *     summary: Get Order by ID
 *     description: Retrieve a specific Order by its ID
 *     tags: [Order]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Order ID
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
 *                   $ref: '#/components/schemas/Order'
 *       404:
 *         description: Order not found
 */
router.get('/:id', 
  
  
  asyncHandler(controller.show.bind(controller))
);





/**
 * @swagger
 * /api//Order:
 *   post:
 *     summary: Create new Order
 *     description: Create a new Order
 *     tags: [Order]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrder'
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
 *                   $ref: '#/components/schemas/Order'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       
 */
router.post('/', 
  
  
  asyncHandler(controller.create.bind(controller))
);



/**
 * @swagger
 * /api//Order/{id}:
 *   put:
 *     summary: Update Order
 *     description: Update an existing Order
 *     tags: [Order]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Order ID
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateOrder'
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
 *                   $ref: '#/components/schemas/Order'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Order not found
 *       401:
 *         description: Unauthorized
 *       
 */
router.put('/:id', 
  
  
  asyncHandler(controller.update.bind(controller))
);





/**
 * @swagger
 * /api//Order/{id}:
 *   delete:
 *     summary: Delete Order
 *     description: Delete an existing Order
 *     tags: [Order]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Order ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Deleted successfully
 *       404:
 *         description: Order not found
 *       401:
 *         description: Unauthorized
 *       
 */
router.delete('/:id', 
  
  
  asyncHandler(controller.delete.bind(controller))
);


// Error handling middleware specific to this route
router.use((error, req, res, next) => {
  logger.error(`Orders API error`, {
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