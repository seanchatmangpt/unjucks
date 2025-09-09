const { Router } = require('express');
const { listUsers, getUser, createUser, updateUser, deleteUser } = require('../controllers/users.controller.js');
const { validate } = require('../middleware/validation.js');
const { authenticate } = require('../middleware/auth.js');

const router = Router();

// GET /users - List all users
router.get('/',
  authenticate,
  listUsers
);

// GET /users/:id - Get user by ID
router.get('/:id',
  authenticate,
  validate(userIdSchema),
  getUser
);

// POST /users - Create new user
router.post('/',
  authenticate,
  validate(createUserSchema),
  createUser
);

// PUT /users/:id - Update user
router.put('/:id',
  authenticate,
  validate(updateUserSchema),
  updateUser
);

// DELETE /users/:id - Delete user
router.delete('/:id',
  authenticate,
  validate(userIdSchema),
  deleteUser
);

module.exports = router;