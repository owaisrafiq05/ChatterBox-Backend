import { validationResult } from 'express-validator';
import Room from '../models/Room.js';

// @desc    Create new room
// @route   POST /api/rooms
// @access  Private
export const createRoom = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, isPublic, accessCode } = req.body;

    const room = await Room.create({
      name,
      description,
      creator: req.user.id,
      isPublic,
      accessCode,
      participants: [{ user: req.user.id, role: 'creator' }]
    });

    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all rooms
// @route   GET /api/rooms
// @access  Private
export const getRooms = async (req, res) => {
  try {
    const rooms = await Room.find()
      .populate('creator', 'username displayName')
      .populate('participants.user', 'username displayName');
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get single room
// @route   GET /api/rooms/:id
// @access  Private
export const getRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('creator', 'username displayName')
      .populate('participants.user', 'username displayName')
      .populate('messages.sender', 'username displayName');

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    res.json(room);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update room status
// @route   PATCH /api/rooms/:id/status
// @access  Private
export const updateRoomStatus = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Check if user is room creator
    if (room.creator.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    room.status = req.body.status;
    await room.save();

    res.json(room);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Join room
// @route   POST /api/rooms/:id/join
// @access  Private
export const joinRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Check if room is private and validate access code
    if (!room.isPublic && room.accessCode !== req.body.accessCode) {
      return res.status(401).json({ message: 'Invalid access code' });
    }

    // Check if user is already in room
    const isParticipant = room.participants.some(
      (p) => p.user.toString() === req.user.id
    );

    if (!isParticipant) {
      room.participants.push({ user: req.user.id });
      await room.save();
    }

    res.json(room);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Leave room
// @route   POST /api/rooms/:id/leave
// @access  Private
export const leaveRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Remove user from participants
    room.participants = room.participants.filter(
      (p) => p.user.toString() !== req.user.id
    );

    await room.save();
    res.json({ message: 'Left room successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Send message in room
// @route   POST /api/rooms/:id/messages
// @access  Private
export const sendMessage = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Check if user is in room
    const isParticipant = room.participants.some(
      (p) => p.user.toString() === req.user.id
    );

    if (!isParticipant) {
      return res.status(401).json({ message: 'Not a room participant' });
    }

    const message = {
      sender: req.user.id,
      content: req.body.content
    };

    room.messages.push(message);
    await room.save();

    // Populate sender info for the new message
    const populatedRoom = await Room.findById(req.params.id)
      .populate('messages.sender', 'username displayName');

    const newMessage = populatedRoom.messages[populatedRoom.messages.length - 1];
    res.json(newMessage);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}; 