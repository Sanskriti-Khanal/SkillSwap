const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const securityMiddleware = require('./middleware/security');
const { apiSlowDown } = require('./middleware/rateLimiter');
const ipBlock = require('./middleware/ipBlock');




const app = express();

// Connect to MongoDB
const connectDB = require('./config/db');
connectDB();

// HTTP request logging
app.use(morgan('dev'));

// Security middleware
app.use(securityMiddleware.httpsRedirect);
app.use(securityMiddleware.helmetConfig);

// CORS configuration (restrict to localhost:3000 in dev)
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' ? 'https://skillswap.example.com' : (process.env.CLIENT_URL || 'http://localhost:5173'),
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// IP Blocking Middleware
app.use(ipBlock);

// Stripe webhook must receive the raw body for signature verification — mount BEFORE express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }), require('./routes/payments'));

// Parse JSON bodies and cookies (all other routes)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'SkillSwap API Foundation is running securely.' });
});

// Apply slow-down to all /api routes
app.use('/api', apiSlowDown);

// Authentication Routes
app.use('/api/auth', require('./routes/auth'));

// User Routes
app.use('/api/users', require('./routes/users'));

// Listing Routes
app.use('/api/listings', require('./routes/listings'));

// Booking Routes
app.use('/api/bookings', require('./routes/bookings'));

// Review Routes
app.use('/api/reviews', require('./routes/reviews'));

// Admin Routes
app.use('/api/admin', require('./routes/admin'));

// Payment Routes (non-webhook — webhook already mounted above with raw body parser)
app.use('/api/payments', require('./routes/payments'));


// Error handling middleware

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;
