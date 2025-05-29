const axios = require('axios');

// Test script for production backend
const PRODUCTION_URL = 'https://halcyonbackend-1.onrender.com';

async function testEndpoint(endpoint, method = 'GET', data = null) {
  try {
    console.log(`\n🔍 Testing ${method} ${endpoint}`);
    
    const config = {
      method,
      url: `${PRODUCTION_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://halcyon2025.netlify.app' // Test with a frontend origin
      },
      timeout: 10000
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    console.log(`✅ Success: ${response.status} ${response.statusText}`);
    console.log(`📄 Response:`, JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.log(`❌ Error: ${error.response?.status || 'Network Error'}`);
    console.log(`📄 Error details:`, error.response?.data || error.message);
    return null;
  }
}

async function runTests() {
  console.log('🚀 Starting production backend tests...');
  console.log(`🔗 Testing backend at: ${PRODUCTION_URL}`);
  
  // Test health endpoint
  await testEndpoint('/health');
  
  // Test API info endpoint
  await testEndpoint('/api');
  
  // Test auth endpoints (these should return 404 or method not allowed, but not CORS errors)
  await testEndpoint('/api/auth');
  await testEndpoint('/api/auth/login', 'POST', { email: 'test@test.com', password: 'test' });
  
  // Test other endpoints
  await testEndpoint('/api/event');
  await testEndpoint('/api/admin');
  await testEndpoint('/api/registration');
  await testEndpoint('/api/payment');
  
  console.log('\n🏁 Tests completed!');
}

// Run the tests
runTests().catch(console.error);
