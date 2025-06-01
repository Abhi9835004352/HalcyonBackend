const mongoose = require('mongoose');
const registrationSchema = new mongoose.Schema({
    teamName: {
        type: String,
        required: function() { return this.teamSize > 1; }
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
        },
        // For spot registrations, store the actual participant's name
        name: {
            type: String,
            required: false,
        },
        email: {
            type: String,
            required: false,
        },
        mobile: {
            type: String,
            required: false,
        }
    },
    // College code field - only used for team dashboard (spot) registrations
    collegeCode: {
        type: String,
        required: false,
        default: null
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
    paymentMode: {
        type: String,
        enum: ['cash', 'erp', 'upi', 'online'],
        default: null
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'not_required', 'pay_on_event_day', 'payment_required'],
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
