const Registration = require('../models/registrationModel');
const Event = require('../models/eventModel');
const mongoose = require('mongoose');

const registerForEvent = async (req, res) => {
    try {
        console.log('Registration request received');
        console.log('User from token:', req.user);
        console.log('Request body:', req.body);
        console.log('Request params:', req.params);
        // Check if user has the correct role for regular registration
        if (req.user.role !== 'user') {
            return res.status(403).json({
                error: "Only regular users can use this endpoint for registration",
                message: "Team members should use the spot registration endpoint"
            });
        }
        const { eventId } = req.params;
        const {
            teamName,
            teamMembers,
            teamSize,
            teamLeaderDetails,
            paymentId,
            orderId,
            transactionId
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ error: "Invalid event ID format" });
        }

        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ error: "Event not found" });

        // Check if registration is open for this event
        if (!event.registrationOpen) {
            return res.status(403).json({
                error: "Registration for this event is currently closed",
                registrationClosed: true
            });
        }

        // Validate team size - Use improved logic from main branch
        // For team events, always use min and max team sizes if available
        if (event.teamSize >= 3 || event.isVariableTeamSize) {
            // Use minTeamSize and maxTeamSize if available, otherwise fall back to teamSize
            const minSize = event.minTeamSize || event.teamSize;
            const maxSize = event.maxTeamSize || event.teamSize;

            if (teamSize < minSize) {
                return res.status(400).json({ error: `Team size cannot be less than ${minSize}` });
            }

            if (teamSize > maxSize) {
                return res.status(400).json({ error: `Team size cannot exceed ${maxSize}` });
            }
        } else {
            // For individual or duo events, use exact team size
            if (teamSize !== event.teamSize) {
                return res.status(400).json({ error: `Team size must be ${event.teamSize} members` });
            }
        }

        // Validate team name for larger teams
        if (teamSize > 2 && !teamName) {
            return res.status(400).json({ error: "Team name is required for teams with more than 2 members" });
        }

        // Validate team leader details
        if (!teamLeaderDetails || !teamLeaderDetails.collegeName || !teamLeaderDetails.usn) {
            return res.status(400).json({ error: "Team leader details are required" });
        }

        // Check for duplicate registration
        const existingRegistration = await Registration.findOne({
            event: eventId,
            teamLeader: req.user._id
        });

        if (existingRegistration) {
            console.log('Duplicate registration attempt detected:', {
                userId: req.user._id,
                eventId: eventId,
                existingRegistrationId: existingRegistration._id,
                registrationDate: existingRegistration.createdAt
            });

            return res.status(409).json({
                error: 'You have already registered for this event',
                alreadyRegistered: true,
                registrationDate: existingRegistration.createdAt,
                registrationId: existingRegistration._id,
                message: 'Duplicate registration is not allowed. Each user can only register once per event.'
            });
        }

        // PAYMENT CHECK BYPASSED - Accept registration regardless of payment status
        console.log('Payment check bypassed - accepting registration');

        // Check if this is a spot registration (created by a team member)
        const isSpotRegistration = req.user.role === 'team';

        // Prepare registration data
        const registrationData = {
            event: eventId,
            teamLeader: req.user._id, // Set the authenticated user as team leader
            teamLeaderDetails: {
                collegeName: teamLeaderDetails.collegeName,
                usn: teamLeaderDetails.usn,
            },
            teamName: teamName || null,
            teamMembers: teamMembers || [],
            teamSize: teamSize || 1,
            spotRegistration: isSpotRegistration ? req.user._id : null,
            paymentId: paymentId || null,
            orderId: orderId || null,
            transactionId: transactionId || null,
            paymentStatus: event.fees > 0 ? 'pending' : 'not_required'
        };

        console.log('Creating registration with data:', JSON.stringify(registrationData, null, 2));

        const registration = await Registration.create(registrationData);

        console.log('Registration created successfully:', registration);
        res.status(201).json(registration);
    } catch (err) {
        console.error('Registration creation failed:', err);

        // Handle validation errors specifically
        if (err.name === 'ValidationError') {
            const validationErrors = Object.values(err.errors).map(e => e.message);
            console.error('Validation errors:', validationErrors);
            return res.status(400).json({
                error: 'Validation failed',
                details: validationErrors,
                fullError: err.message
            });
        }

        // Handle duplicate key errors (database-level constraint)
        if (err.code === 11000) {
            console.error('Database duplicate key error - user attempted to register twice:', {
                userId: req.user._id,
                eventId: req.params.eventId,
                error: err.message
            });

            return res.status(409).json({
                error: 'You have already registered for this event',
                alreadyRegistered: true,
                message: 'Duplicate registration prevented by database constraint. Each user can only register once per event.',
                details: 'This error occurred at the database level, indicating a duplicate registration attempt.'
            });
        }

        return res.status(500).json({ error: err.message });
    }
}

const viewMyRegistration = async (req, res) => {
    try {
        const registrations = await Registration.find({
            $or: [
                { teamLeader: req.user._id },
                { spotRegistration: req.user._id }
            ]
        }).populate('event');

        // For regular registrations, populate the teamLeader field
        // For spot registrations, this might fail since we're using a generated ObjectId
        try {
            await Registration.populate(registrations, {
                path: 'teamLeader',
                select: 'name email mobile'
            });
        } catch (populateErr) {
            console.log('Error populating teamLeader, this is expected for spot registrations:', populateErr.message);
        }

        // Populate the spotRegistration field to get team member info
        try {
            await Registration.populate(registrations, {
                path: 'spotRegistration',
                select: 'name email mobile'
            });
        } catch (populateErr) {
            console.log('Error populating spotRegistration:', populateErr.message);
        }

        // Process the registrations to add a flag for spot registrations
        const processedRegistrations = registrations.map(reg => {
            const regObj = reg.toObject();

            // If this is a spot registration, add a flag and set teamLeader info from the first team member
            if (reg.spotRegistration) {
                regObj.isSpotRegistration = true;

                // Add team member info who performed the spot registration
                regObj.registeredBy = {
                    name: reg.spotRegistration?.name || 'Unknown Team Member',
                    email: reg.spotRegistration?.email || 'N/A',
                    mobile: reg.spotRegistration?.mobile || 'N/A',
                    id: reg.spotRegistration?._id || null
                };

                // If there are team members, use the first one's info as the "team leader" for display
                if (reg.teamMembers && reg.teamMembers.length > 0) {
                    const firstMember = reg.teamMembers[0];
                    regObj.displayTeamLeader = {
                        name: firstMember.name || 'Unknown',
                        email: firstMember.email || 'N/A',
                        mobile: firstMember.mobile || 'N/A'
                    };
                }
            }

            return regObj;
        });

        res.json(processedRegistrations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

const checkRegistration = async (req, res) => {
    try {
        console.log('Checking registration for event:', req.params.eventId);
        console.log('User:', req.user);

        const { eventId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ error: "Invalid event ID format" });
        }

        // Check if user is already registered for this event
        const existingRegistration = await Registration.findOne({
            event: eventId,
            teamLeader: req.user._id
        }).populate('event', 'name');

        if (existingRegistration) {
            return res.json({
                isRegistered: true,
                registrationDetails: {
                    teamName: existingRegistration.teamName,
                    teamSize: existingRegistration.teamSize,
                    registrationDate: existingRegistration.createdAt,
                    transactionId: existingRegistration.transactionId,
                    paymentStatus: existingRegistration.paymentStatus
                }
            });
        } else {
            return res.json({
                isRegistered: false
            });
        }
    } catch (err) {
        console.error('Error checking registration:', err);
        res.status(500).json({ error: err.message });
    }
}

module.exports = { registerForEvent, viewMyRegistration, checkRegistration };
