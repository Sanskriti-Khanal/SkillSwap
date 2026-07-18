import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // NOTE: tailwindcss() is scoped in effect, not just in name — only files that
  // `@import` the Tailwind layers (see src/pages/tutor-hero/tailwind-hero.css)
  // ever pull in generated utility CSS. No other page imports it, so the rest of
  // the app's hand-written index.css is untouched. Preflight (Tailwind's browser
  // style reset) is deliberately NOT imported anywhere, to avoid it resetting
  // native element styles the rest of the app relies on.
  plugins: [react(), tailwindcss()],
})
