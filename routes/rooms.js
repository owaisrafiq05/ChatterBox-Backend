import express from 'express';
import {
    createRoom,
    getActiveRooms,
    getRoomDetails,
    joinRoom,
    updateRoomStatus,
    leaveRoom,
    addMessage
} from '../controllers/roomController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Room management routes
router.post('/', createRoom);
router.get('/', getActiveRooms);
router.get('/:roomId', getRoomDetails);
router.post('/:roomId/join', joinRoom);
router.put('/:roomId/status', updateRoomStatus);
router.delete('/:roomId/leave', leaveRoom);
router.post('/:roomId/messages', addMessage);

export default router; 