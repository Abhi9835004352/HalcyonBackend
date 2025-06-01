const mongoose = require('mongoose');
const User = require('./models/userModel');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const createTeamMembers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('Connected to MongoDB');

    // Define 5 team member accounts
    const teamMembers = [
      {
        name: 'Team Member 1',
        email: 'team1@halcyon.com',
        mobile: '9876543210',
        password: 'team123',
        role: 'team'
      },
      {
        name: 'Team Member 2',
        email: 'team2@halcyon.com',
        mobile: '9876543211',
        password: 'team123',
        role: 'team'
      },
      {
        name: 'Team Member 3',
        email: 'team3@halcyon.com',
        mobile: '9876543212',
        password: 'team123',
        role: 'team'
      },
      {
        name: 'Team Member 4',
        email: 'team4@halcyon.com',
        mobile: '9876543213',
        password: 'team123',
        role: 'team'
      },
      {
        name: 'Team Member 5',
        email: 'team5@halcyon.com',
        mobile: '9876543214',
        password: 'team123',
        role: 'team'
      },
        {
        name: 'Team Member 6',
        email: 'team6@halcyon.com',
        mobile: '9876543214',
        password: 'team123',
        role: 'team'
      }
    ];

    console.log('Creating team member accounts...\n');

    for (let i = 0; i < teamMembers.length; i++) {
      const memberData = teamMembers[i];
      
      // Check if user already exists
      const existingUser = await User.findOne({ email: memberData.email });
      if (existingUser) {
        console.log(`❌ Team member ${i + 1} already exists: ${memberData.email}`);
        continue;
      }

      // Create new team member
      const teamUser = new User(memberData);
      await teamUser.save();
      
      console.log(`✅ Team Member ${i + 1} created successfully!`);
      console.log(`   Name: ${memberData.name}`);
      console.log(`   Email: ${memberData.email}`);
      console.log(`   Password: ${memberData.password}`);
      console.log(`   Mobile: ${memberData.mobile}`);
      console.log(`   Role: ${memberData.role}\n`);
    }

    console.log('='.repeat(50));
    console.log('TEAM MEMBER LOGIN CREDENTIALS:');
    console.log('='.repeat(50));
    
    teamMembers.forEach((member, index) => {
      console.log(`Team Member ${index + 1}:`);
      console.log(`  Email: ${member.email}`);
      console.log(`  Password: ${member.password}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error creating team members:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the script
createTeamMembers();
