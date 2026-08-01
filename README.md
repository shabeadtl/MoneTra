# Monetra Expense Manager 💰

Monetra is a premium, offline-first personal finance Progressive Web App (PWA). It enables users to capture transactions, track category-specific budgets, monitor charts, and manage accounts seamlessly—even when completely disconnected from the internet.

Built with **React (Vite)**, **Tailwind CSS**, **Zustand**, **Recharts**, and **Supabase (Postgres)**.

---

## Key Features

- **PWA Capabilities:** Desktop and mobile install support, asset caching, and full layout shell persistence when offline.
- **Offline-First Storage:** Local queue storage with Zustand/localStorage sync engine. Logs transactions instantly offline, and syncs automatically when internet connectivity returns.
- **Richer Mobile Interface:** Native-style bottom navigation bar on mobile screen sizes, combined with iOS Notch safe-area layout support. 
- **Slide-up Bottom Sheets:** Modal forms slide up natively on mobile devices and scale gracefully to centered viewports on desktop screens.
- **Detailed Transactions Table:** Multi-column text search, filtering by date (both *From* and *To* dates), income/expense filters, category filter, and sorting.
- **Automatic Budget Signals:** Budgets track monthly bounds, showing progress indicators with visual warning colors (amber at 80%, red on limit overflow) and persistent notifications.
- **CSV Data Extraction:** Export logs into a downloadable `expense_report.csv` file instantly.
- **Multi-tenant Admin Portal:** Closed staff/admin metrics dashboard showing registrations, platform volume activity, transaction health, and usage ratios.

---

## Getting Started

### 1. Database Setup (Supabase)
Monetra runs on Supabase (Postgres 15+).
1. Set up a free project on [Supabase Console](https://supabase.com/).
2. Navigate to **SQL Editor** on your Supabase dashboard.
3. Paste and run the database migration script: [`001_initial_schema.sql`](file:///e:/PROJECTS/EXPENSE_TRACKER/Monetra/supabase/migrations/001_initial_schema.sql). This establishes tables, Row-Level Security (RLS) policies, lifecycle functions, and trigger alarms.

### 2. Configure Environment variables
1. Copy [`.env.example`](file:///e:/PROJECTS/EXPENSE_TRACKER/Monetra/.env.example) to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Open `.env.local` and substitute your actual Supabase project API credentials:
   - `VITE_SUPABASE_URL`: Your Supabase API endpoint (e.g. `https://xxx.supabase.co`).
   - `VITE_SUPABASE_ANON_KEY`: Your project's anonymous token client key.

### 3. Local Development Run
Make sure you have Node.js installed on your machine.
1. Install project dependencies:
   ```bash
   npm install
   ```
2. Start the local server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.

---

## Deploying the Frontend to Cloudflare Pages

The backend is Supabase, so only the **frontend** (this Vite app) gets hosted on Cloudflare Pages. The repo is already configured for it:

- `public/_redirects` → SPA fallback: `/* /index.html 200` (static assets like `sw.js` are still served first)
- `public/_headers` → correct PWA caching (`sw.js`/`manifest.webmanifest` never stale-cached, hashed assets cached forever)
- `npm run build` → outputs the deployable site to `dist/`

### Dashboard flow (recommended)
1. Push this repo to GitHub/GitLab.
2. In the **Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git**, pick the repo.
3. Build settings:
   - **Framework preset:** Vite (or set manually)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node.js version:** set the `NODE_VERSION` environment variable to `22` (or `20`)
4. Add **Production** environment variables (Settings → Environment variables):
   - `VITE_SUPABASE_URL` — your Supabase API URL (e.g. `https://xxx.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY` — your project's anon key
5. Deploy. Client-side routes (`/transactions`, `/settings`, …) work via `_redirects`, and the PWA install icon appears once the site is served over HTTPS.

### CLI flow
```bash
npm run build
npx wrangler pages deploy dist --project-name=monetra
```

### CI/CD (GitHub Actions)
A ready-made workflow lives at `.github/workflows/deploy.yml` — every push to `main` lints, tests, builds, and deploys `dist/` to Cloudflare Pages automatically. To enable it, add these **repository secrets** (GitHub → Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with `Cloudflare Pages:Edit` permission
- `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID (dashboard, right-hand sidebar)
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — your Supabase project URL and anon key

Use **either** this workflow **or** the dashboard Connect-to-Git flow above — not both (they would double-deploy).

**Note:** `vercel.json` is only used if you ever deploy to Vercel instead — Cloudflare ignores it.

---

## CLI Verification Commands

Verify and compile code:
- **Build production assets:** `npm run build` (output placed in `dist/`)
- **Run linter diagnostics:** `npm run lint`
- **Execute unit test specs:** `npm run test`

---

## Security Architecture

- **Row-Level Security (RLS):** Policies are enforced on all tables, isolating rows with `auth.uid() = user_id`.
- **Admin RPC Policy:** The `get_admin_stats` function checks the user's `app_metadata` claims (`is_staff` or `role = 'admin'`). To configure an administrator account, set the staff claim via the Supabase Auth portal.
- **Storage Policy:** Storage writes for avatars are restricted to private user subfolders (`storage.objects` policies).
