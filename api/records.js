// ════════════════════════════════════════════════════════════════
// api/records.js — Vercel Serverless Function
// GET /api/records                        → latest 200 records
// GET /api/records?date=2026-05-07        → filter by date
// GET /api/records?staffId=STF-001        → filter by staff ID
// GET /api/records?date=X&staffId=Y      → filter by both
// Used by the Admin Dashboard.
// ════════════════════════════════════════════════════════════════

const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const connStr = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connStr) {
    console.error('[api/records] No database connection string found.');
    return res.status(500).json({ error: 'Database not configured.' });
  }

  try {
    const sql = neon(connStr);

    // Sanitise query params — only use if non-empty strings
    const date    = typeof req.query.date    === 'string' && req.query.date.trim()    ? req.query.date.trim()    : null;
    const staffId = typeof req.query.staffId === 'string' && req.query.staffId.trim() ? req.query.staffId.trim().toUpperCase() : null;

    // Build query with optional filters.
    // Using separate tagged-template calls per combination keeps
    // parameterization safe (no string interpolation of user input).
    let rows;

    if (date && staffId) {
      rows = await sql`
        SELECT id, staff_id, staff_name, action, timestamp, date
        FROM attendance
        WHERE date = ${date}
          AND staff_id = ${staffId}
        ORDER BY timestamp DESC
      `;
    } else if (date) {
      rows = await sql`
        SELECT id, staff_id, staff_name, action, timestamp, date
        FROM attendance
        WHERE date = ${date}
        ORDER BY timestamp DESC
      `;
    } else if (staffId) {
      rows = await sql`
        SELECT id, staff_id, staff_name, action, timestamp, date
        FROM attendance
        WHERE staff_id = ${staffId}
        ORDER BY timestamp DESC
        LIMIT 200
      `;
    } else {
      rows = await sql`
        SELECT id, staff_id, staff_name, action, timestamp, date
        FROM attendance
        ORDER BY timestamp DESC
        LIMIT 200
      `;
    }

    return res.status(200).json(rows);
  } catch (err) {
    console.error('[api/records] Query error:', err);
    return res.status(500).json({ error: 'Database query failed.' });
  }
};
