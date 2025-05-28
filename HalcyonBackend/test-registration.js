const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

// Import models
const Registration = require('./models/registrationModel');
const Event = require('./models/eventModel');
const User = require('./models/userModel');

const testRegistration = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URL);
        console.log('Connected to MongoDB successfully');

        // Test creating a simple registration
        console.log('\n--- Testing Registration Creation ---');
        
        // First, let's check if we have any events
        const events = await Event.find().limit(1);
        console.log('Found events:', events.length);
        
        if (events.length === 0) {
            console.log('No events found. Creating a test event...');
            const testEvent = await Event.create({
                name: 'Test Event',
                description: 'Test event for registration testing',
                date: new Date(),
                venue: 'Test Venue',
                category: 'test',
                teamSize: 1,
                minTeamSize: 1,
                maxTeamSize: 1,
                fees: 0,
                registrationOpen: true
            });
            console.log('Test event created:', testEvent._id);
        }

        // Get the first event
        const event = await Event.findOne();
        console.log('Using event:', event.name, 'ID:', event._id);

        // Check if we have any users
        const users = await User.find().limit(1);
        console.log('Found users:', users.length);
        
        if (users.length === 0) {
            console.log('No users found. Creating a test user...');
            const testUser = await User.create({
                name: 'Test User',
                email: 'test@example.com',
                mobile: '1234567890',
                password: 'testpassword',
                role: 'user'
            });
            console.log('Test user created:', testUser._id);
        }

        // Get the first user
        const user = await User.findOne();
        console.log('Using user:', user.name, 'ID:', user._id);

        // Test registration data
        const registrationData = {
            event: event._id,
            teamLeader: user._id,
            teamLeaderDetails: {
                collegeName: 'Test College',
                usn: 'TEST123'
            },
            teamName: null,
            teamMembers: [],
            teamSize: 1,
            spotRegistration: null,
            paymentId: null,
            orderId: null,
            transactionId: null,
            paymentStatus: 'not_required'
        };

        console.log('\nAttempting to create registration with data:');
        console.log(JSON.stringify(registrationData, null, 2));

        // Check for existing registration
        const existingReg = await Registration.findOne({
            event: event._id,
            teamLeader: user._id
        });

        if (existingReg) {
            console.log('Existing registration found, deleting it first...');
            await Registration.deleteOne({ _id: existingReg._id });
        }

        // Create the registration
        const registration = await Registration.create(registrationData);
        console.log('\n✅ Registration created successfully!');
        console.log('Registration ID:', registration._id);
        console.log('Registration details:', registration);

        // Verify it was saved
        const savedRegistration = await Registration.findById(registration._id);
        console.log('\n✅ Registration verified in database!');
        console.log('Saved registration:', savedRegistration);

    } catch (error) {
        console.error('\n❌ Error during registration test:', error);
        
        if (error.name === 'ValidationError') {
            console.error('Validation errors:');
            Object.values(error.errors).forEach(err => {
                console.error(`- ${err.path}: ${err.message}`);
            });
        }
    } finally {
        await mongoose.connection.close();
        console.log('\nDatabase connection closed');
    }
};

// Run the test
testRegistration();
