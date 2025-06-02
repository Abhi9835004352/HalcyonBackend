const mongoose = require('mongoose');
const registrationSchema = new mongoose.Schema({
    teamName: {
        type: String,
        required: function() {
            // Team name is required for team events (teamSize > 1)
            // But not required for individual events (teamSize = 1)
            return this.teamSize && this.teamSize > 1;
        },
        validate: {
            validator: function(value) {
                // If teamSize > 1, teamName must be provided and not empty
                if (this.teamSize && this.teamSize > 1) {
                    return value && typeof value === 'string' && value.trim().length > 0;
                }
                return true; // For individual events, teamName is optional
            },
            message: 'Team name is required for team events with more than 1 participant'
        }
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
        enum: ['cash', 'erp', 'upi', 'online', null],
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
// For regular registrations: prevent the same user from registering twice for the same event
// For spot registrations: allow multiple registrations by the same team member but prevent duplicate participants
registrationSchema.index({
    event: 1,
    teamLeader: 1,
    'teamLeaderDetails.usn': 1
}, {
    unique: true,
    partialFilterExpression: {
        spotRegistration: { $exists: false }
    }
});

// For spot registrations: prevent duplicate participant USNs for the same event
registrationSchema.index({
    event: 1,
    'teamLeaderDetails.usn': 1
}, {
    unique: true,
    partialFilterExpression: {
        spotRegistration: { $exists: true }
    }
});

module.exports = mongoose.model('Registration', registrationSchema);
