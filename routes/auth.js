import express from 'express';
import { body } from 'express-validator';
import { register, login, getMe, updateProfile } from '../controllers/auth.js';
import { protect } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// Register user
router.post('/register',
  [
    body('username').trim().isLength({ min: 3 }),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('displayName').trim().notEmpty()
  ],
  register
);

// Login user
router.post('/login',
  [
    body('email').isEmail(),
    body('password').exists()
  ],
  login
);

// Get current user
router.get('/me', protect, getMe);

// Update user profile
router.put('/profile',
  protect,
  upload.single('avatar'),
  [
    body('email').optional().isEmail(),
    body('displayName').optional().trim().notEmpty(),
    body('currentPassword').optional().exists(),
    body('newPassword').optional().isLength({ min: 6 })
  ],
  updateProfile
);

export default router; 