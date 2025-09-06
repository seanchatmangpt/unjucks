
import { Router } from 'express';
import { listUsers, getUser, createUser, updateUser, deleteUser } from '../controllers/users.controller';
import { validate } from '../middleware/validation';
import { authenticate } from '../middleware/auth';

const router = Router();


router.get('/',
  authenticate,
  
  listUsers
);


router.get('/:id',
  authenticate,
  validate(userIdSchema),
  getUser
);


router.post('/',
  authenticate,
  validate(createUserSchema),
  createUser
);


router.put('/:id',
  authenticate,
  validate(updateUserSchema),
  updateUser
);


router.delete('/:id',
  authenticate,
  validate(userIdSchema),
  deleteUser
);



export default router;
