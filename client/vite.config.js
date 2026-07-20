import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Injects a strict Content-Security-Policy <meta> tag into the PRODUCTION
// build only — this is what actually protects the app in the browser
// (Express never serves this HTML; see server/src/middleware/security.js
// for the API-side Helmet CSP, which is defense-in-depth, not this).
//
// Dev is intentionally left with no CSP at all: Vite's dev server relies
// on eval-based transforms and an inline-bootstrapped HMR client that a
// strict script-src would break, and there's nothing for a dev-mode CSP
// to protect anyway — Express doesn't serve this HTML there either.
//
// Origins allowed, and why:
//   - accounts.google.com/gsi/  → Google Identity Services (GoogleLogin
//     button/popup). Script tag src is exactly gsi/client (verified in
//     @react-oauth/google's source); frame + connect need the gsi/ path.
//   - www.google.com/recaptcha/ + www.gstatic.com/recaptcha/ → reCAPTCHA
//     v2 checkbox (react-google-recaptcha loads api.js from google.com,
//     assets from gstatic.com; verified default hostname in its source).
//   - fonts.googleapis.com (style) + fonts.gstatic.com (font) → the
//     Nunito webfont <link> tags in this file.
//   - api.cloudinary.com (connect) → direct browser upload from
//     FileDropzone.jsx. res.cloudinary.com (img) → not used for display
//     yet, allowed ahead of the near-certain avatar/listing-image feature.
//   - meet.jit.si (frame only) → NOT currently required: Bookings/
//     PaymentSuccess open it via `target="_blank"` (a top-level
//     navigation, ungoverned by CSP), not an <iframe>. Allowed anyway so
//     switching to Jitsi's embedded IFrame API later needs no CSP change.
//   - Khalti needs NO entry: checkout is a top-level `window.location.href`
//     redirect, never a fetch/iframe/form-post from this origin.
//
// NOT relaxed: script-src has zero exceptions (no unsafe-inline/unsafe-eval)
// — grepped the whole client for eval()/dangerouslySetInnerHTML, there are
// none. style-src carries 'unsafe-inline' as a deliberate, scoped
// trade-off: React's `style={{...}}` prop compiles to a real HTML style=
// attribute (401 occurrences across 39 files in this codebase), which
// CSP's style-src — not script-src — governs. Inline CSS can exfiltrate
// data via attribute selectors but cannot execute JS, so this keeps the
// policy strict exactly where XSS actually runs code.
function strictCspPlugin(env) {
  const apiOrigin = env.VITE_API_ORIGIN || 'http://localhost:3000'
  const csp = [
    "default-src 'self'",
    "script-src 'self' https://accounts.google.com/gsi/client https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/",
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: https://res.cloudinary.com",
    `connect-src 'self' ${apiOrigin} https://api.cloudinary.com https://accounts.google.com/gsi/`,
    "frame-src https://accounts.google.com/gsi/ https://www.google.com/recaptcha/ https://meet.jit.si",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  // Note: frame-ancestors is deliberately omitted — browsers ignore it in
  // a <meta> CSP entirely. Clickjacking defense for the deployed SPA must
  // come from the static host's response headers (Vercel/Netlify header
  // rules, nginx, etc.), not from anything Vite can inject into the HTML.

  return {
    name: 'strict-csp-production-only',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html // dev server (no bundle) — skip, see note above
        return html.replace(
          '</title>',
          `</title>\n    <meta http-equiv="Content-Security-Policy" content="${csp}">`
        )
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    // NOTE: tailwindcss() is scoped in effect, not just in name — only files that
    // `@import` the Tailwind layers (see src/pages/tutor-hero/tailwind-hero.css)
    // ever pull in generated utility CSS. No other page imports it, so the rest of
    // the app's hand-written index.css is untouched. Preflight (Tailwind's browser
    // style reset) is deliberately NOT imported anywhere, to avoid it resetting
    // native element styles the rest of the app relies on.
    plugins: [react(), tailwindcss(), strictCspPlugin(env)],
  }
})
