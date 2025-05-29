const mongoose = require('mongoose');
const registrationSchema = new mongoose.Schema({
    teamName: {
        type: String,
        required: function() { return this.teamSize > 2; }
    },
    teamLeader: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    teamLeaderDetails: {
        collegeName: {
            type: String,
            required: true,
        },
        usn: {
            type: String,
            required: true,
        }
    },
    teamMembers: [{
        name: {
            type: String,
        },
        email: {
            type: String,
        },
        mobile: {
            type: String,
        },
        usn: {
            type: String,
        },
        collegeName: {
            type: String,
        }
    }],
    teamSize: {
        type: Number,
        required: true,
        default: 1,
    },
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    registeredAt: {
        type: Date,
        default: Date.now
    },
    spotRegistration: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    paymentId: {
        type: String,
        default: null
    },
    orderId: {
        type: String,
        default: null
    },
    transactionId: {
        type: String,
        default: null
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'not_required'],
        default: 'pending',
    },
    notes: {
        type: String,
        default: null
    }
}, { timestamps: true });

// Create a compound unique index to prevent duplicate registrations
// This ensures that the same user (teamLeader) cannot register for the same event twice
registrationSchema.index({ event: 1, teamLeader: 1 }, { unique: true });

module.exports = mongoose.model('Registration', registrationSchema);
