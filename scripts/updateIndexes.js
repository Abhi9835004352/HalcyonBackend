const mongoose = require('mongoose');
require('dotenv').config();

async function updateIndexes() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Get the registrations collection
        const db = mongoose.connection.db;
        const collection = db.collection('registrations');

        // Drop the old unique index
        try {
            await collection.dropIndex({ event: 1, teamLeader: 1 });
            console.log('Dropped old unique index: { event: 1, teamLeader: 1 }');
        } catch (error) {
            console.log('Old index not found or already dropped:', error.message);
        }

        // The new indexes will be created automatically when the model is loaded
        console.log('New indexes will be created automatically by Mongoose');
        
        console.log('Index update completed successfully!');
        
    } catch (error) {
        console.error('Error updating indexes:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

updateIndexes();
