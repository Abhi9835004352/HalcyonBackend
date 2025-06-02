const mongoose = require('mongoose');
require('dotenv').config();

async function testSpotRegistration() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URL);
        console.log('Connected to MongoDB');

        // Get the registrations collection
        const db = mongoose.connection.db;
        const collection = db.collection('registrations');

        // Check current indexes
        const indexes = await collection.indexes();
        console.log('Current indexes:');
        indexes.forEach((index, i) => {
            console.log(`${i + 1}. ${JSON.stringify(index.key)} - ${JSON.stringify(index)}`);
        });

        // Test: Try to create multiple spot registrations with same team member but different participants
        console.log('\n--- Testing Multiple Spot Registrations ---');
        
        // This should work now (same team member, different participants)
        const testRegistration1 = {
            event: new mongoose.Types.ObjectId(),
            teamLeader: new mongoose.Types.ObjectId(), // Same team member
            spotRegistration: new mongoose.Types.ObjectId(), // Same team member doing registration
            teamLeaderDetails: {
                name: 'John Doe',
                usn: 'USN001',
                email: 'john@example.com',
                mobile: '1234567890'
            },
            teamName: 'Test Team 1',
            teamSize: 1,
            paymentStatus: 'completed'
        };

        const testRegistration2 = {
            event: testRegistration1.event, // Same event
            teamLeader: testRegistration1.teamLeader, // Same team member
            spotRegistration: testRegistration1.spotRegistration, // Same team member doing registration
            teamLeaderDetails: {
                name: 'Jane Smith',
                usn: 'USN002', // Different participant USN
                email: 'jane@example.com',
                mobile: '0987654321'
            },
            teamName: 'Test Team 2',
            teamSize: 1,
            paymentStatus: 'completed'
        };

        try {
            // Insert first registration
            const result1 = await collection.insertOne(testRegistration1);
            console.log('✅ First spot registration successful:', result1.insertedId);

            // Insert second registration (should work with new schema)
            const result2 = await collection.insertOne(testRegistration2);
            console.log('✅ Second spot registration successful:', result2.insertedId);

            console.log('🎉 SUCCESS: Multiple spot registrations by same team member are now allowed!');

            // Clean up test data
            await collection.deleteMany({
                _id: { $in: [result1.insertedId, result2.insertedId] }
            });
            console.log('🧹 Test data cleaned up');

        } catch (error) {
            if (error.code === 11000) {
                console.log('❌ FAILED: Duplicate key error still exists');
                console.log('Error details:', error.message);
            } else {
                console.log('❌ Other error:', error.message);
            }
        }

        // Test: Try to create duplicate participant (should fail)
        console.log('\n--- Testing Duplicate Participant Prevention ---');
        
        const duplicateParticipant1 = {
            event: new mongoose.Types.ObjectId(),
            teamLeader: new mongoose.Types.ObjectId(),
            spotRegistration: new mongoose.Types.ObjectId(),
            teamLeaderDetails: {
                name: 'Duplicate User',
                usn: 'DUPLICATE_USN',
                email: 'duplicate@example.com',
                mobile: '1111111111'
            },
            teamName: 'Duplicate Test 1',
            teamSize: 1,
            paymentStatus: 'completed'
        };

        const duplicateParticipant2 = {
            event: duplicateParticipant1.event, // Same event
            teamLeader: new mongoose.Types.ObjectId(), // Different team member
            spotRegistration: new mongoose.Types.ObjectId(), // Different team member doing registration
            teamLeaderDetails: {
                name: 'Duplicate User',
                usn: 'DUPLICATE_USN', // Same participant USN (should fail)
                email: 'duplicate@example.com',
                mobile: '1111111111'
            },
            teamName: 'Duplicate Test 2',
            teamSize: 1,
            paymentStatus: 'completed'
        };

        try {
            // Insert first registration
            const result1 = await collection.insertOne(duplicateParticipant1);
            console.log('✅ First duplicate test registration successful:', result1.insertedId);

            // Try to insert duplicate participant (should fail)
            const result2 = await collection.insertOne(duplicateParticipant2);
            console.log('❌ UNEXPECTED: Duplicate participant was allowed:', result2.insertedId);

            // Clean up if both succeeded
            await collection.deleteMany({
                _id: { $in: [result1.insertedId, result2.insertedId] }
            });

        } catch (error) {
            if (error.code === 11000) {
                console.log('✅ SUCCESS: Duplicate participant correctly prevented');
                console.log('Error details:', error.message);
                
                // Clean up the first registration
                await collection.deleteMany({
                    'teamLeaderDetails.usn': 'DUPLICATE_USN'
                });
            } else {
                console.log('❌ Unexpected error:', error.message);
            }
        }

        console.log('\n--- Test Complete ---');
        
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

testSpotRegistration();
