const mongoose = require('mongoose');
const User = require('./models/userModel');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const createAdminUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('Connected to MongoDB');

    // Check if our specific admin user already exists
    const existingAdmin = await User.findOne({ email: 'admin@123.com' });
    if (existingAdmin) {
      console.log('Admin user already exists:');
      console.log('Email:', existingAdmin.email);
      console.log('Name:', existingAdmin.name);
      console.log('Role:', existingAdmin.role);
      return;
    }

    // Create admin user
    const adminUser = new User({
      name: 'Admin User',
      email: 'admin@123.com',
      mobile: '9999999999',
      password: 'pass@admin', // This will be hashed automatically
      role: 'admin'
    });

    await adminUser.save();
    console.log('✅ Admin user created successfully!');
    console.log('Email: admin@123.com');
    console.log('Password: pass@admin');
    console.log('Role: admin');

    // Also create a team user for testing
    const existingTeam = await User.findOne({ email: 'team@halcyon.com' });
    if (!existingTeam) {
      const teamUser = new User({
        name: 'Team Member',
        email: 'team@halcyon.com',
        mobile: '8888888888',
        password: 'team123', // This will be hashed automatically
        role: 'team'
      });

      await teamUser.save();
      console.log('✅ Team user created successfully!');
      console.log('Email: team@halcyon.com');
      console.log('Password: team123');
      console.log('Role: team');
    } else {
      console.log('Team user already exists: team@halcyon.com');
    }

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the script
createAdminUser();
