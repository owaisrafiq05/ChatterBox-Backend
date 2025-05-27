import express from 'express';
import { body } from 'express-validator';
import { protect } from '../middleware/auth.js';
import {
  createRoom,
  getRooms,
  getRoom,
  updateRoomStatus,
  joinRoom,
  leaveRoom,
  sendMessage
} from '../controllers/rooms.js';

const router = express.Router();

// Create a new room
router.post('/',
  protect,
  [
    body('name').trim().notEmpty(),
    body('isPublic').isBoolean(),
    body('accessCode').if(body('isPublic').equals('false')).notEmpty()
  ],
  createRoom
);

// Get all rooms
router.get('/', protect, getRooms);

// Get single room
router.get('/:id', protect, getRoom);

// Update room status
router.patch('/:id/status',
  protect,
  [
    body('status').isIn(['inactive', 'live'])
  ],
  updateRoomStatus
);

// Join room
router.post('/:id/join',
  protect,
  [
    body('accessCode').if(body('isPublic').equals('false')).notEmpty()
  ],
  joinRoom
);

// Leave room
router.post('/:id/leave', protect, leaveRoom);

// Send message in room
router.post('/:id/messages',
  protect,
  [
    body('content').trim().notEmpty()
  ],
  sendMessage
);

export default router; 