import { Router } from 'express';
import { listUsers, getUser, createUser, updateUser, deleteUser } from '../controllers/users.controller.js';
import { validate } from '../middleware/validation.js';
import { authenticate } from '../middleware/auth.js';

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

export default router;