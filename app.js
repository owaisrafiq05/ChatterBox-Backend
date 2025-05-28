import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import Room from './models/Room.js';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';

// Routes
import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';
import userRoutes from './routes/users.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  }
});

// Get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Keep track of connected users and their rooms
const connectedUsers = new Map(); // socketId -> Set of roomIds
const userSockets = new Map(); // userId -> Set of socketIds (to handle multiple connections)
const userRooms = new Map(); // userId -> Set of roomIds

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/users', userRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Decode JWT token to get actual user ID
  const token = socket.handshake.auth.token;
  let userId;
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userId = decoded.id;
    console.log('Decoded user ID:', userId);
  } catch (error) {
    console.error('Invalid token:', error);
    socket.emit('error', 'Authentication failed');
    socket.disconnect();
    return;
  }

  // Initialize user's socket set if it doesn't exist
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId).add(socket.id);
  
  // Initialize user's room set if it doesn't exist
  if (!userRooms.has(userId)) {
    userRooms.set(userId, new Set());
  }
  
  connectedUsers.set(socket.id, new Set());

  socket.on('join-room', async (roomId) => {
    try {
      // Check if user is already in the room from any socket
      if (userRooms.get(userId).has(roomId)) {
        // If user is already in room, just add this socket to the room
        socket.join(roomId);
        connectedUsers.get(socket.id).add(roomId);
        
        // Send room info to this socket without notifying others
        const room = await Room.findById(roomId)
          .populate('participants.user', 'username displayName')
          .populate('messages.sender', 'username displayName');

        if (room) {
          socket.emit('roomInfo', {
            room: room,
            participants: room.participants
          });

          if (room.messages.length > 0) {
            socket.emit('chatMessage', room.messages.map(msg => ({
              userId: msg.sender._id,
              message: msg.content,
              timestamp: msg.timestamp
            })));
          }
        }
        return;
      }

      // If it's a new join, proceed with normal join process
      socket.join(roomId);
      connectedUsers.get(socket.id).add(roomId);
      userRooms.get(userId).add(roomId);
      
      const room = await Room.findById(roomId)
        .populate('participants.user', 'username displayName')
        .populate('messages.sender', 'username displayName');

      if (room) {
        // Notify others in the room
        socket.to(roomId).emit('userJoined', {
          socketId: socket.id,
          userId: userId,
          room: room
        });

        // Send room data to the joining user
        socket.emit('roomInfo', {
          room: room,
          participants: room.participants
        });

        if (room.messages.length > 0) {
          socket.emit('chatMessage', room.messages.map(msg => ({
            userId: msg.sender._id,
            message: msg.content,
            timestamp: msg.timestamp
          })));
        }
      }

      console.log(`User ${userId} joined room ${roomId}`);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', 'Failed to join room');
    }
  });

  socket.on('leave-room', async (roomId) => {
    try {
      socket.leave(roomId);
      connectedUsers.get(socket.id)?.delete(roomId);
      
      // Only emit leave event if user has no other sockets in the room
      const userSocketIds = userSockets.get(userId);
      let userStillInRoom = false;
      
      for (const socketId of userSocketIds) {
        if (socketId !== socket.id && connectedUsers.get(socketId)?.has(roomId)) {
          userStillInRoom = true;
          break;
        }
      }

      if (!userStillInRoom) {
        userRooms.get(userId).delete(roomId);
        
        const room = await Room.findById(roomId)
          .populate('participants.user', 'username displayName');

        socket.to(roomId).emit('userLeft', {
          socketId: socket.id,
          userId: userId,
          room: room
        });

        console.log(`User ${userId} left room ${roomId}`);
      }
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  });

  socket.on('chat-message', async (data) => {
    try {
      const { roomId, userId, message, displayName } = data;
      const timestamp = new Date();

      // Save message to database first
      const room = await Room.findById(roomId);
      if (room) {
        room.messages.push({
          sender: userId,
          content: message,
          timestamp
        });
        await room.save();

        // Then broadcast to all clients in the room (including sender)
        io.in(roomId).emit('chatMessage', {
          userId,
          displayName,
          message,
          timestamp
        });
      }
    } catch (error) {
      console.error('Error handling chat message:', error);
      socket.emit('error', 'Failed to send message');
    }
  });

  socket.on('disconnect', async () => {
    try {
      // Remove this socket from user's socket set
      userSockets.get(userId)?.delete(socket.id);
      
      // Get all rooms this socket was in
      const rooms = connectedUsers.get(socket.id) || new Set();
      
      // For each room, check if user has other active sockets in it
      for (const roomId of rooms) {
        let userStillInRoom = false;
        const userSocketIds = userSockets.get(userId) || new Set();
        
        for (const socketId of userSocketIds) {
          if (socketId !== socket.id && connectedUsers.get(socketId)?.has(roomId)) {
            userStillInRoom = true;
            break;
          }
        }

        if (!userStillInRoom) {
          userRooms.get(userId)?.delete(roomId);
          const room = await Room.findById(roomId)
            .populate('participants.user', 'username displayName');
            
          if (room) {
            socket.to(roomId).emit('userLeft', {
              socketId: socket.id,
              userId: userId,
              room: room
            });
          }
        }
      }
      
      // Clean up socket from tracking maps
      connectedUsers.delete(socket.id);
      
      // If user has no more sockets, clean up user maps
      if (userSockets.get(userId)?.size === 0) {
        userSockets.delete(userId);
        userRooms.delete(userId);
      }
      
      console.log('User disconnected:', socket.id);
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chatterbox')
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


