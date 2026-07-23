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
const { accessDeniedMonitor, apiRequestRateMonitor } = require('./middleware/securityMonitor');




const app = express();

// SECURITY: without this, req.ip is the reverse proxy's address in any
// deployment that sits behind one (Render, the target in .env.production,
// terminates TLS and proxies to this app) — silently defeating every
// IP-based control in the codebase at once: authRateLimiter, apiSlowDown,
// ipBlock, LoginAttempt-based brute-force detection, every SecurityEvent/
// SecurityAlert threshold detector, the `ip` field on every AuditLog entry,
// and checkImpossibleTravel's geoip lookup. `1` (not `true`) trusts exactly
// one proxy hop — trusting an unbounded number would let a client forge its
// own X-Forwarded-For prefix if there's ever more than one hop in front.
// See docs/pentest-report.md finding PT-04.
// Make this unconditional so it is active in any deployment environment (e.g. staging, preview).
// Hop count verified live via /debug-ip against the production deployment: this
// app sits behind two real proxies (CDN edge, then the PaaS's own load balancer),
// so trusting only 1 hop resolved req.ip to the load balancer's internal address
// instead of the client. 3 is the empirically-confirmed value for this topology.
app.set('trust proxy', 3);

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
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true, // required for withCredentials (cookies + Authorization header)
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// IP Blocking Middleware
app.use(ipBlock);

// Suspicious-activity monitoring: watches every response for a 403 (see
// services/securityMonitor.js's repeated-access-denied detector). Mounted
// globally, ahead of body parsing, so it covers every route including
// ipBlock's own 403 above — one hook instead of one call site per source.
app.use(accessDeniedMonitor);

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

// Temporary debug route to hit through the real deployment to test IP forwarding
app.get('/debug-ip', (req, res) => res.json({ ip: req.ip, xff: req.headers['x-forwarded-for'] }));

// Suspicious-activity monitoring: excessive-request-rate detector (in-memory
// per-IP sliding window — see services/securityMonitor.js). Mounted BEFORE
// apiSlowDown deliberately: apiSlowDown delays high-volume requests by up to
// several seconds each, so counting after it would measure the throttled
// trickle instead of the true incoming rate, making a real burst look
// artificially spread out and never cross the threshold.
app.use('/api', apiRequestRateMonitor);

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

// Admin Tutor Application Review Routes — mounted before the general /api/admin
// router below so requests don't fall through its blanket auth check first.
// CSRF applied (deviates from the plain /api/admin mount) because these actions
// flip real user roles.
app.use('/api/admin/tutor-applications', csrfProtection, require('./routes/adminTutorApplications'));

// Admin Routes — CSRF protection applied, matching every other mutating
// route group (previously the one exception, despite containing the
// highest-impact mutations in the app: IP blocking, role changes including
// promotion to admin). Safe to add: the frontend's axios interceptor
// (client/src/utils/api.js) already attaches X-CSRF-Token on every mutating
// request regardless of whether the server enforces it. See
// docs/pentest-report.md finding PT-03.
app.use('/api/admin', csrfProtection, require('./routes/admin'));

// Payment Routes — CSRF protection applied as defence-in-depth (no webhook: KPG v2
// has no server-to-server completion callback, so there's no unauthenticated route left)
app.use('/api/payments', csrfProtection, require('./routes/payments'));

// Tutor Application Routes — CSRF protection applied (state-changing multi-step form)
app.use('/api/tutor-applications', csrfProtection, require('./routes/tutorApplications'));

// Notification Routes
app.use('/api/notifications', csrfProtection, require('./routes/notifications'));


// Error handling middleware

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;
