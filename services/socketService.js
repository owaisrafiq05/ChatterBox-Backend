import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Room from '../models/Room.js';

let io;

export const initializeSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL,
            credentials: true
        }
    });

    // Authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication error'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select('-password');
            
            if (!user) {
                return next(new Error('User not found'));
            }

            socket.user = user;
            next();
        } catch (error) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.user.username}`);

        // Join room
        socket.on('join_room', async (roomId) => {
            try {
                const room = await Room.findById(roomId);
                if (!room) {
                    socket.emit('error', 'Room not found');
                    return;
                }

                // Check if user is in the room
                const isParticipant = room.participants.some(
                    p => p.user.toString() === socket.user._id.toString()
                );

                if (!isParticipant) {
                    socket.emit('error', 'Not a participant in this room');
                    return;
                }

                socket.join(roomId);
                socket.emit('room_joined', roomId);

                // Notify others
                socket.to(roomId).emit('user_joined', {
                    user: socket.user,
                    timestamp: new Date()
                });
            } catch (error) {
                socket.emit('error', error.message);
            }
        });

        // Leave room
        socket.on('leave_room', (roomId) => {
            socket.leave(roomId);
            socket.to(roomId).emit('user_left', {
                user: socket.user,
                timestamp: new Date()
            });
        });

        // Handle text messages
        socket.on('send_message', async (data) => {
            try {
                const { roomId, content } = data;
                const room = await Room.findById(roomId);

                if (!room) {
                    socket.emit('error', 'Room not found');
                    return;
                }

                // Check if user is in the room
                const isParticipant = room.participants.some(
                    p => p.user.toString() === socket.user._id.toString()
                );

                if (!isParticipant) {
                    socket.emit('error', 'Not a participant in this room');
                    return;
                }

                // Add message to room
                room.messages.push({
                    user: socket.user._id,
                    content
                });

                await room.save();

                // Broadcast message to room
                io.to(roomId).emit('new_message', {
                    user: socket.user,
                    content,
                    timestamp: new Date()
                });
            } catch (error) {
                socket.emit('error', error.message);
            }
        });

        // Handle audio stream
        socket.on('audio_stream', (data) => {
            const { roomId, audioData } = data;
            socket.to(roomId).emit('audio_stream', {
                user: socket.user,
                audioData,
                timestamp: new Date()
            });
        });

        // Handle user status changes (mute/unmute)
        socket.on('user_status_change', async (data) => {
            try {
                const { roomId, status } = data;
                const room = await Room.findById(roomId);

                if (!room) {
                    socket.emit('error', 'Room not found');
                    return;
                }

                // Update participant status
                const participant = room.participants.find(
                    p => p.user.toString() === socket.user._id.toString()
                );

                if (participant) {
                    participant.status = status;
                    await room.save();

                    // Notify room of status change
                    io.to(roomId).emit('user_status_changed', {
                        user: socket.user,
                        status,
                        timestamp: new Date()
                    });
                }
            } catch (error) {
                socket.emit('error', error.message);
            }
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.user.username}`);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
}; 