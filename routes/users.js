import express from 'express';
import { protect } from '../middleware/auth.js';
import { getUserById } from '../controllers/users.js';

const router = express.Router();

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', protect, getUserById);

export default router; 