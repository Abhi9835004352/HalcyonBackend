const mongoose = require('mongoose');
const registrationSchema = new mongoose.Schema({
    teamName: {
        type: String,
        required: function () { return this.teamMembers.length > 2; }
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
        required: 'True'
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
module.exports = mongoose.model('Registration', registrationSchema);
