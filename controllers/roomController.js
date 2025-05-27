import Room from '../models/Room.js';
import User from '../models/User.js';
import { cloudinary } from '../config/cloudinary.js';

// Create a new room
export const createRoom = async (req, res) => {
    try {
        const { name, isPrivate, password } = req.body;
        const userId = req.user.id;

        const room = await Room.create({
            name,
            creator: userId,
            isPrivate,
            password: isPrivate ? password : undefined,
            status: isPrivate ? 'inactive' : 'live',
            participants: [{ user: userId, status: 'active' }]
        });

        // Populate creator details
        await room.populate('creator', 'username displayName avatar');

        res.status(201).json({
            success: true,
            data: room
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get all active rooms (public only)
export const getActiveRooms = async (req, res) => {
    try {
        const rooms = await Room.find({
            status: 'live',
            isPrivate: false
        })
        .populate('creator', 'username displayName avatar')
        .populate('participants.user', 'username displayName avatar')
        .select('-password')
        .sort('-createdAt');

        res.status(200).json({
            success: true,
            data: rooms
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get room details
export const getRoomDetails = async (req, res) => {
    try {
        const room = await Room.findById(req.params.roomId)
            .populate('creator', 'username displayName avatar')
            .populate('participants.user', 'username displayName avatar')
            .populate('messages.user', 'username displayName avatar');

        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        // Check if user has access to private room
        if (room.isPrivate && !room.participants.some(p => p.user._id.toString() === req.user.id)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        res.status(200).json({
            success: true,
            data: room
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Join a room
export const joinRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { password } = req.body;
        const userId = req.user.id;

        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        // Check if user is already in the room
        if (room.participants.some(p => p.user.toString() === userId)) {
            return res.status(400).json({
                success: false,
                message: 'Already in room'
            });
        }

        // Check private room access
        if (room.isPrivate) {
            if (!password || password !== room.password) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid password'
                });
            }
        }

        // Add user to room
        const participantStatus = room.status === 'live' ? 'active' : 'lobby';
        room.participants.push({
            user: userId,
            status: participantStatus
        });

        await room.save();

        res.status(200).json({
            success: true,
            data: room
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Update room status (make live/inactive)
export const updateRoomStatus = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { status } = req.body;
        const userId = req.user.id;

        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        // Check if user is the creator
        if (room.creator.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Only room creator can update status'
            });
        }

        room.status = status;
        await room.save();

        res.status(200).json({
            success: true,
            data: room
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Leave room
export const leaveRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        const userId = req.user.id;

        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        // Remove user from participants
        room.participants = room.participants.filter(
            p => p.user.toString() !== userId
        );

        // If room is empty, delete it
        if (room.participants.length === 0) {
            await room.deleteOne();
            return res.status(200).json({
                success: true,
                message: 'Room deleted as it became empty'
            });
        }

        // If creator left, assign new creator
        if (room.creator.toString() === userId) {
            room.creator = room.participants[0].user;
        }

        await room.save();

        res.status(200).json({
            success: true,
            message: 'Left room successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Add message to room
export const addMessage = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;

        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        // Check if user is in the room
        if (!room.participants.some(p => p.user.toString() === userId)) {
            return res.status(403).json({
                success: false,
                message: 'Must be in room to send messages'
            });
        }

        room.messages.push({
            user: userId,
            content
        });

        await room.save();

        res.status(200).json({
            success: true,
            data: room.messages[room.messages.length - 1]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}; 