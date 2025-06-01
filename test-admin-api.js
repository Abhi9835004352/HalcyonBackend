const axios = require('axios');

const testAdminAPI = async () => {
  try {
    console.log('🔐 Testing admin login...');
    
    // Step 1: Login as admin
    const loginResponse = await axios.post('http://localhost:4000/api/auth/login', {
      email: 'admin@123.com',
      password: 'pass@admin'
    });
    
    console.log('✅ Login successful!');
    console.log('User:', loginResponse.data.user);
    
    const token = loginResponse.data.token;
    console.log('Token received:', token ? 'Yes' : 'No');
    
    // Step 2: Test users endpoint
    console.log('\n👥 Testing users endpoint...');
    const usersResponse = await axios.get('http://localhost:4000/api/admin/users', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Users fetch successful!');
    console.log('Response structure:', Object.keys(usersResponse.data));
    
    if (usersResponse.data.users) {
      console.log(`Found ${usersResponse.data.users.length} users`);
      console.log('Sample user:', usersResponse.data.users[0]);
    } else if (Array.isArray(usersResponse.data)) {
      console.log(`Found ${usersResponse.data.length} users (direct array)`);
      console.log('Sample user:', usersResponse.data[0]);
    }
    
    // Step 3: Test registrations endpoint
    console.log('\n📋 Testing registrations endpoint...');
    try {
      const registrationsResponse = await axios.get('http://localhost:4000/api/admin/registrations', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('✅ Registrations fetch successful!');
      console.log(`Found ${registrationsResponse.data.length} registrations`);
    } catch (regError) {
      if (regError.response && regError.response.status === 404) {
        console.log('ℹ️ No registrations found (404) - this is normal');
      } else {
        console.error('❌ Registrations fetch failed:', regError.response?.data || regError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
};

// Run the test
testAdminAPI();
