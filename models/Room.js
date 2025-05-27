import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isPrivate: {
        type: Boolean,
        default: false
    },
    password: {
        type: String,
        required: function() {
            return this.isPrivate;
        }
    },
    status: {
        type: String,
        enum: ['inactive', 'live'],
        default: 'inactive'
    },
    participants: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        status: {
            type: String,
            enum: ['active', 'muted', 'lobby'],
            default: 'active'
        },
        joinedAt: {
            type: Date,
            default: Date.now
        }
    }],
    messages: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        content: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// Index for faster queries
roomSchema.index({ status: 1, isPrivate: 1 });
roomSchema.index({ 'participants.user': 1 });

const Room = mongoose.model('Room', roomSchema);

export default Room; 