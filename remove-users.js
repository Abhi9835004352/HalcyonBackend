const mongoose = require('mongoose');
const User = require('./models/userModel');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const removeSpecificUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('Connected to MongoDB');

    // List of emails to remove
    const emailsToRemove = ['2@2.com', '1@1.com'];

    console.log('🔍 Searching for users to remove...\n');

    for (const email of emailsToRemove) {
      // Check if user exists
      const user = await User.findOne({ email });
      
      if (user) {
        console.log(`📋 Found user: ${email}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Created: ${user.createdAt}`);
        
        // Delete the user
        await User.findOneAndDelete({ email });
        console.log(`✅ Successfully removed user: ${email}\n`);
      } else {
        console.log(`❌ User not found: ${email}\n`);
      }
    }

    // Verify removal by checking if users still exist
    console.log('🔍 Verifying removal...');
    for (const email of emailsToRemove) {
      const stillExists = await User.findOne({ email });
      if (stillExists) {
        console.log(`⚠️  User still exists: ${email}`);
      } else {
        console.log(`✅ Confirmed removal: ${email}`);
      }
    }

    console.log('\n🎉 User removal process completed!');

  } catch (error) {
    console.error('❌ Error removing users:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the script
removeSpecificUsers();
