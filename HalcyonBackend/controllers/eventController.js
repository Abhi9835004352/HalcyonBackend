const Event = require('../models/eventModel');

const createEvent = async (req, res) => {
    try {
        const { name, description, date, venue, rules, prizes, coordinators, day, category, fees, minTeamSize, maxTeamSize } = req.body;

        // Log the request body for debugging
        console.log('Create event request body:', req.body);

        // Parse team size values to integers
        let parsedTeamSize = req.body.teamSize ? parseInt(req.body.teamSize) : 1;
        let parsedMinTeamSize = minTeamSize ? parseInt(minTeamSize) : parsedTeamSize;
        let parsedMaxTeamSize = maxTeamSize ? parseInt(maxTeamSize) : parsedTeamSize;

        // For team events (minTeamSize >= 3), ensure teamSize matches minTeamSize
        if (parsedMinTeamSize >= 3) {
            parsedTeamSize = parsedMinTeamSize;
            console.log('Set teamSize to match minTeamSize for team event:', parsedTeamSize);
        }
        const event = await Event.create({
            name,
            description,
            date,
            venue,
            rules: rules || [],
            prizes: prizes || [],
            coordinators: coordinators || [],
            day: day, // Default to Day 1 if not specified
            category: category || 'other', // Default to 'other' if not specified
            managedBy: req.user._id,
            teamSize: parsedTeamSize,
            minTeamSize: parsedMinTeamSize,
            maxTeamSize: parsedMaxTeamSize,
            fees: fees || 0,
        });
        res.status(201).json(event);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
}

const getAllEvents = async (req, res) => {
    try {
        const events = await Event.find();
        res.json(events);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
}

const getEventById = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ error: "Event not found" });
        res.json(event);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
};

const editEvent = async (req, res) => {
    try {
        // Log the request body for debugging
        console.log('Edit event request body:', req.body);
        console.log('Team size fields:', {
            teamSize: req.body.teamSize,
            minTeamSize: req.body.minTeamSize,
            maxTeamSize: req.body.maxTeamSize
        });

        // Make sure minTeamSize and maxTeamSize are properly set
        const updatedData = { ...req.body };

        // Parse all team size values to integers
        if (updatedData.teamSize !== undefined) {
            updatedData.teamSize = parseInt(updatedData.teamSize);
        }

        if (updatedData.minTeamSize !== undefined) {
            updatedData.minTeamSize = parseInt(updatedData.minTeamSize);
        }

        if (updatedData.maxTeamSize !== undefined) {
            updatedData.maxTeamSize = parseInt(updatedData.maxTeamSize);
        }

        // For team events (teamSize >= 3), ensure teamSize matches minTeamSize
        if (updatedData.minTeamSize !== undefined && updatedData.minTeamSize >= 3) {
            // Set teamSize to match minTeamSize for team events
            updatedData.teamSize = updatedData.minTeamSize;
            console.log('Updated teamSize to match minTeamSize:', updatedData.teamSize);
        }
        // If minTeamSize is undefined but teamSize is provided
        else if (updatedData.teamSize !== undefined) {
            // Set minTeamSize to match teamSize if not provided
            if (updatedData.minTeamSize === undefined) {
                updatedData.minTeamSize = updatedData.teamSize;
            }

            // Set maxTeamSize to match teamSize if not provided
            if (updatedData.maxTeamSize === undefined) {
                updatedData.maxTeamSize = updatedData.teamSize;
            }
        }

        const event = await Event.findByIdAndUpdate(req.params.id,
            {
                $set: {
                    ...updatedData,
                    teamSize: updatedData.teamSize,
                    minTeamSize: updatedData.minTeamSize,
                    maxTeamSize: updatedData.maxTeamSize
                }
            },
            { new: true }
        );
        if (!event) return res.status(404).json({ error: "Event not found" });

        console.log('Updated event:', {
            id: event._id,
            name: event.name,
            teamSize: event.teamSize,
            minTeamSize: event.minTeamSize,
            maxTeamSize: event.maxTeamSize
        });

        res.json(event);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
}

module.exports = { createEvent, getAllEvents, getEventById, editEvent };

