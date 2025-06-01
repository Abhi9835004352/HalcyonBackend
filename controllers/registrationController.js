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
                // For spot registrations, store the actual participant's information
                name: isSpotRegistration ? teamLeaderDetails.name || null : null,
                email: isSpotRegistration ? teamLeaderDetails.email || null : null,
                mobile: isSpotRegistration ? teamLeaderDetails.mobile || null : null,
            },
            teamName: teamName || null,
            teamMembers: teamMembers || [],
            teamSize: teamSize || 1,
            spotRegistration: isSpotRegistration ? req.user._id : null,
            paymentId: paymentId || null,
            orderId: orderId || null,
            transactionId: transactionId || null,
            paymentStatus: (() => {
                if (event.fees === 0) return 'not_required';

                // Check if any team member is from SIT (same college)
                const allParticipants = [
                    { usn: teamLeaderDetails.usn },
                    ...(teamMembers || [])
                ];

                const hasAnySITStudent = allParticipants.some(participant =>
                    participant.usn && participant.usn.toLowerCase().startsWith('1si')
                );

                const isGamingEvent = event.category === 'gaming';

                if (!hasAnySITStudent) {
                    // Other college students: pay on event day
                    return 'pay_on_event_day';
                } else if (hasAnySITStudent && isGamingEvent) {
                    // Same college + gaming events: payment notification required
                    return 'payment_required';
                } else {
                    // Same college + non-gaming events: free (SIT exemption)
                    return 'not_required';
                }
            })()
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
        console.log('viewMyRegistration called for user:', req.user._id);

        const registrations = await Registration.find({
            $or: [
                { teamLeader: req.user._id },
                { spotRegistration: req.user._id }
            ]
        }).populate('event');

        console.log(`Found ${registrations.length} registrations for user ${req.user._id}`);

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

            // If this is a spot registration, add a flag and set teamLeader info from teamLeaderDetails
            if (reg.spotRegistration) {
                regObj.isSpotRegistration = true;

                // Add team member info who performed the spot registration
                regObj.registeredBy = {
                    name: reg.spotRegistration?.name || 'Unknown Team Member',
                    email: reg.spotRegistration?.email || 'N/A',
                    mobile: reg.spotRegistration?.mobile || 'N/A',
                    id: reg.spotRegistration?._id || null
                };

                // For spot registrations, use the participant's information from teamLeaderDetails
                if (reg.teamLeaderDetails) {
                    regObj.displayTeamLeader = {
                        name: reg.teamLeaderDetails.name || 'Unknown Participant',
                        email: reg.teamLeaderDetails.email || 'N/A',
                        mobile: reg.teamLeaderDetails.mobile || 'N/A',
                        usn: reg.teamLeaderDetails.usn || 'N/A'
                    };
                }
            }

            return regObj;
        });

        console.log('Returning processed registrations:', processedRegistrations.length);

        // Always return 200 status with the array (empty or populated)
        // This is the correct REST API behavior - 404 should only be used when the resource itself doesn't exist
        res.status(200).json(processedRegistrations);
    } catch (err) {
        console.error('Error in viewMyRegistration:', err);
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

// Spot registration function for team members
const spotRegistration = async (req, res) => {
    try {
        console.log('Spot registration request received');
        console.log('Team member from token:', req.user);
        console.log('Request body:', req.body);
        console.log('Request params:', req.params);

        const { eventId } = req.params;
        const {
            teamName,
            teamMembers,
            teamSize,
            teamLeaderDetails,
            collegeCode,
            paymentStatus: frontendPaymentStatus,
            paymentMode: frontendPaymentMode,
            paymentId,
            orderId,
            transactionId,
            notes
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(eventId)) {
            return res.status(400).json({ error: "Invalid event ID format" });
        }

        // Get event details
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ error: "Event not found" });
        }

        // Validate team leader details
        if (!teamLeaderDetails || !teamLeaderDetails.collegeName || !teamLeaderDetails.usn) {
            return res.status(400).json({ error: "Team leader details are required" });
        }

        // Use frontend provided payment mode, or extract from notes as fallback
        let paymentMode = frontendPaymentMode || null;

        console.log('Frontend provided payment mode:', frontendPaymentMode);
        console.log('Frontend provided payment status:', frontendPaymentStatus);

        // If no frontend payment mode provided, extract from notes as fallback
        if (!paymentMode && notes && typeof notes === 'string') {
            const noteText = notes.toLowerCase();
            if (noteText.includes('cash')) {
                paymentMode = 'cash';
            } else if (noteText.includes('erp')) {
                paymentMode = 'erp';
            } else if (noteText.includes('upi')) {
                paymentMode = 'upi';
            }
            console.log('Extracted payment mode from notes:', paymentMode);
        }

        // Determine payment status - IMPORTANT: Payment is calculated per TEAM, not per individual member
        // For team events, only ONE payment is required per team, regardless of team size
        let paymentStatus;

        if (frontendPaymentStatus) {
            // Use the frontend provided payment status (for spot registrations with payment)
            paymentStatus = frontendPaymentStatus;
            console.log('Using frontend provided payment status:', paymentStatus);
        } else if (event.fees > 0) {
            // Calculate payment status based on USN and event category (for regular registrations)
            const allParticipants = [
                { usn: teamLeaderDetails.usn },
                ...(teamMembers || [])
            ];

            const hasAnySITStudent = allParticipants.some(participant =>
                participant.usn && participant.usn.toLowerCase().startsWith('1si')
            );

            const isGamingEvent = event.category === 'gaming';

            if (!hasAnySITStudent) {
                // Other college students: pay on event day
                paymentStatus = 'pay_on_event_day';
            } else if (hasAnySITStudent && isGamingEvent) {
                // Same college + gaming events: payment notification required
                paymentStatus = 'payment_required';
            } else {
                // Same college + non-gaming events: free (SIT exemption)
                paymentStatus = 'not_required';
            }
            console.log('Calculated payment status based on USN and event:', paymentStatus);
        } else {
            // Free event
            paymentStatus = 'not_required';
            console.log('Free event - payment not required');
        }

        console.log('Final payment mode to be stored:', paymentMode);
        console.log('Final payment status to be stored:', paymentStatus);

        // For team events, check if a registration already exists for this event with the same team name
        // This prevents multiple team members from creating separate registrations for the same team
        if (teamName && teamSize > 1) {
            const existingTeamRegistration = await Registration.findOne({
                event: eventId,
                teamName: teamName,
                teamSize: teamSize
            });

            if (existingTeamRegistration) {
                return res.status(400).json({
                    error: `A team registration already exists for "${teamName}" in this event. Only one registration per team is allowed.`
                });
            }
        }

        // Create registration
        const registration = await Registration.create({
            event: eventId,
            teamLeader: req.user._id, // Team member who is doing the registration
            teamLeaderDetails: {
                collegeName: teamLeaderDetails.collegeName,
                usn: teamLeaderDetails.usn,
                // Store the actual participant's information for spot registrations
                name: teamLeaderDetails.name || null,
                email: teamLeaderDetails.email || null,
                mobile: teamLeaderDetails.mobile || null,
            },
            collegeCode: collegeCode || null, // Store college code for team dashboard registrations
            teamName: teamName || null,
            teamMembers: teamMembers || [],
            teamSize: teamSize || 1,
            spotRegistration: req.user._id, // Mark as spot registration
            paymentStatus: paymentStatus,
            paymentMode: paymentMode,
            paymentId: paymentId || null,
            orderId: orderId || null,
            transactionId: transactionId || null,
            notes: notes || null
        });

        console.log('Created registration with payment mode:', registration.paymentMode);
        console.log('Created registration with payment status:', registration.paymentStatus);

        res.status(201).json({
            message: 'Spot registration completed successfully',
            registration: registration,
            paymentRequired: paymentStatus === 'pending'
        });
    } catch (err) {
        console.error('Spot registration error:', err);
        return res.status(500).json({ error: err.message });
    }
};

module.exports = { registerForEvent, viewMyRegistration, checkRegistration, spotRegistration };
