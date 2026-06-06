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
  origin: process.env.NODE_ENV === 'production' ? 'https://skillswap.example.com' : 'http://localhost:3000',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// IP Blocking Middleware
app.use(ipBlock);

// Parse JSON bodies and cookies
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

// Admin Routes
app.use('/api/admin', require('./routes/admin'));

// Error handling middleware

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;
