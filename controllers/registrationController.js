const Registration = require('../models/registrationModel');
const sendEmail = require('../utils/mailer');
const mongoose = require('mongoose');
const Event = require('../models/eventModel');

const registerForEvent = async (req, res) => {
    try {
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
        // Validate team size
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
                return res.status(400).json({ error: `Team size must be ${event.teamSize} members` })
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

        // Check if event has a fee
        const eventFee = event.fees ? parseInt(event.fees) : 0;
        const paymentStatus = eventFee > 0 ? 'pending' : 'not_required';

        // Create registration record for regular user
        const registration = await Registration.create({
            event: eventId,
            teamLeader: req.user._id, // Set the authenticated user as team leader
            teamLeaderDetails: {
                collegeName: teamLeaderDetails.collegeName,
                usn: teamLeaderDetails.usn,
            },
            teamName: teamName || null,
            teamMembers: teamMembers || [],
            teamSize: teamSize || 1,
            spotRegistration: null, // This is a regular registration, not a spot registration
            paymentId: paymentId || null,
            paymentStatus: paymentStatus
        });

        res.status(201).json(registration);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}

const viewMyRegistration = async (req, res) => {
    try {
        // Find registrations where the user is either the team leader or the spot registration creator
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

/**
 * Handle spot registrations created by team members at the event venue
 */
const spotRegistration = async (req, res) => {
    try {
        console.log('Spot registration request received');
        console.log('Team member from token:', req.user);
        console.log('Request body:', req.body);
        console.log('Request params:', req.params);

        // Verify that the user has the team role
        if (req.user.role !== 'team') {
            return res.status(403).json({
                error: "Only team members can create spot registrations",
                message: "Regular users should use the standard registration endpoint"
            });
        }

        const { eventId } = req.params;
        const {
            teamName,
            teamMembers,
            teamSize,
            teamLeaderDetails,
            notes
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

        // Validate team size
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
                return res.status(400).json({ error: `Team size must be ${event.teamSize} members` })
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

        // For spot registrations, we need at least the first team member's details
        if (!teamMembers || teamMembers.length === 0 || !teamMembers[0].name || !teamMembers[0].email || !teamMembers[0].mobile) {
            return res.status(400).json({ error: "At least one team member with complete details is required" });
        }

        // Create a special object ID for spot registrations
        // This is a better approach than using the team member's ID as the team leader
        const spotRegistrationId = new mongoose.Types.ObjectId();

        // No payment references needed

        // Create registration record for spot registration
        const registration = await Registration.create({
            event: eventId,
            // Use a special ObjectId for spot registrations
            teamLeader: spotRegistrationId,
            teamLeaderDetails: {
                collegeName: teamLeaderDetails.collegeName,
                usn: teamLeaderDetails.usn,
            },
            teamName: teamName || null,
            teamMembers: teamMembers || [],
            teamSize: teamSize || 1,
            spotRegistration: req.user._id, // Mark this as a spot registration by the team member
            // For spot registrations, include team member info in the payment reference
            paymentId: null,
            orderId: null,
            paymentStatus: 'not_required',
            notes: notes || null // Store payment mode information
        });

        res.status(201).json(registration);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}

// Update payment information for a registration
const updatePayment = async (req, res) => {
    try {
        const { registrationId } = req.params;
        const { paymentId } = req.body;

        if (!mongoose.Types.ObjectId.isValid(registrationId)) {
            return res.status(400).json({ error: "Invalid registration ID format" });
        }

        if (!paymentId) {
            return res.status(400).json({ error: "Payment ID is required" });
        }

        // Find the registration
        const registration = await Registration.findById(registrationId);
        if (!registration) {
            return res.status(404).json({ error: "Registration not found" });
        }

        // Verify that the user is the team leader for this registration
        if (registration.teamLeader.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                error: "You are not authorized to update this registration",
                message: "Only the team leader can update payment information"
            });
        }

        // Update the payment information
        registration.paymentId = paymentId;
        registration.paymentStatus = 'completed';

        // Save the updated registration
        await registration.save();

        res.json({
            message: "Payment information updated successfully",
            registration
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

module.exports = { registerForEvent, viewMyRegistration, spotRegistration, updatePayment };