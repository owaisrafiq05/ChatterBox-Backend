import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { initializeSocket } from './services/socketService.js';
import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Initialize WebSocket
initializeSocket(httpServer);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));

// Test route
app.get('/api/test', (req, res) => {
    res.json({ message: 'API is working' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('MongoDB connection error:', err));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Something went wrong!'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`
    });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
