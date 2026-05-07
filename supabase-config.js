// ════════════════════════════════════════════════════════════════
// Envoys Stewards Attendance — Database Configuration (Neon + Vercel)
// ════════════════════════════════════════════════════════════════
//
// This project uses Neon (serverless PostgreSQL) as the database
// and Vercel Serverless Functions (/api/*.js) as the backend API.
//
// There is NO client-side database config needed here.
// The database connection string lives securely in Vercel as an
// Environment Variable — it never touches the browser.
//
// ─────────────────────────────────────────────────────────────
// HOW TO SET UP THE DATABASE_URL ENVIRONMENT VARIABLE ON VERCEL:
// ─────────────────────────────────────────────────────────────
//
// 1. Create a free Neon account at https://neon.tech
//
// 2. Create a new project in Neon.
//    You will receive a PostgreSQL connection string like:
//    postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
//
// 3. In the Neon SQL Editor, run the SQL in /database.sql to create
//    the staff and attendance tables.
//
// 4. Deploy this project to Vercel (see README.md for instructions).
//
// 5. In the Vercel dashboard:
//    → Your project → Settings → Environment Variables
//    → Add a new variable:
//         Name : DATABASE_URL
//         Value: (paste your Neon connection string)
//         Environments: Production, Preview, Development
//
// 6. Redeploy the project (Vercel → Deployments → Redeploy).
//    The /api/*.js functions will pick up DATABASE_URL automatically.
//
// ─────────────────────────────────────────────────────────────
// ⚠️  SECURITY NOTE:
//    Never paste your Neon connection string directly into any .js
//    file that is committed to a public repository.
//    Always use Vercel Environment Variables.
// ─────────────────────────────────────────────────────────────
