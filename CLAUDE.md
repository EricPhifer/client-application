# Client Application System - Claude Code Instructions

## Project Overview
Public-facing application form for Phifer Web Solutions at `apply.ericphifer.tech`.
Vue 3 + TypeScript + Tailwind CSS 4 + Vite 7 + Netlify Functions.
GitHub: `EricPhifer/client-application`

## Pipeline Documentation Sync
**IMPORTANT:** When making significant changes to this project, update the unified pipeline doc at:
`/Users/phiferweb/Desktop/Business Pipeline/phifer-web-solutions-pipeline.md`

Significant changes include:
- Adding, removing, or renaming routes
- Adding, removing, or modifying Netlify Functions
- Changing database tables or schema
- Adding or removing dependencies/services (e.g., Auth0, Resend, Stripe)
- Changing the domain, ports, or deployment configuration
- Modifying the auto-assessment logic or scoring
- Adding new environment variables
- Changing how this project interacts with Health Check or Client Dashboard

Update the "Client Application System - Technical Reference" section and any other affected sections (Current Status, System Architecture, etc.).

## Tech Stack & Conventions
- **Tailwind CSS 4**: CSS-native config via `@import "tailwindcss"` + `@theme` in `src/style.css`. No `tailwind.config.js`.
- **Vite dev server**: Port `5175`. Netlify Functions dev on port `9999` via `npm run dev:functions`.
- **Dark mode**: Class-based toggle (`.dark` on `<html>`), defaults to light, persists to localStorage key `pws-theme`.
- **No Auth0**: This is a public-facing app with no protected routes.
- **No Resend**: Email notifications handled by the Client Dashboard project.
- **Shared Turso DB**: Reads from `prospects`, writes to `applications` and updates `prospects`.
- **VS Code workspace**: Red-primary color scheme (to distinguish from teal-themed Health Check).

## Routes
- `/` - Application form (Apply.vue)
- `/thank-you` - Post-submission confirmation (ApplyThankYou.vue)

## Key Files
- `src/style.css` - Brand theme tokens (Teal Warmth, light + dark)
- `src/composables/useTheme.ts` - Light/dark mode toggle
- `netlify/functions/submit-application.ts` - Validation, auto-assessment, DB write
- `netlify/functions/get-prospect.ts` - Pre-fill from Health Check prospect
- `database/migrations/001_initial_schema.sql` - Shared 7-table schema
- `brand-colors.json` - Brand color definitions
