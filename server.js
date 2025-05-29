const express = require('express');
const app = express();
const connectToDb = require('./config/db');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const registrationRoutes = require('./routes/registration');
const eventRoutes = require('./routes/event');
const paymentRoutes = require('./routes/payment');

app.use(express.json());
app.use(cors());
connectToDb();

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/registration', registrationRoutes);
app.use('/api/event', eventRoutes);
app.use('/api/payment', paymentRoutes);

app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
})

//sfjeowjfw