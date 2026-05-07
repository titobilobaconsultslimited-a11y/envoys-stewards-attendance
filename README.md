# Envoys Stewards Attendance — Biometric Attendance System

A complete, browser-based attendance system that uses your device's built-in **fingerprint sensor or Face ID** (via the WebAuthn API) for secure, passwordless check-in and check-out.

**Stack:** Neon (serverless PostgreSQL) + Vercel (static hosting + serverless functions). No Supabase account needed.

---

## Architecture

```
Phone/Browser
    │
    ├─ GET/POST /api/*  ─────►  Vercel Serverless Functions
    │                                    │
    └─ Static files                      └─► Neon PostgreSQL
       (index.html, app.js, style.css)         (cloud database)
```

The browser **never connects to the database directly**. All DB access goes through the `/api/*.js` functions which run server-side on Vercel.

---

## Features

- **Biometric authentication** — fingerprint / Face ID via WebAuthn (no passwords)
- **Register staff** — enrol a staff member's device biometric in seconds
- **Mark attendance** — tap Check In or Check Out, scan finger/face → done
- **Admin dashboard** — PIN-protected view with filters, stats, and CSV export
- **Neon + Vercel backend** — free tier, serverless, no server to manage
- **Fully responsive** — works on mobile and desktop browsers
- **Pure HTML/CSS/JS frontend** — no frameworks, no build step

---

## File Structure

```
├── index.html           # Single-page app entry point
├── style.css            # All styles
├── app.js               # Frontend logic (calls /api/*)
├── supabase-config.js   # Documentation — see Vercel env var setup
├── package.json         # Node dependency (@neondatabase/serverless)
├── database.sql         # SQL to run in Neon SQL Editor
├── api/
│   ├── staff.js         # GET /api/staff — lookup or list all staff
│   ├── register.js      # POST /api/register — upsert staff + credential
│   ├── attendance.js    # POST /api/attendance — record check-in/out
│   └── records.js       # GET /api/records — filtered attendance records
└── README.md
```

---

## Setup Guide

### Step 1 — Create a Neon Database

1. Go to [https://neon.tech](https://neon.tech) and sign up (free).
2. Click **New Project**, give it a name (e.g. `envoys-stewards-attendance`), choose a region.
3. After creation, go to your project's **Dashboard → Connection Details**.
4. Copy the **Connection string** — it looks like:
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
   Keep this safe — you'll need it in Step 4.

### Step 2 — Create the Database Tables

1. In the Neon dashboard, click **SQL Editor** in the left sidebar.
2. Open `database.sql` from this project, copy all the contents, paste and **Run**.
3. You should see "Success" for each statement.

### Step 3 — Deploy to Vercel

**Option A — Vercel CLI (recommended)**

```bash
npm install -g vercel
vercel
```
Follow the prompts. Vercel detects the `/api` folder and deploys the functions automatically.

**Option B — GitHub (easiest for ongoing updates)**

1. Push this folder to a GitHub repository.
2. Go to [https://vercel.com](https://vercel.com), sign up, and click **Add New Project**.
3. Import your GitHub repo. Vercel auto-detects it as a static + serverless project.
4. Click **Deploy**.

### Step 4 — Add the DATABASE_URL Environment Variable

1. In the Vercel dashboard, go to your project → **Settings** → **Environment Variables**.
2. Click **Add**:
   - **Name:** `DATABASE_URL`
   - **Value:** *(paste your Neon connection string from Step 1)*
   - **Environments:** ✅ Production  ✅ Preview  ✅ Development
3. Click **Save**.
4. Go to **Deployments** → click the latest deployment → **Redeploy**.

Your app is now live with HTTPS and a working database!

---

## How to Use

### Registering a Staff Member
1. Open the app and tap the **Register** tab (👤).
2. Enter the staff member's **Full Name** and **Staff ID**.
3. Tap **Register Fingerprint / Face ID**.
4. The browser will prompt for a biometric scan on the device being registered.

> Each staff member registers on **their own device**. The biometric is tied to the device's secure enclave.

### Marking Attendance (Check In / Check Out)
1. Tap the **Attendance** tab (🏠) — the default view.
2. Enter your **Staff ID** (or pick from the suggestion list).
3. Tap **Check In** (green) or **Check Out** (red).
4. Scan your finger or face when prompted.
5. A confirmation toast shows your name and timestamp.

### Admin Dashboard
1. Tap the **Admin** tab (🔐).
2. Enter the admin PIN (default: `admin123`).
3. Use the date/staff filters, **Export CSV**, and **Refresh** buttons.
4. Click **Lock** to log out of the dashboard.

---

## Changing the Admin PIN

Open `app.js` and find:

```js
const ADMIN_PIN = 'admin123';
```

Change to any value you prefer, save, and redeploy.

---

## Browser Compatibility

| Browser / Platform | Status |
|---|---|
| **Chrome on Android** (v67+) | ✅ Full support |
| **Safari on iOS 14+** | ✅ Full support (Face ID / Touch ID) |
| **Chrome on macOS / Windows** | ✅ Full support (Touch ID / Windows Hello) |
| **Edge on Windows** | ✅ Full support (Windows Hello) |
| **Firefox** | ⚠️ Partial — no platform authenticator on some versions |
| **localhost** | ⚠️ Works as a WebAuthn exception in most browsers |
| **Plain HTTP (non-local)** | ❌ WebAuthn blocked by browser |

---

## Security Notes

- **Biometric data never leaves the device.** The browser's secure enclave handles matching locally.
- The WebAuthn credential (a cryptographic key pair) lives in the device's TPM/Secure Enclave. Only the public key and credential ID are stored in Neon.
- The Neon connection string is stored as a Vercel Environment Variable — it is **never sent to the browser**.
- The admin PIN is hardcoded in client-side JS — intentional for an internal MVP. For production, replace with Vercel Auth or a proper authentication system.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| "Not supported" error | Use Chrome on Android or Safari on iOS 14+ |
| "Security error" | The app must be served over HTTPS (Vercel provides this automatically) |
| Biometric prompt doesn't appear | Make sure the device has a PIN/biometric set up in device settings |
| Staff ID not found | Register the staff member first from the Register tab |
| `/api/*` returns 500 | Check that `DATABASE_URL` is set in Vercel Environment Variables and redeploy |
| Tables don't exist | Re-run `database.sql` in the Neon SQL Editor |

A complete, browser-based attendance system that uses your device's built-in **fingerprint sensor or Face ID** (via the WebAuthn API) for secure, passwordless check-in and check-out. No native app, no backend server required.

---

## Features

- **Biometric authentication** — fingerprint / Face ID via WebAuthn (no passwords)
- **Register staff** — enrol a staff member's device biometric in seconds
- **Mark attendance** — tap Check In or Check Out, scan finger/face → done
- **Admin dashboard** — PIN-protected view with filters, stats, and CSV export
- **Supabase backend** — free PostgreSQL database, no server to manage
- **Fully responsive** — works on mobile and desktop browsers
- **Pure HTML/CSS/JS** — no frameworks, no build step, deploy anywhere

---

## File Structure

```
├── index.html          # Single-page app entry point
├── style.css           # All styles
├── app.js              # All JavaScript logic
├── supabase-config.js  # Your Supabase URL & anon key (edit this)
├── database.sql        # SQL to run in Supabase to create tables
└── README.md           # This file
```

---

## Setup Guide

### Step 1 — Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up for a free account.
2. Click **New project**.
3. Give it a name (e.g. `envoys-stewards-attendance`), choose a region, and set a database password.
4. Wait ~2 minutes for the project to provision.

### Step 2 — Create the Database Tables

1. In the Supabase dashboard, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open `database.sql` from this project, copy the entire contents, and paste it into the editor.
4. Click **Run** (or press Ctrl/Cmd + Enter).
5. You should see "Success. No rows returned."

### Step 3 — Get Your API Keys

1. In the Supabase dashboard, go to **Project Settings** → **API**.
2. Copy the **Project URL** (looks like `https://xxxxxxxxxxxx.supabase.co`).
3. Copy the **anon / public** key (a long JWT string).

### Step 4 — Configure the App

Open `supabase-config.js` and replace the placeholder values:

```js
const SUPABASE_URL      = 'https://xxxxxxxxxxxx.supabase.co';  // ← paste Project URL
const SUPABASE_ANON_KEY = 'eyJhbGci...';                        // ← paste anon key
```

Save the file.

### Step 5 — Deploy to Netlify (Free, HTTPS auto-included)

> **WebAuthn requires HTTPS.** Netlify and Vercel both provide free HTTPS automatically.

**Option A — Drag & Drop (easiest)**
1. Go to [https://app.netlify.com](https://app.netlify.com) and sign up / log in.
2. On the **Sites** page, scroll to the bottom where it says  
   *"Want to deploy a new site without connecting to Git? Drag and drop your site output folder here."*
3. Drag the entire project folder (containing `index.html`) into that drop zone.
4. Netlify instantly deploys it and gives you a URL like `https://wonderful-xyz.netlify.app`.
5. Open that URL on your phone's browser and you're live!

**Option B — Vercel**
1. Go to [https://vercel.com](https://vercel.com) and sign up.
2. Install the Vercel CLI: `npm i -g vercel`
3. In the project folder, run: `vercel`
4. Follow the prompts. Your site will be deployed with HTTPS.

---

## How to Use

### Registering a Staff Member
1. Open the app and tap the **Register** tab (👤).
2. Enter the staff member's **Full Name** and **Staff ID**.
3. Tap **Register Fingerprint / Face ID**.
4. The browser will prompt for a biometric scan on the device being registered.
5. A success message confirms the registration.

> Each staff member must register on **their own device**. The biometric is tied to the device's secure enclave.

### Marking Attendance (Check In / Check Out)
1. Open the app and tap the **Attendance** tab (🏠) — this is the default view.
2. Enter your **Staff ID** (or select from the suggestion list).
3. Tap **Check In** (green) or **Check Out** (red).
4. Scan your finger or face when prompted.
5. A confirmation message shows your name and the timestamp.

### Admin Dashboard
1. Tap the **Admin** tab (🔐).
2. Enter the admin PIN (default: `admin123`).
3. Use the date/staff filters and the **Apply Filter** button to narrow records.
4. Click **Export CSV** to download the current view as a spreadsheet.
5. Click **Lock** to log out of the dashboard.

---

## Changing the Admin PIN

Open `app.js` and find line:

```js
const ADMIN_PIN = 'admin123';
```

Change `'admin123'` to any value you prefer, save, and re-deploy.

---

## Browser Compatibility

| Browser / Platform | Status |
|---|---|
| **Chrome on Android** (v67+) | ✅ Full support |
| **Safari on iOS 14+** | ✅ Full support (Face ID / Touch ID) |
| **Chrome on macOS / Windows** | ✅ Full support (Touch ID / Windows Hello) |
| **Edge on Windows** | ✅ Full support (Windows Hello) |
| **Firefox** | ⚠️ Partial — no platform authenticator on some versions |
| **http://localhost** | ⚠️ Works in most browsers as a localhost exception |
| **Plain HTTP (non-local)** | ❌ WebAuthn blocked by browser |

---

## Security Notes

- Biometric data **never leaves the device**. The browser's secure enclave handles all biometric matching locally.
- The WebAuthn credential (a cryptographic key pair) is stored in the device's TPM/Secure Enclave. Only the **public key** (and credential ID) are stored in Supabase.
- The admin PIN is hardcoded in client-side JS — this is intentional for an internal MVP. For a production deployment, replace it with Supabase Auth.
- The Supabase **anon key** is safe to expose in client-side code. It only allows operations that your Row Level Security policies permit.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| "Not supported" error | Use Chrome on Android or Safari on iOS 14+ |
| "Security error" | The app must be served over HTTPS |
| Biometric prompt doesn't appear | Make sure the device has a PIN/biometric set up in device settings |
| Staff ID not found | Register the staff member first from the Register tab |
| Supabase connection error | Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct in `supabase-config.js` |
| RLS policy error | Re-run `database.sql` in the Supabase SQL editor |
