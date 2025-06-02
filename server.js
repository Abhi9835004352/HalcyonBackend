const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectToDb = require('./config/db');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const registrationRoutes = require('./routes/registration');
const eventRoutes = require('./routes/event');
const paymentRoutes = require('./routes/payment');

// Load environment variables
dotenv.config();

const app = express();

// Trust proxy for production deployment
app.set('trust proxy', 1);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.get('Origin') || 'No Origin'}`);
  next();
});

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      // Development URLs
      'http://localhost:5173', // Vite default port
      'http://localhost:5174', // Alternative Vite port
      'http://localhost:5175', // Alternative Vite port
      'http://localhost:5176', // Alternative Vite port
      'http://localhost:3000', // React default port
      'http://127.0.0.1:5173', // Alternative localhost
      'http://127.0.0.1:5174', // Alternative localhost
      'http://127.0.0.1:5175', // Alternative localhost

      // Production URLs (add multiple possible frontend URLs)
      'https://halcyonfrontend.onrender.com',
      'https://halcyon-frontend.onrender.com',
      'https://halcyonfest.netlify.app',
      'https://halcyon2025.netlify.app',
      'https://halcyon-2025.netlify.app',
      'https://halcyonfestival.netlify.app',
      'https://halcyon-festival.netlify.app',
      'https://halcyon-fest.netlify.app',
      'https://halcyonfest2025.netlify.app',
      'https://halcyon2025fest.netlify.app',

      // Add common Netlify patterns
      'https://halcyon.netlify.app',
      'https://halcyonfrontend.netlify.app',
      'https://halcyon-frontend.netlify.app',

      // Add Vercel patterns (in case deployed there)
      'https://halcyon.vercel.app',
      'https://halcyon-frontend.vercel.app',
      'https://halcyonfrontend.vercel.app',

      // Add any custom domain if you have one
      // 'https://yourdomain.com',
    ];

    // Check if the origin is in the allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log(`✅ CORS allowed origin: ${origin}`);
      callback(null, true);
    } else {
      console.log(`⚠️ CORS origin not in whitelist: ${origin}`);
      // For debugging purposes, we'll allow all origins temporarily
      // In production, you should be more strict
      console.log(`🔓 Allowing origin for debugging: ${origin}`);
      callback(null, true);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-Access-Token'
  ]
};

console.log('🌐 CORS configured with dynamic origin checking');

app.use(cors(corsOptions));

// Add preflight handling for all routes
app.options('*', cors(corsOptions));

// Connect to database
connectToDb();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/registration', registrationRoutes);
app.use('/api/event', eventRoutes);
app.use('/api/payment', paymentRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 4000
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    message: 'Halcyon Backend API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      admin: '/api/admin',
      registration: '/api/registration',
      event: '/api/event',
      payment: '/api/payment'
    },
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('🚨 Unhandled error:', err);
  console.error('🚨 Request details:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body
  });

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.log(`🔍 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.originalUrl,
    availableRoutes: [
      'GET /health',
      'GET /api',
      'POST /api/auth/login',
      'POST /api/auth/register',
      'GET /api/event',
      'GET /api/admin',
      'GET /api/registration',
      'GET /api/payment'
    ]
  });
});

const PORT = process.env.PORT || 4001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 API base: http://localhost:${PORT}/api`);
});