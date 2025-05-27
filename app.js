import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import Room from './models/Room.js';

// Routes
import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", // Vite's default port
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Keep track of connected users and their rooms
const connectedUsers = new Map();
const userSockets = new Map(); // Map user IDs to socket IDs

// Middleware
app.use(cors());
app.use(express.json());
app.use(helmet());
app.use(morgan('dev'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  const userId = socket.handshake.auth.token; // You might want to decode the token to get the actual user ID
  connectedUsers.set(socket.id, new Set());
  userSockets.set(userId, socket.id);

  socket.on('join-room', async (roomId) => {
    try {
      socket.join(roomId);
      connectedUsers.get(socket.id).add(roomId);
      
      // Get room data with participants
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

        // Send recent messages
        if (room.messages.length > 0) {
          socket.emit('chatMessage', room.messages.map(msg => ({
            userId: msg.sender._id,
            message: msg.content,
            timestamp: msg.timestamp
          })));
        }
      }

      console.log(`User ${socket.id} joined room ${roomId}`);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', 'Failed to join room');
    }
  });

  socket.on('leave-room', async (roomId) => {
    try {
      socket.leave(roomId);
      connectedUsers.get(socket.id)?.delete(roomId);
      
      // Get updated room data
      const room = await Room.findById(roomId)
        .populate('participants.user', 'username displayName');

      // Notify others in the room
      socket.to(roomId).emit('userLeft', {
        socketId: socket.id,
        userId: userId,
        room: room
      });

      console.log(`User ${socket.id} left room ${roomId}`);
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  });

  socket.on('chat-message', async (data) => {
    try {
      const { roomId, userId, message } = data;
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
      // Get all rooms this user was in
      const rooms = connectedUsers.get(socket.id) || new Set();
      
      // Update each room and notify other participants
      for (const roomId of rooms) {
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
      
      connectedUsers.delete(socket.id);
      userSockets.delete(userId);
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


