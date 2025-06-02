const axios = require('axios');

const testLogin = async () => {
  try {
    console.log('🔍 Testing production backend login...');
    
    const response = await axios.post('https://halcyonbackend-1.onrender.com/api/auth/login', {
      email: 'admin@123.com',
      password: 'pass@admin'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173'
      },
      timeout: 10000
    });
    
    console.log('✅ Login request successful!');
    console.log('Response:', response.data);
    
  } catch (error) {
    console.log('❌ Login request failed:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
      console.log('Headers:', error.response.headers);
    } else if (error.request) {
      console.log('No response received:', error.request);
    } else {
      console.log('Error:', error.message);
    }
  }
};

testLogin();
