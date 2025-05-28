const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

/**
 * Migration script to add unique compound index for preventing duplicate registrations
 * This ensures that the same user (teamLeader) cannot register for the same event twice
 */
const addUniqueRegistrationIndex = async () => {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URL);
        console.log('✅ Connected to MongoDB successfully');

        const db = mongoose.connection.db;
        const registrationsCollection = db.collection('registrations');

        console.log('\n📊 Checking existing registrations...');
        
        // Check for existing duplicate registrations
        const duplicates = await registrationsCollection.aggregate([
            {
                $group: {
                    _id: { event: "$event", teamLeader: "$teamLeader" },
                    count: { $sum: 1 },
                    docs: { $push: "$_id" }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            }
        ]).toArray();

        if (duplicates.length > 0) {
            console.log(`⚠️  Found ${duplicates.length} duplicate registration groups:`);
            
            for (const duplicate of duplicates) {
                console.log(`   Event: ${duplicate._id.event}, TeamLeader: ${duplicate._id.teamLeader}, Count: ${duplicate.count}`);
                
                // Keep the first registration and remove the rest
                const docsToRemove = duplicate.docs.slice(1);
                if (docsToRemove.length > 0) {
                    console.log(`   Removing ${docsToRemove.length} duplicate registrations...`);
                    await registrationsCollection.deleteMany({
                        _id: { $in: docsToRemove }
                    });
                }
            }
            console.log('✅ Duplicate registrations cleaned up');
        } else {
            console.log('✅ No duplicate registrations found');
        }

        console.log('\n🔧 Creating unique compound index...');
        
        // Create the unique compound index
        try {
            await registrationsCollection.createIndex(
                { event: 1, teamLeader: 1 }, 
                { 
                    unique: true,
                    name: 'unique_event_teamleader'
                }
            );
            console.log('✅ Unique compound index created successfully');
        } catch (indexError) {
            if (indexError.code === 11000) {
                console.log('⚠️  Index already exists or there are still duplicate records');
            } else {
                throw indexError;
            }
        }

        // Verify the index was created
        const indexes = await registrationsCollection.indexes();
        const uniqueIndex = indexes.find(index => index.name === 'unique_event_teamleader');
        
        if (uniqueIndex) {
            console.log('✅ Unique index verified:', uniqueIndex);
        } else {
            console.log('❌ Unique index not found');
        }

        console.log('\n📈 Final statistics:');
        const totalRegistrations = await registrationsCollection.countDocuments();
        console.log(`Total registrations: ${totalRegistrations}`);

        console.log('\n🎉 Migration completed successfully!');
        console.log('Duplicate registrations are now prevented at the database level.');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
        process.exit(0);
    }
};

// Run the migration
if (require.main === module) {
    addUniqueRegistrationIndex();
}

module.exports = addUniqueRegistrationIndex;
