const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const sanitizeBody = require('./middleware/sanitize');
const securityMiddleware = require('./middleware/security');
const { apiSlowDown } = require('./middleware/rateLimiter');
const ipBlock = require('./middleware/ipBlock');
const { csrfProtection } = require('./middleware/csrf');




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
  credentials: true, // required for withCredentials (cookies + Authorization header)
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// IP Blocking Middleware
app.use(ipBlock);

// Stripe webhook must receive the raw body for signature verification — mount BEFORE express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }), require('./routes/payments'));

// Parse JSON bodies and cookies (all other routes)
// SECURITY: 10 kb body size limit — prevents large-payload DoS attacks.
// A 10 kb JSON body is sufficient for all legitimate SkillSwap payloads.
// OWASP A05:2021 – Security Misconfiguration.
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// SECURITY: strip MongoDB operators ($where, $gt, etc.) from req.body.
// express-mongo-sanitize v2 crashes on Express 5 because it tries to overwrite req.query
// (now a read-only getter). We apply it only to req.body using a thin wrapper.
// Query parameters are defended by explicit String() casting in each route.
// OWASP A03:2021 – Injection
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body, { replaceWith: '_' });
  next();
});

// SECURITY: XSS sanitization — strips script tags and dangerous HTML from all req.body strings.
// Replaces the deprecated xss-clean package which crashed on Express 5 (req.query is read-only).
// OWASP A03:2021 – XSS
app.use(sanitizeBody);


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

// Booking Routes — CSRF protection applied as defence-in-depth
app.use('/api/bookings', csrfProtection, require('./routes/bookings'));

// Review Routes
app.use('/api/reviews', csrfProtection, require('./routes/reviews'));

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
