const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const securityMiddleware = require('./middleware/security');

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

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'SkillSwap API Foundation is running securely.' });
});

// Authentication Routes
app.use('/api/auth', require('./routes/auth'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;
