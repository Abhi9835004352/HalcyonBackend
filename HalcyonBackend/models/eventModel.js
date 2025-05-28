const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    name: String,
    description: String,
    date: Date,
    venue: String,
    managedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rules: [String],
    prizes: [String],
    coordinators: [{
        name: String,
        phone: String
    }],
    teamSize: {
        type: Number,
        default: 1,
    },
    minTeamSize: {
        type: Number,
        default: 1,
    },
    maxTeamSize: {
        type: Number,
        default: 1,
    },
    isVariableTeamSize: {
        type: Boolean,
        default: false,
    },
    category: String,
    day: { type: Number, enum: [1, 2], default: 1 }, // 1 for Day 1, 2 for Day 2
    fees: { type: Number, default: 0 }, // Registration fees
    registrationOpen: {
        type: Boolean,
        default: true
    }
}, { timestamp: true });
module.exports = mongoose.model('Event', eventSchema);

