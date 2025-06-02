const mongoose = require('mongoose');
require('dotenv').config();

async function createNewIndexes() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URL);
        console.log('Connected to MongoDB');

        // Get the registrations collection
        const db = mongoose.connection.db;
        const collection = db.collection('registrations');

        console.log('Creating new partial indexes...');

        // Create index for regular registrations
        try {
            await collection.createIndex(
                { 
                    event: 1, 
                    teamLeader: 1, 
                    'teamLeaderDetails.usn': 1 
                }, 
                { 
                    unique: true,
                    partialFilterExpression: { 
                        spotRegistration: { $exists: false } 
                    },
                    name: 'regular_registration_unique'
                }
            );
            console.log('✅ Created index for regular registrations');
        } catch (error) {
            console.log('⚠️ Regular registration index:', error.message);
        }

        // Create index for spot registrations (prevent duplicate participants)
        try {
            await collection.createIndex(
                { 
                    event: 1, 
                    'teamLeaderDetails.usn': 1 
                }, 
                { 
                    unique: true,
                    partialFilterExpression: { 
                        spotRegistration: { $exists: true } 
                    },
                    name: 'spot_registration_unique_participant'
                }
            );
            console.log('✅ Created index for spot registration duplicate prevention');
        } catch (error) {
            console.log('⚠️ Spot registration index:', error.message);
        }

        // List all indexes to verify
        const indexes = await collection.indexes();
        console.log('\nCurrent indexes after creation:');
        indexes.forEach((index, i) => {
            console.log(`${i + 1}. ${index.name}: ${JSON.stringify(index.key)}`);
            if (index.partialFilterExpression) {
                console.log(`   Partial filter: ${JSON.stringify(index.partialFilterExpression)}`);
            }
        });

        console.log('\n✅ Index creation completed successfully!');
        
    } catch (error) {
        console.error('Error creating indexes:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

createNewIndexes();
