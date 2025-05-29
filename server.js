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

// Middleware
app.use(express.json());

// CORS configuration
const corsOptions = {
  origin: [
    // Development URLs
    'http://localhost:5173', // Vite default port
    'http://localhost:5174', // Alternative Vite port
    'http://localhost:3000', // React default port
    'http://127.0.0.1:5173', // Alternative localhost
    'http://127.0.0.1:5174', // Alternative localhost

    // Production URLs (add multiple possible frontend URLs)
    'https://halcyonfrontend.onrender.com',
    'https://halcyon-frontend.onrender.com',
    'https://halcyonfest.netlify.app',
    'https://halcyon2025.netlify.app',
    'https://halcyon-2025.netlify.app',

    // Add any custom domain if you have one
    // 'https://yourdomain.com',
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

console.log('🌐 CORS configured for origins:', corsOptions.origin);

app.use(cors(corsOptions));

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
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});