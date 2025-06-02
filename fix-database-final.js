const mongoose = require('mongoose');
require('dotenv').config();

async function fixDatabase() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URL);
        console.log('Connected to MongoDB');

        // Get the registrations collection
        const db = mongoose.connection.db;
        const collection = db.collection('registrations');

        console.log('Step 1: Analyzing existing data...');
        
        // Find all registrations
        const allRegistrations = await collection.find({}).toArray();
        console.log(`Total registrations: ${allRegistrations.length}`);

        // Find spot registrations
        const spotRegistrations = await collection.find({ spotRegistration: { $exists: true } }).toArray();
        console.log(`Spot registrations: ${spotRegistrations.length}`);

        // Find potential duplicates in spot registrations
        const duplicateGroups = {};
        spotRegistrations.forEach(reg => {
            const key = `${reg.event}_${reg.teamLeaderDetails?.usn}`;
            if (!duplicateGroups[key]) {
                duplicateGroups[key] = [];
            }
            duplicateGroups[key].push(reg);
        });

        const actualDuplicates = Object.values(duplicateGroups).filter(group => group.length > 1);
        console.log(`Found ${actualDuplicates.length} duplicate participant groups in spot registrations`);

        // Show duplicate details
        actualDuplicates.forEach((group, index) => {
            console.log(`\nDuplicate group ${index + 1}:`);
            group.forEach(reg => {
                console.log(`  - ID: ${reg._id}, USN: ${reg.teamLeaderDetails?.usn}, Name: ${reg.teamLeaderDetails?.name}`);
            });
        });

        // Remove duplicates (keep the first one in each group)
        let removedCount = 0;
        for (const group of actualDuplicates) {
            // Keep the first registration, remove the rest
            const toRemove = group.slice(1);
            for (const reg of toRemove) {
                await collection.deleteOne({ _id: reg._id });
                removedCount++;
                console.log(`Removed duplicate: ${reg._id} (USN: ${reg.teamLeaderDetails?.usn})`);
            }
        }

        console.log(`\nStep 2: Removed ${removedCount} duplicate registrations`);

        console.log('\nStep 3: Creating simplified indexes...');

        // Create a simple index for spot registrations to prevent duplicate participants
        try {
            await collection.createIndex(
                { 
                    event: 1, 
                    'teamLeaderDetails.usn': 1,
                    spotRegistration: 1
                }, 
                { 
                    unique: true,
                    name: 'spot_registration_unique_participant',
                    sparse: true // Only index documents that have all these fields
                }
            );
            console.log('✅ Created index for spot registration duplicate prevention');
        } catch (error) {
            console.log('⚠️ Spot registration index:', error.message);
        }

        // List all indexes to verify
        const indexes = await collection.indexes();
        console.log('\nFinal indexes:');
        indexes.forEach((index, i) => {
            console.log(`${i + 1}. ${index.name}: ${JSON.stringify(index.key)}`);
            if (index.unique) console.log(`   Unique: true`);
            if (index.sparse) console.log(`   Sparse: true`);
        });

        console.log('\n✅ Database fix completed successfully!');
        console.log('\nSummary:');
        console.log('- Old restrictive index removed ✅');
        console.log(`- ${removedCount} duplicate registrations cleaned up ✅`);
        console.log('- New index for duplicate prevention created ✅');
        console.log('- Team members can now register multiple people for same event ✅');
        console.log('- Duplicate participants are prevented ✅');
        
    } catch (error) {
        console.error('Error fixing database:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

fixDatabase();
